#!/bin/bash
# ═══ NERV → 2ndSelf 单向记忆泵 ═══
# 将 NERV 的 memory_queue 产出单向复制到 2ndSelf Drop 区。
# 物理隔离：2ndSelf 随意处理副本，不影响 Rei 的提纯原件。
# 建议 Cron：每 5 分钟执行一次。

NERV_MEMORY_QUEUE="${HOME}/.openclaw/nerv/memory_queue"
SECONDSELF_DROP="${HOME}/Documents/2ndBrain Drop/nerv-lessons"

# ── 预检 ──
if [ ! -d "$NERV_MEMORY_QUEUE" ]; then
  exit 0  # memory_queue 还没创建，静默退出
fi

# 确保目标目录存在
mkdir -p "$SECONDSELF_DROP"

# 单向同步：只复制新文件，不删除目标端
rsync -a --ignore-existing \
  --include="*.json" \
  --include="*.md" \
  --exclude="*" \
  "$NERV_MEMORY_QUEUE/" "$SECONDSELF_DROP/"

# 统计
COUNT=$(ls -1 "$SECONDSELF_DROP"/*.json 2>/dev/null | wc -l | tr -d ' ')
if [ "$COUNT" -gt 0 ]; then
  echo "[NERV→2ndSelf] 已同步 $COUNT 条记忆到 Drop 区"
fi
