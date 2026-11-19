import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CUSTOM_MEMES } from '../src/custom.js';
import { startTestMcp } from './support/mcp.js';
import { fixtureMeme } from './fixtures.js';

test('clean template ships empty; search falls back and show returns upstream selection', async () => {
  assert.deepEqual(CUSTOM_MEMES, []);
  const mcp = await startTestMcp();
  try {
    const search = await mcp.call('search_memes', { query: '开心' });
    assert.notEqual(search.isError, true);
    assert.equal(mcp.upstreamUrls.length, 1);
    const show = await mcp.call('show_meme', { id: fixtureMeme.id });
    assert.deepEqual(show.structuredContent?.meme, fixtureMeme);
    assert.equal((await mcp.call('show_meme', { id: 'not-configured' })).isError, true);
  } finally { await mcp.close(); }
});
