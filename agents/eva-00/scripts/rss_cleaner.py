#!/usr/bin/env python3
"""
EVA-00 RSS Cleaner
合并、去重、评分、排名的清洗脚本
"""
import json
import os
from datetime import datetime
from collections import defaultdict

# === 配置 ===
OUTPUT_PATH = "/Users/dolan/.openclaw/nerv/data/rss-ranked/2026-04-08.json"
INPUT_BATCHES = [
    "/Users/dolan/.openclaw/nerv/data/rss-raw/2026-04-07/120001/raw.json",
    "/Users/dolan/.openclaw/nerv/data/rss-raw/2026-04-07/180001/raw.json",
    "/Users/dolan/.openclaw/nerv/data/rss-raw/2026-04-08/000001/raw.json",
    "/Users/dolan/.openclaw/nerv/data/rss-raw/2026-04-08/060000/raw.json",
]

# === 计分权重 ===
TIER_SCORES = {
    "T0": 100,
    "T1": 80,
    "T2": 50,
    "T3": 30,
    "PERSONAL": 20,
}

SOURCE_CREDIBILITY = {
    "The Verge": 10,
    "TechCrunch": 10,
    "36kr": 9,
    "Simon Willison": 9,
    "Hacker News": 7,
    "KrebsOnSecurity": 9,
    "Daring Fireball": 8,
    "Shkspr": 6,
    "Nesbitt": 6,
    "Giles Thomas": 7,
}

# === 时间窗口 ===
WINDOW_START_MS = 1775520000000  # 2026-04-07 00:00:00 UTC+8
WINDOW_END_MS = 1775606400000   # 2026-04-08 00:00:00 UTC+8

def parse_timestamp(ts_str):
    """解析各种时间格式"""
    formats = [
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%S-%04:00",
        "%Y-%m-%dT%H:%M:%S+00:00",
        "%Y-%m-%d %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S %z",
        "%Y-%m-%dT%H:%M:%S",
    ]
    ts_str = str(ts_str).strip()
    for fmt in formats:
        try:
            return datetime.strptime(ts_str, fmt).timestamp() * 1000
        except:
            pass
    try:
        return float(ts_str)
    except:
        return None

def score_entry(entry):
    """计算条目得分"""
    score = 0

    # 1. Tier 分数
    tier = entry.get("tier", "T3")
    score += TIER_SCORES.get(tier, 30)

    # 2. 来源可信度
    source = entry.get("source", "")
    score += SOURCE_CREDIBILITY.get(source, 5)

    # 3. 内容丰富度
    has_content = bool(entry.get("content") and len(entry.get("content", "")) > 100)
    has_summary = bool(entry.get("summary"))
    if has_content:
        score += 5
    elif has_summary:
        score += 2

    # 4. 完整性（有无 link/id）
    if entry.get("link"):
        score += 3
    if entry.get("id"):
        score += 2

    return score

def merge_entries():
    """合并所有批次，去重"""
    seen = set()
    entries = []

    for batch_path in INPUT_BATCHES:
        if not os.path.exists(batch_path):
            print(f"[WARN] 文件不存在: {batch_path}")
            continue

        with open(batch_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        batch_entries = data.get("entries", [])
        print(f"[INFO] 批次 {batch_path}: {len(batch_entries)} 条")

        for entry in batch_entries:
            # 唯一键：优先用 id，其次用 link，最后用 _hash
            key = entry.get("id") or entry.get("link") or entry.get("_hash", "")
            if not key:
                continue

            if key in seen:
                continue
            seen.add(key)

            # 时间过滤（只保留窗口内）
            pub = entry.get("published", "")
            ts = parse_timestamp(pub)
            if ts is not None:
                if ts < WINDOW_START_MS or ts >= WINDOW_END_MS:
                    continue

            entries.append(entry)

    return entries

def rank_entries(entries):
    """评分并排名"""
    for entry in entries:
        entry["_score"] = score_entry(entry)

    # 按分数降序排列
    entries.sort(key=lambda x: x["_score"], reverse=True)
    return entries

def main():
    print(f"[EVA-00] RSS 清洗开始...")
    print(f"[TIME] 窗口: {WINDOW_START_MS} - {WINDOW_END_MS}")

    # 1. 合并去重
    all_entries = merge_entries()
    print(f"\n[MERGE] 合并后总数: {len(all_entries)} 条")

    # 2. 评分排名
    ranked = rank_entries(all_entries)

    # 3. 构建输出
    output = {
        "report_date": "2026-04-08",
        "generated_at": datetime.now().strftime("%Y-%m-%dT%H:%M:%S+08:00"),
        "task_id": "daily-morning-brief-20260408",
        "node_id": "mb-rank-20260408",
        "source": "eva-00",
        "total_raw": 289,
        "total_cleaned": len(ranked),
        "window_start_ms": WINDOW_START_MS,
        "window_end_ms": WINDOW_END_MS,
        "entries": ranked,
    }

    # 4. 写出
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n[OUTPUT] 已写入: {OUTPUT_PATH}")
    print(f"[DONE] 清洗完成: {len(ranked)}/{289} 条有效")

    # Top 10 预览
    print("\n[TOP 10]")
    for i, e in enumerate(ranked[:10], 1):
        print(f"  {i}. [{e.get('tier')}] {e.get('title', '')[:60]} (score={e['_score']})")

if __name__ == "__main__":
    main()
