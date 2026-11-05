import { describe, it, expect } from 'vitest';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AnthropicReasoning } from '../../src/adapters/anthropic-reasoning.ts';
import { ReasoningOutputInvalid } from '../../src/ports/reasoning.ts';
import { STAGE_SCHEMAS } from '../../src/core/schemas.ts';

const PROMPTS = new URL('../../prompts', import.meta.url).pathname;
const fx = (n: string) => JSON.parse(readFileSync(new URL(`../fixtures/anthropic/${n}.json`, import.meta.url), 'utf8'));
const MODEL = 'claude-sonnet-5-5';

function fake(responses: unknown[]) {
  const calls: any[] = [];
  let i = 0;
  return {
    calls,
    client: { create: async (p: any) => { calls.push(p); const r = responses[i++]; if (r instanceof Error) throw r; return r; } },
  };
}
const adapter = (f: ReturnType<typeof fake>) => new AnthropicReasoning({ client: f.client, promptsDir: PROMPTS });
const req = (stage: keyof typeof STAGE_SCHEMAS, extra: object = {}) => ({
  stage, prompt: JSON.stringify({ ticket: { id: 'T-1' } }), schema: STAGE_SCHEMAS[stage] as any, modelRequested: MODEL, ...extra,
});

describe('AnthropicReasoning', () => {
  for (const stage of ['triage', 'route', 'design', 'plan'] as const) {
    it(`returns valid ${stage} output with reported usage and prompt version`, async () => {
      const f = fake([fx(`valid-${stage}`)]);
      const res = await adapter(f).call(req(stage));
      expect(STAGE_SCHEMAS[stage].safeParse(res.output).success).toBe(true);
      expect(res).toMatchObject({ attempts: 1, llm_calls: 1 });
      expect(res.usage).toMatchObject({ input_tokens: 410, output_tokens: 95, source: 'reported', model_served: MODEL });
      const want = createHash('sha256').update(readFileSync(join(PROMPTS, `${stage}.md`), 'utf8')).digest('hex').slice(0, 12);
      expect(res.prompt_version).toBe(want);
    });
  }

  it('sends the frozen request shape', async () => {
    const f = fake([fx('valid-triage')]);
    await adapter(f).call(req('triage'));
    const p = f.calls[0];
    expect(p).toMatchObject({ model: MODEL, max_tokens: 16000, output_config: { effort: 'high', format: { type: 'json_schema' } } });
    expect(p.system).toBe(readFileSync(join(PROMPTS, 'triage.md'), 'utf8'));
    expect(p.messages).toEqual([{ role: 'user', content: JSON.stringify({ ticket: { id: 'T-1' } }) }]);
    for (const k of ['tool_choice', 'thinking', 'temperature', 'top_p', 'top_k', 'fallbacks']) expect(p).not.toHaveProperty(k);
  });

  it('records the served model from the response, not the request', async () => {
    const res = await adapter(fake([fx('served-differs')])).call(req('triage'));
    expect(res.usage.model_requested).toBe(MODEL);
    expect(res.usage.model_served).toBe('claude-sonnet-5-5-20261001');
  });

  it('retries invalid JSON then succeeds, summing usage over attempts', async () => {
    const f = fake([fx('invalid-json'), fx('invalid-schema'), fx('valid-triage')]);
    const res = await adapter(f).call(req('triage'));
    expect(res).toMatchObject({ attempts: 3, llm_calls: 3 });
    expect(res.usage).toMatchObject({ input_tokens: 1230, output_tokens: 285 });
  });

  it('throws ReasoningOutputInvalid(schema_invalid) when every attempt is invalid', async () => {
    const f = fake([fx('invalid-json'), fx('invalid-json'), fx('invalid-schema')]);
    const err = await adapter(f).call(req('triage')).catch((e) => e);
    expect(err).toBeInstanceOf(ReasoningOutputInvalid);
    expect(err).toMatchObject({ stage: 'triage', kind: 'schema_invalid', attempts: 3 });
    expect(err.usage).toMatchObject({ input_tokens: 1230, output_tokens: 285, source: 'reported' });
    expect(f.calls).toHaveLength(3);
  });

  it('honours maxRetries', async () => {
    const f = fake([fx('invalid-json'), fx('valid-triage')]);
    const err = await adapter(f).call(req('triage', { maxRetries: 0 })).catch((e) => e);
    expect(err).toMatchObject({ kind: 'schema_invalid', attempts: 1 });
  });

  it('fails closed on refusal without retrying', async () => {
    const f = fake([fx('refusal'), fx('valid-triage')]);
    const err = await adapter(f).call(req('triage')).catch((e) => e);
    expect(err).toBeInstanceOf(ReasoningOutputInvalid);
    expect(err).toMatchObject({ kind: 'refusal', attempts: 1 });
    expect(f.calls).toHaveLength(1);
  });

  it('fails closed on max_tokens without retrying', async () => {
    const f = fake([fx('stop-max-output'), fx('valid-triage')]);
    const err = await adapter(f).call(req('triage')).catch((e) => e);
    expect(err).toMatchObject({ kind: 'max_tokens', attempts: 1 });
    expect(err.usage.output_tokens).toBe(16000);
    expect(f.calls).toHaveLength(1);
  });

  it('reports cache read and write tokens', async () => {
    const res = await adapter(fake([fx('cache-usage')])).call(req('triage'));
    expect(res.usage).toMatchObject({ input_tokens: 50, output_tokens: 95, cache_read_tokens: 1200, cache_write_tokens: 300 });
  });

  it('rethrows transport errors unchanged, not as invalid output', async () => {
    const boom = Object.assign(new Error('529 overloaded'), { status: 529 });
    const err = await adapter(fake([boom])).call(req('triage')).catch((e) => e);
    expect(err).toBe(boom);
    expect(err).not.toBeInstanceOf(ReasoningOutputInvalid);
  });

  describe('fromEnv', () => {
    it('names the env var when unset or unreadable, never a value', () => {
      expect(() => AnthropicReasoning.fromEnv({})).toThrow(/ANTHROPIC_API_KEY_FILE/);
      expect(() => AnthropicReasoning.fromEnv({ ANTHROPIC_API_KEY_FILE: '/nonexistent/x' })).toThrow(/ANTHROPIC_API_KEY_FILE/);
      try { AnthropicReasoning.fromEnv({ ANTHROPIC_API_KEY_FILE: '/nonexistent/x' }); } catch (e) {
        expect(String((e as Error).message)).not.toContain('/nonexistent/x');
      }
    });
    it('rejects an empty key file without echoing contents', () => {
      const p = join(mkdtempSync(join(tmpdir(), 'k-')), 'key');
      writeFileSync(p, '  \n');
      expect(() => AnthropicReasoning.fromEnv({ ANTHROPIC_API_KEY_FILE: p })).toThrow(/ANTHROPIC_API_KEY_FILE/);
    });
    it('constructs from a non-empty key file', () => {
      const p = join(mkdtempSync(join(tmpdir(), 'k-')), 'key');
      writeFileSync(p, 'placeholder-not-a-real-credential\n');
      expect(AnthropicReasoning.fromEnv({ ANTHROPIC_API_KEY_FILE: p })).toBeInstanceOf(AnthropicReasoning);
    });
  });
});
