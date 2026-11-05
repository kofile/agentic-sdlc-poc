// In-memory Confluence-shaped Docs adapter. Upsert is by exact title — same title always
// resolves to the same page id, re-runs bump `version`, never create a second page (the rule
// from CLAUDE.md's "two rules that create duplicate Confluence pages if broken").
import type { Docs, DocsPage } from '../ports/docs.ts';

interface LedgerEntry { title: string; idempotencyKey: string; version: number; at: number }

export class MemoryDocs implements Docs {
  private pagesByTitle = new Map<string, DocsPage>();
  private seenKeys = new Map<string, LedgerEntry>(); // idempotencyKey -> entry, for duplicate detection
  private nextId = 1;

  async upsertPageByTitle(title: string, body: string, idempotencyKey: string): Promise<{ page: DocsPage; duplicate: boolean }> {
    const dup = this.seenKeys.has(idempotencyKey);
    const existing = this.pagesByTitle.get(title);
    if (existing) {
      if (!dup) {
        existing.body = body;
        existing.version += 1;
        this.seenKeys.set(idempotencyKey, { title, idempotencyKey, version: existing.version, at: Date.now() });
      }
      return { page: existing, duplicate: dup };
    }
    const page: DocsPage = { id: `page-${this.nextId++}`, title, version: 1, body };
    this.pagesByTitle.set(title, page);
    this.seenKeys.set(idempotencyKey, { title, idempotencyKey, version: 1, at: Date.now() });
    return { page, duplicate: dup };
  }

  async getPageByTitle(title: string): Promise<DocsPage | null> {
    return this.pagesByTitle.get(title) ?? null;
  }

  allPages(): DocsPage[] {
    return [...this.pagesByTitle.values()];
  }
}
