import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openStore, type RunRow } from '../src/store.ts';
import { SECTION7_EXAMPLE } from './fixtures.ts';

const dirs: string[] = [];
function tmpDb(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-store-'));
  dirs.push(d);
  return path.join(d, 'bench.sqlite');
}
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

const run: RunRow = {
  run_id: SECTION7_EXAMPLE.run_id,
  contender: 'P',
  contender_version: 'plugin 0.12.x',
  ticket_id: 'T07',
  rep: 2,
  set_name: 'heldout',
  stages: 'triage',
  seed_order: 1,
  started_at: '2026-11-12T02:31:00Z',
  ended_at: null,
  status: 'running',
  artifact_dir: null,
};

describe('store', () => {
  it('round-trips a run and a stage record', () => {
    const s = openStore(tmpDb());
    s.insertRun(run);
    s.insertStageRun(SECTION7_EXAMPLE);
    s.finishRun(run.run_id, 'completed', '2026-11-12T02:32:00Z');
    expect(s.listRuns()).toEqual([{ ...run, status: 'completed', ended_at: '2026-11-12T02:32:00Z' }]);
    expect(s.listStageRuns()).toEqual([SECTION7_EXAMPLE]);
    expect(s.listStageRuns({ stage: 'plan' })).toEqual([]);
    s.close();
  });

  it('creates the schema idempotently and keeps data across reopen', () => {
    const p = tmpDb();
    const a = openStore(p);
    a.insertRun(run);
    a.close();
    const b = openStore(p);
    expect(b.listRuns()).toHaveLength(1);
    b.close();
  });

  it('has the four tables', () => {
    const p = tmpDb();
    const s = openStore(p);
    s.close();
    const { DatabaseSync } = process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite');
    const db = new DatabaseSync(p);
    const names = (db.prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).all() as { name: string }[])
      .map((r) => r.name)
      .filter((n) => !n.startsWith('sqlite_'));
    expect(names).toEqual(['interventions', 'runs', 'scores', 'stage_runs']);
    db.close();
  });

  it('never stores an invalid record', () => {
    const s = openStore(tmpDb());
    const { telemetry_gaps: _t, ...bad } = SECTION7_EXAMPLE;
    expect(() => s.insertStageRun(bad)).toThrow();
    expect(s.listStageRuns()).toEqual([]);
    s.close();
  });

  it('inserts and lists interventions', () => {
    const s = openStore(tmpDb());
    const id = s.insertIntervention({ run_id: run.run_id, stage: 'plan', at: '2026-11-12T02:31:30Z', kind: 'manual_nudge', note: 'n' });
    expect(id).toBe(1);
    expect(s.listInterventions(run.run_id)).toEqual([
      { id: 1, run_id: run.run_id, stage: 'plan', at: '2026-11-12T02:31:30Z', kind: 'manual_nudge', note: 'n' },
    ]);
    s.close();
  });
});

