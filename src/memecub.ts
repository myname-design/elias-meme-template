import { z } from 'zod';
import { memeSchema, type Meme } from './meme.js';

export const searchSchema = z.object({
  query: z.string().trim().min(1).max(80).describe('中文情绪或关键词，例如：开心、无语、摸鱼'),
  limit: z.number().int().min(1).max(10).default(5),
  kind: z.enum(['meme', 'gif']).optional(),
  commercial_only: z.boolean().default(false),
});
export type SearchInput = z.infer<typeof searchSchema>;
export class PublicError extends Error {
  constructor(public code: string, message: string, public retryAfterSeconds?: number) { super(message); }
}
type SearchResult = { query: string; memes: Meme[]; total: number; skipped: number; backfill_queued: boolean };
type Entry<T> = { value: T; expires: number };
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export class Memecub {
  private searches = new Map<string, Entry<SearchResult>>();
  private memes = new Map<string, Entry<Meme>>();
  private pending = new Map<string, Promise<SearchResult>>();
  private requests: number[] = [];
  private blockedUntil = 0;
  private nextRequestAt = 0;
  constructor(private fetcher: typeof fetch = fetch, private now = Date.now) {}

  async search(input: SearchInput): Promise<SearchResult> {
    const key = JSON.stringify(input);
    this.prune();
    const cached = this.searches.get(key);
    if (cached) return cached.value;
    const inFlight = this.pending.get(key);
    if (inFlight) return inFlight;
    const current = this.now();
    if (current < this.blockedUntil) throw new PublicError('UPSTREAM_COOLDOWN', 'memecub 额度或频率限制尚未恢复，请稍后再试。', Math.ceil((this.blockedUntil - current) / 1000));
    this.requests = this.requests.filter(time => time > current - DAY);
    if (this.requests.length >= 20) throw new PublicError('DAILY_BUDGET', '本实例已用完 24 小时内的 20 次免密搜索预算。', Math.ceil((this.requests[0] + DAY - current) / 1000));
    if (current < this.nextRequestAt) throw new PublicError('LOCAL_RATE_LIMIT', '搜索过于频繁，请稍后再试。', 1);
    this.nextRequestAt = current + 1000;
    this.requests.push(current);
    const request = this.request(input);
    this.pending.set(key, request);
    try { return await request; }
    finally { this.pending.delete(key); }
  }

  get(id: string): Meme {
    this.prune();
    const entry = this.memes.get(id);
    if (!entry) throw new PublicError('MEME_EXPIRED', '该表情包未被搜索到或缓存已过期，请先调用 search_memes，再用返回的 id 调用 show_meme。');
    return entry.value;
  }

  private prune() {
    for (const [key, entry] of this.searches) if (entry.expires <= this.now()) this.searches.delete(key);
    for (const [key, entry] of this.memes) if (entry.expires <= this.now()) this.memes.delete(key);
  }

  private async request(input: SearchInput): Promise<SearchResult> {
    const url = new URL('https://memecub.com/api/v1/search');
    url.searchParams.set('q', input.query);
    url.searchParams.set('limit', String(input.limit));
    if (input.kind) url.searchParams.set('kind', input.kind);
    if (input.commercial_only) url.searchParams.set('commercial', 'true');
    // No auth, private-library, generation, upload or download endpoint.
    try {
      const response = await this.fetcher(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'Elias-Meme/0.1.0' },
        signal: AbortSignal.timeout(12_000), redirect: 'error',
      });
      if (response.status === 429 || response.status === 402) {
        const header = response.headers.get('retry-after');
        const seconds = header && /^\d+$/.test(header) ? Number(header) : NaN;
        const dateDelay = header ? Date.parse(header) - this.now() : NaN;
        const delay = Number.isFinite(seconds) ? seconds * 1000 : Number.isFinite(dateDelay) ? dateDelay : DAY;
        this.blockedUntil = this.now() + Math.max(1000, delay);
        await response.body?.cancel();
        throw new PublicError('UPSTREAM_LIMIT', 'memecub 返回额度或频率限制；不会自动重试或购买额度。', Math.ceil((this.blockedUntil - this.now()) / 1000));
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new PublicError('UPSTREAM_HTTP', `memecub 暂不可用（HTTP ${response.status}）。`);
      }
      // Bound memory even when upstream returns a malformed/oversized response.
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Missing response');
      const chunks: Uint8Array[] = [];
      let length = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.byteLength;
          if (length > 1_000_000) throw new Error('Response too large');
          chunks.push(value);
        }
      } finally { await reader.cancel(); }
      const payload = z.object({ data: z.array(z.unknown()).max(50), total: z.number().nonnegative(), backfill_queued: z.boolean().optional() })
        .parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      const memes = payload.data.flatMap(item => {
        const parsed = memeSchema.safeParse(item);
        if (!parsed.success || (input.commercial_only && !parsed.data.license.commercial_use)) return [];
        return [parsed.data];
      }).slice(0, input.limit);
      const result = { query: input.query, memes, total: payload.total, skipped: payload.data.length - memes.length, backfill_queued: payload.backfill_queued ?? false };
      // Search cache expires before selection cache. Both maps are bounded.
      for (const meme of memes) this.memes.set(meme.id, { value: meme, expires: this.now() + HOUR });
      while (this.memes.size > 1000) this.memes.delete(this.memes.keys().next().value!);
      this.searches.set(JSON.stringify(input), { value: result, expires: this.now() + 10 * 60_000 });
      while (this.searches.size > 200) this.searches.delete(this.searches.keys().next().value!);
      return result;
    } catch (error) {
      if (error instanceof PublicError) throw error;
      throw new PublicError('UPSTREAM_INVALID', 'memecub 请求超时、网络异常或返回格式不兼容，请稍后再试。');
    }
  }
}
