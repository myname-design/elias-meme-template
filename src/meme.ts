import { z } from 'zod';

export const IMAGE_ORIGINS = ['https://gpic.code-nav.cn'] as const;
export const RESOURCE_URI = 'ui://elias-meme/meme-v2.html';

export const safeImageUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return IMAGE_ORIGINS.some(origin => origin === url.origin) &&
      !url.username && !url.password && url.pathname.startsWith('/memecub/public/') &&
      /\.(jpe?g|png|gif)$/i.test(url.pathname);
  } catch { return false; }
};

// 自定义库图片：只允许站内相对路径 /memes/<文件名>，禁止绝对协议、禁止带凭证。
export const safeLocalImagePath = (value: string): boolean =>
  /^\/memes\/[A-Za-z0-9._-]+\.(jpe?g|png|gif)$/i.test(value);

// This origin comes from server configuration, never from tool result data.
export function customImageOrigin(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return undefined;
    return url.origin;
  } catch { return undefined; }
}

export function safeCustomImageUrl(value: string, configuredOrigin?: string): boolean {
  const origin = customImageOrigin(configuredOrigin);
  if (!origin) return false;
  try {
    const url = new URL(value);
    return url.origin === origin && !url.username && !url.password && !url.search && !url.hash &&
      safeLocalImagePath(url.pathname);
  } catch { return false; }
}

export const safeLink = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
};

export const memeSchema = z.object({
  id: z.string().min(1).max(160),
  title: z.string().max(2000),
  title_zh: z.string().nullable().optional(),
  url: z.string().refine(safeImageUrl, 'Unsupported image URL'),
  page_url: z.string().refine(value => {
    try { return new URL(value).origin === 'https://memecub.com' && !!safeLink(value); }
    catch { return false; }
  }),
  format: z.enum(['jpg', 'jpeg', 'png', 'gif']),
  license: z.object({
    code: z.string(), name: z.string(), url: z.string().nullable().optional(),
    commercial_use: z.boolean(), attribution_required: z.boolean(),
    remix_allowed: z.boolean().optional(),
  }).passthrough(),
  attribution: z.unknown().optional(),
  source: z.unknown().optional(),
  source_url: z.string().nullable().optional(),
  author: z.unknown().optional(),
  private: z.literal(false),
}).passthrough();
export type Meme = z.infer<typeof memeSchema>;

// Keep the upstream schema unchanged. Custom data has a separate, explicit trust boundary.
export function customMemeSchema(origin?: string) {
  return memeSchema.extend({
    provider: z.literal('custom'),
    url: z.string().refine(value => safeCustomImageUrl(value, origin), 'Unsupported custom image URL'),
    page_url: z.string().refine(value => !!safeLink(value)).nullable(),
  });
}

export function displayMemeSchema(origin?: string) {
  return z.union([
    memeSchema.extend({ provider: z.literal('memecub').optional() }),
    customMemeSchema(origin),
  ]);
}

// Treat upstream content as data; never interpret Markdown/HTML from the API.
export function creditText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value : JSON.stringify(value);
}
