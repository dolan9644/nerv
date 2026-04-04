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
 *   "nodes": [{ "node_id", "agent_id", "description", "depth?", "max_retries?" }],
 *   "edges": [{ "from": "node_id", "to": "node_id" }]
 * }
 */

import { readFileSync, existsSync } from 'fs';
import { createFullDag, closeDb } from '../db.js';

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

// ═══════════════════════════════════════════════════════════════
// 主执行逻辑（补丁 C: 使用 createFullDag 原子事务）
// ═══════════════════════════════════════════════════════════════

function main() {
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
    const result = createFullDag({
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

main();
