#!/usr/bin/env python3
"""
🗡️ NERV 飛書長連接網關 (WebSocket v1.5.3 穩定版)
==================================================
適配與修復：
1. 修正 WSClient 參數傳遞衝突 (log_level 衝突)
2. 捕獲 dotenv 缺失異常，提供優雅降級
3. 繞過 SDK 頂層循環導入 Bug
"""
import os
import json
import logging
import subprocess
import threading
import time
import sys
from pathlib import Path

# 嘗試加載 dotenv (如果不存在則降級到系統環境變量)
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent / ".env"
    load_dotenv(env_path)
except ImportError:
    pass

# ════════ 核心導入層 ════════
try:
    import lark_oapi as lark
    # 直接導入底層組件，繞過頂層循環導入
    from lark_oapi.ws.client import Client as WSClient
    from lark_oapi.event.dispatcher_handler import EventDispatcherHandler
    
    # 決定事件分發器類
    DISPATCHER_CLASS = EventDispatcherHandler
    
except ImportError as e:
    print(f"❌ 導入失敗: {e}")
    exit(1)

# ═══ 配置參數 ═══
APP_ID = os.getenv("FEISHU_APP_ID")
APP_SECRET = os.getenv("FEISHU_APP_SECRET")

# 日誌配置
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("NERV-Gateway")

def route_to_misato(user_text, chat_id):
    """將消息路由到 Misato 處理代碼"""
    logger.info(f"🗡️ [NERV] 路由到 Misato: {user_text[:50]}")
    
    try:
        openclaw_bin = "/usr/local/bin/openclaw"
        if not os.path.exists(openclaw_bin):
            openclaw_bin = "openclaw"
            
        result = subprocess.run(
            [openclaw_bin, "agent", "nerv-misato", user_text],
            capture_output=True,
            text=True,
            timeout=180,
            cwd="/Users/dolan/.openclaw/nerv"
        )

        if result.returncode == 0:
            response_text = result.stdout.strip()
            if response_text:
                send_feishu_reply(chat_id, response_text)
        else:
            error_msg = result.stderr.strip()[-300:]
            send_feishu_reply(chat_id, f"⚠️ Misato 執行異常:\n{error_msg}")

    except Exception as e:
        logger.error(f"❌ 路由出錯: {e}")

def send_feishu_reply(chat_id, text):
    """v1.x 標準發送回覆"""
    client = lark.Client.builder().app_id(APP_ID).app_secret(APP_SECRET).build()
    
    if len(text) > 3000:
        text = text[:2900] + "\n...(截断)"
        
    content = json.dumps({"text": text})
    request = lark.im.v1.CreateMessageRequest.builder() \
        .receive_id_type("chat_id") \
        .request_body(lark.im.v1.CreateMessageRequestBody.builder()
                      .receive_id(chat_id)
                      .msg_type("text")
                      .content(content)
                      .build()) \
        .build()
        
    response = client.im.v1.message.create(request)
    if not response.success():
        logger.error(f"❌ 發送失敗: {response.code} {response.msg}")

def do_p2_im_message_receive_v1(data: lark.im.v1.P2ImMessageReceiveV1) -> None:
    """消息接收回調"""
    msg = data.event.message
    if msg.message_type != "text":
        return
    
    try:
        content_json = json.loads(msg.content)
        text = content_json.get("text", "").strip()
    except:
        text = str(msg.content)

    chat_id = msg.chat_id
    
    if text.startswith("@"):
        parts = text.split(" ", 1)
        text = parts[1] if len(parts) > 1 else ""
    
    if text:
        threading.Thread(target=route_to_misato, args=(text, chat_id)).start()

# ═══ 啟動 ═══
def start_ws_client():
    # 傳入空字符串滿足 builder 的必需參數
    event_handler = DISPATCHER_CLASS.builder("", "") \
        .register_p2_im_message_receive_v1(do_p2_im_message_receive_v1) \
        .build()

    # 修正：WSClient 在某些版本中參數位置固定
    # 這裡我們明確傳入，並移除重複或衝突的關鍵字參數
    cli = WSClient(
        app_id=APP_ID, 
        app_secret=APP_SECRET, 
        event_handler=event_handler, 
        log_level=lark.LogLevel.INFO
    )
    
    logger.info("=" * 60)
    logger.info("🚀 NERV 飛書長連接 (WebSocket v1.5.3 V3.1) 啟動成功")
    logger.info(f"📡 App ID: {APP_ID[:10]}...")
    logger.info("🗡️ 美里正通過底層總線硬核守候中...")
    logger.info("=" * 60)
    
    cli.start()

if __name__ == "__main__":
    start_ws_client()
