import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openStore } from '../src/store.ts';
import { executeRun } from '../src/core/run.ts';
import { stubAdapter } from '../src/adapters/stub.ts';
import { getAdapter } from '../src/adapters/registry.ts';
import type { ContenderAdapter } from '../src/adapters/types.ts';
import { parseStageRange } from '../src/record.ts';

const dirs: string[] = [];
function tmp(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-run-'));
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe('R3a no silent zeros', () => {
  const adapterOf = (ev: object): ContenderAdapter => ({
    id: 'stub',
    version: async () => 'v',
    async *run() {
      yield { stage: 'triage', ...ev } as never;
    },
  });

  it('an event without telemetry_gaps fails validation and stores nothing', async () => {
    const store = openStore(':memory:');
    const res = await executeRun({ store, adapter: adapterOf({}), ticket: 'T01', rep: 1, stages: ['triage'], seedOrder: 1, artifactsRoot: tmp() });
    expect(res.status).toBe('failed');
    expect(res.error).toMatch(/telemetry_gaps/);
    expect(store.listStageRuns()).toHaveLength(0);
    store.close();
  });

  it('every defaulted measurement field is named in telemetry_gaps', async () => {
    const store = openStore(':memory:');
    const res = await executeRun({ store, adapter: adapterOf({ telemetry_gaps: ['mine'] }), ticket: 'T01', rep: 1, stages: ['triage'], seedOrder: 1, artifactsRoot: tmp() });
    expect(res.status).toBe('completed');
    const [rec] = store.listStageRuns();
    const expected = [
      'started_at', 'ended_at', 'wall_ms', 'active_ms', 'waiting_ms', 'cold_start_ms', 'llm_calls', 'tool_calls', 'model_served',
      'tokens.input', 'tokens.output', 'tokens.cache_read', 'tokens.cache_write',
      'cost_usd.tokens', 'cost_usd.compute', 'cost_usd.orchestration',
    ].map((f) => `defaulted:${f}`);
    expect(rec.telemetry_gaps).toEqual(['mine', ...expected]);
    store.close();
  });

  it('supplied fields are not marked defaulted (zero is a real value)', async () => {
    const store = openStore(':memory:');
    await executeRun({
      store, ticket: 'T01', rep: 1, stages: ['triage'], seedOrder: 1, artifactsRoot: tmp(),
      adapter: adapterOf({ telemetry_gaps: [], wall_ms: 0, model_served: 'm', tokens: { input: 0, output: 0, cache_read: 0, cache_write: 0, source: 'reported' } }),
    });
    const gaps = store.listStageRuns()[0].telemetry_gaps;
    expect(gaps).not.toContain('defaulted:wall_ms');
    expect(gaps).not.toContain('defaulted:model_served');
    expect(gaps.filter((g) => g.startsWith('defaulted:tokens'))).toEqual([]);
    expect(gaps).toContain('defaulted:cost_usd.tokens');
    store.close();
  });

  it('the stub supplies telemetry_gaps and defaults nothing', async () => {
    const store = openStore(':memory:');
    await executeRun({ store, adapter: stubAdapter, ticket: 'T01', rep: 1, stages: ['triage'], seedOrder: 1, artifactsRoot: tmp() });
    expect(store.listStageRuns()[0].telemetry_gaps.some((g) => g.startsWith('defaulted:'))).toBe(false);
    store.close();
  });
});

describe('executeRun', () => {
  it('stub run stores one run row and N stage rows, writes the artifact', async () => {
    const d = tmp();
    const store = openStore(path.join(d, 'b.sqlite'));
    const res = await executeRun({
      store, adapter: stubAdapter, ticket: 'T01', rep: 1, stages: parseStageRange('triage..plan'),
      seedOrder: 1, artifactsRoot: path.join(d, 'art'), now: () => new Date('2026-11-12T02:31:45Z'),
    });
    expect(res).toMatchObject({ run_id: '2026-11-12T023145Z-stub-T01-r1', status: 'completed', stored: 4 });
    const rows = store.listStageRuns({ run_id: res.run_id });
    expect(rows.map((r) => r.stage)).toEqual(['triage', 'route', 'design', 'plan']);
    expect(rows[0]).toMatchObject({ benchmark_version: 'v0.1', contender: 'stub', rep: 1, set: 'dev', ticket_id: 'T01' });
    expect(rows[0].telemetry_gaps.length).toBeGreaterThan(0);
    expect(store.listRuns()).toHaveLength(1);
    expect(store.listRuns()[0].status).toBe('completed');
    expect(fs.existsSync(path.join(d, 'art', res.run_id, 'stub.txt'))).toBe(true);
    store.close();
  });

  it('two runs in the same second get distinct run ids and their own artifact dirs', async () => {
    const d = tmp();
    const store = openStore(':memory:');
    const same = () => new Date('2026-11-12T02:31:45Z');
    const args = { store, adapter: stubAdapter, ticket: 'T01', rep: 1, stages: parseStageRange('triage..plan'), seedOrder: 1, artifactsRoot: path.join(d, 'art'), now: same };
    const first = await executeRun(args);
    const second = await executeRun(args);
    expect(first).toMatchObject({ run_id: '2026-11-12T023145Z-stub-T01-r1', status: 'completed', stored: 4 });
    expect(second).toMatchObject({ run_id: '2026-11-12T023145Z-stub-T01-r1-2', status: 'completed', stored: 4 });
    expect(store.listRuns().map((r) => r.run_id).sort()).toEqual([first.run_id, second.run_id].sort());
    expect(store.listStageRuns({ run_id: second.run_id })).toHaveLength(4);
    expect(store.listStageRuns({ run_id: first.run_id })).toHaveLength(4);
    const dirs2 = store.listRuns().map((r) => r.artifact_dir).sort();
    expect(dirs2).toEqual([path.join(d, 'art', first.run_id), path.join(d, 'art', second.run_id)].sort());
    for (const dir of dirs2) expect(fs.existsSync(path.join(dir, 'stub.txt'))).toBe(true);
    store.close();
  });

  it('a non-collision insert error is rethrown, not retried', async () => {
    const store = openStore(':memory:');
    const failing = Object.assign(Object.create(store), {
      insertRun: () => {
        throw new Error('disk I/O error');
      },
    });
    await expect(
      executeRun({ store: failing, adapter: stubAdapter, ticket: 'T01', rep: 1, stages: ['triage'], seedOrder: 1, artifactsRoot: tmp(), now: () => new Date('2026-11-12T02:31:45Z') }),
    ).rejects.toThrow('disk I/O error');
    store.close();
  });

  it('adapters cannot override harness-owned fields', async () => {
    const d = tmp();
    const store = openStore(':memory:');
    const sneaky: ContenderAdapter = {
      id: 'stub',
      version: async () => 'v',
      async *run() {
        yield { stage: 'triage', telemetry_gaps: [], ...({ run_id: 'evil', rep: 99, benchmark_version: 'v9' } as object) };
      },
    };
    const res = await executeRun({ store, adapter: sneaky, ticket: 'T02', rep: 3, stages: ['triage'], seedOrder: 1, artifactsRoot: d });
    const [rec] = store.listStageRuns();
    expect(rec).toMatchObject({ run_id: res.run_id, rep: 3, benchmark_version: 'v0.1' });
    store.close();
  });

  it('an invalid record fails the run and is never stored', async () => {
    const d = tmp();
    const store = openStore(':memory:');
    const bad: ContenderAdapter = {
      id: 'stub',
      version: async () => 'v',
      async *run() {
        yield { stage: 'triage', telemetry_gaps: [] };
        yield { stage: 'route', ...({ telemetry_gaps: undefined } as object) } as never;
        yield { stage: 'design', telemetry_gaps: [] };
      },
    };
    const res = await executeRun({ store, adapter: bad, ticket: 'T01', rep: 1, stages: ['triage', 'route', 'design'], seedOrder: 1, artifactsRoot: d });
    expect(res.status).toBe('failed');
    expect(res.error).toMatch(/invalid stage record/);
    expect(res.error).toMatch(/telemetry_gaps/);
    expect(store.listStageRuns().map((r) => r.stage)).toEqual(['triage']);
    expect(store.listRuns()[0].status).toBe('failed');
    store.close();
  });

  it('an adapter that throws fails the run', async () => {
    const store = openStore(':memory:');
    const boom: ContenderAdapter = {
      id: 'stub',
      version: async () => 'v',
      // eslint-disable-next-line require-yield
      async *run() {
        throw new Error('boom');
      },
    };
    const res = await executeRun({ store, adapter: boom, ticket: 'T01', rep: 1, stages: ['triage'], seedOrder: 1, artifactsRoot: tmp() });
    expect(res).toMatchObject({ status: 'failed', error: 'boom', stored: 0 });
    store.close();
  });

  it('intervention events are written to the interventions table and are not stage records', async () => {
    const store = openStore(':memory:');
    const adapter: ContenderAdapter = {
      id: 'stub',
      version: async () => 'v',
      async *run() {
        yield { type: 'intervention', stage: 'design', at: '2026-11-05T12:00:00.000Z', kind: 'scripted_approval', note: 'design#1 team=default' };
        yield { stage: 'design', telemetry_gaps: [] };
      },
    };
    const res = await executeRun({ store, adapter, ticket: 'T01', rep: 1, stages: ['design'], seedOrder: 1, artifactsRoot: tmp() });
    expect(res).toMatchObject({ status: 'completed', stored: 1 });
    expect(store.listStageRuns()).toHaveLength(1);
    expect(store.listStageRuns()[0]).toMatchObject({ interventions: 0, assisted: false });
    expect(store.listInterventions(res.run_id)).toMatchObject([{ stage: 'design', kind: 'scripted_approval', note: 'design#1 team=default', at: '2026-11-05T12:00:00.000Z' }]);
    store.close();
  });

  it('registry knows only stub', () => {
    expect(getAdapter('stub')).toBe(stubAdapter);
    expect(getAdapter('P')).toBeUndefined();
    expect(getAdapter('toString')).toBeUndefined();
  });
});
