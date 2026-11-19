import { App } from '@modelcontextprotocol/ext-apps';
import { displayMemeSchema, safeLink, creditText } from '../src/meme.js';

const configuredOrigin = document.querySelector<HTMLMetaElement>('meta[name="elias-meme-origin"]')?.content;
const resultSchema = displayMemeSchema(configuredOrigin);

const app = new App({ name: 'Elias Meme', version: '0.1.0' }, {}, { autoResize: true });
const figure = document.querySelector<HTMLElement>('#meme')!;
const img = document.querySelector<HTMLImageElement>('#image')!;
const status = document.querySelector<HTMLElement>('#status')!;
const source = document.querySelector<HTMLAnchorElement>('#source')!;
const license = document.querySelector<HTMLElement>('#license')!;
const credit = document.querySelector<HTMLElement>('#credit')!;
const original = document.querySelector<HTMLElement>('#original')!;
const caption = document.querySelector<HTMLElement>('#caption')!;
const infoToggle = document.querySelector<HTMLButtonElement>('#info-toggle')!;

function setInfoOpen(open: boolean) {
  caption.hidden = !open;
  infoToggle.setAttribute('aria-expanded', String(open));
}
infoToggle.addEventListener('click', () => setInfoOpen(caption.hidden !== false));

function fail(message: string) {
  figure.hidden = true;
  img.removeAttribute('src');
  status.hidden = false;
  status.textContent = message;
}
app.ontoolresult = result => {
  if (result.isError) { fail('表情包暂不可用，请重新搜索。'); return; }
  const parsed = resultSchema.safeParse(result.structuredContent?.meme);
  if (!parsed.success) { fail('表情包数据不完整或格式不支持，请重新搜索。'); return; }
  const meme = parsed.data;
  source.removeAttribute('href');
  source.onclick = null;
  source.textContent = meme.provider === 'custom' ? '来源：自定义图库（原始链接未知）' : '来源：memecub';
  const pageUrl = meme.page_url;
  if (pageUrl) {
    source.textContent = meme.provider === 'custom' ? '查看原始来源' : '来源：memecub';
    source.href = pageUrl;
    source.onclick = event => { event.preventDefault(); void app.openLink({ url: pageUrl }).catch(() => { status.hidden = false; status.textContent = '无法打开来源，请稍后重试。'; }); };
  }
  license.replaceChildren();
  const licenseUrl = safeLink(meme.license.url);
  const label = meme.license.name + (meme.license.commercial_use ? ' · 可商用（遵循许可）' : ' · 商用未获授权，版权归原作者');
  if (licenseUrl) {
    const link = document.createElement('a');
    link.textContent = label; link.href = licenseUrl; link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.onclick = event => { event.preventDefault(); void app.openLink({ url: licenseUrl }).catch(() => {}); };
    license.append(link);
  } else license.textContent = label;
  credit.textContent = creditText(meme.attribution) || (meme.license.attribution_required ? '此图片要求署名；上游未提供完整署名信息。' : '');
  original.textContent = [meme.author && `作者：${creditText(meme.author)}`, meme.source && `原始来源：${creditText(meme.source)}`, meme.source_url].filter(Boolean).join(' · ');
  img.alt = meme.title_zh || meme.title;
  img.hidden = false;
  status.hidden = false;
  status.textContent = '正在加载表情包…';
  figure.hidden = false;
  setInfoOpen(false);
  img.onload = () => { status.hidden = true; };
  // Keep attribution and source visible on an image-network failure.
  img.onerror = () => { img.hidden = true; status.hidden = false; status.textContent = '图片暂时无法加载，可查看来源。'; };
  img.src = meme.url;
};
app.ontoolcancelled = () => fail('已取消展示。');
app.connect().catch(() => fail('请在支持 MCP Apps 的聊天客户端中打开此表情包。'));
