// Stub-reasoning policy (spec 007 R3). The harness never imports from graph/src, so the literal
// is restated here; it must match `NO_MODEL_SERVED` in graph/src/ports/reasoning.ts.
export const STUB_MODEL_SERVED = 'stub';
export const NO_REAL_MODEL_GAP = 'no_real_model';

/** Returns the refusal message when the env would produce a stub-backed run without opt-in, else undefined. */
export function checkStubPolicy(env: NodeJS.ProcessEnv): string | undefined {
  if (env.GRAPH_REASONING === 'anthropic' || env.BENCH_G_ALLOW_STUB === '1') return undefined;
  return `G: stub reasoning (GRAPH_REASONING=${env.GRAPH_REASONING || 'unset'}) needs BENCH_G_ALLOW_STUB=1; stub runs are not benchmark runs`;
}

/** Guarantee: any event served by the stub carries the no_real_model gap (deduplicated). Mutates and returns. */
export function ensureNoRealModelGap<T extends { model_served?: string; telemetry_gaps?: string[] }>(events: T[]): T[] {
  for (const ev of events) {
    if (ev.model_served !== STUB_MODEL_SERVED) continue;
    const gaps = ev.telemetry_gaps ?? [];
    if (!gaps.includes(NO_REAL_MODEL_GAP)) ev.telemetry_gaps = [...gaps, NO_REAL_MODEL_GAP];
  }
  return events;
}
