#!/usr/bin/env node
/**
 * ███ NERV 专属工具 · scan_available_skills (Harness Refactored) ███
 *
 * misato 专用。查询 nerv.db skill_registry 获取可用 Skill 列表。
 * 摒弃了脆弱的 stdin 超时机制，采用安全确定的命令行参数。
 *
 * 用法：
 *   node scripts/tools/scan_available_skills.js --all
 *   node scripts/tools/scan_available_skills.js --keyword "crawl"
 *   node scripts/tools/scan_available_skills.js --agent "mari"
 */

import { searchSkills, closeDb, withRetry } from '../db.js';

async function main() {
  const args = process.argv.slice(2);
  const input = {};

  // 安全确定的参数解析（无 stdin，无 setTimeout，零歧义）
  if (args.includes('--keyword')) {
    input.keyword = args[args.indexOf('--keyword') + 1];
  } else if (args.includes('--agent')) {
    input.agent_id = args[args.indexOf('--agent') + 1];
  } else if (args.includes('--all')) {
    input.all = true;
  } else {
    console.error(JSON.stringify({
      success: false,
      error: '必须指定查询模式：--all, --keyword <word>, 或 --agent <id>'
    }));
    process.exit(1);
  }

  try {
    let skills;

    if (input.keyword) {
      skills = await searchSkills(input.keyword);
    } else if (input.agent_id) {
      skills = await withRetry((db) => {
        return db.prepare(`
          SELECT skill_name, description, path, tags, compatible_agents
          FROM skill_registry
          WHERE compatible_agents LIKE ?
          ORDER BY skill_name
        `).all(`%${input.agent_id}%`);
      });
    } else {
      skills = await withRetry((db) => {
        return db.prepare(`
          SELECT skill_name, description, path, tags, compatible_agents
          FROM skill_registry
          ORDER BY skill_name
        `).all();
      });
    }

    // 反序列化 JSON 字符串字段，消除双重转义
    console.log(JSON.stringify({
      success: true,
      total: skills.length,
      skills: skills.map(s => {
        let parsedTags = [];
        let parsedAgents = [];
        try { parsedTags = JSON.parse(s.tags || '[]'); } catch (e) { /* fallback */ }
        try { parsedAgents = JSON.parse(s.compatible_agents || '[]'); } catch (e) { /* fallback */ }

        return {
          name: s.skill_name,
          description: s.description,
          path: s.path,
          tags: parsedTags,
          compatible_agents: parsedAgents
        };
      })
    }, null, 2));

  } catch (e) {
    console.error(JSON.stringify({
      success: false,
      error: `【技能查询失败】${e.message}`
    }));
    process.exit(1);
  } finally {
    closeDb();
  }
}

main();
