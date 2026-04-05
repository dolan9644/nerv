#!/usr/bin/env python3
"""
███ NERV · 通用通知器 · nerv_notify.py ███

通过飞书 Webhook 向造物主推送任意消息。
与 session 完全解耦——不依赖任何 Agent 的 session 上下文。

用法:
  python3 scripts/nerv_notify.py --title "任务完成" --msg "详细内容..."
  python3 scripts/nerv_notify.py --title "DAG 完成" --msg "产出: ..." --level info
  python3 scripts/nerv_notify.py --json '{"title":"xxx","body":"yyy"}'

级别 (--level):
  info    — 蓝色卡片（默认）
  success — 绿色卡片
  warning — 橙色卡片
  error   — 红色卡片

环境变量:
  FEISHU_WEBHOOK_URL — 飞书群组机器人 Webhook 地址（从 nerv/.env 自动加载）

退出码:
  0 — 推送成功
  1 — 推送失败或缺少配置
"""
import json
import os
import sys
import urllib.request
import argparse
from pathlib import Path

# 自动加载 nerv/.env
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent / ".env"
    load_dotenv(env_path)
except ImportError:
    # 手动解析 .env
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, val = line.split('=', 1)
                    os.environ.setdefault(key.strip(), val.strip())

FEISHU_WEBHOOK = os.environ.get('FEISHU_WEBHOOK_URL', '')

LEVEL_COLORS = {
    'info': 'blue',
    'success': 'green',
    'warning': 'orange',
    'error': 'red',
}

LEVEL_ICONS = {
    'info': 'ℹ️',
    'success': '✅',
    'warning': '⚠️',
    'error': '🚨',
}

def build_card(title, body, level='info', source=None):
    """构建飞书卡片"""
    color = LEVEL_COLORS.get(level, 'blue')
    icon = LEVEL_ICONS.get(level, 'ℹ️')
    
    header_text = f"{icon} NERV · {title}"
    
    elements = [
        {"tag": "markdown", "content": body}
    ]
    
    if source:
        elements.append({
            "tag": "markdown",
            "content": f"---\n📡 来源: `{source}`"
        })
    
    return {
        "msg_type": "interactive",
        "card": {
            "header": {
                "title": {"tag": "plain_text", "content": header_text},
                "template": color
            },
            "elements": elements
        }
    }

def send_feishu(card):
    """推送到飞书 Webhook"""
    if not FEISHU_WEBHOOK:
        print('[nerv_notify] 未配置 FEISHU_WEBHOOK_URL', file=sys.stderr)
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

def main():
    parser = argparse.ArgumentParser(description='NERV 通用通知器')
    parser.add_argument('--title', default='NERV 通知', help='卡片标题')
    parser.add_argument('--msg', default='', help='消息正文（Markdown）')
    parser.add_argument('--level', default='info', choices=['info', 'success', 'warning', 'error'])
    parser.add_argument('--source', default=None, help='来源 Agent ID')
    parser.add_argument('--json', default=None, help='JSON 格式输入: {"title":"...","body":"...","level":"..."}')
    parser.add_argument('--dry-run', action='store_true', help='只构建卡片不推送')
    args = parser.parse_args()
    
    # JSON 模式
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
        print(json.dumps({"status": "error", "msg": "消息内容为空，使用 --msg 或 --json"}))
        sys.exit(1)
    
    card = build_card(title, body, level, source)
    
    if args.dry_run:
        print(json.dumps(card, indent=2, ensure_ascii=False))
        return
    
    success = send_feishu(card)
    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()
