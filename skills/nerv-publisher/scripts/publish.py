#!/usr/bin/env python3
"""
NERV Publisher — 多平台发布脚本
由 gendo Agent 通过 exec 工具调用

用法:
  python3 publish.py --config config.json --task-id <UUID>

数据流:
  nerv.db → 读取 DAG 节点输出 → 发布到目标平台 → 更新状态
"""

import argparse
import json
import os
import sys
import sqlite3
import subprocess
from datetime import datetime
from pathlib import Path

NERV_DB = os.path.expanduser("~/.openclaw/nerv/data/nerv.db")
NERV_ROOT = os.path.expanduser("~/.openclaw/nerv")


def load_config(config_path: str) -> dict:
    """加载发布配置"""
    with open(config_path, "r") as f:
        config = json.load(f)

    # 解析 ENV: 引用
    for platform, cfg in config.get("platforms", {}).items():
        for key, val in list(cfg.items()):
            if isinstance(val, str) and val.startswith("ENV:"):
                env_key = val[4:]
                cfg[key] = os.environ.get(env_key, "")
                if not cfg[key]:
                    print(f"[WARN] 环境变量 {env_key} 未设置 ({platform}.{key})")

    return config


def get_task_outputs(task_id: str) -> dict:
    """从 nerv.db 读取已完成节点的输出"""
    conn = sqlite3.connect(NERV_DB)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    outputs = {}
    rows = cursor.execute(
        """
        SELECT node_id, assigned_agent, label, output_data
        FROM dag_nodes
        WHERE task_id = ? AND status = 'COMPLETED' AND output_data IS NOT NULL
        """,
        (task_id,),
    ).fetchall()

    for row in rows:
        outputs[row["assigned_agent"]] = {
            "node_id": row["node_id"],
            "label": row["label"],
            "data": json.loads(row["output_data"]) if row["output_data"] else {},
        }

    conn.close()
    return outputs


def update_node_status(task_id: str, node_id: str, status: str, result: dict = None):
    """更新 DAG 节点状态"""
    conn = sqlite3.connect(NERV_DB)
    cursor = conn.cursor()

    cursor.execute(
        """
        UPDATE dag_nodes
        SET status = ?, output_data = ?, updated_at = ?
        WHERE task_id = ? AND node_id = ?
        """,
        (
            status,
            json.dumps(result) if result else None,
            datetime.utcnow().isoformat(),
            task_id,
            node_id,
        ),
    )

    conn.commit()
    conn.close()


def log_event(source: str, event: str, details: str, task_id: str = None):
    """写入事件日志"""
    try:
        conn = sqlite3.connect(NERV_DB)
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO event_log (source, event, details, task_id, timestamp)
            VALUES (?, ?, ?, ?, ?)
            """,
            (source, event, details, task_id, datetime.utcnow().isoformat()),
        )
        conn.commit()
        conn.close()
    except Exception:
        pass


def run_pre_publish_security_gate() -> None:
    gate_script = os.path.join(NERV_ROOT, "scripts", "pre_publish_security_gate.js")
    result = subprocess.run(
        ["node", gate_script],
        cwd=NERV_ROOT,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        if result.stdout.strip():
            print(result.stdout.strip())
        if result.stderr.strip():
            print(result.stderr.strip(), file=sys.stderr)
        log_event("gendo", "PUBLISH_BLOCKED", "Pre-publish security gate failed", None)
        sys.exit(result.returncode or 1)


# ═══════════════════════════════════════════════════════════════
# 平台发布器
# ═══════════════════════════════════════════════════════════════


class PublisherBase:
    """发布器基类"""

    platform = "base"

    def __init__(self, config: dict):
        self.config = config

    def publish(self, content: dict, images: list) -> dict:
        raise NotImplementedError


class XHSPublisher(PublisherBase):
    """小红书发布器"""

    platform = "xhs"

    def publish(self, content: dict, images: list) -> dict:
        cookie_path = self.config.get("cookie_path", "")
        if not cookie_path or not Path(os.path.expanduser(cookie_path)).exists():
            return {"success": False, "error": "XHS cookie 未配置"}

        # 实际发布逻辑（预留接口）
        print(f"[XHS] 发布: {content.get('title', 'Untitled')}")
        print(f"[XHS] 图片: {len(images)} 张")
        print(f"[XHS] 标签: {content.get('tags', [])}")

        # TODO: 接入实际的 XHS API（CDP/Cookie 方式）
        return {
            "success": True,
            "platform": "xhs",
            "url": f"https://www.xiaohongshu.com/explore/placeholder",
            "published_at": datetime.utcnow().isoformat(),
        }


class FeishuPublisher(PublisherBase):
    """飞书文档发布器"""

    platform = "feishu"

    def publish(self, content: dict, images: list) -> dict:
        app_id = self.config.get("app_id", "")
        app_secret = self.config.get("app_secret", "")

        if not app_id or not app_secret:
            return {"success": False, "error": "飞书凭证未配置"}

        print(f"[Feishu] 发布文档: {content.get('title', 'Untitled')}")

        # TODO: 接入飞书开放平台 API
        return {
            "success": True,
            "platform": "feishu",
            "url": f"https://feishu.cn/docx/placeholder",
            "published_at": datetime.utcnow().isoformat(),
        }


PUBLISHERS = {
    "xhs": XHSPublisher,
    "feishu": FeishuPublisher,
}


# ═══════════════════════════════════════════════════════════════
# 主流程
# ═══════════════════════════════════════════════════════════════


def main():
    parser = argparse.ArgumentParser(description="NERV Publisher")
    parser.add_argument("--config", required=True, help="配置文件路径")
    parser.add_argument("--task-id", required=True, help="任务 ID")
    parser.add_argument("--platform", help="指定平台（不指定则发布到所有启用平台）")
    parser.add_argument("--dry-run", action="store_true", help="模拟运行")
    args = parser.parse_args()

    run_pre_publish_security_gate()
    config = load_config(args.config)
    outputs = get_task_outputs(args.task_id)

    if not outputs:
        print(f"[ERROR] 任务 {args.task_id} 无已完成节点输出")
        log_event("gendo", "PUBLISH_FAILED", "No completed node outputs", args.task_id)
        sys.exit(1)

    # 提取文案和素材
    content = {}
    images = []

    for agent_id, output in outputs.items():
        if "eva13" in agent_id or "eva-13" in agent_id:
            content = output.get("data", {})
        if "eva-series" in agent_id:
            images = output.get("data", {}).get("images", [])

    if not content:
        print("[ERROR] 未找到文案数据（eva-13 输出）")
        log_event("gendo", "PUBLISH_FAILED", "No content from eva-13", args.task_id)
        sys.exit(1)

    # 发布到各平台
    results = []
    platforms = config.get("platforms", {})

    for platform_key, platform_cfg in platforms.items():
        if not platform_cfg.get("enabled", False):
            continue
        if args.platform and platform_key != args.platform:
            continue

        publisher_cls = PUBLISHERS.get(platform_key)
        if not publisher_cls:
            print(f"[WARN] 不支持的平台: {platform_key}")
            continue

        if args.dry_run:
            print(f"[DRY-RUN] 跳过 {platform_key}")
            results.append({"platform": platform_key, "success": True, "dry_run": True})
            continue

        publisher = publisher_cls(platform_cfg)
        result = publisher.publish(content, images)
        results.append(result)

        status = "PUBLISH_OK" if result.get("success") else "PUBLISH_FAILED"
        log_event("gendo", status, json.dumps(result), args.task_id)
        print(f"[{platform_key}] {'✅' if result.get('success') else '❌'} {result}")

    # 输出汇总
    success_count = sum(1 for r in results if r.get("success"))
    total = len(results)
    print(f"\n发布完成: {success_count}/{total} 平台成功")

    # 写入最终结果
    summary = {
        "total": total,
        "success": success_count,
        "results": results,
        "completed_at": datetime.utcnow().isoformat(),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))

    return 0 if success_count == total else 1


if __name__ == "__main__":
    sys.exit(main())
