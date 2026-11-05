// Stub "coding agent": emits stream-json-like events, edits files, runs the test command, writes usage.json. No LLM.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const cfg = JSON.parse(process.env.STUB_CONFIG || '{}');
const steps = cfg.steps ?? 5;
const stepMs = cfg.stepMs ?? 400;
const mode = cfg.mode ?? 'ok';
const OUT = process.env.OUT_DIR || '/out';
const prompt = fs.readFileSync(process.env.PROMPT_FILE, 'utf8');
let usage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0 };
const emit = (o) => console.log(JSON.stringify(o));
const writeUsage = (extra = {}) => {
  const body = { ...usage, total_cost_usd: +(usage.input_tokens * 2e-6 + usage.output_tokens * 1e-5).toFixed(6), model: 'stub-model', fake: true, ...extra };
  fs.writeFileSync(OUT + '/usage.json.tmp', JSON.stringify(body));
  fs.renameSync(OUT + '/usage.json.tmp', OUT + '/usage.json');
};
if (mode === 'ignore-sigterm') process.on('SIGTERM', () => emit({ type: 'system', subtype: 'sigterm_ignored' }));
else process.on('SIGTERM', () => {
  emit({ type: 'result', subtype: 'interrupted', is_error: true, usage });
  writeUsage({ partial: true });
  process.exit(143);
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

emit({ type: 'system', subtype: 'init', session_id: 'stub-' + process.pid, model: 'stub-model', cwd: process.cwd(), tools: ['Read', 'Edit', 'Bash'] });
for (let i = 1; i <= steps; i++) {
  usage.input_tokens += 1000 + i * 10; usage.output_tokens += 200 + i;
  emit({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: `step ${i}/${steps} on: ${prompt.split('\n')[0].slice(0, 60)}` }], usage: { ...usage } } });
  if (i === 2) {
    fs.appendFileSync('NOTES.md', `- stub edit for prompt: ${prompt.split('\n')[0]}\n`);
    fs.mkdirSync('src', { recursive: true });
    fs.writeFileSync('src/generated.js', `export const generated = ${JSON.stringify(process.env.JOB_ID)};\n`);
    emit({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Edit', input: { file_path: 'NOTES.md' } }] } });
  }
  if (mode === 'memhog') { globalThis.__hog = (globalThis.__hog || []).concat(Buffer.alloc(32 * 1024 * 1024, 1)); emit({ type: 'system', subtype: 'alloc', mb: globalThis.__hog.length * 32 }); continue; }
  if (mode === 'cpuhog') { const end = Date.now() + stepMs; while (Date.now() < end); } else await sleep(stepMs);
  if (mode === 'fail' && i === 2) {
    emit({ type: 'result', subtype: 'error_during_execution', is_error: true, usage });
    writeUsage({ partial: true });
    process.exit(1);
  }
}
if (mode === 'hang') { emit({ type: 'system', subtype: 'hanging' }); await sleep(3600_000); }
const t = spawnSync('sh', ['-c', process.env.TEST_COMMAND || 'true'], { encoding: 'utf8' });
emit({ type: 'user', message: { content: [{ type: 'tool_result', is_error: t.status !== 0, content: (t.stdout + t.stderr).slice(-300) }] } });
writeUsage();
emit({ type: 'result', subtype: t.status === 0 ? 'success' : 'error_tests_failed', is_error: t.status !== 0, duration_ms: steps * stepMs, total_cost_usd: 0.01, usage });
process.exit(t.status === 0 ? 0 : 1);
