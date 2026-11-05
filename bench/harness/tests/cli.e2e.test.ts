import { describe, it, expect, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-e2e-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

function bench(args: string[]) {
  const r = spawnSync('node', ['--import', 'tsx', 'src/cli.ts', ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, BENCH_DB: path.join(tmp, 'b.sqlite'), BENCH_ARTIFACTS: path.join(tmp, 'art') },
  });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

describe('bench cli end to end (real subprocess)', () => {
  it('run -> report -> export', () => {
    const run = bench(['run', '--contender', 'stub', '--ticket', 'T01', '--rep', '1', '--stages', 'triage..plan', '--seed-order', '1']);
    expect(run.code, run.err).toBe(0);
    expect(run.err).not.toMatch(/ExperimentalWarning/);

    expect(JSON.parse(bench(['report', '--format', 'json']).out)).toEqual([]);

    const rep = bench(['report', '--format', 'json', '--include-stub']);
    expect(rep.code, rep.err).toBe(0);
    const rows = JSON.parse(rep.out);
    expect(rows).toHaveLength(4);
    expect(rows.map((r: { stage: string }) => r.stage)).toEqual(['triage', 'route', 'design', 'plan']);

    const md = bench(['report', '--include-stub']);
    expect(md.out).toContain('| stub | triage | 1 | 1 | 1000 | 150 | 0 |');

    const outFile = path.join(tmp, 'out', 'e.jsonl');
    const ex = bench(['export', '--out', outFile]);
    expect(ex.code, ex.err).toBe(0);
    const lines = fs.readFileSync(outFile, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(4);
    expect(JSON.parse(lines[0]).contender).toBe('stub');
  });
});
