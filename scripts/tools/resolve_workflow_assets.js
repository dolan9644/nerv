#!/usr/bin/env node
/**
 * NERV 固定 workflow 资产解析器。
 *
 * 目标：
 * 1. 让 Gendo / Misato 先查可调用资产，而不是靠 SOUL 记忆固定 workflow
 * 2. 支持通过 workflow_id 或中文需求查询匹配
 *
 * 用法：
 *   node scripts/tools/resolve_workflow_assets.js --workflow live-session-script
 *   node scripts/tools/resolve_workflow_assets.js --query "复盘昨天那场直播"
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const NERV_ROOT = resolve(__dirname, '..', '..');
const REGISTRY_PATH = resolve(NERV_ROOT, 'docs', 'workflow-navigation-registry-v1.json');

function readRegistry() {
  if (!existsSync(REGISTRY_PATH)) {
    throw new Error(`缺少 workflow 导航注册表: ${REGISTRY_PATH}`);
  }
  const payload = JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'));
  if (!Array.isArray(payload?.workflows)) {
    throw new Error('workflow 导航注册表结构不合法：workflows 必须是数组');
  }
  return payload;
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .trim();
}

function toAbsolutePath(relativePath) {
  if (!relativePath) return null;
  return resolve(NERV_ROOT, relativePath);
}

function enrichWorkflow(entry) {
  return {
    ...entry,
    template_path: toAbsolutePath(entry.template_path),
    spec_path: toAbsolutePath(entry.spec_path),
    misato_skill_path: toAbsolutePath(entry.misato_skill_path),
    quality_gate_script: toAbsolutePath(entry.quality_gate_script),
    builder_script: toAbsolutePath(entry.builder_script)
  };
}

function scoreWorkflow(entry, query) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return 0;

  let score = 0;
  const fields = [
    entry.workflow_id,
    entry.cn_name,
    entry.domain,
    entry.subdomain || '',
    ...(Array.isArray(entry.trigger_phrases) ? entry.trigger_phrases : [])
  ].map(normalizeText);

  for (const field of fields) {
    if (!field) continue;
    if (field === normalizedQuery) score = Math.max(score, 100);
    else if (normalizedQuery.includes(field)) score = Math.max(score, 90);
    else if (field.includes(normalizedQuery)) score = Math.max(score, 75);
  }

  return score;
}

function parseArgs(argv) {
  const args = { workflow: null, query: null };
  for (let i = 2; i < argv.length; i += 1) {
    const current = argv[i];
    if (current === '--workflow') args.workflow = argv[i + 1] || null;
    if (current === '--query') args.query = argv[i + 1] || null;
  }
  return args;
}

function main() {
  const { workflow, query } = parseArgs(process.argv);
  if (!workflow && !query) {
    console.error(JSON.stringify({
      success: false,
      error: '必须传入 --workflow <id> 或 --query <中文需求>'
    }));
    process.exit(1);
  }

  const registry = readRegistry();
  const workflows = registry.workflows.map(enrichWorkflow);

  if (workflow) {
    const match = workflows.find((item) => item.workflow_id === workflow);
    if (!match) {
      console.log(JSON.stringify({
        success: false,
        mode: 'workflow',
        error: `未找到 workflow_id: ${workflow}`
      }));
      return;
    }
    console.log(JSON.stringify({
      success: true,
      mode: 'workflow',
      matched: match
    }, null, 2));
    return;
  }

  const candidates = workflows
    .map((item) => ({ ...item, score: scoreWorkflow(item, query) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (candidates.length === 0) {
    console.log(JSON.stringify({
      success: false,
      mode: 'query',
      error: '未命中固定 workflow，应进入补问或一次性 DAG 草案路径'
    }, null, 2));
    return;
  }

  console.log(JSON.stringify({
    success: true,
    mode: 'query',
    matched: candidates[0],
    candidates: candidates.slice(0, 5)
  }, null, 2));
}

main();
