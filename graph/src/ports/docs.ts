// Docs port: Confluence-shaped. One page per ticket per artifact, upserted by exact title
// (the two rules from CLAUDE.md's sdlc-pipeline-plugin section: one page per ticket per
// artifact, title uses an em dash not a hyphen — enforced by the caller, this port just upserts).
export interface DocsPage {
  id: string;
  title: string;
  version: number;
  body: string;
}

export interface Docs {
  /** Upsert by exact title: creates on first call, bumps version on re-run. Never a second page. */
  upsertPageByTitle(title: string, body: string, idempotencyKey: string): Promise<{ page: DocsPage; duplicate: boolean }>;
  getPageByTitle(title: string): Promise<DocsPage | null>;
}
