import { describe, it, expect } from 'vitest';
import { StubReasoning } from '../../src/adapters/stub-reasoning.ts';
import { TriageOutputSchema } from '../../src/core/schemas.ts';
import { NO_MODEL_SERVED, ReasoningOutputInvalid } from '../../src/ports/reasoning.ts';

describe('StubReasoning', () => {
  it('returns schema-valid output on the first attempt by default', async () => {
    const r = new StubReasoning();
    const res = await r.call({
      stage: 'triage', prompt: JSON.stringify({ ticket: { id: 'T1', title: 'x', description: 'y', labels: [] } }),
      schema: TriageOutputSchema, modelRequested: 'claude-sonnet-5', idempotencyKey: 'k1',
    });
    expect(res.attempts).toBe(1);
    expect(res.usage).toMatchObject({ cache_read_tokens: 0, cache_write_tokens: 0, source: 'estimated' });
    expect(TriageOutputSchema.safeParse(res.output).success).toBe(true);
    expect(NO_MODEL_SERVED).toBe('stub');
    expect(res.usage.model_served).toBe('stub');
    expect(res.usage.model_requested).toBe('claude-sonnet-5');
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

  it('throws ReasoningOutputInvalid after exhausting the retry bound', async () => {
    const r = new StubReasoning();
    const err = await r
      .call({
        stage: 'triage', prompt: JSON.stringify({ ticket: { id: 'T3', title: 'x', description: 'y', labels: [] } }),
        schema: TriageOutputSchema, modelRequested: 'claude-sonnet-5', idempotencyKey: 'k3',
        maxRetries: 1,
        // @ts-expect-error -- test-only knob
        knobs: { failSchemaNTimes: 5 },
      })
      .catch((e) => e);
    expect(err).toBeInstanceOf(ReasoningOutputInvalid);
    expect(err).toMatchObject({ stage: 'triage', kind: 'schema_invalid', attempts: 2 });
    expect(err.usage.source).toBe('estimated');
    expect(err.usage.model_served).toBe('stub');
    expect(err.usage.model_requested).toBe('claude-sonnet-5');
  });
});

describe('StubReasoning plan paths', () => {
  const plan = async (knobs?: object) => {
    const { PlanOutputSchema } = await import('../../src/core/schemas.ts');
    const r = new StubReasoning();
    return r.call({
      stage: 'plan', prompt: JSON.stringify({ ticket: { id: 'T9', title: 'x', description: 'y', labels: [] } }),
      schema: PlanOutputSchema, modelRequested: 'claude-sonnet-5', idempotencyKey: 'kp',
      // @ts-expect-error -- test-only knob
      knobs,
    });
  };
  it('defaults to an existing fixture path plus a new file', async () => {
    const res = await plan();
    expect(res.output.tasks[0]).toMatchObject({ files: ['src/index.ts'], new_files: ['src/health.ts'] });
  });
  it('forcePlanFiles overrides the touched files', async () => {
    const res = await plan({ forcePlanFiles: ['src/missing.ts'] });
    expect(res.output.tasks[0].files).toEqual(['src/missing.ts']);
  });
});
