#!/usr/bin/env bash
# ███████████████████████████████████████████████████████████████
# ██  NERV 本部战术系统 · 卸载脚本                           ██
# ██  干净移除所有 NERV 组件，恢复原始 openclaw.json          ██
# ██  不会删除用户的其他 Agent 和数据                         ██
# ███████████████████████████████████████████████████████████████

set -euo pipefail

NERV_ROOT="${HOME}/.openclaw/nerv"
OC_CONFIG="${HOME}/.openclaw/openclaw.json"
OC_CONFIG_BAK="${OC_CONFIG}.pre-nerv.bak"
NERV_MARKER="${NERV_ROOT}/.nerv_installed"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()   { echo -e "${GREEN}[NERV]${NC} $1"; }
warn()  { echo -e "${YELLOW}[NERV·WARN]${NC} $1"; }
error() { echo -e "${RED}[NERV·ERROR]${NC} $1"; }

echo ""
echo -e "${RED}███ NERV 本部战术系统 · 卸载 ███${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════
# 确认
# ═══════════════════════════════════════════════════════════════

if [ ! -f "${NERV_MARKER}" ]; then
  error "未检测到 NERV 安装标记。可能尚未安装或已被卸载。"
  exit 1
fi

echo "即将执行以下操作："
echo "  1. 从 openclaw.json 移除所有 nerv-* Agent"
echo "  2. 删除 ${NERV_ROOT}/data/ 目录（含 nerv.db 和备份）"
echo "  3. 保留 ${NERV_ROOT}/agents/ 下的 SOUL.md（仅供参考）"
echo "  4. 恢复安装前的 openclaw.json 备份"
echo ""
echo -e "${YELLOW}注意：此操作不会影响你其他的 Agent（elon/bibi-agent/xiaowang 等）${NC}"
echo ""
read -p "确认卸载？(y/N) " -n 1 -r
echo
[[ ! $REPLY =~ ^[Yy]$ ]] && { log "取消卸载。"; exit 0; }

# ═══════════════════════════════════════════════════════════════
# 1. 从 openclaw.json 移除 NERV Agent
# ═══════════════════════════════════════════════════════════════

log "从 openclaw.json 移除 NERV Agent..."

if [ -f "${OC_CONFIG_BAK}" ]; then
  # 方案 A：直接恢复备份（最安全）
  cp "${OC_CONFIG_BAK}" "${OC_CONFIG}"
  log "✅ 已恢复安装前的 openclaw.json 备份"
else
  # 方案 B：用 Node.js 移除 nerv-* 条目 + A2A + visibility
  node -e "
    const fs = require('fs');
    const config = JSON.parse(fs.readFileSync('${OC_CONFIG}', 'utf-8'));
    const before = config.agents.list.length;
    config.agents.list = config.agents.list.filter(a => !a.id.startsWith('nerv-'));
    const after = config.agents.list.length;
    // 清理 NERV 的 A2A allowlist
    if (config.tools && config.tools.agentToAgent) {
      if (config.tools.agentToAgent.allow) {
        config.tools.agentToAgent.allow = config.tools.agentToAgent.allow.filter(id => !id.startsWith('nerv-'));
        if (config.tools.agentToAgent.allow.length === 0) delete config.tools.agentToAgent;
      }
    }
    fs.writeFileSync('${OC_CONFIG}', JSON.stringify(config, null, 2));
    console.log('移除了 ' + (before - after) + ' 个 NERV Agent');
  "
  log "✅ NERV Agent 已从 openclaw.json 移除"
fi

# ═══════════════════════════════════════════════════════════════
# 2. 清理数据
# ═══════════════════════════════════════════════════════════════

log "清理 NERV 数据..."

# 删除数据库和备份
if [ -d "${NERV_ROOT}/data" ]; then
  rm -rf "${NERV_ROOT}/data"
  log "✅ 已删除 nerv.db 和备份"
fi

# 删除安装标记
rm -f "${NERV_MARKER}"

# 删除备份的 config
rm -f "${OC_CONFIG_BAK}"

# ═══════════════════════════════════════════════════════════════
# 3. 可选：完全删除 nerv 目录
# ═══════════════════════════════════════════════════════════════

echo ""
read -p "是否完全删除 ${NERV_ROOT} 目录？（包含所有 Agent SOUL.md 和脚本）(y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  rm -rf "${NERV_ROOT}"
  log "✅ 已完全删除 NERV 目录"
else
  log "保留 NERV 目录结构（可手动删除：rm -rf ${NERV_ROOT}）"
fi

# ═══════════════════════════════════════════════════════════════
# 完成
# ═══════════════════════════════════════════════════════════════

echo ""
log "███ NERV 卸载完成 ███"
echo ""
log "请重启 Gateway 使配置生效：openclaw restart"
echo ""
log "你的其他 Agent 未受影响："

# 列出剩余 Agent
node -e "
  const fs = require('fs');
  try {
    const config = JSON.parse(fs.readFileSync('${OC_CONFIG}', 'utf-8'));
    config.agents.list.forEach(a => console.log('  ✅ ' + a.id + ' (' + a.name + ')'));
  } catch(e) {}
" 2>/dev/null || true

echo ""
