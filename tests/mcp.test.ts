import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { get } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { createHttpApp } from '../src/http.js';
import { Memecub } from '../src/memecub.js';
import { IMAGE_ORIGINS, RESOURCE_URI } from '../src/meme.js';
import { fixtureMeme, fixtureResponse } from './fixtures.js';

test('official SDK initializes HTTP, discovers exactly two tools, reads UI, searches and displays', async () => {
  let upstreamCalls = 0;
  const html = await readFile('dist/ui/meme.html', 'utf8');
  const app = createHttpApp({ html, memecub: new Memecub(async () => { upstreamCalls++; return fixtureResponse(); }) });
  const http = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => http.once('listening', resolve));
  const addr = http.address() as { port: number };
  const base = `http://127.0.0.1:${addr.port}`;
  const client = new Client({ name: 'elias-meme-test', version: '1' }, { capabilities: { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: [RESOURCE_MIME_TYPE] } } } });
  try {
    assert.equal((await fetch(`${base}/healthz`)).status, 200);
    await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));
    assert.equal(client.getServerVersion()?.name, 'elias-meme');
    const tools = (await client.listTools()).tools;
    assert.deepEqual(tools.map(t => t.name).sort(), ['search_memes', 'show_meme']);
    for (const tool of tools) { assert.equal(tool.annotations?.readOnlyHint, true); assert.equal(tool.annotations?.destructiveHint, false); }
    const show = tools.find(t => t.name === 'show_meme')!;
    assert.equal((show._meta?.ui as { resourceUri: string }).resourceUri, RESOURCE_URI);
    const resources = (await client.listResources()).resources;
    assert.equal(resources.length, 1);
    assert.equal(resources[0].uri, RESOURCE_URI);
    const resource = (await client.readResource({ uri: RESOURCE_URI })).contents[0];
    assert.equal(resource.mimeType, RESOURCE_MIME_TYPE);
    assert.ok('text' in resource);
    assert.equal(resource.text, html);
    const ui = resource._meta?.ui as { csp: { resourceDomains: string[]; connectDomains: string[] } };
    assert.deepEqual(ui.csp.resourceDomains, IMAGE_ORIGINS);
    assert.deepEqual(ui.csp.connectDomains, []);
    assert.equal(html.includes('/* APP_SCRIPT */'), false);
    const search = await client.callTool({ name: 'search_memes', arguments: { query: '开心' } });
    assert.equal(search.isError, undefined);
    const result = await client.callTool({ name: 'show_meme', arguments: { id: fixtureMeme.id } });
    assert.deepEqual((result.structuredContent as Record<string, unknown>)?.meme, fixtureMeme);
    assert.equal(upstreamCalls, 1, 'show_meme must not spend another search');
    const invalid = await client.callTool({ name: 'show_meme', arguments: { id: 'unknown' } });
    assert.equal(invalid.isError, true);
    const blank = await client.callTool({ name: 'search_memes', arguments: { query: ' ' } });
    assert.equal(blank.isError, true);
    assert.equal((await fetch(`${base}/mcp`, { headers: { Origin: 'https://evil.test' } })).status, 403);
    const invalidHostStatus = await new Promise<number | undefined>((resolve, reject) => {
      get(`${base}/mcp`, { headers: { Host: 'evil.test' } }, response => { response.resume(); resolve(response.statusCode); }).on('error', reject);
    });
    assert.equal(invalidHostStatus, 403);
    for (const method of ['GET', 'DELETE']) assert.equal((await fetch(`${base}/mcp`, { method })).status, 405);
    const preflight = await fetch(`${base}/mcp`, { method: 'OPTIONS', headers: { Origin: 'https://chatgpt.com' } });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), 'https://chatgpt.com');
    assert.equal((await fetch(`${base}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' })).status, 400);
    assert.equal((await fetch(`${base}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: 'x'.repeat(40_000) }) })).status, 413);
  } finally {
    await client.close();
    await new Promise<void>((resolve, reject) => http.close(error => error ? reject(error) : resolve()));
  }
});
