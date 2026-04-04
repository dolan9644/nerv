/**
 * ███ NERV · MARDUK機関 · Skill 发现引擎 ███
 * 
 * 自动扫描 ~/.openclaw/skills/ 目录
 * 提取每个 SKILL.md 的 name/description/tags
 * 写入 nerv.db 的 skill_registry 表
 * 
 * 用法：node skill_scanner.js [--verbose]
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { resolve, join } from 'path';
import { upsertSkill } from './db.js';

// ═══════════════════════════════════════════════════════════════
// 配置
// ═══════════════════════════════════════════════════════════════

const SKILLS_DIR = resolve(process.env.HOME, '.openclaw', 'skills');
const VERBOSE = process.argv.includes('--verbose');

// Agent → Skill 兼容性映射
const AGENT_SKILL_MAP = {
  'nerv-publisher':     ['nerv-gendo'],
  'nerv-code-runner':   ['nerv-ritsuko', 'nerv-asuka', 'nerv-eva01'],
  'nerv-gemini':        ['nerv-shinji', 'nerv-ritsuko'],
  'nerv-codex':         ['nerv-ritsuko', 'nerv-asuka'],
  'nerv-aider':         ['nerv-ritsuko'],
  'nerv-obsidian':      ['nerv-rei'],
  'nerv-search':        ['nerv-eva03'],
  'nerv-github':        ['nerv-ritsuko'],
  'duckduckgo-search':  ['nerv-eva03', 'nerv-mari'],
  'openclaw-tavily-search': ['nerv-eva03'],
  'rss-fetcher':        ['nerv-eva02'],
  'summarize':          ['nerv-eva13', 'nerv-shinji'],
  'docx-writer':        ['nerv-eva13'],
  'gemini-image-generate': ['nerv-eva-series'],
};

// ═══════════════════════════════════════════════════════════════
// SKILL.md 解析器
// ═══════════════════════════════════════════════════════════════

function parseSkillMd(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const result = { name: null, description: null, tags: [] };

  // 解析 YAML frontmatter
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const fm = fmMatch[1];
    
    // name
    const nameMatch = fm.match(/^name:\s*(.+)$/m);
    if (nameMatch) result.name = nameMatch[1].trim();
    
    // description（可能多行）
    const descMatch = fm.match(/^description:\s*\|?\s*\n?([\s\S]*?)(?=\n\w|\n---)/m);
    if (descMatch) {
      result.description = descMatch[1].trim().replace(/\n\s+/g, ' ');
    } else {
      const descSingle = fm.match(/^description:\s*(.+)$/m);
      if (descSingle) result.description = descSingle[1].trim();
    }

    // tags
    const tagsMatch = fm.match(/^tags:\s*\n((?:\s+-\s*.+\n?)*)/m);
    if (tagsMatch) {
      result.tags = tagsMatch[1]
        .split('\n')
        .map(l => l.replace(/^\s+-\s*/, '').trim())
        .filter(Boolean);
    }
  }

  // 如果 frontmatter 没有 name，用第一个 # 标题
  if (!result.name) {
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match) result.name = h1Match[1].trim();
  }

  // 如果没有 description，用第一段文本
  if (!result.description) {
    const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('---'));
    if (lines.length > 0) result.description = lines[0].trim().slice(0, 200);
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════
// 扫描器
// ═══════════════════════════════════════════════════════════════

function scanSkills() {
  if (!existsSync(SKILLS_DIR)) {
    console.error(`[MARDUK] Skills 目录不存在: ${SKILLS_DIR}`);
    return { scanned: 0, registered: 0, errors: [] };
  }

  const entries = readdirSync(SKILLS_DIR);
  let scanned = 0, registered = 0;
  const errors = [];

  for (const entry of entries) {
    const entryPath = join(SKILLS_DIR, entry);
    
    // 跳过文件（只处理目录）
    if (!statSync(entryPath).isDirectory()) continue;
    
    const skillMdPath = join(entryPath, 'SKILL.md');
    if (!existsSync(skillMdPath)) continue;

    scanned++;

    try {
      const parsed = parseSkillMd(skillMdPath);
      const skillName = parsed.name || entry;
      const compatibleAgents = AGENT_SKILL_MAP[entry] || [];

      upsertSkill(
        skillName,
        parsed.description || '',
        entryPath,
        parsed.tags,
        compatibleAgents
      );

      registered++;
      if (VERBOSE) {
        console.log(`  ✅ ${skillName} → [${compatibleAgents.join(', ')}]`);
      }
    } catch (err) {
      errors.push({ skill: entry, error: err.message });
      if (VERBOSE) {
        console.error(`  ❌ ${entry}: ${err.message}`);
      }
    }
  }

  return { scanned, registered, errors };
}

// ═══════════════════════════════════════════════════════════════
// 主入口
// ═══════════════════════════════════════════════════════════════

console.log('[MARDUK機関] Skill 扫描开始...');
const result = scanSkills();
console.log(`[MARDUK機関] 扫描完成: ${result.scanned} 发现, ${result.registered} 已注册`);
if (result.errors.length > 0) {
  console.log(`[MARDUK機関] ${result.errors.length} 个错误:`);
  result.errors.forEach(e => console.log(`  - ${e.skill}: ${e.error}`));
}

export { scanSkills, parseSkillMd };
