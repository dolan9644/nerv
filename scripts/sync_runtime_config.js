#!/usr/bin/env node
/**
 * Sync NERV source-of-truth config into the current OpenClaw runtime.
 *
 * - Applies agents from nerv_agents_registry.js
 * - Applies cron jobs from nerv_cron_jobs.js
 * - Preserves user-specific channels/bindings
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import NERV_AGENTS from './nerv_agents_registry.js';
import NERV_CRON_JOBS from './nerv_cron_jobs.js';
import { NERV_INFRA_JOB_IDS, shouldUseSystemScheduler } from './nerv_system_scheduler.js';

const HOME = os.homedir();
const OPENCLAW_CONFIG = path.join(HOME, '.openclaw', 'openclaw.json');
const CRON_JOBS_FILE = path.join(HOME, '.openclaw', 'cron', 'jobs.json');

const REMOVE = process.argv.includes('--remove');

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function syncOpenclawConfig() {
  const config = readJson(OPENCLAW_CONFIG, {});
  config.agents = config.agents || {};
  config.agents.list = Array.isArray(config.agents.list) ? config.agents.list : [];
  config.tools = config.tools || {};
  config.tools.sessions = config.tools.sessions || {};
  config.tools.sessions.visibility = 'all';
  config.tools.agentToAgent = config.tools.agentToAgent || {};
  config.tools.agentToAgent.enabled = true;
  config.tools.agentToAgent.allow = Array.isArray(config.tools.agentToAgent.allow)
    ? config.tools.agentToAgent.allow
    : [];

  const incomingIds = new Set(NERV_AGENTS.map((agent) => agent.id));
  config.agents.list = config.agents.list.filter((agent) => !incomingIds.has(agent.id));

  if (!REMOVE) {
    config.agents.list.push(...NERV_AGENTS);
    const allow = new Set(config.tools.agentToAgent.allow);
    allow.add('nerv-*');
    config.tools.agentToAgent.allow = [...allow];
  } else {
    config.tools.agentToAgent.allow = config.tools.agentToAgent.allow.filter((item) => item !== 'nerv-*' && !String(item).startsWith('nerv-'));
  }

  writeJson(OPENCLAW_CONFIG, config);
  return {
    file: OPENCLAW_CONFIG,
    mode: REMOVE ? 'remove' : 'apply',
    agents_written: REMOVE ? 0 : NERV_AGENTS.length
  };
}

function syncCronJobs() {
  const payload = readJson(CRON_JOBS_FILE, { version: 1, jobs: [] });
  payload.jobs = Array.isArray(payload.jobs) ? payload.jobs : [];
  const existingById = new Map(payload.jobs.map((job) => [job.id, job]));
  const incomingJobs = shouldUseSystemScheduler()
    ? NERV_CRON_JOBS.filter((job) => !NERV_INFRA_JOB_IDS.includes(job.id))
    : NERV_CRON_JOBS;
  const incomingIds = new Set(incomingJobs.map((job) => job.id));
  const legacyInfraIds = new Set(NERV_INFRA_JOB_IDS);

  payload.jobs = payload.jobs.filter((job) => {
    if (REMOVE) return !String(job.id || '').startsWith('nerv-');
    if (shouldUseSystemScheduler() && legacyInfraIds.has(job.id)) return false;
    return !incomingIds.has(job.id);
  });

  if (!REMOVE) {
    for (const job of incomingJobs) {
      const existing = existingById.get(job.id);
      payload.jobs.push(existing ? {
        ...existing,
        ...job,
        state: existing.state ?? job.state,
        createdAtMs: existing.createdAtMs ?? job.createdAtMs,
        updatedAtMs: existing.updatedAtMs ?? job.updatedAtMs
      } : job);
    }
  }

  writeJson(CRON_JOBS_FILE, payload);
  return {
    file: CRON_JOBS_FILE,
    mode: REMOVE ? 'remove' : 'apply',
    jobs_written: REMOVE ? 0 : incomingJobs.length
  };
}

function main() {
  const result = {
    openclaw: syncOpenclawConfig(),
    cron: syncCronJobs()
  };
  console.log(JSON.stringify(result, null, 2));
}

main();
