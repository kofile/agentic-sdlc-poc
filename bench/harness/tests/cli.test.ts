import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { main } from '../src/cli.ts';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

async function bench(args: string[]) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-cli-'));
  dirs.push(d);
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(args, { BENCH_DB: path.join(d, 'b.sqlite'), BENCH_ARTIFACTS: path.join(d, 'art') }, { out: (s) => out.push(s), err: (s) => err.push(s) });
  return { code, out, err, d };
}
const ok = ['run', '--contender', 'stub', '--ticket', 'T01', '--rep', '1', '--stages', 'triage..plan', '--seed-order', '1'];
const without = (flag: string) => {
  const i = ok.indexOf(flag);
  return [...ok.slice(0, i), ...ok.slice(i + 2)];
};
const swap = (flag: string, v: string) => ok.map((a, i) => (ok[i - 1] === flag ? v : a));

describe('bench run argument errors', () => {
  const cases: [string, string[], RegExp][] = [
    ['unknown contender', swap('--contender', 'zzz'), /unknown contender "zzz"/],
    ['missing contender', without('--contender'), /missing --contender/],
    ['missing ticket', without('--ticket'), /missing --ticket/],
    ['malformed ticket', swap('--ticket', 'X1'), /malformed ticket/],
    ['missing rep', without('--rep'), /missing --rep/],
    ['malformed rep', swap('--rep', 'abc'), /malformed rep/],
    ['malformed stage range', swap('--stages', 'triage-plan'), /malformed stage range/],
    ['backwards stage range', swap('--stages', 'plan..triage'), /backwards/],
    ['unknown stage', swap('--stages', 'triage..nope'), /unknown stage/],
    ['bad set', [...ok, '--set', 'prod'], /invalid --set/],
    ['unknown flag', [...ok, '--bogus', '1'], /bogus/],
  ];
  for (const [name, args, re] of cases) {
    it(name, async () => {
      const r = await bench(args);
      expect(r.code).toBe(1);
      expect(r.err).toHaveLength(1);
      expect(r.err[0]).toMatch(re);
      expect(r.err[0]).not.toContain('\n');
    });
  }
});

describe('bench cli', () => {
  it('run --contender stub succeeds', async () => {
    const r = await bench(ok);
    expect(r.code).toBe(0);
    expect(r.out[0]).toMatch(/stub-T01-r1 completed \(4 stage records\)/);
  });
  it('export without --out and report with bad --format are one-line errors', async () => {
    const e = await bench(['export']);
    expect(e.code).toBe(1);
    expect(e.err[0]).toMatch(/missing --out/);
    const r = await bench(['report', '--format', 'xml']);
    expect(r.code).toBe(1);
    expect(r.err[0]).toMatch(/invalid --format "xml"/);
  });
});
