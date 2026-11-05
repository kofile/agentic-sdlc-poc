import { countCalls, readJsonl } from '../../common/stubs.ts';
import type { Client } from '@temporalio/client';
import proto from '@temporalio/proto';
const temporal = (proto as any).temporal;
const ET: any = temporal.api.enums.v1.EventType;
export const dec = (gate: string, round: number, approved: boolean, feedback?: string) => ({ gate, round, approved, feedback });
export const counts = (runId: string) => Object.fromEntries(['triage','route','design','plan','execute:start','execute:effect-done','open-pr','merge'].map((s) => [s, countCalls(runId, s)]));
export const ledger = (runId: string) => readJsonl('ledger.jsonl').filter((l) => l.runId === runId).map((l) => `${l.step}@pid${l.pid}`);
export async function until(c: Client, id: string, pred: (s: any) => boolean, ms = 30000) {
  const t = Date.now(); for (;;) { try { const s = await c.workflow.getHandle(id).query('state'); if (pred(s)) return s; } catch {} if (Date.now() - t > ms) throw new Error('until timeout'); await new Promise((r) => setTimeout(r, 150)); }
}
export async function dumpHistory(c: Client, id: string) {
  const h = await c.workflow.getHandle(id).fetchHistory(); const out: string[] = [];
  for (const e of h.events ?? []) {
    const type = String(ET[(e as any).eventType] ?? (e as any).eventType).replace('EVENT_TYPE_', '');
    const attrs: any = Object.values(e).find((v) => v && typeof v === 'object' && !Array.isArray(v) && !('seconds' in (v as any)) && Object.keys(v as any).length > 0 && (v as any).constructor?.name !== 'Long') ?? {};
    const hint = attrs.activityType?.name ?? attrs.signalName ?? attrs.timerId ?? (attrs.attempt ? `attempt=${attrs.attempt}` : '') ?? '';
    const fail = attrs.failure?.message ? ` FAIL: ${attrs.failure.message}` : '';
    out.push(`${String(e.eventId).padStart(3)} ${type}${hint ? ' ' + hint : ''}${attrs.attempt && attrs.activityType ? ` attempt=${attrs.attempt}` : ''}${fail}`);
  } return out;
}
