import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const HERE = fileURLToPath(new URL('.', import.meta.url));
export function freshData(name: string) { const d = join(HERE, '..', 'data', `langgraph-${name}`); rmSync(d, { recursive: true, force: true }); mkdirSync(d, { recursive: true }); process.env.DATA_DIR = d; return d; }
/** run a runner.ts command in a child process; returns handle with .done (parsed output) */
export function run(args: string[], env: Record<string, string> = {}) {
  const p = spawn(process.execPath, ['--import', 'tsx', join(HERE, 'runner.ts'), ...args], { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; p.stdout!.on('data', (b) => (out += b)); p.stderr!.on('data', (b) => (out += 'STDERR ' + b));
  const done = new Promise<{ code: number | null; sig: string | null; out: string; res: any }>((r) => p.on('exit', (code, sig) => {
    const m = out.match(/^RESULT (.*)$/m); r({ code, sig, out, res: m ? JSON.parse(m[1]) : null });
  }));
  return { p, done };
}
export const kill9 = (p: ChildProcess) => new Promise<void>((r) => { p.once('exit', () => r()); p.kill('SIGKILL'); });
export async function waitFor(fn: () => any, ms = 30000) { const t = Date.now(); while (Date.now() - t < ms) { const v = await fn(); if (v) return v; await sleep(100); } throw new Error('waitFor timeout'); }
let n = 0; export const rid = (p: string) => `${p}-${Date.now().toString(36)}-${n++}`;
export function verdict(name: string, ok: boolean, evidence: any) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); console.log(typeof evidence === 'string' ? evidence : JSON.stringify(evidence, null, 1)); return ok; }
