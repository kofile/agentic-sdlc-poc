import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { GatePolicySchema } from '../../src/core/gates.ts';

const teamsDir = new URL('../../teams/', import.meta.url);

describe('committed team policy files', () => {
  const expected: Record<string, 'auto' | 'human'> = { auto: 'auto', default: 'human', strict: 'human' };
  for (const [team, plan] of Object.entries(expected)) {
    it(`${team}.json parses and sets plan=${plan}`, () => {
      const raw = JSON.parse(readFileSync(new URL(`${team}.json`, teamsDir), 'utf8'));
      const policy = GatePolicySchema.parse(raw);
      expect(policy.team).toBe(team);
      expect(policy.gates['plan']).toBe(plan);
      expect(policy.gates['design']).toBeDefined();
      expect(policy.gates['merge']).toBeDefined();
    });
  }
});
