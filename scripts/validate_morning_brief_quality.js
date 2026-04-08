#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { getTask, closeDb } from './db.js';

const OBSIDIAN_ROOT = '/Users/dolan/Library/Mobile Documents/iCloud~md~obsidian/Documents/Dolan/AI/08_每日晨报';

function parseArgs(argv) {
  const args = { taskId: null, reportDate: null };
  for (let i = 2; i < argv.length; i += 1) {
    const current = argv[i];
    if (current === '--task') args.taskId = argv[i + 1] || null;
    if (current === '--report-date') args.reportDate = argv[i + 1] || null;
  }
  return args;
}

function toReportDate(taskId, explicitDate = null) {
  if (explicitDate) return explicitDate;
  const match = String(taskId || '').match(/(\d{4})(\d{2})(\d{2})$/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function countNonTableChars(section = '') {
  return section
    .split('\n')
    .filter((line) => !line.trim().startsWith('|'))
    .join('\n')
    .replace(/\s+/g, '')
    .length;
}

function extractSection(markdown, titleRegex) {
  const lines = String(markdown || '').split('\n');
  const sections = [];
  let current = null;
  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      if (current) sections.push(current);
      current = { title: line.trim(), lines: [] };
      continue;
    }
    if (current) current.lines.push(line);
  }
  if (current) sections.push(current);
  return sections.find((item) => titleRegex.test(item.title)) || null;
}

function listFeaturedArticles(featuredDir) {
  if (!existsSync(featuredDir)) return [];
  return readdirSync(featuredDir)
    .filter((name) => name.endsWith('.md') && name !== '元数据.md' && name !== 'thread_cards.md')
    .map((name) => {
      const path = join(featuredDir, name);
      const text = readFileSync(path, 'utf-8');
      return { name, path, chars: text.length };
    });
}

async function main() {
  const { taskId, reportDate: explicitDate } = parseArgs(process.argv);
  const reportDate = toReportDate(taskId, explicitDate);
  if (!reportDate) {
    console.error(JSON.stringify({ success: false, error: '必须传入 --task <task_id> 或 --report-date YYYY-MM-DD' }));
    process.exit(1);
  }

  let task = null;
  if (taskId) {
    task = await getTask(taskId);
  }

  const briefFile = join(OBSIDIAN_ROOT, `${reportDate}.md`);
  const featuredDir = join(OBSIDIAN_ROOT, '精选晨报', reportDate);
  const issues = [];

  if (!existsSync(briefFile)) {
    issues.push({ code: 'BRIEF_FILE_MISSING', message: '晨报主档不存在', path: briefFile });
  }
  if (!existsSync(featuredDir)) {
    issues.push({ code: 'FEATURED_DIR_MISSING', message: '精选目录不存在', path: featuredDir });
  }

  const featured = listFeaturedArticles(featuredDir);
  if (featured.length < 15) {
    issues.push({ code: 'FEATURED_COUNT_TOO_LOW', message: '精选文章数量不足 15 篇', actual: featured.length, expected_min: 15 });
  }

  const deepArticles = featured.filter((item) => item.chars >= 1500);
  if (deepArticles.length < 5) {
    issues.push({ code: 'DEEP_ARTICLE_COUNT_TOO_LOW', message: '深度长文不足 5 篇', actual: deepArticles.length, expected_min: 5 });
  }

  const microArticles = featured.filter((item) => item.chars < 1500);
  const microRatio = featured.length > 0 ? microArticles.length / featured.length : 1;
  if (microRatio > 0.2) {
    issues.push({ code: 'MICRO_RATIO_TOO_HIGH', message: '微内容占比超过 20%', actual: microRatio, expected_max: 0.2 });
  }

  if (existsSync(briefFile)) {
    const brief = readFileSync(briefFile, 'utf-8');
    const deepSection = extractSection(brief, /精选深读/);
    const t0Section = extractSection(brief, /T0/);
    const otherSection = extractSection(brief, /其他简报/);

    if (!deepSection) {
      issues.push({ code: 'BRIEF_DEEP_SECTION_MISSING', message: '晨报主档缺少“精选深读”段落' });
    } else {
      const proseChars = countNonTableChars(deepSection.lines.join('\n'));
      if (proseChars < 2000) {
        issues.push({ code: 'BRIEF_DEEP_SECTION_TOO_THIN', message: '精选深读段落正文过薄', actual: proseChars, expected_min: 2000 });
      }
    }

    if (!t0Section) {
      issues.push({ code: 'BRIEF_T0_SECTION_MISSING', message: '晨报主档缺少 T0 头条段落' });
    }
    if (!otherSection) {
      issues.push({ code: 'BRIEF_OTHER_SECTION_MISSING', message: '晨报主档缺少其他简报段落' });
    }

    if (/##\s+今日要点/.test(brief) && !deepSection) {
      issues.push({ code: 'BRIEF_STILL_SUMMARY_MODE', message: '晨报主档仍停留在旧版“今日要点 + 表格摘要”模式' });
    }
  }

  const result = {
    success: true,
    task_id: taskId || null,
    report_date: reportDate,
    workflow_id: task?.workflow_id || 'daily-morning-brief',
    passed: issues.length === 0,
    summary: {
      featured_count: featured.length,
      deep_article_count: deepArticles.length,
      micro_ratio: microRatio
    },
    issues
  };

  console.log(JSON.stringify(result, null, 2));
  closeDb();
  if (issues.length > 0) process.exit(2);
}

main().catch((error) => {
  console.error(JSON.stringify({ success: false, error: error.message }));
  closeDb();
  process.exit(1);
});
