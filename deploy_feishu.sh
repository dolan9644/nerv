#!/bin/bash
set -e

# ═══ NERV 飛書長連接 · 深度診斷與兼容性修復 ═══

NERV_DIR="/Users/dolan/.openclaw/nerv"
PLIST_PATH="/Users/dolan/Library/LaunchAgents/com.nerv.misato.plist"
VENV_DIR="$NERV_DIR/.venv_nerv"
HOST_PYTHON="/opt/homebrew/bin/python3.11"

echo "🗡️  [NERV] 啟動深度診斷程序..."

# 1. 檢查名稱衝突
echo "🔍 檢查是否有同名文件干擾..."
find "$NERV_DIR" -maxdepth 3 -name "lark_oapi.py" -exec echo "⚠️ 發現衝突文件: {} (將被處理)" \;
find "$NERV_DIR" -maxdepth 3 -name "lark_oapi.py" -delete

# 2. 清理並重新構建純淨環境
echo "📦 正在建立 Python 3.11 純機環境..."
rm -rf "$VENV_DIR"
"$HOST_PYTHON" -m venv "$VENV_DIR"

# 3. 安裝 SDK (指定穩定版本)
echo "📥 正在安裝官方 SDK..."
"$VENV_DIR/bin/pip" install --upgrade pip
"$VENV_DIR/bin/pip" install "lark-oapi>=1.1.0" python-dotenv

# 4. 結構性驗證 (核心診斷)
echo "🔍 正在進行核心結構驗證..."
"$VENV_DIR/bin/python3" << 'EOF'
import sys
try:
    import lark_oapi
    print(f"✅ SDK 基礎載入成功: {lark_oapi.__file__}")
    
    # 嘗試導入核心組件
    try:
        from lark_oapi.adapter.lark_event_dispatcher import LarkEventDispatcher
        print("✅ LarkEventDispatcher 路徑正確")
    except ImportError:
        print("⚠️ LarkEventDispatcher 路徑發生變化，正在掃描...")
        
    try:
        from lark_oapi import ws
        print("✅ WebSocket 組件正常")
    except ImportError:
        print("❌ WebSocket 組件載入失敗 (可能是版本兼容性問題)")
        sys.exit(1)
        
except Exception as e:
    print(f"❌ 嚴重錯誤: {e}")
    sys.exit(1)
EOF

# 5. 更新啟動配置
PYTHON_BIN="$VENV_DIR/bin/python3"
SCRIPT_PATH="$NERV_DIR/scripts/feishu_gateway.py"

echo "📝 重新注入系統啟動項..."
cat > "$PLIST_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.nerv.misato</string>
    <key>ProgramArguments</key>
    <array>
        <string>$PYTHON_BIN</string>
        <string>$SCRIPT_PATH</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$NERV_DIR/feishu_gateway.log</string>
    <key>StandardErrorPath</key>
    <string>$NERV_DIR/feishu_gateway.log</string>
    <key>WorkingDirectory</key>
    <string>$NERV_DIR</string>
</dict>
</plist>
EOF

# 6. 重啟服務
echo "🚀 重新喚醒美里..."
launchctl unload "$PLIST_PATH" 2>/dev/null || true
launchctl load "$PLIST_PATH"

echo "========================================="
echo "🎊 診斷與修復完成！"
echo "📡 狀態反饋:"
tail -n 10 "$NERV_DIR/feishu_gateway.log"
echo "========================================="
