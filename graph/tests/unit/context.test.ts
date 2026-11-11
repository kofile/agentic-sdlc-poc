import { describe, it, expect } from 'vitest';
import {
  ticketKeywords, ticketPaths, selectFiles, buildRepoContext, catalogGaps, contextRef, DEFAULT_CAPS,
} from '../../src/core/context.ts';
import type { Ticket } from '../../src/core/schemas.ts';

const ticket: Ticket = {
  id: 'T-1',
  title: 'Add invoice export',
  description: 'Touch `src/billing/invoice.ts` and docs/readme.md. See also http://x.test/a/b. Ends with file.',
  component: 'Billing',
  labels: ['export'],
};

describe('ticketKeywords / ticketPaths', () => {
  it('lowercases, dedupes, sorts, drops short and stoplist tokens', () => {
    const k = ticketKeywords(ticket);
    expect(k).toEqual([...k].sort());
    expect(new Set(k).size).toBe(k.length);
    expect(k).toContain('invoice');
    expect(k).toContain('billing');
    expect(k).not.toContain('add');
    expect(k).not.toContain('with');
    expect(k.every((t) => t.length >= 4 && t === t.toLowerCase())).toBe(true);
  });
  it('extracts path-like tokens, not urls or plain words', () => {
    const p = ticketPaths(ticket);
    expect(p).toContain('src/billing/invoice.ts');
    expect(p).toContain('docs/readme.md');
    expect(p.some((x) => x.includes('://'))).toBe(false);
    expect(p).not.toContain('file');
  });
});

describe('selectFiles', () => {
  const tree = [
    'README.md', 'docs/readme.md', 'src/billing/invoice.ts', 'src/billing/tax.ts',
    'src/export/invoice-export.ts', 'src/misc/other.ts', 'vendor/src/billing/invoice.ts',
  ];
  it('puts named paths first (exact or suffix), then scored by keyword hits, then path order', () => {
    const sel = selectFiles(tree, ticket);
    expect(sel.slice(0, 3)).toEqual(['src/billing/invoice.ts', 'vendor/src/billing/invoice.ts', 'docs/readme.md']);
    // invoice-export.ts matches invoice+export (2) ahead of tax.ts (billing, 1)
    expect(sel.indexOf('src/export/invoice-export.ts')).toBeLessThan(sel.indexOf('src/billing/tax.ts'));
    expect(sel).not.toContain('src/misc/other.ts');
    expect(new Set(sel).size).toBe(sel.length);
  });
  it('caps at maxFiles (default 12)', () => {
    const big = Array.from({ length: 30 }, (_, i) => `src/invoice/f${String(i).padStart(2, '0')}.ts`);
    expect(selectFiles(big, ticket)).toHaveLength(12);
    expect(selectFiles(big, ticket, { maxFiles: 3 })).toEqual(big.slice(0, 3));
  });
});

describe('buildRepoContext', () => {
  const files = [{ path: 'a.ts', content: 'x'.repeat(100) }, { path: 'b.ts', content: 'y'.repeat(100) }];
  it('is deterministic', () => {
    const a = buildRepoContext({ name: 'r', specWiki: 'w', tree: ['a.ts', 'b.ts'], files });
    const b = buildRepoContext({ name: 'r', specWiki: 'w', tree: ['a.ts', 'b.ts'], files });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(contextRef(a.context)).toBe(contextRef(b.context));
    expect(contextRef(a.context)).toMatch(/^context:[0-9a-f]{12}$/);
  });
  it('records absence gaps, never silent', () => {
    const r = buildRepoContext({ name: 'r', specWiki: null, tree: null, files: [] });
    expect(r.context.tree).toBeNull();
    expect(r.gaps).toEqual(['context:spec-wiki-absent:r', 'context:checkout-absent:r']);
    expect(catalogGaps(null)).toEqual(['context:catalog-absent']);
    expect(catalogGaps('x')).toEqual([]);
  });
  it('truncates the tree with a gap', () => {
    const tree = Array.from({ length: 5 }, (_, i) => `f${i}`);
    const r = buildRepoContext({ name: 'r', specWiki: 'w', tree, files: [], caps: { maxTreePaths: 3 } });
    expect(r.context.tree).toEqual(['f0', 'f1', 'f2']);
    expect(r.gaps).toContain('context:tree-truncated:r');
  });
  it('truncates each file with a marker and caps total bytes with a gap', () => {
    const r = buildRepoContext({ name: 'r', specWiki: 'w', tree: ['a.ts', 'b.ts'], files, caps: { maxFileBytes: 40, maxTotalBytes: 100 } });
    expect(r.context.files[0].content).toMatch(/\[\.\.\. truncated at 40 bytes \.\.\.\]$/);
    expect(r.context.files).toHaveLength(1); // second would push past 100
    expect(r.gaps).toContain('context:files-capped:r');
  });
  it('defaults match the spec', () => {
    expect(DEFAULT_CAPS).toEqual({ maxFiles: 12, maxTreePaths: 2000, maxFileBytes: 16384, maxTotalBytes: 122880 });
  });
});
