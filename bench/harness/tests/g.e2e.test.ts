// Opt-in end-to-end test (spec 006 R8): needs a real Temporal, `npm ci` in graph/, and the
// execute-host image. Run with `npm run test:g` (sets BENCH_G_E2E=1). Skipped by default.
import { describe, it, expect, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openStore } from '../src/store.ts';

const enabled = process.env.BENCH_G_E2E === '1';
const root = path.resolve(import.meta.dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-g-e2e-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe.skipIf(!enabled)('bench run --contender G (real Temporal)', () => {
  it('T01, team default, stub reasoning: six records, one scripted approval for design', () => {
    const db = path.join(tmp, 'g.sqlite');
    const r = spawnSync('node', ['--import', 'tsx', 'src/cli.ts', 'run', '--contender', 'G', '--ticket', 'T01', '--rep', '1', '--stages', 'triage..open_pr', '--seed-order', '1'], {
      cwd: root,
      encoding: 'utf8',
      timeout: 240_000,
      env: { ...process.env, BENCH_DB: db, BENCH_ARTIFACTS: path.join(tmp, 'art'), BENCH_G_TEAM: 'default', GRAPH_REASONING: 'stub', BENCH_G_ALLOW_STUB: '1' },
    });
    expect(r.status, r.stderr).toBe(0);
    const store = openStore(db);
    try {
      const recs = store.listStageRuns({ contender: 'G' });
      expect(recs).toHaveLength(6);
      const modelStages = recs.filter((x) => ['triage', 'route', 'design', 'plan'].includes(x.stage));
      expect(modelStages).toHaveLength(4);
      for (const x of modelStages) {
        expect(x.model_served).toBe('stub');
        expect(x.cost_usd.tokens).toBe(0);
        expect(x.telemetry_gaps).toContain('no_real_model');
      }
      const ints = store.listInterventions();
      const approvals = ints.filter((i) => i.kind === 'scripted_approval');
      expect(approvals).toHaveLength(1);
      expect(approvals[0].stage).toBe('design');
      expect(recs.filter((x) => x.interventions > 0)).toHaveLength(0);
    } finally {
      store.close();
    }
  }, 300_000);
});
