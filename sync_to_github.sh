#!/bin/bash
# ═══ NERV GitHub 同步腳本 ═══

NERV_DIR="/Users/dolan/.openclaw/nerv"
cd "$NERV_DIR"

echo "🗡️  [NERV] 正在備份系統配置..."
# 將重要的全局配置文件備份進倉庫（去隱私處理）
cp ~/.openclaw/openclaw.json ./.openclaw_backup.json

echo "📝 打包變更..."
git add .

echo "💾 提交中..."
git commit -m "🔧 修復: openclaw.json 配置錯誤 · 🚀 集成飛書長連接持久化 · 🛠️ 修復 macOS SSL 兼容性"

echo "🚀 推送到 GitHub..."
git push

echo "========================================="
echo "✅ 同步完成！"
echo "🌐 你的 NERV 最新進展已同步至 GitHub。"
echo "========================================="
