// Config port: gate policy as data, loaded through an activity (workflow sandbox forbids file
// reads directly — spike-02 footgun #1). A run snapshots the policy once, at start.
import type { GatePolicy } from '../core/gates.ts';

export interface Config {
  loadGatePolicy(team: string): Promise<GatePolicy>;
  loadPriceTable(): Promise<Record<string, { input_per_1k: number; output_per_1k: number; UNVERIFIED: boolean }>>;
}
