import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createHttpApp } from '../src/http.js';
import { memeSchema, RESOURCE_URI } from '../src/meme.js';

// Explicit opt-in: this script consumes ONE real anonymous memecub search.
if (process.env.LIVE_MEMECUB !== '1') throw new Error('Set LIVE_MEMECUB=1 to spend one public API search.');
const app = createHttpApp({ html: await readFile('dist/ui/meme.html', 'utf8') });
const http = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => http.once('listening', resolve));
const base = `http://127.0.0.1:${(http.address() as { port: number }).port}`;
const client = new Client({ name: 'elias-live-verifier', version: '1' });
try {
  assert.equal((await fetch(`${base}/healthz`)).status, 200);
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));
  assert.equal(client.getServerVersion()?.name, 'elias-meme');
  console.log('PASS healthz and MCP initialize');
  const tools = (await client.listTools()).tools;
  assert.deepEqual(tools.map(t => t.name).sort(), ['search_memes', 'show_meme']);
  console.log('PASS tools/list:', tools.map(t => t.name).join(', '));
  const resources = (await client.listResources()).resources;
  assert.equal(resources[0].uri, RESOURCE_URI);
  const resource = (await client.readResource({ uri: RESOURCE_URI })).contents[0];
  assert.equal(resource.mimeType, 'text/html;profile=mcp-app');
  assert.equal((tools.find(t => t.name === 'show_meme')?._meta?.ui as { resourceUri: string }).resourceUri, RESOURCE_URI);
  console.log('PASS resources/list, resources/read, MIME and tool resourceUri');
  const result = await client.callTool({ name: 'search_memes', arguments: { query: '开心', limit: 5 } });
  assert.notEqual(result.isError, true, JSON.stringify(result));
  const memes = ((result.structuredContent as Record<string, unknown>)?.memes as unknown[]).map(meme => memeSchema.parse(meme));
  assert.ok(memes.length > 0);
  console.log('PASS live public API search: 开心;', memes.length, 'supported results');
  for (const meme of memes.slice(0, 3)) {
    const image = await fetch(meme.url, { redirect: 'error', signal: AbortSignal.timeout(15_000) });
    assert.equal(image.status, 200);
    const mime = image.headers.get('content-type')?.split(';')[0];
    assert.ok(['image/jpeg', 'image/png', 'image/gif'].includes(mime ?? ''));
    const bytes = new Uint8Array(await image.arrayBuffer());
    assert.ok(bytes.length > 0);
    const magic = mime === 'image/gif' ? Buffer.from(bytes.slice(0, 6)).toString().startsWith('GIF8') : mime === 'image/png' ? Buffer.from(bytes.slice(0, 8)).toString('hex') === '89504e470d0a1a0a' : bytes[0] === 0xff && bytes[1] === 0xd8;
    assert.ok(magic, 'Image magic bytes must agree with Content-Type');
    console.log('PASS image GET:', meme.url, mime, bytes.length, 'bytes');
  }
  const show = await client.callTool({ name: 'show_meme', arguments: { id: memes[0].id } });
  assert.notEqual(show.isError, true);
  assert.equal(memeSchema.parse((show.structuredContent as Record<string, unknown>)?.meme).url, memes[0].url);
  console.log('PASS show_meme returns real selected image and original metadata');
  console.log('NOT TESTED: actual ChatGPT web/iOS/Android rendering and production deployment.');
} finally {
  await client.close();
  await new Promise<void>((resolve, reject) => http.close(error => error ? reject(error) : resolve()));
}
