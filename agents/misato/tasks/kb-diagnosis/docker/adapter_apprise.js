/**
 * NERV_IOC Adapter: APprise
 * IO_TYPE: notification→multi_channel_push
 * Domain: 定时播报
 *
 * Input:  { body: string, title?: string, targets: string[] }
 * Output: { "status": "ok"|"error", sent?: number, failed?: number, error?: string, adapter: string, version: string }
 */

'use strict';

const { execSync } = require('child_process');

const ADAPTER_NAME = 'adapter_apprise';
const ADAPTER_VERSION = '1.0.1';

function validate(input) {
  const errors = [];
  if (!input || typeof input !== 'object') { errors.push('INPUT_INVALID'); return { valid: false, errors }; }
  if (typeof input.body !== 'string' || !input.body.trim()) { errors.push('FIELD_REQUIRED: body'); }
  if (!Array.isArray(input.targets) || input.targets.length === 0) { errors.push('FIELD_REQUIRED: targets (non-empty array)'); }
  return { valid: errors.length === 0, errors };
}

function execute(input) {
  const { body, title = '', targets } = input;
  const bodyEsc = body.replace(/'/g, "'").replace(/\n/g, '\\n');
  const titleEsc = title.replace(/'/g, "'");
  const adds = targets.map(t => `app.add('${t.replace(/'/g, "'")}')`).join('\n    ');
  const script = `python3 - <<'PYEOF'
import sys
import json
try:
    import apprise
    app = apprise.Apprise()
    ${adds}
    ok = app.notify(body='${bodyEsc}', title='${titleEsc}')
    print(json.dumps({'ok': True, 'sent': 1 if ok else 0, 'failed': 0 if ok else 1}))
except Exception as e:
    print(json.dumps({'ok': False, 'error': str(e)}))
    sys.exit(1)
PYEOF`;
  try {
    return JSON.parse(execSync(script, { timeout: 30000, encoding: 'utf-8' }));
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function run(input) {
  const v = validate(input);
  if (!v.valid) { return { "status": "error", errors: v.errors, adapter: ADAPTER_NAME, version: ADAPTER_VERSION }; }
  try {
    const raw = execute(input);
    if (!raw.ok) { return { "status": "error", error: raw.error, adapter: ADAPTER_NAME, version: ADAPTER_VERSION }; }
    return { "status": "ok", sent: raw.sent || 0, failed: raw.failed || 0, adapter: ADAPTER_NAME, version: ADAPTER_VERSION };
  } catch (err) {
    return { "status": "error", error: err.message, adapter: ADAPTER_NAME, version: ADAPTER_VERSION };
  }
}

module.exports = { run, validate, execute, ADAPTER_NAME, ADAPTER_VERSION };

if (require.main === module) {
  const input = JSON.parse(process.argv[2] || '{}');
  const result = run(input);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === 'ok' ? 0 : 1);
}
