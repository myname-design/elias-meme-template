import { installCustomFixture } from './support/custom-fixture.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, readFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { CUSTOM_MEMES } from '../src/custom.js';
import { displayMemeSchema, IMAGE_ORIGINS, RESOURCE_URI } from '../src/meme.js';
import { fixtureMeme } from './fixtures.js';
import { startTestMcp, TEST_ORIGIN } from './support/mcp.js';

test('custom search -> show -> UI schema and resource CSP agree without upstream calls', async () => {
  const mcp = await startTestMcp({ origin: TEST_ORIGIN + '/' });
  try {
    const found = await mcp.call('search_memes', { query: '色块 示例', limit: 1, kind: 'meme' });
    assert.notEqual(found.isError, true);
    const memes = found.structuredContent!.memes as Record<string, unknown>[];
    assert.equal(memes.length, 1);
    assert.equal(memes[0].id, 'test-custom');
    const shown = await mcp.call('show_meme', { id: memes[0].id });
    const meme = displayMemeSchema(TEST_ORIGIN).parse(shown.structuredContent!.meme);
    assert.equal(meme.url, TEST_ORIGIN + CUSTOM_MEMES[0].url);
    assert.equal(meme.private, false);
    assert.equal(meme.page_url, null);
    assert.deepEqual(meme.license, CUSTOM_MEMES[0].license);
    assert.equal(meme.source, CUSTOM_MEMES[0].source);
    assert.equal(mcp.upstreamUrls.length, 0);
    const resources = await mcp.client.listResources();
    const content = (await mcp.client.readResource({ uri: RESOURCE_URI })).contents[0];
    assert.equal(resources.resources[0].uri, RESOURCE_URI);
    assert.equal(content.mimeType, 'text/html;profile=mcp-app');
    assert.ok('text' in content);
    assert.ok(content.text.includes(`name="elias-meme-origin" content="${TEST_ORIGIN}"`));
    const expected = [...IMAGE_ORIGINS, TEST_ORIGIN];
    const ui = content._meta!.ui as { csp: { resourceDomains: string[]; connectDomains: string[] } };
    assert.deepEqual(ui.csp.resourceDomains, expected);
    assert.deepEqual(ui.csp.connectDomains, []);
    assert.deepEqual((content._meta!['openai/widgetCSP'] as { resource_domains: string[] }).resource_domains, expected);
    assert.deepEqual(resources.resources[0]._meta, content._meta);
    const image = await fetch(mcp.base + CUSTOM_MEMES[0].url);
    assert.equal(image.status, 200);
    assert.equal(image.headers.get('content-type'), 'image/jpeg');
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), await readFile('public' + CUSTOM_MEMES[0].url));
  } finally { await mcp.close(); }
});

for (const args of [
  { query: '色块 示例', commercial_only: true },
  { query: '色块 示例', kind: 'gif' },
  { query: '色块 示例', commercial_only: true, kind: 'gif' },
  { query: '开心' },
]) test(`fallback preserves filters: ${JSON.stringify(args)}`, async () => {
  const mcp = await startTestMcp({ origin: TEST_ORIGIN });
  try {
    const result = await mcp.call('search_memes', { ...args, limit: 1 });
    assert.notEqual(result.isError, true);
    assert.equal(mcp.upstreamUrls.length, 1);
    const url = mcp.upstreamUrls[0];
    assert.equal(url.searchParams.get('q'), args.query);
    assert.equal(url.searchParams.get('limit'), '1');
    assert.equal(url.searchParams.get('commercial'), args.commercial_only ? 'true' : null);
    assert.equal(url.searchParams.get('kind'), args.kind ?? null);
    const shown = await mcp.call('show_meme', { id: fixtureMeme.id });
    assert.deepEqual(shown.structuredContent!.meme, fixtureMeme);
    await mcp.call('search_memes', { ...args, limit: 1 });
    assert.equal(mcp.upstreamUrls.length, 1, 'original memecub cache stays effective');
  } finally { await mcp.close(); }
});

test('missing origin gives explicit custom configuration error without breaking memecub', async () => {
  const mcp = await startTestMcp();
  try {
    const result = await mcp.call('search_memes', { query: '示例' });
    assert.equal(result.isError, true);
    assert.equal((result.structuredContent!.error as { code: string }).code, 'CUSTOM_ORIGIN_REQUIRED');
    assert.equal((await mcp.call('show_meme', { id: 'test-custom' })).isError, true);
    assert.notEqual((await mcp.call('search_memes', { query: '开心' })).isError, true);
  } finally { await mcp.close(); }
});

test('filtered fallback propagates upstream 429 without serving an ineligible custom meme', async () => {
  const mcp = await startTestMcp({ origin: TEST_ORIGIN, fetcher: async () => new Response('', { status: 429, headers: { 'Retry-After': '120' } }) });
  try {
    const result = await mcp.call('search_memes', { query: '示例', commercial_only: true });
    assert.equal(result.isError, true);
    assert.equal((result.structuredContent!.error as { code: string }).code, 'UPSTREAM_LIMIT');
    await mcp.call('search_memes', { query: '示例', kind: 'gif' });
    assert.equal(mcp.upstreamUrls.length, 1);
  } finally { await mcp.close(); }
});

test('static .jpeg responds with JPEG MIME; invalid paths do not expose files', async () => {
  const filename = `mime-test-${randomUUID()}.jpeg`;
  const path = `public/memes/${filename}`;
  await copyFile('public' + CUSTOM_MEMES[0].url, path);
  const mcp = await startTestMcp();
  try {
    const response = await fetch(`${mcp.base}/memes/${filename}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/jpeg');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(path));
    for (const bad of ['/memes/missing.jpg', '/memes/.gitkeep', '/memes/%2e%2e%2fpackage.json', '/memes/test.svg']) {
      assert.ok([400, 404].includes((await fetch(mcp.base + bad)).status));
    }
  } finally { await mcp.close(); await unlink(path); }
});

let cleanup: (() => Promise<void>) | undefined;
before(async () => { cleanup = await installCustomFixture(); });
after(async () => { await cleanup?.(); });
