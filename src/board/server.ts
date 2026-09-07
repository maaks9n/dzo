/**
 * board/server.ts — loopback HTTP + SSE + one HTML page.
 * Four POST verbs: pause, resume, close, update rule. No route buys.
 */

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Engine } from '../snipe.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML = readFileSync(join(__dirname, 'index.html'), 'utf8');

export interface BoardOptions {
  host: string;
  port: number;
}

export async function startBoard(engine: Engine, opts: BoardOptions): Promise<void> {
  const clients = new Set<any>();

  const server = createServer((req, res) => {
    const url = req.url || '/';
    if (req.method === 'GET' && (url === '/' || url === '/index.html')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(HTML);
      return;
    }
    if (req.method === 'GET' && url === '/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', async () => {
        try {
          const payload = body ? JSON.parse(body) : {};
          if (url === '/api/engine/pause') { engine.pause(); ok(res); return; }
          if (url === '/api/engine/resume') { engine.resume(); ok(res); return; }
          if (url === '/api/positions/close') { await engine.closePosition(payload.token, payload.pct); ok(res); return; }
          if (url === '/api/rules/update') { engine.updateRule(payload.key, payload.value); ok(res); return; }
          res.writeHead(404); res.end();
        } catch (e) {
          res.writeHead(500); res.end((e as Error).message);
        }
      });
      return;
    }
    res.writeHead(404); res.end();
  });

  function send(evt: string, data: unknown) {
    const line = `event: ${evt}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const cl of clients) cl.write(line);
  }
  engine.on('launch', (p: unknown) => send('launch', p));
  engine.on('fire', (p: unknown) => send('fire', p));
  engine.on('miss', (p: unknown) => send('miss', p));
  engine.on('exit', (p: unknown) => send('exit', p));
  engine.on('pass', (p: unknown) => send('pass', p));
  setInterval(() => send('pulse', { state: engine.state(), t: Date.now() }), 10_000).unref?.();

  await new Promise<void>((r) => server.listen(opts.port, opts.host, r));
}

function ok(res: any) { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":true}'); }
