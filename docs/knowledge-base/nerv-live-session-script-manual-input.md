# NERV live-session-script 手工输入链

## Idea
`live_commerce` 第一条正式工作流从 `manual_input` 起步。核心问题不是缺数据，而是缺讲解结构。

## 核心逻辑
- 输入必须由用户明确给出：
  - 商品清单
  - 核心卖点
  - 福利/价格
  - 人群画像
  - 直播目标
- 主链固定：
  - `eva00`：归一化为 `offer_pack.json`
  - `eva13`：成稿 `script.md / selling_points.md / cta.md`
  - `misato`：通知收口
  - `rei`：异步记忆沉淀
- 不混平台采集。

## Skill
已验证的输入包结构：

```json
{
  "domain":"commerce_operations",
  "subdomain":"live_commerce",
  "execution_mode":"manual_input",
  "live_goal":{"primary":"GMV"},
  "product_list":[{"role":"主推款","price":"279-319"}]
}
```

已验证的 DAG 设计：

```text
normalize-offer -> compose-script -> notify-script -> memory-script-pattern
```

## 真实落点
- roadmap：`nerv/docs/live-commerce-roadmap-v1.md`
- workflow catalog：`nerv/docs/workflow-template-catalog-v1.md`

## 已验证结论
- `manual_input` 是当前最稳的 `live_commerce` 起点。
- `normalize` 和 `compose` 必须拆开，不能让一个 Agent 吞掉结构化与成稿。
- 首轮真实 DAG 暴露出一个硬边界：`eva00` 预期来源是 `shinji`，若由 `misato` 直派，节点会卡在会话契约层。
