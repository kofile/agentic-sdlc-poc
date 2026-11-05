// STUB reasoning adapter: no real model call, no network. Deterministic/ticket-derived output
// so workflow tests are repeatable. Exercises the real contract: zod validation + bound
// retries on schema failure, so swapping in a real model adapter later needs no core change.
import type { Reasoning, ReasoningRequest, ReasoningCallResult } from '../ports/reasoning.ts';
import { TicketSchema } from '../core/schemas.ts';

export interface StubKnobs {
  /** Force a grade regardless of ticket heuristics (test hook). */
  forceGrade?: 'A' | 'B' | 'C' | 'D';
  /** Fail schema validation this many times before succeeding (tests the retry bound). */
  failSchemaNTimes?: number;
  /** Repos to claim were routed (test hook; default one repo named after the ticket component). */
  forceRepos?: string[];
}

function fakeUsage(modelRequested: string, inputTokens: number, outputTokens: number) {
  return { input_tokens: inputTokens, output_tokens: outputTokens, model_requested: modelRequested, model_served: modelRequested };
}

/** Deterministically shape stub output by stage from the ticket text + knobs. No LLM involved. */
function shape(stage: string, promptPayload: any, knobs: StubKnobs): unknown {
  const ticket = promptPayload.ticket ? TicketSchema.parse(promptPayload.ticket) : undefined;
  switch (stage) {
    case 'triage': {
      const grade = knobs.forceGrade ?? (ticket && /urgent|security/i.test(ticket.title) ? 'A' : 'B');
      return { grade, reason: `stub heuristic grade for ${ticket?.id ?? 'unknown'}`, story_points: 3, issues: [] };
    }
    case 'route': {
      const repos = (knobs.forceRepos ?? [ticket?.component ?? 'graph-sample-repo']).map((name) => ({ name, role: 'implementer', confidence: 0.9 }));
      return { repos, order: repos.map((r) => r.name) };
    }
    case 'design': {
      return {
        summary: `Stub design for ${ticket?.id ?? 'ticket'}${promptPayload.feedback ? ` (addressing: ${promptPayload.feedback})` : ''}`,
        approach: 'Add the stub feature behind the existing port; no new adapters.',
        interfaces: ['Reasoning'],
        risks: promptPayload.feedback ? [] : ['stub risk: none identified'],
        round: promptPayload.round ?? 1,
      };
    }
    case 'plan': {
      return {
        tasks: [{ id: 'T1', title: `Implement ${ticket?.id ?? 'ticket'}`, files: ['src/index.ts'], steps: ['Write the change', 'Add a test'] }],
        base_sha: 'stub-base-sha',
      };
    }
    default:
      throw new Error(`stub-reasoning: unknown stage ${stage}`);
  }
}

export class StubReasoning implements Reasoning {
  private schemaFailCounters = new Map<string, number>();

  async call<T>(req: ReasoningRequest<T>): Promise<ReasoningCallResult<T>> {
    const maxRetries = req.maxRetries ?? 2;
    const knobs: StubKnobs = (req as any).knobs ?? {};
    const payload = JSON.parse(req.prompt);
    let attempts = 0;
    let llm_calls = 0;
    let lastError: unknown;
    const key = req.idempotencyKey ?? req.stage;
    const failTarget = knobs.failSchemaNTimes ?? 0;
    while (attempts <= maxRetries) {
      attempts++;
      llm_calls++;
      const already = this.schemaFailCounters.get(key) ?? 0;
      if (already < failTarget) {
        this.schemaFailCounters.set(key, already + 1);
        lastError = new Error(`stub-induced schema failure ${already + 1}/${failTarget}`);
        continue;
      }
      const raw = shape(req.stage, payload, knobs);
      const parsed = req.schema.safeParse(raw);
      if (parsed.success) {
        return {
          output: parsed.data,
          usage: fakeUsage(req.modelRequested, 120 + attempts * 5, 60 + attempts * 5),
          attempts,
          llm_calls,
        };
      }
      lastError = parsed.error;
    }
    throw new Error(`reasoning call for stage=${req.stage} failed schema validation after ${attempts} attempts: ${String(lastError)}`);
  }
}
