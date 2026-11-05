// Vcs port: open a PR, etc. Real adapter (GitHub/Azure Repos) is out of scope this round;
// skills/pipeline-conventions/references/vcs-v1.md is the real system's equivalent contract.
export interface PullRequest {
  number: number;
  url: string;
  headSha: string;
  draft: boolean;
}

export interface Vcs {
  openPr(args: { repo: string; branch: string; baseBranch: string; title: string; body: string; headSha: string }, idempotencyKey: string): Promise<{ pr: PullRequest; duplicate: boolean }>;
}
