// Clock port: workflow-sandbox-safe time. Inside a Temporal workflow, use the SDK's own
// Date/sleep (replay-safe); this port exists for activity/adapter code that needs wall time
// without reaching for `Date.now()` directly everywhere (keeps the call site swappable/testable).
export interface Clock {
  nowMs(): number;
  isoNow(): string;
}
