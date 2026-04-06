#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import { spawnSync } from 'child_process';
import {
  computeNextRunAtMs,
  getInfraJobs,
  LAUNCH_AGENTS_DIR,
  RUNTIME_LOG_DIR,
  RUNTIME_STATE_DIR,
  SCHEDULER_MANIFEST,
  shouldUseSystemScheduler,
  toLaunchdStartCalendarInterval
} from './nerv_system_scheduler.js';

const REMOVE = process.argv.includes('--remove');
const WRITE_ONLY = process.argv.includes('--write-only');

function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function plistValue(value) {
  if (Array.isArray(value)) {
    return `<array>\n${value.map((item) => plistValue(item)).join('\n')}\n</array>`;
  }
  if (typeof value === 'object' && value !== null) {
    const items = Object.entries(value).map(([key, entry]) => (
      `<key>${xmlEscape(key)}</key>\n${plistValue(entry)}`
    ));
    return `<dict>\n${items.join('\n')}\n</dict>`;
  }
  if (typeof value === 'boolean') {
    return value ? '<true/>' : '<false/>';
  }
  if (typeof value === 'number') {
    return `<integer>${value}</integer>`;
  }
  return `<string>${xmlEscape(value)}</string>`;
}

function buildPlist(job) {
  const calendarInterval = toLaunchdStartCalendarInterval(job.schedule);
  const dict = {
    Label: job.launchd_label,
    ProgramArguments: [process.execPath, `${job.cwd}/scripts/run_infra_job.js`, job.id],
    WorkingDirectory: job.cwd,
    RunAtLoad: true,
    ProcessType: 'Background',
    StandardOutPath: job.stdout_log_path,
    StandardErrorPath: job.stderr_log_path,
    EnvironmentVariables: {
      HOME: os.homedir(),
      PATH: process.env.PATH || '/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin'
    },
    StartCalendarInterval: calendarInterval
  };

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
${plistValue(dict)}
</plist>
`;
}

function writeManifest(jobs) {
  fs.mkdirSync(RUNTIME_STATE_DIR, { recursive: true });
  fs.mkdirSync(RUNTIME_LOG_DIR, { recursive: true });
  const payload = {
    installed_at: new Date().toISOString(),
    mode: 'launchd',
    jobs: jobs.map((job) => ({
      id: job.id,
      label: job.launchd_label,
      plist_path: job.launchd_plist_path,
      state_file: job.state_file,
      stdout_log_path: job.stdout_log_path,
      stderr_log_path: job.stderr_log_path,
      schedule: job.schedule,
      next_run_at_ms: computeNextRunAtMs(job.schedule)
    }))
  };
  fs.writeFileSync(SCHEDULER_MANIFEST, JSON.stringify(payload, null, 2));
}

function applyLaunchd(job) {
  const unload = spawnSync('launchctl', ['unload', job.launchd_plist_path], { encoding: 'utf-8' });
  if (unload.status !== 0 && unload.stderr && !unload.stderr.includes('No such process')) {
    // ignore stale unload failures
  }
  const load = spawnSync('launchctl', ['load', '-w', job.launchd_plist_path], { encoding: 'utf-8' });
  if (load.status !== 0) {
    throw new Error(load.stderr?.trim() || `launchctl load failed for ${job.id}`);
  }
}

function removeLaunchd(job) {
  if (fs.existsSync(job.launchd_plist_path)) {
    spawnSync('launchctl', ['unload', job.launchd_plist_path], { encoding: 'utf-8' });
    fs.rmSync(job.launchd_plist_path, { force: true });
  }
}

function main() {
  const jobs = getInfraJobs();

  if (!shouldUseSystemScheduler()) {
    console.log(JSON.stringify({
      status: 'skipped',
      mode: 'openclaw-cron',
      reason: `system scheduler disabled on platform ${process.platform}`
    }, null, 2));
    return;
  }

  fs.mkdirSync(LAUNCH_AGENTS_DIR, { recursive: true });
  fs.mkdirSync(RUNTIME_STATE_DIR, { recursive: true });
  fs.mkdirSync(RUNTIME_LOG_DIR, { recursive: true });

  if (REMOVE) {
    for (const job of jobs) {
      removeLaunchd(job);
    }
    fs.rmSync(SCHEDULER_MANIFEST, { force: true });
    console.log(JSON.stringify({
      status: 'ok',
      mode: 'launchd',
      action: 'remove',
      jobs_removed: jobs.map((job) => job.id)
    }, null, 2));
    return;
  }

  for (const job of jobs) {
    fs.writeFileSync(job.launchd_plist_path, buildPlist(job));
    if (!fs.existsSync(job.state_file)) {
      fs.writeFileSync(job.state_file, JSON.stringify({
        job_id: job.id,
        name: job.name,
        scheduler_mode: 'launchd',
        launchd_label: job.launchd_label,
        schedule: job.schedule,
        status: 'idle',
        last_status: null,
        next_run_at_ms: computeNextRunAtMs(job.schedule),
        installed_at: new Date().toISOString()
      }, null, 2));
    }
    if (!WRITE_ONLY) {
      applyLaunchd(job);
    }
  }

  writeManifest(jobs);

  console.log(JSON.stringify({
    status: 'ok',
    mode: 'launchd',
    action: WRITE_ONLY ? 'write-only' : 'apply',
    jobs_installed: jobs.map((job) => job.id)
  }, null, 2));
}

main();
