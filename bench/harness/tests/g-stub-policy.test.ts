import { describe, it, expect } from 'vitest';
import { checkStubPolicy, ensureNoRealModelGap } from '../src/adapters/g/stub-policy.ts';

describe('checkStubPolicy', () => {
  it('refuses unset and non-anthropic reasoning without opt-in, naming both vars', () => {
    for (const env of [{}, { GRAPH_REASONING: 'stub' }, { GRAPH_REASONING: 'stub', BENCH_G_ALLOW_STUB: '0' }]) {
      const m = checkStubPolicy(env);
      expect(m).toMatch(/^G: /);
      expect(m).toContain('GRAPH_REASONING');
      expect(m).toContain('BENCH_G_ALLOW_STUB');
      expect(m).not.toContain('\n');
    }
    expect(checkStubPolicy({})).toContain('unset');
  });
  it('allows anthropic, or stub with BENCH_G_ALLOW_STUB=1', () => {
    expect(checkStubPolicy({ GRAPH_REASONING: 'anthropic' })).toBeUndefined();
    expect(checkStubPolicy({ GRAPH_REASONING: 'stub', BENCH_G_ALLOW_STUB: '1' })).toBeUndefined();
    expect(checkStubPolicy({ BENCH_G_ALLOW_STUB: '1' })).toBeUndefined();
  });
});

describe('ensureNoRealModelGap', () => {
  it('adds the gap to stub-served events, deduplicated, leaving real ones alone', () => {
    const evs = ensureNoRealModelGap([
      { model_served: 'stub', telemetry_gaps: ['cost_not_measured'] },
      { model_served: 'stub', telemetry_gaps: ['no_real_model'] },
      { model_served: 'stub' },
      { model_served: 'claude-sonnet-5-5', telemetry_gaps: [] },
      {},
    ]);
    expect(evs[0].telemetry_gaps).toEqual(['cost_not_measured', 'no_real_model']);
    expect(evs[1].telemetry_gaps).toEqual(['no_real_model']);
    expect(evs[2].telemetry_gaps).toEqual(['no_real_model']);
    expect(evs[3].telemetry_gaps).toEqual([]);
    expect(evs[4].telemetry_gaps).toBeUndefined();
  });
});
