#!/usr/bin/env node
/**
 * ███ NERV 专属工具 · update_dag_status (Harness Refactored) ███
 *
 * misato / ritsuko / shinji 共用。更新 DAG 节点状态。
 * 强制文件读取规避 Bash 逃逸，修复了 Task 状态判定的真值 Bug。
 *
 * 用法：node scripts/tools/update_dag_status.js sandbox_io/status_xxx.json
 */

import fs from 'fs';
import {
  updateNodeStatus, incrementRetry, getReadyDownstream,
  isTaskComplete, updateTaskStatus, blockDownstream,
  writeAuditLog, closeDb, withRetry
} from '../db.js';

const ALLOWED_STATUSES = new Set(['RUNNING', 'DONE', 'FAILED', 'CIRCUIT_BROKEN']);

function validateInput(input) {
  const errors = [];
  if (typeof input !== 'object' || input === null) {
    throw new Error('【参数错误】输入必须是 JSON Object。');
  }
  if (typeof input.node_id !== 'string' || input.node_id.length < 4) {
    errors.push('node_id 必须是长度 >= 4 的字符串');
  }
  if (typeof input.status !== 'string' || !ALLOWED_STATUSES.has(input.status)) {
    errors.push(`status 不合法。允许: ${[...ALLOWED_STATUSES].join(', ')}`);
  }
  if (typeof input.agent_id !== 'string' || input.agent_id.length === 0) {
    errors.push('agent_id 必须是非空字符串');
  }
  if (input.result_path !== undefined && input.result_path !== null && typeof input.result_path !== 'string') {
    errors.push('result_path 必须是字符串');
  }
  if (input.error_log !== undefined && input.error_log !== null && typeof input.error_log !== 'string') {
    errors.push('error_log 必须是字符串');
  }
  if (errors.length > 0) {
    throw new Error(`【参数校验失败】\n` + errors.map((e, i) => `  ${i + 1}. ${e}`).join('\n'));
  }
}

async function main() {
  const inputFile = process.argv[2];
  if (!inputFile || !fs.existsSync(inputFile)) {
    console.error(JSON.stringify({ success: false, error: '必须传入有效的 JSON 文件路径。用法: node scripts/tools/update_dag_status.js sandbox_io/status_xxx.json' }));
    process.exit(1);
  }

  let input;
  try {
    const raw = fs.readFileSync(inputFile, 'utf-8');
    input = JSON.parse(raw);
  } catch (e) {
    console.error(JSON.stringify({ success: false, error: `【JSON 解析失败】${e.message}` }));
    process.exit(1);
  }

  try {
    validateInput(input);
  } catch (e) {
    console.error(JSON.stringify({ success: false, error: e.message }));
    process.exit(1);
  }

  try {
    const node = await withRetry((db) => {
      return db.prepare('SELECT task_id FROM dag_nodes WHERE node_id = ?').get(input.node_id);
    });

    if (!node) throw new Error(`node_id "${input.node_id}" 不存在`);
    const taskId = node.task_id;

    // 更新节点状态
    await updateNodeStatus(input.node_id, input.status, input.result_path || null, input.error_log || null);

    // 审计日志
    await writeAuditLog(taskId, input.node_id, input.agent_id, `NODE_${input.status}`,
      JSON.stringify({ result_path: input.result_path, error_log: input.error_log }).slice(0, 500)
    );

    const result = {
      success: true,
      node_id: input.node_id,
      task_id: taskId,
      new_status: input.status,
      downstream_ready: [],
      task_complete: false,
      task_status: 'RUNNING',
      blocked_downstream: 0
    };

    // 状态联动逻辑
    if (input.status === 'DONE') {
      result.downstream_ready = await getReadyDownstream(input.node_id, taskId);
    } else if (input.status === 'FAILED') {
      const retryResult = await incrementRetry(input.node_id);
      result.retry_allowed = retryResult.allowed;
      result.retry_count = retryResult.retryCount;
      if (!retryResult.allowed) {
        result.blocked_downstream = await blockDownstream(input.node_id, taskId);
        result.new_status = 'CIRCUIT_BROKEN';
        await updateNodeStatus(input.node_id, 'CIRCUIT_BROKEN');
      }
    }

    // 核心修复：正确解构 isTaskComplete 返回的对象
    // isTaskComplete 返回 { complete: boolean, hasFailed: boolean, total, done, failed }
    // 对象在 JS 中永远 truthy，必须读取 .complete 属性
    const taskStats = await isTaskComplete(taskId);
    result.task_complete = taskStats.complete;
    if (taskStats.complete) {
      // 如果有节点 FAILED，Task 状态应为 FAILED 而非 DONE
      result.task_status = taskStats.hasFailed ? 'FAILED' : 'DONE';
      await updateTaskStatus(taskId, result.task_status);
    }

    console.log(JSON.stringify(result, null, 2));

    // 清理已处理的状态文件，防止 sandbox_io 僵尸堆积
    try { fs.unlinkSync(inputFile); } catch { /* 静默：文件可能已被其他进程删除 */ }

  } catch (e) {
    console.error(JSON.stringify({ success: false, error: `【状态更新失败】${e.message}` }));
    process.exit(1);
  } finally {
    closeDb();
  }
}

main();
