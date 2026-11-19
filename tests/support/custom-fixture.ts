import { writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { CUSTOM_MEMES, type CustomMeme } from '../../src/custom.js';

// Generated solid-color JPEG, no EXIF. Only tests install this entry.
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAYABgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD1eiiivgz2QooooAKKKKACiiigD//Z', 'base64');
export async function installCustomFixture() {
  const url = `/memes/test-${randomUUID()}.jpg`;
  const item: CustomMeme = {
    id: 'test-custom', title: '色块示例', title_zh: '色块示例', url,
    page_url: '', format: 'jpg', emotions: ['示例'], keywords: ['色块', '测试', 'block'], tags: ['测试'],
    source: '程序生成的纯色测试图', source_url: '',
    license: { code: 'test', name: '测试许可（仅用于筛选断言）', commercial_use: false, attribution_required: false },
  };
  await writeFile('public' + url, JPEG, { flag: 'wx' });
  CUSTOM_MEMES.push(item);
  return async () => {
    const index = CUSTOM_MEMES.indexOf(item);
    if (index >= 0) CUSTOM_MEMES.splice(index, 1);
    await unlink('public' + url);
  };
}
