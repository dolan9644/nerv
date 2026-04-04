#!/usr/bin/env node
/**
 * ███ NERV 专属工具 · write_audit_log (Harness Hardened) ███
 *
 * seele 专用。极度收敛的审计日志写入工具。
 * 强制文件读取，规避 Bash 转义灾难。
 *
 * 用法：node scripts/tools/write_audit_log.js sandbox_io/audit_xxx.json
 *
 * 输入 JSON Schema:
 * {
 *   "task_id": "string (必填)",
 *   "node_id": "string (必填，精确到节点)",
 *   "action": "string (必填，枚举值)",
 *   "detail": "string (可选，审查说明)"
 * }
 */

import fs from 'fs';
import { writeAuditLog, closeDb } from '../db.js';

const ALLOWED_ACTIONS = new Set(['AUDIT_APPROVE', 'AUDIT_REJECT', 'SECURITY_ALERT', 'FALSE_POSITIVE']);

function validateInput(input) {
  const errors = [];
  if (typeof input !== 'object' || input === null) {
    throw new Error('【参数错误】输入必须是 JSON Object。');
  }
  if (typeof input.task_id !== 'string' || input.task_id.length === 0) {
    errors.push('task_id 必须是非空字符串');
  }
  // 核心修复：强制 node_id，对齐 security_probe 的 node 级审计关联
  if (typeof input.node_id !== 'string' || input.node_id.length === 0) {
    errors.push('node_id 必须是非空字符串，审计必须精确到具体节点');
  }
  if (typeof input.action !== 'string' || !ALLOWED_ACTIONS.has(input.action)) {
    errors.push(`action 必须在白名单中: ${[...ALLOWED_ACTIONS].join(', ')}`);
  }
  if (input.detail !== undefined && input.detail !== null && typeof input.detail !== 'string') {
    errors.push('detail 如果提供，必须是字符串');
  }
  if (errors.length > 0) {
    throw new Error(`【参数校验失败】\n` + errors.map((e, i) => `  ${i + 1}. ${e}`).join('\n'));
  }
}

async function main() {
  const inputFile = process.argv[2];
  if (!inputFile || !fs.existsSync(inputFile)) {
    console.error(JSON.stringify({ success: false, error: '必须传入有效的 JSON 文件路径作为参数。用法: node scripts/tools/write_audit_log.js sandbox_io/audit_xxx.json' }));
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
    await writeAuditLog(input.task_id, input.node_id, 'seele', input.action, input.detail || null);
    console.log(JSON.stringify({
      success: true,
      task_id: input.task_id,
      node_id: input.node_id,
      action: input.action,
      timestamp: new Date().toISOString()
    }));
  } catch (e) {
    console.error(JSON.stringify({ success: false, error: `【数据库写入失败】${e.message}` }));
    process.exit(1);
  } finally {
    closeDb();
  }
}

main();
