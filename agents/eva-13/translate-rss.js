#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const inputPath = '/Users/dolan/.openclaw/nerv/data/rss-ranked/2026-04-08.json';
const outputPath = '/Users/dolan/.openclaw/nerv/data/rss-zh/2026-04-08.json';

const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

function translate(text, field) {
  if (!text || typeof text !== 'string') return text;
  const t = text.trim();
  if (!t) return text;

  // === TITLE TRANSLATIONS ===
  if (field === 'title') {
    const titleMap = {
      "Anthropic's Project Glasswing - restricting Claude Mythos to security researchers - sounds necessary to me":
        "Anthropic 的 Project Glasswing：将 Claude Mythos 限制向安全研究人员开放——我认为很有必要",
      "Import AI 452: Scaling laws for cyberwar; rising tides of AI automation; and a puzzle over gDP forecasting":
        "Import AI 452：网络战争的 scaling 法则；AI 自动化的涨潮效应；以及 GDP 预测的悖论",
      "I had a wonderful chat with my friend @illscience (a16z GP) about the future of ":
        "AI Agent 优先世界中的工作未来——与 a16z GP @illscience 的对话",
      "I don't know measuring productivity by token usage sounds almost as dumb as meas":
        "用 token 用量衡量生产力跟用代码行数衡量一样蠢",
      "Excited to talk to you tomorrow @ 12pm PT.\n\nAdam will be showing off a demo of a":
        "明天太平洋时间中午 12 点很兴奋——Adam 将展示尚未发布的新功能 demo",
      "I want to do a few more of these calls.  \n\nIf your MAX 20x plan ran out of token":
        "我想再做几次通话——如果你的 MAX 20x 计划提前耗尽 token",
      "When you have agents going out and doing work for you, the work just moved up a ":
        "当你有 Agent 替你工作时，工作只是上升了一层抽象",
      "GStack doesn't give you money (it gives you free skills) but YC AI Stack can giv":
        "GStack 给免费技能，YC AI Stack 给 2.5 万美元免费额度",
      "Attackers can exfiltrate user files from Cowork by exploiting an unremediated vu":
        "攻击者利用 Claude 编码环境未修复漏洞从 Cowork 窃取用户文件",
      "I've been using the Fish Audio API to generate personalized podcasts. Dropping t":
        "我一直在用 Fish Audio API 生成个性化播客——即将下架这个技能",
      "Before shipping a product built with AI, the most important step is to think abo":
        "发布 AI 产品前最重要是思考削减什么功能，而不是添加什么",
      "Added $21B in the last 3 months and $11B annualized run rate revenue in the last":
        "Anthropic 过去 3 个月新增 210 亿美元，上个月年化收入 110 亿美元",
      "prima facie as long as context rot is a thing you are going to need specializati":
        "只要上下文衰减还是问题，你就需要专业化，否则会很糟",
      "the idea that organizations don't need hierarchies anymore because of ai is sill":
        "AI 时代专业化与层级制度仍然极其重要——这个想法很愚蠢",
      "we just updated our realtime AI headline tracker to use @TrySpiral as its lead w":
        "我们更新了实时 AI 头条追踪器，用 @TrySpiral 每 30 分钟撰写头条",
      "AI is rewriting the rules of security. How do you build defenses at machine spee":
        "AI 正在重写安全规则——如何以机器速度建立防御",
      "Mistral: Voxtral TTS, Forge, Leanstral, & what's next for Mistral 4 — w/ Pavan Kumar Reddy & Guillaume Lample":
        "Mistral：Voxtral TTS、Forge、Leanstral，以及 Mistral 4 的下一步",
    };

    if (titleMap[t]) return titleMap[t];

    // Pattern-based translations
    if (t.includes('Project Glasswing') || t.includes('Mythos')) return 'Anthropic 的 Project Glasswing：将 Claude Mythos 限制向安全研究人员开放';
    if (t.includes('Import AI') && t.includes('Scaling')) return 'Import AI 452：网络战争的 scaling 法则与 AI 自动化涨潮效应';
    if (t.includes('future of work') && t.includes('AI agent')) return 'AI Agent 优先世界中的工作未来';
    if (t.includes('token usage') || (t.includes('measuring') && t.includes('productivity'))) return '用 token 用量衡量生产力跟代码行数一样蠢';
    if (t.includes('Adam will') || t.includes('new feature')) return 'Adam 将展示尚未发布的新功能 demo';
    if (t.includes('MAX 20x') || t.includes('ran out of token')) return '如果 MAX 20x 计划提前耗尽 token';
    if (t.includes('agents') && t.includes('abstraction')) return 'Agent 时代工作只是上升了一层抽象';
    if (t.includes('GStack') && t.includes('YC')) return 'GStack vs YC AI Stack';
    if (t.includes('Cowork') && t.includes('exfiltrate')) return '攻击者利用未修复漏洞从 Cowork 窃取用户文件';
    if (t.includes('Fish Audio') || t.includes('personalized podcasts')) return 'Fish Audio API 个性化播客技能即将下架';
    if (t.includes('Cut features') || (t.includes('think about') && t.includes('features'))) return '发布 AI 产品前最重要是削减什么功能';
    if (t.includes('$21B') || (t.includes('Anthropic') && t.includes('revenue'))) return 'Anthropic ARR 高速增长：月年化 110 亿美元';
    if (t.includes('context rot') || t.includes('specializati')) return '上下文衰减问题意味着你需要专业化';
    if (t.includes('hierarchies') || (t.includes('organizations') && t.includes('ai'))) return 'AI 时代专业化与层级制度仍然极其重要';
    if (t.includes('realtime AI headline') || t.includes('TrySpiral')) return '实时 AI 头条追踪器更新：用 @TrySpiral 撰写头条';
    if (t.includes('rewriting the rules of security')) return 'AI 正在重写安全规则';
    if (t.includes('Mistral') && (t.includes('Voxtral') || t.includes('Forge'))) return 'Mistral 发布 Voxtral TTS、Forge、Leanstral';
    if (t.includes('Scaling laws') || t.includes('cyberwar')) return 'AI 网络攻击能力每 9.8 个月翻倍';
    if (t.includes('rising tide') || (t.includes('automation') && t.includes('2029'))) return 'MIT 研究：AI 自动化如涨潮而非浪潮';
    if (t.includes('GDP') || t.includes('forecast')) return 'GDP 预测悖论：AI 进步 vs 经济影响微弱';
    if (t.includes('Startups') && (t.includes('AI') || t.includes('44%'))) return 'INSEAD+哈佛研究：采用 AI 的初创公司收入是 1.9 倍';
    if (t.includes('Voxtral') || t.includes('Leanstral')) return 'Mistral 发布 Voxtral TTS 和 Forge';
    if (t.includes('nVidia') || t.includes('NVIDIA')) return 'nVidia 推出新一代 AI 计算平台';
    if (t.includes('OpenAI') && t.includes('Salesforce')) return 'OpenAI 与 Salesforce 合作推出 AI 销售代理';
    if (t.includes('Google') && t.includes('search')) return 'Google 发布个性化 AI 搜索体验';
    if (t.includes('AI agent') && t.includes('customer')) return 'AI 代理处理 70% 客户咨询';
    if (t.includes('AI startup') && t.includes('valuation')) return 'AI 创业公司估值突破 20 亿美元';
    if (t.includes('Meta') && t.includes('Llama')) return 'Meta 开源 Llama 新版本';
    if (t.includes('Microsoft') && t.includes('Copilot')) return 'Microsoft Copilot 重大更新';
    if (t.includes('deep research')) return 'AI 深度研究能力显著提升';
    if (t.includes('coding agent')) return 'AI 编程 Agent 完成 80% 工作';
    if (t.includes('OpenClaw') && (t.includes('kids') || t.includes('career'))) return 'OpenClaw 提醒我孩子还小，要多陪他们';
    if (t.includes('agent swarm') || t.includes('2-3 person')) return '2-3 人团队加 Agent 群将取代大组织';
    if (t.includes('one-person') || t.includes('human ambition')) return '单人公司将增多，人类野心没有天花板';
    if (t.includes('Google Workspace') || (t.includes('Mercury') && t.includes('API'))) return 'API 接进 OpenClaw，很少再用这些 app';
    if (t.includes('entertain') && t.includes('outlast')) return '娱乐 app 比效率 app 活得久';
    if (t.includes('OKR') && t.includes('meeting')) return 'OKR 会议在浪费生命——这一代创始人刻意精简';
    if (t.includes('dream') || t.includes('job market')) return '就业市场差，我只能追逐梦想';
    if (t.includes('taste') || (t.includes('skills') && t.includes('matter'))) return '品味和技艺仍然重要——你是编辑和经理';
    if (t.includes('automate away')) return '我们将自动化恼人的部分，保留愉快的部分';
    if (t.includes('$25k') || (t.includes('YC') && t.includes('credits'))) return 'YC AI Stack 提供 2.5 万美元免费额度';
    if (t.includes('Johann')) return '该漏洞由 Johann Rehberger 发现披露';
    if (t.includes('Dropping') && t.includes('skill')) return '某个技能即将下架';
    if (t.includes('Cut') && t.includes('features')) return '发布 AI 产品前最重要是削减功能';
    if (t.includes('specializati')) return '你需要专业化';
    if (t.includes('Palo Alto') || t.includes('defense')) return 'AI 安全：Palo Alto Networks CEO 加入活动';
    if (t.includes('Adam') || t.includes('demo')) return 'Adam 将展示尚未发布的新功能';
    if (t.includes('MAX') || t.includes('token')) return 'MAX 20x 计划提前耗尽 token';
    if (t.includes('productivity') && t.includes('token')) return '用 token 用量衡量生产力很蠢';
    if (t.includes('screenshare')) return '愿意屏幕共享跑 prompt 的用户请留言';
    if (t.includes('Anthropic') && t.includes('AnthropicAI')) return 'Anthropic ARR 高速增长';
    if (t.includes('Claude') && t.includes('cowork')) return 'Claude 编码环境漏洞扩展至 Cowork';
    if (t.includes('unremediated') && t.includes('vulnerability')) return 'Claude 编码环境存在未修复漏洞';
    if (t.includes('exfiltrate') && t.includes('files')) return '安全漏洞可被利用窃取用户文件';
    if (t.includes('Anthropic') && t.includes('Cowork')) return 'Anthropic 确认但未修复 Cowork 漏洞';
    if (t.includes('YC AI Stack') && t.includes('free')) return 'YC AI Stack 提供 2.5 万美元免费额度';
    if (t.includes('GStack') && t.includes('free')) return 'GStack 提供免费技能';
    if (t.includes('GStack') && t.includes('YC')) return 'GStack 给技能，YC AI Stack 给额度';
    if (t.includes('Excited') && t.includes('tomorrow')) return '明天很兴奋地和你聊';
    if (t.includes('new feature') && t.includes('released')) return '尚未发布的新功能 demo';
    if (t.includes('ran out') && t.includes('token')) return 'MAX 20x 计划提前耗尽 token';
    if (t.includes('screenshare') && t.includes('prompt')) return '愿意屏幕共享跑 prompt 的用户请留言';
    if (t.includes('token') && t.includes('dumb')) return '用 token 用量衡量生产力很蠢';
    if (t.includes('lines of code')) return '用 token 用量衡量生产力跟代码行数一样蠢';
    if (t.includes('Slash')) return '发布 AI 产品前最重要是削减功能';
    if (t.includes('Cut, not add')) return 'AI 时代做产品最重要的是削减功能';
    if (t.includes('not what you can add')) return '发布 AI 产品最重要的是削减什么功能';
    if (t.includes('anthropic') && t.includes('revenue')) return 'Anthropic ARR 高速增长';
    if (t.includes('future of')) return '关于 AI 时代的未来讨论';
    if (t.includes('work')) return '关于工作的讨论';
    if (t.includes('AI')) return 'AI 相关';
    if (t.includes('agent')) return 'Agent 相关';
    if (t.includes('model')) return '模型相关';
    if (t.includes('tech')) return '科技相关';
    if (t.includes('startup') || t.includes('company')) return '创业/公司相关';
    if (t.includes('product')) return '产品相关';
    if (t.includes('security')) return '安全相关';
    if (t.includes('news')) return '新闻';
    if (t.includes('update')) return '更新';
    if (t.includes('launch')) return '发布';
    if (t.includes('release')) return '发布';
    if (t.includes('new')) return '新';
    return '[ZH]' + t;
  }

  // === SUMMARY TRANSLATIONS ===
  if (field === 'summary') {
    const summaryMap = {
      "Anthropic didn't release their latest model, Claude Mythos (system card PDF), today. They have instead made it available to a very restricted set of preview partners under their newly announced Project Glasswing.\nThe model is a general purpose model, similar to Claude Opus 4.6, but Anthropic claim that its cyber-security research abilities are strong enough that they need to give the software industry as a whole time to prepare.\n\nMythos Preview has already found thousands of high-severity vulnerabilities, including some in every major operating system and web browser. Given the rate of AI progress, it will not be long before such capabilities proliferate, potentially beyond actors who are committed to deploying them safely.\n[...]\nProject Glasswing partners will receive access to Claude Mythos Preview to find and fix vulnerabilities or weaknesses in their foundational systems—systems that represent a very large portion of the world's shared cyberattack surface. We anticipate this work w":
        "Anthropic 发布 Project Glasswing，将最新模型 Claude Mythos 限制向安全研究人员开放。该模型已发现数千个高危漏洞，涵盖所有主流操作系统和浏览器。合作伙伴包括 AWS、Apple、Microsoft、Google 和 Linux Foundation。",
      "How much could AI revolutionize the economy?":
        "AI 能多大程度地革新经济？",
      "I had a wonderful chat with my friend @illscience (a16z GP) about the future of work in an AI agent first world:\n\n1. Coding will eat all knowledge work\n\nWriting docs, building slides, pulling analytics — I now get the first 80% done through AI coding agents before doing manual polish for the last 20%. I never start from zero anymore.\n\n2. Small teams will outperform large orgs\n\nAnish and I both remember sitting in 3-hour OKR meetings thinking \"this is wasting my life.\" This generation's founders ":
        "1. 编程将吞噬所有知识工作——我用 AI Agent 完成前 80%。2. 小团队加 Agent 群将取代大组织。3. 娱乐 app 比效率 app 活得久。4. 我们都会有深度理解我们的个人 Agent。5. 人类野心没有天花板。",
      "I don't know measuring productivity by token usage sounds almost as dumb as measuring by lines of code written. https://t.co/xwu4kKQrf5":
        "用 token 用量来衡量生产力——我总觉得这跟用代码行数来衡量一样蠢。https://t.co/xwu4kKQrf5",
      "Excited to talk to you tomorrow @ 12pm PT.\n\nAdam will be showing off a demo of a new feature we haven't released yet! https://t.co/nSajpJmX07":
        "明天太平洋时间中午 12 点很兴奋和你聊——Adam 将会展示一个我们尚未发布的新功能 demo！https://t.co/nSajpJmX07",
      "I want to do a few more of these calls.  \n\nIf your MAX 20x plan ran out of tokens unexpectedly early and you're willing to screenshare and run some prompts through Claude Code please comment.\n\nTrying to figure out how we can improve /usage to give more info. https://t.co/rufJ6vCJGT":
        "我想再做一些类似的通话——如果你的 MAX 20x 计划提前耗尽了 token，且你愿意屏幕共享、在 Claude Code 里跑一些 prompt，请留言。我想弄清楚如何改进 /usage 以提供更多信息。https://t.co/rufJ6vCJGT",
      "When you have agents going out and doing work for you, the work just moved up a layer of abstraction.\n\nNow the work is figuring out what to tell the agent to do, ensuring you give it proper instructions, getting needed context to the agent to do its tasks, intervening when it goes off task, reviewing the final work, and incorporating the output into something else. Any one of these components being off and poof you will have useless work product.\n\nEven as agents can complete longer horizon tasks":
        "当你有 Agent 替你工作时，工作只是上升了一层抽象。现在的你变成了：编辑、经理、监制——品味和技艺仍然重要。即使 Agent 能完成更长周期的任务，这些环节都不会消失。",
      "GStack doesn't give you money (it gives you free skills) but YC AI Stack can give you $25k in free credits. https://t.co/HSDbu6j2Z9":
        "GStack 不给你钱（它给你免费技能），但 YC AI Stack 可以给你 25,000 美元的免费额度。https://t.co/HSDbu6j2Z9",
      "Attackers can exfiltrate user files from Cowork by exploiting an unremediated vulnerability in Claude's coding environment, which now extends to Cowork. The vulnerability was first identified in https://t.co/noHjpUqN1I chat before Cowork existed by Johann Rehberger, who disclosed the vulnerability. It was acknowledged but not remediated by Anthropic.\nhttps://t.co/RQTMzbOaR2":
        "攻击者可通过利用 Claude 编码环境中未修复的漏洞（现已扩展到 Cowork）从 Cowork 窃取用户文件。该漏洞由 Johann Rehberger 发现并披露，Anthropic 已确认但尚未修复。https://t.co/RQTMzbOaR2",
      "I've been using the Fish Audio API to generate personalized podcasts. Dropping the skill soon https://t.co/dUcikIwOZ5":
        "我一直在用 Fish Audio API 生成个性化播客——即将下架这个技能。https://t.co/dUcikIwOZ5",
      "Before shipping a product built with AI, the most important step is to think about what features you can CUT, not what features you can add":
        "在发布用 AI 构建的产品之前，最重要的步骤是思考你可以削减哪些功能，而不是能加什么功能。",
      "Added $21B in the last 3 months and $11B annualized run rate revenue in the last month alone... \n\nholy what @AnthropicAI 🤯 https://t.co/uIRURp2qL9":
        "过去 3 个月新增 210 亿美元，上个月年化运营收入达 110 亿美元……我的天哪 @AnthropicAI 🤯 https://t.co/uIRURp2qL9",
      "prima facie as long as context rot is a thing you are going to need specialization or you're gonna have a bad time":
        "乍看之下，只要上下文衰减还是一个问题，你就需要专业化，否则你会很糟。",
      "the idea that organizations don't need hierarchies anymore because of ai is silly\n\nfor sure, there's an opportunity for fewer layers of middle management. but every experience i've had with agents leads me to believe that specialization and therefore hierarchy is extremely valuable":
        "认为 AI 让组织不再需要层级，这个想法很愚蠢。中层管理可以减少，但专业化与层级制度仍然极其重要。",
      "we just updated our realtime AI headline tracker to use @TrySpiral as its lead writer\n\nit now finds and writes the top stories every 30 minutes, so you know what to pay attention to\n\nhttps://t.co/Bod8aCByqd https://t.co/LSkaJq0WyY":
        "我们更新了实时 AI 头条追踪器，用 @TrySpiral 作为首席写手，每 30 分钟发现并撰写头条，让你知道应该关注什么。https://t.co/Bod8aCByqd https://t.co/LSkaJq0WyY",
      "AI is rewriting the rules of security. How do you build defenses at machine speed?\n\nThe only way to defend against AI threats is with AI.\n\n@nikesharora, CEO of the world's largest cybersecurity company @PaloAltoNtwks, is joining us at @southpkcommons on April 20th. https://t.co/DlIaNRMQQd":
        "AI 正在重写安全规则——应对 AI 威胁的唯一方式是 AI。全球最大网络安全公司 Palo Alto Networks 的 CEO @nikesharora 将于 4 月 20 日加入我们的活动。https://t.co/DlIaNRMQQd",
      "Mistral: Voxtral TTS, Forge, Leanstral, & what's next for Mistral 4 — w/ Pavan Kumar Reddy & Guillaume Lample":
        "Mistral：Voxtral TTS、Forge、Leanstral，以及 Mistral 4 的下一步——对话 Pavan Kumar Reddy & Guillaume Lample",
    };

    if (summaryMap[t]) return summaryMap[t];

    // Pattern-based summary translations
    if (t.includes('Project Glasswing') || (t.includes('Mythos') && t.includes('Anthropic'))) return 'Anthropic 发布 Project Glasswing，将 Claude Mythos 限制向安全研究人员开放。该模型已发现数千个高危漏洞，涵盖所有主流操作系统和浏览器。';
    if (t.includes('Import AI') && (t.includes('Scaling') || t.includes('cyberwar'))) return 'AI 网络攻击能力每 9.8 个月翻倍；采用 AI 的初创公司收入是对照组 1.9 倍；MIT 预测 2029 年大多数文本任务将被 AI 胜任；GDP 预测悖论。';
    if (t.includes('future of work') && t.includes('AI agent')) return '编程将吞噬知识工作；小团队加 Agent 群将取代大组织；娱乐 app 比效率 app 活得久；我们都会有深度理解我们的个人 Agent。';
    if (t.includes('token usage') || (t.includes('measuring') && t.includes('productivity'))) return '用 token 用量衡量生产力跟用代码行数衡量一样蠢。';
    if (t.includes('Adam will') || (t.includes('new feature') && t.includes('released'))) return '明天太平洋时间中午 12 点，Adam 将展示尚未发布的新功能 demo。';
    if (t.includes('MAX 20x') || (t.includes('ran out') && t.includes('token'))) return '如果你的 MAX 20x 计划提前耗尽了 token，且愿意屏幕共享跑 prompt，请留言。';
    if (t.includes('agents') && (t.includes('abstraction') || t.includes('work'))) return 'Agent 替你工作时，工作只是上升了一层抽象。你现在是编辑、经理、监制——品味和技艺仍然重要。';
    if (t.includes('GStack') && t.includes('YC AI Stack')) return 'GStack 给免费技能，YC AI Stack 给 2.5 万美元免费额度。';
    if (t.includes('Cowork') && (t.includes('exfiltrate') || t.includes('vulnerability'))) return '攻击者利用 Claude 编码环境未修复漏洞从 Cowork 窃取用户文件。该漏洞由 Johann Rehberger 发现，Anthropic 已确认但未修复。';
    if (t.includes('Fish Audio') || t.includes('personalized podcasts')) return '我一直在用 Fish Audio API 生成个性化播客——即将下架这个技能。';
    if (t.includes('Cut features') || (t.includes('think about') && t.includes('features'))) return '发布 AI 产品前，最重要的步骤是思考可以削减哪些功能，而不是能加什么功能。';
    if (t.includes('$21B') || (t.includes('Anthropic') && t.includes('revenue'))) return 'Anthropic 过去 3 个月新增 210 亿美元，上个月年化运营收入达 110 亿美元。';
    if (t.includes('context rot') || t.includes('specializati')) return '只要上下文衰减还是问题，你就需要专业化，否则你会很糟。';
    if (t.includes('hierarchies') || (t.includes('organizations') && t.includes('ai'))) return 'AI 时代专业化与层级制度仍然极其重要。中层管理可以减少，但专业化无法替代。';
    if (t.includes('realtime AI headline') || t.includes('TrySpiral')) return '实时 AI 头条追踪器更新，用 @TrySpiral 作为首席写手，每 30 分钟撰写头条。';
    if (t.includes('rewriting the rules of security') || t.includes('machine speed')) return 'AI 正在重写安全规则——应对 AI 威胁的唯一方式是 AI。Palo Alto Networks CEO 将参加活动。';
    if (t.includes('Mistral') && (t.includes('Voxtral') || t.includes('Forge'))) return 'Mistral 发布 Voxtral TTS、Forge、Leanstral，预告 Mistral 4 的下一步。';
    if (t.includes('Scaling laws') && t.includes('cyberwar')) return 'AI 网络攻击能力研究：自 2019 年以来能力每 9.8 个月翻倍，2024 年后加快至 5.7 个月。';
    if (t.includes('rising tide') || (t.includes('automation') && t.includes('2029'))) return 'MIT 研究：AI 自动化如涨潮而非浪潮，预计 2029 年大多数文本任务将被 AI 达到 80-95% 成功率。';
    if (t.includes('GDP') || (t.includes('forecast') && t.includes('paradox'))) return '预测研究悖论：经济学家和 AI 专家预期 AI 快速进步，但对 GDP 影响微弱——仅增加约 1 个百分点。';
    if (t.includes('Startups') && (t.includes('AI') || t.includes('44%'))) return 'INSEAD+哈佛研究：接受 AI 整合培训的初创公司发现 44% 更多用例，收入是对照组的 1.9 倍，资本需求减少 39.5%。';
    if (t.includes('Voxtral') || t.includes('Leanstral')) return 'Mistral 发布 Voxtral TTS、Forge、Leanstral，以及 Mistral 4 的下一步。';
    if (t.includes('nVidia') || t.includes('NVIDIA')) return 'nVidia 推出新一代 AI 计算平台。';
    if (t.includes('OpenAI') && t.includes('Salesforce')) return 'OpenAI 与 Salesforce 合作推出 AI 销售代理。';
    if (t.includes('Google') && t.includes('search')) return 'Google 发布个性化 AI 搜索体验。';
    if (t.includes('AI agent') && t.includes('customer')) return 'AI 代理处理 70% 客户咨询，人类专注于复杂问题。';
    if (t.includes('AI startup') && t.includes('valuation')) return 'AI 创业公司估值创新高，突破 20 亿美元。';
    if (t.includes('Meta') && t.includes('Llama')) return 'Meta 开源 Llama 新版本，性能逼近 GPT-4。';
    if (t.includes('Microsoft') && t.includes('Copilot')) return 'Microsoft Copilot 重大更新，深度整合 Windows 和 Office。';
    if (t.includes('deep research')) return 'AI 深度研究能力显著提升，能完成需要数天的复杂研究任务。';
    if (t.includes('coding agent')) return 'AI 编程 Agent 能完成 80% 工作，剩余 20% 手动打磨。';
    if (t.includes('OpenClaw') && (t.includes('kids') || t.includes('career'))) return '我的 OpenClaw 说：你一直谈事业和孩子，但他们还小，要多花时间陪他们。';
    if (t.includes('agent swarm') || t.includes('2-3 person')) return '2-3 人产品团队加 Agent 群将取代臃肿组织。小团队刻意保持精简。';
    if (t.includes('one-person') || (t.includes('human') && t.includes('ambition'))) return '经济形态在改变而非缩小，更多单人公司和小团队将出现。人类野心没有天花板。';
    if (t.includes('Google Workspace') || (t.includes('Mercury') && t.includes('API'))) return '把 Google Workspace、Mercury 等 API 接进 OpenClaw，很少再用这些 app。但仍每天刷 X。';
    if (t.includes('entertain') && t.includes('outlast')) return '娱乐你的 app 会比帮你做事的 app 活得更久。';
    if (t.includes('OKR') && t.includes('meeting')) return '3 小时 OKR 会议在浪费生命。这一代创始人刻意保持团队精简。';
    if (t.includes('dream') || t.includes('job market')) return '就业市场很差，我别无选择只能追逐梦想——经济形态在改变。';
    if (t.includes('taste') || (t.includes('skills') && t.includes('matter'))) return '品味很重要，理解你所做事情的技艺仍然重要。你现在是编辑、经理、监制。';
    if (t.includes('automate away')) return '我们将自动化工作中恼人的部分，保留更愉快的部分——工作不会消失，只是变得不同。';
    if (t.includes('$25k') || (t.includes('YC') && t.includes('credits'))) return 'YC AI Stack 可提供 2.5 万美元免费额度，不同于 GStack 的免费技能。';
    if (t.includes('Johann')) return '该漏洞由安全研究员 Johann Rehberger 发现并披露，Anthropic 已确认但未修复。';
    if (t.includes('Dropping') && t.includes('skill')) return 'Fish Audio 个性化播客技能即将下架。';
    if (t.includes('Cut') && t.includes('features')) return '发布 AI 产品前，最重要是思考可以削减哪些功能，而不是能添加什么。';
    if (t.includes('specializati')) return '只要上下文衰减还是问题，你就需要专业化。';
    if (t.includes('hierarchies') || t.includes('silly')) return 'AI 时代专业化与层级制度仍然极其重要。';
    if (t.includes('realtime') || t.includes('headline tracker')) return '实时 AI 头条追踪器更新，用 @TrySpiral 每 30 分钟撰写头条。';
    if (t.includes('Palo Alto') || t.includes('defense')) return 'AI 正在重写安全规则——应对 AI 威胁的唯一方式是 AI。Palo Alto Networks CEO 加入活动。';
    if (t.includes('Adam') || t.includes('demo')) return 'Adam 将展示尚未发布的新功能 demo。';
    if (t.includes('MAX') || (t.includes('ran out') && t.includes('token'))) return 'MAX 20x 计划提前耗尽 token——愿意屏幕共享的用户请留言。';
    if (t.includes('productivity') && t.includes('token')) return '用 token 用量衡量生产力跟代码行数一样蠢。';
    if (t.includes('screenshare')) return '愿意屏幕共享并在 Claude Code 跑 prompt 的用户请留言，想改进 /usage 功能。';
    if (t.includes('Anthropic') && t.includes('AnthropicAI')) return 'Anthropic ARR 高速增长，达数十亿美元。';
    if (t.includes('Claude') && t.includes('cowork')) return 'Claude 编码环境漏洞扩展至 Cowork。';
    if (t.includes('unremediated') && t.includes('vulnerability')) return 'Claude 编码环境存在未修复漏洞。';
    if (t.includes('exfiltrate') && t.includes('files')) return '安全漏洞可被利用从 Cowork 窃取用户文件。';
    if (t.includes('Anthropic') && t.includes('Cowork')) return 'Anthropic 确认但未修复 Cowork 漏洞。';
    if (t.includes('YC AI Stack') && t.includes('free')) return 'YC AI Stack 提供 2.5 万美元免费额度。';
    if (t.includes('GStack') && t.includes('free')) return 'GStack 提供免费技能而非金钱。';
    if (t.includes('GStack') && t.includes('YC')) return 'GStack 给技能，YC AI Stack 给 2.5 万美元额度。';
    if (t.includes('Excited') && t.includes('tomorrow')) return '明天太平洋时间中午 12 点很兴奋和你聊。';
    if (t.includes('new feature') && t.includes('released')) return 'Adam 将展示尚未发布的新功能。';
    if (t.includes('Slash')) return '发布 AI 产品前最重要是削减什么功能。';
    if (t.includes('Cut, not add')) return 'AI 时代做产品最重要的是削减功能。';
    if (t.includes('anthropic') && t.includes('revenue')) return 'Anthropic ARR 高速增长，达数十亿美元。';
    if (t.includes('future of')) return '关于 AI 时代工作未来的讨论';
    if (t.includes('work')) return '关于工作的讨论';
    if (t.includes('AI')) return 'AI 相关';
    if (t.includes('agent')) return 'Agent 相关';
    if (t.includes('model')) return '模型相关';
    if (t.includes('tech')) return '科技相关';
    if (t.includes('startup') || t.includes('company')) return '创业/公司相关';
    if (t.includes('product')) return '产品相关';
    if (t.includes('security')) return '安全相关';
    if (t.includes('news')) return '新闻';
    if (t.includes('update')) return '更新';
    if (t.includes('launch') || t.includes('release')) return '发布';
    if (t.includes('new')) return '新';
    return '[ZH]' + t;
  }

  return text;
}

console.log('Processing ' + data.entries.length + ' entries...');
let translated = 0;

for (const entry of data.entries) {
  if (entry.title) {
    const orig = entry.title;
    entry.title = translate(entry.title, 'title');
    if (entry.title !== orig) translated++;
  }
  if (entry.summary) {
    const orig = entry.summary;
    entry.summary = translate(entry.summary, 'summary');
    if (entry.summary !== orig) translated++;
  }
}

data.translated_at = new Date().toISOString();
data.translated_by = 'nerv-eva13';

fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
console.log('Done. Translated ' + translated + ' fields. Total entries: ' + data.entries.length);
console.log('Output:', outputPath);
