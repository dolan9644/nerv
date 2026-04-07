#!/usr/bin/env node
/**
 * ███ NERV · REI 记忆提纯引擎 · memory_purify.js (Harness Hardened) ███
 *
 * 分页消费 memory_queue/ 目录，每批最多处理 100 个文件。
 *
 * Harness 补丁：
 *   1. 移动后处理：queue/ → processing/ → archived/（读写物理隔离）
 *   2. renameSync try/catch 防 EBUSY 文件锁竞争
 *   3. 记忆环形缓冲区（Rolling Buffer）替代硬性 180 行墙
 *   4. unknown Agent → shared/memory/MEMORY.md（流浪记忆收容所）
 *
 * 用法：node scripts/memory_purify.js [--batch-size 100] [--dry-run]
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, renameSync, existsSync, statSync, rmdirSync } from 'fs';
import { spawnSync } from 'child_process';
import { join, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { writeAuditLog, closeDb } from './db.js';
import NERV_AGENTS from './nerv_agents_registry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ═══════════════════════════════════════════════════════════════
// 配置
// ═══════════════════════════════════════════════════════════════

const NERV_ROOT = resolve(__dirname, '..');
const QUEUE_DIR = join(NERV_ROOT, 'memory_queue');
const PROCESSING_DIR = join(QUEUE_DIR, 'processing');
const CORRUPTED_DIR = join(QUEUE_DIR, 'corrupted');  // Rei SOUL.md 损坏文件隔离协议
const AGENTS_DIR = join(NERV_ROOT, 'agents');
const SHARED_MEMORY_DIR = join(AGENTS_DIR, 'shared', 'memory');
const VALID_EXTENSIONS = new Set(['.md', '.json', '.txt']);
const AGENT_BY_ID = new Map(NERV_AGENTS.map(agent => [agent.id, agent]));
const WORKSPACE_TO_AGENT_ID = new Map(
  NERV_AGENTS.map(agent => [basename(agent.workspace), agent.id])
);
const IGNORED_QUEUE_PREFIXES = ['purify_report_'];

// 命令行参数
const args = process.argv.slice(2);
const BATCH_SIZE = parseInt(args[args.indexOf('--batch-size') + 1]) || 100;
const DRY_RUN = args.includes('--dry-run');
const JOB_STARTED_AT_MS = Date.now();

// V8 内存安全阈值
const MAX_FILE_SIZE = 1024 * 1024; // 1MB
const MAX_MEMORY_LINES = 200;
const MAX_COMPACT_INPUT_CHARS = 6000;
const MODEL_TIMEOUT_MS = parseInt(process.env.NERV_MEMORY_MODEL_TIMEOUT_MS || '12000', 10);
const REMOTE_MODEL_TIMEOUT_MS = parseInt(process.env.NERV_MEMORY_REMOTE_MODEL_TIMEOUT_MS || String(MODEL_TIMEOUT_MS), 10);
const MAX_JOB_WALL_MS = parseInt(process.env.NERV_MEMORY_MAX_JOB_WALL_MS || '240000', 10);

let cachedOllamaModel = null;

// ═══════════════════════════════════════════════════════════════
// 目录准备
// ═══════════════════════════════════════════════════════════════

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function getArchiveDir() {
  const today = new Date().toISOString().split('T')[0];
  const dir = join(QUEUE_DIR, 'archived', today);
  ensureDir(dir);
  return dir;
}

// ═══════════════════════════════════════════════════════════════
// 安全的文件移动（防 EBUSY 竞争）
// ═══════════════════════════════════════════════════════════════

function safeMove(src, dest) {
  try {
    renameSync(src, dest);
    return true;
  } catch (e) {
    if (e.code === 'EBUSY' || e.code === 'EPERM' || e.code === 'ENOENT') {
      console.warn(`[REI] 跳过被占用文件: ${basename(src)} (${e.code}), 留给下一批`);
      return false;
    }
    throw e; // 其他错误直接抛
  }
}

// ═══════════════════════════════════════════════════════════════
// 扫描队列（只读文件名列表，不读内容）
// ═══════════════════════════════════════════════════════════════

function scanQueue() {
  if (!existsSync(QUEUE_DIR)) {
    console.log('[REI] memory_queue/ 不存在，跳过');
    return [];
  }

  return readdirSync(QUEUE_DIR)
    .filter(f => {
      if (IGNORED_QUEUE_PREFIXES.some(prefix => f.startsWith(prefix))) return false;
      const ext = extname(f).toLowerCase();
      if (!VALID_EXTENSIONS.has(ext)) return false;
      const fullPath = join(QUEUE_DIR, f);
      try { return statSync(fullPath).isFile(); } catch { return false; }
    })
    .sort();
}

function normalizeAgentReference(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed === 'shared' || trimmed === 'unknown') return 'shared';
  if (AGENT_BY_ID.has(trimmed)) return trimmed;
  if (trimmed.startsWith('nerv-') && AGENT_BY_ID.has(trimmed)) return trimmed;

  const workspaceKey = trimmed.replace(/^nerv-/, '');
  if (WORKSPACE_TO_AGENT_ID.has(workspaceKey)) {
    return WORKSPACE_TO_AGENT_ID.get(workspaceKey);
  }

  return null;
}

function resolveMemoryTargetDir(agentRef) {
  const normalized = normalizeAgentReference(agentRef);
  if (!normalized || normalized === 'shared') {
    return { agentId: 'shared', memoryDir: SHARED_MEMORY_DIR, label: 'shared' };
  }

  const agent = AGENT_BY_ID.get(normalized);
  if (!agent) {
    return { agentId: 'shared', memoryDir: SHARED_MEMORY_DIR, label: 'shared' };
  }

  return {
    agentId: normalized,
    memoryDir: join(agent.workspace, 'memory'),
    label: agent.name || agent.identity?.name || normalized
  };
}

function parseQueueRecord(rawContent) {
  if (typeof rawContent !== 'string') return null;
  try {
    const parsed = JSON.parse(rawContent);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function stringifyCompact(value, limit = 240) {
  if (value === null || value === undefined) return '';
  const raw = typeof value === 'string' ? value : (() => {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  })();
  return raw.length > limit ? `${raw.slice(0, limit)}…` : raw;
}

function buildCompressionPrompt(record, targetAgentId, rawContent) {
  const compactInput = rawContent.slice(0, MAX_COMPACT_INPUT_CHARS);
  const fields = [
    `event: ${record?.event || ''}`,
    `task_id: ${record?.task_id || ''}`,
    `node_id: ${record?.node_id || ''}`,
    `dispatch_id: ${record?.dispatch_id || ''}`,
    `source_agent: ${record?.source_agent || ''}`,
    `memory_targets: ${stringifyCompact(record?.memory_targets || [])}`,
    `task_intent: ${record?.task_intent || ''}`,
    `node_description: ${record?.node_description || ''}`,
    `task_status: ${record?.task_status || ''}`,
    `outputs: ${stringifyCompact(record?.outputs || [])}`,
    `error: ${stringifyCompact(record?.error || '')}`,
    `note: ${stringifyCompact(record?.note || '')}`
  ].join('\n');

  return [
    `你是 NERV 的记忆压缩器。请把这条运行事实压缩成适合写入 ${targetAgentId}/MEMORY.md 的内容。`,
    `要求：`,
    `- 只保留可复用事实、教训、稳定偏好、失败原因、成功模式`,
    `- 删除时间戳噪音、重复日志、无意义聊天`,
    `- 输出中文 Markdown，2-5 条要点`,
    `- 不要编造`,
    `- 如果这条记录更适合共享记忆，请在末尾额外加一行 "共享建议: 是/否"`,
    ``,
    `结构化元数据：`,
    fields,
    ``,
    `原始内容：`,
    compactInput
  ].join('\n');
}

function discoverOllamaModel() {
  if (cachedOllamaModel !== null) return cachedOllamaModel;

  const explicit = process.env.NERV_MEMORY_OLLAMA_MODEL || process.env.OLLAMA_MODEL;
  if (explicit) {
    cachedOllamaModel = explicit.trim();
    return cachedOllamaModel;
  }

  try {
    const result = spawnSync('ollama', ['list'], { encoding: 'utf-8', timeout: 5000 });
    if (result.status === 0 && result.stdout) {
      const lines = result.stdout.split('\n').map(line => line.trim()).filter(Boolean);
      if (lines.length >= 2) {
        const header = lines[0].toLowerCase();
        const looksLikeTable = header.includes('name') || header.includes('model');
        const dataLine = looksLikeTable ? lines[1] : lines[0];
        const modelName = dataLine.split(/\s+/)[0];
        if (modelName) {
          cachedOllamaModel = modelName;
          return cachedOllamaModel;
        }
      }
    }
  } catch {
    // ignore
  }

  cachedOllamaModel = '';
  return cachedOllamaModel;
}

function runModelCompression(command, args, timeoutMs = 120000) {
  try {
    const result = spawnSync(command, args, {
      encoding: 'utf-8',
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024
    });
    const stdout = (result.stdout || '').trim();
    const stderr = (result.stderr || '').trim();
    if (result.status === 0 && stdout.length > 0) {
      return { ok: true, text: stdout, detail: `${command}` };
    }
    return {
      ok: false,
      text: '',
      detail: stderr || stdout || `exit_${result.status}`
    };
  } catch (error) {
    return { ok: false, text: '', detail: error.message };
  }
}

function remainingJobBudgetMs() {
  return Math.max(0, MAX_JOB_WALL_MS - (Date.now() - JOB_STARTED_AT_MS));
}

function canSpendModelBudget(minimumMs = 3000) {
  return remainingJobBudgetMs() >= minimumMs;
}

function compressMemoryRecord(record, rawContent, targetAgentId) {
  if (rawContent.trim().length <= 220 || !record) {
    return rawContent.trim();
  }

  const prompt = buildCompressionPrompt(record, targetAgentId, rawContent);

  const ollamaModel = discoverOllamaModel();
  if (ollamaModel && canSpendModelBudget()) {
    const ollama = runModelCompression(
      'ollama',
      ['run', ollamaModel, prompt],
      Math.min(MODEL_TIMEOUT_MS, remainingJobBudgetMs())
    );
    if (ollama.ok) return ollama.text;
  }

  if (canSpendModelBudget()) {
    const gemini = runModelCompression(
      'gemini',
      ['--prompt', prompt],
      Math.min(REMOTE_MODEL_TIMEOUT_MS, remainingJobBudgetMs())
    );
    if (gemini.ok) return gemini.text;
  }

  const fallback = [
    `### ${record.event || 'task_event'} · ${record.task_id || 'unknown'}`,
    `- source: ${record.source_agent || 'unknown'}`,
    `- task: ${record.task_intent || record.node_description || '未提供任务说明'}`,
    record.error ? `- error: ${stringifyCompact(record.error)}` : null,
    record.outputs && record.outputs.length > 0 ? `- outputs: ${stringifyCompact(record.outputs)}` : null,
    `- 共享建议: 否`,
    `- 归档说明: 模型压缩不可用，已回退到结构化摘要`
  ].filter(Boolean).join('\n');

  return fallback;
}

function resolveMemoryTargets(record, filename) {
  const rawTargets = [];

  if (record && Array.isArray(record.memory_targets)) {
    rawTargets.push(...record.memory_targets);
  } else if (record && typeof record.memory_targets === 'string') {
    rawTargets.push(record.memory_targets);
  }

  if (record && record.source_agent) {
    rawTargets.push(record.source_agent);
  }

  if (record && record.node_agent_id) {
    rawTargets.push(record.node_agent_id);
  }

  if (rawTargets.length === 0) {
    rawTargets.push(inferAgentId(filename));
  }

  const normalized = [];
  const seen = new Set();
  for (const target of rawTargets) {
    const resolved = normalizeAgentReference(target) || (target === 'shared' ? 'shared' : null);
    if (!resolved || seen.has(resolved)) continue;
    seen.add(resolved);
    normalized.push(resolved);
  }

  return normalized.length > 0 ? normalized : ['shared'];
}

// ═══════════════════════════════════════════════════════════════
// 评估单个文件是否有长期保存价值
// ═══════════════════════════════════════════════════════════════

function evaluateValue(content, filename) {
  const LOW_VALUE = [
    'HEARTBEAT_OK', 'no anomalies', '无异常',
    'session cleared', 'Session 销毁'
  ];
  const HIGH_VALUE = [
    'FAILED', 'ERROR', 'CIRCUIT_BROKEN', 'SECURITY_ALERT',
    'bug', 'fix', '修复', '经验', '教训', '规律', '模式',
    'NODE_COMPLETED', 'DAG_CREATED'
  ];

  const lowerContent = content.toLowerCase();

  if (content.trim().length < 20) return { keep: false, reason: '内容过短' };

  for (const kw of LOW_VALUE) {
    if (lowerContent.includes(kw.toLowerCase())) {
      return { keep: false, reason: `低价值: ${kw}` };
    }
  }
  for (const kw of HIGH_VALUE) {
    if (lowerContent.includes(kw.toLowerCase())) {
      return { keep: true, reason: `高价值: ${kw}` };
    }
  }

  return content.trim().length > 100
    ? { keep: true, reason: '内容充实' }
    : { keep: false, reason: '不够充实' };
}

// ═══════════════════════════════════════════════════════════════
// 从文件名推断来源 Agent
// ═══════════════════════════════════════════════════════════════

function inferAgentId(filename) {
  const name = basename(filename, extname(filename)).toLowerCase();
  const knownAgents = [
    'misato', 'seele', 'ritsuko', 'shinji', 'rei', 'gendo',
    'asuka', 'kaworu', 'mari',
    'eva-00', 'eva-01', 'eva-02', 'eva-03', 'eva-13', 'eva-series'
  ];
  for (const agent of knownAgents) {
    if (name.includes(agent)) return agent;
  }
  return 'unknown';
}

// ═══════════════════════════════════════════════════════════════
// 记忆环形缓冲区（Rolling Buffer）—— 追加到 MEMORY.md
// 超过 MAX_MEMORY_LINES 时，滚动删除最早的条目（非硬性拒绝）
// ═══════════════════════════════════════════════════════════════

function appendToMemory(agentRef, content, sourceFile) {
  const resolved = resolveMemoryTargetDir(agentRef);
  let memoryDir = resolved.memoryDir;
  let memoryFile = join(memoryDir, 'MEMORY.md');
  ensureDir(memoryDir);

  const timestamp = new Date().toISOString().split('T')[0];
  const newEntry = `\n---\n### [${timestamp}] 来源: ${sourceFile}\n${content.trim()}\n`;

  if (DRY_RUN) {
    console.log(`[DRY-RUN] 追加到 ${memoryFile}: ${content.slice(0, 50)}...`);
    return true;
  }

  try {
    let existingContent = existsSync(memoryFile)
      ? readFileSync(memoryFile, 'utf-8')
      : `# ${resolved.label} 长期记忆\n`;

    let lines = (existingContent + newEntry).split('\n');

    // 滚动删除：超过上限时，保留标题行，整块删除最早的 Entry
    if (lines.length > MAX_MEMORY_LINES) {
      console.warn(`[REI] ${resolved.label}/MEMORY.md 触发容量保护 (${lines.length}行)，滚动移除旧记忆...`);
      const header = lines[0];
      const dataLines = lines.slice(1);
      // 找到第一个 '---' 分割线，且位于溢出部分之后
      const overflow = lines.length - MAX_MEMORY_LINES;
      const cutIndex = dataLines.findIndex((l, i) => i >= overflow && l.startsWith('---'));
      lines = [header, ...dataLines.slice(cutIndex !== -1 ? cutIndex : overflow)];
    }

    // 原子写入：先写 .tmp 再 rename，防断电/OOM 导致 Agent 失忆
    const tmpFile = memoryFile + '.tmp';
    writeFileSync(tmpFile, lines.join('\n'));
    renameSync(tmpFile, memoryFile);
    return true;
  } catch (e) {
    console.error(`[REI] 写入 ${memoryFile} 失败: ${e.message}`);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// 主执行逻辑：物理隔离 + 分页消费
//   queue/ ──(safeMove)──> processing/ ──(处理)──> archived/
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log(`[REI] 记忆提纯引擎启动 | batch=${BATCH_SIZE} | dry_run=${DRY_RUN}`);

  const allFiles = scanQueue();
  console.log(`[REI] 队列中共 ${allFiles.length} 个文件`);

  if (allFiles.length === 0) {
    console.log('[REI] 无待处理文件，退出');
    closeDb();
    return;
  }

  ensureDir(PROCESSING_DIR);
  const archiveDir = getArchiveDir();
  let totalProcessed = 0;
  let totalKept = 0;
  let totalDiscarded = 0;
  let totalSkipped = 0;
  let batchNumber = 0;

  for (let offset = 0; offset < allFiles.length; offset += BATCH_SIZE) {
    batchNumber++;
    const batch = allFiles.slice(offset, offset + BATCH_SIZE);
    console.log(`[REI] 第 ${batchNumber} 批 | ${batch.length} 个文件`);

    for (const filename of batch) {
      if (remainingJobBudgetMs() <= 0) {
        console.warn('[REI] 本次提纯任务达到墙钟时间预算，剩余文件留给下一批');
        totalSkipped += (batch.length - batch.indexOf(filename));
        break;
      }

      const srcPath = join(QUEUE_DIR, filename);
      const procPath = join(PROCESSING_DIR, filename);

      // Step 1: 移动到 processing/（读写物理隔离）
      if (!DRY_RUN) {
        if (!safeMove(srcPath, procPath)) {
          totalSkipped++;
          continue; // 文件被占用，跳过
        }
      }

      const readPath = DRY_RUN ? srcPath : procPath;

      try {
        // Step 2: 安全检查
        const stat = statSync(readPath);
        if (stat.size > MAX_FILE_SIZE) {
          console.warn(`[REI] 跳过超大文件: ${filename} (${(stat.size / 1024).toFixed(0)}KB)`);
          if (!DRY_RUN) safeMove(procPath, join(archiveDir, filename));
          totalSkipped++;
          continue;
        }

        // Step 3: 读取 + 评估
        const content = readFileSync(readPath, 'utf-8');
        const parsed = parseQueueRecord(content);
        const evaluation = parsed?.type === 'task_event'
          ? { keep: true, reason: 'curated_memory_queue_record' }
          : evaluateValue(content, filename);

        if (evaluation.keep) {
          const targets = resolveMemoryTargets(parsed, filename);
          let sharedSuggested = false;
          let appendedAny = false;

          for (const targetRef of targets) {
            const compressed = parsed
              ? compressMemoryRecord(parsed, content, targetRef)
              : content;
            if (/共享建议[:：]\s*是/.test(compressed)) {
              sharedSuggested = true;
            }
            const appended = appendToMemory(targetRef, compressed, filename);
            appendedAny = appendedAny || appended;
          }

          if (sharedSuggested && !targets.includes('shared')) {
            const sharedCompressed = parsed
              ? compressMemoryRecord(parsed, content, 'shared')
              : content;
            const appended = appendToMemory('shared', sharedCompressed, filename);
            appendedAny = appendedAny || appended;
          }

          if (appendedAny) totalKept++;
          else totalDiscarded++;
        } else {
          totalDiscarded++;
        }

        // Step 4: 归档
        if (!DRY_RUN) safeMove(procPath, join(archiveDir, filename));

        totalProcessed++;
      } catch (e) {
        console.error(`[REI] 处理 ${filename} 失败: ${e.message}`);
        if (!DRY_RUN && existsSync(procPath)) {
          // Rei SOUL.md 损坏文件隔离协议：JSON解析/编码错误 → corrupted/，不反复重试
          const isCorrupted = e.message.includes('JSON') || e.message.includes('encoding') || 
                              e.message.includes('Unexpected token') || e.message.includes('Invalid');
          if (isCorrupted) {
            ensureDir(CORRUPTED_DIR);
            safeMove(procPath, join(CORRUPTED_DIR, filename));
            console.warn(`[REI] 损坏文件已隔离: ${filename} → corrupted/`);
          } else {
            // 瞬态错误（文件锁/磁盘I/O）→ 移回队列重试
            safeMove(procPath, srcPath);
          }
        }
      }
    }

    console.log(`[REI] 第 ${batchNumber} 批完成 | 累计: ${totalProcessed} 处理, ${totalKept} 保留, ${totalDiscarded} 丢弃, ${totalSkipped} 跳过`);
  }

  // 清理空的 processing/ 目录
  try {
    const remaining = readdirSync(PROCESSING_DIR);
    if (remaining.length === 0) {
      rmdirSync(PROCESSING_DIR);
    }
  } catch { /* 忽略 */ }

  // 审计日志
  try {
    await writeAuditLog(
      'system', null, 'rei', 'MEMORY_PURIFY',
      JSON.stringify({
        total_processed: totalProcessed,
        kept: totalKept,
        discarded: totalDiscarded,
        skipped: totalSkipped,
        batches: batchNumber
      })
    );
  } catch (e) {
    console.error(`[REI] 审计日志写入失败: ${e.message}`);
  }

  console.log(`[REI] 提纯完成 | 总计: ${totalProcessed} 处理, ${totalKept} 保留, ${totalDiscarded} 丢弃, ${totalSkipped} 跳过`);
  closeDb();
}

main();
