#!/usr/bin/env python3
"""
🗡️ NERV 飛書長連接網關 (WebSocket 版)
直接與飛書伺服器握手 → 路由消息到 Misato
優點：無需 ngrok，無需公網 IP，隨開隨用，持久穩定
"""
import os
import json
import logging
import subprocess
import threading
from pathlib import Path
from dotenv import load_dotenv

# 嘗試導入 Lark SDK (OpenClaw 已帶)
try:
    import lark_oapi as lark
    from lark_oapi.adapter.lark_event_dispatcher import LarkEventDispatcher
    from lark_oapi.event.v1 import P2ImMessageReceiveV1
except ImportError:
    print("❌ 未找到 lark-oapi。請執行: pip3 install lark-oapi --break-system-packages (或在 venv 中安裝)")
    exit(1)

# ═══ 加載環境變量 ═══
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

APP_ID = os.getenv("FEISHU_APP_ID")
APP_SECRET = os.getenv("FEISHU_APP_SECRET")

# 日誌配置
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("NERV-Gateway")

def route_to_misato(user_text, chat_id):
    """將消息路由到 Misato 處理代碼 (保持原邏輯)"""
    logger.info(f"🗡️ [NERV] 路由到 Misato: {user_text[:50]}")
    
    # 這裡可以注入一個"處理中"的心跳消息，但為保持純淨暫時直接調用
    try:
        # 調用 OpenClaw CLI
        # 使用絕對路徑確保 launchd 運行時能找到 openclaw
        openclaw_bin = subprocess.check_output(["which", "openclaw"]).decode().strip() or "openclaw"
        
        result = subprocess.run(
            [openclaw_bin, "agent", "nerv-misato", user_text],
            capture_output=True,
            text=True,
            timeout=180,
            cwd=str(Path.home() / ".openclaw" / "nerv")
        )

        if result.returncode == 0:
            # 推送結果回飛書的邏輯交由 Misato 內部的 nerv-publisher 或直接在這裡處理回覆
            # 為保證實時反饋，我們在 gateway 層級也做一個簡單的 reply
            response_text = result.stdout.strip()
            if response_text:
                send_feishu_reply(chat_id, response_text)
        else:
            error_msg = result.stderr.strip()[-300:]
            send_feishu_reply(chat_id, f"⚠️ Misato 側執行異常:\n{error_msg}")

    except Exception as e:
        logger.error(f"❌ 執行出錯: {e}")
        send_feishu_reply(chat_id, f"❌ 系統錯誤: {str(e)}")

def send_feishu_reply(chat_id, text):
    """簡單的飛書回覆函數"""
    client = lark.Client.builder().app_id(APP_ID).app_secret(APP_SECRET).build()
    
    # 飛書消息長度限制
    if len(text) > 3000:
        text = text[:2900] + "\n...(內容過長已截斷)"
        
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
        logger.error(f"❌ 發送回覆失敗: {response.code} {response.msg}")

def do_p2_im_message_receive_v1(data: P2ImMessageReceiveV1) -> None:
    """處理接收到的消息"""
    msg = data.event.message
    if msg.message_type != "text":
        return
    
    content_json = json.loads(msg.content)
    text = content_json.get("text", "").strip()
    chat_id = msg.chat_id
    
    # 移除 @ 機器人的前綴
    if text.startswith("@"):
        parts = text.split(" ", 1)
        text = parts[1] if len(parts) > 1 else ""
    
    if not text:
        return

    # 非阻塞執行
    threading.Thread(target=route_to_misato, args=(text, chat_id)).start()

# ═══ 啟動長連接 ═══
def start_ws_client():
    event_handler = LarkEventDispatcher.builder("", "") \
        .register_p2_im_message_receive_v1(do_p2_im_message_receive_v1) \
        .build()

    cli = lark.WSClient(APP_ID, APP_SECRET, event_handler, log_level=lark.LogLevel.INFO)
    
    logger.info("=" * 50)
    logger.info("🚀 NERV 飛書長連接服務啟動成功")
    logger.info(f"📡 App ID: {APP_ID[:8]}...")
    logger.info("🗡️ 美里正通過長連接守候中...")
    logger.info("=" * 50)
    
    cli.start()

if __name__ == "__main__":
    start_ws_client()
