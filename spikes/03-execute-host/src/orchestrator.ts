// Orchestrator-side helpers: wait for completion via callback record OR poll fallback; host-side callback resend.
import fs from 'node:fs';
import path from 'node:path';
import type { ExecuteHost, JobHandle, JobStatus } from './types.ts';
import { TERMINAL } from './types.ts';
import { sign } from './hmac.ts';

export const completionPath = (stateDir: string, jobId: string) => path.join(stateDir, 'completions', jobId + '.json');

/** Resolves on whichever comes first: a callback-recorded completion, or poll seeing a terminal state. */
export async function awaitTerminal(host: ExecuteHost, h: JobHandle, o: { stateDir: string; pollMs?: number; timeoutMs?: number }) {
  const t0 = Date.now();
  for (;;) {
    if (fs.existsSync(completionPath(o.stateDir, h.jobId))) return { via: 'callback' as const, ms: Date.now() - t0 };
    const s = await host.status(h);
    if (TERMINAL.includes(s.state)) return { via: 'poll' as const, status: s, ms: Date.now() - t0 };
    if (o.timeoutMs && Date.now() - t0 > o.timeoutMs) throw new Error('awaitTerminal timeout');
    await new Promise((r) => setTimeout(r, o.pollMs ?? 500));
  }
}

/** Host-side re-delivery (used when the container's own retries were exhausted or the container was killed). */
export async function hostSideCallback(host: ExecuteHost, h: JobHandle, stateDir: string, url: string) {
  const r = await host.result(h);
  const secret = fs.readFileSync(path.join(stateDir, 'jobs', h.jobId, 'secrets/callback_secret'), 'utf8');
  const body = JSON.stringify({ jobId: h.jobId, status: r.status.state, reason: r.status.reason, branch: r.branch, commit: r.commit, exitCode: r.status.exitCode, usage: r.usage ?? null, deliveryId: 'host-' + Date.now(), emittedAt: new Date().toISOString(), source: 'host' });
  const ts = String(Math.floor(Date.now() / 1000));
  const resp = await fetch(url, { method: 'POST', body, headers: { 'content-type': 'application/json', 'x-job-id': h.jobId, 'x-timestamp': ts, 'x-signature': sign(secret, ts, body) } });
  return { code: resp.status, body: await resp.text() };
}
