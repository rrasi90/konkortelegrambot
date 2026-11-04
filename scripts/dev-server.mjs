#!/usr/bin/env node
/**
 * سرور توسعهٔ محلی — برای آزمون دستی مینی‌اپ و رابط کاربری مدرن.
 * اجرا: npx tsx scripts/dev-server.mjs
 * - فایل‌های ایستا: apps/miniapp، یا dist-legacy با انتخاب صریح DEV_SURFACE=react
 * - مسیرهای /api/* به اپ Hono (با MemoryStore و بستهٔ دمو) وصل می‌شوند
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../apps/worker/src/index.ts';
import { MemoryStore } from '../apps/worker/src/memory-store.ts';
import pack from '../content/examples/demo-pack.json' with { type: 'json' };

const root = fileURLToPath(new URL('..', import.meta.url));
const port = Number(process.env.PORT ?? 8787);

const store = new MemoryStore();
store.nodes = pack.nodes.map((n) => ({ ...n }));
store.dependencies = pack.dependencies.map((d) => ({ ...d }));
store.questions = pack.questions.map((q) => ({ ...q }));

// SEC-02: محیط توسعه باید صریحاً اعلان شود؛ محیط نامشخص سخت‌گیرانه (fail-closed) است.
const app = createApp({ ENVIRONMENT: 'development', SESSION_SECRET: 'dev-secret', ALLOW_DEMO_AUTH: 'true' }, { store });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`);

    if (url.pathname.startsWith('/api/')) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      const request = new Request(`http://localhost:${port}${req.url}`, {
        method: req.method,
        headers: Object.fromEntries(
          Object.entries(req.headers).filter(([, v]) => typeof v === 'string'),
        ),
        body: ['GET', 'HEAD'].includes(req.method ?? 'GET') ? undefined : body,
      });
      const response = await app.fetch(request);
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      const buf = Buffer.from(await response.arrayBuffer());
      res.end(buf);
      return;
    }

    // فایل‌های ایستا: مینی‌اپ سطح فعال محصول است (ARC-01)؛ بیلد قدیمی React
    // فقط با DEV_SURFACE=react سرو می‌شود. پیش‌تر «وجود dist» بی‌صدا اولویت
    // داشت و باعث شد تست‌ها/توسعه‌دهنده بدون اطلاع از سطح دیگری استفاده کنند.
    const surface = process.env.DEV_SURFACE ?? 'miniapp';
    const reactBase = join(root, 'dist-legacy');
    const miniappBase = join(root, 'apps/miniapp');
    const useReact = surface === 'react' && existsSync(join(reactBase, 'index.html'));
    const staticBase = useReact ? reactBase : miniappBase;
    let relPath = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\//, '');
    let filePath = join(staticBase, relPath);
    if (!existsSync(filePath) || !extname(filePath)) {
      filePath = join(staticBase, 'index.html');
    }
    const ext = extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' });
    res.end(readFileSync(filePath));
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal error');
  }
});

server.listen(port, '127.0.0.1', () => {
  const surface = process.env.DEV_SURFACE ?? 'miniapp';
  const reactBuilt = existsSync(join(root, 'dist-legacy', 'index.html'));
  const serving = surface === 'react' && reactBuilt ? 'React (dist-legacy)' : 'Mini App (apps/miniapp)';
  console.log(`سرور توسعه: http://localhost:${port} — سطح سرو‌شده: ${serving}`);
  if (surface !== 'react' && reactBuilt) {
    console.log('نکته: بیلد React در dist-legacy موجود است ولی سرو نمی‌شود؛ برای آن DEV_SURFACE=react را تنظیم کنید.');
  }
  if (surface === 'react' && !reactBuilt) {
    console.warn('هشدار: DEV_SURFACE=react تنظیم شده ولی dist-legacy/index.html نیست؛ مینی‌اپ سرو می‌شود.');
  }
});
