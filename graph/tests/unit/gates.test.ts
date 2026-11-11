import { describe, it, expect } from 'vitest';
import { triageGate, routeGate, planPathGate, modeFor, GatePolicySchema } from '../../src/core/gates.ts';

describe('triageGate', () => {
  it('passes A and B', () => {
    expect(triageGate('A').pass).toBe(true);
    expect(triageGate('B').pass).toBe(true);
  });
  it('stops C and D with a reason', () => {
    expect(triageGate('C').pass).toBe(false);
    expect(triageGate('C').reason).toMatch(/grade C/);
    expect(triageGate('D').pass).toBe(false);
  });
});

describe('routeGate', () => {
  it('fails on zero repos', () => {
    expect(routeGate({ repos: [], order: [] }).pass).toBe(false);
  });
  it('fails when order references an unrouted repo', () => {
    const r = routeGate({ repos: [{ name: 'a' }], order: ['a', 'b'] });
    expect(r.pass).toBe(false);
    expect(r.reason).toMatch(/b/);
  });
  it('passes a consistent route', () => {
    expect(routeGate({ repos: [{ name: 'a' }], order: ['a'] }).pass).toBe(true);
  });
});

describe('modeFor', () => {
  const policy = GatePolicySchema.parse({ team: 'x', gates: { design: 'human', merge: 'auto' }, humanTimeoutSec: 60 });
  it('reads human/auto from policy, defaulting unknown gates to auto', () => {
    expect(modeFor(policy, 'design')).toBe('human');
    expect(modeFor(policy, 'merge')).toBe('auto');
    expect(modeFor(policy, 'unknown-gate')).toBe('auto');
  });
});

describe('GatePolicySchema defaults', () => {
  it('defaults onTimeout and maxRejectRounds', () => {
    const p = GatePolicySchema.parse({ team: 'x', gates: {}, humanTimeoutSec: 60 });
    expect(p.onTimeout).toBe('auto-reject');
    expect(p.maxRejectRounds).toBe(3);
  });
});

describe('planPathGate', () => {
  const tree = ['src/a.ts', 'src/b.ts'];
  const t = (files: string[], new_files: string[] = []) => ({ tasks: [{ id: 'T1', files, new_files }] });
  it('passes when every file exists (single repo)', () => {
    expect(planPathGate(t(['src/a.ts']), { app: tree }).pass).toBe(true);
  });
  it('fails a files path missing from the tree', () => {
    const r = planPathGate(t(['src/zzz.ts']), { app: tree });
    expect(r.pass).toBe(false);
    expect(r.reason).toContain('src/zzz.ts');
  });
  it('passes a missing path listed in new_files', () => {
    expect(planPathGate(t(['src/zzz.ts'], ['src/zzz.ts']), { app: tree }).pass).toBe(true);
  });
  it('fails a new_files path that already exists', () => {
    const r = planPathGate(t(['src/a.ts'], ['src/a.ts']), { app: tree });
    expect(r.pass).toBe(false);
    expect(r.reason).toContain('already exists');
  });
  it('multi-repo: prefixed paths resolve per repo', () => {
    const trees = { api: ['x.ts'], web: ['y.ts'] };
    expect(planPathGate(t(['api/x.ts', 'web/y.ts']), trees).pass).toBe(true);
    expect(planPathGate(t(['x.ts']), trees).pass).toBe(false);
    expect(planPathGate(t(['db/x.ts']), trees).reason).toContain('unrouted repo');
    expect(planPathGate(t(['api/new.ts'], ['api/new.ts']), trees).pass).toBe(true);
  });
  it('fails closed on a null tree', () => {
    const r = planPathGate(t(['src/a.ts']), { app: null });
    expect(r.pass).toBe(false);
    expect(r.reason).toContain('checkout unavailable');
  });
  it('lists at most 10 offending paths', () => {
    const files = Array.from({ length: 15 }, (_, i) => `src/m${i}.ts`);
    const r = planPathGate(t(files), { app: tree });
    expect(r.reason).toContain('src/m9.ts');
    expect(r.reason).not.toContain('src/m10.ts');
  });
});
