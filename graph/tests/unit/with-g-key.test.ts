// Launcher + smoke-script tests: fake `security` on PATH, dummy key, no Keychain, no network.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const GRAPH = path.resolve(here, '../..');
const LAUNCHER = path.join(GRAPH, 'scripts/with-g-key.sh');
const SMOKE = path.join(GRAPH, 'scripts/smoke-triage.ts');
const DUMMY = 'dummy-not-a-key';
const SERVICE = 'bench-test-dummy';

let tmp: string;
let binDir: string;
let childTmp: string;

function env(extra: Record<string, string | undefined> = {}) {
  return {
    PATH: `${binDir}:${process.env.PATH}`,
    HOME: process.env.HOME ?? '',
    USER: process.env.USER ?? 'tester',
    TMPDIR: childTmp,
    G_KEY_SERVICE: SERVICE,
    ...extra,
  } as NodeJS.ProcessEnv;
}

function run(args: string[], extra: Record<string, string | undefined> = {}) {
  return spawnSync('bash', [LAUNCHER, ...args], { env: env(extra), encoding: 'utf8' });
}

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'with-g-key-test-'));
  binDir = path.join(tmp, 'bin');
  childTmp = path.join(tmp, 'tmpdir');
  fs.mkdirSync(binDir);
  fs.mkdirSync(childTmp);
  // Fake security: prints the dummy key only for the dummy service, else fails like the real one.
  fs.writeFileSync(path.join(binDir, 'security'), [
    '#!/bin/sh',
    `while [ $# -gt 0 ]; do [ "$1" = "-s" ] && svc="$2"; shift; done`,
    `if [ "$svc" = "${SERVICE}" ]; then echo "${DUMMY}"; exit 0; fi`,
    'echo "security: item could not be found" >&2; exit 44',
    '',
  ].join('\n'), { mode: 0o755 });
});

afterAll(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

describe('with-g-key.sh', () => {
  it('is executable', () => {
    expect(fs.statSync(LAUNCHER).mode & 0o111).not.toBe(0);
  });

  it('gives the child a 0600 key file and GRAPH_REASONING, then removes the file', () => {
    const child = `
      const fs = require('fs');
      const f = process.env.ANTHROPIC_API_KEY_FILE;
      console.log(JSON.stringify({
        f, exists: fs.existsSync(f), mode: (fs.statSync(f).mode & 0o777).toString(8),
        reasoning: process.env.GRAPH_REASONING, hasKey: fs.readFileSync(f, 'utf8').trim() === ${JSON.stringify(DUMMY)},
        keyInEnv: Object.values(process.env).some((v) => v === ${JSON.stringify(DUMMY)}),
      }));`;
    const r = run([process.execPath, '-e', child]);
    expect(r.status).toBe(0);
    const seen = JSON.parse(r.stdout.trim());
    expect(seen.exists).toBe(true);
    expect(seen.mode).toBe('600');
    expect(seen.reasoning).toBe('anthropic');
    expect(seen.hasKey).toBe(true);
    expect(seen.keyInEnv).toBe(false);
    expect(fs.existsSync(seen.f)).toBe(false);
    expect(r.stdout).not.toContain(DUMMY);
    expect(r.stderr).not.toContain(DUMMY);
  });

  it('propagates a failing child exit code and still removes the file', () => {
    const child = `console.log(process.env.ANTHROPIC_API_KEY_FILE); process.exit(7);`;
    const r = run([process.execPath, '-e', child]);
    expect(r.status).toBe(7);
    const f = r.stdout.trim();
    expect(f.length).toBeGreaterThan(0);
    expect(fs.existsSync(f)).toBe(false);
  });

  it('fails naming the service when the Keychain item is missing, leaking no key', () => {
    const r = run([process.execPath, '-e', 'process.exit(0)'], { G_KEY_SERVICE: 'bench-test-missing' });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('bench-test-missing');
    expect(r.stdout).not.toContain(DUMMY);
    expect(r.stderr).not.toContain(DUMMY);
    expect(fs.readdirSync(childTmp)).toEqual([]);
  });
});

describe('smoke-triage.ts', () => {
  it('refuses without GRAPH_REASONING=anthropic (no network)', () => {
    const r = spawnSync(process.execPath, ['--import', 'tsx', SMOKE], {
      cwd: GRAPH, encoding: 'utf8',
      env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '' } as NodeJS.ProcessEnv,
    });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('GRAPH_REASONING=anthropic');
    expect(r.stdout).toBe('');
  });
});
