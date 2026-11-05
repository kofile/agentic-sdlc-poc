// Tracker port: Jira-shaped. Real adapter is out of scope this round (see README "what is
// stubbed"); the in-memory adapter records every call in a ledger so duplicate side-effecting
// calls are detectable (idempotency requirement).
export interface TrackerIssue {
  id: string;
  title: string;
  description: string;
  status: string;
}

export interface Tracker {
  getTicket(id: string): Promise<TrackerIssue>;
  comment(id: string, body: string, idempotencyKey: string): Promise<{ commentId: string; duplicate: boolean }>;
  transition(id: string, status: string, idempotencyKey: string): Promise<{ applied: boolean; duplicate: boolean }>;
}
