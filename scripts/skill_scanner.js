#!/usr/bin/env node
/**
 * ███ NERV · MARDUK機関 · Skill 发现引擎 ███
 *
 * 按 OpenClaw 当前官方规则扫描技能来源：
 * 1. extraDirs（最低优先级）
 * 2. bundled skills
 * 3. enabled plugin skills
 * 4. ~/.openclaw/skills
 * 5. <workspace>/skills
 *
 * 冲突处理遵循 OpenClaw precedence：高优先级覆盖低优先级。
 * 当前 registry 仍以 skill_name 为主键，因此只落“有效赢家”版本。
 *
 * 用法：
 *   node skill_scanner.js
 *   node skill_scanner.js --verbose
 *   node skill_scanner.js --json
 */

import { execFileSync } from 'child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { basename, dirname, isAbsolute, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { closeDb, upsertSkill, withRetry } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const NERV_ROOT = resolve(__dirname, '..');
const OPENCLAW_ROOT = resolve(NERV_ROOT, '..');
const OPENCLAW_CONFIG_PATH = join(OPENCLAW_ROOT, 'openclaw.json');
const BUNDLED_SKILLS_DIR = join(OPENCLAW_ROOT, 'lib', 'node_modules', 'openclaw', 'skills');
const MANAGED_SKILLS_DIR = join(OPENCLAW_ROOT, 'skills');
const WORKSPACE_SKILLS_DIR = join(NERV_ROOT, 'skills');
const VERBOSE = process.argv.includes('--verbose');
const JSON_OUTPUT = process.argv.includes('--json');

const SOURCE_PRIORITY = {
  extra: 0,
  bundled: 1,
  plugin: 1,
  managed: 2,
  workspace: 3
};

const IGNORED_DIRS = new Set([
  '.git',
  '.DS_Store',
  '__pycache__',
  'node_modules'
]);

// Agent → Skill 兼容性映射
const AGENT_SKILL_MAP = {
  'nerv-publisher': ['nerv-gendo'],
  'nerv-code-runner': ['nerv-ritsuko', 'nerv-asuka', 'nerv-eva01'],
  'nerv-gemini': ['nerv-shinji', 'nerv-ritsuko'],
  'nerv-codex': ['nerv-ritsuko', 'nerv-asuka'],
  'nerv-aider': ['nerv-ritsuko'],
  'nerv-obsidian': ['nerv-rei'],
  'nerv-search': ['nerv-eva03'],
  'nerv-github': ['nerv-ritsuko'],
  'duckduckgo-search': ['nerv-eva03', 'nerv-mari'],
  'openclaw-tavily-search': ['nerv-eva03'],
  'rss-fetcher': ['nerv-eva02'],
  'summarize': ['nerv-eva13', 'nerv-shinji'],
  'docx-writer': ['nerv-eva13'],
  'gemini-image-generate': ['nerv-eva-series']
};

const binCache = new Map();

function log(...args) {
  if (!JSON_OUTPUT) console.log(...args);
}

function vlog(...args) {
  if (VERBOSE && !JSON_OUTPUT) console.log(...args);
}

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

function getConfigValue(obj, path) {
  return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

function hasBin(binName) {
  if (binCache.has(binName)) return binCache.get(binName);
  let found = false;
  try {
    const locator = process.platform === 'win32' ? 'where' : 'which';
    execFileSync(locator, [binName], { stdio: 'ignore' });
    found = true;
  } catch {
    found = false;
  }
  binCache.set(binName, found);
  return found;
}

function parseJsonInline(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  return match ? match[1] : null;
}

function parseSkillMd(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const result = {
    name: null,
    description: null,
    tags: [],
    metadata: null,
    homepage: null
  };

  const fm = extractFrontmatter(content);
  if (fm) {
    const nameMatch = fm.match(/^name:\s*(.+)$/m);
    if (nameMatch) result.name = nameMatch[1].trim();

    const descMatch = fm.match(/^description:\s*\|?\s*\n?([\s\S]*?)(?=\n\w[\w-]*:|\n---|$)/m);
    if (descMatch) {
      result.description = descMatch[1].trim().replace(/\n\s+/g, ' ');
    } else {
      const descSingle = fm.match(/^description:\s*(.+)$/m);
      if (descSingle) result.description = descSingle[1].trim();
    }

    const tagsMatch = fm.match(/^tags:\s*\n((?:\s+-\s*.+\n?)*)/m);
    if (tagsMatch) {
      result.tags = tagsMatch[1]
        .split('\n')
        .map((line) => line.replace(/^\s+-\s*/, '').trim())
        .filter(Boolean);
    }

    const metadataMatch = fm.match(/^metadata:\s*(.+)$/m);
    if (metadataMatch) {
      result.metadata = parseJsonInline(metadataMatch[1].trim());
    }

    const homepageMatch = fm.match(/^homepage:\s*(.+)$/m);
    if (homepageMatch) result.homepage = homepageMatch[1].trim();
  }

  if (!result.name) {
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match) result.name = h1Match[1].trim();
  }

  if (!result.description) {
    const lines = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line !== '---');
    if (lines.length > 0) result.description = lines[0].slice(0, 200);
  }

  return result;
}

function resolveConfig() {
  return readJson(OPENCLAW_CONFIG_PATH) || {};
}

function resolveExtraDirs(config) {
  const extraDirs = config.skills?.load?.extraDirs;
  if (!Array.isArray(extraDirs)) return [];
  return extraDirs
    .filter((dir) => typeof dir === 'string' && dir.trim().length > 0)
    .map((dir) => (isAbsolute(dir) ? dir : resolve(OPENCLAW_ROOT, dir)));
}

function resolvePluginSkillRoots(config) {
  const pluginEntries = config.plugins?.entries ?? {};
  const pluginInstalls = config.plugins?.installs ?? {};
  const roots = [];

  for (const [pluginId, entry] of Object.entries(pluginEntries)) {
    if (entry?.enabled !== true) continue;

    const installPath = pluginInstalls[pluginId]?.installPath || join(OPENCLAW_ROOT, 'extensions', pluginId);
    const manifestPath = join(installPath, 'openclaw.plugin.json');
    const manifest = readJson(manifestPath);
    if (!manifest || !Array.isArray(manifest.skills)) continue;

    for (const relativeSkillDir of manifest.skills) {
      if (typeof relativeSkillDir !== 'string' || relativeSkillDir.trim().length === 0) continue;
      roots.push({
        path: resolve(installPath, relativeSkillDir),
        load_source: 'plugin',
        source_priority: SOURCE_PRIORITY.plugin,
        source_root: installPath,
        plugin_id: pluginId
      });
    }
  }

  return roots;
}

function discoverSkillRoots(config) {
  const rawRoots = [
    ...resolveExtraDirs(config).map((path) => ({
      path,
      load_source: 'extra',
      source_priority: SOURCE_PRIORITY.extra,
      source_root: path
    })),
    {
      path: BUNDLED_SKILLS_DIR,
      load_source: 'bundled',
      source_priority: SOURCE_PRIORITY.bundled,
      source_root: BUNDLED_SKILLS_DIR
    },
    ...resolvePluginSkillRoots(config),
    {
      path: MANAGED_SKILLS_DIR,
      load_source: 'managed',
      source_priority: SOURCE_PRIORITY.managed,
      source_root: MANAGED_SKILLS_DIR
    },
    {
      path: WORKSPACE_SKILLS_DIR,
      load_source: 'workspace',
      source_priority: SOURCE_PRIORITY.workspace,
      source_root: WORKSPACE_SKILLS_DIR
    }
  ];

  const deduped = [];
  const seen = new Set();
  for (const root of rawRoots) {
    if (!existsSync(root.path)) continue;
    const key = `${root.load_source}:${resolve(root.path)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(root);
  }
  return deduped;
}

function findSkillDirs(rootPath) {
  const skillDirs = [];
  const visited = new Set();

  function walk(currentPath) {
    const normalized = resolve(currentPath);
    if (visited.has(normalized)) return;
    visited.add(normalized);

    let dirents = [];
    try {
      dirents = readdirSync(currentPath, { withFileTypes: true });
    } catch {
      return;
    }

    if (existsSync(join(currentPath, 'SKILL.md'))) {
      skillDirs.push(currentPath);
    }

    for (const entry of dirents) {
      if (!entry.isDirectory()) continue;
      if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      walk(join(currentPath, entry.name));
    }
  }

  walk(rootPath);
  return skillDirs.sort((a, b) => a.localeCompare(b));
}

function resolveSkillConfig(parsedSkill, config) {
  const openclawMeta = parsedSkill.metadata?.openclaw ?? {};
  const skillName = parsedSkill.name;
  const skillKey = openclawMeta.skillKey || skillName;
  const entries = config.skills?.entries ?? {};
  const entryConfig = entries[skillKey] ?? entries[skillName] ?? {};
  return { openclawMeta, skillKey, entryConfig };
}

function envValueSatisfied(varName, openclawMeta, entryConfig) {
  if (process.env[varName]) return true;
  if (entryConfig?.env?.[varName]) return true;
  if (openclawMeta.primaryEnv === varName && entryConfig?.apiKey) return true;
  return false;
}

function evaluateEligibility(parsedSkill, rootInfo, config) {
  const reasons = [];
  const { openclawMeta, skillKey, entryConfig } = resolveSkillConfig(parsedSkill, config);
  const requires = openclawMeta.requires ?? {};

  if (entryConfig?.enabled === false) {
    return {
      status: 'disabled',
      skillKey,
      reasons: [{ code: 'config_disabled', detail: 'skills.entries.<key>.enabled=false' }],
      openclawMeta,
      entryConfig
    };
  }

  if (rootInfo.load_source === 'bundled') {
    const allowBundled = config.skills?.allowBundled;
    if (Array.isArray(allowBundled) && !allowBundled.includes(skillKey) && !allowBundled.includes(parsedSkill.name)) {
      return {
        status: 'gated',
        skillKey,
        reasons: [{ code: 'bundled_not_allowlisted', detail: 'skills.allowBundled 生效' }],
        openclawMeta,
        entryConfig
      };
    }
  }

  if (openclawMeta.always === true) {
    return { status: 'eligible', skillKey, reasons, openclawMeta, entryConfig };
  }

  if (Array.isArray(openclawMeta.os) && openclawMeta.os.length > 0 && !openclawMeta.os.includes(process.platform)) {
    reasons.push({ code: 'os_mismatch', detail: `当前平台 ${process.platform} 不在允许列表中` });
  }

  if (Array.isArray(requires.bins)) {
    const missingBins = requires.bins.filter((binName) => !hasBin(binName));
    if (missingBins.length > 0) {
      reasons.push({ code: 'missing_bins', detail: missingBins });
    }
  }

  if (Array.isArray(requires.anyBins) && requires.anyBins.length > 0) {
    const anyMatched = requires.anyBins.some((binName) => hasBin(binName));
    if (!anyMatched) {
      reasons.push({ code: 'missing_any_bins', detail: requires.anyBins });
    }
  }

  if (Array.isArray(requires.env)) {
    const missingEnv = requires.env.filter((name) => !envValueSatisfied(name, openclawMeta, entryConfig));
    if (missingEnv.length > 0) {
      reasons.push({ code: 'missing_env', detail: missingEnv });
    }
  }

  if (Array.isArray(requires.config)) {
    const missingConfig = requires.config.filter((path) => !getConfigValue(config, path));
    if (missingConfig.length > 0) {
      reasons.push({ code: 'missing_config', detail: missingConfig });
    }
  }

  return {
    status: reasons.length === 0 ? 'eligible' : 'gated',
    skillKey,
    reasons,
    openclawMeta,
    entryConfig
  };
}

function buildCompatibleAgents(skillName, skillKey, dirName) {
  return AGENT_SKILL_MAP[skillKey] || AGENT_SKILL_MAP[skillName] || AGENT_SKILL_MAP[dirName] || [];
}

function buildCandidate(skillDir, rootInfo, config) {
  const skillMdPath = join(skillDir, 'SKILL.md');
  const parsed = parseSkillMd(skillMdPath);
  const dirName = basename(skillDir);
  const skillName = parsed.name || dirName;
  parsed.name = skillName;
  const { status, reasons, skillKey, openclawMeta } = evaluateEligibility(parsed, rootInfo, config);

  return {
    skill_name: skillName,
    skill_key: skillKey,
    description: parsed.description || '',
    path: skillDir,
    tags: parsed.tags || [],
    compatible_agents: buildCompatibleAgents(skillName, skillKey, dirName),
    source_type: 'native',
    load_source: rootInfo.load_source,
    source_priority: rootInfo.source_priority,
    source_root: rootInfo.source_root,
    metadata_json: JSON.stringify(openclawMeta || {}),
    gating_status: status,
    gating_reason: reasons.length > 0 ? JSON.stringify(reasons) : null
  };
}

function chooseEffectiveSkills(candidates) {
  const winners = new Map();
  let gated = 0;
  let disabled = 0;
  let shadowed = 0;

  for (const candidate of candidates) {
    if (candidate.gating_status === 'disabled') {
      disabled += 1;
      continue;
    }
    if (candidate.gating_status !== 'eligible') {
      gated += 1;
      continue;
    }

    if (winners.has(candidate.skill_name)) {
      shadowed += 1;
    }
    winners.set(candidate.skill_name, candidate);
  }

  return {
    winners: Array.from(winners.values()),
    gated,
    disabled,
    shadowed
  };
}

async function purgeStaleNativeSkills(activeSkillNames) {
  return withRetry((db) => {
    if (activeSkillNames.length === 0) {
      return db.prepare(`DELETE FROM skill_registry WHERE source_type = 'native'`).run().changes;
    }
    const placeholders = activeSkillNames.map(() => '?').join(', ');
    return db.prepare(`
      DELETE FROM skill_registry
      WHERE source_type = 'native'
        AND skill_name NOT IN (${placeholders})
    `).run(...activeSkillNames).changes;
  });
}

async function backfillRegistryMetadata() {
  return withRetry((db) => {
    const discovered = db.prepare(`
      UPDATE skill_registry
      SET load_source = 'discovered',
          source_priority = 0,
          skill_key = COALESCE(NULLIF(skill_key, ''), skill_name),
          gating_status = COALESCE(NULLIF(gating_status, ''), 'eligible')
      WHERE source_type = 'discovered'
        AND (load_source IS NULL OR load_source = '' OR load_source = 'managed')
    `).run().changes;

    const native = db.prepare(`
      UPDATE skill_registry
      SET skill_key = COALESCE(NULLIF(skill_key, ''), skill_name),
          gating_status = COALESCE(NULLIF(gating_status, ''), 'eligible')
      WHERE source_type = 'native'
        AND (skill_key IS NULL OR skill_key = '' OR gating_status IS NULL OR gating_status = '')
    `).run().changes;

    return { discovered, native };
  });
}

async function scanSkills() {
  const config = resolveConfig();
  const skillRoots = discoverSkillRoots(config);
  const candidates = [];
  const errors = [];

  for (const root of skillRoots) {
    const discoveredDirs = findSkillDirs(root.path);
    vlog(`[MARDUK] 扫描 ${root.load_source}: ${root.path} (${discoveredDirs.length} entries)`);

    for (const skillDir of discoveredDirs) {
      try {
        candidates.push(buildCandidate(skillDir, root, config));
      } catch (error) {
        errors.push({ skill: skillDir, error: error.message });
      }
    }
  }

  const sortedCandidates = candidates.sort((a, b) => {
    if (a.source_priority !== b.source_priority) return a.source_priority - b.source_priority;
    return a.path.localeCompare(b.path);
  });

  const selection = chooseEffectiveSkills(sortedCandidates);
  let registered = 0;
  for (const skill of selection.winners) {
    await upsertSkill(
      skill.skill_name,
      skill.description,
      skill.path,
      skill.tags,
      skill.compatible_agents,
      {
        source_type: skill.source_type,
        load_source: skill.load_source,
        source_priority: skill.source_priority,
        source_root: skill.source_root,
        skill_key: skill.skill_key,
        gating_status: skill.gating_status,
        gating_reason: skill.gating_reason,
        metadata_json: skill.metadata_json
      }
    );
    registered += 1;
    vlog(`  ✅ ${skill.skill_name} [${skill.load_source}] -> [${skill.compatible_agents.join(', ')}]`);
  }

  const deleted = selection.winners.length > 0
    ? await purgeStaleNativeSkills(selection.winners.map((skill) => skill.skill_name))
    : 0;
  const backfilled = await backfillRegistryMetadata();

  const sources = {};
  for (const winner of selection.winners) {
    sources[winner.load_source] = (sources[winner.load_source] || 0) + 1;
  }

  return {
    scanned_roots: skillRoots.map((root) => ({
      path: root.path,
      load_source: root.load_source,
      source_priority: root.source_priority
    })),
    discovered_candidates: sortedCandidates.length,
    registered,
    deleted,
    backfilled,
    gated: selection.gated,
    disabled: selection.disabled,
    shadowed: selection.shadowed,
    sources,
    errors
  };
}

async function main() {
  try {
    if (!JSON_OUTPUT) log('[MARDUK機関] Skill 扫描开始...');
    const result = await scanSkills();
    if (JSON_OUTPUT) {
      console.log(JSON.stringify({ success: true, ...result }, null, 2));
    } else {
      log(`[MARDUK機関] 扫描完成: ${result.discovered_candidates} 候选, ${result.registered} 已注册, ${result.deleted} 已清理`);
      log(`[MARDUK機関] 来源分布: ${JSON.stringify(result.sources)}`);
      if (result.gated > 0 || result.disabled > 0 || result.shadowed > 0) {
        log(`[MARDUK機関] gated=${result.gated}, disabled=${result.disabled}, shadowed=${result.shadowed}`);
      }
      if (result.errors.length > 0) {
        log(`[MARDUK機関] ${result.errors.length} 个错误:`);
        result.errors.forEach((item) => log(`  - ${item.skill}: ${item.error}`));
      }
    }
  } catch (error) {
    const payload = { success: false, error: error.message };
    if (JSON_OUTPUT) {
      console.error(JSON.stringify(payload, null, 2));
    } else {
      console.error(`[MARDUK機関] Skill 扫描失败: ${error.message}`);
    }
    process.exitCode = 1;
  } finally {
    closeDb();
  }
}

main();

export { scanSkills, parseSkillMd, discoverSkillRoots };
