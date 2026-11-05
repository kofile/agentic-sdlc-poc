import { describe, it, expect } from 'vitest';
import { openStore } from '../src/store.ts';
import { buildReport, renderMarkdown, renderReport } from '../src/report.ts';
import { exportJsonl } from '../src/export.ts';
import { SECTION7_EXAMPLE } from './fixtures.ts';

function rec(over: Record<string, unknown>) {
  return { ...SECTION7_EXAMPLE, ...over };
}
function seed() {
  const store = openStore(':memory:');
  const t = (input: number, cache: number) => ({ input, output: 10, cache_read: cache, cache_write: 1, source: 'reported' });
  store.insertStageRun(rec({ run_id: 'a', contender: 'P', stage: 'triage', wall_ms: 100, tokens: t(5, 2), cost_usd: { tokens: 0.5, compute: 0.25, orchestration: 0.25 }, telemetry_gaps: ['g1'] }));
  store.insertStageRun(rec({ run_id: 'b', contender: 'P', stage: 'triage', wall_ms: 300, status: 'failed', tokens: t(1, 0), cost_usd: { tokens: 1, compute: 0, orchestration: 0 }, telemetry_gaps: ['g2', 'g1'] }));
  store.insertStageRun(rec({ run_id: 'c', contender: 'P', stage: 'triage', wall_ms: 200, tokens: t(0, 0), telemetry_gaps: [] }));
  store.insertStageRun(rec({ run_id: 'a', contender: 'P', stage: 'route', wall_ms: 7, telemetry_gaps: [] }));
  store.insertStageRun(rec({ run_id: 's', contender: 'stub', stage: 'triage', wall_ms: 1, telemetry_gaps: ['stubgap'] }));
  return store;
}

describe('report', () => {
  it('aggregates per contender x stage', () => {
    const store = seed();
    const rows = buildReport(store);
    expect(rows.map((r) => `${r.contender}/${r.stage}`)).toEqual(['P/triage', 'P/route']);
    const tri = rows[0];
    expect(tri).toMatchObject({ runs: 3, completed: 2, median_wall_ms: 200, total_tokens: (5 + 10 + 2 + 1) + (1 + 10 + 0 + 1) + (0 + 10 + 0 + 1), total_cost_usd: 2 });
    expect(tri.telemetry_gaps).toEqual(['g1', 'g2']);
    store.close();
  });

  it('median of an even count is the mean of the middle two', () => {
    const store = openStore(':memory:');
    store.insertStageRun(rec({ run_id: 'x', wall_ms: 10 }));
    store.insertStageRun(rec({ run_id: 'y', wall_ms: 30 }));
    expect(buildReport(store)[0].median_wall_ms).toBe(20);
    store.close();
  });

  it('excludes stub unless includeStub', () => {
    const store = seed();
    expect(buildReport(store).some((r) => r.contender === 'stub')).toBe(false);
    const withStub = buildReport(store, { includeStub: true });
    expect(withStub.find((r) => r.contender === 'stub')).toMatchObject({ runs: 1, telemetry_gaps: ['stubgap'] });
    store.close();
  });

  it('renders md and json', () => {
    const store = seed();
    const rows = buildReport(store);
    const md = renderReport(rows, 'md');
    expect(md).toContain('| P | triage | 3 | 2 | 200 |');
    expect(md).toContain('g1, g2');
    expect(md).toContain('(none)');
    expect(JSON.parse(renderReport(rows, 'json'))).toEqual(rows);
    expect(renderMarkdown([])).toContain('| contender |');
    store.close();
  });

  it('export is one JSON record per stored row', () => {
    const store = seed();
    const lines = exportJsonl(store);
    expect(lines).toHaveLength(5);
    expect(JSON.parse(lines[0]).run_id).toBe('a');
    store.close();
  });
  it('a gate with no correct (unscored) is stored and reported without being treated as false', () => {
    const store = openStore(':memory:');
    store.insertStageRun(rec({ run_id: 'u', contender: 'G', stage: 'triage', gate: { name: 'A or B?', decision: 'pass' }, telemetry_gaps: [] }));
    const rows = buildReport(store);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ contender: 'G', stage: 'triage', runs: 1, completed: 1 });
    expect(store.listStageRuns()[0].gate).toEqual({ name: 'A or B?', decision: 'pass' });
    store.close();
  });
});
