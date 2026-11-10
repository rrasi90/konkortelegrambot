/**
 * R-036 / مأموریت v4 §3.5 — ساخت نسخهٔ Offline (فقط مطالعه، بدون کلید).
 *
 *  ۱. دادهٔ خام content/learning-courses/*.json را می‌خواند و «Projection عمومی»
 *     می‌سازد (حذف کلید-محورها)؛ ماژول مجازی 'ael-offline-source' تزریق می‌شود.
 *  ۲. Bundle استقلال HTML مستقل با CSP بسته تولید می‌کند.
 *  ۳. پس از نوشتن، اسکن کلید روی خروجی اجرا می‌شود؛ هر نشتی = شکست Build.
 */
import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const destination = resolve(process.argv[2] || resolve(root, 'tools/offline/AEL_OFFLINE.html'));

// ── Projection عمومی: فیلدهای مجاز — هیچ کلیدی عبور نمی‌کند ──
const ALLOWED_QUESTION_FIELDS = [
  'id', 'topicId', 'difficulty', 'prompt', 'choices', 'sourceIds',
  'origin', 'review', 'kind', 'questionFormat',
];
const ALLOWED_TOPIC_FIELDS = ['id', 'title'];
const ALLOWED_COURSE_FIELDS = ['id', 'version', 'title', 'status', 'description', 'scopeNote', 'topics', 'questions'];

function pick(source, allowed) {
  const out = {};
  for (const field of allowed) {
    if (source[field] !== undefined) out[field] = source[field];
  }
  return out;
}

const rawCourseFiles = [
  'content/learning-courses/financial-management.json',
  'content/learning-courses/statistics-foundations.json',
  'content/learning-courses/phd-management-expansion.json',
];
const publicCourses = [];
for (const file of rawCourseFiles) {
  const course = JSON.parse(await readFile(resolve(root, file), 'utf8'));
  publicCourses.push({
    ...pick(course, ALLOWED_COURSE_FIELDS),
    topics: course.topics.map((topic) => pick(topic, ALLOWED_TOPIC_FIELDS)),
    questions: course.questions.map((question) => pick(question, ALLOWED_QUESTION_FIELDS)),
  });
}
// دفاع در عمق: هیچ رشتهٔ کلید-محور نباید در payload عمومی باشد.
const payloadText = JSON.stringify(publicCourses);
const forbidden = ['answerIndex', 'explanation', 'optionReasons', 'rubric'];
for (const name of forbidden) {
  if (payloadText.includes(`"${name}"`)) {
    throw new Error(`Offline projection rejected: sensitive field "${name}" survived the projection.`);
  }
}

const virtualSourcePlugin = {
  name: 'ael-offline-source',
  setup(buildApi) {
    buildApi.onResolve({ filter: /^ael-offline-source$/ }, () => ({ path: 'ael-offline-source', namespace: 'ael-offline' }));
    buildApi.onLoad({ filter: /.*/, namespace: 'ael-offline' }, () => ({
      contents: `export default ${payloadText};`,
      loader: 'js',
    }));
  },
};

const { outputFiles } = await build({
  entryPoints: [resolve(root, 'tools/offline/adapter.ts')],
  write: false, bundle: true, format: 'iife', target: ['es2020'], platform: 'browser',
  plugins: [virtualSourcePlugin],
  legalComments: 'none',
});
const js = outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

const css = `
*{box-sizing:border-box}
body{margin:0;font-family:Tahoma,system-ui,sans-serif;background:#eef5f3;color:#172b3b}
main{max-width:760px;margin:auto;padding:18px clamp(12px,4vw,30px) 40px}
.ael-off-header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}
.ael-off-header strong{font-size:16px}
.ael-off-back{border:0;background:#0b5f56;color:#fff;border-radius:8px;padding:6px 12px;font-family:inherit;cursor:pointer}
.ael-off-banner{background:#fff7e6;border:1px solid #e4c98a;border-radius:10px;padding:10px 12px;font-size:12.5px;line-height:1.9;margin-bottom:14px}
.ael-off-banner-warn{background:#fff0f0;border-color:#e2a1a1}
.ael-off-card{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;text-align:right;background:#fff;border:1px solid #d7e2df;border-radius:12px;padding:14px 16px;margin-bottom:10px;font-family:inherit;font-size:14px;cursor:pointer}
.ael-off-card:hover{border-color:#0b5f56}
.ael-off-title{font-weight:bold;margin-bottom:4px}
.ael-off-meta{color:#5d6f6b;font-size:12px}
.ael-off-chip{background:#e6f1ef;border-radius:999px;padding:3px 10px;font-size:11px;color:#0b5f56;white-space:nowrap}
.ael-off-essay{background:#efe6f7;color:#5b3d7a}
.ael-off-desc{background:#fff;border:1px dashed #cfd9d6;border-radius:10px;padding:10px 12px;font-size:12.5px;line-height:1.9}
.ael-off-q{background:#fff;border:1px solid #d7e2df;border-radius:12px;padding:14px 16px;margin-bottom:12px}
.ael-off-qhead{display:flex;gap:6px;margin-bottom:8px}
.ael-off-prompt{font-size:13.5px;line-height:2.1;margin:6px 0 10px}
.ael-off-note{font-size:12px;color:#5d6f6b;line-height:1.9}
.ael-off-options{display:grid;gap:8px}
.ael-off-option{display:flex;align-items:center;gap:10px;text-align:right;background:#f6faf9;border:1px solid #d7e2df;border-radius:10px;padding:9px 12px;font-family:inherit;font-size:13px;cursor:pointer}
.ael-off-option:hover{border-color:#0b5f56}
.ael-off-option.is-selected{background:#e6f1ef;border-color:#0b5f56;font-weight:bold}
.ael-off-idx{width:22px;height:22px;border-radius:6px;background:#0b5f56;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0}
.ael-off-saved{font-size:11.5px;color:#8a6d1d;margin-top:8px}
.ael-off-issue input{width:100%;border:1px solid #d7e2df;border-radius:8px;padding:7px 10px;font-family:inherit;font-size:12.5px;margin-top:8px}
.ael-off-backup{display:flex;gap:10px;margin-top:16px}
.ael-off-btn{display:inline-block;border:0;background:#0b5f56;color:#fff;border-radius:8px;padding:8px 14px;font-family:inherit;font-size:12.5px;cursor:pointer}
`;

const html = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; base-uri 'none'; form-action 'none'">
<title>AEL | مطالعه و مرور آفلاین</title>
<style>${css}</style>
</head>
<body>
<main id="offline-root" aria-label="مطالعهٔ آفلاین — بدون تصحیح"></main>
<script>${js}</script>
</body>
</html>
`;
await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, html, 'utf8');
console.log(destination);
