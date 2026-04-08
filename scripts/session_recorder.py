#!/usr/bin/env python3
"""
███ NERV · Session Recorder · session_recorder.py ███

物理层 DAG 录入器 + 自动通知器。默认每 1 分钟由 Cron 触发。
扫描 Agent session log (.jsonl)，提取 NERV 协议事件，
自动写入 nerv.db + memory_queue/ + 触发 adam_notifier 通知造物主。

零 LLM 依赖。Agent 不需要做任何额外操作。

用法:
  python3 scripts/session_recorder.py           # 正常运行
  python3 scripts/session_recorder.py --dry-run  # 只扫描不写入
  python3 scripts/session_recorder.py --reset    # 重置 offset，全量扫描

提取的事件:
  - NODE_COMPLETED / NODE_FAILED（Agent → 上游编排者的回报）
  - DISPATCH（Misato → Agent 的任务分发）
  - DAG_COMPLETE（全 DAG 完成通知）
"""
import json
import os
import sys
import glob
import sqlite3
import shutil
import time
import subprocess
import fcntl
from pathlib import Path
from datetime import datetime
from nerv_paths import OPENCLAW_ROOT, NERV_ROOT, MEMORY_QUEUE_DIR, get_nerv_db_path

# ═══════════════════════════════════════════════════════════════
# 配置
# ═══════════════════════════════════════════════════════════════

NERV_ROOT = str(NERV_ROOT)
OPENCLAW_ROOT = str(OPENCLAW_ROOT)  # ~/.openclaw
DB_PATH = get_nerv_db_path()
WORKFLOW_REGISTRY_PATH = os.path.join(NERV_ROOT, 'docs', 'workflow-navigation-registry-v1.json')

# State file（记录每个 .jsonl 的已处理 offset）
STATE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.recorder_state.json')
LOCK_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.session_recorder.lock')

# Memory queue
MEMORY_QUEUE_DIR = str(MEMORY_QUEUE_DIR)

# 只扫描 NERV Agent 的 session
NERV_AGENT_PREFIX = 'nerv-'
OPENCLAW_BIN = os.environ.get('OPENCLAW_BIN') or shutil.which('openclaw') or '/opt/homebrew/bin/openclaw'
_WORKFLOW_REGISTRY_CACHE = None

# ═══════════════════════════════════════════════════════════════
# State 管理
# ═══════════════════════════════════════════════════════════════

def load_state():
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, encoding='utf-8') as f:
                return json.load(f)
        except:
            pass
    return {}

def save_state(state):
    with open(STATE_FILE, 'w', encoding='utf-8') as f:
        json.dump(state, f, indent=2)

def acquire_lock():
    fd = os.open(LOCK_FILE, os.O_CREAT | os.O_RDWR, 0o600)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        os.close(fd)
        return None

    os.ftruncate(fd, 0)
    os.write(fd, f"{os.getpid()}\n".encode('utf-8'))
    return fd

def release_lock(fd):
    if fd is None:
        return
    try:
        fcntl.flock(fd, fcntl.LOCK_UN)
    finally:
        os.close(fd)

# ═══════════════════════════════════════════════════════════════
# JSONL 解析
# ═══════════════════════════════════════════════════════════════

NERV_EVENTS = {'NODE_COMPLETED', 'NODE_FAILED', 'CIRCUIT_BROKEN', 'DAG_COMPLETE', 'DISPATCH', 'STRATEGIC_DISPATCH', 'TOOL_GAP'}
FAILURE_EVENTS = {'NODE_FAILED', 'NODE_OBSERVED_FAILED', 'CIRCUIT_BROKEN'}
SUCCESS_EVENTS = {'NODE_COMPLETED', 'NODE_OBSERVED_DONE'}
TERMINAL_NODE_STATUSES = {'DONE', 'FAILED', 'CIRCUIT_BROKEN', 'BLOCKED'}

def extract_event_json(text):
    """从消息文本中提取任意带 event 字段的 JSON"""
    if not isinstance(text, str):
        return None
    
    # 尝试直接作为 JSON 解析
    text = text.strip()
    # 去除时间戳前缀 "[Sun 2026-04-05 19:45 GMT+8] "
    if text.startswith('[') and 'GMT' in text[:50]:
        bracket_end = text.find(']')
        if bracket_end > 0:
            text = text[bracket_end + 1:].strip()
    
    try:
        data = json.loads(text)
        if isinstance(data, dict) and data.get('event'):
            return data
    except:
        pass
    
    # 尝试从文本中提取 JSON 块
    for start_marker in ['{']:
        idx = text.find(start_marker)
        if idx >= 0:
            try:
                data = json.loads(text[idx:])
                if isinstance(data, dict) and data.get('event'):
                    return data
            except:
                pass
    
    return None

def extract_nerv_event(text, allowed_events=None):
    """从消息文本中提取指定类型的 NERV 协议事件 JSON"""
    data = extract_event_json(text)
    if not data:
        return None
    if allowed_events is None:
        allowed_events = NERV_EVENTS
    if data.get('event') in allowed_events:
        return data
    return None

RUNTIME_ALERT_PATTERNS = [
    ('TOOL_PERMISSION_DENIED', ['没有权限', '权限不足', 'permission denied', 'requires approval', 'approval required']),
    ('TOOL_UNAVAILABLE', ['tool not available', 'tool unavailable', '缺乏工具支持', 'runtime lacks', 'unsupported tool', 'missing tool'])
]

def extract_runtime_alert(text):
    if not isinstance(text, str):
        return None
    normalized = text.strip()
    if not normalized:
        return None
    lowered = normalized.lower()
    for alert_type, patterns in RUNTIME_ALERT_PATTERNS:
        for pattern in patterns:
            if pattern.lower() in lowered:
                return {
                    'alert_type': alert_type,
                    'summary': normalized[:300]
                }
    return None

def extract_dispatch(content_list):
    """从 assistant 消息中提取 sessions_send 调度信息"""
    dispatches = []
    if not isinstance(content_list, list):
        return dispatches
    
    for item in content_list:
        if not isinstance(item, dict):
            continue
        if item.get('type') not in ('toolCall', 'tool_use'):
            continue
        if item.get('name') != 'sessions_send':
            continue
        
        args = item.get('arguments', item.get('input', {}))
        session_key = args.get('sessionKey', '')
        message = args.get('message', '')
        
        # 只关心发给 NERV Agent 的
        if f'agent:{NERV_AGENT_PREFIX}' not in session_key:
            continue
        
        # 提取目标 agent_id
        # sessionKey 格式:
        #   "agent:nerv-xxx:main"
        #   "agent:nerv-xxx:task:<task_id>"
        parts = session_key.split(':')
        if len(parts) >= 2:
            target_agent = parts[1]
        else:
            target_agent = session_key
        
        dispatch_event = extract_nerv_event(message, {'DISPATCH', 'STRATEGIC_DISPATCH'})
        task_id = dispatch_event.get('task_id', '') if dispatch_event else ''
        node_id = dispatch_event.get('node_id', '') if dispatch_event else ''
        dispatch_id = dispatch_event.get('dispatch_id', '') if dispatch_event else ''
        if not dispatch_id and item.get('id') and task_id and node_id:
            dispatch_id = f'{task_id}:{node_id}:{item.get("id")}'
        elif not dispatch_id:
            dispatch_id = item.get('id')

        dispatches.append({
            'target_agent': target_agent,
            'session_key': session_key,
            'message': message[:500] if isinstance(message, str) else str(message)[:500],
            'message_raw': message if isinstance(message, str) else str(message),
            'tool_call_id': item.get('id'),
            'timeout_seconds': args.get('timeoutSeconds'),
            'dispatch_id': dispatch_id
        })
    
    return dispatches

def scan_session_file(filepath, offset=0):
    """扫描单个 .jsonl 文件，返回提取的事件列表"""
    events = []
    stats = {
        'lines_read': 0,
        'json_errors': 0,
        'message_entries': 0
    }
    
    try:
        with open(filepath, 'rb') as f:
            f.seek(offset)
            new_offset = f.tell()
            
            while True:
                line = f.readline()
                if not line:
                    break

                new_offset = f.tell()
                stats['lines_read'] += 1
                line = line.decode('utf-8', errors='replace').strip()
                if not line:
                    continue
                
                try:
                    entry = json.loads(line)
                except:
                    stats['json_errors'] += 1
                    continue
                
                if entry.get('type') != 'message':
                    continue

                stats['message_entries'] += 1
                
                msg = entry.get('message', {})
                role = msg.get('role', '')
                content = msg.get('content', '')
                
                # 用户消息 = 可能包含 NODE_COMPLETED 等事件
                if role == 'user':
                    text = ''
                    if isinstance(content, str):
                        text = content
                    elif isinstance(content, list):
                        text = ' '.join(c.get('text', '') for c in content if isinstance(c, dict) and c.get('type') == 'text')
                    
                    event = extract_nerv_event(text)
                    if event:
                        events.append({
                            'type': 'nerv_event',
                            'event': event,
                            'file': os.path.basename(filepath)
                        })
                
                # Assistant 消息 = 可能包含 sessions_send 调度
                elif role == 'assistant':
                    text = ''
                    if isinstance(content, str):
                        text = content
                    elif isinstance(content, list):
                        text = ' '.join(c.get('text', '') for c in content if isinstance(c, dict) and c.get('type') == 'text')

                    runtime_alert = extract_runtime_alert(text)
                    if runtime_alert:
                        events.append({
                            'type': 'runtime_alert',
                            'alert': runtime_alert,
                            'file': os.path.basename(filepath)
                        })

                    if isinstance(content, list):
                        dispatches = extract_dispatch(content)
                        for d in dispatches:
                            events.append({
                                'type': 'dispatch',
                                'dispatch': d,
                                'file': os.path.basename(filepath)
                            })
            
            return events, new_offset, stats, None
    except Exception as e:
        return [], offset, stats, str(e)

# ═══════════════════════════════════════════════════════════════
# DB 写入
# ═══════════════════════════════════════════════════════════════

def ensure_db():
    """确保 DB 存在且表结构正确"""
    db_dir = os.path.dirname(DB_PATH)
    if not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)
    
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA journal_mode = WAL')
    conn.execute('PRAGMA busy_timeout = 5000')
    init_sql = os.path.join(NERV_ROOT, 'scripts', 'init_db.sql')
    if os.path.exists(init_sql):
        with open(init_sql, encoding='utf-8') as f:
            try:
                conn.executescript(f.read())
            except sqlite3.OperationalError as exc:
                if 'no such column' not in str(exc):
                    raise

    def ensure_column(table_name, column_name, column_def):
        cols = {row['name'] for row in conn.execute(f'PRAGMA table_info({table_name})').fetchall()}
        if column_name in cols:
            return
        conn.execute(f'ALTER TABLE {table_name} ADD COLUMN {column_name} {column_def}')

    ensure_column('tasks', 'orchestrator_agent_id', "TEXT DEFAULT 'nerv-misato'")
    ensure_column('tasks', 'orchestrator_session_key', 'TEXT')
    ensure_column('tasks', 'session_strategy', "TEXT DEFAULT 'main'")
    ensure_column('dag_nodes', 'session_key', 'TEXT')
    ensure_column('dag_nodes', 'session_scope', "TEXT DEFAULT 'main'")
    ensure_column('dag_nodes', 'last_dispatch_id', 'TEXT')
    ensure_column('dag_nodes', 'last_dispatch_at', 'INTEGER')

    return conn

def load_task_snapshot(conn, task_id, task_cache):
    if task_cache is None:
        task_cache = {}
    if task_id in task_cache:
        return task_cache[task_id]

    row = conn.execute(
        'SELECT task_id, intent, dag_json, status, orchestrator_agent_id, orchestrator_session_key, session_strategy FROM tasks WHERE task_id = ?',
        (task_id,)
    ).fetchone()

    snapshot = {
        'row': row,
        'dag': None,
        'nodes_by_id': {},
        'parse_error': None
    }

    if row and row['dag_json']:
        try:
            dag = json.loads(row['dag_json'])
            snapshot['dag'] = dag
            for node in dag.get('nodes', []):
                node_id = node.get('node_id')
                if node_id:
                    snapshot['nodes_by_id'][node_id] = node
        except Exception as exc:
            snapshot['parse_error'] = str(exc)

    task_cache[task_id] = snapshot
    return snapshot

def resolve_latest_dispatch_id(conn, task_id, node_id):
    """从最近的 RECORDED_DISPATCH 审计中回溯 dispatch_id。"""
    if not task_id or not node_id:
        return None

    rows = conn.execute(
        '''
        SELECT detail
        FROM audit_logs
        WHERE task_id = ?
          AND node_id = ?
          AND action = 'RECORDED_DISPATCH'
        ORDER BY id DESC
        LIMIT 5
        ''',
        (task_id, node_id)
    ).fetchall()

    for row in rows:
        try:
            detail = json.loads(row['detail'] or '{}')
        except Exception:
            continue
        dispatch_id = detail.get('dispatch_id')
        if dispatch_id:
            return dispatch_id

    return None

def infer_task_session_key(agent_id, task_id):
    if not agent_id or not task_id:
        return None
    return f'agent:{agent_id}:task:{task_id}'

def infer_session_scope(session_key, task_id):
    if not session_key:
        return None
    if task_id and f':task:{task_id}' in session_key:
        return 'task'
    return 'main'

def upsert_task_session_binding(conn, task_id, agent_id, session_key, session_scope, node_id=None, now=None):
    if not task_id or not agent_id or not session_key or not session_scope:
        return
    now = int(now or time.time())
    normalized_node_id = node_id or ''
    conn.execute(
        '''
        INSERT INTO task_session_bindings (task_id, agent_id, node_id, session_key, session_scope, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(task_id, agent_id, node_id, session_scope) DO UPDATE SET
          session_key = excluded.session_key,
          updated_at = excluded.updated_at
        ''',
        (task_id, agent_id, normalized_node_id, session_key, session_scope, now, now)
    )

def ensure_agent_row(conn, agent_id, now=None):
    if not agent_id or not isinstance(agent_id, str) or not agent_id.startswith('nerv-'):
        return False

    now = int(now or time.time())
    row = conn.execute(
        'SELECT agent_id FROM agents WHERE agent_id = ?',
        (agent_id,)
    ).fetchone()
    if not row:
        conn.execute(
            'INSERT OR IGNORE INTO agents (agent_id, status, current_task_id, last_heartbeat, registered_at) VALUES (?, ?, ?, ?, ?)',
            (agent_id, 'IDLE', None, now, now)
        )
    return True

def touch_agent_heartbeat(conn, agent_id, now=None):
    if not ensure_agent_row(conn, agent_id, now):
        return

    now = int(now or time.time())
    conn.execute(
        'UPDATE agents SET last_heartbeat = ? WHERE agent_id = ?',
        (now, agent_id)
    )

def set_agent_runtime(conn, agent_id, status, current_task_id=None, now=None):
    if not ensure_agent_row(conn, agent_id, now):
        return

    now = int(now or time.time())
    conn.execute(
        'UPDATE agents SET status = ?, current_task_id = ?, last_heartbeat = ? WHERE agent_id = ?',
        (status, current_task_id, now, agent_id)
    )

def block_downstream_nodes(conn, task_id, node_id, now=None):
    if not task_id or not node_id:
        return 0

    now = int(now or time.time())
    downstream = conn.execute(
        '''
        WITH RECURSIVE downstream_nodes(nid) AS (
          SELECT to_node FROM dag_edges WHERE from_node = ? AND task_id = ?
          UNION
          SELECT e.to_node
          FROM dag_edges e
          JOIN downstream_nodes dn ON e.from_node = dn.nid
          WHERE e.task_id = ?
        )
        SELECT nid FROM downstream_nodes
        ''',
        (node_id, task_id, task_id)
    ).fetchall()

    for row in downstream:
        conn.execute(
            'UPDATE dag_nodes SET status = "BLOCKED", updated_at = ? WHERE task_id = ? AND node_id = ? AND status = "PENDING"',
            (now, task_id, row['nid'])
        )

    return len(downstream)

def normalize_contract_path(path_value):
    if not path_value or not isinstance(path_value, str):
        return None
    expanded = os.path.expanduser(path_value.strip())
    if not expanded:
        return None
    if os.path.isabs(expanded):
        return os.path.abspath(expanded)
    return os.path.abspath(os.path.join(NERV_ROOT, expanded))

def collect_event_artifact_paths(event):
    seen = set()
    paths = []

    def add(value):
        if value is None:
            return
        if isinstance(value, str):
            value = value.strip()
            if value and value not in seen:
                seen.add(value)
                paths.append(value)
            return
        if isinstance(value, list):
            for item in value:
                add(item)
            return
        if isinstance(value, dict):
            for key in ('path', 'artifact_path', 'result_path', 'file', 'file_path', 'output_path', 'url'):
                if key in value:
                    add(value.get(key))

    add(event.get('outputs', []))
    add(event.get('artifacts', []))
    add(event.get('result_path'))
    add(event.get('artifact_path'))
    return paths

def resolve_contract_roots(contract):
    roots = []
    dispatch = contract.get('dispatch_contract', {}) if isinstance(contract, dict) else {}
    observation = contract.get('observation_contract', {}) if isinstance(contract, dict) else {}

    for key in (
        dispatch.get('output_dir'),
        observation.get('artifact_root')
    ):
        normalized = normalize_contract_path(key)
        if normalized and normalized not in roots:
            roots.append(normalized)
    return roots

def match_required_artifacts(required_artifacts, event_paths, roots):
    matched = []
    missing = []

    for artifact in required_artifacts or []:
        found = None

        for path_value in event_paths:
            if path_value == artifact or os.path.basename(path_value) == artifact:
                found = path_value
                break

        if not found:
            for root in roots:
                candidate = artifact if os.path.isabs(artifact) else os.path.join(root, artifact)
                candidate = os.path.abspath(candidate)
                if os.path.exists(candidate):
                    found = candidate
                    break

        if found:
            matched.append(found)
        else:
            missing.append(artifact)

    return matched, missing

def resolve_result_path(event, contract, matched_required, matched_optional, event_paths):
    completion = contract.get('completion_contract', {}) if isinstance(contract, dict) else {}
    selector = completion.get('result_path_from')

    if selector == 'explicit_event_field':
        explicit = event.get('result_path') or event.get('artifact_path')
        if isinstance(explicit, str) and explicit.strip():
            return explicit.strip()
    elif selector == 'first_required_artifact' and matched_required:
        return matched_required[0]
    elif selector == 'first_optional_artifact' and matched_optional:
        return matched_optional[0]

    if len(event_paths) == 1:
        return event_paths[0]
    if len(event_paths) > 1:
        return json.dumps(event_paths, ensure_ascii=False)
    return None

def evaluate_event_contract(conn, event, task_cache):
    task_id = event.get('task_id', '')
    node_id = event.get('node_id', '')
    event_type = event.get('event', '')
    event_paths = collect_event_artifact_paths(event)

    result = {
        'accepted': True,
        'mode': 'legacy',
        'reason': None,
        'result_path': json.dumps(event_paths, ensure_ascii=False) if len(event_paths) > 1 else (event_paths[0] if len(event_paths) == 1 else None),
        'matched_artifacts': [],
        'missing_artifacts': [],
        'event_paths': event_paths,
        'node_def': None,
        'task_found': False
    }

    if not task_id or not node_id:
        return result

    snapshot = load_task_snapshot(conn, task_id, task_cache)
    result['task_found'] = snapshot.get('row') is not None
    node_def = snapshot.get('nodes_by_id', {}).get(node_id)
    result['node_def'] = node_def

    if not node_def:
        return result

    contract = node_def.get('contract')
    if not isinstance(contract, dict):
        return result

    completion = contract.get('completion_contract', {})
    mode = completion.get('mode', 'event_only')
    result['mode'] = mode

    if mode == 'approval_only':
        result['accepted'] = False
        result['reason'] = 'approval_only_not_supported_by_recorder'
        return result

    accepted_events = completion.get('accepted_events', []) or []
    event_ok = event_type in accepted_events if accepted_events else False

    node_row = conn.execute(
        'SELECT task_id FROM dag_nodes WHERE node_id = ?',
        (node_id,)
    ).fetchone()

    if completion.get('require_task_id_match', True) and node_row and node_row['task_id'] != task_id:
        result['accepted'] = False
        result['reason'] = f'task_id_mismatch:{node_row["task_id"]}'
        return result

    if completion.get('require_node_id_match', True) and not node_def:
        result['accepted'] = False
        result['reason'] = 'node_id_missing_in_dag'
        return result

    roots = resolve_contract_roots(contract)
    matched_required, missing_required = match_required_artifacts(
        completion.get('required_artifacts', []),
        event_paths,
        roots
    )
    matched_optional, _ = match_required_artifacts(
        completion.get('optional_artifacts', []),
        event_paths,
        roots
    )

    result['matched_artifacts'] = matched_required + matched_optional
    result['missing_artifacts'] = missing_required
    result['result_path'] = resolve_result_path(event, contract, matched_required, matched_optional, event_paths)

    artifact_ok = len(missing_required) == 0
    is_failure_event = event_type in FAILURE_EVENTS

    if mode == 'event_only':
        result['accepted'] = event_ok
    elif mode == 'artifact_only':
        result['accepted'] = artifact_ok
    elif mode == 'event_and_artifact':
        result['accepted'] = event_ok and (True if is_failure_event else artifact_ok)
    elif mode == 'event_or_artifact':
        result['accepted'] = event_ok or artifact_ok
    else:
        result['accepted'] = event_ok

    if not result['accepted']:
        if not event_ok and mode in ('event_only', 'event_and_artifact', 'event_or_artifact'):
            result['reason'] = f'event_not_allowed:{event_type}'
        elif not artifact_ok:
            result['reason'] = f'missing_artifacts:{",".join(missing_required)}'
        else:
            result['reason'] = f'contract_mode_rejected:{mode}'

    return result

def record_nerv_event(conn, event_data, task_cache=None):
    """将 NERV 协议事件写入 nerv.db"""
    event = event_data.get('event', {})
    event_type = event.get('event', '')
    task_id = event.get('task_id', '')
    node_id = event.get('node_id', '')
    source = event.get('source', '')
    dispatch_id = event.get('dispatch_id')
    dispatch_id_source = 'event' if dispatch_id else None
    
    if not task_id:
        return {'ok': False, 'reason': 'missing_task_id'}

    now = int(time.time())
    touch_agent_heartbeat(conn, source, now)

    contract_eval = evaluate_event_contract(conn, event, task_cache)
    if not contract_eval['accepted']:
        return {
            'ok': False,
            'reason': 'contract_rejected',
            'contract': contract_eval
        }

    if not dispatch_id and node_id:
        dispatch_id = resolve_latest_dispatch_id(conn, task_id, node_id)
        if dispatch_id:
            dispatch_id_source = 'dispatch_audit_fallback'
    
    # 1. 确保 task 存在
    existing = conn.execute('SELECT task_id FROM tasks WHERE task_id = ?', (task_id,)).fetchone()
    if not existing:
        conn.execute(
            '''
            INSERT OR IGNORE INTO tasks (task_id, initiator_id, intent, status, orchestrator_agent_id, orchestrator_session_key, session_strategy, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            (
                task_id,
                source or 'unknown',
                f'[auto-recorded] {task_id}',
                'RUNNING',
                'nerv-misato',
                infer_task_session_key('nerv-misato', task_id),
                'task_scoped',
                now,
                now
            )
        )
    
    # 2. 确保 node 存在并更新状态
    if node_id:
        existing_node = conn.execute(
            'SELECT node_id, task_id FROM dag_nodes WHERE node_id = ?',
            (node_id,)
        ).fetchone()
        
        if event_type == 'NODE_COMPLETED':
            status = 'DONE'
            result_path = contract_eval.get('result_path')
            set_agent_runtime(conn, source, 'IDLE', None, now)
        elif event_type in ('NODE_FAILED', 'TOOL_GAP'):
            status = 'FAILED'
            result_path = contract_eval.get('result_path')
            set_agent_runtime(conn, source, 'ERROR', None, now)
        elif event_type == 'CIRCUIT_BROKEN':
            status = 'CIRCUIT_BROKEN'
            result_path = contract_eval.get('result_path')
            set_agent_runtime(conn, source, 'ERROR', None, now)
        else:
            status = 'RUNNING'
            result_path = None
        
        if existing_node:
            if existing_node['task_id'] != task_id:
                return {
                    'ok': False,
                    'reason': 'node_task_mismatch',
                    'contract': contract_eval
                }
            conn.execute(
                'UPDATE dag_nodes SET status = ?, result_path = ?, completed_at = ?, updated_at = ? WHERE node_id = ? AND task_id = ?',
                (status, result_path, now, now, node_id, task_id)
            )
        else:
            node_def = contract_eval.get('node_def') or {}
            desc = node_def.get('description') or event.get('note', event.get('description', f'[auto-recorded] {node_id}'))
            max_retries = node_def.get('max_retries') or node_def.get('contract', {}).get('runtime_contract', {}).get('max_retries') or 3
            session_key = node_def.get('session_key') or infer_task_session_key(source, task_id)
            session_scope = infer_session_scope(session_key, task_id) if session_key else 'main'
            conn.execute(
                '''
                INSERT OR IGNORE INTO dag_nodes
                  (node_id, task_id, agent_id, description, status, result_path, completed_at, updated_at, max_retries, session_key, session_scope)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''',
                (node_id, task_id, source, desc[:200], status, result_path, now, now, max_retries, session_key, session_scope)
            )
            if session_key:
                upsert_task_session_binding(conn, task_id, source, session_key, 'worker', node_id, now)

        if event_type in ('NODE_FAILED', 'TOOL_GAP', 'CIRCUIT_BROKEN'):
            blocked_count = block_downstream_nodes(conn, task_id, node_id, now)
            if blocked_count > 0:
                conn.execute(
                    'INSERT INTO audit_logs (task_id, node_id, agent_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                    (
                        task_id,
                        node_id,
                        'session_recorder',
                        'BLOCK_DOWNSTREAM',
                        json.dumps({'blocked_count': blocked_count}, ensure_ascii=False)[:500],
                        now
                    )
                )
    
    # 3. 检查 task 是否全部完成
    if event_type in ('NODE_COMPLETED', 'NODE_FAILED', 'CIRCUIT_BROKEN', 'TOOL_GAP', 'DAG_COMPLETE'):
        recompute_task_status(conn, task_id, now)
    
    # 4. 写审计日志
    audit_detail = {
        'event': event_type,
        'dispatch_id': dispatch_id,
        'dispatch_id_source': dispatch_id_source,
        'source_file': event_data.get('file'),
        'source_agent': source,
        'result_path': contract_eval.get('result_path'),
        'matched_artifacts': contract_eval.get('matched_artifacts', []),
        'missing_artifacts': contract_eval.get('missing_artifacts', []),
        'mode': contract_eval.get('mode', 'legacy')
    }
    conn.execute(
        'INSERT INTO audit_logs (task_id, node_id, agent_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        (task_id, node_id, source, f'RECORDED_{event_type}', json.dumps(audit_detail, ensure_ascii=False)[:500], now)
    )
    
    conn.commit()
    return {
        'ok': True,
        'reason': 'recorded',
        'contract': contract_eval
    }

def record_runtime_alert(conn, alert_data):
    alert = alert_data.get('alert', {})
    if not alert:
        return {'ok': False, 'reason': 'empty_alert'}

    now = int(time.time())
    conn.execute(
        'INSERT INTO audit_logs (task_id, node_id, agent_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        (
            None,
            None,
            'session_recorder',
            'RUNTIME_ALERT',
            json.dumps({
                'alert_type': alert.get('alert_type'),
                'summary': alert.get('summary'),
                'source_file': alert_data.get('file')
            }, ensure_ascii=False)[:500],
            now
        )
    )
    conn.commit()
    return {'ok': True, 'reason': 'recorded'}

def record_dispatch(conn, dispatch_data, task_cache=None):
    """记录 Misato 的调度行为"""
    d = dispatch_data.get('dispatch', {})
    target = d.get('target_agent', '')
    message_text = d.get('message_raw', d.get('message', ''))
    
    # 尝试从消息中提取 task_id 和 node_id
    event = extract_nerv_event(message_text, {'DISPATCH', 'STRATEGIC_DISPATCH'})
    if not event:
        return {'ok': False, 'reason': 'dispatch_payload_unrecognized'}
    
    task_id = event.get('task_id', '')
    node_id = event.get('node_id', '')
    dispatch_id = event.get('dispatch_id') or d.get('dispatch_id') or d.get('tool_call_id')
    
    if not task_id:
        return {'ok': False, 'reason': 'missing_task_id'}
    
    now = int(time.time())
    if not dispatch_id:
        dispatch_id = f'{task_id}:{node_id or "root"}:{now}'
    dispatch_id_source = 'event' if event.get('dispatch_id') else ('dispatch_wrapper' if d.get('dispatch_id') else ('tool_call_id' if d.get('tool_call_id') else 'synthetic'))
    snapshot = load_task_snapshot(conn, task_id, task_cache)
    node_def = snapshot.get('nodes_by_id', {}).get(node_id, {}) if node_id else {}
    existing_node = None
    target_session_key = d.get('session_key') or node_def.get('session_key')
    target_session_scope = infer_session_scope(target_session_key, task_id) if target_session_key else None
    task_row = snapshot.get('row')
    orchestrator_session_key = (
        task_row['orchestrator_session_key']
        if task_row is not None and 'orchestrator_session_key' in task_row.keys() else None
    ) or infer_task_session_key('nerv-misato', task_id)
    session_strategy = 'task_scoped' if orchestrator_session_key and f':task:{task_id}' in orchestrator_session_key else 'main'

    touch_agent_heartbeat(conn, 'nerv-misato', now)
    
    # 确保 task 存在
    existing = conn.execute('SELECT task_id, status FROM tasks WHERE task_id = ?', (task_id,)).fetchone()
    if not existing:
        intent = event.get('intent', event.get('description', f'[auto-recorded] {task_id}'))
        conn.execute(
            '''
            INSERT OR IGNORE INTO tasks (task_id, initiator_id, intent, status, orchestrator_agent_id, orchestrator_session_key, session_strategy, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            (task_id, 'nerv-misato', intent[:200], 'RUNNING', 'nerv-misato', orchestrator_session_key, session_strategy, now, now)
        )
    elif existing['status'] == 'PENDING':
        conn.execute('UPDATE tasks SET status = "RUNNING", updated_at = ? WHERE task_id = ?', (now, task_id))
    conn.execute(
        '''
        UPDATE tasks
        SET orchestrator_agent_id = COALESCE(orchestrator_agent_id, 'nerv-misato'),
            orchestrator_session_key = COALESCE(orchestrator_session_key, ?),
            session_strategy = CASE
              WHEN session_strategy IS NULL OR session_strategy = '' THEN ?
              ELSE session_strategy
            END,
            updated_at = ?
        WHERE task_id = ?
        ''',
        (orchestrator_session_key, session_strategy, now, task_id)
    )
    upsert_task_session_binding(conn, task_id, 'nerv-misato', orchestrator_session_key, 'orchestrator', None, now)
    
    # 创建 node（如 dispatch 中有 node_id）
    if node_id:
        desc = node_def.get('description') or event.get('description', event.get('note', f'dispatched to {target}'))
        max_retries = node_def.get('max_retries') or node_def.get('contract', {}).get('runtime_contract', {}).get('max_retries') or 3
        existing_node = conn.execute(
            'SELECT node_id, status FROM dag_nodes WHERE node_id = ? AND task_id = ?',
            (node_id, task_id)
        ).fetchone()
        if existing_node:
            if existing_node['status'] != 'DONE':
                conn.execute(
                    '''
                    UPDATE dag_nodes
                    SET status = ?,
                        started_at = COALESCE(started_at, ?),
                        session_key = COALESCE(?, session_key),
                        session_scope = COALESCE(?, session_scope),
                        last_dispatch_id = ?,
                        last_dispatch_at = ?,
                        updated_at = ?
                    WHERE node_id = ? AND task_id = ?
                    ''',
                    ('RUNNING', now, target_session_key, target_session_scope, dispatch_id, now, now, node_id, task_id)
                )
        else:
            conn.execute(
                '''
                INSERT OR IGNORE INTO dag_nodes
                  (node_id, task_id, agent_id, description, status, started_at, updated_at, max_retries, session_key, session_scope, last_dispatch_id, last_dispatch_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''',
                (node_id, task_id, target, desc[:200], 'RUNNING', now, now, max_retries, target_session_key, target_session_scope or 'main', dispatch_id, now)
            )

        if target_session_key:
            upsert_task_session_binding(conn, task_id, target, target_session_key, 'worker', node_id, now)

    if target and not (existing_node and existing_node['status'] == 'DONE'):
        set_agent_runtime(conn, target, 'RUNNING', task_id, now)
    
    # 审计日志
    dispatch_detail = {
        'dispatch_id': dispatch_id,
        'dispatch_id_source': dispatch_id_source,
        'target_agent': target,
        'session_key': target_session_key,
        'session_scope': target_session_scope,
        'orchestrator_session_key': orchestrator_session_key,
        'session_strategy': session_strategy,
        'tool_call_id': d.get('tool_call_id'),
        'timeout_seconds': d.get('timeout_seconds'),
        'message_excerpt': d.get('message', '')
    }
    conn.execute(
        'INSERT INTO audit_logs (task_id, node_id, agent_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        (task_id, node_id, 'nerv-misato', 'RECORDED_DISPATCH', json.dumps(dispatch_detail, ensure_ascii=False)[:500], now)
    )
    
    conn.commit()
    return {'ok': True, 'reason': 'recorded'}

def recompute_task_status(conn, task_id, now=None):
    if not task_id:
        return

    now = int(now or time.time())
    result = conn.execute(
        '''
        SELECT COUNT(*) as total,
               SUM(CASE WHEN status = "DONE" THEN 1 ELSE 0 END) as done,
               SUM(CASE WHEN status IN ("FAILED", "CIRCUIT_BROKEN", "BLOCKED") THEN 1 ELSE 0 END) as failed,
               SUM(CASE WHEN status IN ("DONE", "FAILED", "CIRCUIT_BROKEN", "BLOCKED") THEN 1 ELSE 0 END) as terminal
        FROM dag_nodes WHERE task_id = ?
        ''',
        (task_id,)
    ).fetchone()

    if not result or result['total'] == 0:
        return

    if result['done'] == result['total']:
        conn.execute('UPDATE tasks SET status = "DONE", updated_at = ? WHERE task_id = ?', (now, task_id))
    elif result['failed'] > 0 and result['terminal'] == result['total']:
        conn.execute('UPDATE tasks SET status = "FAILED", updated_at = ? WHERE task_id = ?', (now, task_id))
    else:
        conn.execute('UPDATE tasks SET status = "RUNNING", updated_at = ? WHERE task_id = ?', (now, task_id))

def reconcile_terminal_audit_states(conn):
    now = int(time.time())
    rows = conn.execute(
        '''
        SELECT id, task_id, node_id, action, detail, created_at
        FROM audit_logs
        WHERE action IN ('RECORDED_NODE_COMPLETED', 'RECORDED_NODE_FAILED')
        ORDER BY id DESC
        '''
    ).fetchall()

    latest = {}
    for row in rows:
        key = (row['task_id'], row['node_id'])
        if key not in latest:
            latest[key] = row

    touched_tasks = set()
    for (task_id, node_id), row in latest.items():
        node = conn.execute(
            'SELECT status, result_path, completed_at FROM dag_nodes WHERE task_id = ? AND node_id = ?',
            (task_id, node_id)
        ).fetchone()
        if not node:
            continue

        desired_status = 'DONE' if row['action'] == 'RECORDED_NODE_COMPLETED' else 'FAILED'
        detail = {}
        try:
            detail = json.loads(row['detail'] or '{}')
        except Exception:
            detail = {}
        desired_result_path = detail.get('result_path')

        needs_status_fix = node['status'] != desired_status
        needs_result_fix = desired_result_path and node['result_path'] != desired_result_path

        if not needs_status_fix and not needs_result_fix:
            continue

        conn.execute(
            '''
            UPDATE dag_nodes
            SET status = ?,
                result_path = COALESCE(?, result_path),
                completed_at = COALESCE(completed_at, ?),
                updated_at = ?
            WHERE task_id = ? AND node_id = ?
            ''',
            (
                desired_status,
                desired_result_path,
                row['created_at'] or now,
                now,
                task_id,
                node_id
            )
        )
        if desired_status == 'FAILED':
            block_downstream_nodes(conn, task_id, node_id, now)
        touched_tasks.add(task_id)

    for task_id in touched_tasks:
        recompute_task_status(conn, task_id, now)

def reconcile_failed_downstream_blocks(conn):
    now = int(time.time())
    failed_nodes = conn.execute(
        '''
        SELECT task_id, node_id
        FROM dag_nodes
        WHERE status IN ("FAILED", "CIRCUIT_BROKEN")
        '''
    ).fetchall()

    touched_tasks = set()
    for row in failed_nodes:
        blocked_count = block_downstream_nodes(conn, row['task_id'], row['node_id'], now)
        if blocked_count > 0:
            touched_tasks.add(row['task_id'])

    for task_id in touched_tasks:
        recompute_task_status(conn, task_id, now)

    if touched_tasks:
        conn.commit()

def reconcile_dispatch_audit_states(conn):
    now = int(time.time())
    rows = conn.execute(
        '''
        SELECT id, task_id, node_id, detail, created_at
        FROM audit_logs
        WHERE action = 'RECORDED_DISPATCH'
        ORDER BY id DESC
        '''
    ).fetchall()

    latest = {}
    for row in rows:
        key = (row['task_id'], row['node_id'])
        if key not in latest:
            latest[key] = row

    for (task_id, node_id), row in latest.items():
        if not task_id or not node_id:
            continue

        try:
            detail = json.loads(row['detail'] or '{}')
        except Exception:
            detail = {}

        dispatch_id = detail.get('dispatch_id')
        session_key = detail.get('session_key')
        session_scope = detail.get('session_scope')
        if not session_scope and session_key:
            session_scope = infer_session_scope(session_key, task_id) or 'main'

        node = conn.execute(
            '''
            SELECT status, session_key, session_scope, last_dispatch_id, last_dispatch_at, agent_id
            FROM dag_nodes
            WHERE task_id = ? AND node_id = ?
            ''',
            (task_id, node_id)
        ).fetchone()
        if not node:
            continue

        status = node['status']
        should_update = (
            (dispatch_id and node['last_dispatch_id'] != dispatch_id) or
            (row['created_at'] and node['last_dispatch_at'] != row['created_at']) or
            (session_key and node['session_key'] != session_key) or
            (session_scope and node['session_scope'] != session_scope) or
            (status == 'PENDING')
        )
        if not should_update:
            continue

        next_status = status if status not in ('PENDING',) else 'RUNNING'
        conn.execute(
            '''
            UPDATE dag_nodes
            SET status = ?,
                session_key = COALESCE(?, session_key),
                session_scope = COALESCE(?, session_scope),
                last_dispatch_id = COALESCE(?, last_dispatch_id),
                last_dispatch_at = COALESCE(?, last_dispatch_at),
                started_at = COALESCE(started_at, ?),
                updated_at = ?
            WHERE task_id = ? AND node_id = ?
            ''',
            (
                next_status,
                session_key,
                session_scope,
                dispatch_id,
                row['created_at'],
                row['created_at'] or now,
                now,
                task_id,
                node_id
            )
        )

        if session_key and node['agent_id']:
            upsert_task_session_binding(conn, task_id, node['agent_id'], session_key, 'worker', node_id, now)

        orchestrator_session_key = detail.get('orchestrator_session_key')
        if orchestrator_session_key:
            conn.execute(
                '''
                UPDATE tasks
                SET orchestrator_session_key = COALESCE(orchestrator_session_key, ?),
                    session_strategy = CASE
                      WHEN session_strategy IS NULL OR session_strategy = '' THEN ?
                      ELSE session_strategy
                    END,
                    updated_at = ?
                WHERE task_id = ?
                ''',
                (
                    orchestrator_session_key,
                    'task_scoped' if f':task:{task_id}' in orchestrator_session_key else 'main',
                    now,
                    task_id
                )
            )
            upsert_task_session_binding(conn, task_id, 'nerv-misato', orchestrator_session_key, 'orchestrator', None, now)

    conn.commit()

def reconcile_task_rollups(conn):
    now = int(time.time())
    task_rows = conn.execute(
        '''
        SELECT DISTINCT task_id
        FROM dag_nodes
        WHERE task_id IS NOT NULL AND task_id != ''
        '''
    ).fetchall()

    for row in task_rows:
        recompute_task_status(conn, row['task_id'], now)

    conn.commit()

# ═══════════════════════════════════════════════════════════════
# 自动通知（Adam Notifier）
# ═══════════════════════════════════════════════════════════════

ADAM_NOTIFIER = os.path.join(NERV_ROOT, 'scripts', 'adam_notifier.py')
NOTIFY_STATE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.notified_events.json')

def load_notified():
    """加载已通知的事件 ID 集合（防止重复通知）"""
    if os.path.exists(NOTIFY_STATE_FILE):
        try:
            with open(NOTIFY_STATE_FILE, encoding='utf-8') as f:
                return set(json.load(f))
        except:
            pass
    return set()

def save_notified(notified_set):
    # 只保留最近 500 条，防止无限增长
    recent = list(notified_set)[-500:]
    with open(NOTIFY_STATE_FILE, 'w', encoding='utf-8') as f:
        json.dump(recent, f)

def get_task_runtime_summary(conn, task_id):
    if conn is None or not task_id:
        return None

    task_row = conn.execute(
        'SELECT status FROM tasks WHERE task_id = ?',
        (task_id,)
    ).fetchone()
    counts = conn.execute(
        '''
        SELECT COUNT(*) as total,
               SUM(CASE WHEN status = "DONE" THEN 1 ELSE 0 END) as done,
               SUM(CASE WHEN status IN ("FAILED", "CIRCUIT_BROKEN", "BLOCKED") THEN 1 ELSE 0 END) as failed,
               SUM(CASE WHEN status IN ("DONE", "FAILED", "CIRCUIT_BROKEN", "BLOCKED") THEN 1 ELSE 0 END) as terminal
        FROM dag_nodes
        WHERE task_id = ?
        ''',
        (task_id,)
    ).fetchone()

    return {
        'status': task_row['status'] if task_row else None,
        'total': counts['total'] if counts else 0,
        'done': counts['done'] if counts else 0,
        'failed': counts['failed'] if counts else 0,
        'terminal': counts['terminal'] if counts else 0
    }

def load_workflow_registry():
    global _WORKFLOW_REGISTRY_CACHE
    if _WORKFLOW_REGISTRY_CACHE is not None:
        return _WORKFLOW_REGISTRY_CACHE
    if not os.path.exists(WORKFLOW_REGISTRY_PATH):
        _WORKFLOW_REGISTRY_CACHE = {}
        return _WORKFLOW_REGISTRY_CACHE
    try:
        with open(WORKFLOW_REGISTRY_PATH, encoding='utf-8') as f:
            payload = json.load(f)
        workflows = payload.get('workflows', []) if isinstance(payload, dict) else []
        _WORKFLOW_REGISTRY_CACHE = {
            item.get('workflow_id'): item
            for item in workflows
            if isinstance(item, dict) and item.get('workflow_id')
        }
    except Exception:
        _WORKFLOW_REGISTRY_CACHE = {}
    return _WORKFLOW_REGISTRY_CACHE

def get_task_quality_gate(conn, task_id):
    if conn is None or not task_id:
        return None
    row = conn.execute(
        'SELECT workflow_id, workflow_cn_name FROM tasks WHERE task_id = ?',
        (task_id,)
    ).fetchone()
    if not row:
        return None
    workflow_id = row['workflow_id'] if 'workflow_id' in row.keys() else None
    if not workflow_id:
        return None
    workflow = load_workflow_registry().get(workflow_id)
    if not workflow:
        return None
    script = workflow.get('quality_gate_script')
    if not script:
        return None
    absolute_script = os.path.join(NERV_ROOT, script)
    if not os.path.exists(absolute_script):
        return None
    return {
        'workflow_id': workflow_id,
        'workflow_cn_name': row['workflow_cn_name'] if 'workflow_cn_name' in row.keys() and row['workflow_cn_name'] else workflow.get('cn_name') or workflow_id,
        'script': absolute_script
    }

def get_quality_gate_nodes(conn, task_id):
    if conn is None or not task_id:
        return []
    snapshot = load_task_snapshot(conn, task_id, {})
    dag = snapshot.get('dag') or {}
    nodes = []
    for node_def in dag.get('nodes', []) or []:
        if not isinstance(node_def, dict):
            continue
        constraints = (((node_def.get('contract') or {}).get('dispatch_contract') or {}).get('constraints') or {})
        if not constraints.get('quality_gate'):
            continue
        node_id = node_def.get('node_id')
        if not node_id:
            continue
        row = conn.execute(
            'SELECT status, result_path, error_log, completed_at FROM dag_nodes WHERE task_id = ? AND node_id = ?',
            (task_id, node_id)
        ).fetchone()
        nodes.append({
            'node_id': node_id,
            'status': row['status'] if row and 'status' in row.keys() else None,
            'result_path': row['result_path'] if row and 'result_path' in row.keys() else None,
            'error_log': row['error_log'] if row and 'error_log' in row.keys() else None,
            'completed_at': row['completed_at'] if row and 'completed_at' in row.keys() else None,
            'node_def': node_def
        })
    return nodes

def task_terminal_notification_exists(conn, task_id):
    if conn is None or not task_id:
        return False
    row = conn.execute(
        """
        SELECT 1
        FROM audit_logs
        WHERE task_id = ? AND action = 'TASK_TERMINAL_NOTIFIED'
        LIMIT 1
        """,
        (task_id,)
    ).fetchone()
    return bool(row)

def record_task_terminal_notification(conn, task_id, node_id, event_type, msg):
    if conn is None or not task_id:
        return
    conn.execute(
        'INSERT INTO audit_logs (task_id, node_id, agent_id, action, detail) VALUES (?, ?, ?, ?, ?)',
        (
            task_id,
            node_id or None,
            'session_recorder',
            'TASK_TERMINAL_NOTIFIED',
            json.dumps({
                'event_type': event_type,
                'message_excerpt': (msg or '')[:500]
            }, ensure_ascii=False)[:500]
        )
    )
    conn.commit()

def record_quality_gate_audit(conn, task_id, node_id, quality_result, passed):
    if conn is None or not task_id:
        return
    action = 'QUALITY_GATE_PASSED' if passed else 'QUALITY_GATE_FAILED'
    conn.execute(
        'INSERT INTO audit_logs (task_id, node_id, agent_id, action, detail) VALUES (?, ?, ?, ?, ?)',
        (
            task_id,
            node_id or None,
            'session_recorder',
            action,
            json.dumps(quality_result.get('payload') or {}, ensure_ascii=False)[:500]
        )
    )
    conn.commit()

def build_quality_gate_failure_result(task_id, workflow_id, workflow_cn_name, node_id, node_status, reason):
    issue_message = reason or '质量门节点未通过验收'
    return {
        'checked': True,
        'passed': False,
        'workflow_id': workflow_id,
        'workflow_cn_name': workflow_cn_name or workflow_id or 'workflow',
        'payload': {
            'issues': [
                {
                    'code': 'QUALITY_GATE_NODE_FAILURE',
                    'message': issue_message,
                    'node_id': node_id,
                    'node_status': node_status
                }
            ],
            'task_id': task_id,
            'node_id': node_id,
            'node_status': node_status
        },
        'detail': issue_message[:300]
    }

def run_quality_gate(conn, task_id):
    quality_gate = get_task_quality_gate(conn, task_id)
    if not quality_gate:
        return {'checked': False, 'reason': 'no_quality_gate'}
    try:
        result = subprocess.run(
            ['node', quality_gate['script'], '--task', task_id],
            capture_output=True, text=True, timeout=30, cwd=NERV_ROOT
        )
        stdout = (result.stdout or '').strip()
        payload = json.loads(stdout) if stdout else {}
        if result.returncode == 0 and payload.get('passed') is True:
            return {
                'checked': True,
                'passed': True,
                'workflow_id': quality_gate['workflow_id'],
                'workflow_cn_name': quality_gate['workflow_cn_name'],
                'payload': payload
            }
        return {
            'checked': True,
            'passed': False,
            'workflow_id': quality_gate['workflow_id'],
            'workflow_cn_name': quality_gate['workflow_cn_name'],
            'payload': payload,
            'detail': (result.stderr or stdout or '').strip()[:500]
        }
    except Exception as exc:
        return {'checked': False, 'reason': 'quality_gate_exception', 'detail': str(exc)[:300]}

def reconcile_quality_gate_node_failures(conn, notified_set):
    if conn is None:
        return []

    results = []
    tasks = conn.execute(
        '''
        SELECT DISTINCT task_id, workflow_id, workflow_cn_name, repair_mode, repair_of_task_id
        FROM tasks
        WHERE task_id IS NOT NULL AND task_id != ''
        '''
    ).fetchall()

    for task_row in tasks:
        task_id = task_row['task_id']
        if not task_id:
            continue
        task_status = task_row['status'] if 'status' in task_row.keys() else None
        if task_status not in ('DONE', 'FAILED'):
            continue
        if task_terminal_notification_exists(conn, task_id):
            continue

        quality_nodes = get_quality_gate_nodes(conn, task_id)
        failing_node = next(
            (
                node for node in quality_nodes
                if node.get('status') in ('FAILED', 'CIRCUIT_BROKEN')
            ),
            None
        )
        if not failing_node:
            continue

        repair_meta = {
            'repair_mode': task_row['repair_mode'] if 'repair_mode' in task_row.keys() else 'new',
            'repair_of_task_id': task_row['repair_of_task_id'] if 'repair_of_task_id' in task_row.keys() else None,
            'workflow_cn_name': task_row['workflow_cn_name'] if 'workflow_cn_name' in task_row.keys() else None
        }
        quality_result = build_quality_gate_failure_result(
            task_id,
            task_row['workflow_id'] if 'workflow_id' in task_row.keys() else None,
            task_row['workflow_cn_name'] if 'workflow_cn_name' in task_row.keys() else None,
            failing_node.get('node_id'),
            failing_node.get('status'),
            f"质量门节点 {failing_node.get('node_id')} 处于 {failing_node.get('status')}"
        )
        record_quality_gate_audit(conn, task_id, failing_node.get('node_id'), quality_result, passed=False)
        result = notify_quality_gate_failure(task_id, quality_result, notified_set, repair_meta=repair_meta, conn=conn, node_id=failing_node.get('node_id'))
        results.append({
            'task_id': task_id,
            'node_id': failing_node.get('node_id'),
            'status': failing_node.get('status'),
            **result
        })

    return results

def get_task_repair_meta(conn, task_id):
    if conn is None or not task_id:
        return None
    row = conn.execute(
        'SELECT repair_mode, repair_of_task_id, workflow_cn_name FROM tasks WHERE task_id = ?',
        (task_id,)
    ).fetchone()
    if not row:
        return None
    return {
        'repair_mode': row['repair_mode'] if 'repair_mode' in row.keys() else 'new',
        'repair_of_task_id': row['repair_of_task_id'] if 'repair_of_task_id' in row.keys() else None,
        'workflow_cn_name': row['workflow_cn_name'] if 'workflow_cn_name' in row.keys() else None
    }

def notify_completion(event_data, notified_set, conn=None):
    """
    当检测到终态事件时，自动调用 adam_notifier 通知造物主。
    
    这解决了 Misato session 压缩导致丢失通知的问题。
    session_recorder 作为 Cron 独立运行，不依赖任何 Agent session。
    """
    event = event_data.get('event', {})
    event_type = event.get('event', '')
    
    if event_type not in ('NODE_COMPLETED', 'NODE_FAILED', 'CIRCUIT_BROKEN', 'TOOL_GAP', 'DAG_COMPLETE'):
        return {'sent': False, 'reason': 'unsupported_event'}
    
    # 构造唯一事件 ID 防止重复通知
    event_id = f"{event.get('task_id','')}_{event.get('node_id','')}_{event_type}"
    if event_id in notified_set:
        return {'sent': False, 'reason': 'duplicate'}
    
    if not os.path.exists(ADAM_NOTIFIER):
        return {'sent': False, 'reason': 'notifier_missing'}
    
    # 构造通知消息
    source = event.get('source', 'unknown')
    task_id = event.get('task_id', '')
    node_id = event.get('node_id', '')
    note = event.get('note', event.get('description', ''))
    
    task_summary = get_task_runtime_summary(conn, task_id)
    repair_meta = get_task_repair_meta(conn, task_id)
    is_repair_task = bool(repair_meta and repair_meta.get('repair_mode') == 'repair')
    repair_of_task_id = repair_meta.get('repair_of_task_id') if repair_meta else None
    is_single_node_task = bool(task_summary and task_summary['total'] <= 1)
    is_task_done = bool(task_summary and task_summary['status'] == 'DONE')
    is_task_failed = bool(task_summary and task_summary['status'] == 'FAILED')
    task_quality_gate = get_task_quality_gate(conn, task_id) if conn is not None else None
    quality_gate_nodes = get_quality_gate_nodes(conn, task_id) if conn is not None else []
    quality_gate_node = next((node for node in quality_gate_nodes if node.get('node_id') == node_id), None)

    if event_type == 'NODE_COMPLETED':
        if not (is_single_node_task or is_task_done):
            return {'sent': False, 'reason': 'intermediate_node_no_notify'}
        quality_result = run_quality_gate(conn, task_id)
        if quality_result.get('checked') and quality_result.get('passed') is False:
            record_quality_gate_audit(conn, task_id, node_id, quality_result, passed=False)
            return notify_quality_gate_failure(task_id, quality_result, notified_set, repair_meta=repair_meta, conn=conn, node_id=node_id)
        record_quality_gate_audit(conn, task_id, node_id, quality_result, passed=True)
        if is_repair_task:
            msg = f"🔧 修复完成 | {task_id}"
            if repair_of_task_id:
                msg += f"\n🎯 原任务: {repair_of_task_id}"
        else:
            msg = f"✅ 任务完成 | {task_id}"
        if node_id:
            msg += f"\n🧩 终态节点: {source} / {node_id}"
        if note:
            msg += f"\n📋 {note[:200]}"
    elif event_type in ('NODE_FAILED', 'CIRCUIT_BROKEN'):
        if quality_gate_node and quality_gate_node.get('status') in ('FAILED', 'CIRCUIT_BROKEN'):
            quality_result = build_quality_gate_failure_result(
                task_id,
                task_quality_gate.get('workflow_id') if task_quality_gate else None,
                task_quality_gate.get('workflow_cn_name') if task_quality_gate else (repair_meta.get('workflow_cn_name') if repair_meta else None),
                quality_gate_node.get('node_id'),
                quality_gate_node.get('status'),
                f"质量门节点 {quality_gate_node.get('node_id')} 处于 {quality_gate_node.get('status')}"
            )
            record_quality_gate_audit(conn, task_id, quality_gate_node.get('node_id'), quality_result, passed=False)
            return notify_quality_gate_failure(task_id, quality_result, notified_set, repair_meta=repair_meta, conn=conn, node_id=quality_gate_node.get('node_id'))
        error = event.get('error', '未知错误')
        if is_task_failed:
            if is_repair_task:
                msg = f"🔧 修复失败 | {task_id}"
                if repair_of_task_id:
                    msg += f"\n🎯 原任务: {repair_of_task_id}"
                msg += f"\n🧩 失败节点: {source} / {node_id}\n⚠️ {error}"
            else:
                msg = f"❌ 任务失败 | {task_id}\n🧩 失败节点: {source} / {node_id}\n⚠️ {error}"
        else:
            msg = f"❌ 节点失败 | {task_id} / {node_id}\n🧩 {source}\n⚠️ {error}"
    elif event_type == 'TOOL_GAP':
        blocker = event.get('blocker_detail') or event.get('missing_capability') or event.get('error') or '工具或运行时能力不足'
        msg = f"⚠️ TOOL_GAP | {task_id}"
        if node_id:
            msg += f"\n🧩 节点: {source} / {node_id}"
        msg += f"\n⚠️ {blocker}"
    elif event_type == 'DAG_COMPLETE':
        msg = f"🎯 DAG 全部完成 | {task_id}"
    else:
        return {'sent': False, 'reason': 'unsupported_event'}
    
    try:
        result = subprocess.run(
            ['python3', ADAM_NOTIFIER, 'notify', '--msg', msg],
            capture_output=True, text=True, timeout=30,
            cwd=NERV_ROOT
        )
        if result.returncode == 0:
            notified_set.add(event_id)
            if conn is not None:
                record_task_terminal_notification(conn, task_id, node_id, event_type, msg)
            return {'sent': True, 'reason': 'ok'}

        detail = (result.stderr or result.stdout or '').strip()
        return {
            'sent': False,
            'reason': 'notifier_failed',
            'detail': detail[:300]
        }
    except Exception as exc:
        return {
            'sent': False,
            'reason': 'exception',
            'detail': str(exc)[:300]
        }

def notify_runtime_alert(alert_data, notified_set):
    alert = alert_data.get('alert', {})
    alert_type = alert.get('alert_type')
    summary = alert.get('summary', '')
    if not alert_type or not summary:
        return {'sent': False, 'reason': 'invalid_alert'}

    event_id = f"runtime_alert::{alert_type}::{summary[:120]}"
    if event_id in notified_set:
        return {'sent': False, 'reason': 'duplicate'}

    if not os.path.exists(ADAM_NOTIFIER):
        return {'sent': False, 'reason': 'notifier_missing'}

    title = '工具权限受阻' if alert_type == 'TOOL_PERMISSION_DENIED' else '工具能力缺口'
    msg = f"⚠️ {title}\n{summary[:500]}"
    try:
        result = subprocess.run(
            ['python3', ADAM_NOTIFIER, 'notify', '--title', title, '--msg', msg, '--level', 'warning', '--source', 'session_recorder'],
            capture_output=True, text=True, timeout=20, cwd=NERV_ROOT
        )
        if result.returncode == 0:
            notified_set.add(event_id)
            return {'sent': True, 'reason': 'ok'}
        detail = (result.stderr or result.stdout or '').strip()
        return {'sent': False, 'reason': 'notifier_failed', 'detail': detail[:300]}
    except Exception as exc:
        return {'sent': False, 'reason': 'exception', 'detail': str(exc)[:300]}

def notify_quality_gate_failure(task_id, quality_result, notified_set, repair_meta=None, conn=None, node_id=None):
    if not task_id or not quality_result or quality_result.get('passed') is True:
        return {'sent': False, 'reason': 'invalid_quality_gate'}

    event_id = f"quality_gate::{task_id}"
    if event_id in notified_set:
        return {'sent': False, 'reason': 'duplicate'}

    if not os.path.exists(ADAM_NOTIFIER):
        return {'sent': False, 'reason': 'notifier_missing'}

    title = '修复后仍未达标' if repair_meta and repair_meta.get('repair_mode') == 'repair' else '质量未达标'
    payload = quality_result.get('payload') or {}
    issues = payload.get('issues') if isinstance(payload, dict) else []
    issue_lines = []
    for issue in (issues or [])[:5]:
        code = issue.get('code', 'QUALITY_ISSUE')
        message = issue.get('message', '')
        issue_lines.append(f"- `{code}` {message}")
    body = f"⚠️ {quality_result.get('workflow_cn_name', quality_result.get('workflow_id', 'workflow'))}\n任务: `{task_id}`"
    if repair_meta and repair_meta.get('repair_of_task_id'):
        body += f"\n原任务: `{repair_meta['repair_of_task_id']}`"
    if issue_lines:
        body += "\n\n" + "\n".join(issue_lines)

    try:
        result = subprocess.run(
            ['python3', ADAM_NOTIFIER, 'notify', '--title', title, '--msg', body, '--level', 'warning', '--source', 'session_recorder'],
            capture_output=True, text=True, timeout=20, cwd=NERV_ROOT
        )
        if result.returncode == 0:
            notified_set.add(event_id)
            if conn is not None:
                record_task_terminal_notification(conn, task_id, node_id, 'QUALITY_GATE_FAILED', body)
            return {'sent': True, 'reason': 'ok'}
        detail = (result.stderr or result.stdout or '').strip()
        return {'sent': False, 'reason': 'notifier_failed', 'detail': detail[:300]}
    except Exception as exc:
        return {'sent': False, 'reason': 'exception', 'detail': str(exc)[:300]}

# ═══════════════════════════════════════════════════════════════
# Memory Queue 写入
# ═══════════════════════════════════════════════════════════════

def write_memory_queue(event_data, task_cache=None, conn=None):
    """将完成的任务写入 memory_queue/ 供 Rei 提纯"""
    event = event_data.get('event', {})
    event_type = event.get('event', '')
    task_id = event.get('task_id', '')
    node_id = event.get('node_id', '')
    source_agent = event.get('source', '')
    
    # 只记录完成/失败事件
    if event_type not in ('NODE_COMPLETED', 'NODE_FAILED', 'CIRCUIT_BROKEN', 'DAG_COMPLETE'):
        return

    task_row = None
    node_def = None
    if conn is not None and task_id:
        try:
            snapshot = load_task_snapshot(conn, task_id, task_cache)
            task_row = snapshot.get('row')
            node_def = snapshot.get('nodes_by_id', {}).get(node_id, {}) if node_id else None
        except Exception:
            task_row = None
            node_def = None
    
    os.makedirs(MEMORY_QUEUE_DIR, exist_ok=True)
    
    record = {
        'type': 'task_event',
        'timestamp': datetime.now(tz=__import__('datetime').timezone.utc).isoformat(),
        'event': event_type,
        'task_id': task_id,
        'node_id': node_id,
        'source_agent': source_agent,
        'dispatch_id': event.get('dispatch_id', ''),
        'task_intent': task_row['intent'] if task_row and 'intent' in task_row.keys() else '',
        'task_status': task_row['status'] if task_row and 'status' in task_row.keys() else '',
        'node_description': node_def.get('description', '') if isinstance(node_def, dict) else '',
        'node_agent_id': node_def.get('agent_id', '') if isinstance(node_def, dict) else '',
        'outputs': event.get('outputs', []),
        'note': event.get('note', ''),
        'error': event.get('error'),
        'duration_ms': event.get('duration_ms'),
        'memory_targets': [],
        'recorded_by': 'session_recorder'
    }

    explicit_targets = event.get('memory_targets')
    if isinstance(explicit_targets, str):
        explicit_targets = [explicit_targets]
    elif not isinstance(explicit_targets, list):
        explicit_targets = []

    inferred_targets = [source_agent]
    if isinstance(node_def, dict):
        inferred_targets.append(node_def.get('agent_id', ''))

    combined_targets = explicit_targets + inferred_targets
    deduped_targets = []
    seen_targets = set()
    for target in combined_targets:
        if not target or target in seen_targets:
            continue
        seen_targets.add(target)
        deduped_targets.append(target)

    record['memory_targets'] = deduped_targets
    
    # 去除空值
    record = {k: v for k, v in record.items() if v is not None and v != ''}
    
    filename = f"{event_type.lower()}_{event.get('task_id', 'unknown')[:30]}_{int(time.time())}.json"
    filepath = os.path.join(MEMORY_QUEUE_DIR, filename)
    
    with open(filepath, 'w') as f:
        json.dump(record, f, indent=2, ensure_ascii=False)

# ═══════════════════════════════════════════════════════════════
# 编排者续推（完成事件后立即唤醒 Misato）
# ═══════════════════════════════════════════════════════════════

def get_ready_dispatch_nodes(conn, task_id):
    if not task_id:
        return []
    return conn.execute(
        '''
        SELECT
          dn.node_id,
          dn.agent_id,
          dn.description,
          dn.session_key,
          dn.session_scope,
          dn.last_dispatch_id,
          dn.last_dispatch_at
        FROM dag_nodes dn
        WHERE dn.task_id = ? AND dn.status = 'PENDING'
          AND NOT EXISTS (
            SELECT 1
            FROM dag_edges e
            JOIN dag_nodes upstream ON e.from_node = upstream.node_id
            WHERE e.to_node = dn.node_id
              AND e.task_id = ?
              AND upstream.status != 'DONE'
          )
        ORDER BY dn.depth ASC, dn.node_id ASC
        ''',
        (task_id, task_id)
    ).fetchall()

def get_task_row(conn, task_id):
    if not task_id:
        return None
    return conn.execute(
        '''
        SELECT task_id, status, orchestrator_agent_id, orchestrator_session_key, session_strategy
        FROM tasks
        WHERE task_id = ?
        ''',
        (task_id,)
    ).fetchone()

def load_session_store(agent_id):
    if not agent_id:
        return {}
    store_path = os.path.join(OPENCLAW_ROOT, 'agents', agent_id, 'sessions', 'sessions.json')
    if not os.path.exists(store_path):
        return {}
    try:
        with open(store_path, encoding='utf-8') as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}

def resolve_session_id(agent_id, session_key):
    if not agent_id or not session_key:
        return None

    store = load_session_store(agent_id)
    entry = store.get(session_key)
    if isinstance(entry, dict):
        session_id = entry.get('sessionId')
        if isinstance(session_id, str) and session_id.strip():
            return session_id.strip()

    try:
        result = subprocess.run(
            [OPENCLAW_BIN, 'sessions', '--agent', agent_id, '--json', '--active', '1440'],
            capture_output=True,
            text=True,
            timeout=20,
            cwd=OPENCLAW_ROOT
        )
        if result.returncode != 0:
            return None
        payload = json.loads(result.stdout or '{}')
        for row in payload.get('sessions', []):
            if row.get('key') == session_key and row.get('sessionId'):
                return str(row['sessionId']).strip()
    except Exception:
        return None

    return None

def wake_already_sent_recently(conn, task_id, fingerprint, window_seconds=90):
    if not task_id or not fingerprint:
        return False
    cutoff = int(time.time()) - window_seconds
    row = conn.execute(
        '''
        SELECT 1
        FROM audit_logs
        WHERE task_id = ?
          AND action = 'ORCHESTRATOR_WAKE_SENT'
          AND created_at >= ?
          AND detail LIKE ?
        LIMIT 1
        ''',
        (task_id, cutoff, f'%{fingerprint}%')
    ).fetchone()
    return bool(row)

def wake_orchestrator_for_task(conn, task_id, trigger):
    now = int(time.time())
    task_row = get_task_row(conn, task_id)
    if not task_row:
        return {'sent': False, 'reason': 'task_missing'}

    if task_row['status'] != 'RUNNING':
        return {'sent': False, 'reason': f'task_not_running:{task_row["status"]}'}

    ready_nodes = get_ready_dispatch_nodes(conn, task_id)
    if not ready_nodes:
        return {'sent': False, 'reason': 'no_ready_nodes'}

    orchestrator_agent = task_row['orchestrator_agent_id'] or 'nerv-misato'
    orchestrator_session_key = task_row['orchestrator_session_key'] or infer_task_session_key(orchestrator_agent, task_id)
    session_id = resolve_session_id(orchestrator_agent, orchestrator_session_key)
    ready_node_ids = [row['node_id'] for row in ready_nodes if row['node_id']]
    fingerprint = '|'.join(sorted(ready_node_ids))

    if wake_already_sent_recently(conn, task_id, fingerprint):
        return {'sent': False, 'reason': 'duplicate_recent'}

    if not session_id:
        conn.execute(
            'INSERT INTO audit_logs (task_id, node_id, agent_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            (
                task_id,
                None,
                'session_recorder',
                'ORCHESTRATOR_WAKE_MISSING_SESSION',
                json.dumps({
                    'orchestrator_agent_id': orchestrator_agent,
                    'orchestrator_session_key': orchestrator_session_key,
                    'ready_nodes': ready_node_ids
                }, ensure_ascii=False)[:500],
                now
            )
        )
        conn.commit()
        return {'sent': False, 'reason': 'missing_session_id'}

    message = (
        f"[NERV_CONTINUE_DAG]\n"
        f"task_id={task_id}\n"
        f"cause_event={trigger.get('event_type','NODE_COMPLETED')}\n"
        f"cause_node={trigger.get('node_id','')}\n"
        "继续当前 DAG，不要重建任务，不要重新规划。\n"
        "立即执行：\n"
        f"1. exec `node /Users/dolan/.openclaw/nerv/scripts/tools/get_ready_dispatches.js {task_id}`\n"
        "2. 只派发 ready_dispatches 中的节点，严格使用返回的 session_key\n"
        "3. 如果 ready_dispatches 为空或 task 已终态，停止，不要重复通知\n"
        "4. 禁止回退到 agent:<agentId>:main\n"
        "回复只需简短说明已派发节点或 NO_READY。"
    )

    try:
        result = subprocess.run(
            [
                OPENCLAW_BIN,
                'agent',
                '--agent', orchestrator_agent,
                '--session-id', session_id,
                '--message', message,
                '--thinking', 'minimal',
                '--timeout', '90',
                '--json'
            ],
            capture_output=True,
            text=True,
            timeout=120,
            cwd=OPENCLAW_ROOT
        )
    except Exception as exc:
        conn.execute(
            'INSERT INTO audit_logs (task_id, node_id, agent_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            (
                task_id,
                None,
                'session_recorder',
                'ORCHESTRATOR_WAKE_FAILED',
                json.dumps({
                    'error': str(exc),
                    'orchestrator_agent_id': orchestrator_agent,
                    'session_id': session_id,
                    'ready_nodes': ready_node_ids
                }, ensure_ascii=False)[:500],
                now
            )
        )
        conn.commit()
        return {'sent': False, 'reason': 'wake_exception', 'detail': str(exc)}

    action = 'ORCHESTRATOR_WAKE_SENT' if result.returncode == 0 else 'ORCHESTRATOR_WAKE_FAILED'
    conn.execute(
        'INSERT INTO audit_logs (task_id, node_id, agent_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        (
            task_id,
            None,
            'session_recorder',
            action,
            json.dumps({
                'orchestrator_agent_id': orchestrator_agent,
                'orchestrator_session_key': orchestrator_session_key,
                'session_id': session_id,
                'ready_nodes': ready_node_ids,
                'ready_count': len(ready_node_ids),
                'fingerprint': fingerprint,
                'stdout_excerpt': (result.stdout or '')[:220],
                'stderr_excerpt': (result.stderr or '')[:220],
                'returncode': result.returncode
            }, ensure_ascii=False)[:500],
            now
        )
    )
    conn.commit()

    if result.returncode != 0:
        return {
            'sent': False,
            'reason': 'wake_command_failed',
            'detail': ((result.stderr or result.stdout or '').strip())[:300]
        }

    return {
        'sent': True,
        'reason': 'ok',
        'ready_nodes': ready_node_ids
    }

# ═══════════════════════════════════════════════════════════════
# 主逻辑
# ═══════════════════════════════════════════════════════════════

def main():
    dry_run = '--dry-run' in sys.argv
    reset = '--reset' in sys.argv
    lock_fd = acquire_lock()

    if lock_fd is None:
        print(json.dumps({
            'status': 'skipped',
            'reason': 'lock_held',
            'dry_run': dry_run
        }, ensure_ascii=False))
        return
    
    state = {} if reset else load_state()
    
    # 扫描所有 NERV Agent 的 session 目录
    session_dirs = []
    agents_dir = os.path.join(OPENCLAW_ROOT, 'agents')
    for agent_dir in glob.glob(os.path.join(agents_dir, f'{NERV_AGENT_PREFIX}*', 'sessions')):
        session_dirs.append(agent_dir)
    
    total_events = 0
    total_recorded = 0
    total_notified = 0
    files_scanned = 0
    files_skipped = {
        'too_small': 0,
        'stale': 0,
        'unchanged': 0
    }
    scan_errors = []
    event_breakdown = {}
    notification_failures = []
    contract_rejections = []
    wake_candidates = {}
    wake_results = []
    notified_set = load_notified()
    task_cache = {}
    
    conn = None if dry_run else ensure_db()
    
    try:
        for sessions_dir in session_dirs:
            for jsonl_file in glob.glob(os.path.join(sessions_dir, '*.jsonl')):
                # 跳过太小的文件
                if os.path.getsize(jsonl_file) < 100:
                    files_skipped['too_small'] += 1
                    continue
                
                # 跳过超过 24h 没修改的文件
                if time.time() - os.path.getmtime(jsonl_file) > 86400:
                    files_skipped['stale'] += 1
                    continue
                
                file_key = jsonl_file
                offset = state.get(file_key, 0)
                
                # 如果文件没有变化，跳过
                current_size = os.path.getsize(jsonl_file)
                if current_size <= offset:
                    files_skipped['unchanged'] += 1
                    continue
                
                events, new_offset, scan_stats, scan_error = scan_session_file(jsonl_file, offset)
                files_scanned += 1

                if scan_error:
                    scan_errors.append({
                        'file': os.path.basename(jsonl_file),
                        'error': scan_error
                    })
                    continue
                
                for ev in events:
                    total_events += 1
                    if ev['type'] == 'nerv_event':
                        key = ev['event'].get('event', 'unknown')
                    else:
                        key = ev['type']
                    event_breakdown[key] = event_breakdown.get(key, 0) + 1
                    
                    if dry_run:
                        ev_type = ev.get('type', '')
                        if ev_type == 'nerv_event':
                            inner = ev['event']
                            print(f"  [{inner.get('event')}] task={inner.get('task_id','')} node={inner.get('node_id','')} src={inner.get('source','')}")
                        elif ev_type == 'dispatch':
                            d = ev['dispatch']
                            print(f"  [DISPATCH] → {d.get('target_agent','')}")
                        elif ev_type == 'runtime_alert':
                            print(f"  [RUNTIME_ALERT] {ev.get('alert', {}).get('alert_type', '')}")
                    else:
                        if ev['type'] == 'nerv_event':
                            outcome = record_nerv_event(conn, ev, task_cache)
                            if outcome.get('ok'):
                                total_recorded += 1
                                write_memory_queue(ev, task_cache, conn)
                                inner = ev.get('event', {})
                                task_id = inner.get('task_id', '')
                                event_type = inner.get('event', '')
                                if task_id and event_type in ('NODE_COMPLETED', 'NODE_FAILED'):
                                    bucket = wake_candidates.setdefault(task_id, {
                                        'event_types': set(),
                                        'node_ids': set()
                                    })
                                    bucket['event_types'].add(event_type)
                                    node_id = inner.get('node_id')
                                    if node_id:
                                        bucket['node_ids'].add(node_id)
                                # 自动通知造物主
                                notify_result = notify_completion(ev, notified_set, conn=conn)
                                if notify_result['sent']:
                                    total_notified += 1
                                elif notify_result['reason'] not in ('duplicate', 'unsupported_event'):
                                    notification_failures.append({
                                        'task_id': ev['event'].get('task_id', ''),
                                        'node_id': ev['event'].get('node_id', ''),
                                        'reason': notify_result['reason'],
                                        'detail': notify_result.get('detail', '')
                                    })
                            elif outcome.get('reason') == 'contract_rejected':
                                contract_rejections.append({
                                    'task_id': ev['event'].get('task_id', ''),
                                    'node_id': ev['event'].get('node_id', ''),
                                    'event': ev['event'].get('event', ''),
                                    'reason': outcome.get('contract', {}).get('reason', 'contract_rejected'),
                                    'missing_artifacts': outcome.get('contract', {}).get('missing_artifacts', []),
                                    'file': ev.get('file')
                                })
                        elif ev['type'] == 'dispatch':
                            outcome = record_dispatch(conn, ev, task_cache)
                            if outcome.get('ok'):
                                total_recorded += 1
                        elif ev['type'] == 'runtime_alert':
                            outcome = record_runtime_alert(conn, ev)
                            if outcome.get('ok'):
                                total_recorded += 1
                            notify_result = notify_runtime_alert(ev, notified_set)
                            if notify_result.get('sent'):
                                total_notified += 1
                            elif notify_result.get('reason') not in ('duplicate', 'invalid_alert'):
                                notification_failures.append({
                                    'task_id': '',
                                    'node_id': '',
                                    'reason': notify_result['reason'],
                                    'detail': notify_result.get('detail', '')
                                })
                
                state[file_key] = new_offset
        
        if not dry_run:
            reconcile_dispatch_audit_states(conn)
            reconcile_terminal_audit_states(conn)
            reconcile_failed_downstream_blocks(conn)
            reconcile_task_rollups(conn)
            quality_gate_results = reconcile_quality_gate_node_failures(conn, notified_set)
            if quality_gate_results:
                for result in quality_gate_results:
                    if result.get('sent'):
                        total_notified += 1
                    elif result.get('reason') not in ('duplicate', 'notifier_missing'):
                        notification_failures.append({
                            'task_id': result.get('task_id', ''),
                            'node_id': result.get('node_id', ''),
                            'reason': result.get('reason', ''),
                            'detail': result.get('detail', '')
                        })
            for task_id, trigger in wake_candidates.items():
                wake_results.append({
                    'task_id': task_id,
                    **wake_orchestrator_for_task(
                        conn,
                        task_id,
                        {
                            'event_type': '+'.join(sorted(trigger['event_types'])),
                            'node_id': ','.join(sorted(trigger['node_ids']))
                        }
                    )
                })
            save_state(state)
            save_notified(notified_set)
    finally:
        if conn:
            conn.close()
        release_lock(lock_fd)
    
    result = {
        'status': 'ok',
        'files_scanned': files_scanned,
        'files_skipped': files_skipped,
        'events_found': total_events,
        'event_breakdown': event_breakdown,
        'records_written': total_recorded,
        'contract_rejections': contract_rejections[:20],
        'notifications_sent': total_notified,
        'notification_failures': notification_failures[:20],
        'orchestrator_wakes': wake_results[:20],
        'scan_errors': scan_errors[:20],
        'dry_run': dry_run
    }
    print(json.dumps(result, ensure_ascii=False))

if __name__ == '__main__':
    main()
