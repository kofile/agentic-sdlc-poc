import { describe, it, expect } from 'vitest';
import { newGateState, pollGates, gateStage, type GateHandle } from '../src/adapters/g/gates.ts';

function fake(states: unknown[]) {
  const signals: { name: string; arg: unknown }[] = [];
  let i = 0;
  const handle: GateHandle = {
    async query() {
      return states[Math.min(i++, states.length - 1)];
    },
    async signal(name, arg) {
      signals.push({ name, arg });
    },
  };
  return { handle, signals };
}
const idle = { step: 'triage', waiting: null, log: [], ignoredDuplicates: 0 };
const waiting = (gate: string, round: number) => ({ step: `waiting:${gate}`, waiting: { gate, round }, log: [], ignoredDuplicates: 0 });

describe('scripted gate approver', () => {
  it('team auto: nothing waiting means no signals and no events', async () => {
    const { handle, signals } = fake([idle, idle, idle]);
    const st = newGateState();
    for (let i = 0; i < 3; i++) expect(await pollGates(handle, st, { team: 'auto' })).toBeNull();
    expect(signals).toEqual([]);
  });
  it('human design gate: one signal and one intervention event', async () => {
    const { handle, signals } = fake([waiting('design', 1)]);
    const st = newGateState();
    let t = 1000;
    const a = await pollGates(handle, st, { team: 'default', now: () => (t += 5) });
    expect(signals).toEqual([{ name: 'decide', arg: { gate: 'design', round: 1, approved: true, by: 'bench-scripted' } }]);
    expect(a?.event).toMatchObject({ type: 'intervention', stage: 'design', kind: 'scripted_approval', note: 'design#1 team=default' });
    expect(a?.waited_ms).toBe(5);
    expect(st.waitedMs.get('design')).toBe(5);
  });
  it('a duplicate waiting state is not answered twice; a new round is', async () => {
    const { handle, signals } = fake([waiting('design', 1), waiting('design', 1), waiting('design', 2)]);
    const st = newGateState();
    expect(await pollGates(handle, st, { team: 'strict' })).not.toBeNull();
    expect(await pollGates(handle, st, { team: 'strict' })).toBeNull();
    expect(await pollGates(handle, st, { team: 'strict' })).not.toBeNull();
    expect(signals).toHaveLength(2);
  });
  it('plan gate maps to the plan stage; an unknown gate is an error', async () => {
    expect(gateStage('plan')).toBe('plan');
    expect(() => gateStage('merge')).toThrow(/unknown gate/);
  });
});
