#!/usr/bin/env python3
"""
███ NERV 物理校验脚本 · schema_validator.py ███

EVA-00 数据清洗的物理护城河。
在 LLM 处理前，先用硬逻辑完成字段白名单过滤和类型校验。

用法:
  python3 scripts/schema_validator.py --input data.json --schema schema.json
  python3 scripts/schema_validator.py --input data.json --keys id,title,url

schema.json 格式:
  {"required": ["id","title","url"], "optional": ["description","tags"]}
"""
import json
import sys
import argparse
import os
import sqlite3

# 静默写库路径 — 物理脚本直接写 nerv.db，零 LLM 侵入
NERV_DB = os.environ.get('NERV_DB_PATH',
    os.path.join(os.path.dirname(__file__), '..', 'data', 'db', 'nerv.db'))

def write_harness_stat(result, rejected_count=0, total=0, detail=None):
    """静默写入 harness_stats 表。失败不影响 STDOUT 输出。"""
    try:
        if not os.path.exists(NERV_DB):
            return
        conn = sqlite3.connect(NERV_DB)
        conn.execute('PRAGMA busy_timeout = 5000')  # 防 WAL 写入锁竞争
        conn.execute(
            'INSERT INTO harness_stats (harness_type, task_id, result, detail) VALUES (?, ?, ?, ?)',
            ('schema_validator', os.environ.get('TASK_ID'), result, json.dumps({
                'total': total,
                'rejected_count': rejected_count,
                'detail': detail
            }, ensure_ascii=False) if detail or rejected_count else None)
        )
        conn.commit()
        conn.close()
    except Exception:
        pass  # 静默失败：面板数据缺失远好于脚本崩溃

def load_schema(schema_path=None, keys_csv=None):
    if schema_path and os.path.exists(schema_path):
        with open(schema_path, 'r', encoding='utf-8') as f:
            schema = json.load(f)
        return set(schema.get('required', [])), set(schema.get('optional', []))
    elif keys_csv:
        keys = [k.strip() for k in keys_csv.split(',') if k.strip()]
        return set(keys), set()
    else:
        return set(), set()

def validate(data, required, optional):
    allowed = required | optional
    valid = []
    rejected = []

    for i, record in enumerate(data):
        if not isinstance(record, dict):
            rejected.append({"index": i, "reason": "非 Object 类型", "data": record})
            continue

        # 检查必填字段
        missing = required - set(record.keys())
        if missing:
            rejected.append({
                "index": i,
                "reason": f"缺少必填字段: {', '.join(sorted(missing))}",
                "data": {k: record.get(k) for k in list(required)[:3]}
            })
            continue

        # 剔除白名单外的杂质字段
        if allowed:
            cleaned = {k: v for k, v in record.items() if k in allowed}
        else:
            cleaned = record  # 无白名单则保留全部

        valid.append(cleaned)

    return valid, rejected

def main():
    parser = argparse.ArgumentParser(description='NERV Schema Validator — EVA-00 物理护城河')
    parser.add_argument('--input', required=True, help='输入 JSON 文件路径')
    parser.add_argument('--schema', help='Schema JSON 文件路径')
    parser.add_argument('--keys', help='逗号分隔的字段白名单 (替代 --schema)')
    parser.add_argument('--output', help='输出清洗后的 JSON 文件路径 (可选)')
    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(json.dumps({"error": f"输入文件不存在: {args.input}"}, ensure_ascii=False))
        sys.exit(1)

    try:
        with open(args.input, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"JSON 解析失败: {str(e)}"}, ensure_ascii=False))
        sys.exit(1)

    if not isinstance(data, list):
        data = [data]

    required, optional = load_schema(args.schema, args.keys)

    if not required and not optional:
        print(json.dumps({"error": "必须提供 --schema 或 --keys 参数"}, ensure_ascii=False))
        sys.exit(1)

    valid, rejected = validate(data, required, optional)

    # 数据完整性评分：供下游 Agent（Shinji/EVA-13）语义决策
    integrity_score = round(len(valid) / max(len(data), 1) * 100, 1)

    result = {
        "stats": {
            "total": len(data),
            "valid_count": len(valid),
            "rejected_count": len(rejected),
            "integrity_score": integrity_score,  # 0-100%，下游 Agent 必读
            "fields_whitelist": sorted(required | optional)
        },
        "rejected_samples": rejected[:5]  # 只展示前 5 条，防上下文爆炸
    }

    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(valid, f, ensure_ascii=False, indent=2)
        result["output_path"] = args.output

    # 静默写入 harness_stats（MAGI 面板数据源）
    write_harness_stat(
        result='PASS' if len(rejected) == 0 else 'FAIL',
        rejected_count=len(rejected),
        total=len(data),
        detail=rejected[:3] if rejected else None
    )

    print(json.dumps(result, ensure_ascii=False, indent=2))

    # 退出码语义：完整性 < 50% → 退出码 1（阻断下游）
    # 有丢弃但仍可用（≥50%）→ 退出码 0（警告但继续）
    if integrity_score < 50:
        sys.exit(1)

if __name__ == "__main__":
    main()
