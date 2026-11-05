import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { WORK, ROOT, IMAGE, sleep, sh, makeRemote, branches, mkHost, mkSpec, promptFile, startReceiver, killProc, firstEventLatency, drain, cleanAll } from './lib.ts';
import { awaitTerminal, hostSideCallback, completionPath } from '../src/orchestrator.ts';
import { sign } from '../src/hmac.ts';
import { docker } from '../src/docker-host.ts';
import { TERMINAL } from '../src/types.ts';
import type { JobHandle } from '../src/types.ts';

const PORT = 18911; const CB = { url: `http://host.docker.internal:${PORT}/callback` };
const RCV_URL = `http://127.0.0.1:${PORT}/callback`;
type Verdict = 'PASS' | 'FAIL' | 'PARTIAL';
const results: Array<{ id: string; name: string; verdict: Verdict; ms: number; evidence: string[]; metrics: Record<string, unknown> }> = [];
const forTelemetry: Array<{ label: string; h: JobHandle }> = [];
const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

async function test(id: string, name: string, fn: (ev: (s: string) => void, m: Record<string, unknown>) => Promise<Verdict>) {
  const evidence: string[] = []; const metrics: Record<string, unknown> = {}; const t = Date.now(); let verdict: Verdict;
  try { verdict = await fn((s) => { evidence.push(s); console.log('   ' + s); }, metrics); }
  catch (e: any) { verdict = 'FAIL'; evidence.push('EXCEPTION ' + (e.stack || e).toString().split('\n').slice(0, 4).join(' | ')); console.log('   EXCEPTION', e.stack || e); }
  const ms = Date.now() - t; results.push({ id, name, verdict, ms, evidence, metrics });
  console.log(`${verdict} ${id} ${name} (${ms} ms)\n`);
}
const must = (c: boolean, ev: (s: string) => void, msg: string) => { ev((c ? 'ok: ' : 'NOT ok: ') + msg); return c; };

fs.rmSync(WORK, { recursive: true, force: true }); fs.mkdirSync(WORK, { recursive: true });
await cleanAll();
const state = path.join(WORK, 'state'); fs.mkdirSync(state, { recursive: true });
const bare = makeRemote();
const host = mkHost(state);
const build = async (extra: string[] = []) => { const t = Date.now(); await docker(['build', '-q', ...extra, '-t', IMAGE, path.join(ROOT, 'container')]); return Date.now() - t; };
const initialBuildMs = await build();
console.log('initial image build (base layers cached) ms', initialBuildMs);
let rcv: ChildProcess = await startReceiver(state, PORT);

async function runToEnd(spec = mkSpec(bare, { callback: CB }), label?: string) {
  const t0 = Date.now(); const h = await host.start(spec); const startMs = Date.now() - t0;
  const first = await firstEventLatency(host, h, t0); const term = await awaitTerminal(host, h, { stateDir: state });
  if (label) forTelemetry.push({ label, h });
  return { h, startMs, first, term, total: Date.now() - t0 };
}

// ---------------- A cold start
await test('A', 'Cold start: start() -> first agent event', async (ev, m) => {
  const warm: number[] = [], starts: number[] = [];
  for (let i = 0; i < 5; i++) { const r = await runToEnd(mkSpec(bare, { stub: { steps: 1, stepMs: 100 } })); warm.push(r.first); starts.push(r.startMs); await host.cleanup(r.h); }
  m.warmFirstEventMs = warm; m.warmMedianMs = med(warm); m.startCallMedianMs = med(starts);
  ev(`image cached: first-event ms = ${warm.join(', ')} (median ${med(warm)}); start() call itself median ${med(starts)} ms`);
  // image not cached: remove image, rebuild, start
  await docker(['rmi', IMAGE]); const b = await build(); const r = await runToEnd(mkSpec(bare, { stub: { steps: 1, stepMs: 100 } })); await host.cleanup(r.h);
  m.rebuildBaseCachedMs = b; m.noImageFirstEventMs = r.first;
  ev(`image removed, base layer cached: build ${b} ms, then first event ${r.first} ms (build+first = ${b + r.first} ms)`);
  let pulled: number | null = null;
  try {
    await docker(['rmi', IMAGE], { allowFail: true }); const rb = await docker(['rmi', 'node:22-alpine'], { allowFail: true }); ev(`rmi base: ${rb.ok ? 'removed' : rb.out.slice(0, 80)}`);
    const b2 = await build(['--no-cache', '--pull']); const r2 = await runToEnd(mkSpec(bare, { stub: { steps: 1, stepMs: 100 } })); await host.cleanup(r2.h);
    pulled = b2; m.coldPullBuildMs = b2; m.coldPullFirstEventMs = r2.first;
    ev(`image AND node:22-alpine base removed (--no-cache --pull: re-pull base, apk add git, build): ${b2} ms, then first event ${r2.first} ms`);
  } catch (e: any) { ev('cold pull variant failed: ' + String(e.message).slice(0, 120)); await build(); }
  return warm.every((x) => x > 0) && pulled !== null ? 'PASS' : 'PARTIAL';
});

// ---------------- B cancel
async function cancelScenario(label: string, stub: object, grace: number, ev: (s: string) => void, m: Record<string, unknown>) {
  const spec = mkSpec(bare, { callback: CB, stub: { steps: 40, stepMs: 400, ...stub } });
  const h = await host.start(spec);
  for await (const l of host.logs(h, { follow: true })) if (l.text.includes('Edit')) break; // workspace edited, mid-run
  const c = await host.cancel(h, { graceSeconds: grace });
  forTelemetry.push({ label, h });
  const insp = JSON.parse((await docker(['inspect', h.ref])).out)[0];
  const ws = await docker(['cp', `${h.ref}:/work/repo/NOTES.md`, path.join(WORK, `ws-${h.jobId}.md`)], { allowFail: true });
  const diff = (await docker(['diff', h.ref])).out.split('\n').filter((l) => l.includes('/work/repo')).length;
  const branchPushed = branches(bare).includes(`agent/${h.jobId}`);
  const st = await host.status(h);
  ev(`${label}: cancel latency ${c.latencyMs} ms (grace ${grace}s); container Running=${insp.State.Running} exit=${insp.State.ExitCode}; host status=${st.state}/${st.reason}`);
  ev(`${label}: workspace left in stopped container: ${ws.ok ? 'YES (docker cp of /work/repo/NOTES.md works; ' + diff + ' changed paths under /work/repo)' : 'no'}; partial branch pushed: ${branchPushed}`);
  await host.cleanup(h);
  const after = (await docker(['inspect', h.ref], { allowFail: true })).ok;
  ev(`${label}: after cleanup() container exists=${after}`);
  m[label] = { latencyMs: c.latencyMs, state: st.state, workspaceLeft: ws.ok, branchPushed };
  return { c, st, ws, branchPushed, after };
}
await test('B', 'Cancel mid-run', async (ev, m) => {
  const b1 = await cancelScenario('B1-graceful(stub handles SIGTERM)', {}, 10, ev, m);
  const b2 = await cancelScenario('B2-stub-ignores-SIGTERM(runner escalates after 3s)', { mode: 'ignore-sigterm' }, 10, ev, m);
  const b3 = await cancelScenario('B3-grace1s(docker SIGKILL before runner can finish)', { mode: 'ignore-sigterm' }, 1, ev, m);
  const ok = [b1, b2, b3].every((b) => b.st.state === 'cancelled' && !b.branchPushed && b.after === false);
  return ok && b1.c.latencyMs < 3000 ? 'PASS' : 'FAIL';
});

// ---------------- C callback reliability
await test('C', 'Callback reliability: receiver down, retry, poll fallback', async (ev, m) => {
  await killProc(rcv);
  ev('receiver killed');
  const spec = mkSpec(bare, { callback: CB, stub: { steps: 2, stepMs: 300 } });
  const h = await host.start(spec); forTelemetry.push({ label: 'C-callback-lost', h });
  const t0 = Date.now(); const term = await awaitTerminal(host, h, { stateDir: state, pollMs: 300 });
  ev(`orchestrator learned of terminal state via ${term.via} in ${term.ms} ms (no callback record: ${!fs.existsSync(completionPath(state, h.jobId))})`);
  let r = await host.result(h);
  // wait for the container's bounded retries to be exhausted
  while ((await docker(['inspect', '-f', '{{.State.Running}}', h.ref])).out === 'true') await sleep(300);
  r = await host.result(h);
  ev(`container-side callback result: ${JSON.stringify(r.callback)} (retries are our runner code, not a host feature); status=${r.status.state}, branch=${r.branch}`);
  m.containerCallback = r.callback;
  await sleep(2000); rcv = await startReceiver(state, PORT);
  await sleep(3000);
  const autoRedelivered = fs.existsSync(completionPath(state, h.jobId));
  ev(`receiver restarted; completion auto-redelivered by host/container after restart: ${autoRedelivered}`);
  const resend = await hostSideCallback(host, h, state, RCV_URL);
  ev(`orchestrator-driven resend (poll fallback -> hostSideCallback): HTTP ${resend.code} ${resend.body}; completion recorded: ${fs.existsSync(completionPath(state, h.jobId))}`);
  // C2: receiver back inside the container's retry window
  await killProc(rcv);
  const h2 = await host.start(mkSpec(bare, { callback: CB, stub: { steps: 2, stepMs: 300 } })); forTelemetry.push({ label: 'C2-callback-retry-window', h: h2 });
  while (!fs.existsSync(path.join(host.jobDir(h2.jobId), 'out/result.json'))) await sleep(100);
  await sleep(800); rcv = await startReceiver(state, PORT);
  await awaitTerminal(host, h2, { stateDir: state }); while ((await docker(['inspect', '-f', '{{.State.Running}}', h2.ref])).out === 'true') await sleep(200);
  const r2 = await host.result(h2);
  ev(`C2 receiver back ~0.8 s after job finished: container callback ${JSON.stringify(r2.callback)}; recorded=${fs.existsSync(completionPath(state, h2.jobId))}`);
  m.c2 = r2.callback;
  return !autoRedelivered && resend.code === 200 && r.callback?.delivered === false && r2.callback?.delivered === true ? 'PASS' : 'FAIL';
});

// ---------------- D duplicates / replay / forgery
await test('D', 'Duplicate, replayed, forged callbacks', async (ev, m) => {
  const h = await host.start(mkSpec(bare, { stub: { steps: 1, stepMs: 100 } })); await awaitTerminal(host, h, { stateDir: state }); forTelemetry.push({ label: 'D-nocallback', h });
  const secret = fs.readFileSync(path.join(host.jobDir(h.jobId), 'secrets/callback_secret'), 'utf8');
  const mk = (over: object = {}) => JSON.stringify({ jobId: h.jobId, status: 'succeeded', deliveryId: crypto.randomUUID(), source: 'container', ...over });
  const post = async (body: string, o: { secret?: string; ts?: number; jobId?: string } = {}) => {
    const ts = String(o.ts ?? Math.floor(Date.now() / 1000));
    const r = await fetch(RCV_URL, { method: 'POST', body, headers: { 'x-job-id': o.jobId ?? h.jobId, 'x-timestamp': ts, 'x-signature': sign(o.secret ?? secret, ts, body) } });
    return (await r.json() as any).outcome + '/' + r.status;
  };
  const forged = await post(mk(), { secret: 'wrong' });
  const body = mk(); const ts = Math.floor(Date.now() / 1000);
  const first = await post(body, { ts }); const second = await post(body, { ts });
  const tamper = await (async () => { const t = String(Math.floor(Date.now() / 1000)); const r = await fetch(RCV_URL, { method: 'POST', body: body.replace('succeeded', 'failed'), headers: { 'x-job-id': h.jobId, 'x-timestamp': t, 'x-signature': sign(secret, t, body) } }); return ((await r.json()) as any).outcome + '/' + r.status; })();
  const stale = await post(mk(), { ts: Math.floor(Date.now() / 1000) - 3600 });
  const conflicting = await post(mk({ status: 'failed' }));
  const crossJob = await post(mk(), { jobId: 'j-0000000000' });
  const kept = JSON.parse(fs.readFileSync(completionPath(state, h.jobId), 'utf8')).status;
  // concurrent double delivery on a fresh job
  const h2 = await host.start(mkSpec(bare, { stub: { steps: 1, stepMs: 100 } })); await awaitTerminal(host, h2, { stateDir: state }); forTelemetry.push({ label: 'D2-nocallback', h: h2 });
  const sec2 = fs.readFileSync(path.join(host.jobDir(h2.jobId), 'secrets/callback_secret'), 'utf8');
  const b2 = JSON.stringify({ jobId: h2.jobId, status: 'succeeded', deliveryId: 'x' }); const t2 = String(Math.floor(Date.now() / 1000));
  const conc = await Promise.all([1, 2, 3, 4].map(() => fetch(RCV_URL, { method: 'POST', body: b2, headers: { 'x-job-id': h2.jobId, 'x-timestamp': t2, 'x-signature': sign(sec2, t2, b2) } }).then((r) => r.json() as any).then((j) => j.outcome)));
  // host resend after a container that already delivered
  const hc = await host.start(mkSpec(bare, { callback: CB, stub: { steps: 1, stepMs: 100 } })); await awaitTerminal(host, hc, { stateDir: state }); forTelemetry.push({ label: 'D3-delivered', h: hc });
  await sleep(500); const dup = await hostSideCallback(host, hc, state, RCV_URL);
  const log = fs.readFileSync(path.join(state, 'deliveries.ndjson'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  ev(`forged secret: ${forged}; first valid: ${first}; identical re-send: ${second}; tampered body w/ original sig: ${tamper}`);
  ev(`stale ts (-1h, validly signed): ${stale}; conflicting 2nd terminal status: ${conflicting}; unknown job id: ${crossJob}; stored status stays: ${kept}`);
  ev(`4 concurrent identical deliveries: ${conc.join(', ')}; host resend after container delivered: ${dup.code} ${dup.body}`);
  ev(`completion files for job: 1 (wx create); receiver delivery log lines for job: ${log.filter((l) => l.jobId === h.jobId).length}`);
  m.outcomes = { forged, first, second, tamper, stale, conflicting, crossJob, conc };
  const ok = forged.endsWith('401') && first.startsWith('accepted') && second.startsWith('duplicate') && tamper.endsWith('401') && stale.endsWith('401') && conflicting.startsWith('duplicate') && kept === 'succeeded' && conc.filter((x) => x === 'accepted').length === 1 && dup.body.includes('duplicate');
  return ok ? 'PASS' : 'FAIL';
});

// ---------------- E timeout
await test('E', 'Timeout: budget exceeded', async (ev, m) => {
  const t0 = Date.now();
  const h = await host.start(mkSpec(bare, { budgetSeconds: 5, callback: CB, stub: { mode: 'hang', steps: 1, stepMs: 100 } }));
  const term = await awaitTerminal(host, h, { stateDir: state, pollMs: 200 }); const total = Date.now() - t0; forTelemetry.push({ label: 'E1-timeout-inner', h });
  await sleep(1500); const s = await host.status(h); const r = await host.result(h);
  ev(`E1 in-container watchdog: state=${s.state} reason=${s.reason}; wall ${total} ms for 5 s budget (learned via ${term.via}); usage=${r.usageSource}; branch pushed=${branches(bare).includes('agent/' + h.jobId)}`);
  let cbBody: any = null; try { cbBody = JSON.parse(fs.readFileSync(completionPath(state, h.jobId), 'utf8')); } catch {}
  ev(`E1 callback payload status/reason: ${cbBody?.status}/${cbBody?.reason}`);
  // E2: runner wedged (no watchdog) -> host backstop
  const host2 = new (host.constructor as any)({ stateDir: state, image: IMAGE, ownerId: 'spike3-orch', hardKillGraceMs: 2000 });
  const t1 = Date.now();
  const h2 = await host2.start(mkSpec(bare, { budgetSeconds: 4, runnerWatchdog: false, stub: { mode: 'ignore-sigterm', steps: 1, stepMs: 100 } }));
  // make the stub hang forever: mode ignore-sigterm only ignores sigterm; use hang through a second job spec instead
  await host2.cancel(h2, { graceSeconds: 1 }); fs.rmSync(path.join(host.jobDir(h2.jobId), 'cancel_requested'));
  const h3 = await host2.start(mkSpec(bare, { budgetSeconds: 4, runnerWatchdog: false, stub: { mode: 'hang', steps: 1, stepMs: 100 } }));
  const t2 = Date.now(); let s3; for (;;) { s3 = await host2.status(h3); if (TERMINAL.includes(s3.state)) break; await sleep(250); }
  forTelemetry.push({ label: 'E2-host-backstop', h: h3 });
  const lag = Date.now() - t2; const r3 = await host2.result(h3);
  ev(`E2 no in-container watchdog: host status() poll killed it: state=${s3.state} reason=${s3.reason} inferred=${s3.inferred}; terminal after ${lag} ms of polling (budget 4 s + 2 s grace); usage source=${r3.usageSource}`);
  m.e1 = { wallMs: total, state: s.state, reason: s.reason }; m.e2 = { lagMs: lag, state: s3.state, reason: s3.reason };
  return s.state === 'timed_out' && s3.state === 'timed_out' && s.reason?.startsWith('budget_exceeded') ? 'PASS' : 'FAIL';
});

// ---------------- F orchestrator death
await test('F', 'Orchestrator death, re-attach, orphan reaping', async (ev, m) => {
  const stF = path.join(WORK, 'stateF'); fs.mkdirSync(stF, { recursive: true });
  // F uses the main receiver state dir for the receiver to find secrets: reuse `state`
  const d = spawn('node', ['--no-warnings', path.join(ROOT, 'tests/orch-daemon.ts'), state, bare, String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise<void>((res) => d.stdout!.on('data', (b) => String(b).includes('daemon ready') && res()));
  const known = JSON.parse(fs.readFileSync(path.join(state, 'registry.json'), 'utf8')).known as string[];
  await killProc(d); const tKill = Date.now();
  ev(`orchestrator process SIGKILLed with 3 containers started (2 registered: ${known.join(', ')})`);
  const running = (await docker(['ps', '--filter', 'label=sdlcpoc.managed=true', '--format', '{{.Names}}'])).out.split('\n').filter(Boolean);
  ev(`containers still running after orchestrator death: ${running.length} (${running.join(', ')})`);
  await sleep(3000); // short job finishes while no orchestrator is alive
  const host2 = mkHost(state); // fresh process state: only disk + docker labels
  const A = (await host2.attach(known[0]))!, B = (await host2.attach(known[1]))!;
  const sA = await host2.status(A), sB = await host2.status(B);
  const cbB = fs.existsSync(completionPath(state, B.jobId));
  ev(`restart + attach: long job status=${sA.state}; short job status=${sB.state}, callback recorded while orchestrator was dead: ${cbB}`);
  const rB = await host2.result(B);
  ev(`short job result recovered: branch=${rB.branch} commit=${rB.commit?.slice(0, 8)} usage=${JSON.stringify({ i: rB.usage?.input_tokens, o: rB.usage?.output_tokens })}`);
  // label-only rediscovery
  const listed = await host2.list(); ev(`label-based list() (no registry): ${listed.length} jobs: ${listed.map((x) => x.handle.jobId + ':' + x.status.state).join(', ')}`);
  const reap = await host2.reapOrphans(new Set(known));
  ev(`reapOrphans(known=registry): killed=${reap.killed.join(',')} removed=${reap.removed.join(',')}`);
  const orphanGone = !(await docker(['ps', '-a', '--format', '{{.Names}}'])).out.includes(`sdlcpoc-${reap.removed[0]}`);
  const orphanBranch = reap.removed.length ? branches(bare).includes('agent/' + reap.removed[0]) : null;
  ev(`orphan container gone=${orphanGone}; orphan pushed anything=${orphanBranch}`);
  const t = await awaitTerminal(host2, A, { stateDir: state, pollMs: 300 }); const rA = await host2.result(A);
  forTelemetry.push({ label: 'F-A-recovered', h: A }); forTelemetry.push({ label: 'F-B-recovered', h: B });
  ev(`long job awaited by new orchestrator via ${t.via}: ${rA.status.state}, branch ${rA.branch}, ${Math.round((Date.now() - tKill) / 1000)} s after the kill`);
  // idempotent start adopts rather than duplicates
  const again = await host2.start(mkSpec(bare, { key: 'F-long' }));
  ev(`start() with the same idempotency key after restart returns existing handle: ${again.jobId === A.jobId}`);
  m.recovered = { statusLong: sA.state, statusShortBeforeCb: sB.state, cbWhileDead: cbB, orphansKilled: reap.killed.length };
  return running.length === 3 && sB.state === 'succeeded' && cbB && rA.status.state === 'succeeded' && reap.killed.length === 1 && orphanGone && again.jobId === A.jobId ? 'PASS' : 'FAIL';
});

// ---------------- G concurrency & limits
async function parallel(n: number, ev: (s: string) => void, m: Record<string, unknown>) {
  const t0 = Date.now();
  const hs = await Promise.all(Array.from({ length: n }, (_, i) => host.start(mkSpec(bare, { key: `G${n}-${i}-${Date.now()}`, callback: CB, stub: { steps: 6, stepMs: 400 } }))));
  const startAll = Date.now() - t0;
  await Promise.all(hs.map((h) => awaitTerminal(host, h, { stateDir: state })));
  const total = Date.now() - t0;
  const rs = await Promise.all(hs.map((h) => host.result(h)));
  const okAll = rs.every((r) => r.status.state === 'succeeded');
  const br = branches(bare);
  let isolated = true;
  for (const h of hs) { // each branch holds exactly its own generated.js
    const content = sh('git', ['-C', bare, 'show', `agent/${h.jobId}:src/generated.js`]); if (!content.includes(h.jobId)) isolated = false;
    const files = sh('git', ['-C', bare, 'diff', '--name-only', `main..agent/${h.jobId}`]).split('\n').sort().join(','); if (files !== 'NOTES.md,src/generated.js') isolated = false;
  }
  const cbs = hs.filter((h) => fs.existsSync(completionPath(state, h.jobId))).length;
  hs.forEach((h) => forTelemetry.push({ label: `G${n}`, h }));
  ev(`N=${n}: all succeeded=${okAll}; distinct branches=${new Set(rs.map((r) => r.branch)).size}/${n} present in remote=${hs.every((h) => br.includes('agent/' + h.jobId))}; workspace/branch isolation=${isolated}; callbacks recorded=${cbs}/${n}`);
  ev(`N=${n}: start() fan-out ${startAll} ms; whole batch ${total} ms (single job ~2.7 s)`);
  m['n' + n] = { startAll, total, okAll, isolated, cbs };
  return okAll && isolated && cbs === n;
}
await test('G', 'Concurrency (4 then 8) and resource limits', async (ev, m) => {
  const a = await parallel(4, ev, m); const b = await parallel(8, ev, m);
  const idk = 'G-idem'; const x = await host.start(mkSpec(bare, { key: idk, stub: { steps: 2, stepMs: 300 } })); const y = await host.start(mkSpec(bare, { key: idk }));
  ev(`idempotent start: same id=${x.jobId === y.jobId}; containers with that name=${(await docker(['ps', '-a', '--filter', `name=${x.ref}`, '-q'])).out.split('\n').filter(Boolean).length}`);
  await awaitTerminal(host, x, { stateDir: state });
  // memory limit
  const hm = await host.start(mkSpec(bare, { limits: { memoryMb: 128, cpus: 1, pids: 128 }, stub: { mode: 'memhog', steps: 30, stepMs: 100 } }));
  await awaitTerminal(host, hm, { stateDir: state }); forTelemetry.push({ label: 'G-oom', h: hm });
  const im = JSON.parse((await docker(['inspect', hm.ref])).out)[0]; const sm = await host.status(hm); const rm = await host.result(hm);
  ev(`memory limit 128 MB (HostConfig.Memory=${im.HostConfig.Memory}, swap=${im.HostConfig.MemorySwap}): container OOMKilled=${im.State.OOMKilled} exit=${im.State.ExitCode}; host status=${sm.state}/${sm.reason}; usage source=${rm.usageSource}`);
  const lastAlloc = fs.readFileSync(rm.eventsPath, 'utf8').split('\n').filter((l) => l.includes('"alloc"')).pop();
  ev(`last alloc event before death: ${lastAlloc}`);
  // cpu limit
  const hc = await host.start(mkSpec(bare, { limits: { memoryMb: 256, cpus: 0.5, pids: 128 }, stub: { mode: 'cpuhog', steps: 8, stepMs: 700 } }));
  const samples: number[] = []; await sleep(2500);
  for (let i = 0; i < 4; i++) { const s = (await docker(['stats', '--no-stream', '--format', '{{.CPUPerc}}', hc.ref], { allowFail: true })).out; samples.push(parseFloat(s)); await sleep(300); }
  await awaitTerminal(host, hc, { stateDir: state }); forTelemetry.push({ label: 'G-cpu', h: hc });
  const ihc = JSON.parse((await docker(['inspect', hc.ref])).out)[0];
  ev(`cpu limit 0.5 (NanoCpus=${ihc.HostConfig.NanoCpus}): busy-loop agent sampled CPU% = ${samples.join(', ')} (an unlimited single-thread loop would show ~100)`);
  ev(`pids limit set: ${ihc.HostConfig.PidsLimit}; listening ports used by jobs: 0 (no -p publishes; ports cannot collide); /remote.git is a shared bind mount (concurrent pushes to distinct refs worked)`);
  m.limits = { oomKilled: im.State.OOMKilled, oomStatus: sm.state, cpuSamples: samples, memLimit: im.HostConfig.Memory };
  const cpuOk = samples.filter((s) => !isNaN(s)).every((s) => s < 75) && samples.some((s) => s > 25);
  return a && b && im.State.OOMKilled !== undefined && cpuOk && sm.state === 'oom_killed' ? 'PASS' : 'PARTIAL';
});

// ---------------- S secrets
await test('S', 'Secrets: file mount vs env var visibility', async (ev, m) => {
  const hf = await host.start(mkSpec(bare, { callback: CB, stub: { steps: 8, stepMs: 400 } }));
  const he = await host.start(mkSpec(bare, { callback: CB, secrets: { jobToken: 'tok_dummy_ENVMODE_' + crypto.randomBytes(6).toString('hex'), mode: 'env' }, stub: { steps: 8, stepMs: 400 } }));
  const tokF = fs.readFileSync(path.join(host.jobDir(hf.jobId), 'secrets/job_token'), 'utf8');
  const tokE = JSON.parse((await docker(['inspect', he.ref])).out)[0].Config.Env.find((e: string) => e.startsWith('JOB_TOKEN='))?.slice(10);
  const cbF = fs.readFileSync(path.join(host.jobDir(hf.jobId), 'secrets/callback_secret'), 'utf8');
  const has = (hay: string, needle: string) => hay.includes(needle);
  const hist = (await docker(['history', '--no-trunc', IMAGE])).out + (await docker(['inspect', IMAGE])).out;
  const inspF = (await docker(['inspect', hf.ref])).out, inspE = (await docker(['inspect', he.ref])).out;
  await sleep(1000);
  const logsF = (await drain(host, hf)).join('\n'), logsE = (await drain(host, he)).join('\n');
  const execOut = (await docker(['exec', hf.ref, 'sh', '-c', 'cat /run/secrets/job_token; echo; ls -l /run/secrets; id -u'], { allowFail: true })).out;
  const procEnvE = (await docker(['exec', he.ref, 'sh', '-c', "tr '\\0' '\\n' < /proc/1/environ | grep -c JOB_TOKEN; ps -o pid,args | head -5"], { allowFail: true })).out;
  const agentEnvHasTok = (await docker(['exec', hf.ref, 'sh', '-c', "for p in /proc/[0-9]*; do tr '\\0' '\\n' < $p/environ 2>/dev/null; done | grep -c -E 'tok_dummy|CALLBACK_SECRET'; true"], { allowFail: true })).out;
  await awaitTerminal(host, hf, { stateDir: state }); await awaitTerminal(host, he, { stateDir: state });
  const outF = fs.readdirSync(path.join(host.jobDir(hf.jobId), 'out')).map((f) => fs.readFileSync(path.join(host.jobDir(hf.jobId), 'out', f), 'utf8')).join('\n');
  const rep = (label: string, v: boolean) => ev(`${label}: ${v ? 'VISIBLE' : 'not visible'}`);
  rep('image layers/history/inspect (file mode token)', has(hist, tokF)); rep('image layers (env-mode token)', has(hist, tokE));
  rep('`docker inspect <container>` file-mode token', has(inspF, tokF)); rep('`docker inspect <container>` env-mode token', has(inspE, tokE));
  rep('callback secret in docker inspect', has(inspF, cbF));
  rep('docker logs file-mode', has(logsF, tokF)); rep('docker logs env-mode', has(logsE, tokE));
  rep('events.ndjson/out dir (file mode)', has(outF, tokF) || has(outF, cbF));
  ev(`inside container (docker exec, same uid as agent): file readable=${has(execOut, tokF)} -> ${execOut.replace(/\n/g, ' | ').slice(0, 160)}`);
  ev(`env mode: token is in PID1 /proc environ: count=${procEnvE.split('\n')[0]}`);
  ev(`secrets in env of any process in file-mode container (runner strips them from the agent env): matches=${agentEnvHasTok}`);
  ev(`host disk: ${path.join(host.jobDir(hf.jobId), 'secrets')} (mode 0600 files, removed by cleanup(); also readable by anyone with docker socket access)`);
  m.visible = { imageFile: has(hist, tokF), inspectFile: has(inspF, tokF), inspectEnv: has(inspE, tokE), logsFile: has(logsF, tokF) };
  await host.cleanup(hf); await host.cleanup(he);
  return !has(hist, tokF) && !has(hist, tokE) && !has(inspF, tokF) && has(inspE, tokE) && !has(logsF, tokF) && !has(logsE, tokE) ? 'PASS' : 'FAIL';
});

// ---------------- H telemetry on failure/cancel
await test('H', 'Telemetry retrievable on fail/cancel/timeout/OOM/kill', async (ev, m) => {
  const hf = await host.start(mkSpec(bare, { callback: CB, stub: { mode: 'fail', steps: 4, stepMs: 200 } }));
  await awaitTerminal(host, hf, { stateDir: state }); forTelemetry.push({ label: 'H-agent-fails', h: hf });
  // Remove every container first: results must come from the out dir alone
  for (const { h } of forTelemetry) await docker(['rm', '-f', h.ref], { allowFail: true });
  const wanted = ['H-agent-fails', 'B1', 'B2', 'B3', 'E1', 'E2', 'G-oom', 'C-callback-lost', 'F-A-recovered'];
  let good = 0, total = 0; const rows: string[] = [];
  for (const { label, h } of forTelemetry) {
    if (!wanted.some((w) => label.startsWith(w))) continue; total++;
    const r = await host.result(h); const evCount = fs.existsSync(r.eventsPath) ? fs.readFileSync(r.eventsPath, 'utf8').split('\n').filter(Boolean).length : 0;
    const has = evCount > 0 && r.usage != null; if (has) good++;
    rows.push(`${label}: state=${r.status.state}${r.status.reason ? '(' + r.status.reason + ')' : ''} events=${evCount} usage=${r.usageSource}${r.usage ? ' in=' + r.usage.input_tokens + (r.usage.partial ? ' partial' : '') : ''}`);
  }
  rows.forEach((r) => ev(r));
  ev('(all containers removed before reading: telemetry survives because runner appends events.ndjson to a host-mounted /out; docker logs are gone)');
  const logsGone = (await docker(['logs', forTelemetry[0].h.ref], { allowFail: true })).ok === false; ev(`docker logs after rm: unavailable=${logsGone}`);
  m.good = good; m.total = total;
  return good === total ? 'PASS' : 'PARTIAL';
});

await killProc(rcv);
await cleanAll();
fs.mkdirSync(path.join(ROOT, 'results'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'results/results.json'), JSON.stringify({ initialBuildMs, results }, null, 2));
console.log('\n=== SUMMARY ===');
for (const r of results) console.log(`${r.verdict.padEnd(7)} ${r.id}  ${r.name}  (${r.ms} ms)`);
