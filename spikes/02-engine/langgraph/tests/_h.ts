import { countCalls, readJsonl } from '../../common/stubs.ts';
export const counts = (runId: string) => Object.fromEntries(['triage','route','design','plan','execute:start','execute:effect-done','open-pr','merge'].map((s) => [s, countCalls(runId, s)]));
export const ledger = (runId: string) => readJsonl('ledger.jsonl').filter((l) => l.runId === runId).map((l) => `${l.step}@pid${l.pid}`);
