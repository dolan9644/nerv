#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import { spawnSync } from 'child_process';
import {
  computeNextRunAtMs,
  getInfraJob,
  RUNTIME_LOG_DIR,
  RUNTIME_STATE_DIR
} from './nerv_system_scheduler.js';

const jobId = process.argv[2];
const job = getInfraJob(jobId);

if (!job) {
  console.error(JSON.stringify({
    status: 'error',
    error: `Unknown infra job: ${jobId || '<missing>'}`
  }));
  process.exit(1);
}

fs.mkdirSync(RUNTIME_STATE_DIR, { recursive: true });
fs.mkdirSync(RUNTIME_LOG_DIR, { recursive: true });

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function writeState(patch) {
  const previous = safeReadJson(job.state_file) || {};
  const next = {
    ...previous,
    job_id: job.id,
    name: job.name,
    scheduler_mode: 'launchd',
    launchd_label: job.launchd_label,
    schedule: job.schedule,
    command: job.command,
    cwd: job.cwd,
    ...patch
  };
  fs.writeFileSync(job.state_file, JSON.stringify(next, null, 2));
  return next;
}

function excerpt(text, limit = 1200) {
  const normalized = String(text || '').trim();
  return normalized.length > limit ? `${normalized.slice(0, limit)}…` : normalized;
}

function parseJsonMaybe(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const start = raw.indexOf('{');
  if (start === -1) return null;
  try {
    return JSON.parse(raw.slice(start));
  } catch {
    return null;
  }
}

function summarizeResult(stdout, stderr) {
  const parsed = parseJsonMaybe(stdout);
  if (!parsed) {
    return {
      summary: excerpt(stdout || stderr || ''),
      metrics: null
    };
  }

  if (job.id === 'nerv-spear-sync') {
    return {
      summary: `orphans=${parsed.orphans?.length || 0}, missedDispatches=${parsed.missedDispatches?.length || 0}, circuitBreaks=${parsed.circuitBreaks?.length || 0}`,
      metrics: {
        orphans: parsed.orphans?.length || 0,
        missed_dispatches: parsed.missedDispatches?.length || 0,
        circuit_breaks: parsed.circuitBreaks?.length || 0
      }
    };
  }

  if (job.id === 'nerv-security-probe') {
    return {
      summary: `anomalies=${parsed.anomalies?.length || 0}`,
      metrics: {
        anomalies: parsed.anomalies?.length || 0,
        total_executes: parsed.stats?.total_executes || 0
      }
    };
  }

  if (job.id === 'nerv-session-recorder') {
    return {
      summary: `events_found=${parsed.events_found || 0}, recorded=${parsed.records_written || 0}, wakes=${(parsed.orchestrator_wakes || []).filter((item) => item.sent).length}`,
      metrics: parsed
    };
  }

  return {
    summary: excerpt(stdout),
    metrics: parsed
  };
}

const startedAtMs = Date.now();
writeState({
  status: 'running',
  last_started_at_ms: startedAtMs,
  last_started_at_iso: new Date(startedAtMs).toISOString(),
  updated_at_ms: startedAtMs,
  pid: process.pid
});

const result = spawnSync(job.command[0], job.command.slice(1), {
  cwd: job.cwd || os.homedir(),
  encoding: 'utf-8',
  timeout: job.timeout_seconds * 1000,
  maxBuffer: 4 * 1024 * 1024,
  env: {
    ...process.env,
    HOME: os.homedir()
  }
});

const finishedAtMs = Date.now();
const timedOut = Boolean(result.error && result.error.code === 'ETIMEDOUT');
const status = !result.error && result.status === 0 ? 'ok' : 'error';
const stdout = String(result.stdout || '');
const stderr = String(result.stderr || (result.error ? result.error.message : ''));
const summary = summarizeResult(stdout, stderr);

writeState({
  status,
  last_status: status,
  last_run_at_ms: startedAtMs,
  last_finished_at_ms: finishedAtMs,
  last_finished_at_iso: new Date(finishedAtMs).toISOString(),
  duration_ms: finishedAtMs - startedAtMs,
  next_run_at_ms: computeNextRunAtMs(job.schedule, finishedAtMs),
  updated_at_ms: finishedAtMs,
  exit_status: result.status,
  timed_out: timedOut,
  summary: summary.summary,
  metrics: summary.metrics,
  stdout_excerpt: excerpt(stdout),
  stderr_excerpt: excerpt(stderr)
});

if (status !== 'ok') {
  console.error(JSON.stringify({
    status,
    job_id: job.id,
    exit_status: result.status,
    timed_out: timedOut,
    stderr: excerpt(stderr)
  }));
  process.exit(result.status || 1);
}

console.log(JSON.stringify({
  status,
  job_id: job.id,
  summary: summary.summary,
  next_run_at_ms: computeNextRunAtMs(job.schedule, finishedAtMs)
}));
