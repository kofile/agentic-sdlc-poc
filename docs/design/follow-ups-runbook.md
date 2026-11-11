# Follow-ups after the first batch — sweep runbook (2026-11-11)

**You (the session reading this) are the ORCHESTRATOR** for the tasks below. Run each
through the host project's full PDLC (spec → link → worktree → delegated implementation →
PR → merge → re-ground), parallelizing within lanes and merging serially. Direction is
decided; do not re-litigate it: `notes/00-discovery-log.md` (D1–D12), `notes/02-benchmark-spec.md`,
and the closed `docs/design/first-batch-runbook.md` (its doctrine, gotchas and execution
log) win. Plan-of-record is the board; this file carries only ordering, doctrine and the log.

**Status:** signed-off · operator sign-off on lanes: 2026-11-11 (Evan Stern, "Sign off as
proposed" in session; rulings below)
<!-- Only the OPERATOR flips draft → signed-off. -->

## Read first (in this order)

1. `CLAUDE.md`, then `docs/design/first-batch-runbook.md` in full (its "Per-PR gates",
   "Concurrency" and execution log apply here unchanged unless amended below).
2. Decision D12 in `notes/00-discovery-log.md` section 7, and `specs/005-reasoning-adapter/`.
3. `backlog task list --plain`, then `backlog task view TASK-<n> --plain` for each task.

## State when this runbook was written (2026-11-11)

- **Done already:** the first-batch sweep (TASK-0010, 0013, 0018, 0019, 0021, 0022, 0027,
  0043, 0047; PRs 1–9). Runbook status done at `6aa6ade`.
- **In flight in other sessions:** none. `git worktree list` shows root only.
- **Paused — untouched:** none.
- **Next spec number:** check `specs/` on `origin/main` at claim time (005 was the last
  known one; take the next free).
- **Queued, in merge order:** TASK-0044, TASK-0045, TASK-0048, TASK-0046.
- **Then (not in this runbook):** `pdlc:refactor-triage` over the merged range of both sweeps.

## Execution lanes

**Lane 1 — start immediately, in parallel:**

- **TASK-0044 (haiku · model `claude-haiku-5-5`, fallback `claude-haiku-4-5`. A one-function
  fix with clear ACs.)** Run ids collide within one minute. Fix: second resolution in
  `makeRunId` (`YYYY-MM-DDTHHMMSSZ-…`) plus, on a `runs.run_id` primary-key collision, retry
  with a `-2`, `-3`… suffix. Sortable and readable (card ACs). Footprint:
  `bench/harness/src/run-id.ts`, `src/core/run.ts` (the retry only), and tests. Merges first.
- **TASK-0045 (sonnet · model `claude-sonnet-5-5`, fallback `claude-sonnet-5`. Disposition per
  finding is settled at checkpoint C7 before dispatch.)** npm audit in `graph/` and
  `bench/harness/` (identical findings in both). Snapshot 2026-11-11:
  - **zod** (direct, production): high. GHSA-mrhx-c7xc-m3w5, memory exhaustion on
    oversized constrained collections, `<4.6.6`. Fix is 4.6.7, a semver-major upgrade.
    `graph` pins 3.25.76 and `bench/harness` pins 3.24.1.
  - **vitest chain** (dev-only: vitest, @vitest/mocker, vite, vite-node, esbuild, tinypool):
    2 critical, 1 high, 3 moderate. npm offers 2.1.9 as its fix, but several advisories'
    ranges reach `<3.2.6` and `<4.1.12`, so 2.1.9 clears only some of them.

  Footprint: both `package.json` + lockfiles, any schema code a zod major forces (in
  `graph/src/` and `bench/harness/src/`), a decision-log row, and a per-finding disposition
  table in `specs/NNN-*/spec.md`. Merges after TASK-0044 (shared harness files).

**Lane 2 — after TASK-0045 merges (the smoke call must run on the final dependency set):**

- **TASK-0048 (sonnet · model `claude-sonnet-5-5`, fallback `claude-sonnet-5`. Launcher and
  procedure are specified below.)** The C4 live smoke call. **Blocked on the operator
  storing the G key (checkpoint C8).** The launcher is
  `graph/scripts/with-g-key.sh <command…>`:
  1. read the key with `security find-generic-password -a "$USER" -s claude-bench-g-api-key -w`;
  2. write it to `mktemp` with mode 0600;
  3. export `ANTHROPIC_API_KEY_FILE` and `GRAPH_REASONING=anthropic`;
  4. run the command;
  5. `trap` removes the file on any exit.

  Never echo the key. Never `set -x`. The smoke command runs one triage step on
  `graph/tickets/sample-ticket.md` and prints `model_served`, tokens and computed cost.
  Evidence goes in `notes/spike-05-live-smoke.md`, and D12's UNVERIFIED clause is updated.
  **The orchestrator runs the live call itself.** No implementer handles the key. The
  implementer builds and tests the launcher with a dummy Keychain service name.
  Spend cap: $1 for the whole task.

**Lane 3 — after TASK-0048 merges (the reviewer should see one live output):**

- **TASK-0046 (operator-owned review; implementer only for edits the reviewer asks for,
  sonnet).** A person (operator or Cesar) reviews `graph/prompts/{triage,route,design,plan}.md`
  against `graph/docs/stage-contracts.md`, without consulting `bench/tickets/expected.draft.yaml`,
  hidden tests or reference diffs. The orchestrator prepares a review packet
  (`notes/prompt-review-packet.md`) containing:
  - each prompt beside its stage contract;
  - the live triage output from TASK-0048;
  - a checklist (contract coverage, schema fields named, fail-closed wording, no
    ticket-specific hints).

  The reviewer's findings are recorded on the card. Requested edits are dispatched, re-pass
  the fixture tests, and land before the `spec-frozen` tag (D5).

## Per-PR gates

Unchanged from `docs/design/first-batch-runbook.md` (graph build/unit/workflow/versioning,
and integration when `graph/src/workflow/` or the execute host changes; harness build and
tests; canary grep at 0, without writing the literal string into specs; exact versions;
no secrets; decisions go in section 7). Added here:

- **Key hygiene (TASK-0048):** `git diff origin/main...HEAD | grep -E 'sk-ant-'` returns
  nothing. The smoke transcript and evidence note contain no key material. The temp key
  file is gone after the run (`ls $TMPDIR` check recorded).
- **Merges:** the operator merges. The session's `gh pr merge` is refused by the
  permission classifier.

## Per-task artifacts required before PR

- [ ] `specs/NNN-<slug>/{spec,plan,tasks}.md` for TASK-0045 and TASK-0048 (TASK-0044 and
      TASK-0046 run under the signed escape lines below).
- [ ] Spec marker on the card from the claim commit; phase ACs seeded before dispatch.
- [ ] `Dispatch: tier=… pinned=… served=…` line per dispatch.
- **Escape lines (operator-signed only):**
  - TASK-0046: a human review, not a build. Stand-ins are the review packet plus the
    reviewer's findings on the card. Any prompt edits get a spec set of their own if they
    exceed wording changes. Signed Evan Stern 2026-11-11.
  - TASK-0044: a one-function fix. Stand-ins are the card's ACs plus the tests. Signed
    Evan Stern 2026-11-11.

## Concurrency & conflict doctrine

As in the first-batch runbook. Hotspots for this batch:
- `bench/harness/package.json` and lockfile, plus `src/core/run.ts` (TASK-0044 and 0045);
- `graph/package.json` and lockfile (TASK-0045);
- `notes/00-discovery-log.md` section 7 (TASK-0045 and 0048 both add or edit rows: take
  both sides).

Kill stray `worker.ts` processes before any integration run (TASK-0043 fixed the leak; the
habit stays).

## Operator checkpoints

- **C7, TASK-0045 dispositions (before its spec).** Proposed:
  - **(a) zod:** upgrade both packages to 4.6.7 if the `@anthropic-ai/sdk` 1.1.0 structured
    output path and our schemas pass on zod 4. Otherwise accept with a decision row. The
    exposure is low: zod validates our own model's output and our own records, not
    attacker-sized input.
  - **(b) vitest chain:** bump to 2.1.9 (same minor; clears GHSA-9crc-q9x8-hgqq). Accept
    the rest as dev-only and not applicable: we never run the vitest UI or API server or a
    vite dev server; tests run locally only. One decision row covers it.
  - **(c)** A vitest 4 major upgrade is out of scope and goes on a card if wanted.
- **C8, G API key (blocks TASK-0048):** stored in the Keychain by the operator. See the
  operator note in this runbook's sign-off message. Claude never sees the key value.
- **C9, TASK-0046 reviewer:** operator or Cesar, and when.
- **C10, escape lines:** sign or strike the two above.
- Tier escalations and lane amendments: as before.

**Rulings at sign-off (2026-11-11, operator: "Sign off as proposed"):**
- **C7:** (a), (b) and (c) as proposed.
- **C8:** still open until the operator confirms the key is in the Keychain under service
  `claude-bench-g-api-key`. TASK-0048's live call waits; its launcher build does not.
- **C9:** still open (no reviewer was proposed). Ask when Lane 3 starts.
- **C10:** both escape lines signed.
- **C1-equivalent:** sign-off authorizes this sweep's git writes for the scoped tasks
  (claims, pushes, PRs, board commits). Merges are the operator's.

## Done means

TASK-0044, 0045, 0048 and 0046 are Done on the board via merged PRs (0046's PR carries the
prompt edits and packet, or the packet alone if no edits). Gates are green on `main`,
re-run by the orchestrator. D12 no longer marks live behaviour UNVERIFIED. No key material
anywhere in git history added by this sweep. No stale worktrees. This file's log is
complete and its status flipped to done.

## Execution log

| date | task | PR | merge | tokens/cost (best-effort) | notes |
|------|------|----|-------|---------------------------|-------|
| 2026-11-11 | TASK-0044 | #10 | (open) | haiku ×1: ~101k | escape line; second-resolution ids + `-2`… retry on collision; harness 77 passed + 1 skipped (orchestrator re-run) |
| 2026-11-11 | TASK-0045 | — | — | sonnet: phases 1 (graph) + 2 (harness) dispatched in parallel | spec 008; in flight |
