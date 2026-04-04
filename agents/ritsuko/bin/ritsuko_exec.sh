#!/bin/bash
# ███ NERV · ritsuko_exec.sh — 电木封装层 (Bakelite Shell) ███
#
# 用法: bash agents/ritsuko/bin/ritsuko_exec.sh <command...>
# 遵循 SOUL.md 的 Stdout 截断协议 (Harness v3.0)
#
# 修复日志:
#   v3.0 — 移除 eval（Critical 安全漏洞），改用 "$@" 直接执行
#        — 增加 trap 清理临时文件（防 /tmp 泄漏）
#        — 错误敏感截断：EXIT_CODE != 0 时保留更多 tail

TMP_OUT=$(mktemp)
TMP_ERR=$(mktemp)

# 陷阱：确保异常退出时也清理临时文件
trap "rm -f '$TMP_OUT' '$TMP_ERR'" INT TERM EXIT

# 直接执行命令（严禁 eval，防止注入攻击）
"$@" > "$TMP_OUT" 2> "$TMP_ERR"
EXIT_CODE=$?

LINE_COUNT=$(wc -l < "$TMP_OUT" | tr -d ' ')

if [ "$LINE_COUNT" -le 100 ]; then
    cat "$TMP_OUT"
elif [ "$EXIT_CODE" -ne 0 ]; then
    # 错误敏感截断：失败时保留更多 tail（错误栈通常在尾部）
    head -n 30 "$TMP_OUT"
    echo ""
    echo "[WARNING: Output truncated ($((LINE_COUNT - 80)) lines omitted). EXIT_CODE=$EXIT_CODE — potential error info below]"
    echo ""
    tail -n 50 "$TMP_OUT"
else
    # 正常截断
    head -n 50 "$TMP_OUT"
    echo "... [已截断 $((LINE_COUNT - 70)) 行] ..."
    tail -n 20 "$TMP_OUT"
fi

# 错误输出始终保留（上限200行）
if [ -s "$TMP_ERR" ]; then
    echo "--- STDERR ---"
    head -n 200 "$TMP_ERR"
fi

# trap 会自动清理临时文件
exit $EXIT_CODE
