import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DockerExecuteHost, docker } from '../src/docker-host.ts';
import type { JobSpec, JobHandle } from '../src/types.ts';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const WORK = path.join(ROOT, '.work');
export const IMAGE = 'sdlcpoc-exec:spike3';
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const sh = (cmd: string, args: string[], cwd?: string) => execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

export function makeRemote(name = 'remote.git') {
  const bare = path.join(WORK, name); const seed = path.join(WORK, 'seed-' + name);
  fs.rmSync(bare, { recursive: true, force: true }); fs.rmSync(seed, { recursive: true, force: true });
  sh('git', ['init', '-q', '--bare', '-b', 'main', bare]);
  fs.mkdirSync(path.join(seed, 'src'), { recursive: true }); fs.mkdirSync(path.join(seed, 'test'), { recursive: true });
  fs.writeFileSync(path.join(seed, 'package.json'), '{"name":"seed","type":"module"}\n');
  fs.writeFileSync(path.join(seed, 'src/add.js'), 'export const add = (a, b) => a + b;\n');
  fs.writeFileSync(path.join(seed, 'test/add.test.js'), "import test from 'node:test'; import assert from 'node:assert'; import { add } from '../src/add.js';\ntest('add', () => assert.equal(add(1, 2), 3));\n");
  fs.writeFileSync(path.join(seed, 'NOTES.md'), '# notes\n');
  const g = (...a: string[]) => sh('git', ['-C', seed, '-c', 'user.name=seed', '-c', 'user.email=s@example.invalid', ...a]);
  g('init', '-q', '-b', 'main'); g('add', '-A'); g('commit', '-q', '-m', 'seed'); g('remote', 'add', 'origin', bare); g('push', '-q', 'origin', 'main');
  return bare;
}
export const branches = (bare: string) => sh('git', ['-C', bare, 'for-each-ref', '--format=%(refname:short)', 'refs/heads']).split('\n').filter(Boolean);

export function mkHost(stateDir: string, ownerId = 'spike3-orch') { return new DockerExecuteHost({ stateDir, image: IMAGE, ownerId }); }

export function promptFile(text = 'Add a generated module and note it in NOTES.md\nDetails: stub task.') { const p = path.join(WORK, 'prompt.md'); fs.writeFileSync(p, text); return p; }

let seq = 0;
export function mkSpec(bare: string, over: Partial<JobSpec> & { key?: string } = {}): JobSpec {
  const { key, ...rest } = over;
  return {
    idempotencyKey: key ?? `job-${Date.now()}-${seq++}`,
    repo: { url: bare, baseRef: 'main' },
    promptFile: promptFile(), budgetSeconds: 60, limits: { memoryMb: 256, cpus: 1, pids: 256 },
    testCommand: 'node --test', secrets: { jobToken: 'tok_dummy_' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) },
    stub: { steps: 4, stepMs: 300 }, ...rest,
  };
}

export async function startReceiver(stateDir: string, port: number): Promise<ChildProcess> {
  const p = spawn('node', ['--no-warnings', path.join(ROOT, 'src/receiver.ts'), '--port', String(port), '--state', stateDir], { stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise<void>((res, rej) => { p.stdout!.once('data', () => res()); p.once('exit', () => rej(new Error('receiver died'))); });
  return p;
}
export async function killProc(p: ChildProcess) { if (p.exitCode === null) { p.kill('SIGKILL'); await new Promise((r) => p.once('exit', r)); } }

export async function firstEventLatency(host: ReturnType<typeof mkHost>, h: JobHandle, t0: number, match = (l: string) => l.includes('"subtype":"init"') && l.includes('"type":"system"') && !l.includes('"src"')) {
  for await (const l of host.logs(h, { follow: true })) if (match(l.text)) return l.receivedAt - t0;
  return -1;
}
export async function drain(host: ReturnType<typeof mkHost>, h: JobHandle) { const out: string[] = []; for await (const l of host.logs(h)) out.push(l.text); return out; }
export const cleanAll = async () => {
  const r = await docker(['ps', '-aq', '--filter', 'label=sdlcpoc.managed=true'], { allowFail: true });
  for (const id of r.out.split('\n').filter(Boolean)) await docker(['rm', '-f', id], { allowFail: true });
};
