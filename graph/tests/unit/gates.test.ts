import { describe, it, expect } from 'vitest';
import { triageGate, routeGate, modeFor, GatePolicySchema } from '../../src/core/gates.ts';

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
