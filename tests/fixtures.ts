export const fixtureMeme = {
  id: 'test-meme', title: '开心', title_zh: '开心',
  url: 'https://gpic.code-nav.cn/memecub/public/test-meme.gif',
  page_url: 'https://memecub.com/meme/test-meme', format: 'gif', private: false as const,
  license: { code: 'CC-BY-4.0', name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/', commercial_use: true, attribution_required: true, remix_allowed: true },
  attribution: 'Test Author · CC BY 4.0', author: 'Test Author', source_url: 'https://example.com/original',
};
export const fixtureResponse = () => Response.json({ data: [fixtureMeme], total: 1, backfill_queued: false });
