import { describe, it, expect } from 'vitest';
import os from 'node:os';
import { startGraphWorker, checkGraphInstalled } from '../src/adapters/g/worker.ts';

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

describe('graph worker lifecycle', () => {
  it('waits for the up line, passes the per-run queue, and group-kills on stop', async () => {
    const script = "console.log('[worker] up q=' + process.env.TEMPORAL_TASK_QUEUE); setInterval(()=>{}, 1000)";
    const w = await startGraphWorker({ graphRoot: os.tmpdir(), queue: 'q-test', command: { exe: process.execPath, args: ['-e', script] } });
    const pid = w.proc.pid!;
    expect(alive(pid)).toBe(true);
    await w.stop();
    await w.stop(); // idempotent, tolerates ESRCH
    expect(alive(pid)).toBe(false);
  });
  it('fails with a one-line error when the worker exits before it is up', async () => {
    await expect(startGraphWorker({ graphRoot: os.tmpdir(), queue: 'q', command: { exe: process.execPath, args: ['-e', "console.error('boom'); process.exit(3)"] } })).rejects.toThrow(/exited early \(code 3\).*boom/);
  });
  it('times out when the up line never appears', async () => {
    await expect(startGraphWorker({ graphRoot: os.tmpdir(), queue: 'q', upTimeoutMs: 300, command: { exe: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'] } })).rejects.toThrow(/not up within/);
  });
  it('precondition: missing graph/node_modules is a one-line error', () => {
    expect(() => checkGraphInstalled(os.tmpdir() + '/nonexistent-graph')).toThrow(/node_modules is missing/);
  });
});
