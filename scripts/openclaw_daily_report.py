#!/usr/bin/env python3
import subprocess, json, os
from datetime import datetime, timedelta

WEBHOOK = os.environ.get("FEISHU_WEBHOOK_URL", "")
if not WEBHOOK:
    print("❌ 缺少 FEISHU_WEBHOOK_URL 环境变量")
    exit(1)
REPO = "openclaw/openclaw"
yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
today = datetime.now().strftime("%Y-%m-%d")

GH = "/opt/homebrew/bin/gh"
PY = "/opt/homebrew/bin/python3"

r1 = subprocess.run(
    [GH, "pr", "list", "--repo", REPO, "--state", "merged",
     "--search", "merged:>" + yesterday,
     "--limit", "30", "--json", "title,number,body"],
    capture_output=True, text=True, timeout=30
)
prs = json.loads(r1.stdout) if r1.stdout else []

r2 = subprocess.run(
    [GH, "release", "view", "--repo", REPO, "--json", "tagName,name,body,publishedAt"],
    capture_output=True, text=True, timeout=15
)
release = json.loads(r2.stdout) if r2.stdout else {}

lines = ["OpenClaw Code Evening " + today, ""]

if release:
    tag = release.get("tagName", "")
    body = release.get("body", "")
    paras = body.split("\n\n")
    summary = paras[0][:500] if paras else ""
    lines.append("Latest: " + tag)
    for ln in summary.split("\n")[:8]:
        ln = ln.strip()
        if ln and not ln.startswith("#") and not ln.startswith("-"):
            lines.append(ln)
    lines.append("")

if prs:
    pr_texts = []
    for p in prs[:10]:
        title = p.get("title", "")
        body = (p.get("body") or "").strip()
        if "Summary" in body:
            s = body[body.find("Summary"):]
            if "\n\n" in s:
                s = s[:s.find("\n\n")]
            pr_texts.append(title + "\n" + s[:300])
        else:
            pr_texts.append(title + "\n" + body[:200])

    pr_input = "\n".join(pr_texts)
    prompt = (
        "You are an OpenClaw code newsletter editor. Summarize these PRs in Chinese.\n\n"
        + pr_input
        + "\n\nRequirements:\n"
        "- Natural language, like writing to a colleague, not a list\n"
        "- Focus on what specific features were fixed or added\n"
        "- Mention specific module names\n"
        "- Categorize as Features / BugFixes / Breaking / Other, max 2-3 items each\n\n"
        + "Output format (compact, no stars):\n"
        + "OpenClaw Code Evening " + today + "\n\n[summary]"
    )

    gemini_result = subprocess.run(
        ["/opt/homebrew/bin/gemini", prompt],
        capture_output=True, text=True, timeout=120
    )
    summary_text = gemini_result.stdout.strip() if gemini_result.stdout else ""

    if summary_text and len(summary_text) > 20:
        lines.append(summary_text)
    else:
        lines.append("Merged " + str(len(prs)) + " PRs:")
        for p in prs[:8]:
            lines.append("- " + p["title"][:70])
else:
    lines.append("No new PRs merged today")

lines.extend(["", "Link: https://github.com/" + REPO + "/pulls"])
msg = "\n".join(lines)

subprocess.run(
    ["curl", "-s", "-X", "POST", WEBHOOK, "-H", "Content-Type: application/json",
     "-d", json.dumps({"msg_type": "text", "content": {"text": msg}})],
    capture_output=True, timeout=10
)
print("OK:", len(prs), "PRs")
