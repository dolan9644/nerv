#!/usr/bin/env node

import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { closeDb, createFullDag, getReadyDispatchNodes, getTask } from './db.js';

const RAW_ROOT = '/Users/dolan/.openclaw/nerv/data/rss-raw';
const MONITOR_ROOT = '/Users/dolan/.openclaw/nerv/data/rss-monitor';
const RANKED_ROOT = '/Users/dolan/.openclaw/nerv/data/rss-ranked';
const ZH_ROOT = '/Users/dolan/.openclaw/nerv/data/rss-zh';
const OBSIDIAN_ROOT = '/Users/dolan/Library/Mobile Documents/iCloud~md~obsidian/Documents/Dolan/AI/08_每日晨报';

function readArg(name, fallback = null) {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const idx = process.argv.indexOf(name);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

function pad(num) {
  return String(num).padStart(2, '0');
}

function formatYmd(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatCompact(date) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

function buildShanghaiEightAM(reportDate) {
  return new Date(`${reportDate}T08:00:00+08:00`);
}

function toEpochMs(dateDir, slotDir) {
  return new Date(`${dateDir}T${slotDir.slice(0, 2)}:${slotDir.slice(2, 4)}:${slotDir.slice(4, 6)}+08:00`).getTime();
}

function collectWindowRawFiles(reportDate) {
  const windowEnd = buildShanghaiEightAM(reportDate).getTime();
  const windowStart = windowEnd - (24 * 60 * 60 * 1000);
  const files = [];

  if (!existsSync(RAW_ROOT)) {
    return { files, windowStart, windowEnd };
  }

  for (const dateDir of readdirSync(RAW_ROOT)) {
    const datePath = join(RAW_ROOT, dateDir);
    let slotDirs = [];
    try {
      slotDirs = readdirSync(datePath);
    } catch {
      continue;
    }

    for (const slotDir of slotDirs) {
      if (!/^\d{6}$/.test(slotDir)) continue;
      const slotTs = toEpochMs(dateDir, slotDir);
      if (Number.isNaN(slotTs) || slotTs < windowStart || slotTs > windowEnd) continue;
      const rawPath = join(datePath, slotDir, 'raw.json');
      if (existsSync(rawPath)) {
        files.push(rawPath);
      }
    }
  }

  files.sort();
  return { files, windowStart, windowEnd };
}

function buildNode(nodeId, agentId, description, depth, outputDir, outputArtifact, inputPaths = [], constraints = {}, maxRetries = 3) {
  return {
    node_id: nodeId,
    agent_id: agentId,
    description,
    depth,
    max_retries: maxRetries,
    contract: {
      dispatch_contract: {
        mode: 'agent_session',
        description,
        input_paths: inputPaths,
        output_dir: outputDir,
        constraints: {
          ...constraints,
          output_artifact: outputArtifact
        }
      },
      completion_contract: {
        mode: 'event_or_artifact',
        accepted_events: ['NODE_COMPLETED', 'NODE_FAILED'],
        required_artifacts: outputArtifact ? [outputArtifact] : [],
        result_path_from: 'first_required_artifact'
      },
      runtime_contract: {
        max_retries: maxRetries
      }
    }
  };
}

function buildDispatchPayloads(task, readyNodes) {
  const dag = task?.dag_json ? JSON.parse(task.dag_json) : { nodes: [] };
  const nodeMap = new Map((dag.nodes || []).map((node) => [node.node_id, node]));
  return readyNodes.map((node) => {
    const nodeDef = nodeMap.get(node.node_id) || {};
    const dispatchContract = nodeDef?.contract?.dispatch_contract || {};
    return {
      node_id: node.node_id,
      agent_id: node.agent_id,
      session_key: node.session_key || null,
      session_scope: node.session_scope || 'main',
      dispatch_payload: {
        description: dispatchContract.description || node.description || '',
        input_paths: Array.isArray(dispatchContract.input_paths) ? dispatchContract.input_paths : [],
        output_dir: dispatchContract.output_dir || null,
        constraints: dispatchContract.constraints || {}
      }
    };
  });
}

async function main() {
  const reportDate = readArg('--report-date', formatYmd(new Date()));
  const compactDate = reportDate.replace(/-/g, '');
  const taskId = `daily-morning-brief-${compactDate}`;
  const { files: rawFiles, windowStart, windowEnd } = collectWindowRawFiles(reportDate);

  if (rawFiles.length === 0) {
    console.error(JSON.stringify({
      success: false,
      error: 'NO_RAW_INPUTS',
      report_date: reportDate,
      window_start_ms: windowStart,
      window_end_ms: windowEnd
    }));
    process.exit(1);
  }

  const monitorFile = join(MONITOR_ROOT, `${reportDate}.json`);
  const rankedFile = join(RANKED_ROOT, `${reportDate}.json`);
  const zhFile = join(ZH_ROOT, `${reportDate}.json`);
  const featuredDir = join(OBSIDIAN_ROOT, '精选晨报', reportDate);
  const briefFile = join(OBSIDIAN_ROOT, `${reportDate}.md`);

  const existingTask = await getTask(taskId);
  if (existingTask) {
    const readyNodes = await getReadyDispatchNodes(taskId);
    console.log(JSON.stringify({
      success: true,
      reused: true,
      task_id: taskId,
      task_status: existingTask.status,
      orchestrator_session_key: existingTask.orchestrator_session_key || null,
      session_strategy: existingTask.session_strategy || 'task_scoped',
      raw_inputs: rawFiles,
      ready_dispatches: buildDispatchPayloads(existingTask, readyNodes)
    }));
    return;
  }

  const commonConstraints = {
    report_date: reportDate,
    window_start_ms: windowStart,
    window_end_ms: windowEnd
  };

  const nodes = [
    buildNode(
      `mb-coverage-${compactDate}`,
      'nerv-eva02',
      `检查过去 24 小时 RSS 原始批次覆盖率，生成 ${monitorFile}`,
      0,
      MONITOR_ROOT,
      monitorFile,
      rawFiles,
      commonConstraints
    ),
    buildNode(
      `mb-rank-${compactDate}`,
      'nerv-eva00',
      `合并过去 24 小时 RSS 原始批次并清洗评分，生成 ${rankedFile}`,
      1,
      RANKED_ROOT,
      rankedFile,
      [...rawFiles, monitorFile],
      commonConstraints
    ),
    buildNode(
      `mb-translate-${compactDate}`,
      'nerv-eva13',
      `翻译 ranked JSON，生成 ${zhFile}`,
      2,
      ZH_ROOT,
      zhFile,
      [rankedFile],
      commonConstraints
    ),
    buildNode(
      `mb-featured-${compactDate}`,
      'nerv-eva13',
      `筛选并翻译精选长文，写入 ${featuredDir}`,
      3,
      featuredDir,
      featuredDir,
      [rankedFile, zhFile],
      {
        ...commonConstraints,
        min_featured_articles: 15,
        min_fulltext_articles: 5,
        min_fulltext_chars: 1500,
        max_micro_post_ratio: 0.2,
        prefer_article_sources: true,
        fulltext_selection_basis: 'final_score_desc_and_depth_first',
        allow_article_level_split: true
      }
    ),
    buildNode(
      `mb-compile-${compactDate}`,
      'nerv-misato',
      `编译晨报主档并通知，写入 ${briefFile}`,
      4,
      OBSIDIAN_ROOT,
      briefFile,
      [monitorFile, rankedFile, zhFile, featuredDir],
      {
        ...commonConstraints,
        brief_structure: 't0_headlines_then_deep_reads_then_other_briefs',
        min_t0_items: 5,
        min_deep_read_items: 5,
        min_deep_read_section_chars: 2000,
        disallow_table_only_brief: true,
        require_featured_body_reuse: true,
        emit_thread_cards_as_sidecar: true
      }
    )
  ];

  const edges = [
    { from: `mb-coverage-${compactDate}`, to: `mb-rank-${compactDate}` },
    { from: `mb-rank-${compactDate}`, to: `mb-translate-${compactDate}` },
    { from: `mb-translate-${compactDate}`, to: `mb-featured-${compactDate}` },
    { from: `mb-featured-${compactDate}`, to: `mb-compile-${compactDate}` }
  ];

  const created = await createFullDag({
    taskId,
    initiatorId: 'nerv-cron',
    intent: `08:00 AI 晨报 DAG（${reportDate}）`,
    priority: 1,
    workflowId: 'daily-morning-brief',
    workflowCnName: '晨报链',
    entryMode: 'builder_script',
    resolvedFrom: 'builder_script',
    orchestratorAgentId: 'nerv-misato',
    sessionStrategy: 'task_scoped',
    nodes,
    edges
  });

  const task = await getTask(taskId);
  const readyNodes = await getReadyDispatchNodes(taskId);
  console.log(JSON.stringify({
    success: true,
    reused: false,
    task_id: taskId,
    report_date: reportDate,
    raw_inputs: rawFiles,
    orchestrator_session_key: created.orchestratorSessionKey,
    session_strategy: created.sessionStrategy,
    ready_dispatches: buildDispatchPayloads(task, readyNodes)
  }));
}

main().catch((error) => {
  console.error(JSON.stringify({
    success: false,
    error: error.message
  }));
  process.exit(1);
}).finally(() => {
  closeDb();
});
