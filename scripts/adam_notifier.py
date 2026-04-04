#!/usr/bin/env python3
"""
███ NERV · Adam 通知器 · adam_notifier.py ███

Cron 每 10 分钟扫一次 pending_approvals 表。
发现 PENDING 状态的新记录 → 推送飞书卡片到造物主。

用法:
  python3 scripts/adam_notifier.py                    # 正常运行
  python3 scripts/adam_notifier.py --dry-run           # 只检查不推送

环境变量:
  FEISHU_WEBHOOK_URL — 飞书群组机器人 Webhook 地址

Cron 配置 (nerv_cron_jobs.js):
  */10 * * * * python3 ~/.openclaw/nerv/scripts/adam_notifier.py
"""
import json
import os
import sys
import sqlite3
import urllib.request
from datetime import datetime

# ═══════════════════════════════════════════════════════════════
# 配置
# ═══════════════════════════════════════════════════════════════

NERV_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 统一 DB 路径：优先环境变量，与其他物理脚本对齐
DB_PATH = os.environ.get('NERV_DB_PATH')
if not DB_PATH:
    for candidate in [
        os.path.join(NERV_ROOT, 'data', 'db', 'nerv.db'),
        os.path.join(NERV_ROOT, 'data', 'nerv.db'),
        os.path.expanduser('~/.openclaw/nerv/data/db/nerv.db'),
    ]:
        if os.path.exists(candidate):
            DB_PATH = candidate
            break
    else:
        DB_PATH = os.path.join(NERV_ROOT, 'data', 'db', 'nerv.db')  # fallback

FEISHU_WEBHOOK = os.environ.get('FEISHU_WEBHOOK_URL', '')
DRY_RUN = '--dry-run' in sys.argv

# 记录上次通知的 ID，避免重复推送
STATE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.adam_last_notified_id')

def get_last_notified_id():
    try:
        if os.path.exists(STATE_FILE):
            with open(STATE_FILE, 'r') as f:
                return int(f.read().strip())
    except:
        pass
    return 0

def save_last_notified_id(max_id):
    with open(STATE_FILE, 'w') as f:
        f.write(str(max_id))

def get_pending_approvals(min_id=0):
    """查询 pending_approvals 中 status=PENDING 且 id > min_id 的记录"""
    if not os.path.exists(DB_PATH):
        print(f"[Adam] 数据库不存在: {DB_PATH}")
        return []

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            'SELECT * FROM pending_approvals WHERE status = ? AND id > ? ORDER BY created_at DESC',
            ('PENDING', min_id)
        ).fetchall()
        return [dict(r) for r in rows]
    except sqlite3.OperationalError as e:
        print(f"[Adam] 查询失败: {e}")
        return []
    finally:
        conn.close()

def build_feishu_card(approvals):
    """构建飞书卡片消息"""
    items = []
    for a in approvals[:5]:  # 最多展示 5 条
        payload = json.loads(a['payload']) if isinstance(a['payload'], str) else a['payload']
        created = datetime.fromtimestamp(a['created_at']).strftime('%m/%d %H:%M')
        items.append(f"• **#{a['id']}** [{a['approval_type']}] {payload.get('name', payload.get('skill_name', '未知'))} — {created}")

    content = '\n'.join(items)
    remaining = len(approvals) - 5
    if remaining > 0:
        content += f'\n\n...还有 {remaining} 条待批复'

    return {
        "msg_type": "interactive",
        "card": {
            "header": {
                "title": {"tag": "plain_text", "content": f"🔔 NERV 待批复 ({len(approvals)} 项)"},
                "template": "orange"
            },
            "elements": [
                {"tag": "markdown", "content": content},
                {"tag": "markdown", "content": "回到终端执行:\n`node scripts/tools/manage_approvals.js list`"}
            ]
        }
    }

def send_feishu(card):
    """发送飞书 Webhook"""
    if not FEISHU_WEBHOOK:
        print("[Adam] 未配置 FEISHU_WEBHOOK_URL，跳过推送")
        return False

    data = json.dumps(card).encode('utf-8')
    req = urllib.request.Request(
        FEISHU_WEBHOOK,
        data=data,
        headers={'Content-Type': 'application/json'}
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read())
            return result.get('code', -1) == 0
    except Exception as e:
        print(f"[Adam] 飞书推送失败: {e}")
        return False

def main():
    last_id = get_last_notified_id()
    approvals = get_pending_approvals(last_id)

    if not approvals:
        print(f"[Adam] 无新待批复事项 (last_id={last_id})")
        return

    print(f"[Adam] 发现 {len(approvals)} 条待批复")

    if DRY_RUN:
        print("[Adam] DRY-RUN 模式，不推送")
        for a in approvals:
            print(f"  #{a['id']} [{a['approval_type']}] by {a['requested_by']}")
        return

    card = build_feishu_card(approvals)
    success = send_feishu(card)

    if success:
        max_id = max(a['id'] for a in approvals)
        save_last_notified_id(max_id)
        print(f"[Adam] 推送成功，已更新 last_id={max_id}")
    else:
        print("[Adam] 推送失败或未配置 Webhook")

if __name__ == "__main__":
    main()
