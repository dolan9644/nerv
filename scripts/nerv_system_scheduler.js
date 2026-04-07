#!/usr/bin/env node

import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const HOME = os.homedir();

export const NERV_ROOT = path.join(HOME, '.openclaw', 'nerv');
export const LAUNCH_AGENTS_DIR = path.join(HOME, 'Library', 'LaunchAgents');
export const RUNTIME_ROOT = path.join(NERV_ROOT, 'data', 'runtime');
export const RUNTIME_STATE_DIR = path.join(RUNTIME_ROOT, 'jobs');
export const RUNTIME_LOG_DIR = path.join(RUNTIME_ROOT, 'logs');
export const SCHEDULER_MANIFEST = path.join(RUNTIME_ROOT, 'system_scheduler.json');

function resolveSystemSchedulerMode() {
  const explicit = process.env.NERV_SYSTEM_SCHEDULER;
  if (explicit === 'launchd') return 'launchd';
  if (explicit === 'openclaw-cron') return 'openclaw-cron';
  return process.platform === 'darwin' ? 'launchd' : 'openclaw-cron';
}

function resolvePythonBin() {
  const explicit = process.env.NERV_PYTHON_BIN;
  if (explicit) return explicit;

  for (const candidate of ['python3.11', 'python3']) {
    const result = spawnSync('which', [candidate], { encoding: 'utf-8' });
    if (result.status === 0 && result.stdout.trim()) {
      return result.stdout.trim();
    }
  }

  return '/usr/bin/python3';
}

export const SYSTEM_SCHEDULER_MODE = resolveSystemSchedulerMode();
export const PYTHON_BIN = resolvePythonBin();
export const NODE_BIN = process.execPath;

const RAW_INFRA_JOBS = [
  {
    id: 'nerv-adam-notifier',
    name: 'Adam 审批通知',
    timeout_seconds: 120,
    schedule: { kind: 'interval_minutes', minutes: 10 },
    command: [PYTHON_BIN, path.join(NERV_ROOT, 'scripts', 'adam_notifier.py'), 'scan']
  },
  {
    id: 'nerv-spear-sync',
    name: 'Spear 状态对齐',
    timeout_seconds: 120,
    schedule: { kind: 'interval_minutes', minutes: 5 },
    command: [NODE_BIN, path.join(NERV_ROOT, 'scripts', 'spear_sync.js')]
  },
  {
    id: 'nerv-security-probe',
    name: 'SEELE 安全巡检',
    timeout_seconds: 120,
    schedule: { kind: 'interval_minutes', minutes: 30 },
    command: [
      NODE_BIN,
      path.join(NERV_ROOT, 'scripts', 'security_probe.js'),
      '--window',
      '30',
      '--alert-dir',
      path.join(NERV_ROOT, 'data', 'sandbox_io')
    ]
  },
  {
    id: 'nerv-memory-purify',
    name: 'REI 记忆提纯',
    timeout_seconds: 600,
    schedule: { kind: 'daily', hour: 3, minute: 0 },
    command: [
      NODE_BIN,
      path.join(NERV_ROOT, 'scripts', 'memory_purify.js'),
      '--batch-size',
      '100'
    ]
  },
  {
    id: 'nerv-session-recorder',
    name: 'Session 日志录入',
    timeout_seconds: 120,
    schedule: { kind: 'interval_minutes', minutes: 1 },
    command: [PYTHON_BIN, path.join(NERV_ROOT, 'scripts', 'session_recorder.py')]
  }
];

export const NERV_INFRA_JOB_IDS = RAW_INFRA_JOBS.map((job) => job.id);

export function shouldUseSystemScheduler() {
  return SYSTEM_SCHEDULER_MODE === 'launchd';
}

export function getInfraStateFile(jobId) {
  return path.join(RUNTIME_STATE_DIR, `${jobId}.json`);
}

export function getInfraStdoutLogFile(jobId) {
  return path.join(RUNTIME_LOG_DIR, `${jobId}.log`);
}

export function getInfraStderrLogFile(jobId) {
  return path.join(RUNTIME_LOG_DIR, `${jobId}.err.log`);
}

export function getLaunchdLabel(jobId) {
  return `com.nerv.${jobId.replace(/^nerv-/, '')}`;
}

export function getLaunchdPlistPath(jobId) {
  return path.join(LAUNCH_AGENTS_DIR, `${getLaunchdLabel(jobId)}.plist`);
}

export function getInfraJobs() {
  return RAW_INFRA_JOBS.map((job) => ({
    ...job,
    cwd: NERV_ROOT,
    launchd_label: getLaunchdLabel(job.id),
    launchd_plist_path: getLaunchdPlistPath(job.id),
    state_file: getInfraStateFile(job.id),
    stdout_log_path: getInfraStdoutLogFile(job.id),
    stderr_log_path: getInfraStderrLogFile(job.id)
  }));
}

export function getInfraJob(jobId) {
  return getInfraJobs().find((job) => job.id === jobId) || null;
}

export function toLaunchdStartCalendarInterval(schedule) {
  if (schedule.kind === 'interval_minutes') {
    const items = [];
    for (let minute = 0; minute < 60; minute += schedule.minutes) {
      items.push({ Minute: minute });
    }
    return items;
  }

  if (schedule.kind === 'daily') {
    return {
      Hour: schedule.hour,
      Minute: schedule.minute
    };
  }

  throw new Error(`Unsupported schedule kind: ${schedule.kind}`);
}

export function computeNextRunAtMs(schedule, nowMs = Date.now()) {
  if (schedule.kind === 'interval_minutes') {
    const next = new Date(nowMs + 1000);
    next.setSeconds(0, 0);
    if (next.getTime() <= nowMs) {
      next.setMinutes(next.getMinutes() + 1);
    }
    while (next.getMinutes() % schedule.minutes !== 0) {
      next.setMinutes(next.getMinutes() + 1);
    }
    return next.getTime();
  }

  if (schedule.kind === 'daily') {
    const next = new Date(nowMs);
    next.setSeconds(0, 0);
    next.setHours(schedule.hour, schedule.minute, 0, 0);
    if (next.getTime() <= nowMs) {
      next.setDate(next.getDate() + 1);
    }
    return next.getTime();
  }

  throw new Error(`Unsupported schedule kind: ${schedule.kind}`);
}
