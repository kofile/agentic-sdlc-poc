import type { ContenderAdapter } from './types.ts';
import { stubAdapter } from './stub.ts';
import { gAdapter } from './g/index.ts';

// `stub` and `G` (TASK-0018); P/N arrive with TASK-0016/17.
const ADAPTERS: Record<string, ContenderAdapter> = { [stubAdapter.id]: stubAdapter, [gAdapter.id]: gAdapter };

export function getAdapter(id: string): ContenderAdapter | undefined {
  return Object.prototype.hasOwnProperty.call(ADAPTERS, id) ? ADAPTERS[id] : undefined;
}

export function listContenders(): string[] {
  return Object.keys(ADAPTERS);
}
