import { build } from 'esbuild';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
const result = await build({ entryPoints: ['ui/app.ts'], bundle: true, write: false, minify: true, format: 'esm', target: 'es2022', legalComments: 'inline', metafile: true });
const script = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const template = await readFile('ui/meme.html', 'utf8');
await mkdir('dist/ui', { recursive: true });
const packages = new Set(Object.keys(result.metafile.inputs).flatMap(path => {
  const match = path.match(/^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//);
  return match ? [match[1]] : [];
}));
const notices: string[] = [];
for (const path of packages) {
  const names = await readdir(path);
  const license = names.find(name => /^licen[sc]e(?:\..*)?$/i.test(name));
  if (!license) throw new Error(`Missing third-party license: ${path}`);
  notices.push(`${path}\n${await readFile(`${path}/${license}`, 'utf8')}`);
}
await writeFile('dist/ui/THIRD_PARTY_NOTICES.txt', notices.join('\n\n'));
await writeFile('dist/ui/meme.html', template.replace('/* APP_SCRIPT */', () => script) + '\n<!--\n' + notices.join('\n\n').replace(/-->/g, '-- >') + '\n-->\n');
