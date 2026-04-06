#!/usr/bin/env node
/**
 * ███ NERV 专属工具 · create_dag_task (Harness Hardened) ███
 *
 * misato 专用。创建一个 Task 及其完整 DAG 结构。
 *
 * 补丁 A: 从文件读取 JSON（杜绝 Bash 引号转义灾难）
 * 补丁 B: DFS 成环检测（拒绝循环依赖的死锁图）
 * 补丁 C: db.transaction() 原子事务（全有或全无，无半人马 DAG）
 *
 * 用法（两步走）：
 *   1. misato 用 write 工具写入: sandbox_io/task_xxx.json
 *   2. misato 用 exec 执行: node scripts/tools/create_dag_task.js sandbox_io/task_xxx.json
 *
 * 输入 JSON Schema:
 * {
 *   "task_id": "uuid-string (必填)",
 *   "initiator_id": "string (必填)",
 *   "intent": "string (必填)",
 *   "priority": "number 0-5 (可选，默认 0)",
 *   "nodes": [{ "node_id", "agent_id", "description", "depth?", "max_retries?", "contract?" }],
 *   "edges": [{ "from": "node_id", "to": "node_id" }]
 * }
 */

import { readFileSync, existsSync } from 'fs';
import { createFullDag, closeDb } from '../db.js';

const CONTRACT_VERSION = '1.0';
const DISPATCH_MODES = new Set(['agent_session', 'tool_exec', 'approval_gate', 'human_input', 'cron_only']);
const COMPLETION_MODES = new Set(['event_only', 'artifact_only', 'event_and_artifact', 'event_or_artifact', 'approval_only']);
const ACCEPTED_EVENTS = new Set(['NODE_COMPLETED', 'NODE_FAILED', 'NODE_OBSERVED_DONE', 'NODE_OBSERVED_FAILED']);
const ARTIFACT_MATCH_MODES = new Set(['all', 'any']);
const RESULT_PATH_SOURCES = new Set(['first_required_artifact', 'first_optional_artifact', 'explicit_event_field']);
const OBSERVATION_SOURCES = new Set(['session_event', 'artifact_fs', 'audit_log', 'approval_table', 'cron_health']);
const DEDUPE_KEY_TEMPLATES = new Set([
  'task_id:node_id:event',
  'task_id:node_id:artifact',
  'task_id:node_id:event:artifact'
]);

// ═══════════════════════════════════════════════════════════════
// 补丁 A: 文件输入（杜绝 Bash 转义灾难）
// ═══════════════════════════════════════════════════════════════

function readInput() {
  const inputFile = process.argv[2];

  if (!inputFile) {
    throw new Error(
      '【使用方式错误】必须传入 JSON 文件路径作为参数。\n' +
      '正确用法：node scripts/tools/create_dag_task.js sandbox_io/task_xxx.json\n' +
      '严禁使用 echo | 管道传参（Bash 引号转义会导致 JSON 损坏）。'
    );
  }

  if (!existsSync(inputFile)) {
    throw new Error(`【文件不存在】找不到文件: ${inputFile}。请先用 write 工具创建该文件。`);
  }

  const raw = readFileSync(inputFile, 'utf-8').trim();
  if (!raw) {
    throw new Error(`【文件为空】${inputFile} 内容为空。请写入合法的 JSON 后重试。`);
  }

  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`【JSON 解析失败】${inputFile} 不是合法的 JSON: ${e.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// 强类型校验（含补丁 B: 成环检测）
// ═══════════════════════════════════════════════════════════════

function validateInput(input) {
  const errors = [];

  if (typeof input !== 'object' || input === null) {
    throw new Error('【参数错误】输入必须是 JSON Object。');
  }

  // 顶层字段
  if (typeof input.task_id !== 'string' || input.task_id.length < 4) {
    errors.push('task_id 必须是长度 >= 4 的字符串（UUID 格式）');
  }
  if (typeof input.initiator_id !== 'string' || input.initiator_id.length === 0) {
    errors.push('initiator_id 必须是非空字符串（例如 "nerv-misato"）');
  }
  if (typeof input.intent !== 'string' || input.intent.trim().length === 0) {
    errors.push('intent 必须是非空字符串（任务意图描述）');
  }
  if (input.priority !== undefined) {
    if (typeof input.priority !== 'number' || input.priority < 0 || input.priority > 5 || !Number.isInteger(input.priority)) {
      errors.push('priority 必须是 0-5 之间的整数');
    }
  }

  // nodes 校验
  if (!Array.isArray(input.nodes)) {
    errors.push('nodes 必须是数组。即使只有一个节点也要用 [{ ... }] 格式');
  } else if (input.nodes.length === 0) {
    errors.push('nodes 不能为空数组，至少需要一个 DAG 节点');
  } else {
    const nodeIds = new Set();
    input.nodes.forEach((node, i) => {
      if (typeof node !== 'object' || node === null) {
        errors.push(`nodes[${i}] 必须是 Object`);
        return;
      }
      if (typeof node.node_id !== 'string' || node.node_id.length < 4) {
        errors.push(`nodes[${i}].node_id 必须是长度 >= 4 的字符串`);
      } else {
        if (nodeIds.has(node.node_id)) {
          errors.push(`nodes[${i}].node_id "${node.node_id}" 重复`);
        }
        nodeIds.add(node.node_id);
      }
      if (typeof node.agent_id !== 'string' || node.agent_id.length === 0) {
        errors.push(`nodes[${i}].agent_id 必须是非空字符串`);
      }
      if (typeof node.description !== 'string' || node.description.length === 0) {
        errors.push(`nodes[${i}].description 必须是非空字符串`);
      }
      if (node.depth !== undefined && (typeof node.depth !== 'number' || node.depth < 0)) {
        errors.push(`nodes[${i}].depth 必须是 >= 0 的数字`);
      }
      if (node.max_retries !== undefined && (typeof node.max_retries !== 'number' || node.max_retries < 0)) {
        errors.push(`nodes[${i}].max_retries 必须是 >= 0 的数字`);
      }
      validateNodeContract(node, i, errors);
    });
  }

  // edges 校验
  if (input.edges !== undefined) {
    if (!Array.isArray(input.edges)) {
      errors.push('edges 必须是数组。格式: [{ "from": "node_id", "to": "node_id" }]');
    } else {
      const validNodeIds = new Set((input.nodes || []).map(n => n.node_id).filter(Boolean));
      input.edges.forEach((edge, i) => {
        if (typeof edge !== 'object' || edge === null) {
          errors.push(`edges[${i}] 必须是 Object`);
          return;
        }
        if (typeof edge.from !== 'string') {
          errors.push(`edges[${i}].from 必须是字符串`);
        } else if (!validNodeIds.has(edge.from)) {
          errors.push(`edges[${i}].from "${edge.from}" 不在 nodes 列表中`);
        }
        if (typeof edge.to !== 'string') {
          errors.push(`edges[${i}].to 必须是字符串`);
        } else if (!validNodeIds.has(edge.to)) {
          errors.push(`edges[${i}].to "${edge.to}" 不在 nodes 列表中`);
        }
        if (edge.from === edge.to) {
          errors.push(`edges[${i}] 自环禁止：from 和 to 不能相同`);
        }
      });

      // ═══════════════════════════════════════════════════════
      // 补丁 B: DFS 拓扑成环检测
      // 如果存在 A→B→C→A 循环依赖，直接拒绝
      // ═══════════════════════════════════════════════════════
      if (input.edges.length > 0 && errors.length === 0) {
        const adj = {};
        input.nodes.forEach(n => { adj[n.node_id] = []; });
        input.edges.forEach(e => { adj[e.from].push(e.to); });

        const visited = new Set();
        const recStack = new Set();

        function isCyclic(curr) {
          if (recStack.has(curr)) return true;
          if (visited.has(curr)) return false;
          visited.add(curr);
          recStack.add(curr);
          for (const neighbor of (adj[curr] || [])) {
            if (isCyclic(neighbor)) return true;
          }
          recStack.delete(curr);
          return false;
        }

        for (const node of input.nodes) {
          if (isCyclic(node.node_id)) {
            errors.push('edges 存在循环依赖（死锁图），系统只接受有向无环图 (DAG)');
            break;
          }
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `【参数校验失败】共 ${errors.length} 个错误，请修正后重试：\n` +
      errors.map((e, i) => `  ${i + 1}. ${e}`).join('\n')
    );
  }
}

function validateStringArray(value, label, errors, allowedValues = null) {
  if (!Array.isArray(value)) {
    errors.push(`${label} 必须是字符串数组`);
    return;
  }
  value.forEach((item, index) => {
    if (typeof item !== 'string' || item.trim().length === 0) {
      errors.push(`${label}[${index}] 必须是非空字符串`);
      return;
    }
    if (allowedValues && !allowedValues.has(item)) {
      errors.push(`${label}[${index}] "${item}" 不在允许值中`);
    }
  });
}

function validateInteger(value, label, errors, min = 0) {
  if (!Number.isInteger(value) || value < min) {
    errors.push(`${label} 必须是 >= ${min} 的整数`);
  }
}

function validateNodeContract(node, index, errors) {
  if (node.contract === undefined) return;

  const label = `nodes[${index}].contract`;
  const contract = node.contract;

  if (typeof contract !== 'object' || contract === null || Array.isArray(contract)) {
    errors.push(`${label} 必须是 Object`);
    return;
  }

  if (contract.version !== CONTRACT_VERSION) {
    errors.push(`${label}.version 必须是 "${CONTRACT_VERSION}"`);
  }

  const dispatch = contract.dispatch_contract;
  if (dispatch !== undefined) {
    if (typeof dispatch !== 'object' || dispatch === null || Array.isArray(dispatch)) {
      errors.push(`${label}.dispatch_contract 必须是 Object`);
    } else {
      if (dispatch.mode !== undefined && !DISPATCH_MODES.has(dispatch.mode)) {
        errors.push(`${label}.dispatch_contract.mode "${dispatch.mode}" 非法`);
      }
      if (dispatch.target_agent !== undefined) {
        if (typeof dispatch.target_agent !== 'string' || dispatch.target_agent.trim().length === 0) {
          errors.push(`${label}.dispatch_contract.target_agent 必须是非空字符串`);
        } else if (dispatch.target_agent !== node.agent_id) {
          errors.push(`${label}.dispatch_contract.target_agent 必须与 agent_id 一致，避免调度漂移`);
        }
      }
      if (dispatch.output_dir !== undefined && (typeof dispatch.output_dir !== 'string' || dispatch.output_dir.trim().length === 0)) {
        errors.push(`${label}.dispatch_contract.output_dir 必须是非空字符串`);
      }
      if (dispatch.input_artifacts !== undefined) {
        validateStringArray(dispatch.input_artifacts, `${label}.dispatch_contract.input_artifacts`, errors);
      }
      if (dispatch.notes !== undefined && typeof dispatch.notes !== 'string') {
        errors.push(`${label}.dispatch_contract.notes 必须是字符串`);
      }
    }
  }

  const completion = contract.completion_contract;
  if (typeof completion !== 'object' || completion === null || Array.isArray(completion)) {
    errors.push(`${label}.completion_contract 必须存在且必须是 Object`);
  } else {
    if (!COMPLETION_MODES.has(completion.mode)) {
      errors.push(`${label}.completion_contract.mode "${completion.mode}" 非法`);
    }
    if (completion.accepted_events !== undefined) {
      validateStringArray(completion.accepted_events, `${label}.completion_contract.accepted_events`, errors, ACCEPTED_EVENTS);
    }
    if (completion.required_artifacts !== undefined) {
      validateStringArray(completion.required_artifacts, `${label}.completion_contract.required_artifacts`, errors);
    }
    if (completion.optional_artifacts !== undefined) {
      validateStringArray(completion.optional_artifacts, `${label}.completion_contract.optional_artifacts`, errors);
    }
    if (completion.artifact_match_mode !== undefined && !ARTIFACT_MATCH_MODES.has(completion.artifact_match_mode)) {
      errors.push(`${label}.completion_contract.artifact_match_mode "${completion.artifact_match_mode}" 非法`);
    }
    if (completion.require_task_id_match !== undefined && typeof completion.require_task_id_match !== 'boolean') {
      errors.push(`${label}.completion_contract.require_task_id_match 必须是布尔值`);
    }
    if (completion.require_node_id_match !== undefined && typeof completion.require_node_id_match !== 'boolean') {
      errors.push(`${label}.completion_contract.require_node_id_match 必须是布尔值`);
    }
    if (completion.result_path_from !== undefined && !RESULT_PATH_SOURCES.has(completion.result_path_from)) {
      errors.push(`${label}.completion_contract.result_path_from "${completion.result_path_from}" 非法`);
    }

    const requiresEvent = completion.mode === 'event_only' || completion.mode === 'event_and_artifact' || completion.mode === 'event_or_artifact';
    const requiresArtifact = completion.mode === 'artifact_only' || completion.mode === 'event_and_artifact' || completion.mode === 'event_or_artifact';

    if (requiresEvent && (!Array.isArray(completion.accepted_events) || completion.accepted_events.length === 0)) {
      errors.push(`${label}.completion_contract.mode=${completion.mode} 时必须声明 accepted_events`);
    }
    if (requiresArtifact && (!Array.isArray(completion.required_artifacts) || completion.required_artifacts.length === 0)) {
      errors.push(`${label}.completion_contract.mode=${completion.mode} 时必须声明 required_artifacts`);
    }
  }

  const runtime = contract.runtime_contract;
  if (runtime !== undefined) {
    if (typeof runtime !== 'object' || runtime === null || Array.isArray(runtime)) {
      errors.push(`${label}.runtime_contract 必须是 Object`);
    } else {
      if (runtime.timeout_seconds !== undefined) validateInteger(runtime.timeout_seconds, `${label}.runtime_contract.timeout_seconds`, errors, 1);
      if (runtime.max_retries !== undefined) validateInteger(runtime.max_retries, `${label}.runtime_contract.max_retries`, errors, 0);
      if (runtime.retry_backoff_seconds !== undefined) validateInteger(runtime.retry_backoff_seconds, `${label}.runtime_contract.retry_backoff_seconds`, errors, 0);
      if (runtime.orphan_threshold_seconds !== undefined) validateInteger(runtime.orphan_threshold_seconds, `${label}.runtime_contract.orphan_threshold_seconds`, errors, 1);

      if (runtime.max_retries !== undefined) {
        if (node.max_retries === undefined) {
          node.max_retries = runtime.max_retries;
        } else if (node.max_retries !== runtime.max_retries) {
          errors.push(`${label}.runtime_contract.max_retries 与 nodes[${index}].max_retries 不一致`);
        }
      }
    }
  }

  const observation = contract.observation_contract;
  if (observation !== undefined) {
    if (typeof observation !== 'object' || observation === null || Array.isArray(observation)) {
      errors.push(`${label}.observation_contract 必须是 Object`);
    } else {
      if (observation.sources !== undefined) {
        validateStringArray(observation.sources, `${label}.observation_contract.sources`, errors, OBSERVATION_SOURCES);
      }
      if (observation.dedupe_key_template !== undefined && !DEDUPE_KEY_TEMPLATES.has(observation.dedupe_key_template)) {
        errors.push(`${label}.observation_contract.dedupe_key_template "${observation.dedupe_key_template}" 非法`);
      }
      if (observation.artifact_root !== undefined && (typeof observation.artifact_root !== 'string' || observation.artifact_root.trim().length === 0)) {
        errors.push(`${label}.observation_contract.artifact_root 必须是非空字符串`);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 主执行逻辑（补丁 C: 使用 createFullDag 原子事务）
// ═══════════════════════════════════════════════════════════════

async function main() {
  let input;

  // 从文件读取（补丁 A）
  try {
    input = readInput();
  } catch (e) {
    console.error(JSON.stringify({ success: false, error: e.message }));
    process.exit(1);
  }

  // 强类型校验 + 成环检测（补丁 B）
  try {
    validateInput(input);
  } catch (e) {
    console.error(JSON.stringify({ success: false, error: e.message }));
    process.exit(1);
  }

  // 原子事务写入（补丁 C）
  try {
    const result = await createFullDag({
      taskId: input.task_id,
      initiatorId: input.initiator_id,
      intent: input.intent,
      priority: input.priority ?? 0,
      nodes: input.nodes,
      edges: input.edges || []
    });

    console.log(JSON.stringify({
      success: true,
      task_id: result.taskId,
      nodes_created: result.nodesCreated,
      edges_created: result.edgesCreated
    }));

  } catch (e) {
    console.error(JSON.stringify({
      success: false,
      error: `【数据库写入失败（已自动回滚）】${e.message}`
    }));
    process.exit(1);
  } finally {
    closeDb();
  }
}

main().catch((e) => {
  console.error(JSON.stringify({
    success: false,
    error: `【未捕获异常】${e.message}`
  }));
  closeDb();
  process.exit(1);
});
