/**
 * NERV_IOC Adapter: Feedparser
 * IO_TYPE: rss_url→parsed_items
 * Domain: 定时播报
 *
 * Input:  { feed_url: string, max_items?: number }
 * Output: { "status": "ok"|"error", items?: object[], feed_meta?: object, error?: string, adapter: string, version: string }
 */

'use strict';

const { execSync } = require('child_process');

const ADAPTER_NAME = 'adapter_feedparser';
const ADAPTER_VERSION = '1.0.1';

function validate(input) {
  const errors = [];
  if (!input || typeof input !== 'object') { errors.push('INPUT_INVALID'); return { valid: false, errors }; }
  if (typeof input.feed_url !== 'string' || !input.feed_url.trim()) { errors.push('FIELD_REQUIRED: feed_url'); }
  return { valid: errors.length === 0, errors };
}

function execute(input) {
  const { feed_url, max_items = 20 } = input;
  const urlEsc = feed_url.replace(/'/g, "'");
  const script = `python3 - <<'PYEOF'
import sys
import json
try:
    import feedparser
    f = feedparser.parse('${urlEsc}')
    items = [{'title': e.get('title',''), 'link': e.get('link',''), 'summary': e.get('summary','')} for e in f.entries[:${max_items}]]
    meta = {'title': f.feed.get('title',''), 'link': f.feed.get('link','')}
    print(json.dumps({'ok': True, 'items': items, 'feed_meta': meta}))
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
    return { "status": "ok", items: raw.items || [], feed_meta: raw.feed_meta || {}, adapter: ADAPTER_NAME, version: ADAPTER_VERSION };
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
