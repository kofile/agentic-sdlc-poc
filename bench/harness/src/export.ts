// JSONL export: one stored stage-run record per line, from the SQLite store only.
import type { Store } from './store.ts';

export function exportJsonl(store: Pick<Store, 'listStageRuns'>): string[] {
  return store.listStageRuns().map((r) => JSON.stringify(r));
}
