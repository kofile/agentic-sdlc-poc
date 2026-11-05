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

describe('executeRun', () => {
  it('stub run stores one run row and N stage rows, writes the artifact', async () => {
    const d = tmp();
    const store = openStore(path.join(d, 'b.sqlite'));
    const res = await executeRun({
      store, adapter: stubAdapter, ticket: 'T01', rep: 1, stages: parseStageRange('triage..plan'),
      seedOrder: 1, artifactsRoot: path.join(d, 'art'), now: () => new Date('2026-11-12T02:31:45Z'),
    });
    expect(res).toMatchObject({ run_id: '2026-11-12T0231Z-stub-T01-r1', status: 'completed', stored: 4 });
    const rows = store.listStageRuns({ run_id: res.run_id });
    expect(rows.map((r) => r.stage)).toEqual(['triage', 'route', 'design', 'plan']);
    expect(rows[0]).toMatchObject({ benchmark_version: 'v0.1', contender: 'stub', rep: 1, set: 'dev', ticket_id: 'T01' });
    expect(rows[0].telemetry_gaps.length).toBeGreaterThan(0);
    expect(store.listRuns()).toHaveLength(1);
    expect(store.listRuns()[0].status).toBe('completed');
    expect(fs.existsSync(path.join(d, 'art', res.run_id, 'stub.txt'))).toBe(true);
    store.close();
  });

  it('adapters cannot override harness-owned fields', async () => {
    const d = tmp();
    const store = openStore(':memory:');
    const sneaky: ContenderAdapter = {
      id: 'stub',
      version: async () => 'v',
      async *run() {
        yield { stage: 'triage', ...({ run_id: 'evil', rep: 99, benchmark_version: 'v9' } as object) };
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
        yield { stage: 'triage' };
        yield { stage: 'route', ...({ telemetry_gaps: undefined } as object) } as never;
        yield { stage: 'design' };
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

  it('registry knows only stub', () => {
    expect(getAdapter('stub')).toBe(stubAdapter);
    expect(getAdapter('P')).toBeUndefined();
    expect(getAdapter('toString')).toBeUndefined();
  });
});
