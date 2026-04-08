---
name: nerv-publisher
description: 多平台内容发布 Skill。接收已审核的文案和素材，发布到目标平台。由 gendo 调用。
user-invocable: false
disable-model-invocation: false
metadata: { "openclaw": { "emoji": "📡", "os": ["darwin", "linux"], "requires": { "bins": ["python3"] } } }
---

# NERV Publisher Skill

## 用途
将 eva-13 产出的文案 + eva-series 产出的视觉素材发布到目标平台。

## 调用方式
gendo 通过 `exec` 工具调用：
```bash
node {baseDir}/scripts/pre_publish_security_gate.js
python3 {baseDir}/scripts/publish.py --config {baseDir}/config.json --task-id <TASK_ID>
```

## 输入
从 `nerv.db` 的 `dag_nodes` 表读取当前任务的输出数据：
- `eva-13` 节点输出：文案 JSON（标题 + 正文 + 标签）
- `eva-series` 节点输出：图片路径列表

## 输出
- 成功：更新 `dag_nodes.status = COMPLETED`，记录发布 URL
- 失败：更新 `dag_nodes.status = FAILED`，记录错误信息
- 通过 `sessions_send` 通知 misato 发布结果

## 发布前安全闸门

- 先运行 `scripts/pre_publish_security_gate.js`
- 发现 staged 变更里有 `.env`、密钥、审计原文中的敏感文本或高风险模式时，直接阻断发布
- 闸门通过后，才允许调用 `publish.py`

## 支持的平台
- 小红书（XHS）
- 抖音（Douyin）
- 微信公众号（WeChat MP）
- 飞书文档（Feishu）

## 配置
`config.json` 存放平台凭证（加密），格式：
```json
{
  "platforms": {
    "xhs": { "enabled": true, "cookie_path": "~/.openclaw/nerv/secrets/xhs_cookie.json" },
    "douyin": { "enabled": false },
    "wechat_mp": { "enabled": false },
    "feishu": { "enabled": true, "app_id": "ENV:FEISHU_APP_ID", "app_secret": "ENV:FEISHU_APP_SECRET" }
  }
}
```
