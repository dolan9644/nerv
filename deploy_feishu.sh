#!/bin/bash
# ═══ NERV 飛書長連接持久化部署腳本 ═══

NERV_DIR="/Users/dolan/.openclaw/nerv"
PLIST_PATH="/Users/dolan/Library/LaunchAgents/com.nerv.misato.plist"
VENV_DIR="$NERV_DIR/.venv"

echo "🗡️ [NERV] 開始部署飛書長連接服務..."

# 1. 確保虛擬環境就緒
if [ ! -d "$VENV_DIR" ]; then
    echo "📦 創建虛擬環境..."
    /usr/bin/python3 -m venv "$VENV_DIR"
fi

echo "📥 安裝依賴 (lark-oapi, python-dotenv)..."
"$VENV_DIR/bin/pip" install --upgrade pip
"$VENV_DIR/bin/pip" install lark-oapi python-dotenv

# 2. 獲取 Python 絕對路徑
PYTHON_BIN="$VENV_DIR/bin/python3"
SCRIPT_PATH="$NERV_DIR/scripts/feishu_gateway.py"

# 3. 生成 LaunchAgent 配置文件
echo "配置文件: $PLIST_PATH"
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

# 4. 載入服務
echo "🚀 載入服務..."
launchctl unload "$PLIST_PATH" 2>/dev/null
launchctl load "$PLIST_PATH"

echo "========================================="
echo "✅ 部署完成！"
echo "📡 美里現在應該已經通過長連接上線了。"
echo "📝 你可以通過這條命令查看運行日志:"
echo "   tail -f $NERV_DIR/feishu_gateway.log"
echo "========================================="
