import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const destination = resolve(process.argv[2] || resolve(root, 'tools/offline/AEL_OFFLINE.html'));
const { outputFiles } = await build({
  entryPoints: [resolve(root, 'tools/offline/adapter.ts')],
  write: false, bundle: true, format: 'iife', target: ['es2020'], platform: 'browser',
});
const css = await readFile(resolve(root, 'apps/miniapp/styles.css'), 'utf8');
const begin = '/* BEGIN AEL LEARNING UI — shared with the offline file. */';
const end = '/* END AEL LEARNING UI */';
const start = css.indexOf(begin);
const finish = css.indexOf(end);
if (start < 0 || finish <= start) throw new Error('Shared learning CSS markers not found.');
const style = css.slice(start + begin.length, finish);
const js = outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; base-uri 'none'; form-action 'none'">
<title>AEL | آزمون آفلاین مدیریت مالی</title>
<style>
*{box-sizing:border-box}
body{margin:0;font-family:Tahoma,system-ui,sans-serif;background:#eef5f3;color:#172b3b}
main{max-width:760px;margin:auto;padding:18px clamp(12px,4vw,30px) 40px}
${style}
</style>
</head>
<body>
<main id="offline-root" aria-label="نسخهٔ آزمون آفلاین"></main>
<script>${js}</script>
</body>
</html>
`;
await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, html, 'utf8');
console.log(destination);
