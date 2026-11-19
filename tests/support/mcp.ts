import { readFile } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { createHttpApp } from '../../src/http.js';
import { Memecub } from '../../src/memecub.js';
import { fixtureResponse } from '../fixtures.js';

export const TEST_ORIGIN = 'https://elias-meme.test';
export async function startTestMcp(options: { origin?: string; fetcher?: typeof fetch } = {}) {
  const upstreamUrls: URL[] = [];
  const html = await readFile('dist/ui/meme.html', 'utf8');
  const memecub = new Memecub(async (url, init) => {
    upstreamUrls.push(new URL(String(url)));
    return options.fetcher ? options.fetcher(url, init) : fixtureResponse();
  });
  const http = createHttpApp({ html, publicOrigin: options.origin, memecub }).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => http.once('listening', resolve));
  const base = `http://127.0.0.1:${(http.address() as { port: number }).port}`;
  const client = new Client({ name: 'custom-meme-test', version: '1' });
  const close = async () => {
    await client.close();
    await new Promise<void>((resolve, reject) => http.close(error => error ? reject(error) : resolve()));
  };
  try { await client.connect(new StreamableHTTPClientTransport(new URL(base + '/mcp'))); }
  catch (error) { await close(); throw error; }
  return {
    client, base, upstreamUrls, close,
    call: async (name: string, args: Record<string, unknown>) => await client.callTool({ name, arguments: args }) as CallToolResult,
  };
}
