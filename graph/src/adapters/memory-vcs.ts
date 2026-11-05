// In-memory GitHub/Azure-Repos-shaped Vcs adapter. Same idempotencyKey (branch+head) returns
// the already-opened PR instead of a duplicate.
import type { Vcs, PullRequest } from '../ports/vcs.ts';

export class MemoryVcs implements Vcs {
  private prsByKey = new Map<string, PullRequest>();
  private nextNumber = 100;

  async openPr(args: { repo: string; branch: string; baseBranch: string; title: string; body: string; headSha: string }, idempotencyKey: string): Promise<{ pr: PullRequest; duplicate: boolean }> {
    const existing = this.prsByKey.get(idempotencyKey);
    if (existing) return { pr: existing, duplicate: true };
    const pr: PullRequest = { number: this.nextNumber++, url: `https://example.invalid/${args.repo}/pull/${this.nextNumber}`, headSha: args.headSha, draft: true };
    this.prsByKey.set(idempotencyKey, pr);
    return { pr, duplicate: false };
  }
}
