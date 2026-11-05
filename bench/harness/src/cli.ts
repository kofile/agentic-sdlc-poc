// bench CLI: run, report, export.
import { parseArgs } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseStageRange } from './record.ts';
import { getAdapter, listContenders } from './adapters/registry.ts';
import fs from 'node:fs';
import { executeRun } from './core/run.ts';
import { buildReport, renderReport } from './report.ts';
import { exportJsonl } from './export.ts';

export interface CliIO {
  out: (s: string) => void;
  err: (s: string) => void;
}

/** Suppress only node:sqlite's ExperimentalWarning; every other warning still prints. */
export function filterSqliteWarning(): void {
  const orig = process.emitWarning.bind(process);
  process.emitWarning = ((warning: string | Error, ...args: unknown[]) => {
    const name = warning instanceof Error ? warning.name : typeof args[0] === 'string' ? args[0] : (args[0] as { type?: string } | undefined)?.type;
    const message = warning instanceof Error ? warning.message : String(warning);
    if (name === 'ExperimentalWarning' && /sqlite/i.test(message)) return;
    return (orig as (...a: unknown[]) => void)(warning, ...args);
  }) as typeof process.emitWarning;
}

const USAGE = `usage: bench run --contender <id> --ticket <Tnn> --rep <n> --stages <from>..<to> --seed-order <n> [--set dev|heldout]
       bench report [--format md|json] [--include-stub]
       bench export --out <file>`;

async function runCommand(argv: string[], env: NodeJS.ProcessEnv, io: CliIO): Promise<number> {
  const fail = (msg: string): number => {
    io.err(`bench run: ${msg}`);
    return 1;
  };
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: {
        contender: { type: 'string' },
        ticket: { type: 'string' },
        rep: { type: 'string' },
        stages: { type: 'string' },
        'seed-order': { type: 'string' },
        set: { type: 'string', default: 'dev' },
      },
      strict: true,
    }));
  } catch (e) {
    return fail((e as Error).message.split('\n')[0]);
  }
  if (!values.contender) return fail('missing --contender');
  const adapter = getAdapter(values.contender);
  if (!adapter) return fail(`unknown contender "${values.contender}" (known: ${listContenders().join(', ')})`);
  if (!values.ticket) return fail('missing --ticket');
  if (!/^T\d{2,}$/.test(values.ticket)) return fail(`malformed ticket "${values.ticket}" (expected Tnn, e.g. T07)`);
  if (values.rep === undefined) return fail('missing --rep');
  if (!/^\d+$/.test(values.rep)) return fail(`malformed rep "${values.rep}" (expected a non-negative integer)`);
  if (!values.stages) return fail('missing --stages');
  let stages;
  try {
    stages = parseStageRange(values.stages);
  } catch (e) {
    return fail((e as Error).message);
  }
  const seedRaw = values['seed-order'];
  if (seedRaw === undefined) return fail('missing --seed-order');
  if (!/^\d+$/.test(seedRaw)) return fail(`malformed seed-order "${seedRaw}" (expected a non-negative integer)`);
  const set = values.set;
  if (set !== 'dev' && set !== 'heldout') return fail(`invalid --set "${set}" (expected dev or heldout)`);

  filterSqliteWarning();
  const { openStore } = await import('./store.ts');
  const store = openStore(env.BENCH_DB ?? './bench.sqlite');
  try {
    const res = await executeRun({
      store,
      adapter,
      ticket: values.ticket,
      rep: Number(values.rep),
      stages,
      seedOrder: Number(seedRaw),
      set,
      artifactsRoot: env.BENCH_ARTIFACTS ?? './artifacts',
    });
    if (res.status === 'failed') return fail(`run ${res.run_id} failed: ${res.error}`);
    io.out(`${res.run_id} completed (${res.stored} stage records)`);
    return 0;
  } catch (e) {
    return fail((e as Error).message.split('\n')[0]);
  } finally {
    store.close();
  }
}

async function readCommand(cmd: 'report' | 'export', argv: string[], env: NodeJS.ProcessEnv, io: CliIO): Promise<number> {
  const fail = (msg: string): number => {
    io.err(`bench ${cmd}: ${msg}`);
    return 1;
  };
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options:
        cmd === 'report'
          ? { format: { type: 'string', default: 'md' }, 'include-stub': { type: 'boolean', default: false } }
          : { out: { type: 'string' } },
      strict: true,
    }));
  } catch (e) {
    return fail((e as Error).message.split('\n')[0]);
  }
  const v = values as { format?: string; 'include-stub'?: boolean; out?: string };
  if (cmd === 'report' && v.format !== 'md' && v.format !== 'json') return fail(`invalid --format "${v.format}" (expected md or json)`);
  if (cmd === 'export' && !v.out) return fail('missing --out');
  filterSqliteWarning();
  const { openStore } = await import('./store.ts');
  const store = openStore(env.BENCH_DB ?? './bench.sqlite');
  try {
    if (cmd === 'report') {
      io.out(renderReport(buildReport(store, { includeStub: v['include-stub'] }), v.format as 'md' | 'json'));
    } else {
      const lines = exportJsonl(store);
      fs.mkdirSync(path.dirname(path.resolve(v.out!)), { recursive: true });
      fs.writeFileSync(v.out!, lines.map((l) => l + '\n').join(''));
      io.out(`exported ${lines.length} records to ${v.out}`);
    }
    return 0;
  } catch (e) {
    return fail((e as Error).message.split('\n')[0]);
  } finally {
    store.close();
  }
}

export async function main(argv: string[], env: NodeJS.ProcessEnv = process.env, io?: CliIO): Promise<number> {
  const out: CliIO = io ?? { out: (s) => console.log(s), err: (s) => console.error(s) };
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case 'run':
      return runCommand(rest, env, out);
    case 'report':
    case 'export':
      return readCommand(cmd, rest, env, out);
    default:
      out.err(cmd ? `bench: unknown command "${cmd}"\n${USAGE}` : USAGE);
      return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
