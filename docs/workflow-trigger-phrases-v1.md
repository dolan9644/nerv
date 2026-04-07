# Workflow Trigger Phrases v1

## 目标

这份文档把用户会说的中文需求，映射到 NERV 内部的 workflow/template。

原则：

- 用户不需要记英文内部名
- 优先识别中文语境，再映射到 `domain + workflow`
- 如果关键输入明显缺失，先补问，不要硬开 DAG

## 高优先级映射

| 用户真实说法 | 推荐 workflow | 先补什么 |
|:--|:--|:--|
| `复盘昨天那场直播` / `把这场直播的问题和下次优化点整理出来` | `live-replay-summary` | 直播背景、复盘目标、评论/数据/笔记至少一类 |
| `做一套直播脚本` / `给我能直接上播的话术` | `live-session-script` | 商品信息、价格/福利、人群、风格约束 |
| `给微博、小红书、抖音各出一版内容` / `按不同平台分别写` | `social-copy-studio` | 平台、内容目标、风格差异、是否先出草案 |
| `整理商品评价` / `做商品洞察` / `做一版 SKU 卖点简报` | `product-review-insight` | 商品信息、评价文本或截图路径、分析目标 |
| `把会议纪要转成任务清单` / `把周会内容拆成 owner 和 deadline` | `meeting-to-task` | 会议来源、参会人、负责人、时间要求 |
| `给我做一版财讯简报` / `看一下这只股票最近有什么变化` | `finance-brief` | 范围、时间窗、观察重点，或已知事实 |

## 图片与附件规则

以下表述都不能直接视为可执行输入：

- `我发过截图了`
- `附件里有`
- `你看图就知道`

对图片类输入，至少要补其一：

- 绝对路径
- 图片里的文字内容
- 已结构化的摘要

## 触发口令

如果用户要的是工作流，而不是单轮回答，建议中文口令保持简短明确：

- `先给我 DAG 草案，再交给 Misato 执行`
- `按 DAG 方式处理`
- `不要直接成稿，先拆工作流`

## 当前适用范围

第一批已经适用到：

- `social-copy-studio`
- `live-session-script`
- `live-replay-summary`
- `product-review-insight`
- `meeting-to-task`
- `finance-brief`
