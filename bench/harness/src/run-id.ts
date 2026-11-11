// run_id format: YYYY-MM-DDTHHMMSSZ-<contender>-<ticket>-r<rep> (second resolution; spec section 7 example).
// Same-second collisions are resolved by executeRun (core/run.ts), which appends -2, -3, ... to the base id.
export function makeRunId(date: Date, contender: string, ticket: string, rep: number): string {
  const iso = date.toISOString(); // 2026-11-12T02:31:45.123Z
  const stamp = `${iso.slice(0, 10)}T${iso.slice(11, 13)}${iso.slice(14, 16)}${iso.slice(17, 19)}Z`;
  return `${stamp}-${contender}-${ticket}-r${rep}`;
}
