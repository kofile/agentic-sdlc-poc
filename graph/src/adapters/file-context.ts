import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ContextFile, ContextSource } from '../ports/context.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const GRAPH_ROOT = path.resolve(here, '../..'); // src/adapters -> graph/
const DEFAULT_CONFIG = path.join(GRAPH_ROOT, 'config', 'context.json');

export const CANARY_PREFIX = 'BENCH-CANARY-';
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage']);
const FORBIDDEN_SEQUENCES: string[][] = [
  ['bench', 'hidden-tests'],
  ['bench', 'tickets'],
];

export interface ContextConfig {
  catalog: string | null;
  specWikiDir: string | null;
  repos: Record<string, string>;
}

/** True when an absolute path lies inside a forbidden benchmark dir or is a reference.diff. */
export function isForbiddenPath(p: string): boolean {
  const segs = path.resolve(p).split(path.sep);
  if (segs[segs.length - 1] === 'reference.diff') return true;
  for (const seq of FORBIDDEN_SEQUENCES) {
    for (let i = 0; i + seq.length <= segs.length; i++) {
      if (seq.every((s, j) => segs[i + j] === s)) return true;
    }
  }
  return false;
}

function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, 'en', { numeric: true });
}

export class FileContextSource implements ContextSource {
  private readonly catalogPath: string | null;
  private readonly specWikiDir: string | null;
  private readonly repos: Map<string, string>;
  private readonly treeCache = new Map<string, string[] | null>();

  constructor(configPath: string = process.env.GRAPH_CONTEXT_CONFIG ?? DEFAULT_CONFIG) {
    const abs = path.resolve(configPath);
    const dir = path.dirname(abs);
    const cfg = JSON.parse(fs.readFileSync(abs, 'utf8')) as ContextConfig;
    const resolve = (label: string, p: string | null | undefined): string | null => {
      if (p == null) return null;
      const r = path.resolve(dir, p);
      if (isForbiddenPath(r)) throw new Error(`context config: ${label} resolves to a forbidden benchmark path (${r})`);
      return r;
    };
    this.catalogPath = resolve('catalog', cfg.catalog);
    this.specWikiDir = resolve('specWikiDir', cfg.specWikiDir);
    this.repos = new Map();
    for (const [name, p] of Object.entries(cfg.repos ?? {})) {
      this.repos.set(name, resolve(`repos.${name}`, p)!);
    }
  }

  async repositoryCatalog(): Promise<string | null> {
    if (!this.catalogPath || !fs.existsSync(this.catalogPath)) return null;
    return fs.readFileSync(this.catalogPath, 'utf8');
  }

  async specWiki(repo: string): Promise<string | null> {
    if (!this.specWikiDir) return null;
    if (!/^[A-Za-z0-9._-]+$/.test(repo) || repo === '..' || repo === '.') return null;
    const dir = path.join(this.specWikiDir, repo);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return null;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort(naturalCompare);
    if (files.length === 0) return null;
    return files.map((f) => `## ${f}\n\n${fs.readFileSync(path.join(dir, f), 'utf8')}`).join('\n\n');
  }

  async fileTree(repo: string): Promise<string[] | null> {
    if (this.treeCache.has(repo)) return this.treeCache.get(repo)!;
    const root = this.repos.get(repo);
    let tree: string[] | null = null;
    if (root && fs.existsSync(root) && fs.statSync(root).isDirectory()) {
      const out: string[] = [];
      this.walk(root, '', out);
      tree = out.sort();
    }
    this.treeCache.set(repo, tree);
    return tree;
  }

  private walk(root: string, rel: string, out: string[]): void {
    const dir = rel ? path.join(root, rel) : root;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const childRel = rel ? `${rel}/${ent.name}` : ent.name;
      const abs = path.join(root, childRel);
      if (isForbiddenPath(abs)) continue;
      if (ent.isDirectory()) {
        if (SKIP_DIRS.has(ent.name) || ent.name.startsWith('.')) continue;
        this.walk(root, childRel, out);
      } else if (ent.isFile()) {
        out.push(childRel);
      }
    }
  }

  async readFiles(repo: string, paths: string[]): Promise<ContextFile[]> {
    return (await this.readFilesDetailed(repo, paths)).files;
  }

  async readFilesDetailed(repo: string, paths: string[]): Promise<{ files: ContextFile[]; gaps: string[] }> {
    const files: ContextFile[] = [];
    const gaps: string[] = [];
    const root = this.repos.get(repo);
    const tree = await this.fileTree(repo);
    if (!root || !tree) return { files, gaps };
    const allowed = new Set(tree);
    for (const p of paths) {
      if (!allowed.has(p)) continue; // no `..`, no absolute paths: only tree members
      const content = fs.readFileSync(path.join(root, p), 'utf8');
      if (content.includes(CANARY_PREFIX)) {
        gaps.push(`context:canary-skipped:${repo}/${p}`);
        continue;
      }
      files.push({ path: p, content });
    }
    return { files, gaps };
  }
}
