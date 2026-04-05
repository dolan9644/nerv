/**
 * NERV_IOC Adapter: LibreTranslate
 * IO_TYPE: text+src_lang+dst_lang→translated_text
 * Domain: 翻译
 *
 * Input:  { text: string, src_lang: string, dst_lang: string, api_url?: string }
 * Output: { "status": "ok"|"error", translated_text?: string, detected_lang?: object, error?: string, adapter: string, version: string }
 */

'use strict';

const { execSync } = require('child_process');

const ADAPTER_NAME = 'adapter_libretranslate';
const ADAPTER_VERSION = '1.0.1';

const DEFAULT_API = 'http://localhost:5000/translate';

function validate(input) {
  const errors = [];
  if (!input || typeof input !== 'object') { errors.push('INPUT_INVALID'); return { valid: false, errors }; }
  if (typeof input.text !== 'string' || !input.text.trim()) { errors.push('FIELD_REQUIRED: text'); }
  if (typeof input.src_lang !== 'string' || !input.src_lang.trim()) { errors.push('FIELD_REQUIRED: src_lang'); }
  if (typeof input.dst_lang !== 'string' || !input.dst_lang.trim()) { errors.push('FIELD_REQUIRED: dst_lang'); }
  return { valid: errors.length === 0, errors };
}

function execute(input) {
  const { text, src_lang, dst_lang, api_url = DEFAULT_API } = input;
  const textEsc = text.replace(/'/g, "'").replace(/\n/g, '\\n');
  const apiEsc = api_url.replace(/'/g, "'");
  const script = `python3 - <<'PYEOF'
import sys
import json
try:
    import urllib.request
    url = '${apiEsc}'
    data = json.dumps({'q': '${textEsc}', 'source': '${src_lang}', 'target': '${dst_lang}', 'format': 'text'}).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as resp:
        r = json.loads(resp.read().decode('utf-8'))
        print(json.dumps({'ok': True, 'translated_text': r.get('translatedText',''), 'detected_lang': r.get('detectedLanguage', {})}))
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
    return { "status": "ok", translated_text: raw.translated_text || '', detected_lang: raw.detected_lang || null, model: 'LibreTranslate', adapter: ADAPTER_NAME, version: ADAPTER_VERSION };
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
