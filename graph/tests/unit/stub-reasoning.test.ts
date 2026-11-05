import { describe, it, expect } from 'vitest';
import { StubReasoning } from '../../src/adapters/stub-reasoning.ts';
import { TriageOutputSchema } from '../../src/core/schemas.ts';

describe('StubReasoning', () => {
  it('returns schema-valid output on the first attempt by default', async () => {
    const r = new StubReasoning();
    const res = await r.call({
      stage: 'triage', prompt: JSON.stringify({ ticket: { id: 'T1', title: 'x', description: 'y', labels: [] } }),
      schema: TriageOutputSchema, modelRequested: 'claude-sonnet-5', idempotencyKey: 'k1',
    });
    expect(res.attempts).toBe(1);
    expect(TriageOutputSchema.safeParse(res.output).success).toBe(true);
  });

  it('retries on induced schema failure up to the bound, then succeeds', async () => {
    const r = new StubReasoning();
    const res = await r.call({
      stage: 'triage', prompt: JSON.stringify({ ticket: { id: 'T2', title: 'x', description: 'y', labels: [] }, knobs: {} }),
      schema: TriageOutputSchema, modelRequested: 'claude-sonnet-5', idempotencyKey: 'k2',
      maxRetries: 3,
      // @ts-expect-error -- knobs is a test-only extension read via `(req as any).knobs`
      knobs: { failSchemaNTimes: 2 },
    });
    expect(res.attempts).toBe(3);
  });

  it('throws after exhausting the retry bound', async () => {
    const r = new StubReasoning();
    await expect(
      r.call({
        stage: 'triage', prompt: JSON.stringify({ ticket: { id: 'T3', title: 'x', description: 'y', labels: [] } }),
        schema: TriageOutputSchema, modelRequested: 'claude-sonnet-5', idempotencyKey: 'k3',
        maxRetries: 1,
        // @ts-expect-error -- test-only knob
        knobs: { failSchemaNTimes: 5 },
      }),
    ).rejects.toThrow();
  });
});
