import { customImageOrigin, safeLocalImagePath } from './meme.js';
import type { SearchInput } from './memecub.js';

// 自定义表情包库（内嵌，避免 Docker 打包丢 JSON）。
// 加图：往 CUSTOM_MEMES 数组里添一条即可。
// url 填相对路径 /memes/<文件名>，运行时由 publicOrigin 拼成完整 URL。
export interface CustomMeme {
  id: string;
  title: string;
  title_zh?: string;
  url: string;
  page_url: string;
  format: 'jpg' | 'jpeg' | 'png' | 'gif';
  emotions: string[];
  keywords: string[];
  tags: string[];
  source?: string;
  source_url?: string;
  attribution?: string;
  author?: string;
  license: {
    code: string;
    name: string;
    url?: string;
    commercial_use: boolean;
    attribution_required: boolean;
  };
}

// 默认空图库：按 README 添加自己有权公开使用的图片。
export const CUSTOM_MEMES: CustomMeme[] = [];

export function searchCustom(query: string, filters: Pick<SearchInput, 'kind' | 'commercial_only'> = { commercial_only: false }): CustomMeme[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return CUSTOM_MEMES.filter(m => {
    if (filters.commercial_only && !m.license.commercial_use) return false;
    const kind = m.format === 'gif' ? 'gif' : 'meme';
    if (filters.kind && filters.kind !== kind) return false;
    const hay = [
      m.title,
      m.title_zh ?? '',
      ...(m.emotions ?? []),
      ...(m.keywords ?? []),
      ...(m.tags ?? []),
    ].join(' ').toLowerCase();
    return terms.every(term => hay.includes(term));
  });
}

export function getCustom(id: string): CustomMeme | undefined {
  return CUSTOM_MEMES.find(m => m.id === id);
}

// 把自定义库的相对路径拼成运行时绝对 URL，供展示层使用。
export function resolveCustomUrl(meme: CustomMeme, publicOrigin: string): string {
  const origin = customImageOrigin(publicOrigin);
  if (!origin || !safeLocalImagePath(meme.url)) throw new Error('Invalid custom image origin or path');
  return new URL(meme.url, origin).href;
}
