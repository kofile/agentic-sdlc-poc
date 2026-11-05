// run_id format: YYYY-MM-DDTHHMMZ-<contender>-<ticket>-r<rep> (spec section 7 example).
export function makeRunId(date: Date, contender: string, ticket: string, rep: number): string {
  const iso = date.toISOString(); // 2026-11-12T02:31:45.123Z
  const stamp = `${iso.slice(0, 10)}T${iso.slice(11, 13)}${iso.slice(14, 16)}Z`;
  return `${stamp}-${contender}-${ticket}-r${rep}`;
}
