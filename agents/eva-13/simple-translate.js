#!/usr/bin/env node
/**
 * Minimal inline translation - no external deps
 * Run: node simple-translate.js
 */
const fs = require('fs');
const input = '/Users/dolan/.openclaw/nerv/data/rss-ranked/2026-04-08.json';
const output = '/Users/dolan/.openclaw/nerv/data/rss-zh/2026-04-08.json';

const data = JSON.parse(fs.readFileSync(input, 'utf8'));
const map = {
  "Anthropic's Project Glasswing - restricting Claude Mythos to security researchers - sounds necessary to me": "Anthropic 的 Project Glasswing：将 Claude Mythos 限制向安全研究人员开放——我认为很有必要",
  "Import AI 452: Scaling laws for cyberwar; rising tides of AI automation; and a puzzle over gDP forecasting": "Import AI 452：网络战争的 scaling 法则；AI 自动化的涨潮效应；以及 GDP 预测的悖论",
  "I had a wonderful chat with my friend @illscience (a16z GP) about the future of ": "AI Agent 优先世界中的工作未来——与 a16z GP @illscience 的对话",
  "I don't know measuring productivity by token usage sounds almost as dumb as meas": "用 token 用量衡量生产力跟用代码行数衡量一样蠢",
  "Excited to talk to you tomorrow @ 12pm PT.\n\nAdam will be showing off a demo of a": "明天太平洋时间中午 12 点很兴奋——Adam 将展示尚未发布的新功能 demo",
  "I want to do a few more of these calls.  \n\nIf your MAX 20x plan ran out of token": "我想再做几次通话——如果你的 MAX 20x 计划提前耗尽 token",
  "When you have agents going out and doing work for you, the work just moved up a ": "当你有 Agent 替你工作时，工作只是上升了一层抽象",
  "GStack doesn't give you money (it gives you free skills) but YC AI Stack can giv": "GStack 给免费技能，YC AI Stack 给 2.5 万美元免费额度",
  "Attackers can exfiltrate user files from Cowork by exploiting an unremediated vu": "攻击者利用 Claude 编码环境未修复漏洞从 Cowork 窃取用户文件",
  "I've been using the Fish Audio API to generate personalized podcasts. Dropping t": "我一直在用 Fish Audio API 生成个性化播客——即将下架这个技能",
  "Before shipping a product built with AI, the most important step is to think abo": "发布 AI 产品前最重要是思考削减什么功能，而不是添加什么",
  "Added $21B in the last 3 months and $11B annualized run rate revenue in the last": "Anthropic 过去 3 个月新增 210 亿美元，上个月年化收入 110 亿美元",
  "prima facie as long as context rot is a thing you are going to need specializati": "只要上下文衰减还是问题，你就需要专业化，否则会很糟",
  "the idea that organizations don't need hierarchies anymore because of ai is sill": "AI 时代专业化与层级制度仍然极其重要——这个想法很愚蠢",
  "we just updated our realtime AI headline tracker to use @TrySpiral as its lead w": "我们更新了实时 AI 头条追踪器，用 @TrySpiral 每 30 分钟撰写头条",
  "AI is rewriting the rules of security. How do you build defenses at machine spee": "AI 正在重写安全规则——如何以机器速度建立防御",
  "Mistral: Voxtral TTS, Forge, Leanstral, & what's next for Mistral 4 — w/ Pavan Kumar Reddy & Guillaume Lample": "Mistral：Voxtral TTS、Forge、Leanstral，以及 Mistral 4 的下一步",
};
let cnt = 0;
data.entries.forEach(e => {
  if (e.title && map[e.title]) { e.title = map[e.title]; cnt++; }
});
data.translated_at = new Date().toISOString();
data.translated_by = 'nerv-eva13';
fs.mkdirSync('/Users/dolan/.openclaw/nerv/data/rss-zh', {recursive:true});
fs.writeFileSync(output, JSON.stringify(data, null, 2));
console.log('Done, translated ' + cnt + ' titles');
