#!/usr/bin/env node
/**
 * ███ NERV 物理校验脚本 · adapter_lint.js ███
 *
 * Ritsuko 的适配器代码质量门。
 * 在提交给 eva-01 部署前，强制检查 I/O 契约合规性。
 *
 * 用法: node scripts/adapter_lint.js <adapter_file>
 * 输出: JSON { valid: boolean, errors: [...] }
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NERV_DB = process.env.NERV_DB_PATH || path.join(__dirname, '..', 'data', 'db', 'nerv.db');

const MAX_LINES = 500;

function lintJavaScript(content, filename) {
  const errors = [];

  // 1. 必须有 try-catch
  if (!content.includes('try') || !content.includes('catch')) {
    errors.push('缺少 try-catch 错误处理（I/O 契约要求捕获所有异常）');
  }

  // 2. 必须有 JSON 输出到 stdout
  if (!content.includes('JSON.stringify') && !content.includes('console.log')) {
    errors.push('缺少 JSON.stringify / console.log 输出（I/O 契约要求 JSON STDOUT）');
  }

  // 3. 必须有退出码
  if (!content.includes('process.exit')) {
    errors.push('缺少 process.exit(0/1)（I/O 契约要求明确退出码）');
  }

  // 4. 必须有 status 字段输出
  if (!content.includes('"status"') && !content.includes("'status'")) {
    errors.push('输出 JSON 缺少 "status" 字段（I/O 契约要求 status: ok|error）');
  }

  return errors;
}

function lintPython(content, filename) {
  const errors = [];

  // 0. 前置声明校验：确保基础模块已导入
  if (!content.includes('import json')) {
    errors.push('缺少 import json（I/O 契约要求 JSON 输出，必须导入 json 模块）');
  }
  if (!content.includes('import sys')) {
    errors.push('缺少 import sys（I/O 契约要求明确退出码，必须导入 sys 模块）');
  }

  // 1. 必须有 try-except
  if (!content.includes('try:') || !content.includes('except')) {
    errors.push('缺少 try-except 错误处理（I/O 契约要求捕获所有异常）');
  }

  // 2. 必须有 JSON 输出
  if (!content.includes('json.dumps') && !content.includes('json.dump')) {
    errors.push('缺少 json.dumps 输出（I/O 契约要求 JSON STDOUT）');
  }

  // 3. 必须有退出码
  if (!content.includes('sys.exit') && !content.includes('exit(')) {
    errors.push('缺少 sys.exit(0/1)（I/O 契约要求明确退出码）');
  }

  // 4. 必须有 status 字段
  if (!content.includes('"status"') && !content.includes("'status'")) {
    errors.push('输出 JSON 缺少 "status" 字段');
  }

  return errors;
}

function lintShell(content, filename) {
  const errors = [];

  if (!content.includes('exit ') && !content.includes('exit\n')) {
    errors.push('缺少 exit 退出码');
  }

  return errors;
}

function main() {
  const filePath = process.argv[2];

  if (!filePath || filePath === '--help' || filePath === '-h') {
    console.log(JSON.stringify({
      usage: 'node adapter_lint.js <adapter_file>',
      description: 'NERV 适配器 I/O 契约校验器',
      supported: ['.js', '.mjs', '.py', '.sh'],
      checks: ['try-catch/try-except', 'JSON stdout', 'exit code', 'status field', 'max 500 lines']
    }, null, 2));
    process.exit(0);
  }

  if (!fs.existsSync(filePath)) {
    console.log(JSON.stringify({ valid: false, errors: [`文件不存在: ${filePath}`] }));
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const ext = path.extname(filePath).toLowerCase();
  const lines = content.split('\n').length;

  const errors = [];

  // 通用检查
  if (content.trim().length === 0) {
    errors.push('文件为空');
  }
  if (lines > MAX_LINES) {
    errors.push(`文件过长 (${lines} 行 > ${MAX_LINES} 行上限)，疑似非适配器代码`);
  }

  // 语言特定检查
  if (errors.length === 0) {
    if (ext === '.js' || ext === '.mjs') {
      errors.push(...lintJavaScript(content, filePath));
    } else if (ext === '.py') {
      errors.push(...lintPython(content, filePath));
    } else if (ext === '.sh') {
      errors.push(...lintShell(content, filePath));
    } else {
      errors.push(`不支持的文件类型: ${ext}（支持 .js/.py/.sh）`);
    }
  }

  const result = {
    valid: errors.length === 0,
    file: filePath,
    lines,
    language: ext,
    errors
  };

  console.log(JSON.stringify(result, null, 2));

  // 同步写入 harness_stats 表（MAGI 面板数据源，零 LLM 侵入）
  writeHarnessStat(result.valid ? 'PASS' : 'FAIL', errors.length, filePath);

  // 修复异步猝死：用 exitCode 替代 process.exit()
  process.exitCode = errors.length > 0 ? 1 : 0;
}

function writeHarnessStat(verdict, errorCount, file) {
  let db;
  try {
    const require = createRequire(import.meta.url);
    const Database = require('better-sqlite3');
    if (!fs.existsSync(NERV_DB)) return;
    db = new Database(NERV_DB);
    db.pragma('busy_timeout = 5000');
    db.prepare(
      'INSERT INTO harness_stats (harness_type, task_id, result, detail) VALUES (?, ?, ?, ?)'
    ).run(
      'adapter_lint',
      process.env.TASK_ID || null,
      verdict,
      JSON.stringify({ error_count: errorCount, file })
    );
  } catch { /* 静默失败 */ } finally {
    try { db?.close(); } catch { /* ignore */ }
  }
}

main();
