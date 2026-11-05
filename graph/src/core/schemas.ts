// Core stage output schemas. Zod is the contract; every LLM-shaped stage output is validated
// against one of these before the workflow trusts it. Names/gates follow
// sdlc-pipeline-plugin's stage ladder (triage -> repo-route -> design -> plan -> execute ->
// open-pr) per pipeline-conventions/SKILL.md.
import { z } from 'zod';

export const TicketSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  component: z.string().optional(),
  labels: z.array(z.string()).default([]),
});
export type Ticket = z.infer<typeof TicketSchema>;

export const TriageGradeSchema = z.enum(['A', 'B', 'C', 'D']);

export const TriageOutputSchema = z.object({
  grade: TriageGradeSchema,
  reason: z.string(),
  story_points: z.number().optional(),
  issues: z.array(z.string()).default([]),
});
export type TriageOutput = z.infer<typeof TriageOutputSchema>;

export const RouteOutputSchema = z.object({
  repos: z.array(z.object({ name: z.string(), role: z.string(), confidence: z.number().min(0).max(1) })).min(1),
  order: z.array(z.string()).min(1),
});
export type RouteOutput = z.infer<typeof RouteOutputSchema>;

export const DesignOutputSchema = z.object({
  summary: z.string(),
  approach: z.string(),
  interfaces: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  round: z.number().int().min(1),
});
export type DesignOutput = z.infer<typeof DesignOutputSchema>;

export const PlanTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  files: z.array(z.string()).default([]),
  steps: z.array(z.string()).min(1),
});

export const PlanOutputSchema = z.object({
  tasks: z.array(PlanTaskSchema).min(1),
  base_sha: z.string().optional(),
});
export type PlanOutput = z.infer<typeof PlanOutputSchema>;

/** Every stage output schema, keyed by stage name, for generic validation/retry plumbing. */
export const STAGE_SCHEMAS = {
  triage: TriageOutputSchema,
  route: RouteOutputSchema,
  design: DesignOutputSchema,
  plan: PlanOutputSchema,
} as const;
export type StageName = keyof typeof STAGE_SCHEMAS;
