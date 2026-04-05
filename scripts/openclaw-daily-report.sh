#!/bin/bash
# ~/.openclaw/nerv/scripts/openclaw-daily-report.sh
# OpenClaw 每日状态报告生成脚本
# 执行周期：每日 Cron
# 输出：Markdown 格式，发送至飞书

set -euo pipefail

# ========== 配置 ==========
OUTPUT_DIR="$HOME/.openclaw/nerv/scripts"
REPORT_FILE="$OUTPUT_DIR/openclaw-daily-report-$(date +%Y%m%d).md"
GITHUB_REPO="openclaw/openclaw"
FEISHU_RECIPIENT="${FEISHU_RECIPIENT:-ou_1f4b717640693a155e6ebad80c184c7a}"

# 飞书 WebHook（需环境变量 LARK_WEBHOOK）
LARK_WEBHOOK="${LARK_WEBHOOK:-}"

# ========== 全局状态（避免错误注入到解析流）==========
CURL_FAILED=0
GITHUB_FAILED=0
LARK_PUSH_SKIPPED=0

# ========== 工具函数 ==========
log() { echo "[$(date +%H:%M:%S)] $1"; }

is_https_url() {
    [[ "$1" =~ ^https://[^[:space:]]+ ]] && return 0 || return 1
}

# 检查 lark-cli 是否有用户身份（能执行 user 操作）
has_lark_user_auth() {
    # 尝试以 user 身份执行一个简单查询来验证
    lark-cli contact +get-user --as user --user-id "me" >/dev/null 2>&1 && return 0 || return 1
}

# ========== 数据采集 ==========
collect_openclaw_status() {
    log "采集 OpenClaw 状态..."
    if ! STATUS_OUTPUT=$(openclaw status 2>&1); then
        log "警告：openclaw status 执行异常（非零退出码）"
        STATUS_OUTPUT=""
    fi
    echo "$STATUS_OUTPUT"
}

collect_github_updates() {
    log "拉取 GitHub 更新..."
    # 后台并行执行三个 GitHub API 调用
    gh release view --repo "$GITHUB_REPO" --json tagName,name,publishedAt > "$OUTPUT_DIR/gh_release.tmp" 2>&1 &
    local pid_release=$!

    local seven_days_ago
    seven_days_ago=$(date -d '7 days ago' +%Y-%m-%d 2>/dev/null) || \
    seven_days_ago=$(date -v-7d +%Y-%m-%d 2>/dev/null) || \
    seven_days_ago=$(TZ=Asia/Shanghai date -d '7 days ago' +%Y-%m-%d)

    gh pr list --repo "$GITHUB_REPO" --state merged --search "created:>$seven_days_ago" --limit 5 --json title,number,mergedAt,author > "$OUTPUT_DIR/gh_prs.tmp" 2>&1 &
    local pid_pr=$!

    gh issue list --repo "$GITHUB_REPO" --state open --limit 5 --json number,title,updatedAt > "$OUTPUT_DIR/gh_issues.tmp" 2>&1 &
    local pid_issue=$!

    # 等待所有后台任务完成
    wait $pid_release $pid_pr $pid_issue || GITHUB_FAILED=1

    # 读取结果（带错误检测）
    if ! LATEST_RELEASE=$(cat "$OUTPUT_DIR/gh_release.tmp" 2>/dev/null) || [[ -z "$LATEST_RELEASE" ]]; then
        LATEST_RELEASE="无法获取 Release 信息"
        GITHUB_FAILED=1
    fi
    if ! LATEST_PR=$(cat "$OUTPUT_DIR/gh_prs.tmp" 2>/dev/null) || [[ -z "$LATEST_PR" ]]; then
        LATEST_PR="无法获取 PR 信息"
        GITHUB_FAILED=1
    fi
    if ! RECENT_ISSUES=$(cat "$OUTPUT_DIR/gh_issues.tmp" 2>/dev/null) || [[ -z "$RECENT_ISSUES" ]]; then
        RECENT_ISSUES="无法获取 Issue 信息"
        GITHUB_FAILED=1
    fi

    # 清理临时文件
    rm -f "$OUTPUT_DIR/gh_release.tmp" "$OUTPUT_DIR/gh_prs.tmp" "$OUTPUT_DIR/gh_issues.tmp"

    echo "RELEASE:$LATEST_RELEASE"
    echo "---PRS---"
    echo "$LATEST_PR"
    echo "---ISSUES---"
    echo "$RECENT_ISSUES"
}

collect_system_metrics() {
    local status_output="$1"
    # Agent 数量（更健壮的解析）
    AGENT_COUNT=$(echo "$status_output" | grep -E "Agents[[:space:]]" | grep -oE '[0-9]+' | head -1 || echo "N/A")
    # Session 数量
    SESSION_COUNT=$(echo "$status_output" | grep -iE "sessions?[[:space:]]" | grep -oE '[0-9]+' | head -1 || echo "N/A")
    # Gateway 状态
    GATEWAY_STATUS=$(echo "$status_output" | grep -iE "Gateway[[:space:]]" | awk '{print $NF}' | tr -d '·' || echo "N/A")
    # Memory files
    MEMORY_FILES=$(echo "$status_output" | grep -iE "Memory[[:space:]]" | grep -oE '[0-9]+ files' || echo "N/A")
    # Active tasks
    TASK_COUNT=$(echo "$status_output" | grep -iE "Tasks?[[:space:]]" | grep -oE '[0-9]+ active' | head -1 || echo "N/A")
    echo "$AGENT_COUNT|$SESSION_COUNT|$GATEWAY_STATUS|$MEMORY_FILES|$TASK_COUNT"
}

collect_anomaly_counts() {
    local status_output="$1"
    local orphan_count issue_count missed_count

    orphan_count=$(echo "$status_output" | grep -ic "ORPHAN" 2>/dev/null || echo "0")
    issue_count=$(echo "$status_output" | grep -ic "CIRCUIT" 2>/dev/null || echo "0")
    missed_count=$(echo "$status_output" | grep -ic "missed" 2>/dev/null || echo "0")

    echo "$orphan_count|$issue_count|$missed_count"
}

# ========== Markdown 报告生成 ==========
generate_report() {
    log "生成 Markdown 报告..."
    local status_output="$1"
    METRICS=$(collect_system_metrics "$status_output")
    IFS='|' read -r AGENT_COUNT SESSION_COUNT GATEWAY_STATUS MEMORY_FILES TASK_COUNT <<< "$METRICS"

    ANOMALY=$(collect_anomaly_counts "$status_output")
    IFS='|' read -r ORPHAN_COUNT CIRCUIT_COUNT MISSED_COUNT <<< "$ANOMALY"

    # GitHub 数据解析
    GH_DATA=$(collect_github_updates)

    # 动态日期
    REPORT_DATE=$(TZ=Asia/Shanghai date +"%Y-%m-%d %H:%M %Z")
    local seven_days_ago
    seven_days_ago=$(date -d '7 days ago' +%Y-%m-%d 2>/dev/null) || \
    seven_days_ago=$(date -v-7d +%Y-%m-%d 2>/dev/null) || \
    seven_days_ago=$(TZ=Asia/Shanghai date -d '7 days ago' +%Y-%m-%d)

    cat > "$REPORT_FILE" << EOF
# 🛡️ OpenClaw 每日战报

**报告时间**：$REPORT_DATE
**节点**：EVA-01 初号机 · Tang's Mac Studio

---

## 【重点更新】

### GitHub 最新动态

**最新 Release：**
\`\`\`
$(echo "$GH_DATA" | grep -A3 "^RELEASE:" | tail -3)
\`\`\`

**近期 Merged PRs（$seven_days_ago 至今）：**
\`\`\`
$(echo "$GH_DATA" | awk '/---PRS---/,/---ISSUES---/' | grep -v "^---" | head -10)
\`\`\`

**活跃 Issues：**
\`\`\`
$(echo "$GH_DATA" | awk '/---ISSUES---/,0' | grep -v "^---" | head -10)
\`\`\`

---

## 【分类汇总】

### 平台状态
| 项目 | 状态 |
|:-----|:-----|
| Gateway | $GATEWAY_STATUS |
| Agents 注册数 | $AGENT_COUNT |
| 活跃 Sessions | $SESSION_COUNT |
| 活跃 Tasks | $TASK_COUNT |
| Memory 文件 | $MEMORY_FILES |

### NERV 体系
| 节点 | 状态 |
|:-----|:-----|
| EVA-01（部署终端） | 🟢 就绪 |
| Spear Sync | $([ -f "$HOME/.openclaw/nerv/scripts/spear_sync.js" ] && echo "🟢 活跃" || echo "🔴 异常") |
| Code Runner（沙箱） | 🟢 待命 |

### 异常监控
| 类型 | 当前 |
|:-----|:-----|
| Orphan 节点 | $ORPHAN_COUNT |
| Circuit Break | $CIRCUIT_COUNT |
| Missed Dispatch | $MISSED_COUNT |

---

## 【数据】

### openclaw status 原始输出
\`\`\`
${status_output:-"（无数据）"}
\`\`\`

### 报告生成路径
\`$REPORT_FILE\`

---
*由 EVA-01 初号机自动生成 · NERV 作战体系*
EOF
    log "报告已生成：$REPORT_FILE"
}

# ========== 飞书推送 ==========
send_to_feishu() {
    log "准备飞书推送..."

    # 优先使用 WebHook
    if [ -n "$LARK_WEBHOOK" ]; then
        # URL 校验
        if ! is_https_url "$LARK_WEBHOOK"; then
            log "错误：LARK_WEBHOOK 不是合法的 HTTPS URL，跳过推送"
            CURL_FAILED=1
            return 1
        fi

        # 使用 WebHook 推送（富文本消息）
        if ! curl -s -X POST "$LARK_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{
                \"msg_type\": \"text\",
                \"content\": {\"text\": \"【OpenClaw 每日战报】\\n报告已生成：$REPORT_FILE\\n\\n请查看完整报告。\"}
            }" > /dev/null; then
            log "错误：飞书 WebHook 推送失败"
            CURL_FAILED=1
            return 1
        fi
        log "飞书 WebHook 推送成功"
        return 0
    fi

    # 回退到 lark-cli（仅当有用户认证时）
    log "LARK_WEBHOOK 未配置，尝试 lark-cli..."

    # 检查是否有用户身份（避免 open_id cross app 错误）
    if ! has_lark_user_auth; then
        log "警告：lark-cli 无用户身份（open_id cross app 问题），跳过飞书推送"
        log "提示：设置 LARK_WEBHOOK 环境变量以启用 WebHook 推送"
        LARK_PUSH_SKIPPED=1
        return 0  # 不算错误，报告已生成
    fi

    if ! lark-cli im +messages-send --user-id "$FEISHU_RECIPIENT" --text "【OpenClaw 每日战报】报告已生成：$REPORT_FILE" >/dev/null 2>&1; then
        log "错误：lark-cli 推送失败（可能 open_id cross app）"
        CURL_FAILED=1
        return 1
    fi
    log "lark-cli 推送成功"
    return 0
}

# ========== 主流程 ==========
main() {
    log "========== OpenClaw Daily Report START =========="
    STATUS_OUTPUT=$(collect_openclaw_status)
    generate_report "$STATUS_OUTPUT"
    send_to_feishu

    # 退出码逻辑：仅 GitHub 严重失败才非零退出
    # 飞书推送失败不导致脚本失败（报告已生成）
    if [[ $GITHUB_FAILED -eq 1 ]]; then
        log "警告：GitHub 数据获取失败"
        exit 1
    fi

    if [[ $CURL_FAILED -eq 1 ]]; then
        log "警告：飞书推送失败，但报告已生成：$REPORT_FILE"
        exit 1
    fi

    log "========== OpenClaw Daily Report END =========="
    echo "$REPORT_FILE"
}

main "$@"