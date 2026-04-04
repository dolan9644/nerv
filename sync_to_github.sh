#!/bin/bash
# ═══ NERV GitHub 同步腳本 ═══

NERV_DIR="/Users/dolan/.openclaw/nerv"
cd "$NERV_DIR"

echo "🗡️  [NERV] 正在預檢安全項..."

# ⚠️ 安全检查：确保不会意外提交含密钥的文件
DANGEROUS_FILES=("openclaw_backup.json" ".env" "openclaw.json.bak")
for f in "${DANGEROUS_FILES[@]}"; do
  if git ls-files --cached "$f" 2>/dev/null | grep -q .; then
    echo "🚨 [安全] 检测到 $f 在 Git 中！正在移除..."
    git rm --cached "$f" 2>/dev/null
  fi
done

echo "📝 打包變更..."
git add .

echo "💾 提交中..."
TIMESTAMP=$(date +%Y-%m-%d_%H:%M)
git commit -m "sync: NERV $TIMESTAMP"

echo "🚀 推送到 GitHub..."
git push

echo "========================================="
echo "✅ 同步完成！"
echo "🌐 你的 NERV 最新進展已同步至 GitHub。"
echo "========================================="
