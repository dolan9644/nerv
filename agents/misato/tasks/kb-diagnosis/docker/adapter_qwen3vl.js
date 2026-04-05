/**
 * NERV_IOC Adapter: Qwen3-VL
 * IO_TYPE: image+text→text
 * Domain: 多模态
 *
 * Input:  { image_path: string, prompt: string, options?: object }
 * Output: { "status": "ok"|"error", text?: string, error?: string, adapter: string, version: string }
 */

'use strict';

const { execSync } = require('child_process');

const ADAPTER_NAME = 'adapter_qwen3vl';
const ADAPTER_VERSION = '1.0.1';

function validate(input) {
  const errors = [];
  if (!input || typeof input !== 'object') { errors.push('INPUT_INVALID'); return { valid: false, errors }; }
  if (typeof input.image_path !== 'string' || !input.image_path.trim()) { errors.push('FIELD_REQUIRED: image_path'); }
  if (typeof input.prompt !== 'string' || !input.prompt.trim()) { errors.push('FIELD_REQUIRED: prompt'); }
  return { valid: errors.length === 0, errors };
}

function execute(input) {
  const { image_path, prompt } = input;
  const imgEsc = image_path.replace(/'/g, "'");
  const promptEsc = prompt.replace(/'/g, "'");
  const script = `python3 - <<'PYEOF'
import sys
import json
try:
    from qwen_vl import Qwen2VL
    r = Qwen2VL().generate(image_path='${imgEsc}', prompt='${promptEsc}')
    print(json.dumps({'ok': True, 'text': str(r)}))
except Exception as e:
    print(json.dumps({'ok': False, 'error': str(e)}))
    sys.exit(1)
PYEOF`;
  try {
    return JSON.parse(execSync(script, { timeout: 60000, encoding: 'utf-8' }));
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
    return { "status": "ok", text: raw.text || '', model: 'Qwen3-VL', adapter: ADAPTER_NAME, version: ADAPTER_VERSION };
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
