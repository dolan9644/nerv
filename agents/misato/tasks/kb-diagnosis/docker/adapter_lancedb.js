/**
 * NERV_IOC Adapter: LanceDB
 * IO_TYPE: embeddings→vector_search
 * Domain: 多模态
 *
 * Input:  { table_name: string, query_vector: number[], k?: number }
 * Output: { "status": "ok"|"error", results?: object[], error?: string, adapter: string, version: string }
 */

'use strict';

const { execSync } = require('child_process');

const ADAPTER_NAME = 'adapter_lancedb';
const ADAPTER_VERSION = '1.0.1';

function validate(input) {
  const errors = [];
  if (!input || typeof input !== 'object') { errors.push('INPUT_INVALID'); return { valid: false, errors }; }
  if (typeof input.table_name !== 'string' || !input.table_name.trim()) { errors.push('FIELD_REQUIRED: table_name'); }
  if (!input.query_vector && !input.query_text) { errors.push('FIELD_REQUIRED: query_vector or query_text'); }
  if (input.query_vector && !Array.isArray(input.query_vector)) { errors.push('FIELD_TYPE: query_vector must be array'); }
  return { valid: errors.length === 0, errors };
}

function execute(input) {
  const { table_name, query_vector, query_text, k = 10 } = input;
  const tblEsc = table_name.replace(/'/g, "'");
  let script;
  if (query_vector) {
    const vecStr = JSON.stringify(query_vector);
    script = `python3 - <<'PYEOF'
import sys
import json
try:
    import lancedb
    db = lancedb.connect('/tmp/lancedb')
    t = db.open_table('${tblEsc}')
    r = t.search(${vecStr}).limit(${k}).to_list()
    print(json.dumps({'ok': True, 'results': r}))
except Exception as e:
    print(json.dumps({'ok': False, 'error': str(e)}))
    sys.exit(1)
PYEOF`;
  } else {
    const txtEsc = query_text.replace(/'/g, "'");
    script = `python3 - <<'PYEOF'
import sys
import json
try:
    import lancedb
    db = lancedb.connect('/tmp/lancedb')
    t = db.open_table('${tblEsc}')
    r = t.search('${txtEsc}').limit(${k}).to_list()
    print(json.dumps({'ok': True, 'results': r}))
except Exception as e:
    print(json.dumps({'ok': False, 'error': str(e)}))
    sys.exit(1)
PYEOF`;
  }
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
    return { "status": "ok", results: raw.results || [], adapter: ADAPTER_NAME, version: ADAPTER_VERSION };
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
