import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { STAGE_SCHEMAS } from '../../src/core/schemas.ts';
import { STAGE_JSON_SCHEMAS } from '../../src/adapters/anthropic-schemas.ts';

// Unwrap default/optional to find whether a zod key is required.
const isRequired = (t: z.ZodTypeAny) => !(t instanceof z.ZodOptional || t instanceof z.ZodDefault);

function checkObject(zodObj: z.ZodObject<any>, json: any, path: string) {
  expect(json.type, path).toBe('object');
  expect(json.additionalProperties, path).toBe(false);
  const shape = zodObj.shape as Record<string, z.ZodTypeAny>;
  expect(Object.keys(json.properties).sort(), `${path} keys`).toEqual(Object.keys(shape).sort());
  const zodRequired = Object.entries(shape).filter(([, t]) => isRequired(t)).map(([k]) => k);
  // JSON `required` must include every zod-required key (defaulted keys may also be listed).
  for (const k of zodRequired) expect(json.required, `${path}.${k}`).toContain(k);
  for (const k of json.required) expect(Object.keys(shape), `${path} required ${k}`).toContain(k);
  for (const [k, t] of Object.entries(shape)) {
    let inner: z.ZodTypeAny = t;
    while (inner instanceof z.ZodOptional || inner instanceof z.ZodDefault) inner = inner._def.innerType;
    if (inner instanceof z.ZodArray && inner.element instanceof z.ZodObject) {
      checkObject(inner.element, json.properties[k].items, `${path}.${k}[]`);
    }
  }
}

describe('anthropic JSON schemas', () => {
  for (const stage of Object.keys(STAGE_SCHEMAS) as (keyof typeof STAGE_SCHEMAS)[]) {
    it(`${stage} JSON schema matches the zod shape`, () => {
      checkObject(STAGE_SCHEMAS[stage] as unknown as z.ZodObject<any>, STAGE_JSON_SCHEMAS[stage], stage);
    });
  }
});
