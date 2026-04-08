#!/usr/bin/env node
/**
 * NERV 通用返工上下文解析器。
 *
 * 目标：
 * 1. 把“这版不行/需要修复/需要加厚/要重做但沿用现有链”收成结构化返工语义
 * 2. 让 Gendo 输出修复型 DAG 草案，而不是把返工误判成全新 workflow
 * 3. 让 Misato 明确：这是 repair，不是 new；优先关联哪个旧 task / 会话
 *
 * 用法：
 *   node scripts/tools/resolve_rework_context.js --task daily-morning-brief-20260408 --feedback "今天这版太薄了"
 */

import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { closeDb, getDb, getTask } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const NERV_ROOT = resolve(__dirname, '..', '..');
const REGISTRY_PATH = resolve(NERV_ROOT, 'docs', 'workflow-navigation-registry-v1.json');

function parseArgs(argv) {
  const args = { taskId: null, feedback: null };
  for (let i = 2; i < argv.length; i += 1) {
    const current = argv[i];
    if (current === '--task') args.taskId = argv[i + 1] || null;
    if (current === '--feedback') args.feedback = argv[i + 1] || null;
  }
  return args;
}

function inferRepairIntent(feedback = '') {
  const text = String(feedback || '').trim();
  if (!text) return '保持现有链路，针对不达标部分做修复';
  return text;
}

function backfillWorkflowMeta(taskId, task) {
  const db = getDb();
  const row = db.prepare(`
    SELECT detail
    FROM audit_logs
    WHERE task_id = ? AND action = 'DAG_CREATED'
    ORDER BY id DESC
    LIMIT 1
  `).get(taskId);
  if (!row?.detail) return task;
  try {
    const detail = JSON.parse(row.detail);
    return {
      ...task,
      workflow_id: task.workflow_id || detail.workflow_id || null,
      workflow_cn_name: task.workflow_cn_name || detail.workflow_cn_name || null,
      entry_mode: task.entry_mode || detail.entry_mode || null,
      resolved_from: task.resolved_from || detail.resolved_from || null
    };
  } catch {
    return task;
  }
}

function inferFromRegistry(taskId, task) {
  if (!taskId || task.workflow_id || !existsSync(REGISTRY_PATH)) return task;
  try {
    const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'));
    const workflows = Array.isArray(registry?.workflows) ? registry.workflows : [];
    const match = workflows.find((item) => {
      const workflowId = String(item.workflow_id || '').trim();
      return workflowId && taskId.startsWith(`${workflowId}-`);
    });
    if (!match) return task;
    return {
      ...task,
      workflow_id: match.workflow_id || null,
      workflow_cn_name: match.cn_name || null,
      entry_mode: match.entry_mode || null
    };
  } catch {
    return task;
  }
}

async function main() {
  const { taskId, feedback } = parseArgs(process.argv);
  if (!taskId) {
    console.error(JSON.stringify({
      success: false,
      error: '必须传入 --task <task_id>'
    }));
    process.exit(1);
  }

  try {
    const task = await getTask(taskId);
    if (!task) {
      console.error(JSON.stringify({
        success: false,
        error: `task_id 不存在: ${taskId}`
      }));
      process.exit(1);
    }

    const hydratedTask = inferFromRegistry(taskId, backfillWorkflowMeta(taskId, task));
    const orchestratorSessionKey = hydratedTask.orchestrator_session_key || null;
    console.log(JSON.stringify({
      success: true,
      repair_mode: 'repair',
      repair_of_task_id: hydratedTask.task_id,
      target_session_key: orchestratorSessionKey,
      intent: inferRepairIntent(feedback),
      workflow_id: hydratedTask.workflow_id || null,
      workflow_cn_name: hydratedTask.workflow_cn_name || null,
      entry_mode: hydratedTask.entry_mode || null,
      resolved_from: 'repair_request',
      orchestrator_agent_id: hydratedTask.orchestrator_agent_id || 'nerv-misato',
      task_status: hydratedTask.status,
      suggestion: {
        keep_existing_workflow: Boolean(hydratedTask.workflow_id),
        keep_existing_entry_mode: Boolean(hydratedTask.entry_mode),
        prefer_same_orchestrator_session: Boolean(orchestratorSessionKey),
        next_action: hydratedTask.workflow_id
          ? '基于现有 workflow 生成修复型 DAG 草案'
          : '未命中固定 workflow，请基于旧 task 生成最小修复 DAG'
      }
    }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      error: error.message
    }));
    process.exit(1);
  } finally {
    closeDb();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    success: false,
    error: error.message
  }));
  process.exit(1);
});
