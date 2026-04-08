#!/usr/bin/env node

import { execFileSync } from 'child_process';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const NERV_ROOT = resolve(__dirname, '..');

const FORBIDDEN_PATHS = [
  /^\.env(\..*)?$/,
  /^data\/security-audit-/,
  /^.*\.(pem|key|secret)$/i,
  /^openclaw_backup\.json$/,
  /^openclaw\.json\.bak.*$/,
  /^openclaw\.json\.clobbered\..*$/
];

const SECRET_PATTERNS = [
  /FEISHU_APP_SECRET\s*[:=]\s*.+/i,
  /FEISHU_VERIFY_TOKEN\s*[:=]\s*.+/i,
  /GOOGLE_API_KEY\s*[:=]\s*.+/i,
  /OPENCLAW_GATEWAY_TOKEN\s*[:=]\s*.+/i,
  /\bghp_[A-Za-z0-9]{36}\b/g,
  /\bgho_[A-Za-z0-9]{36}\b/g,
  /\bghs_[A-Za-z0-9]{36}\b/g,
  /\bghu_[A-Za-z0-9]{36}\b/g,
  /\bsk-[A-Za-z0-9]{48}\b/g,
  /\bsk-ant-[A-Za-z0-9]{52}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]+\b/g
];

function runGit(args) {
  return execFileSync('git', ['-C', NERV_ROOT, ...args], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function getStagedFiles() {
  const raw = runGit(['diff', '--cached', '--name-only', '--diff-filter=ACMRT']);
  return raw.split('\n').map((line) => line.trim()).filter(Boolean);
}

function getStagedDiff() {
  try {
    return runGit(['diff', '--cached', '--unified=0', '--no-color']);
  } catch (error) {
    return `${error.stdout || ''}\n${error.stderr || ''}`;
  }
}

function matchesForbiddenPath(filePath) {
  return FORBIDDEN_PATHS.some((pattern) => pattern.test(filePath));
}

function scanDiffForSecrets(diffText) {
  const hits = [];
  for (const pattern of SECRET_PATTERNS) {
    const matches = diffText.match(pattern);
    if (matches?.length) {
      hits.push({ pattern: pattern.toString(), count: matches.length });
    }
  }
  return hits;
}

function main() {
  const stagedFiles = getStagedFiles();
  const blockedFiles = stagedFiles.filter(matchesForbiddenPath);
  const diffText = getStagedDiff();
  const secretHits = scanDiffForSecrets(diffText);

  const summary = {
    success: blockedFiles.length === 0 && secretHits.length === 0,
    staged_files: stagedFiles.length,
    blocked_files: blockedFiles,
    secret_hits: secretHits,
    gate: blockedFiles.length === 0 && secretHits.length === 0 ? 'PASS' : 'FAIL'
  };

  if (!summary.success) {
    console.error(JSON.stringify(summary, null, 2));
    console.error('[pre-publish-security-gate] Blocked. Remove sensitive files or secret text from staged changes.');
    process.exit(1);
  }

  console.log(JSON.stringify(summary, null, 2));
}

main();
