import { describe, it, expect } from 'vitest';
import { StageRunRecordSchema, parseStageRange, STAGE_ORDER } from '../src/record.ts';
import { makeRunId } from '../src/run-id.ts';
import { SECTION7_EXAMPLE } from './fixtures.ts';

describe('StageRunRecordSchema', () => {
  it('accepts the section 7 example', () => {
    expect(StageRunRecordSchema.parse(SECTION7_EXAMPLE)).toEqual(SECTION7_EXAMPLE);
  });
  it('rejects a missing telemetry_gaps', () => {
    const { telemetry_gaps: _t, ...rest } = SECTION7_EXAMPLE;
    expect(StageRunRecordSchema.safeParse(rest).success).toBe(false);
  });
  it('rejects a bad stage', () => {
    expect(StageRunRecordSchema.safeParse({ ...SECTION7_EXAMPLE, stage: 'deploy' }).success).toBe(false);
  });
  it('rejects a bad contender and accepts stub', () => {
    expect(StageRunRecordSchema.safeParse({ ...SECTION7_EXAMPLE, contender: 'X' }).success).toBe(false);
    expect(StageRunRecordSchema.safeParse({ ...SECTION7_EXAMPLE, contender: 'stub' }).success).toBe(true);
  });
  it('rejects unknown fields', () => {
    expect(StageRunRecordSchema.safeParse({ ...SECTION7_EXAMPLE, extra: 1 }).success).toBe(false);
  });
});

describe('parseStageRange', () => {
  it('expands inclusive ranges', () => {
    expect(parseStageRange('triage..plan')).toEqual(['triage', 'route', 'design', 'plan']);
    expect(parseStageRange('triage..open-pr')).toEqual(['triage', 'route', 'design', 'plan', 'execute', 'open_pr']);
    expect(parseStageRange('review..review')).toEqual(['review']);
    expect(parseStageRange('triage..review')).toEqual([...STAGE_ORDER]);
  });
  it('rejects malformed, unknown and backwards ranges', () => {
    expect(() => parseStageRange('triage')).toThrow();
    expect(() => parseStageRange('triage..nope')).toThrow();
    expect(() => parseStageRange('plan..triage')).toThrow();
  });
});

describe('makeRunId', () => {
  it('matches the section 7 format (second resolution)', () => {
    expect(makeRunId(new Date('2026-11-12T02:31:45.123Z'), 'P', 'T07', 2)).toBe('2026-11-12T023145Z-P-T07-r2');
  });
  it('differs for two starts in the same minute but different seconds', () => {
    const a = makeRunId(new Date('2026-11-12T02:31:05Z'), 'P', 'T07', 2);
    const b = makeRunId(new Date('2026-11-12T02:31:45Z'), 'P', 'T07', 2);
    expect(a).not.toBe(b);
    expect(a).toBe('2026-11-12T023105Z-P-T07-r2');
  });
  it('sorts lexicographically in time order across minutes, hours and days', () => {
    const times = ['2026-11-11T23:59:59Z', '2026-11-12T00:00:00Z', '2026-11-12T00:00:09Z', '2026-11-12T00:01:00Z', '2026-11-12T02:31:45Z', '2026-11-12T02:31:46Z'];
    const ids = times.map((t) => makeRunId(new Date(t), 'P', 'T07', 2));
    expect([...ids].sort()).toEqual(ids);
  });
  it('accepts a gate without expected/correct (spec 006 R6a); an absent correct is not scored', () => {
    const r = StageRunRecordSchema.parse({ ...SECTION7_EXAMPLE, gate: { name: 'A or B?', decision: 'pass' } });
    expect(r.gate).toEqual({ name: 'A or B?', decision: 'pass' });
    expect(r.gate?.correct).toBeUndefined();
    expect(StageRunRecordSchema.safeParse({ ...SECTION7_EXAMPLE, gate: { name: 'x', decision: 'maybe' } }).success).toBe(false);
  });
});
