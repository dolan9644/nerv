#!/usr/bin/env node
/**
 * NERV create_dag_task 的配套工具。
 * 从 DB 真相源读取指定 task 的 ready 节点和强制 session_key。
 *
 * 用法：
 *   node scripts/tools/get_ready_dispatches.js <task_id>
 */

import { closeDb, getReadyDispatchNodes, getTask } from '../db.js';

async function main() {
  const taskId = process.argv[2];
  if (!taskId) {
    console.error(JSON.stringify({
      success: false,
      error: '必须传入 task_id。用法: node scripts/tools/get_ready_dispatches.js <task_id>'
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

    const readyNodes = await getReadyDispatchNodes(taskId);
    console.log(JSON.stringify({
      success: true,
      task_id: taskId,
      task_status: task.status,
      session_strategy: task.session_strategy || 'main',
      orchestrator_session_key: task.orchestrator_session_key || null,
      ready_dispatches: readyNodes.map((node) => ({
        node_id: node.node_id,
        agent_id: node.agent_id,
        description: node.description,
        session_key: node.session_key || null,
        session_scope: node.session_scope || 'main',
        last_dispatch_id: node.last_dispatch_id || null,
        last_dispatch_at: node.last_dispatch_at || null
      }))
    }));
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
