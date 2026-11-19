import express from 'express';
import { createReadStream, existsSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { hostHeaderValidation } from '@modelcontextprotocol/sdk/server/middleware/hostHeaderValidation.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from './server.js';
import { Memecub } from './memecub.js';

const MEMES_DIR = resolve(process.cwd(), 'public', 'memes');
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif']);

export function createHttpApp(options: { html: string; memecub?: Memecub; publicOrigin?: string }) {
  const app = express();
  const memecub = options.memecub ?? new Memecub();
  const origin = options.publicOrigin ? new URL(options.publicOrigin) : undefined;
  if (origin && (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash)) {
    throw new Error('PUBLIC_ORIGIN must be an HTTPS origin without a path or credentials');
  }
  const allowedHosts = ['localhost', '127.0.0.1', '[::1]', ...(origin ? [origin.hostname] : [])];
  app.disable('x-powered-by');
  app.use(hostHeaderValidation(allowedHosts));
  app.use((_req, res, next) => { res.set('X-Content-Type-Options', 'nosniff'); next(); });
  app.get('/healthz', (_req, res) => res.json({ status: 'ok', service: 'elias-meme', version: '0.1.0' }));

  // 自定义表情包静态图片：只出图片后缀，反目录穿越，限制在 MEMES_DIR 内。
  app.get('/memes/:file', (req, res) => {
    const file = req.params.file;
    if (!file || !/^[A-Za-z0-9._-]+$/i.test(file)) { res.status(400).end(); return; }
    const ext = extname(file).toLowerCase();
    if (!IMAGE_EXT.has(ext)) { res.status(400).end(); return; }
    const full = normalize(join(MEMES_DIR, file));
    if (!full.startsWith(MEMES_DIR + '/') && full !== MEMES_DIR) { res.status(400).end(); return; }
    if (!existsSync(full)) { res.status(404).end(); return; }
    const type = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.gif' ? 'image/gif' : 'image/png';
    res.set('Content-Type', type);
    res.set('Cache-Control', 'public, max-age=86400');
    createReadStream(full).on('error', () => { if (!res.headersSent) res.status(500).end(); }).pipe(res);
  });

  app.use('/mcp', (req, res, next) => {
    const requestOrigin = req.get('origin');
    const allowedOrigins = ['https://chatgpt.com', 'https://chat.openai.com', ...(origin ? [origin.origin] : [])];
    if (requestOrigin && !allowedOrigins.includes(requestOrigin)) { res.status(403).json({ error: 'Origin not allowed' }); return; }
    if (requestOrigin) {
      res.set('Access-Control-Allow-Origin', requestOrigin);
      res.vary('Origin');
      res.set('Access-Control-Expose-Headers', 'Mcp-Session-Id, MCP-Protocol-Version');
    }
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.options('/mcp', (_req, res) => {
    res.set('Access-Control-Allow-Methods', 'POST, GET, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id');
    res.status(204).end();
  });
  app.post('/mcp', express.json({ limit: '32kb' }), async (req, res) => {
    const server = createServer(memecub, options.html, options.publicOrigin);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { void server.close().catch(() => {}); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch {
      if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', id: null, error: { code: -32603, message: 'Internal server error' } });
    }
  });
  app.all('/mcp', (_req, res) => res.set('Allow', 'POST, OPTIONS').status(405).json({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Stateless endpoint: use POST.' } }));
  app.use((error: { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error.status === 413 ? 413 : 400).json({ error: error.status === 413 ? 'Request too large' : 'Invalid request' });
  });
  return app;
}
