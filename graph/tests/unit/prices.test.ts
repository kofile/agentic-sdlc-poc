import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { estimateCostUsd, type PriceTable } from '../../src/core/telemetry.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(fs.readFileSync(path.join(here, '../../config/prices.json'), 'utf8'));
const { _comment, ...entries } = raw as Record<string, any>;

describe('prices.json shape', () => {
  it('has a provenance comment without UNVERIFIED', () => {
    expect(typeof _comment).toBe('string');
    expect(_comment).not.toMatch(/UNVERIFIED/);
  });
  it('includes every R2 model and default', () => {
    for (const k of ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5', 'claude-sonnet-5', 'claude-opus-5', 'claude-haiku-4-5', 'default']) {
      expect(entries).toHaveProperty(k);
    }
  });
  for (const [model, e] of Object.entries(entries)) {
    it(`${model} has complete verified fields`, () => {
      expect(e).not.toHaveProperty('UNVERIFIED');
      for (const f of ['input_per_1k', 'output_per_1k', 'cache_read_per_1k', 'cache_write_per_1k']) {
        expect(typeof e[f]).toBe('number');
        expect(e[f]).toBeGreaterThan(0);
      }
      for (const f of ['input', 'output', 'cache_read', 'cache_write']) {
        expect(e.per_million[f]).toBeGreaterThan(0);
      }
      expect(e.source).toMatch(/^https:\/\//);
      expect(e.retrieved).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  }
  it('default equals claude-sonnet-5-5', () => {
    expect(entries.default.per_million).toEqual(entries['claude-sonnet-5-5'].per_million);
  });
});

describe('cost recomputation', () => {
  it('prices a recorded sonnet-5-5 sample exactly', () => {
    // 12345 in, 6789 out on claude-sonnet-5-5 ($2 / $10 per MTok = 0.002 / 0.01 per 1K):
    // 12.345 * 0.002 = 0.02469; 6.789 * 0.01 = 0.06789; total = 0.09258 USD
    const tokens = { input: 12345, output: 6789, cache_read: 0, cache_write: 0 };
    expect(estimateCostUsd(entries as unknown as PriceTable, 'claude-sonnet-5-5', tokens)).toEqual({ usd: 0.09258, priceKey: 'claude-sonnet-5-5' });
  });
  it('prices cache tokens from the table', () => {
    // 100K cache read * 0.0001 = 0.01; 40K cache write * 0.0025 = 0.1
    const tokens = { input: 0, output: 0, cache_read: 100000, cache_write: 40000 };
    expect(estimateCostUsd(entries as unknown as PriceTable, 'claude-sonnet-5-5', tokens).usd).toBe(0.11);
  });
  it('flags an unknown model as priced by default', () => {
    const tokens = { input: 1000, output: 0, cache_read: 0, cache_write: 0 };
    expect(estimateCostUsd(entries as unknown as PriceTable, 'claude-future-9', tokens)).toEqual({ usd: 0.002, priceKey: 'default' });
  });
});
