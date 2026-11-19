import { readFile } from 'node:fs/promises';
import { createHttpApp } from './http.js';

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
const host = process.env.HOST ?? '127.0.0.1';
const publicOrigin = process.env.PUBLIC_ORIGIN ?? process.env.RENDER_EXTERNAL_URL;
if (host !== '127.0.0.1' && host !== 'localhost' && !publicOrigin) throw new Error('PUBLIC_ORIGIN is required when binding publicly');
const html = await readFile(new URL('../ui/meme.html', import.meta.url), 'utf8');
const app = createHttpApp({ html, publicOrigin });
const server = app.listen(port, host, () => console.log(`Elias Meme listening on ${host}:${port}`));
server.requestTimeout = 30_000;
server.headersTimeout = 15_000;
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
});
