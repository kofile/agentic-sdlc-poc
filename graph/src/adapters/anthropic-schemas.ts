// Hand-written JSON Schemas for the four model stages, sent as output_config.format.schema.
// zod (src/core/schemas.ts) stays the validator; tests/unit/anthropic-schemas.test.ts checks
// these cannot drift from the zod shapes. Every object has additionalProperties: false and
// `required` lists every key (zod defaults are filled by the model, then re-validated).
export type JsonSchema = { [key: string]: unknown };

const strArray = { type: 'array', items: { type: 'string' } };

export const TRIAGE_JSON_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    grade: { type: 'string', enum: ['A', 'B', 'C', 'D'] },
    reason: { type: 'string' },
    story_points: { type: 'number' },
    issues: strArray,
  },
  required: ['grade', 'reason', 'issues'],
  additionalProperties: false,
};

export const ROUTE_JSON_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    repos: {
      type: 'array',
      items: {
        type: 'object',
        properties: { name: { type: 'string' }, role: { type: 'string' }, confidence: { type: 'number' } },
        required: ['name', 'role', 'confidence'],
        additionalProperties: false,
      },
    },
    order: { type: 'array', items: { type: 'string' } },
  },
  required: ['repos', 'order'],
  additionalProperties: false,
};

export const DESIGN_JSON_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    approach: { type: 'string' },
    interfaces: strArray,
    risks: strArray,
    round: { type: 'integer' },
  },
  required: ['summary', 'approach', 'interfaces', 'risks', 'round'],
  additionalProperties: false,
};

export const PLAN_JSON_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, title: { type: 'string' }, files: strArray, new_files: strArray, steps: strArray },
        required: ['id', 'title', 'files', 'new_files', 'steps'],
        additionalProperties: false,
      },
    },
    base_sha: { type: 'string' },
  },
  required: ['tasks'],
  additionalProperties: false,
};

export const STAGE_JSON_SCHEMAS: Record<'triage' | 'route' | 'design' | 'plan', JsonSchema> = {
  triage: TRIAGE_JSON_SCHEMA,
  route: ROUTE_JSON_SCHEMA,
  design: DESIGN_JSON_SCHEMA,
  plan: PLAN_JSON_SCHEMA,
};
