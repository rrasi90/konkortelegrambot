#!/usr/bin/env node
/**
 * سرور توسعهٔ محلی — برای آزمون دستی مینی‌اپ و رابط کاربری مدرن.
 * اجرا: npx tsx scripts/dev-server.mjs
 * - فایل‌های ایستا: اولویت با بیلد مدرن React (dist) در صورت وجود، در غیر این صورت apps/miniapp
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

const app = createApp({ SESSION_SECRET: 'dev-secret', ALLOW_DEMO_AUTH: 'true' }, { store });

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

    // فایل‌های ایستا: اولویت با بیلد مدرن React (dist)
    const staticBase = existsSync(join(root, 'dist', 'index.html'))
      ? join(root, 'dist')
      : join(root, 'apps/miniapp');
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

server.listen(port, () => {
  console.log(`سرور توسعه: http://localhost:${port}`);
});
