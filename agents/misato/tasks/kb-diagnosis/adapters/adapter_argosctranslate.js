/**
 * NERV_IOC Adapter: argoscTranslate
 * IO_TYPE: text+src_lang+dst_lang→translated_text
 * Domain: 翻译
 *
 * Input:  { text: string, src_lang: string, dst_lang: string }
 * Output: { "status": "ok"|"error", translated_text?: string, error?: string, adapter: string, version: string }
 */

'use strict';

const { execSync } = require('child_process');

const ADAPTER_NAME = 'adapter_argosctranslate';
const ADAPTER_VERSION = '1.0.1';

function validate(input) {
  const errors = [];
  if (!input || typeof input !== 'object') { errors.push('INPUT_INVALID'); return { valid: false, errors }; }
  if (typeof input.text !== 'string' || !input.text.trim()) { errors.push('FIELD_REQUIRED: text'); }
  if (typeof input.src_lang !== 'string' || !input.src_lang.trim()) { errors.push('FIELD_REQUIRED: src_lang'); }
  if (typeof input.dst_lang !== 'string' || !input.dst_lang.trim()) { errors.push('FIELD_REQUIRED: dst_lang'); }
  return { valid: errors.length === 0, errors };
}

function execute(input) {
  const { text, src_lang, dst_lang } = input;
  const textEsc = text.replace(/'/g, "'").replace(/\n/g, '\\n');
  const script = `python3 - <<'PYEOF'
import sys
import json
try:
    import argostranslate
    installed = argostranslate.get_installed_languages()
    src = next((l for l in installed if l.code == '${src_lang}'), None)
    dst = next((l for l in installed if l.code == '${dst_lang}'), None)
    if not src or not dst:
        print(json.dumps({'ok': False, 'error': 'Language pair not installed'}))
        sys.exit(1)
    r = argostranslate.translate(src, dst, '${textEsc}')
    print(json.dumps({'ok': True, 'translated_text': r}))
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
    return { "status": "ok", translated_text: raw.translated_text || '', model: 'argoscTranslate', adapter: ADAPTER_NAME, version: ADAPTER_VERSION };
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
