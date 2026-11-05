// Real Reasoning adapter: Anthropic Messages API via @anthropic-ai/sdk, structured outputs
// (output_config.format json_schema), zod re-validation, bound retries, fail-closed.
// No tool_choice, thinking, sampling params or fallbacks: the config is frozen with the code.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import {
  ReasoningOutputInvalid,
  type Reasoning, type ReasoningCallResult, type ReasoningRequest, type ReasoningUsage,
} from '../ports/reasoning.ts';
import { STAGE_JSON_SCHEMAS } from './anthropic-schemas.ts';

export type CreateFn = Anthropic['messages']['create'];
export interface AnthropicReasoningOptions {
  client: { create: (params: any) => Promise<any> } | Pick<Anthropic['messages'], 'create'>;
  promptsDir: string;
}

const DEFAULT_PROMPTS_DIR = new URL('../../prompts', import.meta.url).pathname;

export class AnthropicReasoning implements Reasoning {
  private readonly client: { create: (params: any) => Promise<any> };
  private readonly promptsDir: string;

  constructor(opts: AnthropicReasoningOptions) {
    this.client = opts.client as { create: (params: any) => Promise<any> };
    this.promptsDir = opts.promptsDir;
  }

  /** Builds the adapter from ANTHROPIC_API_KEY_FILE. Error messages name the env var only. */
  static fromEnv(env: NodeJS.ProcessEnv = process.env, promptsDir: string = DEFAULT_PROMPTS_DIR): AnthropicReasoning {
    const file = env.ANTHROPIC_API_KEY_FILE;
    if (!file) throw new Error('GRAPH_REASONING=anthropic requires ANTHROPIC_API_KEY_FILE to be set');
    let apiKey: string;
    try {
      apiKey = readFileSync(file, 'utf8').trim();
    } catch {
      throw new Error('ANTHROPIC_API_KEY_FILE does not point to a readable file');
    }
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY_FILE points to an empty file');
    return new AnthropicReasoning({ client: new Anthropic({ apiKey }).messages, promptsDir });
  }

  async call<T>(req: ReasoningRequest<T>): Promise<ReasoningCallResult<T>> {
    const jsonSchema = (STAGE_JSON_SCHEMAS as Record<string, Record<string, unknown>>)[req.stage];
    if (!jsonSchema) throw new Error(`anthropic-reasoning: unknown stage ${req.stage}`);
    const system = readFileSync(join(this.promptsDir, `${req.stage}.md`), 'utf8');
    const prompt_version = createHash('sha256').update(system).digest('hex').slice(0, 12);
    const maxRetries = req.maxRetries ?? 2;

    const usage: ReasoningUsage = {
      input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0,
      source: 'reported', model_requested: req.modelRequested, model_served: req.modelRequested,
    };
    let attempts = 0;
    let lastError = 'no attempt made';

    while (attempts <= maxRetries) {
      attempts++;
      // Transport errors (APIError, connection errors) propagate unchanged: they stay retryable.
      const response = await this.client.create({
        model: req.modelRequested,
        max_tokens: 16000,
        system,
        messages: [{ role: 'user', content: req.prompt }],
        output_config: { format: { type: 'json_schema', schema: jsonSchema }, effort: 'high' },
      });
      usage.input_tokens += response.usage?.input_tokens ?? 0;
      usage.output_tokens += response.usage?.output_tokens ?? 0;
      usage.cache_read_tokens += response.usage?.cache_read_input_tokens ?? 0;
      usage.cache_write_tokens += response.usage?.cache_creation_input_tokens ?? 0;
      if (response.model) usage.model_served = response.model;

      const stop = response.stop_reason;
      if (stop === 'refusal' || stop === 'max_tokens') {
        throw new ReasoningOutputInvalid(
          `reasoning call for stage=${req.stage} ended with stop_reason=${stop} (served ${usage.model_served})`,
          req.stage, stop, attempts, { ...usage },
        );
      }

      const block = (response.content ?? []).find((b: any) => b.type === 'text');
      if (!block) {
        lastError = 'no text block in response';
        continue;
      }
      let raw: unknown;
      try {
        raw = JSON.parse(block.text);
      } catch (e) {
        lastError = `response is not valid JSON: ${(e as Error).message}`;
        continue;
      }
      const parsed = req.schema.safeParse(raw);
      if (parsed.success) {
        return { output: parsed.data, usage: { ...usage }, attempts, llm_calls: attempts, prompt_version };
      }
      lastError = String(parsed.error);
    }
    throw new ReasoningOutputInvalid(
      `reasoning call for stage=${req.stage} failed schema validation after ${attempts} attempts: ${lastError}`,
      req.stage, 'schema_invalid', attempts, { ...usage },
    );
  }
}
