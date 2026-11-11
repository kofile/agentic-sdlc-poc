import { describe, it, expect } from 'vitest';
import { TriageOutputSchema, RouteOutputSchema, DesignOutputSchema, PlanOutputSchema, TicketSchema } from '../../src/core/schemas.ts';

describe('TicketSchema', () => {
  it('accepts a minimal ticket and defaults labels', () => {
    const t = TicketSchema.parse({ id: 'T-1', title: 'x', description: 'y' });
    expect(t.labels).toEqual([]);
  });
});

describe('TriageOutputSchema', () => {
  it('accepts A/B/C/D grades', () => {
    for (const grade of ['A', 'B', 'C', 'D'] as const) {
      expect(() => TriageOutputSchema.parse({ grade, reason: 'r' })).not.toThrow();
    }
  });
  it('rejects an invalid grade', () => {
    expect(() => TriageOutputSchema.parse({ grade: 'E', reason: 'r' })).toThrow();
  });
});

describe('RouteOutputSchema', () => {
  it('requires at least one repo', () => {
    expect(() => RouteOutputSchema.parse({ repos: [], order: [] })).toThrow();
  });
  it('accepts a valid route', () => {
    const r = RouteOutputSchema.parse({ repos: [{ name: 'repo-a', role: 'implementer', confidence: 0.8 }], order: ['repo-a'] });
    expect(r.repos).toHaveLength(1);
  });
});

describe('DesignOutputSchema', () => {
  it('requires round >= 1', () => {
    expect(() => DesignOutputSchema.parse({ summary: 's', approach: 'a', round: 0 })).toThrow();
    expect(() => DesignOutputSchema.parse({ summary: 's', approach: 'a', round: 1 })).not.toThrow();
  });
});

describe('PlanOutputSchema', () => {
  it('requires at least one task with at least one step', () => {
    expect(() => PlanOutputSchema.parse({ tasks: [] })).toThrow();
    expect(() => PlanOutputSchema.parse({ tasks: [{ id: 'T1', title: 't', steps: [] }] })).toThrow();
    expect(() => PlanOutputSchema.parse({ tasks: [{ id: 'T1', title: 't', steps: ['do it'] }] })).not.toThrow();
  });
  it('defaults new_files to []', () => {
    const out = PlanOutputSchema.parse({ tasks: [{ id: 'T1', title: 't', steps: ['s'] }] });
    expect(out.tasks[0]!.new_files).toEqual([]);
    expect(PlanOutputSchema.parse({ tasks: [{ id: 'T1', title: 't', new_files: ['a.ts'], steps: ['s'] }] }).tasks[0]!.new_files).toEqual(['a.ts']);
  });
});
