import type { ContenderAdapter } from './types.ts';
import { stubAdapter } from './stub.ts';

// Only `stub` is registered in this task; P/N/G arrive with TASK-0016/17/18.
const ADAPTERS: Record<string, ContenderAdapter> = { [stubAdapter.id]: stubAdapter };

export function getAdapter(id: string): ContenderAdapter | undefined {
  return Object.prototype.hasOwnProperty.call(ADAPTERS, id) ? ADAPTERS[id] : undefined;
}

export function listContenders(): string[] {
  return Object.keys(ADAPTERS);
}
