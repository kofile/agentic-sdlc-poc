import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FileContextSource, isForbiddenPath } from '../../src/adapters/file-context.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(here, '../fixtures/checkouts/graph-sample-repo');

let tmp: string;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'file-context-')); });
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

function write(rel: string, content: string) {
  const p = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}
function cfg(obj: unknown): string {
  write('context.json', JSON.stringify(obj));
  return path.join(tmp, 'context.json');
}

describe('FileContextSource', () => {
  it('lists the fixture checkout sorted, reads files, and the committed config loads', async () => {
    const src = new FileContextSource(cfg({ catalog: null, specWikiDir: null, repos: { s: FIXTURE } }));
    expect(await src.fileTree('s')).toEqual(['README.md', 'src/index.ts']);
    const files = await src.readFiles('s', ['src/index.ts']);
    expect(files.map((f) => f.path)).toEqual(['src/index.ts']);
    expect(() => new FileContextSource()).not.toThrow();
  });

  it('returns nulls for absent catalog, wiki and checkout', async () => {
    const src = new FileContextSource(cfg({ catalog: 'nope.md', specWikiDir: null, repos: { gone: './missing' } }));
    expect(await src.repositoryCatalog()).toBeNull();
    expect(await src.specWiki('gone')).toBeNull();
    expect(await src.fileTree('gone')).toBeNull();
    expect(await src.fileTree('unknown')).toBeNull();
    expect(await src.readFiles('gone', ['a'])).toEqual([]);
  });

  it('reads the catalog and concatenates the spec wiki in natural order with headers', async () => {
    write('cat.md', '# catalog');
    write('wiki/r/10-b.md', 'ten');
    write('wiki/r/2-a.md', 'two');
    write('wiki/r/skip.txt', 'no');
    const src = new FileContextSource(cfg({ catalog: 'cat.md', specWikiDir: 'wiki', repos: {} }));
    expect(await src.repositoryCatalog()).toBe('# catalog');
    expect(await src.specWiki('r')).toBe('## 2-a.md\n\ntwo\n\n## 10-b.md\n\nten');
    expect(await src.specWiki('missing')).toBeNull();
    expect(await src.specWiki('../etc')).toBeNull();
  });

  it('walk skips node_modules, .git, dist, build, coverage, dot-dirs and reference.diff', async () => {
    for (const d of ['node_modules', '.git', 'dist', 'build', 'coverage', '.hidden']) write(`repo/${d}/x.ts`, 'x');
    write('repo/reference.diff', 'd');
    write('repo/sub/reference.diff', 'd');
    write('repo/keep/a.ts', 'a');
    write('repo/b.ts', 'b');
    const src = new FileContextSource(cfg({ catalog: null, specWikiDir: null, repos: { r: 'repo' } }));
    expect(await src.fileTree('r')).toEqual(['b.ts', 'keep/a.ts']);
  });

  it('refuses forbidden configured paths at construction', () => {
    for (const bad of ['bench/hidden-tests', 'x/bench/tickets/sub', 'bench/orderdesk/reference.diff']) {
      expect(() => new FileContextSource(cfg({ catalog: null, specWikiDir: null, repos: { r: bad } }))).toThrow(/forbidden/);
    }
    expect(() => new FileContextSource(cfg({ catalog: 'bench/tickets/expected.yaml', specWikiDir: null, repos: {} }))).toThrow(/forbidden/);
    expect(() => new FileContextSource(cfg({ catalog: null, specWikiDir: 'bench/hidden-tests', repos: {} }))).toThrow(/forbidden/);
    expect(isForbiddenPath('/a/bench/orderdesk/src')).toBe(false);
  });

  it('walk skips forbidden dirs beneath a configured root', async () => {
    write('bench/hidden-tests/t.ts', 't');
    write('bench/tickets/k.yaml', 'k');
    write('bench/ok/a.ts', 'a');
    const src = new FileContextSource(cfg({ catalog: null, specWikiDir: null, repos: { b: 'bench' } }));
    expect(await src.fileTree('b')).toEqual(['ok/a.ts']);
  });

  it('readFiles refuses paths outside the tree (.., absolute, unlisted)', async () => {
    write('outside.txt', 'secret');
    write('repo/a.ts', 'a');
    const src = new FileContextSource(cfg({ catalog: null, specWikiDir: null, repos: { r: 'repo' } }));
    const got = await src.readFiles('r', ['../outside.txt', path.join(tmp, 'outside.txt'), 'nope.ts', 'a.ts']);
    expect(got).toEqual([{ path: 'a.ts', content: 'a' }]);
  });

  it('drops a canary-bearing file and reports the gap', async () => {
    const fake = 'BENCH-CANARY-' + 'deadbeef';
    write('repo/leak.ts', `// ${fake}\n`);
    write('repo/ok.ts', 'ok');
    const src = new FileContextSource(cfg({ catalog: null, specWikiDir: null, repos: { r: 'repo' } }));
    const { files, gaps } = await src.readFilesDetailed('r', ['leak.ts', 'ok.ts']);
    expect(files.map((f) => f.path)).toEqual(['ok.ts']);
    expect(gaps).toEqual(['context:canary-skipped:r/leak.ts']);
    expect((await src.readFiles('r', ['leak.ts']))).toEqual([]);
  });

  it('honours GRAPH_CONTEXT_CONFIG', async () => {
    const p = cfg({ catalog: null, specWikiDir: null, repos: { s: FIXTURE } });
    process.env.GRAPH_CONTEXT_CONFIG = p;
    try {
      expect(await new FileContextSource().fileTree('s')).toEqual(['README.md', 'src/index.ts']);
    } finally {
      delete process.env.GRAPH_CONTEXT_CONFIG;
    }
  });
});
