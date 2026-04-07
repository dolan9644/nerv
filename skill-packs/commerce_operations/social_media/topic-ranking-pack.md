# topic-ranking-pack

## 元数据

- domain: `commerce_operations`
- subdomain: `social_media`
- family: `normalize`
- primary_owner: `nerv-eva00`
- upstream: `nerv-shinji`
- downstream: `nerv-eva13`, `nerv-rei`

## 适用场景

- 选题排序
- 热点聚类
- 评论槽点/卖点分桶
- 竞品内容优先级整理

## 输入

- `raw.json`
- `monitor.json`
- 可选排序规则
- 可选白名单字段

## 输出

- `ranked.json`
- 每条记录建议包含：
  - `topic`
  - `cluster`
  - `priority_score`
  - `reason`
  - `supporting_urls`

## 对齐规则

- 先物理字段校验，再做语义清洗
- 可补充：
  - 打标
  - 聚类
  - 分桶
  - 排序
- 不做最终成稿

## 验收标准

- 输出可直接被 `nerv-eva13` 成稿
- 排序依据可解释
- 结果足够支持“选题日报”或“热点追踪”下游节点
