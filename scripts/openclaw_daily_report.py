#!/usr/bin/env python3
import argparse
import json
import subprocess
import sys
from datetime import datetime, time
from pathlib import Path

try:
    from zoneinfo import ZoneInfo
except ImportError:
    ZoneInfo = None


REPO = "openclaw/openclaw"
GH = "/opt/homebrew/bin/gh"
SCRIPT_DIR = Path(__file__).resolve().parent
NERV_ROOT = SCRIPT_DIR.parent
DATA_ROOT = NERV_ROOT / "data" / "openclaw-report"
TZ = ZoneInfo("Asia/Shanghai") if ZoneInfo else None


def now_local():
    return datetime.now(TZ) if TZ else datetime.now()


def parse_args():
    parser = argparse.ArgumentParser(description="Generate OpenClaw evening report")
    parser.add_argument("--date", help="Report date in YYYY-MM-DD (Asia/Shanghai)")
    parser.add_argument("--task-id", help="Optional task_id to isolate artifacts under data/openclaw-report/<task_id>")
    parser.add_argument("--output-dir", help="Optional absolute output directory (overrides date/task_id layout)")
    parser.add_argument("--dry-run", action="store_true", help="Skip Adam notifier push")
    return parser.parse_args()


def run(cmd, timeout):
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, check=False)


def ensure_bin(path_str):
    if not Path(path_str).exists():
        raise RuntimeError(f"missing binary: {path_str}")


def iso_day_bounds(day_str):
    if day_str:
        day = datetime.strptime(day_str, "%Y-%m-%d")
        if TZ:
            day = day.replace(tzinfo=TZ)
    else:
        day = now_local()
    start = datetime.combine(day.date(), time.min, tzinfo=day.tzinfo)
    return day.date().isoformat(), start.isoformat()


def resolve_output_dir(report_date, task_id=None, output_dir=None):
    if output_dir:
        return Path(output_dir).expanduser().resolve()
    if task_id:
        return (DATA_ROOT / task_id).resolve()
    return (DATA_ROOT / report_date).resolve()


def collect(day_str, task_id=None, output_dir=None):
    report_date, cutoff_iso = iso_day_bounds(day_str)
    out_dir = resolve_output_dir(report_date, task_id, output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    ensure_bin(GH)

    prs_cmd = [
        GH, "pr", "list",
        "--repo", REPO,
        "--state", "merged",
        "--search", f"merged:>={cutoff_iso}",
        "--limit", "30",
        "--json", "title,number,body,mergedAt,url"
    ]
    prs_run = run(prs_cmd, 60)
    if prs_run.returncode != 0:
        raise RuntimeError(f"gh pr list failed: {prs_run.stderr.strip() or prs_run.stdout.strip()}")
    prs = json.loads(prs_run.stdout or "[]")

    rel_cmd = [GH, "release", "view", "--repo", REPO, "--json", "tagName,name,body,publishedAt,url"]
    rel_run = run(rel_cmd, 30)
    if rel_run.returncode != 0:
        raise RuntimeError(f"gh release view failed: {rel_run.stderr.strip() or rel_run.stdout.strip()}")
    release = json.loads(rel_run.stdout or "{}")

    release_day = None
    if release and release.get("publishedAt"):
        published = datetime.fromisoformat(release["publishedAt"].replace("Z", "+00:00"))
        release_day = published.astimezone(TZ).date().isoformat() if TZ else published.date().isoformat()
    release_payload = release if release_day == report_date else None

    payload = {
        "repo": REPO,
        "report_date": report_date,
        "task_id": task_id,
        "pr_count": len(prs),
        "prs": prs,
        "release": release_payload
    }

    collected_path = out_dir / "collected.json"
    collected_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return payload, out_dir, collected_path


def main():
    args = parse_args()
    try:
        payload, out_dir, collected_path = collect(args.date, args.task_id, args.output_dir)
        result = {
            "status": "ok",
            "repo": REPO,
            "report_date": payload["report_date"],
            "task_id": payload.get("task_id"),
            "pr_count": payload["pr_count"],
            "has_release_today": bool(payload.get("release")),
            "output_dir": str(out_dir),
            "files": [
                str(collected_path)
            ],
            "next_step": "agent_summary_and_notify",
            "dry_run": args.dry_run
        }
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(0)
    except Exception as exc:
        print(json.dumps({"status": "error", "msg": str(exc)}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
