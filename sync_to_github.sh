#!/bin/bash
set -euo pipefail

NERV_DIR="${HOME}/.openclaw/nerv"
ALLOWLIST_PATH="${NERV_DIR}/.publish-local/public-docs-allowlist.txt"
RETRACT_PATH="${NERV_DIR}/.publish-local/internal-docs-retract.txt"

cd "$NERV_DIR"

read_list() {
  local file_path="$1"
  local line
  [[ -f "$file_path" ]] || return 0
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ -z "$line" ]] && continue
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    printf '%s\n' "$line"
  done < "$file_path"
}

in_exact_list() {
  local candidate="$1"
  shift
  local entry
  for entry in "$@"; do
    [[ "$candidate" == "$entry" ]] && return 0
  done
  return 1
}

in_retract_list() {
  local candidate="$1"
  shift
  local entry
  for entry in "$@"; do
    [[ "$candidate" == "$entry" ]] && return 0
    [[ "$candidate" == "$entry/"* ]] && return 0
  done
  return 1
}

stage_retract_targets() {
  local target
  for target in "${RETRACT_TARGETS[@]}"; do
    if git ls-files -- "$target" | grep -q .; then
      git add -u -- "$target"
    fi
  done
}

validate_example_placeholders() {
  local env_example="${NERV_DIR}/.env.example"
  local key line value
  local -a sensitive_keys=(
    "FEISHU_APP_ID"
    "FEISHU_APP_SECRET"
    "FEISHU_VERIFY_TOKEN"
    "FEISHU_ENCRYPT_KEY"
    "VOLCENGINE_ACCESS_KEY_ID"
    "VOLCENGINE_SECRET_ACCESS_KEY"
    "NERV_OBJECT_STORAGE_ACCESS_KEY_ID"
    "NERV_OBJECT_STORAGE_SECRET_ACCESS_KEY"
  )

  [[ -f "$env_example" ]] || return 0

  for key in "${sensitive_keys[@]}"; do
    line=$(grep -E "^${key}=" "$env_example" | tail -n 1 || true)
    if [[ -z "$line" ]]; then
      echo "🚨 .env.example 缺少敏感占位字段：$key"
      exit 1
    fi
    value="${line#*=}"
    if [[ -n "$value" && ! "$value" =~ ^your_ ]]; then
      echo "🚨 .env.example 中 $key 不是占位值：$value"
      exit 1
    fi
  done
}

validate_public_surface_alignment() {
  local path
  local -a tracked_public_docs=()
  local -a unexpected_public_docs=()

  while IFS= read -r path; do
    [[ -n "$path" ]] && tracked_public_docs+=("$path")
  done < <(git ls-tree --name-only -r HEAD docs)

  for path in "${tracked_public_docs[@]}"; do
    if ! in_exact_list "$path" "${PUBLIC_FILES[@]}"; then
      unexpected_public_docs+=("$path")
    fi
  done

  if [[ "${#unexpected_public_docs[@]}" -gt 0 ]]; then
    echo "🚨 当前公开 docs 面存在未列入白名单的已跟踪文件，请先撤回："
    printf ' - %s\n' "${unexpected_public_docs[@]}"
    exit 1
  fi
}

validate_staged_sensitive_paths() {
  local path
  local -a blocked=()

  for path in "${STAGED_FILES[@]}"; do
    if [[ "$path" =~ (^|/)\.env($|\.) ]] || \
       [[ "$path" =~ (^|/)openclaw_backup\.json$ ]] || \
       [[ "$path" =~ (^|/)openclaw\.json\.bak ]] || \
       [[ "$path" =~ (^|/).+\.bak($|\.) ]] || \
       [[ "$path" =~ (^|/).+\.(pem|key|secret)$ ]]; then
      blocked+=("$path")
    fi
  done

  if [[ "${#blocked[@]}" -gt 0 ]]; then
    echo "🚨 staged 集中发现敏感或备份类文件，终止同步："
    printf ' - %s\n' "${blocked[@]}"
    exit 1
  fi
}

if [[ ! -f "$ALLOWLIST_PATH" ]]; then
  echo "🚨 缺少 allowlist：$ALLOWLIST_PATH"
  exit 1
fi

declare -a PUBLIC_FILES=()
declare -a RETRACT_TARGETS=()
declare -a STAGED_FILES=()
declare -a OUT_OF_SCOPE=()

while IFS= read -r line; do
  [[ -n "$line" ]] && PUBLIC_FILES+=("$line")
done < <(read_list "$ALLOWLIST_PATH")

while IFS= read -r line; do
  [[ -n "$line" ]] && RETRACT_TARGETS+=("$line")
done < <(read_list "$RETRACT_PATH")

if [[ "${#PUBLIC_FILES[@]}" -eq 0 ]]; then
  echo "🚨 allowlist 为空，终止同步。"
  exit 1
fi

validate_example_placeholders
validate_public_surface_alignment

while IFS= read -r line; do
  [[ -n "$line" ]] && STAGED_FILES+=("$line")
done < <(git diff --cached --name-only)
if [[ "${#STAGED_FILES[@]}" -gt 0 ]]; then
  for path in "${STAGED_FILES[@]}"; do
    if ! in_exact_list "$path" "${PUBLIC_FILES[@]}" && ! in_retract_list "$path" "${RETRACT_TARGETS[@]}"; then
      OUT_OF_SCOPE+=("$path")
    fi
  done
  if [[ "${#OUT_OF_SCOPE[@]}" -gt 0 ]]; then
    echo "🚨 发现非白名单 staged 文件，终止同步："
    printf ' - %s\n' "${OUT_OF_SCOPE[@]}"
    exit 1
  fi
fi

echo "🗡️  [NERV] 正在預檢安全項..."
DANGEROUS_FILES=("openclaw_backup.json" ".env" "openclaw.json.bak")
for f in "${DANGEROUS_FILES[@]}"; do
  if git ls-files --cached "$f" 2>/dev/null | grep -q .; then
    echo "🚨 [安全] 检测到 $f 在 Git 中！正在移除..."
    git rm --cached "$f" 2>/dev/null
  fi
done

echo "🧹 清理 staged 狀態..."
git restore --staged .

echo "🗂️  按白名單與撤回清單重建 staged 集..."
stage_retract_targets
git add -- "${PUBLIC_FILES[@]}"

STAGED_FILES=()
while IFS= read -r line; do
  [[ -n "$line" ]] && STAGED_FILES+=("$line")
done < <(git diff --cached --name-only)
if [[ "${#STAGED_FILES[@]}" -eq 0 ]]; then
  echo "ℹ️ 沒有可發布或可撤回的變更。"
  exit 0
fi

validate_staged_sensitive_paths

OUT_OF_SCOPE=()
for path in "${STAGED_FILES[@]}"; do
  if ! in_exact_list "$path" "${PUBLIC_FILES[@]}" && ! in_retract_list "$path" "${RETRACT_TARGETS[@]}"; then
    OUT_OF_SCOPE+=("$path")
  fi
done
if [[ "${#OUT_OF_SCOPE[@]}" -gt 0 ]]; then
  echo "🚨 重建 staged 集後仍发现越界文件，终止同步："
  printf ' - %s\n' "${OUT_OF_SCOPE[@]}"
  exit 1
fi

echo "📋 本次 staged 清單："
git diff --cached --name-status

echo "💾 提交中..."
TIMESTAMP=$(date +%Y-%m-%d_%H:%M)
git commit -m "sync: NERV public surface $TIMESTAMP"

echo "🚀 推送到 GitHub..."
git push

echo "========================================="
echo "✅ 同步完成！"
echo "🌐 已按白名單同步公開面。"
echo "========================================="
