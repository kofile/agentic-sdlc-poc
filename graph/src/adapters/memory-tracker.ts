// In-memory Jira-shaped Tracker. Every side-effecting call is recorded in a ledger keyed by
// idempotencyKey so duplicate calls (retries, replayed activities) are detectable and a
// replay does not double-comment/double-transition.
import type { Tracker, TrackerIssue } from '../ports/tracker.ts';

interface LedgerEntry { kind: 'comment' | 'transition'; issueId: string; payload: unknown; at: number }

export class MemoryTracker implements Tracker {
  private issues = new Map<string, TrackerIssue>();
  private ledger = new Map<string, LedgerEntry>(); // idempotencyKey -> entry

  seedIssue(issue: TrackerIssue): void {
    this.issues.set(issue.id, issue);
  }

  async getTicket(id: string): Promise<TrackerIssue> {
    const issue = this.issues.get(id);
    if (!issue) throw new Error(`MemoryTracker: unknown ticket ${id}`);
    return issue;
  }

  async comment(id: string, body: string, idempotencyKey: string): Promise<{ commentId: string; duplicate: boolean }> {
    const existing = this.ledger.get(idempotencyKey);
    if (existing) return { commentId: idempotencyKey, duplicate: true };
    this.ledger.set(idempotencyKey, { kind: 'comment', issueId: id, payload: body, at: Date.now() });
    return { commentId: idempotencyKey, duplicate: false };
  }

  async transition(id: string, status: string, idempotencyKey: string): Promise<{ applied: boolean; duplicate: boolean }> {
    const existing = this.ledger.get(idempotencyKey);
    if (existing) return { applied: true, duplicate: true };
    this.ledger.set(idempotencyKey, { kind: 'transition', issueId: id, payload: status, at: Date.now() });
    const issue = this.issues.get(id);
    if (issue) issue.status = status;
    return { applied: true, duplicate: false };
  }

  ledgerEntries(): LedgerEntry[] {
    return [...this.ledger.values()];
  }
}
