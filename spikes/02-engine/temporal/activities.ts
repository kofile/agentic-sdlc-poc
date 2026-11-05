import { Context, heartbeat } from '@temporalio/activity';
import * as S from '../common/stubs.ts';

// Activities = every non-deterministic / side-effecting thing. Thin wrappers over the engine-neutral stubs.
export const loadPolicy = async (team: string) => S.loadPolicyFile(team);
export const triage = (runId: string, ticket: any) => S.triageStub(runId, ticket);
export const route = (runId: string, ticket: any) => S.routeStub(runId, ticket);
export const design = (runId: string, ticket: any, feedback: string | null, round: number, knobs: S.Knobs) =>
  S.designStub(runId, ticket, feedback, round, knobs);
export const plan = (runId: string, d: any) => S.planStub(runId, d);
export async function execute(runId: string, knobs: S.Knobs, guard: boolean) {
  // heartbeat so a SIGKILLed worker is detected in ~heartbeatTimeout, not startToCloseTimeout
  const hb = setInterval(() => heartbeat(), 500);
  try { return await S.executeStub(runId, knobs, guard); } finally { clearInterval(hb); }
}
export const openPr = (runId: string, guard: boolean) => S.openPrStub(runId, guard);
export const merge = (runId: string, guard: boolean) => S.mergeStub(runId, guard);
