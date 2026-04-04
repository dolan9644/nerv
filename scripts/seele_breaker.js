#!/usr/bin/env node
/**
 * ███ NERV · SEELE 物理熔断器 · seele_breaker.js ███
 *
 * 在 LLM 审查之前，用正则硬扫代码文件。
 * 命中极高危特征 → 直接封驳，不进入 LLM 判断环节。
 *
 * 用法: node scripts/seele_breaker.js <file_or_directory>
 * 输出: JSON { safe: boolean, alerts: [...] }
 * 退出码: 0=安全, 1=发现威胁
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NERV_DB = process.env.NERV_DB_PATH || path.join(__dirname, '..', 'data', 'db', 'nerv.db');

// ═══════════════════════════════════════════════════════════════
// 极高危特征库 v1.0
// 后续根据 audit_logs 中的真实攻击慢慢追加
// ═══════════════════════════════════════════════════════════════

const CRITICAL_PATTERNS = [
  // API Key 泄露
  { name: 'AWS Key', regex: /AKIA[0-9A-Z]{16}/g, severity: 'CRITICAL' },
  { name: 'Google API Key', regex: /AIza[0-9A-Za-z\-_]{35}/g, severity: 'CRITICAL' },
  { name: 'OpenAI Key', regex: /sk-[a-zA-Z0-9]{20,}/g, severity: 'CRITICAL' },
  { name: 'Generic Secret', regex: /(api[_-]?key|secret[_-]?key|access[_-]?token)\s*[:=]\s*['"][A-Za-z0-9+/=]{16,}['"]/gi, severity: 'HIGH' },

  // 反向 Shell
  { name: 'Reverse Shell (bash)', regex: /bash\s+-i\s+>&?\s*\/dev\/tcp/gi, severity: 'CRITICAL' },
  { name: 'Reverse Shell (nc)', regex: /\bnc\s+-[elp]+\s+.*\d{2,5}/gi, severity: 'CRITICAL' },
  { name: 'Reverse Shell (python)', regex: /socket\.connect\(\s*\(\s*['"][^'"]+['"]\s*,\s*\d+\s*\)\s*\)/gi, severity: 'CRITICAL' },

  // 挖矿特征
  { name: 'Crypto Miner (xmrig)', regex: /\bxmrig\b/gi, severity: 'CRITICAL' },
  { name: 'Crypto Miner (stratum)', regex: /stratum\+tcp:\/\//gi, severity: 'CRITICAL' },
  { name: 'Crypto Miner (monero)', regex: /\bmonero\b.*\bwallet\b/gi, severity: 'HIGH' },

  // 高危代码执行
  { name: 'Dangerous eval', regex: /\beval\s*\(\s*(request|input|argv|sys\.stdin|process\.stdin)/gi, severity: 'HIGH' },
  { name: 'Subprocess shell=True', regex: /subprocess\.(call|Popen|run)\s*\([^)]*shell\s*=\s*True/gi, severity: 'HIGH' },
  { name: 'os.system()', regex: /os\.system\s*\(/gi, severity: 'HIGH' },

  // 网络外联
  { name: 'Curl to unknown', regex: /curl\s+(-[sS]*\s+)*https?:\/\/(?!github\.com|pypi\.org|registry\.npmjs\.org)/gi, severity: 'MEDIUM' },
  { name: 'Wget payload', regex: /wget\s+.*\|\s*(bash|sh|python)/gi, severity: 'CRITICAL' },
];

function scanFile(filePath) {
  const alerts = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (const pattern of CRITICAL_PATTERNS) {
    // 重置 lastIndex
    pattern.regex.lastIndex = 0;
    let match;
    while ((match = pattern.regex.exec(content)) !== null) {
      // 找到匹配所在行号
      const upToMatch = content.substring(0, match.index);
      const lineNum = upToMatch.split('\n').length;

      // NERV_BYPASS 白名单：造物主手动标注的合法敏感代码
      const contextLine = lines[lineNum - 1] || '';
      if (contextLine.includes('NERV_BYPASS')) continue;

      alerts.push({
        file: filePath,
        line: lineNum,
        pattern_name: pattern.name,
        severity: pattern.severity,
        matched: match[0].substring(0, 80) + (match[0].length > 80 ? '...' : ''),
        context: contextLine.trim().substring(0, 120)
      });
    }
  }

  return alerts;
}

function scanDirectory(dirPath) {
  const alerts = [];
  const SCAN_EXTENSIONS = new Set(['.js', '.py', '.sh', '.ts', '.mjs', '.cjs', '.rb', '.go']);
  const MAX_DEPTH = 10;  // 防御性编程：限制递归深度，防止软链接循环 / 极深目录

  function walk(dir, depth) {
    if (depth > MAX_DEPTH) return;  // 算力黑洞保险丝
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // 跳过软链接目录（防循环）+ 隐藏目录 + node_modules
        if (entry.isSymbolicLink?.() || entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        walk(fullPath, depth + 1);
      } else if (entry.isFile() && SCAN_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        try {
          const stat = fs.lstatSync(fullPath);  // lstat 不穿透软链接
          if (stat.isSymbolicLink()) continue;   // 跳过软链接文件
          if (stat.size <= 1024 * 1024) {
            alerts.push(...scanFile(fullPath));
          }
        } catch { /* skip unreadable */ }
      }
    }
  }

  walk(dirPath, 0);
  return alerts;
}

function main() {
  const target = process.argv[2];

  if (!target) {
    console.log(JSON.stringify({ safe: false, error: '用法: node seele_breaker.js <file_or_directory>' }));
    process.exit(1);
  }

  if (!fs.existsSync(target)) {
    console.log(JSON.stringify({ safe: false, error: `目标不存在: ${target}` }));
    process.exit(1);
  }

  const stat = fs.statSync(target);
  const alerts = stat.isDirectory() ? scanDirectory(target) : scanFile(target);

  const hasCritical = alerts.some(a => a.severity === 'CRITICAL');
  const result = {
    safe: alerts.length === 0,
    scanned_target: target,
    total_alerts: alerts.length,
    critical_count: alerts.filter(a => a.severity === 'CRITICAL').length,
    high_count: alerts.filter(a => a.severity === 'HIGH').length,
    verdict: hasCritical ? 'AUTO_REJECT' : (alerts.length > 0 ? 'REVIEW_REQUIRED' : 'CLEAN'),
    alerts: alerts.slice(0, 20) // 最多返回 20 条，防上下文爆炸
  };

  console.log(JSON.stringify(result, null, 2));

  // 同步写入 harness_stats 表（MAGI 面板数据源，零 LLM 侵入）
  writeHarnessStat(result.verdict, result.total_alerts, result.critical_count);

  // 修复异步猝死：用 exitCode 替代 process.exit()，让 Event Loop 自然结束
  process.exitCode = alerts.length > 0 ? 1 : 0;
}

function writeHarnessStat(verdict, totalAlerts, criticalCount) {
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
      'seele_breaker',
      process.env.TASK_ID || null,
      verdict === 'CLEAN' ? 'PASS' : (verdict === 'AUTO_REJECT' ? 'AUTO_REJECT' : 'FAIL'),
      JSON.stringify({ total_alerts: totalAlerts, critical_count: criticalCount })
    );
  } catch { /* 静默失败 */ } finally {
    try { db?.close(); } catch { /* ignore */ }
  }
}

main();
