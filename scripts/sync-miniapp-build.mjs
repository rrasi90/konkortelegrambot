#!/usr/bin/env node
/**
 * Copy the Vite mini-app build into the directory served by the Worker.
 *
 * The only generated files are `index.html` and hashed files under `assets/`.
 * Files that are not part of that generated set are left untouched, so local
 * content or tooling placed in `apps/miniapp` is never deleted by a sync.
 */
import { mkdir, readdir, rm, copyFile, stat } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'dist-miniapp');
const target = join(root, 'apps', 'miniapp');
// هر فایل JS/CSS خروجی Vite، از جمله چانک‌های پویا، بخشی از بیلد است.
const generatedAsset = /\.(?:js|css)$/;

async function assertDirectory(path) {
  try {
    const info = await stat(path);
    if (!info.isDirectory()) throw new Error(`${path} is not a directory`);
  } catch {
    throw new Error(`Missing build directory: ${path}. Run "npm run build:miniapp" first.`);
  }
}

async function generatedAssets(directory) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile() && generatedAsset.test(entry.name)).map((entry) => entry.name);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

await assertDirectory(source);
await mkdir(join(target, 'assets'), { recursive: true });

await copyFile(join(source, 'index.html'), join(target, 'index.html'));

const nextAssets = await generatedAssets(join(source, 'assets'));
for (const name of nextAssets) {
  await copyFile(join(source, 'assets', name), join(target, 'assets', name));
}

const previousAssets = await generatedAssets(join(target, 'assets'));
const stale = previousAssets.filter((name) => !nextAssets.includes(name));
for (const name of stale) {
  await rm(join(target, 'assets', name), { force: true });
}

console.log(
  `Synced ${relative(root, source)} -> ${relative(root, target)}: ` +
    `${nextAssets.length} generated assets, ${stale.length} stale removed.`,
);
