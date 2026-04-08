#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const NERV_ROOT = path.resolve(__dirname, '..');
const OUTPUT_PATH = path.join(NERV_ROOT, 'data', 'runtime', 'install_validation.json');
const REQUIRED_ASSETS = {
  workflow_templates: [
    'workflow-templates/commerce_operations/live_commerce/live-session-script.template.json',
    'workflow-templates/commerce_operations/live_commerce/live-replay-summary.template.json',
    'workflow-templates/commerce_operations/live_commerce/live-objection-bank.template.json',
    'workflow-templates/commerce_operations/ecommerce_ops/product-review-insight.template.json',
    'workflow-templates/commerce_operations/ecommerce_ops/competitor-watch.template.json',
    'workflow-templates/project_ops/meeting-to-task.template.json',
    'workflow-templates/project_ops/status-report.template.json',
    'workflow-templates/finance_info/finance-brief.template.json'
  ],
  misato_workflow_skills: [
    'agents/misato/SKILLS/live-session-script/SKILL.md',
    'agents/misato/SKILLS/live-replay-summary/SKILL.md',
    'agents/misato/SKILLS/live-objection-bank/SKILL.md',
    'agents/misato/SKILLS/product-review-insight/SKILL.md',
    'agents/misato/SKILLS/competitor-watch/SKILL.md',
    'agents/misato/SKILLS/meeting-to-task/SKILL.md',
    'agents/misato/SKILLS/status-report/SKILL.md',
    'agents/misato/SKILLS/finance-brief/SKILL.md'
  ],
  workflow_specs: [
    'docs/live-script-pack-spec-v1.md',
    'docs/replay-summary-pack-spec-v1.md',
    'docs/objection-handling-pack-spec-v1.md',
    'docs/product-review-insight-spec-v1.md',
    'docs/competitor-watch-pack-spec-v1.md',
    'docs/meeting-to-task-pack-spec-v1.md',
    'docs/status-report-pack-spec-v1.md',
    'docs/finance-brief-spec-v1.md'
  ]
};

function runNodeScript(scriptPath, args = []) {
  try {
    const stdout = execFileSync(process.execPath, [scriptPath, ...args], {
      cwd: NERV_ROOT,
      encoding: 'utf-8'
    }).trim();
    return { ok: true, stdout };
  } catch (error) {
    return {
      ok: false,
      stdout: error.stdout?.toString() || '',
      stderr: error.stderr?.toString() || error.message
    };
  }
}

function parseJsonSafe(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function collectAssetValidation() {
  const result = {};
  for (const [group, relativePaths] of Object.entries(REQUIRED_ASSETS)) {
    const missing = relativePaths.filter((relativePath) => !fs.existsSync(path.join(NERV_ROOT, relativePath)));
    result[group] = {
      required: relativePaths.length,
      missing,
      ok: missing.length === 0
    };
  }
  result.overall_ok = Object.values(result).every((entry) => entry.ok === true);
  return result;
}

function main() {
  const scanner = runNodeScript(path.join(__dirname, 'skill_scanner.js'), ['--json']);
  const healthcheck = runNodeScript(path.join(__dirname, 'harness_healthcheck.js'), ['--compact']);

  const scannerJson = parseJsonSafe(scanner.stdout);
  const healthJson = parseJsonSafe(healthcheck.stdout);
  const assetValidation = collectAssetValidation();

  const payload = {
    generated_at: new Date().toISOString(),
    scanner: scannerJson || {
      success: false,
      error: scanner.stderr || 'skill_scanner returned non-JSON output'
    },
    healthcheck: healthJson || {
      success: false,
      error: healthcheck.stderr || 'harness_healthcheck returned non-JSON output'
    },
    asset_validation: assetValidation
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2));

  const overall =
    payload.healthcheck?.overall_status ||
    (payload.healthcheck?.success === false ? 'CRITICAL' : 'UNKNOWN');

  console.log(JSON.stringify({
    success: scanner.ok && healthcheck.ok && assetValidation.overall_ok,
    output: OUTPUT_PATH,
    overall_status: overall
  }, null, 2));
}

main();
