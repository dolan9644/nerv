# NERV Social Media Execution Modes v1

## 目标

这份文档用来回答：

1. `commerce_operations / social_media` 在当前运行面下，到底有哪些**可执行模式**
2. `Gendo` 草案和 `Misato` 实例化时，应该如何选择模式
3. 平台能力为 `ready / partial / gap` 时，workflow 应该如何收缩，而不是硬派错误节点

---

## 模式清单

### 1. `manual_brief`

**适用条件**

- 用户核心需求是出文案、脚本、口播稿
- 不依赖平台采集
- 输入来自人工 brief、商品/话题信息、参考素材、风格要求

**典型链路**

`eva00 -> eva13 -> misato -> rei(optional)`

**特点**

- 最适合当前社媒内容生产主线
- 对平台能力要求最低
- 最容易先跑成稳定交付

---

### 2. `signal_only`

**适用条件**

- 目标平台只有 RSS / 已接入信号
- 或平台能力不足以做稳定公开采集
- 或本轮重点只是热点/变化监听，不要求原始页面抓取

**典型链路**

`eva02 -> eva03(optional) -> eva00 -> eva13 -> misato -> rei(optional)`

**特点**

- 最稳
- 对运行面要求最低
- 适合作为 `social-topic-daily` 的默认模式

---

### 3. `signal_plus_collect`

**适用条件**

- 平台能力目录中至少一个目标平台在 `collect` 维度是 `ready` 或可执行 `partial`
- 所需 browser / MCP / self-hosted service 已部署且当前可访问

**典型链路**

`eva02 -> eva03(optional) -> mari(optional collect) -> eva00 -> eva13 -> misato -> rei(optional)`

**特点**

- 是 `social-topic-daily` 的增强模式
- 只有在平台运行面真实满足时才允许实例化 `collect-posts`

---

### 4. `platform_smoke`

**适用条件**

- 要验证某个平台的公开采集链能不能跑
- 目标是能力验证，不是完整业务交付

**典型链路**

`mari -> eva00 -> eva13 -> misato`

**特点**

- 用于 `xiaohongshu-smoke` 这类最小闭环
- 不等于该平台已经具备完整的话题/账号定向监控能力

---

## 当前推荐

### `social-copy-studio`

默认使用：

- `execution_mode = manual_brief`

适用目标：

- 微博文案
- 小红书文案
- 抖音标题/配文
- 短视频脚本
- 口播稿

它优先解决：

- 节点分配正确
- 平台语感正确
- 成稿质量可交付

它不要求：

- 先跑平台采集
- 先证明监控链

### `social-topic-daily`

默认使用：

- `execution_mode = signal_only`
- 默认信号源：`RSS / 已接入信号`

只有在以下条件满足时，才升级为：

- `execution_mode = signal_plus_collect`

升级条件：

1. 目标平台在平台能力目录中允许 `collect`
2. 对应 browser/MCP/self-hosted service 当前可访问
3. 未命中验证码、风险页、登录失效等运行时阻塞

在当前主链里，`twitter-x` 仅作为可选的已接入信号来源示例，不作为默认输入源或平台采集 gate 的驱动对象。

### `xiaohongshu-smoke`

固定使用：

- `execution_mode = platform_smoke`

它只验证：

- browser/MCP 可达
- 页面不是风险页
- 能拿到最小样本数据

它**不证明**：

- 已具备稳定定向监控
- 已具备长期运营流水线能力

---

## Gendo / Misato 交接规则

当 `domain = commerce_operations` 且 `subdomain = social_media` 时，草案必须额外声明：

- `execution_mode`
- `target_platforms`
- `required_modes`
- `required_capabilities`
- `platform_capability_summary`
- `template_hint`

### `Gendo`

- 负责提出建议的 `execution_mode`
- 不负责拍板最终 owner
- 不得在 `gap` 平台上假装支持 `signal_plus_collect`

### `Misato`

- 负责根据平台能力目录和当前运行面最终确认 `execution_mode`
- 可以把 `signal_plus_collect` 收缩成 `signal_only`
- 可以把 `platform_smoke` 直接转为 `TOOL_GAP` 或 `NODE_FAILED`
- 不得把 `platform_smoke` 冒充成完整业务 workflow

---

## 失败与降级

### 从 `signal_plus_collect` 降级到 `signal_only`

条件：

- collect 依赖未部署
- browser/MCP 当前不可达
- 运行中命中验证码、风险页、登录失效

要求：

- 记录 `fallback_reason`
- 保留可用的 monitor/search/rank/compose 路径
- 不允许假装 `collect-posts` 成功

### 从 `platform_smoke` 降级到 `TOOL_GAP`

条件：

- 平台能力目录不允许
- browser/MCP 不可达
- 没有有效登录态

要求：

- 不创建坏 DAG
- 直接产出能力缺口说明
