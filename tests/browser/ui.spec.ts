import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fixtureMeme } from '../fixtures.js';

// Synthetic host speaks MCP Apps postMessage protocol to the actual bundled App SDK.
// This is NOT ChatGPT and cannot establish ChatGPT production/client compatibility.
async function mount(page: Page, meme: unknown, broken = false) {
  const images = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 900; canvas.height = 700;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#ffda61'; ctx.fillRect(0, 0, 900, 700);
    return { png: canvas.toDataURL('image/png').split(',')[1], jpeg: canvas.toDataURL('image/jpeg').split(',')[1] };
  });
  await page.route('https://gpic.code-nav.cn/**', async route => {
    if (broken) { await route.abort(); return; }
    const format = route.request().url().endsWith('.png') ? 'png' : route.request().url().endsWith('.jpg') ? 'jpeg' : 'gif';
    const data = format === 'gif' ? 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' : images[format];
    await route.fulfill({ contentType: `image/${format}`, body: Buffer.from(data, 'base64') });
  });
  const html = await readFile('dist/ui/meme.html', 'utf8');
  await page.setContent('<style>body{margin:0}iframe{width:100%;border:0;height:500px}</style><iframe title="Meme" sandbox="allow-scripts"></iframe>');
  await page.evaluate(({ html, meme }) => {
    const frame = document.querySelector('iframe')!;
    window.addEventListener('message', event => {
      if (event.source !== frame.contentWindow) return;
      const data = event.data;
      if (data.method === 'ui/initialize') frame.contentWindow!.postMessage({ jsonrpc: '2.0', id: data.id, result: {
        protocolVersion: data.params.protocolVersion, hostInfo: { name: 'test-host', version: '1' },
        hostCapabilities: { openLinks: {} }, hostContext: { theme: 'light', displayMode: 'inline' },
      } }, '*');
      if (data.method === 'ui/notifications/initialized') frame.contentWindow!.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: { content: [], structuredContent: { meme } } }, '*');
      if (data.method === 'ui/open-link') frame.contentWindow!.postMessage({ jsonrpc: '2.0', id: data.id, result: {} }, '*');
    });
    // Enforce image and network policy inside a sandboxed frame, like an Apps host.
    const policy = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src https://gpic.code-nav.cn; connect-src 'none'; base-uri 'none'";
    frame.srcdoc = html.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="${policy}">`);
  }, { html, meme });
  return page.frameLocator('iframe');
}

for (const width of [320, 390, 768]) test(`compact image at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 800 });
  const frame = await mount(page, { ...fixtureMeme, format: 'png', url: fixtureMeme.url.replace('.gif', '.png') });
  await expect(frame.locator('#image')).toBeVisible();
  await expect(frame.locator('#status')).toBeHidden();
  await expect(frame.locator('#info-toggle')).toBeVisible();
  expect(await frame.locator('body').evaluate(el => el.scrollWidth <= window.innerWidth)).toBe(true);
  const box = await frame.locator('#image').boundingBox();
  expect(box!.width).toBeLessThanOrEqual(width - 16);
  // 图片宽度固定 180px（桌面 ≥600px 为 200px），按原始比例缩放。
  const expectedWidth = width >= 600 ? 200 : 180;
  expect(Math.round(box!.width)).toBeLessThanOrEqual(expectedWidth + 1);
});

for (const format of ['jpg', 'png', 'gif']) test(`renders original ${format} URL without converting it`, async ({ page }) => {
  const meme = { ...fixtureMeme, format, url: `https://gpic.code-nav.cn/memecub/public/test.${format}` };
  const frame = await mount(page, meme);
  await expect(frame.locator('#status')).toBeHidden();
  await expect(frame.locator('#image')).toHaveAttribute('src', meme.url);
});

test('credits hidden by default, toggle opens and closes them', async ({ page }) => {
  const frame = await mount(page, fixtureMeme);
  await expect(frame.locator('#caption')).toBeHidden();
  await expect(frame.locator('#info-toggle')).toHaveAttribute('aria-expanded', 'false');
  await frame.locator('#info-toggle').click();
  await expect(frame.locator('#caption')).toBeVisible();
  await expect(frame.locator('#info-toggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(frame.locator('#credit')).toHaveText(fixtureMeme.attribution);
  await expect(frame.locator('#source')).toHaveAttribute('href', fixtureMeme.page_url);
  await expect(frame.locator('#original')).toContainText('Test Author');
  await frame.locator('#info-toggle').click();
  await expect(frame.locator('#caption')).toBeHidden();
  await expect(frame.locator('#info-toggle')).toHaveAttribute('aria-expanded', 'false');
});

test('image failure preserves source and credit inside expanded caption', async ({ page }) => {
  const frame = await mount(page, fixtureMeme, true);
  await expect(frame.locator('#status')).toHaveText('图片暂时无法加载，可查看来源。');
  await frame.locator('#info-toggle').click();
  await expect(frame.locator('#source')).toBeVisible();
  await expect(frame.locator('#credit')).toHaveText(fixtureMeme.attribution);
});

test('untrusted title and credits render as text, never HTML', async ({ page }) => {
  const frame = await mount(page, { ...fixtureMeme, attribution: '<img src=x onerror=alert(1)>', title_zh: '<script>alert(1)</script>' });
  await frame.locator('#info-toggle').click();
  await expect(frame.locator('#credit')).toHaveText('<img src=x onerror=alert(1)>');
  await expect(frame.locator('#credit img')).toHaveCount(0);
  await expect(frame.locator('#image')).toHaveAttribute('alt', '<script>alert(1)</script>');
});

test('unsupported origin never reaches an img element', async ({ page }) => {
  const frame = await mount(page, { ...fixtureMeme, url: 'https://evil.test/tracker.png' });
  await expect(frame.locator('#status')).toContainText('格式不支持');
  await expect(frame.locator('#image')).not.toHaveAttribute('src');
});
