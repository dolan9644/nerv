#!/usr/bin/env node
/**
 * NERV create_dag_task 的配套工具。
 * 从 DB 真相源读取指定 task 的 ready 节点和强制 session_key。
 *
 * 用法：
 *   node scripts/tools/get_ready_dispatches.js <task_id>
 */

import { closeDb, getReadyDispatchNodes, getTask } from '../db.js';

function buildNodeContractMap(task) {
  if (!task?.dag_json) return new Map();
  try {
    const dag = JSON.parse(task.dag_json);
    const nodes = Array.isArray(dag?.nodes) ? dag.nodes : [];
    return new Map(nodes.map((node) => [node.node_id, node]));
  } catch {
    return new Map();
  }
}

function toDispatchPayload(node = {}, fallbackDescription = '') {
  const dispatchContract = node?.contract?.dispatch_contract || {};
  return {
    description: dispatchContract.description || node.description || fallbackDescription || '',
    input_paths: Array.isArray(dispatchContract.input_paths) ? dispatchContract.input_paths : [],
    output_dir: dispatchContract.output_dir || null,
    constraints: dispatchContract.constraints || {}
  };
}

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
    const nodeContractMap = buildNodeContractMap(task);
    console.log(JSON.stringify({
      success: true,
      task_id: taskId,
      task_status: task.status,
      repair_mode: task.repair_mode || 'new',
      repair_of_task_id: task.repair_of_task_id || null,
      target_session_key: task.target_session_key || null,
      workflow_id: task.workflow_id || null,
      workflow_cn_name: task.workflow_cn_name || null,
      entry_mode: task.entry_mode || null,
      resolved_from: task.resolved_from || null,
      session_strategy: task.session_strategy || 'main',
      orchestrator_session_key: task.orchestrator_session_key || null,
      ready_dispatches: readyNodes.map((node) => ({
        node_id: node.node_id,
        agent_id: node.agent_id,
        description: node.description,
        session_key: node.session_key || null,
        session_scope: node.session_scope || 'main',
        last_dispatch_id: node.last_dispatch_id || null,
        last_dispatch_at: node.last_dispatch_at || null,
        dispatch_payload: toDispatchPayload(nodeContractMap.get(node.node_id), node.description),
        dispatch_contract: nodeContractMap.get(node.node_id)?.contract?.dispatch_contract || null
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
