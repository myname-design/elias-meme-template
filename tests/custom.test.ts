import { installCustomFixture } from './support/custom-fixture.js';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { CUSTOM_MEMES, searchCustom, getCustom, resolveCustomUrl } from '../src/custom.js';
import { customImageOrigin, displayMemeSchema, safeCustomImageUrl, safeImageUrl, safeLocalImagePath } from '../src/meme.js';

test('safeLocalImagePath 只放行 /memes/ 下合法图片路径', () => {
  assert.equal(safeLocalImagePath('/memes/abc.png'), true);
  assert.equal(safeLocalImagePath('/memes/a-b_c.9.jpeg'), true);
  assert.equal(safeLocalImagePath('/memes/a.gif'), true);
  assert.equal(safeLocalImagePath('/memes/a.jpg'), true);
  assert.equal(safeLocalImagePath('https://evil.com/memes/a.png'), false);
  assert.equal(safeLocalImagePath('/memes/../etc/passwd'), false);
  assert.equal(safeLocalImagePath('/other/a.png'), false);
  assert.equal(safeLocalImagePath('/memes/a.txt'), false);
});

test('resolveCustomUrl 把相对路径拼到 publicOrigin', () => {
  const m = { id: 'x', title: 'x', url: '/memes/x.png', page_url: '', format: 'png' as const, emotions: [], keywords: [], tags: [], license: { code: 'c', name: 'n', commercial_use: false, attribution_required: false } };
  assert.equal(resolveCustomUrl(m, 'https://elias-meme.test'), 'https://elias-meme.test/memes/x.png');
});

test('searchCustom 未命中或空查询返回空数组', () => {
  assert.deepEqual(searchCustom('开心'), []);
  assert.deepEqual(searchCustom(''), []);
});

test('getCustom 未知 ID 返回 undefined', () => {
  assert.equal(getCustom('nope'), undefined);
});

test('multi-keyword search uses AND, ignores case and whitespace, and respects filters', () => {
  for (const query of ['色块 示例', '示例 色块', ' BLOCK\t色块 ', '色块\u3000示例', '测试']) {
    assert.deepEqual(searchCustom(query).map(m => m.id), ['test-custom']);
  }
  assert.deepEqual(searchCustom('色块 不存在'), []);
  assert.deepEqual(searchCustom('示例', { commercial_only: true }), []);
  assert.deepEqual(searchCustom('示例', { commercial_only: false, kind: 'gif' }), []);
  assert.equal(searchCustom('示例', { commercial_only: false, kind: 'meme' }).length, 1);
});

test('custom image trust is restricted to configured HTTPS origin and static path', () => {
  const origin = 'https://elias-meme.test';
  assert.equal(customImageOrigin(origin + '/'), origin);
  assert.equal(safeCustomImageUrl(origin + '/memes/a.jpeg', origin), true);
  assert.equal(safeImageUrl(origin + '/memes/a.jpeg'), false, 'memecub allowlist stays unchanged');
  for (const url of [
    'https://evil.test/memes/a.jpg', 'https://elias-meme.test.evil.test/memes/a.jpg',
    'https://user@elias-meme.test/memes/a.jpg', origin + '/private/a.jpg', origin + '/memes/../a.jpg',
    origin + '/memes/a.svg', origin + '/memes/a.jpg?redirect=evil', origin + '/memes/a.jpg#fragment',
    origin + '/memes/%2Fsecret.jpg', 'http://elias-meme.test/memes/a.jpg', '/memes/a.jpg',
  ]) assert.equal(safeCustomImageUrl(url, origin), false, url);
  assert.equal(safeCustomImageUrl(origin + '/memes/a.jpg'), false);
  for (const value of ['http://elias-meme.test', origin + '/path', origin + '?x=1', 'https://u:p@elias-meme.test']) {
    assert.equal(customImageOrigin(value), undefined);
    assert.throws(() => resolveCustomUrl(CUSTOM_MEMES[0], value));
  }
  assert.throws(() => resolveCustomUrl({ ...CUSTOM_MEMES[0], url: 'https://evil.test/a.jpg' }, origin));
});

test('custom display data requires public marker and trusted origin, allows unknown source', () => {
  const origin = 'https://elias-meme.test';
  const data = { ...CUSTOM_MEMES[0], provider: 'custom', private: false, url: resolveCustomUrl(CUSTOM_MEMES[0], origin), page_url: null };
  const schema = displayMemeSchema(origin);
  assert.equal(schema.safeParse(data).success, true);
  assert.equal(schema.safeParse({ ...data, page_url: 'https://example.com/source' }).success, true);
  for (const replacement of [{ private: true }, { private: undefined }, { page_url: '' }, { page_url: 'javascript:alert(1)' }, { url: 'https://evil.test/memes/a.jpg' }, { provider: 'memecub' }]) {
    assert.equal(schema.safeParse({ ...data, ...replacement }).success, false);
  }
  assert.equal(displayMemeSchema().safeParse(data).success, false);
});

let cleanup: (() => Promise<void>) | undefined;
before(async () => { cleanup = await installCustomFixture(); });
after(async () => { await cleanup?.(); });
