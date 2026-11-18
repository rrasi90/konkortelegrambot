#!/usr/bin/env node
/**
 * Refuse a production deploy when the Worker would run without durable data,
 * with development guards, or with a broken mini-app asset set.
 *
 * Secret values are never read. Only names and local configuration are checked.
 */
import { access, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const workerName = 'adaptive-exam-worker';
const requiredSecrets = ['SESSION_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'TELEGRAM_BOT_TOKEN'];
const errors = [];
const warnings = [];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const configPath = join(root, 'apps', 'worker', 'wrangler.jsonc');
const config = await readFile(configPath, 'utf8');
if (!/"ENVIRONMENT"\s*:\s*"production"/.test(config)) {
  errors.push('apps/worker/wrangler.jsonc must set ENVIRONMENT to production.');
}

if (!(await exists(join(root, 'supabase', 'migrations', '0029_reminder_preferences.sql')))) {
  errors.push('Migration 0029_reminder_preferences.sql is missing.');
} else {
  warnings.push('Apply migration 0029 to the real Supabase database before deploying.');
}

const miniAppIndexPath = join(root, 'apps', 'miniapp', 'index.html');
if (!(await exists(miniAppIndexPath))) {
  errors.push('apps/miniapp/index.html is missing. Run "npm run build:miniapp" and "npm run sync:miniapp".');
} else {
  const html = await readFile(miniAppIndexPath, 'utf8');
  const assets = [...html.matchAll(/assets\/[A-Za-z0-9._-]+/g)].map((match) => match[0]);
  if (assets.length === 0) errors.push('apps/miniapp/index.html does not reference a built asset.');
  for (const asset of assets) {
    if (!(await exists(join(root, 'apps', 'miniapp', asset)))) {
      errors.push(`Missing built asset: apps/miniapp/${asset}`);
    }
  }
}

const secretList = spawnSync(
  'npx',
  ['--yes', 'wrangler', 'secret', 'list', '--name', workerName],
  { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' },
);
const secretOutput = secretList.stdout ?? '';
const jsonStart = secretOutput.indexOf('[');
let secretNames = [];
if (secretList.status !== 0 || jsonStart < 0) {
  errors.push('Could not read Worker secrets. Run "npx wrangler login" and try again.');
} else {
  try {
    const parsed = JSON.parse(secretOutput.slice(jsonStart));
    secretNames = Array.isArray(parsed) ? parsed.map((entry) => entry.name) : [];
  } catch {
    errors.push('Worker secret list was not valid JSON.');
  }
}
for (const name of requiredSecrets) {
  if (!secretNames.includes(name)) errors.push(`Missing Worker secret: ${name}`);
}
if (!secretNames.includes('APP_URL')) {
  warnings.push('APP_URL is not set; reminder links fall back to the request origin.');
}
if (secretNames.includes('ALLOW_DEMO_AUTH')) {
  warnings.push('ALLOW_DEMO_AUTH exists on the Worker; its value must be "false" in production.');
}

console.log(`Production preflight for ${workerName}`);
console.log(`Secrets found: ${secretNames.length ? secretNames.join(', ') : 'none'}`);
for (const warning of warnings) console.log(`WARN: ${warning}`);
for (const error of errors) console.log(`ERROR: ${error}`);

if (errors.length > 0) {
  console.log(`\nDeploy blocked by ${errors.length} error(s).`);
  process.exit(1);
}

console.log('\nPreflight passed. Production deploy may proceed.');
