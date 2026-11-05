import { Client, Connection } from '@temporalio/client';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const HERE = fileURLToPath(new URL('.', import.meta.url));
export async function client() { return new Client({ connection: await Connection.connect({ address: '127.0.0.1:7233' }) }); }
export function freshData(name: string) {
  const d = join(HERE, '..', 'data', `temporal-${name}`); rmSync(d, { recursive: true, force: true }); mkdirSync(d, { recursive: true });
  process.env.DATA_DIR = d; return d;
}
export async function startWorker(): Promise<ChildProcess> {
  const p = spawn(process.execPath, ['--import', 'tsx', join(HERE, 'worker.ts')], { env: process.env, stdio: ['ignore', 'pipe', 'ignore'] });
  await new Promise<void>((res) => p.stdout!.on('data', (b) => String(b).includes('worker up') && res()));
  return p;
}
export const kill9 = (p: ChildProcess) => new Promise<void>((r) => { p.once('exit', () => r()); p.kill('SIGKILL'); });
export async function waitFor(fn: () => any | Promise<any>, ms = 30000, every = 100) {
  const t = Date.now(); while (Date.now() - t < ms) { const v = await fn(); if (v) return v; await sleep(every); } throw new Error('waitFor timeout');
}
let n = 0; export const rid = (p: string) => `${p}-${Date.now().toString(36)}-${n++}`;
export function verdict(name: string, ok: boolean, evidence: any) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); console.log(typeof evidence === 'string' ? evidence : JSON.stringify(evidence, null, 1)); return ok; }
