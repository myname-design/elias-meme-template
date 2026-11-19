import { installCustomFixture } from '../support/custom-fixture.js';
import { test, expect, type Page } from '@playwright/test';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { RESOURCE_URI } from '../../src/meme.js';
import { startTestMcp, TEST_ORIGIN } from '../support/mcp.js';

async function mountResult(page: Page, html: string, result: CallToolResult, domains: string[]) {
  await page.setContent('<style>body{margin:0}iframe{width:100%;height:600px;border:0}</style><iframe sandbox="allow-scripts"></iframe>');
  await page.evaluate(({ html, result, domains }) => {
    const frame = document.querySelector('iframe')!;
    window.addEventListener('message', event => {
      if (event.source !== frame.contentWindow) return;
      const data = event.data;
      if (data.method === 'ui/initialize') frame.contentWindow!.postMessage({ jsonrpc: '2.0', id: data.id, result: {
        protocolVersion: data.params.protocolVersion, hostInfo: { name: 'custom-test-host', version: '1' },
        hostCapabilities: { openLinks: {} }, hostContext: { theme: 'light', displayMode: 'inline' },
      } }, '*');
      if (data.method === 'ui/notifications/initialized') frame.contentWindow!.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: result }, '*');
    });
    const policy = `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src ${domains.join(' ')}; connect-src 'none'; base-uri 'none'`;
    frame.srcdoc = html.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="${policy}">`);
  }, { html, result, domains });
  return page.frameLocator('iframe');
}

async function getCustomResult(mcp: Awaited<ReturnType<typeof startTestMcp>>) {
  const found = await mcp.call('search_memes', { query: '色块 示例', kind: 'meme' });
  expect(found.isError).not.toBe(true);
  const id = (found.structuredContent!.memes as { id: string }[])[0].id;
  const result = await mcp.call('show_meme', { id });
  const resource = (await mcp.client.readResource({ uri: RESOURCE_URI })).contents[0];
  if (!('text' in resource)) throw new Error('Expected HTML');
  const domains = (resource._meta!.ui as { csp: { resourceDomains: string[] } }).csp.resourceDomains;
  return { result, html: resource.text, domains };
}

for (const width of [320, 390]) test(`real custom search/show and static image render at ${width}px`, async ({ page }) => {
  const mcp = await startTestMcp({ origin: TEST_ORIGIN });
  try {
    await page.setViewportSize({ width, height: 844 });
    const { result, html, domains } = await getCustomResult(mcp);
    let requests = 0;
    await page.route(TEST_ORIGIN + '/**', async route => {
      requests++;
      // Real bytes and MIME from the app's static handler; HTTPS origin is simulated.
      const response = await page.request.get(mcp.base + new URL(route.request().url()).pathname);
      expect(response.status()).toBe(200);
      await route.fulfill({ response });
    });
    const frame = await mountResult(page, html, result, domains);
    await expect(frame.locator('#image')).toBeVisible();
    await expect(frame.locator('#status')).toBeHidden();
    expect(await frame.locator('#image').evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
    expect(requests).toBe(1);
    expect(mcp.upstreamUrls.length).toBe(0);
    await expect(frame.locator('#source')).toHaveText('来源：自定义图库（原始链接未知）');
    await expect(frame.locator('#source')).not.toHaveAttribute('href');
    await expect(frame.locator('#original')).toContainText('程序生成的纯色测试图');
    await expect(frame.locator('#license')).toContainText('商用未获授权');
    expect(await frame.locator('body').evaluate(el => el.scrollWidth <= window.innerWidth)).toBe(true);
  } finally { await mcp.close(); }
});

for (const url of ['https://evil.test/memes/a.jpg', TEST_ORIGIN + '/private/a.jpg']) test(`custom result cannot widen allowed image URLs: ${url}`, async ({ page }) => {
  const mcp = await startTestMcp({ origin: TEST_ORIGIN });
  try {
    const { result, html, domains } = await getCustomResult(mcp);
    Object.assign(result.structuredContent!.meme as object, { url, configuredOrigin: 'https://evil.test' });
    const frame = await mountResult(page, html, result, domains);
    await expect(frame.locator('#status')).toContainText('格式不支持');
    await expect(frame.locator('#image')).not.toHaveAttribute('src');
    await expect(frame.locator('#meme')).toBeHidden();
  } finally { await mcp.close(); }
});

test('custom data cannot supply its own origin if trusted resource metadata is absent', async ({ page }) => {
  const mcp = await startTestMcp({ origin: TEST_ORIGIN });
  try {
    const { result, html, domains } = await getCustomResult(mcp);
    const frame = await mountResult(page, html.replace(/<meta name="elias-meme-origin"[^>]*>/, ''), result, domains);
    await expect(frame.locator('#status')).toContainText('格式不支持');
    await expect(frame.locator('#image')).not.toHaveAttribute('src');
  } finally { await mcp.close(); }
});

test('custom image network error retains honest source and copyright information', async ({ page }) => {
  const mcp = await startTestMcp({ origin: TEST_ORIGIN });
  try {
    const { result, html, domains } = await getCustomResult(mcp);
    await page.route(TEST_ORIGIN + '/**', route => route.abort());
    const frame = await mountResult(page, html, result, domains);
    await expect(frame.locator('#status')).toContainText('图片暂时无法加载');
    await expect(frame.locator('#original')).toContainText('程序生成的纯色测试图');
    await expect(frame.locator('#license')).toContainText('测试许可（仅用于筛选断言）');
    await expect(frame.locator('#source')).not.toHaveAttribute('href');
  } finally { await mcp.close(); }
});

let cleanup: (() => Promise<void>) | undefined;
test.beforeAll(async () => { cleanup = await installCustomFixture(); });
test.afterAll(async () => { await cleanup?.(); });
