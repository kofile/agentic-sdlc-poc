// TEST E: gate policy as data
import { freshData, run, rid, verdict } from '../lib.ts';
import { writeFileSync, readFileSync } from 'node:fs'; import { fileURLToPath } from 'node:url';
freshData('e'); let ok = true;
const a = rid('E1'); const ra = await run(['start', a, 'auto-design', '{"executeMs":200}']).done;
ok = verdict('E1 team auto-design: no human pause, completes unattended', ra.res.values.status === 'merged', ra.res.values.log) && ok;
const b = rid('E2'); const rb = await run(['start', b, 'default', '{"executeMs":200}']).done;
ok = verdict('E2 team default: pauses at design gate', rb.res.interrupts[0]?.gate === 'design', rb.res.interrupts) && ok;
const f = fileURLToPath(new URL('../../teams/default.json', import.meta.url)); const orig = readFileSync(f, 'utf8');
writeFileSync(f, JSON.stringify({ team: 'default', gates: { design: 'auto', plan: 'auto', merge: 'auto' }, humanTimeoutSec: 3600 }));
const c = rid('E3'); const rc = await run(['start', c, 'default', '{"executeMs":200}']).done; const still = await run(['state', b]).done; writeFileSync(f, orig);
ok = verdict('E3 config flipped to design:auto: NEW run skips gate; in-flight run keeps snapshot (still paused)', rc.res.values.status === 'merged' && still.res.interrupts[0]?.gate === 'design', { newRun: rc.res.values.log, inFlight: still.res.interrupts }) && ok;
process.exit(ok ? 0 : 1);
