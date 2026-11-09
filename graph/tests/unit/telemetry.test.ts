import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appendTelemetry, estimateCostUsd, type StageRunRecord } from '../../src/core/telemetry.ts';

const tmpFiles: string[] = [];
afterEach(() => { for (const f of tmpFiles.splice(0)) fs.rmSync(f, { force: true }); });

function baseRecord(overrides: Partial<StageRunRecord> = {}): StageRunRecord {
  return {
    run_id: 'r1', benchmark_version: 'v0.1', contender: 'G', contender_version: 'test',
    ticket_id: 'T1', stage: 'triage', started_at: new Date().toISOString(), ended_at: new Date().toISOString(),
    wall_ms: 1, active_ms: 1, waiting_ms: 0, cold_start_ms: 0, llm_calls: 1, tool_calls: 0,
    tokens: { input: 1, output: 1, cache_read: 0, cache_write: 0, source: 'estimated' },
    cost_usd: { tokens: 0, compute: 0, orchestration: 0 }, status: 'completed', gate: null,
    output: { schema_valid: true, artifact_refs: [] }, fix_attempts: 0, infra_retries: 0, interventions: 0,
    assisted: false, failure_label: null, failure_note: null,
    scores: { hidden_tests_passed: 0, hidden_tests_total: 0, gates_green: true, rubric: null },
    telemetry_gaps: [], canary_leak: false,
    ...overrides,
  };
}

describe('appendTelemetry', () => {
  it('appends one valid JSON line per call', () => {
    const file = path.join(os.tmpdir(), `telemetry-test-${Date.now()}.jsonl`);
    tmpFiles.push(file);
    appendTelemetry(file, baseRecord());
    appendTelemetry(file, baseRecord({ stage: 'route' }));
    const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).stage).toBe('triage');
    expect(JSON.parse(lines[1]).stage).toBe('route');
  });

  it('rejects a record missing a required field', () => {
    const file = path.join(os.tmpdir(), `telemetry-test-bad-${Date.now()}.jsonl`);
    tmpFiles.push(file);
    const bad = baseRecord() as any;
    delete bad.status;
    expect(() => appendTelemetry(file, bad)).toThrow();
  });
});

describe('estimateCostUsd', () => {
  const prices = { 'model-a': { input_per_1k: 1, output_per_1k: 2, cache_read_per_1k: 0.1, cache_write_per_1k: 1.25 }, default: { input_per_1k: 5, output_per_1k: 5, cache_read_per_1k: 5, cache_write_per_1k: 5 } };
  const t = (input: number, output: number, cache_read = 0, cache_write = 0) => ({ input, output, cache_read, cache_write });
  it('computes input+output cost from the price table', () => {
    expect(estimateCostUsd(prices, 'model-a', t(1000, 1000))).toEqual({ usd: 3, priceKey: 'model-a' });
  });
  it('prices cache read and cache write tokens', () => {
    expect(estimateCostUsd(prices, 'model-a', t(0, 0, 10000, 2000))).toEqual({ usd: 3.5, priceKey: 'model-a' });
  });
  it('reports the default entry when the model is unknown', () => {
    expect(estimateCostUsd(prices, 'unknown', t(1000, 1000))).toEqual({ usd: 10, priceKey: 'default' });
  });
  it('falls back to 0 with a null key when the model is unknown and there is no default', () => {
    expect(estimateCostUsd({}, 'unknown', t(1000, 1000))).toEqual({ usd: 0, priceKey: null });
  });
});
