// One live triage call against the sample ticket (spec 009, R2). Run via
// `scripts/with-g-key.sh npm run smoke:triage`. Refuses to run unless GRAPH_REASONING=anthropic.
// Prints one JSON object; never prints env values or the key file contents.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTicketFile } from '../src/cli/parse-ticket.ts';
import { AnthropicReasoning } from '../src/adapters/anthropic-reasoning.ts';
import { FileConfig } from '../src/adapters/file-config.ts';
import { TriageOutputSchema } from '../src/core/schemas.ts';
import { costAndGaps } from '../src/core/telemetry.ts';
import { ReasoningOutputInvalid } from '../src/ports/reasoning.ts';

const MODEL_REQUESTED = 'claude-sonnet-5-5';

async function main(): Promise<number> {
  if (process.env.GRAPH_REASONING !== 'anthropic') {
    console.error('smoke-triage: refusing to run unless GRAPH_REASONING=anthropic (no silent stub)');
    return 2;
  }
  const here = path.dirname(fileURLToPath(import.meta.url));
  const ticket = parseTicketFile(path.resolve(here, '../tickets/sample-ticket.md'));
  const reasoning = AnthropicReasoning.fromEnv();
  const prices = await new FileConfig().loadPriceTable();
  try {
    const res = await reasoning.call({
      stage: 'triage',
      prompt: JSON.stringify({ ticket }),
      schema: TriageOutputSchema,
      modelRequested: MODEL_REQUESTED,
      idempotencyKey: 'smoke:triage',
    });
    const u = res.usage;
    const { usd, gaps } = costAndGaps(prices, u.model_requested, u.model_served, {
      input: u.input_tokens, output: u.output_tokens, cache_read: u.cache_read_tokens, cache_write: u.cache_write_tokens,
    });
    console.log(JSON.stringify({
      model_requested: u.model_requested,
      model_served: u.model_served,
      attempts: res.attempts,
      llm_calls: res.llm_calls,
      prompt_version: res.prompt_version,
      tokens: {
        input: u.input_tokens, output: u.output_tokens,
        cache_read: u.cache_read_tokens, cache_write: u.cache_write_tokens, source: u.source,
      },
      cost_usd: usd,
      gaps,
      output: res.output,
    }, null, 2));
    return 0;
  } catch (err) {
    if (err instanceof ReasoningOutputInvalid) {
      console.error(JSON.stringify({ error: 'ReasoningOutputInvalid', kind: err.kind, attempts: err.attempts, usage: err.usage }, null, 2));
      return 1;
    }
    throw err;
  }
}

main().then((code) => { process.exitCode = code; }, (err) => {
  console.error(`smoke-triage: ${err instanceof Error ? err.message : 'unexpected error'}`);
  process.exitCode = 1;
});
