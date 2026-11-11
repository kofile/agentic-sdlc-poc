// Pure, deterministic context assembly (spec 010 R4/R5). No I/O.
import { createHash } from 'node:crypto';
import type { Ticket } from './schemas.ts';

export interface ContextCaps {
  maxFiles: number;
  maxTreePaths: number;
  maxFileBytes: number;
  maxTotalBytes: number;
}

export const DEFAULT_CAPS: ContextCaps = {
  maxFiles: 12,
  maxTreePaths: 2000,
  maxFileBytes: 16 * 1024,
  maxTotalBytes: 120 * 1024,
};

export interface RepoContext {
  name: string;
  spec_wiki: string | null;
  tree: string[] | null;
  files: { path: string; content: string }[];
}

const STOPLIST = new Set([
  'this', 'that', 'with', 'from', 'have', 'will', 'should', 'would', 'could', 'when', 'then',
  'than', 'they', 'them', 'their', 'there', 'were', 'been', 'being', 'into', 'also', 'only',
  'each', 'must', 'some', 'such', 'what', 'which', 'while', 'about', 'after', 'before', 'does',
  'done', 'your', 'ours', 'more', 'most', 'make', 'need', 'needs', 'want', 'wants', 'like',
  'just', 'over', 'under', 'same', 'both', 'other', 'these', 'those', 'where', 'here',
]);

function ticketText(ticket: Ticket): string {
  return [ticket.title, ticket.description, ticket.component ?? '', ...(ticket.labels ?? [])].join('\n');
}

export function ticketKeywords(ticket: Ticket): string[] {
  const tokens = ticketText(ticket).toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return [...new Set(tokens.filter((t) => t.length >= 4 && !STOPLIST.has(t)))].sort();
}

export function ticketPaths(ticket: Ticket): string[] {
  const out: string[] = [];
  for (const raw of ticketText(ticket).split(/\s+/)) {
    const tok = raw.replace(/^[`'"([{<]+/, '').replace(/[`'"\])}>.,;:!?]+$/, '');
    if (!tok || tok.includes('://') || !/^[\w./@-]+$/.test(tok)) continue;
    if (tok.includes('/') || /[\w-]\.[A-Za-z][A-Za-z0-9]{0,5}$/.test(tok)) {
      const norm = tok.replace(/^\.?\//, '');
      if (norm && !out.includes(norm)) out.push(norm);
    }
  }
  return out;
}

export function selectFiles(tree: string[], ticket: Ticket, caps: Partial<ContextCaps> = {}): string[] {
  const max = caps.maxFiles ?? DEFAULT_CAPS.maxFiles;
  const chosen: string[] = [];
  const seen = new Set<string>();
  const take = (p: string) => {
    if (!seen.has(p)) {
      seen.add(p);
      chosen.push(p);
    }
  };
  for (const named of ticketPaths(ticket)) {
    for (const p of tree) if (p === named || p.endsWith(`/${named}`)) take(p);
  }
  const keywords = ticketKeywords(ticket);
  const scored: { p: string; score: number }[] = [];
  for (const p of tree) {
    if (seen.has(p)) continue;
    const lower = p.toLowerCase();
    const score = keywords.filter((k) => lower.includes(k)).length;
    if (score > 0) scored.push({ p, score });
  }
  scored.sort((a, b) => b.score - a.score || (a.p < b.p ? -1 : a.p > b.p ? 1 : 0));
  for (const s of scored) take(s.p);
  return chosen.slice(0, max);
}

function truncateBytes(content: string, maxBytes: number): string {
  const buf = Buffer.from(content, 'utf8');
  if (buf.length <= maxBytes) return content;
  // Decoding a cut buffer replaces a split multibyte tail with U+FFFD; drop it.
  const head = buf.subarray(0, maxBytes).toString('utf8').replace(/�+$/, '');
  return `${head}\n[... truncated at ${maxBytes} bytes ...]`;
}

export function buildRepoContext(input: {
  name: string;
  specWiki: string | null;
  tree: string[] | null;
  files: { path: string; content: string }[];
  caps?: Partial<ContextCaps>;
}): { context: RepoContext; gaps: string[] } {
  const caps = { ...DEFAULT_CAPS, ...input.caps };
  const gaps: string[] = [];
  if (input.specWiki == null) gaps.push(`context:spec-wiki-absent:${input.name}`);

  let tree: string[] | null = null;
  if (input.tree == null) {
    gaps.push(`context:checkout-absent:${input.name}`);
  } else if (input.tree.length > caps.maxTreePaths) {
    tree = input.tree.slice(0, caps.maxTreePaths);
    gaps.push(`context:tree-truncated:${input.name}`);
  } else {
    tree = [...input.tree];
  }

  const files: { path: string; content: string }[] = [];
  let total = 0;
  let capped = false;
  for (const f of input.files) {
    const content = truncateBytes(f.content, caps.maxFileBytes);
    const size = Buffer.byteLength(content, 'utf8');
    if (total + size > caps.maxTotalBytes) {
      capped = true;
      continue;
    }
    total += size;
    files.push({ path: f.path, content });
  }
  if (capped) gaps.push(`context:files-capped:${input.name}`);

  return { context: { name: input.name, spec_wiki: input.specWiki, tree, files }, gaps };
}

export function catalogGaps(catalog: string | null): string[] {
  return catalog == null ? ['context:catalog-absent'] : [];
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** Artifact ref for a stage record: `context:<first 12 hex of sha256 of canonical JSON>`. */
export function contextRef(context: unknown): string {
  return `context:${createHash('sha256').update(canonical(context)).digest('hex').slice(0, 12)}`;
}
