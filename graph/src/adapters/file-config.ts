import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Config } from '../ports/config.ts';
import { GatePolicySchema, type GatePolicy } from '../core/gates.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const GRAPH_ROOT = path.resolve(here, '../..'); // src/adapters -> graph/

export class FileConfig implements Config {
  async loadGatePolicy(team: string): Promise<GatePolicy> {
    const file = path.join(GRAPH_ROOT, 'teams', `${team}.json`);
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    return GatePolicySchema.parse(raw);
  }

  async loadPriceTable() {
    const file = path.join(GRAPH_ROOT, 'config', 'prices.json');
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }
}
