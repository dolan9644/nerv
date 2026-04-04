#!/usr/bin/env python3
"""
shinji 数据统计工具 — 快速验证数据文件
用法: python3 agents/shinji/bin/data_stats.py <file_path>
输出: JSON {"exists": bool, "count": int, "type": str}
"""
import json
import os
import sys

def get_stats(file_path):
    if not os.path.exists(file_path):
        return {"exists": False, "count": 0}
    
    ext = os.path.splitext(file_path)[1].lower()
    try:
        size_kb = os.path.getsize(file_path) / 1024
        if ext == '.json':
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                count = len(data) if isinstance(data, list) else 1
            return {"exists": True, "count": count, "type": "json", "size_kb": round(size_kb, 1)}
        elif ext in ('.md', '.txt'):
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            return {"exists": True, "count": len(lines), "type": "text", "size_kb": round(size_kb, 1)}
        else:
            return {"exists": True, "count": 0, "type": ext, "size_kb": round(size_kb, 1)}
    except Exception as e:
        return {"exists": True, "error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "用法: python3 data_stats.py <file_path>"}))
        sys.exit(1)
    print(json.dumps(get_stats(sys.argv[1]), ensure_ascii=False))
