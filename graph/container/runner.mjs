// In-container runner: clone -> stub agent -> commit -> push -> callback. Enforces the time budget itself.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import crypto from 'node:crypto';

const spec = JSON.parse(fs.readFileSync('/job/job.json', 'utf8'));
const OUT = '/out';
const t0 = Date.now();
const evl = (o) => { const l = JSON.stringify({ ts: new Date().toISOString(), src: 'runner', ...o }); fs.appendFileSync(OUT + '/events.ndjson', l + '\n'); console.log(l); };
const readSecret = (name, env) => { try { return fs.readFileSync('/run/secrets/' + name, 'utf8').trim(); } catch { return process.env[env] || null; } };
const token = readSecret('job_token', 'JOB_TOKEN');
const cbSecret = readSecret('callback_secret', 'CALLBACK_SECRET');
const branch = `agent/${spec.jobId}`;
let terminated = false, timedOut = false, agent = null;

const git = (args, opts = {}) => spawnSync('git', args, { encoding: 'utf8', ...opts });
const writeResult = (r) => { fs.writeFileSync(OUT + '/result.json.tmp', JSON.stringify(r, null, 2)); fs.renameSync(OUT + '/result.json.tmp', OUT + '/result.json'); };

async function callback(payload) {
  if (!spec.callback?.url || !cbSecret) return { attempted: false };
  const attempts = spec.callback.attempts ?? 4; let n = 0, lastErr = '';
  for (; n < attempts; n++) {
    const body = JSON.stringify({ ...payload, deliveryId: crypto.randomUUID(), emittedAt: new Date().toISOString(), source: 'container' });
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = 'sha256=' + crypto.createHmac('sha256', cbSecret).update(`${ts}.${body}`).digest('hex');
    try {
      const r = await fetch(spec.callback.url, { method: 'POST', body, headers: { 'content-type': 'application/json', 'x-job-id': spec.jobId, 'x-timestamp': ts, 'x-signature': sig }, signal: AbortSignal.timeout(2000) });
      if (r.ok) return { attempted: true, delivered: true, attempts: n + 1 };
      lastErr = 'http ' + r.status; if (r.status < 500) break;
    } catch (e) { lastErr = String(e.cause?.code || e.message); }
    await new Promise((r) => setTimeout(r, 500 * 2 ** n));
  }
  const used = Math.min(n + 1, attempts);
  evl({ type: 'callback_failed', attempts: used, error: lastErr });
  return { attempted: true, delivered: false, attempts: used, error: lastErr };
}

async function finish(status, reason, extra = {}) {
  let usage = null; try { usage = JSON.parse(fs.readFileSync(OUT + '/usage.json', 'utf8')); } catch {}
  const res = { jobId: spec.jobId, status, reason, durationMs: Date.now() - t0, ...extra };
  writeResult({ ...res, callback: { attempted: 'pending' } });
  evl({ type: 'runner', phase: 'finished', status, reason });
  const cb = await callback({ ...res, usage });
  writeResult({ ...res, callback: cb });
  process.exit(status === 'succeeded' ? 0 : status === 'terminated' ? 143 : 1);
}

process.on('SIGTERM', () => {
  terminated = true; evl({ type: 'runner', phase: 'sigterm_received' });
  if (agent) { agent.kill('SIGTERM'); setTimeout(() => agent.kill('SIGKILL'), 3000).unref(); } else finish('terminated', 'sigterm');
});

evl({ type: 'runner', phase: 'started', jobId: spec.jobId, tokenPresent: !!token, tokenLength: token ? token.length : 0 });
if (spec.runnerWatchdog !== false) setTimeout(() => {
  timedOut = true; evl({ type: 'runner', phase: 'budget_exceeded', budgetSeconds: spec.budgetSeconds });
  if (agent) { agent.kill('SIGTERM'); setTimeout(() => agent.kill('SIGKILL'), 3000).unref(); } else finish('timed_out', `budget_exceeded:${spec.budgetSeconds}s`);
}, spec.budgetSeconds * 1000).unref();

const repo = '/work/repo';
let r = git(['clone', '-q', 'file:///remote.git', repo]);
if (r.status) await finish('failed', 'clone_failed', { detail: r.stderr.slice(-300) });
r = git(['checkout', '-q', '-b', branch, spec.baseRef], { cwd: repo });
if (r.status) await finish('failed', 'checkout_failed', { detail: r.stderr.slice(-300) });
evl({ type: 'runner', phase: 'clone_done', ms: Date.now() - t0 });

agent = spawn('node', ['/app/stub-agent.mjs'], { cwd: repo, env: { PATH: process.env.PATH, HOME: process.env.HOME, JOB_ID: spec.jobId, PROMPT_FILE: '/job/prompt.md', OUT_DIR: OUT, TEST_COMMAND: spec.testCommand, STUB_CONFIG: JSON.stringify(spec.stub || {}) } }); // note: secrets NOT passed to agent env
let buf = '';
agent.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); fs.appendFileSync(OUT + '/events.ndjson', l + '\n'); console.log(l); } });
agent.stderr.on('data', (d) => process.stderr.write(d));
let sig = null;
const code = await new Promise((res) => agent.on('exit', (c, s) => { sig = s; res(c ?? 128); }));
if (sig && !timedOut && !terminated) evl({ type: 'runner', phase: 'agent_killed_by_signal', signal: sig });
if (timedOut) await finish('timed_out', `budget_exceeded:${spec.budgetSeconds}s`, { exitCode: code });
if (terminated) await finish('terminated', 'sigterm', { exitCode: code });
if (code !== 0) await finish('failed', sig ? `agent_killed_${sig}` : 'agent_exit_' + code, { exitCode: code, signal: sig });

git(['add', '-A'], { cwd: repo });
r = git(['commit', '-q', '-m', `agent(${spec.jobId}): ${fs.readFileSync('/job/prompt.md', 'utf8').split('\n')[0].slice(0, 60)}`], { cwd: repo });
if (r.status) await finish('failed', 'nothing_to_commit', { detail: r.stdout + r.stderr });
const commit = git(['rev-parse', 'HEAD'], { cwd: repo }).stdout.trim();
fs.writeFileSync(OUT + '/patch.diff', git(['format-patch', '--stdout', `${spec.baseRef}..HEAD`], { cwd: repo }).stdout);
r = git(['push', '-q', 'origin', branch], { cwd: repo });
if (r.status) await finish('failed', 'push_failed', { detail: r.stderr.slice(-300), commit });
evl({ type: 'runner', phase: 'pushed', branch, commit });
await finish('succeeded', 'ok', { branch, commit, exitCode: 0 });
