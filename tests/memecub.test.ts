import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Memecub, PublicError, searchSchema } from '../src/memecub.js';
import { safeImageUrl } from '../src/meme.js';
import { fixtureMeme, fixtureResponse } from './fixtures.js';

const input = searchSchema.parse({ query: '开心' });
test('Chinese query maps to the public API; no auth; caching and concurrent deduplication', async () => {
  let calls = 0;
  const api = new Memecub(async (url, init) => {
    calls++;
    const actual = new URL(String(url));
    assert.equal(actual.origin + actual.pathname, 'https://memecub.com/api/v1/search');
    assert.equal(actual.searchParams.get('q'), '开心');
    assert.equal(actual.searchParams.get('limit'), '5');
    assert.equal(new Headers(init?.headers).has('authorization'), false);
    assert.equal(init?.redirect, 'error');
    return fixtureResponse();
  });
  const [first, concurrent] = await Promise.all([api.search(input), api.search(input)]);
  assert.deepEqual(first, concurrent);
  assert.deepEqual(first, await api.search(input));
  assert.equal(calls, 1);
  assert.deepEqual(api.get(fixtureMeme.id).license, fixtureMeme.license);
  assert.equal(api.get(fixtureMeme.id).attribution, fixtureMeme.attribution);
  assert.equal(api.get(fixtureMeme.id).source_url, fixtureMeme.source_url);
});
test('rejects empty query, huge limit, upload/private kind and invalid IDs', () => {
  for (const value of [{ query: '  ' }, { query: 'x', limit: 99 }, { query: 'x', kind: 'upload' }]) assert.equal(searchSchema.safeParse(value).success, false);
  assert.throws(() => new Memecub().get('unknown'), (e: unknown) => e instanceof PublicError && e.code === 'MEME_EXPIRED');
});
test('image allowlist rejects private paths, deceptive origins and non-image formats', () => {
  for (const url of ['http://gpic.code-nav.cn/memecub/public/a.jpg', 'https://gpic.code-nav.cn.evil.test/memecub/public/a.png', 'https://evil@gpic.code-nav.cn/memecub/public/a.png', 'https://gpic.code-nav.cn/memecub/private/a.gif', 'https://gpic.code-nav.cn/memecub/public/a.svg', 'https://127.0.0.1/a.png', 'javascript:alert(1)']) assert.equal(safeImageUrl(url), false, url);
  for (const ext of ['jpg', 'jpeg', 'png', 'gif']) assert.equal(safeImageUrl(`https://gpic.code-nav.cn/memecub/public/a.${ext}`), true);
});
test('filters unsupported/private results and enforces commercial filter while preserving metadata', async () => {
  const api = new Memecub(async url => {
    assert.equal(new URL(String(url)).searchParams.get('commercial'), 'true');
    return Response.json({ data: [fixtureMeme, { ...fixtureMeme, private: true }, { ...fixtureMeme, url: 'https://evil.test/a.png' }, { ...fixtureMeme, license: { ...fixtureMeme.license, commercial_use: false } }], total: 4 });
  });
  const result = await api.search({ ...input, commercial_only: true });
  assert.equal(result.memes.length, 1);
  assert.equal(result.skipped, 3);
});
test('empty search is a valid result', async () => {
  const api = new Memecub(async () => Response.json({ data: [], total: 0, backfill_queued: true }));
  assert.deepEqual(await api.search(input), { query: '开心', memes: [], total: 0, skipped: 0, backfill_queued: true });
});
test('429 honors Retry-After without retrying; cache remains usable during cooldown', async () => {
  let time = 0, calls = 0;
  const api = new Memecub(async () => ++calls === 1 ? fixtureResponse() : new Response('', { status: 429, headers: { 'Retry-After': '120' } }), () => time);
  await api.search(input);
  time += 1000;
  await assert.rejects(api.search({ ...input, query: '无语' }), (e: unknown) => e instanceof PublicError && e.retryAfterSeconds === 120);
  await assert.rejects(api.search({ ...input, query: '摸鱼' }), /尚未恢复/);
  await api.search(input);
  assert.equal(calls, 2);
});
test('Retry-After supports HTTP-date, missing header defaults to a day; 402 also stops requests', async () => {
  for (const [status, header, expected] of [[429, new Date(120_000).toUTCString(), 120], [429, '', 86400], [402, '', 86400]] as const) {
    const api = new Memecub(async () => new Response('', { status, headers: header ? { 'Retry-After': header } : {} }), () => 0);
    await assert.rejects(api.search(input), (e: unknown) => e instanceof PublicError && e.retryAfterSeconds === expected);
  }
});
test('caps uncached searches at 20 per rolling day and spaces requests', async () => {
  let time = 0, calls = 0;
  const api = new Memecub(async () => { calls++; return fixtureResponse(); }, () => time);
  await api.search(input);
  await assert.rejects(api.search({ ...input, query: 'busy' }), (e: unknown) => e instanceof PublicError && e.code === 'LOCAL_RATE_LIMIT');
  for (let i = 1; i < 20; i++) { time += 1000; await api.search({ ...input, query: String(i) }); }
  time += 1000;
  await assert.rejects(api.search({ ...input, query: 'over' }), (e: unknown) => e instanceof PublicError && e.code === 'DAILY_BUDGET');
  assert.equal(calls, 20);
});
test('selection expires with a useful search-again error', async () => {
  let time = 0;
  const api = new Memecub(async () => fixtureResponse(), () => time);
  await api.search(input);
  time += 3_600_001;
  assert.throws(() => api.get(fixtureMeme.id), /缓存已过期/);
});
test('HTTP failure, malformed JSON, wrong shape, oversized response and timeout become safe tool errors', async () => {
  for (const response of [new Response('oops', { status: 503 }), new Response('not json'), Response.json({ results: [] }), new Response('x'.repeat(1_000_001))]) {
    const api = new Memecub(async () => response);
    await assert.rejects(api.search(input), PublicError);
  }
  const api = new Memecub(async () => { throw new DOMException('timeout', 'TimeoutError'); });
  await assert.rejects(api.search(input), PublicError);
});
