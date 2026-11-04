import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertPublicPagesAssets } from '../../scripts/audit-client-bundle';
import { describe, expect, it } from 'vitest';
import { parseWorkerAppUrl } from '../../apps/pages/app-url';

describe('public Pages entry', () => {
  it('can build an unconfigured local preview without a launch link', () => {
    expect(parseWorkerAppUrl(undefined)).toBeUndefined();
    expect(parseWorkerAppUrl('  ')).toBeUndefined();
  });

  it('links to the configured HTTPS app', () => {
    expect(parseWorkerAppUrl('https://ael.example.com')).toBe('https://ael.example.com/');
  });

  it.each([
    'http://ael.example.com', 'javascript:alert(1)', '//ael.example.com',
    'https://user:password@ael.example.com', 'https://ael.example.com?token=example',
    'https://ael.example.com#fragment',
  ])('rejects unsafe or session-bearing URLs', (value) => {
    expect(() => parseWorkerAppUrl(value)).toThrow();
  });
  it('rejects copied source files, even if the answer-key scanner does not parse them', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'ael-public-'));
    try {
      await mkdir(join(directory, 'assets'));
      await writeFile(join(directory, 'index.html'), '<title>AEL</title>');
      await writeFile(join(directory, 'assets', 'index-0000.js'), 'console.log("AEL")');
      await expect(assertPublicPagesAssets(directory)).resolves.toBeUndefined();
      await writeFile(join(directory, 'assets', 'raw-questions.pdf'), 'fixture');
      await expect(assertPublicPagesAssets(directory)).rejects.toThrow(/raw sources/);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
