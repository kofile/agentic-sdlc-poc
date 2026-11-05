import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadTicket, parseTicket } from '../src/adapters/g/ticket.ts';
import { validateGStages } from '../src/adapters/g/stages.ts';
import { GRAPH_ROOT, TICKETS_ROOT, GRAPH_TELEMETRY_FILE } from '../src/adapters/g/paths.ts';
import { readGraphTelemetry, toStageEvents } from '../src/adapters/g/telemetry.ts';
import { parseStageRange } from '../src/record.ts';

const fx = (n: string): string => path.join(import.meta.dirname, 'fixtures', 'g', n);
const events = (file: string, run: string, range: string, opts = {}) => toStageEvents(readGraphTelemetry(fx(file), run), parseStageRange(range), opts);

describe('paths', () => {
  it('resolves repo-relative roots', () => {
    expect(fs.existsSync(path.join(GRAPH_ROOT, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(TICKETS_ROOT, 'T01', 'ticket.md'))).toBe(true);
    expect(GRAPH_TELEMETRY_FILE).toBe(path.join(GRAPH_ROOT, '.run-state', 'telemetry.jsonl'));
  });
});

describe('ticket loader', () => {
  it('H1 is the title, the rest is the description', () => {
    const t = parseTicket('T9', '# Hello world\n\nbody line\n\n## AC\n- x\n');
    expect(t).toEqual({ id: 'T9', title: 'Hello world', description: 'body line\n\n## AC\n- x', labels: [] });
  });
  it('loads T01 from the real ticket dir', () => {
    const t = loadTicket(TICKETS_ROOT, 'T01');
    expect(t.title).toBe("[SDLC-TEST] Add a customer's orders endpoint");
    expect(t.description).toContain('/customers/:id/orders');
    expect(t.labels).toEqual([]);
  });
  it('opens only ticket.md', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'tk-'));
    fs.mkdirSync(path.join(d, 'T1'));
    fs.writeFileSync(path.join(d, 'T1', 'ticket.md'), '# t\nd');
    fs.writeFileSync(path.join(d, 'T1', 'expected.yaml'), 'SECRET');
    const t = loadTicket(d, 'T1');
    expect(JSON.stringify(t)).not.toContain('SECRET');
    fs.rmSync(d, { recursive: true, force: true });
  });
  it('rejects missing files, missing H1 and unsafe ids', () => {
    expect(() => loadTicket(TICKETS_ROOT, 'T99999')).toThrow(/cannot read/);
    expect(() => parseTicket('T1', 'no heading')).toThrow(/no "# Title"/);
    expect(() => loadTicket(TICKETS_ROOT, '../x')).toThrow(/invalid ticket id/);
  });
});

describe('stage-range validation', () => {
  it('accepts triage..open_pr and shorter ends', () => {
    expect(validateGStages(parseStageRange('triage..open_pr'))).toBeNull();
    expect(validateGStages(parseStageRange('triage..route'))).toBeNull();
    expect(validateGStages(parseStageRange('triage..triage'))).toBeNull();
  });
  it('rejects a mid-ladder start and unsupported ends, one line each', () => {
    const a = validateGStages(parseStageRange('route..plan'));
    const b = validateGStages(parseStageRange('triage..validate'));
    const c = validateGStages(['triage', 'review']);
    expect(a).toMatch(/start at triage/);
    expect(b).toMatch(/validate/);
    expect(c).toMatch(/review/);
    for (const m of [a, b, c]) expect(m).not.toContain('\n');
    expect(validateGStages([])).toMatch(/no stages/);
  });
});

describe('telemetry mapping', () => {
  it('single round: one event per stage, run filter, gate folded', () => {
    const evs = events('single.jsonl', 'RUN1', 'triage..open_pr');
    expect(evs.map((e) => e.stage)).toEqual(['triage', 'route', 'design', 'plan', 'execute', 'open_pr']);
    const triage = evs[0];
    expect(triage.gate).toEqual({ name: 'A or B?', decision: 'pass' });
    expect(triage.status).toBe('completed');
    expect(triage.fix_attempts).toBe(0);
    expect(triage.tokens).toEqual({ input: 10, output: 5, cache_read: 2, cache_write: 1, source: 'reported' });
    expect(triage.llm_calls).toBe(1);
    expect(triage.wall_ms).toBe(100);
    expect(evs[1].gate).toBeUndefined();
    expect(evs[2].output).toEqual({ schema_valid: true, artifact_refs: ['confluence:1'] });
    expect(evs[4].tool_calls).toBe(1);
    expect(evs[4].model_requested).toBeUndefined();
  });
  it('omits cold_start_ms and harness-owned fields', () => {
    const e = events('single.jsonl', 'RUN1', 'triage..triage')[0] as Record<string, unknown>;
    for (const k of ['cold_start_ms', 'run_id', 'benchmark_version', 'contender', 'contender_version', 'ticket_id']) expect(k in e).toBe(false);
    expect(e.gate && (e.gate as Record<string, unknown>).expected).toBeUndefined();
  });
  it('honours the requested range', () => {
    expect(events('single.jsonl', 'RUN1', 'triage..route').map((e) => e.stage)).toEqual(['triage', 'route']);
  });
  it('three design rounds merge into one record', () => {
    const evs = events('three-design.jsonl', 'RUN3', 'triage..design');
    expect(evs.map((e) => e.stage)).toEqual(['triage', 'route', 'design']);
    const d = evs[2];
    expect(d.fix_attempts).toBe(2);
    expect(d.wall_ms).toBe(600);
    expect(d.waiting_ms).toBe(15);
    expect(d.llm_calls).toBe(3);
    expect(d.tokens).toEqual({ input: 40, output: 17, cache_read: 4, cache_write: 2, source: 'reported' });
    expect(d.cost_usd?.tokens).toBeCloseTo(0.03);
    expect(d.started_at! < d.ended_at!).toBe(true);
    const raw = readGraphTelemetry(fx('three-design.jsonl'), 'RUN3').filter((l) => l.stage === 'design' && !l.gate);
    expect(d.started_at).toBe(raw[0].started_at);
    expect(d.ended_at).toBe(raw[2].ended_at);
    expect(d.output?.artifact_refs).toEqual(['confluence:9']);
    // earlier rejected rounds do not leak: final gate decision wins
    expect(d.gate).toEqual({ name: 'design approved?', decision: 'pass' });
    expect(d.status).toBe('completed');
  });
  it('a gate stop at triage yields one stopped_by_gate record and nothing later', () => {
    const evs = events('triage-stop.jsonl', 'RUNSTOP', 'triage..open_pr');
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({ stage: 'triage', status: 'stopped_by_gate', gate: { name: 'A or B?', decision: 'fail' } });
  });
  it('a run cancelled after route has no records for later stages', () => {
    const evs = events('cancelled.jsonl', 'RUNCANCEL', 'triage..open_pr');
    expect(evs.map((e) => e.stage)).toEqual(['triage', 'route']);
    expect(evs.every((e) => e.status === 'completed')).toBe(true);
  });
  it('passes through failure_label from invalid output', () => {
    const evs = events('invalid-output.jsonl', 'RUNBAD', 'triage..route');
    expect(evs[1]).toMatchObject({ status: 'failed', failure_label: 'schema', output: { schema_valid: false } });
  });
  it('maps workflow result stopped-invalid-output onto the last stage; tolerates absence', () => {
    const lines = events('cancelled.jsonl', 'RUNCANCEL', 'triage..route', { workflowResult: 'stopped-invalid-output' });
    expect(lines[0].status).toBe('completed');
    expect(lines[1]).toMatchObject({ status: 'failed', failure_label: 'schema' });
    expect(events('cancelled.jsonl', 'RUNCANCEL', 'triage..route', { workflowResult: 'completed' })[1].status).toBe('completed');
  });
  it('unknown run and missing file yield nothing; torn last line tolerated, mid-file corruption not', () => {
    expect(readGraphTelemetry(fx('single.jsonl'), 'nope')).toEqual([]);
    expect(readGraphTelemetry(fx('missing.jsonl'), 'x')).toEqual([]);
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'tl-'));
    const good = JSON.stringify({ run_id: 'r', stage: 'triage' });
    fs.writeFileSync(path.join(d, 'a.jsonl'), `${good}\n{"run_id":"r","sta`);
    expect(readGraphTelemetry(path.join(d, 'a.jsonl'), 'r')).toHaveLength(1);
    fs.writeFileSync(path.join(d, 'b.jsonl'), `{bad\n${good}\n`);
    expect(() => readGraphTelemetry(path.join(d, 'b.jsonl'), 'r')).toThrow(/malformed/);
    fs.rmSync(d, { recursive: true, force: true });
  });
});
