#!/usr/bin/env python3
"""
███ NERV · Adam 通知器 · adam_notifier.py ███

NERV 与造物主之间的唯一信使。
通过飞书 Webhook 向造物主推送通知，不依赖任何 Agent Session。

═══ 两种工作模式 ═══

模式 A — 审批推送（Cron 定时触发）:
  python3 scripts/adam_notifier.py scan                # 扫描 pending_approvals 并推送
  python3 scripts/adam_notifier.py scan --dry-run      # 只检查不推送

模式 B — 通用推送（任何 Agent 通过 exec 调用）:
  python3 scripts/adam_notifier.py notify --title "DAG 完成" --msg "详细内容..."
  python3 scripts/adam_notifier.py notify --title "任务完成" --msg "..." --level success --source misato
  python3 scripts/adam_notifier.py notify --json '{"title":"xxx","body":"yyy"}'

级别 (--level): info(蓝) | success(绿) | warning(橙) | error(红)

═══ 环境变量 ═══

  FEISHU_WEBHOOK_URL — 飞书群组机器人 Webhook 地址（从 nerv/.env 自动加载）

═══ 部署 ═══

  1. 在飞书群中添加一个自定义机器人，获取 Webhook URL
  2. 写入 nerv/.env:  FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/xxx
  3. 完成。所有 NERV Agent 的通知都会推到这个群。
"""
import json
import os
import sys
import sqlite3
import urllib.request
import argparse
from datetime import datetime
from pathlib import Path
from nerv_paths import NERV_ROOT, get_nerv_db_path

# ═══════════════════════════════════════════════════════════════
# 环境加载
# ═══════════════════════════════════════════════════════════════

# 自动加载 nerv/.env
_env_path = Path(__file__).parent.parent / ".env"
if _env_path.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(_env_path)
    except ImportError:
        # 手动解析
        with open(_env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, val = line.split('=', 1)
                    os.environ.setdefault(key.strip(), val.strip())

# ═══════════════════════════════════════════════════════════════
# 配置
# ═══════════════════════════════════════════════════════════════

NERV_ROOT = str(NERV_ROOT)
FEISHU_WEBHOOK = os.environ.get('FEISHU_WEBHOOK_URL', '')
DB_PATH = get_nerv_db_path()

STATE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.adam_last_notified_id')

# ═══════════════════════════════════════════════════════════════
# 飞书推送（共用）
# ═══════════════════════════════════════════════════════════════

LEVEL_COLORS = {'info': 'blue', 'success': 'green', 'warning': 'orange', 'error': 'red'}
LEVEL_ICONS  = {'info': 'ℹ️', 'success': '✅', 'warning': '⚠️', 'error': '🚨'}

def send_feishu(card):
    """推送卡片到飞书 Webhook"""
    if not FEISHU_WEBHOOK:
        print(json.dumps({"status": "error", "msg": "未配置 FEISHU_WEBHOOK_URL"}))
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
            ok = result.get('code', -1) == 0
            if ok:
                print(json.dumps({"status": "ok", "msg": "推送成功"}))
            else:
                print(json.dumps({"status": "error", "msg": f"飞书返回: {result}"}))
            return ok
    except Exception as e:
        print(json.dumps({"status": "error", "msg": str(e)}))
        return False

# ═══════════════════════════════════════════════════════════════
# 模式 A：审批推送（scan）
# ═══════════════════════════════════════════════════════════════

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
    if not os.path.exists(DB_PATH):
        return []
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            'SELECT * FROM pending_approvals WHERE status = ? AND id > ? ORDER BY created_at DESC',
            ('PENDING', min_id)
        ).fetchall()
        return [dict(r) for r in rows]
    except sqlite3.OperationalError:
        return []
    finally:
        conn.close()

def build_approval_card(approvals):
    items = []
    for a in approvals[:5]:
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

def cmd_scan(args):
    """扫描 pending_approvals 并推送"""
    last_id = get_last_notified_id()
    approvals = get_pending_approvals(last_id)

    if not approvals:
        print(json.dumps({"status": "ok", "msg": f"无新待批复 (last_id={last_id})"}))
        return

    if args.dry_run:
        for a in approvals:
            print(f"  #{a['id']} [{a['approval_type']}] by {a['requested_by']}")
        return

    card = build_approval_card(approvals)
    success = send_feishu(card)

    if success:
        max_id = max(a['id'] for a in approvals)
        save_last_notified_id(max_id)

# ═══════════════════════════════════════════════════════════════
# 模式 B：通用推送（notify）
# ═══════════════════════════════════════════════════════════════

def build_notify_card(title, body, level='info', source=None):
    color = LEVEL_COLORS.get(level, 'blue')
    icon = LEVEL_ICONS.get(level, 'ℹ️')

    elements = [{"tag": "markdown", "content": body}]
    if source:
        elements.append({"tag": "markdown", "content": f"---\n📡 来源: `{source}`"})

    return {
        "msg_type": "interactive",
        "card": {
            "header": {
                "title": {"tag": "plain_text", "content": f"{icon} NERV · {title}"},
                "template": color
            },
            "elements": elements
        }
    }

def cmd_notify(args):
    """推送自定义通知"""
    if args.json:
        try:
            data = json.loads(args.json)
            title = data.get('title', 'NERV 通知')
            body = data.get('body', data.get('msg', ''))
            level = data.get('level', 'info')
            source = data.get('source', None)
        except json.JSONDecodeError as e:
            print(json.dumps({"status": "error", "msg": f"JSON 解析失败: {e}"}))
            sys.exit(1)
    else:
        title = args.title
        body = args.msg
        level = args.level
        source = args.source

    if not body:
        print(json.dumps({"status": "error", "msg": "消息为空，使用 --msg 或 --json"}))
        sys.exit(1)

    card = build_notify_card(title, body, level, source)

    if args.dry_run:
        print(json.dumps(card, indent=2, ensure_ascii=False))
        return

    success = send_feishu(card)
    sys.exit(0 if success else 1)

# ═══════════════════════════════════════════════════════════════
# CLI 入口
# ═══════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description='NERV · Adam 通知器 — 造物主的唯一信使',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    sub = parser.add_subparsers(dest='command')

    # scan 子命令
    p_scan = sub.add_parser('scan', help='扫描 pending_approvals 并推送')
    p_scan.add_argument('--dry-run', action='store_true')

    # notify 子命令
    p_notify = sub.add_parser('notify', help='推送自定义通知')
    p_notify.add_argument('--title', default='NERV 通知', help='卡片标题')
    p_notify.add_argument('--msg', default='', help='消息正文 (Markdown)')
    p_notify.add_argument('--level', default='info', choices=['info', 'success', 'warning', 'error'])
    p_notify.add_argument('--source', default=None, help='来源 Agent ID')
    p_notify.add_argument('--json', default=None, help='JSON: {"title":"...","body":"..."}')
    p_notify.add_argument('--dry-run', action='store_true')

    args, remaining = parser.parse_known_args()

    # 兼容旧调用方式（无子命令 = scan）
    if not args.command:
        args.dry_run = '--dry-run' in sys.argv
        args.command = 'scan'

    if args.command == 'scan':
        cmd_scan(args)
    elif args.command == 'notify':
        cmd_notify(args)

if __name__ == '__main__':
    main()
