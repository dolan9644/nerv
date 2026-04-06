#!/usr/bin/env node
/**
 * ███ NERV · Harness Healthcheck ███
 *
 * 目标：
 * 1. 不是检查“有没有脚本”
 * 2. 而是检查“整条运行链路现在能不能闭环”
 *
 * 输出：JSON
 * 用法：
 *   node scripts/harness_healthcheck.js
 *   node scripts/harness_healthcheck.js --compact
 */

import Database from 'better-sqlite3';
import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { realpathSync } from 'fs';
import { join, resolve, extname } from 'path';
import { fileURLToPath } from 'url';
import {
  getInfraJobs,
  SCHEDULER_MANIFEST,
  shouldUseSystemScheduler
} from './nerv_system_scheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const NERV_ROOT = resolve(__dirname, '..');
const OPENCLAW_ROOT = resolve(NERV_ROOT, '..');
const NOW_MS = Date.now();
const COMPACT = process.argv.includes('--compact');

const CORE_CRON_JOBS = [
  'nerv-session-recorder',
  'nerv-spear-sync',
  'nerv-security-probe',
  'nerv-memory-purify',
  'nerv-adam-notifier'
];

const DB_CANDIDATES = [
  join(NERV_ROOT, 'data', 'db', 'nerv.db'),
  join(NERV_ROOT, 'data', 'nerv.db')
];

const issues = [];

function addIssue(severity, code, message, details = {}) {
  issues.push({ severity, code, message, details });
}

function severityRank(severity) {
  return { OK: 0, WARN: 1, CRITICAL: 2 }[severity] ?? 0;
}

function computeStatus(localIssues = []) {
  if (localIssues.some((issue) => issue.severity === 'CRITICAL')) return 'CRITICAL';
  if (localIssues.some((issue) => issue.severity === 'WARN')) return 'WARN';
  return 'OK';
}

function relTime(ms) {
  if (!ms) return null;
  const deltaSec = Math.max(0, Math.floor((NOW_MS - ms) / 1000));
  return {
    epoch_ms: ms,
    age_seconds: deltaSec
  };
}

function safeReadJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function safeStat(path) {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}

function countFiles(dir, depth = 1) {
  if (!existsSync(dir)) return 0;
  let total = 0;
  const walk = (current, remainingDepth) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (entry.isFile()) {
        total += 1;
      } else if (entry.isDirectory() && remainingDepth > 0) {
        walk(fullPath, remainingDepth - 1);
      }
    }
  };
  walk(dir, depth);
  return total;
}

function scanPathReferences(root) {
  const allowedExt = new Set(['.js', '.py', '.md', '.sh', '.json']);
  const counts = {
    legacy_path_refs: 0,
    canonical_path_refs: 0,
    legacy_ref_files: [],
    canonical_ref_files: []
  };

  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '__pycache__') continue;
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (fullPath === __filename) continue;
      if (fullPath.endsWith('/ensure_db_layout.py')) continue;
      if (fullPath.endsWith('/nerv_paths.py')) continue;
      if (!allowedExt.has(extname(entry.name))) continue;

      const content = readFileSync(fullPath, 'utf-8');
      if (content.includes('data/nerv.db')) {
        counts.legacy_path_refs += 1;
        counts.legacy_ref_files.push(fullPath);
      }
      if (content.includes('data/db/nerv.db')) {
        counts.canonical_path_refs += 1;
        counts.canonical_ref_files.push(fullPath);
      }
    }
  };

  walk(root);
  return counts;
}

function openDb(path) {
  if (!path || !existsSync(path)) return null;
  return new Database(path, { readonly: true });
}

function collectCronHealth() {
  const localIssues = [];
  const cronFile = join(OPENCLAW_ROOT, 'cron', 'jobs.json');
  const payload = safeReadJson(cronFile);
  if (!payload || !Array.isArray(payload.jobs)) {
    localIssues.push({
      severity: 'CRITICAL',
      code: 'CRON_CONFIG_MISSING',
      message: '无法读取 ~/.openclaw/cron/jobs.json 或 jobs 结构不合法'
    });
    return {
      status: computeStatus(localIssues),
      mode: shouldUseSystemScheduler() ? 'launchd' : 'openclaw-cron',
      cron_file: cronFile,
      jobs: [],
      issues: localIssues
    };
  }

  const jobs = payload.jobs.filter((job) => typeof job.id === 'string' && job.id.startsWith('nerv-'));

  if (shouldUseSystemScheduler()) {
    const infraJobs = getInfraJobs();
    const manifest = safeReadJson(SCHEDULER_MANIFEST);
    const summary = infraJobs.map((job) => {
      const state = safeReadJson(job.state_file) || {};
      const legacyCron = jobs.find((entry) => entry.id === job.id);
      if (!existsSync(job.launchd_plist_path)) {
        localIssues.push({
          severity: 'CRITICAL',
          code: 'SYSTEM_JOB_MISSING',
          message: `缺少系统级维护任务: ${job.id}`,
          details: { job_id: job.id, plist_path: job.launchd_plist_path }
        });
      }
      if (legacyCron) {
        localIssues.push({
          severity: 'WARN',
          code: 'LEGACY_OPENCLAW_CRON_PRESENT',
          message: `系统调度已启用，但 jobs.json 里仍残留旧的 OpenClaw Cron: ${job.id}`,
          details: { job_id: job.id }
        });
      }
      if (!existsSync(job.state_file)) {
        localIssues.push({
          severity: 'WARN',
          code: 'SYSTEM_JOB_STATE_MISSING',
          message: `系统级维护任务尚未写出运行状态: ${job.id}`,
          details: { job_id: job.id, state_file: job.state_file }
        });
      }
      if ((state.last_status || state.status) === 'error') {
        localIssues.push({
          severity: job.id === 'nerv-adam-notifier' ? 'CRITICAL' : 'WARN',
          code: 'SYSTEM_JOB_ERROR',
          message: `系统级维护任务最近一次运行异常: ${job.id}`,
          details: {
            job_id: job.id,
            stderr_excerpt: state.stderr_excerpt || null
          }
        });
      }
      return {
        id: job.id,
        scheduler: 'launchd',
        launchd_label: job.launchd_label,
        installed: existsSync(job.launchd_plist_path),
        status: state.status || 'idle',
        last_status: state.last_status || null,
        last_run: relTime(state.last_run_at_ms ?? null),
        next_run: relTime(state.next_run_at_ms ?? null),
        last_duration_ms: state.duration_ms ?? null,
        summary: state.summary ?? null
      };
    });

    if (!manifest) {
      localIssues.push({
        severity: 'WARN',
        code: 'SYSTEM_SCHEDULER_MANIFEST_MISSING',
        message: '系统级调度清单不存在，说明安装链尚未完整落地',
        details: { manifest: SCHEDULER_MANIFEST }
      });
    }

    return {
      status: computeStatus(localIssues),
      mode: 'launchd',
      cron_file: cronFile,
      manifest: SCHEDULER_MANIFEST,
      jobs: summary,
      issues: localIssues
    };
  }

  const core = CORE_CRON_JOBS.map((id) => jobs.find((job) => job.id === id)).filter(Boolean);

  for (const id of CORE_CRON_JOBS) {
    if (!jobs.find((job) => job.id === id)) {
      localIssues.push({
        severity: 'CRITICAL',
        code: 'CRON_JOB_MISSING',
        message: `缺少核心 Cron Job: ${id}`,
        details: { job_id: id }
      });
    }
  }

  if (core.length > 0 && core.every((job) => job.payload?.kind === 'agentTurn')) {
    localIssues.push({
      severity: 'WARN',
      code: 'INFRA_CRON_VIA_AGENTTURN',
      message: '所有基础设施 Cron 仍经由 agentTurn 触发，基础设施层仍受 LLM 意志影响'
    });
  }

  const summarizedJobs = jobs.map((job) => {
    const summary = {
      id: job.id,
      agent_id: job.agentId,
      enabled: job.enabled === true,
      payload_kind: job.payload?.kind ?? null,
      last_run_status: job.state?.lastRunStatus ?? null,
      consecutive_errors: job.state?.consecutiveErrors ?? 0,
      last_run: relTime(job.state?.lastRunAtMs ?? null),
      next_run: relTime(job.state?.nextRunAtMs ?? null),
      last_duration_ms: job.state?.lastDurationMs ?? null
    };

    if (job.enabled !== true) {
      localIssues.push({
        severity: 'CRITICAL',
        code: 'CRON_JOB_DISABLED',
        message: `核心或 NERV Cron 被禁用: ${job.id}`,
        details: { job_id: job.id }
      });
    }
    if ((job.state?.lastRunStatus ?? '') === 'error' || (job.state?.consecutiveErrors ?? 0) > 0) {
      localIssues.push({
        severity: job.id === 'nerv-adam-notifier' ? 'CRITICAL' : 'WARN',
        code: 'CRON_JOB_ERROR',
        message: `Cron 最近一次运行异常: ${job.id}`,
        details: {
          job_id: job.id,
          last_error: job.state?.lastError ?? null,
          consecutive_errors: job.state?.consecutiveErrors ?? 0
        }
      });
    }

    return summary;
  });

  return {
    status: computeStatus(localIssues),
    mode: 'openclaw-cron',
    cron_file: cronFile,
    jobs: summarizedJobs,
    issues: localIssues
  };
}

function collectConfigHealth() {
  const localIssues = [];
  const configFile = join(OPENCLAW_ROOT, 'openclaw.json');
  const raw = existsSync(configFile) ? readFileSync(configFile, 'utf-8') : null;
  const config = raw ? JSON.parse(raw) : null;

  if (!config) {
    localIssues.push({
      severity: 'CRITICAL',
      code: 'OPENCLAW_CONFIG_MISSING',
      message: '无法读取 ~/.openclaw/openclaw.json'
    });
    return {
      status: computeStatus(localIssues),
      config_file: configFile,
      issues: localIssues
    };
  }

  const agents = Array.isArray(config.agents?.list) ? config.agents.list : [];
  const bindings = Array.isArray(config.bindings) ? config.bindings : [];
  const nervAgents = agents.filter((agent) => typeof agent.id === 'string' && agent.id.startsWith('nerv-'));
  const agentMap = Object.fromEntries(nervAgents.map((agent) => [agent.id, agent]));

  const requiredAgents = ['nerv-misato', 'nerv-seele', 'nerv-gendo', 'nerv-rei', 'nerv-eva03', 'nerv-eva13'];
  for (const id of requiredAgents) {
    if (!agentMap[id]) {
      localIssues.push({
        severity: 'CRITICAL',
        code: 'AGENT_MISSING',
        message: `运行时配置中缺少关键 Agent: ${id}`
      });
    }
  }

  if (!raw.includes('NERV_DB_PATH')) {
    localIssues.push({
      severity: 'WARN',
      code: 'NERV_ENV_NOT_INJECTED',
      message: '运行时 openclaw.json 未发现 NERV_DB_PATH / NERV_ROOT 等环境注入痕迹，脚本仍依赖路径猜测和 fallback'
    });
  }

  const seele = agentMap['nerv-seele'];
  if (!shouldUseSystemScheduler() && seele && Array.isArray(seele.tools?.deny) && seele.tools.deny.includes('write')) {
    const cronJobs = safeReadJson(join(OPENCLAW_ROOT, 'cron', 'jobs.json'))?.jobs ?? [];
    const probeJob = cronJobs.find((job) => job.id === 'nerv-security-probe');
    if (probeJob?.payload?.message?.includes('write')) {
      localIssues.push({
        severity: 'CRITICAL',
        code: 'PERMISSION_PROMPT_CONFLICT',
        message: 'nerv-security-probe 的 Cron prompt 要求 SEELE 使用 write，但运行时配置显式 deny write',
        details: { job_id: probeJob.id, agent_id: 'nerv-seele' }
      });
    }
  }

  const feishuBindings = bindings.filter(
    (binding) => binding.match?.channel === 'feishu' && typeof binding.agentId === 'string' && binding.agentId.startsWith('nerv-')
  );
  const feishuAccounts = config.channels?.feishu?.accounts
    ? Object.keys(config.channels.feishu.accounts).filter((accountId) => accountId.startsWith('nerv-'))
    : [];

  if (!feishuBindings.find((binding) => binding.agentId === 'nerv-misato')) {
    localIssues.push({
      severity: 'WARN',
      code: 'FEISHU_BINDING_MISSING',
      message: 'nerv-misato 未绑定到 OpenClaw Feishu route'
    });
  }
  if (!feishuAccounts.includes('nerv-misato') || !feishuAccounts.includes('nerv-gendo')) {
    localIssues.push({
      severity: 'WARN',
      code: 'FEISHU_ACCOUNT_MISSING',
      message: 'Feishu account 配置未完整覆盖 nerv-misato / nerv-gendo'
    });
  }

  return {
    status: computeStatus(localIssues),
    config_file: configFile,
    nerv_agents: nervAgents.map((agent) => ({
      id: agent.id,
      heartbeat: agent.heartbeat ?? null,
      tools: agent.tools ?? null
    })),
    feishu: {
      enabled: config.channels?.feishu?.enabled === true,
      connection_mode: config.channels?.feishu?.connectionMode ?? null,
      webhook_path: config.channels?.feishu?.webhookPath ?? null,
      bindings: feishuBindings,
      accounts: feishuAccounts
    },
    issues: localIssues
  };
}

function collectDatabaseHealth() {
  const localIssues = [];
  const existingPaths = DB_CANDIDATES.filter((path) => existsSync(path));
  const uniqueTargets = new Set(existingPaths.map((candidate) => {
    try {
      return realpathSync(candidate);
    } catch {
      return candidate;
    }
  }));
  const activeDbPath = existsSync(DB_CANDIDATES[0]) ? DB_CANDIDATES[0] : existingPaths[0] ?? DB_CANDIDATES[0];
  const refCounts = scanPathReferences(join(NERV_ROOT, 'scripts'));
  const agentRefCounts = scanPathReferences(join(NERV_ROOT, 'agents'));

  const combinedRefCounts = {
    legacy_path_refs: refCounts.legacy_path_refs + agentRefCounts.legacy_path_refs,
    canonical_path_refs: refCounts.canonical_path_refs + agentRefCounts.canonical_path_refs,
    legacy_ref_files: [...refCounts.legacy_ref_files, ...agentRefCounts.legacy_ref_files],
    canonical_ref_files: [...refCounts.canonical_ref_files, ...agentRefCounts.canonical_ref_files]
  };

  if (existingPaths.length > 1 && uniqueTargets.size > 1) {
    localIssues.push({
      severity: 'CRITICAL',
      code: 'DUAL_DB_PATHS',
      message: '同时存在 data/nerv.db 和 data/db/nerv.db，当前实例存在双数据库漂移风险',
      details: { existing_paths: existingPaths }
    });
  }

  if (combinedRefCounts.legacy_path_refs > 0) {
    localIssues.push({
      severity: 'WARN',
      code: 'LEGACY_DB_REFERENCES',
      message: '代码或文档中仍存在旧路径 data/nerv.db 引用',
      details: {
        legacy_path_refs: combinedRefCounts.legacy_path_refs,
        examples: combinedRefCounts.legacy_ref_files.slice(0, 10)
      }
    });
  }

  const db = openDb(activeDbPath);
  let dbSummary = null;
  if (!db) {
    localIssues.push({
      severity: 'CRITICAL',
      code: 'DB_MISSING',
      message: '未找到可读取的 nerv.db'
    });
  } else {
    const taskRows = db.prepare('SELECT status, COUNT(*) AS count FROM tasks GROUP BY status').all();
    const nodeRows = db.prepare('SELECT status, COUNT(*) AS count FROM dag_nodes GROUP BY status').all();
    const pendingApprovals = db.prepare('SELECT COUNT(*) AS count FROM pending_approvals').get().count;
    const skillRegistry = db.prepare('SELECT COUNT(*) AS count FROM skill_registry').get().count;
    const skillRegistryColumns = db.prepare(`PRAGMA table_info(skill_registry)`).all();
    const skillColumnNames = new Set(skillRegistryColumns.map((row) => row.name));
    const tasksWithoutDagJson = db.prepare("SELECT COUNT(*) AS count FROM tasks WHERE dag_json IS NULL OR dag_json = ''").get().count;
    const staleTasks = db.prepare(`
      SELECT task_id, status, updated_at
      FROM tasks
      WHERE status != 'DONE'
      ORDER BY updated_at DESC
      LIMIT 20
    `).all();
    const blockedNodes = db.prepare(`
      SELECT node_id, task_id, agent_id, status, updated_at
      FROM dag_nodes
      WHERE status IN ('PENDING', 'RUNNING', 'CIRCUIT_BROKEN')
      ORDER BY updated_at DESC
      LIMIT 20
    `).all();
    const agentRows = db.prepare(`
      SELECT agent_id, status, current_task_id, last_heartbeat
      FROM agents
      WHERE agent_id LIKE 'nerv-%'
      ORDER BY agent_id
    `).all();
    const activeAgentRows = agentRows.filter((row) => row.status !== 'IDLE' || row.current_task_id != null);
    const agentsWithoutHeartbeat = activeAgentRows.filter((row) => row.last_heartbeat == null);
    const agentsRunningWithoutTask = agentRows.filter((row) => row.status === 'RUNNING' && !row.current_task_id);
    const blockedNodeAgentsWithoutHeartbeat = blockedNodes.filter((node) => {
      const agent = agentRows.find((row) => row.agent_id === node.agent_id);
      return !agent || agent.last_heartbeat == null;
    });
    const skillSources = skillColumnNames.has('load_source')
      ? Object.fromEntries(
          db.prepare(`
            SELECT load_source, COUNT(*) AS count
            FROM skill_registry
            GROUP BY load_source
            ORDER BY load_source
          `).all().map((row) => [row.load_source || 'unknown', row.count])
        )
      : null;

    if (tasksWithoutDagJson > 0) {
      localIssues.push({
        severity: 'WARN',
        code: 'TASKS_WITHOUT_DAG_JSON',
        message: '存在缺少 dag_json 的任务，说明一部分任务状态来自补录而非实时结构化建图',
        details: { count: tasksWithoutDagJson }
      });
    }

    if (agentsWithoutHeartbeat.length > 0) {
      localIssues.push({
        severity: 'WARN',
        code: 'AGENTS_WITHOUT_HEARTBEAT',
        message: '存在 active NERV Agent 未写入 last_heartbeat，运行态无法可靠判定',
        details: {
          count: agentsWithoutHeartbeat.length,
          examples: agentsWithoutHeartbeat.slice(0, 10).map((row) => row.agent_id)
        }
      });
    }

    if (blockedNodeAgentsWithoutHeartbeat.length > 0) {
      localIssues.push({
        severity: 'WARN',
        code: 'BLOCKED_NODE_AGENT_RUNTIME_MISSING',
        message: '存在 RUNNING/PENDING 节点，但对应 Agent 的运行态仍缺少 heartbeat',
        details: {
          count: blockedNodeAgentsWithoutHeartbeat.length,
          examples: blockedNodeAgentsWithoutHeartbeat.slice(0, 10).map((row) => ({
            node_id: row.node_id,
            task_id: row.task_id,
            agent_id: row.agent_id,
            status: row.status
          }))
        }
      });
    }

    if (agentsRunningWithoutTask.length > 0) {
      localIssues.push({
        severity: 'WARN',
        code: 'RUNNING_AGENT_WITHOUT_TASK',
        message: '存在 status=RUNNING 但 current_task_id 为空的 Agent，运行态与任务态不一致',
        details: {
          count: agentsRunningWithoutTask.length,
          examples: agentsRunningWithoutTask.slice(0, 10).map((row) => row.agent_id)
        }
      });
    }

    dbSummary = {
      active_db_path: activeDbPath,
      tables: {
        tasks: Object.fromEntries(taskRows.map((row) => [row.status, row.count])),
        dag_nodes: Object.fromEntries(nodeRows.map((row) => [row.status, row.count])),
        pending_approvals: pendingApprovals,
        skill_registry: skillRegistry,
        agents: agentRows.length
      },
      skill_registry_meta: {
        columns: Array.from(skillColumnNames),
        has_load_source: skillColumnNames.has('load_source'),
        has_source_priority: skillColumnNames.has('source_priority'),
        has_gating_status: skillColumnNames.has('gating_status')
      },
      skill_registry_sources: skillSources,
      agents: agentRows,
      stale_tasks: staleTasks,
      blocked_nodes: blockedNodes
    };
    db.close();
  }

  return {
    status: computeStatus(localIssues),
    existing_db_paths: existingPaths,
    references: combinedRefCounts,
    summary: dbSummary,
    issues: localIssues
  };
}

function collectRecorderAndMemoryHealth() {
  const localIssues = [];
  const stateFile = join(__dirname, '.recorder_state.json');
  const lockFile = join(__dirname, '.session_recorder.lock');
  const queueDir = join(NERV_ROOT, 'memory_queue');
  const processingDir = join(queueDir, 'processing');
  const archivedDir = join(queueDir, 'archived');
  const corruptedDir = join(queueDir, 'corrupted');

  const state = safeReadJson(stateFile) ?? {};
  const lockStat = safeStat(lockFile);
  const queueFileCount = existsSync(queueDir)
    ? readdirSync(queueDir, { withFileTypes: true }).filter((entry) => entry.isFile()).length
    : 0;
  const processingCount = countFiles(processingDir, 1);
  const archivedCount = countFiles(archivedDir, 2);
  const corruptedCount = countFiles(corruptedDir, 1);

  if (!existsSync(stateFile)) {
    localIssues.push({
      severity: 'WARN',
      code: 'RECORDER_STATE_MISSING',
      message: 'session_recorder 的 state 文件不存在，无法判断增量扫描边界'
    });
  }

  if (queueFileCount > 50) {
    localIssues.push({
      severity: 'WARN',
      code: 'MEMORY_QUEUE_BACKLOG',
      message: 'memory_queue 顶层待提纯文件堆积过多',
      details: { queue_file_count: queueFileCount }
    });
  }

  return {
    status: computeStatus(localIssues),
    recorder: {
      state_file: stateFile,
      tracked_session_files: Object.keys(state).length,
      lock_file: lockFile,
      lock_file_mtime: lockStat ? relTime(lockStat.mtimeMs) : null
    },
    memory_queue: {
      queue_dir: queueDir,
      queued_files: queueFileCount,
      processing_files: processingCount,
      archived_files: archivedCount,
      corrupted_files: corruptedCount
    },
    issues: localIssues
  };
}

function collectSkillHealth(databaseSummary) {
  const localIssues = [];
  const scannerPath = join(__dirname, 'skill_scanner.js');
  const content = readFileSync(scannerPath, 'utf-8');
  const hasMultiSourceDiscovery =
    content.includes('BUNDLED_SKILLS_DIR') &&
    content.includes('WORKSPACE_SKILLS_DIR') &&
    content.includes('skills?.load?.extraDirs') &&
    content.includes('openclaw.plugin.json');
  const registryMeta = databaseSummary?.summary?.skill_registry_meta ?? {};
  const sourceBreakdown = databaseSummary?.summary?.skill_registry_sources ?? null;

  if (!hasMultiSourceDiscovery) {
    localIssues.push({
      severity: 'WARN',
      code: 'SKILL_SCANNER_SINGLE_SOURCE',
      message: 'skill_scanner 仍未完整覆盖 bundled / plugin / managed / workspace / extraDirs 多来源发现'
    });
  }

  if (!registryMeta.has_load_source || !registryMeta.has_source_priority || !registryMeta.has_gating_status) {
    localIssues.push({
      severity: 'WARN',
      code: 'SKILL_REGISTRY_METADATA_MISSING',
      message: 'skill_registry 尚未具备 load_source / source_priority / gating_status 等运行时来源字段'
    });
  }

  if (sourceBreakdown && Object.keys(sourceBreakdown).length <= 1 && (databaseSummary?.summary?.tables?.skill_registry ?? 0) > 0) {
    localIssues.push({
      severity: 'WARN',
      code: 'SKILL_REGISTRY_SINGLE_SOURCE_VIEW',
      message: 'skill_registry 当前只有单一 load_source，说明 scanner 尚未形成接近真实运行时的来源视图',
      details: { sources: sourceBreakdown }
    });
  }

  return {
    status: computeStatus(localIssues),
    skill_registry_count: databaseSummary?.summary?.tables?.skill_registry ?? null,
    skill_registry_sources: sourceBreakdown,
    scanner_path: scannerPath,
    issues: localIssues
  };
}

function collectFeishuHealth(configHealth) {
  const localIssues = [];
  let processSnapshot = {
    ps_available: true,
    openclaw_gateway_running: null,
    custom_feishu_gateway_running: null
  };

  try {
    const processList = execSync('ps ax -o pid=,command= 2>/dev/null', { encoding: 'utf-8' });
    processSnapshot.openclaw_gateway_running = processList.includes('openclaw-gateway');
    processSnapshot.custom_feishu_gateway_running = processList.includes('feishu_gateway.py');
  } catch (error) {
    processSnapshot = {
      ps_available: false,
      openclaw_gateway_running: null,
      custom_feishu_gateway_running: null,
      error: error.message
    };
  }

  if (configHealth.feishu.enabled !== true) {
    localIssues.push({
      severity: 'CRITICAL',
      code: 'FEISHU_DISABLED',
      message: 'OpenClaw Feishu channel 未启用'
    });
  }

  if (processSnapshot.ps_available &&
      processSnapshot.openclaw_gateway_running &&
      processSnapshot.custom_feishu_gateway_running) {
    localIssues.push({
      severity: 'WARN',
      code: 'DUAL_FEISHU_INGRESS',
      message: '同时检测到 OpenClaw Feishu 路由和自建 feishu_gateway.py 进程，存在双入口歧义风险'
    });
  }

  return {
    status: computeStatus(localIssues),
    routing: configHealth.feishu,
    process_snapshot: processSnapshot,
    issues: localIssues
  };
}

function collectContractReadiness() {
  const localIssues = [];
  const createDagTaskPath = join(__dirname, 'tools', 'create_dag_task.js');
  const dbPath = join(__dirname, 'db.js');
  const createDagTask = readFileSync(createDagTaskPath, 'utf-8');
  const dbScript = readFileSync(dbPath, 'utf-8');

  const supportsExtraNodeFields = !createDagTask.includes('additionalProperties: false');
  const storesDagJson = dbScript.includes('const dagJson = JSON.stringify({ nodes, edges })');

  if (!supportsExtraNodeFields || !storesDagJson) {
    localIssues.push({
      severity: 'CRITICAL',
      code: 'CONTRACT_EMBED_NOT_READY',
      message: '当前 create_dag_task/db.js 不足以安全承载 nodes[].contract'
    });
  }

  return {
    status: computeStatus(localIssues),
    schema_path: join(NERV_ROOT, 'schemas', 'node-contract-v1.schema.json'),
    doc_path: join(NERV_ROOT, 'docs', 'node-contract-v1.md'),
    embed_points: {
      create_dag_task: createDagTaskPath,
      db_script: dbPath,
      supports_extra_node_fields: supportsExtraNodeFields,
      stores_dag_json: storesDagJson
    },
    issues: localIssues
  };
}

function main() {
  const cron = collectCronHealth();
  const config = collectConfigHealth();
  const database = collectDatabaseHealth();
  const recorder = collectRecorderAndMemoryHealth();
  const skills = collectSkillHealth(database);
  const feishu = collectFeishuHealth(config);
  const contract = collectContractReadiness();

  const allIssues = [
    ...cron.issues,
    ...config.issues,
    ...database.issues,
    ...recorder.issues,
    ...skills.issues,
    ...feishu.issues,
    ...contract.issues
  ];
  for (const issue of allIssues) issues.push(issue);

  const overallStatus = issues.length === 0
    ? 'OK'
    : issues.reduce((current, issue) => severityRank(issue.severity) > severityRank(current) ? issue.severity : current, 'OK');

  const report = {
    generated_at: new Date().toISOString(),
    overall_status: overallStatus,
    summary: {
      critical: issues.filter((issue) => issue.severity === 'CRITICAL').length,
      warn: issues.filter((issue) => issue.severity === 'WARN').length,
      ok_checks: [cron, config, database, recorder, skills, feishu, contract].filter((check) => check.status === 'OK').length
    },
    checks: {
      cron,
      config,
      database,
      recorder,
      skills,
      feishu,
      contract
    },
    issues
  };

  console.log(JSON.stringify(report, null, COMPACT ? 0 : 2));
}

main();
