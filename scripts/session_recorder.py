#!/usr/bin/env python3
"""
███ NERV · Session Recorder · session_recorder.py ███

物理层 DAG 录入器。每 5 分钟由 Cron 触发。
扫描 Agent session log (.jsonl)，提取 NERV 协议事件，
自动写入 nerv.db + memory_queue/。

零 LLM 依赖。Agent 不需要做任何额外操作。

用法:
  python3 scripts/session_recorder.py           # 正常运行
  python3 scripts/session_recorder.py --dry-run  # 只扫描不写入
  python3 scripts/session_recorder.py --reset    # 重置 offset，全量扫描

提取的事件:
  - NODE_COMPLETED / NODE_FAILED（Agent → Misato 的回报）
  - sessions_send 调度（Misato → Agent 的任务分发）
  - DAG_COMPLETE（全 DAG 完成通知）
"""
import json
import os
import sys
import glob
import sqlite3
import time
from pathlib import Path
from datetime import datetime

# ═══════════════════════════════════════════════════════════════
# 配置
# ═══════════════════════════════════════════════════════════════

NERV_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OPENCLAW_ROOT = os.path.dirname(NERV_ROOT)  # ~/.openclaw

# DB
DB_PATH = os.environ.get('NERV_DB_PATH')
if not DB_PATH:
    for candidate in [
        os.path.join(NERV_ROOT, 'data', 'db', 'nerv.db'),
        os.path.join(NERV_ROOT, 'data', 'nerv.db'),
    ]:
        if os.path.exists(candidate):
            DB_PATH = candidate
            break
    else:
        DB_PATH = os.path.join(NERV_ROOT, 'data', 'db', 'nerv.db')

# State file（记录每个 .jsonl 的已处理 offset）
STATE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.recorder_state.json')

# Memory queue
MEMORY_QUEUE_DIR = os.path.join(NERV_ROOT, 'memory_queue')

# 只扫描 NERV Agent 的 session
NERV_AGENT_PREFIX = 'nerv-'

# ═══════════════════════════════════════════════════════════════
# State 管理
# ═══════════════════════════════════════════════════════════════

def load_state():
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE) as f:
                return json.load(f)
        except:
            pass
    return {}

def save_state(state):
    with open(STATE_FILE, 'w') as f:
        json.dump(state, f, indent=2)

# ═══════════════════════════════════════════════════════════════
# JSONL 解析
# ═══════════════════════════════════════════════════════════════

NERV_EVENTS = {'NODE_COMPLETED', 'NODE_FAILED', 'DAG_COMPLETE', 'STRATEGIC_DISPATCH', 'TOOL_GAP'}

def extract_nerv_event(text):
    """从消息文本中提取 NERV 协议事件 JSON"""
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
        if isinstance(data, dict) and data.get('event') in NERV_EVENTS:
            return data
    except:
        pass
    
    # 尝试从文本中提取 JSON 块
    for start_marker in ['{']:
        idx = text.find(start_marker)
        if idx >= 0:
            try:
                data = json.loads(text[idx:])
                if isinstance(data, dict) and data.get('event') in NERV_EVENTS:
                    return data
            except:
                pass
    
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
        # sessionKey 格式: "agent:nerv-xxx:main"
        parts = session_key.split(':')
        if len(parts) >= 2:
            target_agent = parts[1]
        else:
            target_agent = session_key
        
        dispatches.append({
            'target_agent': target_agent,
            'session_key': session_key,
            'message': message[:500] if isinstance(message, str) else str(message)[:500]
        })
    
    return dispatches

def scan_session_file(filepath, offset=0):
    """扫描单个 .jsonl 文件，返回提取的事件列表"""
    events = []
    
    try:
        with open(filepath, 'r', errors='replace') as f:
            f.seek(offset)
            new_offset = offset
            
            for line in f:
                new_offset += len(line.encode('utf-8', errors='replace'))
                line = line.strip()
                if not line:
                    continue
                
                try:
                    entry = json.loads(line)
                except:
                    continue
                
                if entry.get('type') != 'message':
                    continue
                
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
                    if isinstance(content, list):
                        dispatches = extract_dispatch(content)
                        for d in dispatches:
                            events.append({
                                'type': 'dispatch',
                                'dispatch': d,
                                'file': os.path.basename(filepath)
                            })
            
            return events, new_offset
    except Exception as e:
        return [], offset

# ═══════════════════════════════════════════════════════════════
# DB 写入
# ═══════════════════════════════════════════════════════════════

def ensure_db():
    """确保 DB 存在且表结构正确"""
    db_dir = os.path.dirname(DB_PATH)
    if not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)
    
    conn = sqlite3.connect(DB_PATH)
    conn.execute('PRAGMA journal_mode = WAL')
    conn.execute('PRAGMA busy_timeout = 5000')
    return conn

def record_nerv_event(conn, event_data):
    """将 NERV 协议事件写入 nerv.db"""
    event = event_data.get('event', {})
    event_type = event.get('event', '')
    task_id = event.get('task_id', '')
    node_id = event.get('node_id', '')
    source = event.get('source', '')
    
    if not task_id:
        return False
    
    now = int(time.time())
    
    # 1. 确保 task 存在
    existing = conn.execute('SELECT task_id FROM tasks WHERE task_id = ?', (task_id,)).fetchone()
    if not existing:
        conn.execute(
            'INSERT OR IGNORE INTO tasks (task_id, initiator_id, intent, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
            (task_id, source or 'unknown', f'[auto-recorded] {task_id}', 'RUNNING', now, now)
        )
    
    # 2. 确保 node 存在并更新状态
    if node_id:
        existing_node = conn.execute('SELECT node_id FROM dag_nodes WHERE node_id = ?', (node_id,)).fetchone()
        
        if event_type == 'NODE_COMPLETED':
            status = 'DONE'
            result_path = json.dumps(event.get('outputs', []))
        elif event_type == 'NODE_FAILED':
            status = 'FAILED'
            result_path = None
        else:
            status = 'RUNNING'
            result_path = None
        
        if existing_node:
            conn.execute(
                'UPDATE dag_nodes SET status = ?, result_path = ?, completed_at = ?, updated_at = ? WHERE node_id = ?',
                (status, result_path, now, now, node_id)
            )
        else:
            desc = event.get('note', event.get('description', f'[auto-recorded] {node_id}'))
            conn.execute(
                'INSERT OR IGNORE INTO dag_nodes (node_id, task_id, agent_id, description, status, result_path, completed_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                (node_id, task_id, source, desc[:200], status, result_path, now, now)
            )
    
    # 3. 检查 task 是否全部完成
    if event_type in ('NODE_COMPLETED', 'NODE_FAILED', 'DAG_COMPLETE'):
        result = conn.execute(
            'SELECT COUNT(*) as total, SUM(CASE WHEN status = "DONE" THEN 1 ELSE 0 END) as done FROM dag_nodes WHERE task_id = ?',
            (task_id,)
        ).fetchone()
        if result and result[0] > 0 and result[0] == result[1]:
            conn.execute('UPDATE tasks SET status = "DONE", updated_at = ? WHERE task_id = ?', (now, task_id))
    
    # 4. 写审计日志
    conn.execute(
        'INSERT INTO audit_logs (task_id, node_id, agent_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        (task_id, node_id, source, f'RECORDED_{event_type}', json.dumps(event, ensure_ascii=False)[:500], now)
    )
    
    conn.commit()
    return True

def record_dispatch(conn, dispatch_data):
    """记录 Misato 的调度行为"""
    d = dispatch_data.get('dispatch', {})
    target = d.get('target_agent', '')
    message_text = d.get('message', '')
    
    # 尝试从消息中提取 task_id 和 node_id
    event = extract_nerv_event(message_text)
    if not event:
        return False
    
    task_id = event.get('task_id', '')
    node_id = event.get('node_id', '')
    
    if not task_id:
        return False
    
    now = int(time.time())
    
    # 确保 task 存在
    existing = conn.execute('SELECT task_id FROM tasks WHERE task_id = ?', (task_id,)).fetchone()
    if not existing:
        intent = event.get('intent', event.get('description', f'[auto-recorded] {task_id}'))
        conn.execute(
            'INSERT OR IGNORE INTO tasks (task_id, initiator_id, intent, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
            (task_id, 'nerv-misato', intent[:200], 'RUNNING', now, now)
        )
    
    # 创建 node（如 dispatch 中有 node_id）
    if node_id:
        desc = event.get('description', event.get('note', f'dispatched to {target}'))
        conn.execute(
            'INSERT OR IGNORE INTO dag_nodes (node_id, task_id, agent_id, description, status, started_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            (node_id, task_id, target, desc[:200], 'RUNNING', now, now)
        )
    
    # 审计日志
    conn.execute(
        'INSERT INTO audit_logs (task_id, node_id, agent_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        (task_id, node_id, 'nerv-misato', 'RECORDED_DISPATCH', f'→ {target}', now)
    )
    
    conn.commit()
    return True

# ═══════════════════════════════════════════════════════════════
# Memory Queue 写入
# ═══════════════════════════════════════════════════════════════

def write_memory_queue(event_data):
    """将完成的任务写入 memory_queue/ 供 Rei 提纯"""
    event = event_data.get('event', {})
    event_type = event.get('event', '')
    
    # 只记录完成/失败事件
    if event_type not in ('NODE_COMPLETED', 'NODE_FAILED', 'DAG_COMPLETE'):
        return
    
    os.makedirs(MEMORY_QUEUE_DIR, exist_ok=True)
    
    record = {
        'type': 'task_event',
        'timestamp': datetime.now(tz=__import__('datetime').timezone.utc).isoformat(),
        'event': event_type,
        'task_id': event.get('task_id', ''),
        'node_id': event.get('node_id', ''),
        'source_agent': event.get('source', ''),
        'outputs': event.get('outputs', []),
        'note': event.get('note', ''),
        'error': event.get('error'),
        'duration_ms': event.get('duration_ms'),
        'recorded_by': 'session_recorder'
    }
    
    # 去除空值
    record = {k: v for k, v in record.items() if v is not None and v != ''}
    
    filename = f"{event_type.lower()}_{event.get('task_id', 'unknown')[:30]}_{int(time.time())}.json"
    filepath = os.path.join(MEMORY_QUEUE_DIR, filename)
    
    with open(filepath, 'w') as f:
        json.dump(record, f, indent=2, ensure_ascii=False)

# ═══════════════════════════════════════════════════════════════
# 主逻辑
# ═══════════════════════════════════════════════════════════════

def main():
    dry_run = '--dry-run' in sys.argv
    reset = '--reset' in sys.argv
    
    state = {} if reset else load_state()
    
    # 扫描所有 NERV Agent 的 session 目录
    session_dirs = []
    agents_dir = os.path.join(OPENCLAW_ROOT, 'agents')
    for agent_dir in glob.glob(os.path.join(agents_dir, f'{NERV_AGENT_PREFIX}*', 'sessions')):
        session_dirs.append(agent_dir)
    
    total_events = 0
    total_recorded = 0
    files_scanned = 0
    
    conn = None if dry_run else ensure_db()
    
    try:
        for sessions_dir in session_dirs:
            for jsonl_file in glob.glob(os.path.join(sessions_dir, '*.jsonl')):
                # 跳过太小的文件
                if os.path.getsize(jsonl_file) < 100:
                    continue
                
                # 跳过超过 24h 没修改的文件
                if time.time() - os.path.getmtime(jsonl_file) > 86400:
                    continue
                
                file_key = jsonl_file
                offset = state.get(file_key, 0)
                
                # 如果文件没有变化，跳过
                current_size = os.path.getsize(jsonl_file)
                if current_size <= offset:
                    continue
                
                events, new_offset = scan_session_file(jsonl_file, offset)
                files_scanned += 1
                
                for ev in events:
                    total_events += 1
                    
                    if dry_run:
                        ev_type = ev.get('type', '')
                        if ev_type == 'nerv_event':
                            inner = ev['event']
                            print(f"  [{inner.get('event')}] task={inner.get('task_id','')} node={inner.get('node_id','')} src={inner.get('source','')}")
                        elif ev_type == 'dispatch':
                            d = ev['dispatch']
                            print(f"  [DISPATCH] → {d.get('target_agent','')}")
                    else:
                        if ev['type'] == 'nerv_event':
                            ok = record_nerv_event(conn, ev)
                            if ok:
                                total_recorded += 1
                                write_memory_queue(ev)
                        elif ev['type'] == 'dispatch':
                            ok = record_dispatch(conn, ev)
                            if ok:
                                total_recorded += 1
                
                state[file_key] = new_offset
        
        if not dry_run:
            save_state(state)
    finally:
        if conn:
            conn.close()
    
    result = {
        'status': 'ok',
        'files_scanned': files_scanned,
        'events_found': total_events,
        'records_written': total_recorded,
        'dry_run': dry_run
    }
    print(json.dumps(result, ensure_ascii=False))

if __name__ == '__main__':
    main()
