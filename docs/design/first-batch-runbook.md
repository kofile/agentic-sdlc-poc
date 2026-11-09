# First batch (no-M1 work) — sweep runbook (2026-11-05)

**You (the session reading this) are the ORCHESTRATOR** for the tasks below. Run each
through the host project's full PDLC — spec → link → worktree → delegated implementation →
PR → merge → re-ground — parallelizing within lanes, merging serially, treating merge
conflicts as routine. Direction is decided; do not re-litigate it: `notes/00-discovery-log.md`
(Decisions D1–D11), `notes/02-benchmark-spec.md` and `notes/HANDOFF.md` win. Plan-of-record
is the board; this file carries only ordering, doctrine, and the log.

**Status:** signed-off · operator sign-off on lanes: 2026-11-05 (Evan Stern, "Sign off as
proposed" in session; rulings recorded under Operator checkpoints)
<!-- Only the OPERATOR flips draft → signed-off (the author never pre-fills it). An
     executing session must refuse a runbook whose status it cannot verify. -->

## Read first (in this order)

1. `CLAUDE.md` (rules that always hold — benchmark integrity, secrets, spend, decisions).
2. `notes/HANDOFF.md`, then the Decisions table (section 7) of `notes/00-discovery-log.md`.
3. `notes/02-benchmark-spec.md` section 7 (harness and stage-run record) for TASK-0013/0018.
4. `graph/README.md` and `graph/docs/stage-contracts.md` for every `graph/` task.
5. `backlog task list --plain` — live state; other sessions move it while you work.
6. The task you're about to execute (`backlog task view TASK-<n> --plain`).

## State when this runbook was written (2026-11-05, end of Day 1)

- **Done already:** nothing on the board. Lane A (`bench/`) and Lane B (`graph/`) code is
  committed and on `origin` (D11); `HANDOFF.md` still calls it uncommitted (stale).
- **Local `main` is 37 commits ahead of `origin/main`** (the TASK-0001..0042 card
  commits, unpushed). Worktrees are cut from `origin/main`, so until `main` is pushed no
  task branch carries its own card. See checkpoint C0.
- **In flight in other sessions:** none known. `git worktree list` shows root only.
- **Paused — untouched:** none.
- **Grounding corpus:** none (`docs/wiki/` absent). The re-ground step's wiki refresh is a
  no-op for this sweep; nothing here builds the wiki.
- **Spec Kit:** `.specify/` present; constitution is the unfilled template (unratified).
  No `specs/` dir yet — first spec number is `001`.
- **Queued (this runbook's scope), in merge order:** TASK-0021, TASK-0019, TASK-0027,
  TASK-0013, TASK-0043 (amendment A1), TASK-0022, TASK-0018, TASK-0010.
- **Out of scope (blocked by M1 or operator-owned):** TASK-0001..0009, 0011, 0012,
  0014..0017, 0020, 0023..0026, 0028+.

## Execution lanes (dependency-ordered; parallelize within a lane)

Rule of thumb: DEVELOP in parallel, MERGE serially. Footprints below are the contract each
dispatch brief names as the files it owns (CLAUDE.md: parallel agents get disjoint
directories).

**Lane 1 — start immediately, in parallel (four worktrees):**

- **TASK-0021 (haiku · model `claude-haiku-5-5`, fallback `claude-haiku-4-5` — run an
  existing command and record the result; no design)** — `cd graph && npm run
  test:integration` with Docker and image `sdlc-graph-poc-execute-host:latest`; record the
  verbatim outcome in `notes/HANDOFF.md`; card any failure rather than fix it beyond a
  trivial harness issue. Footprint: `notes/HANDOFF.md` only (plus fixes in `graph/tests/
  integration/` if trivial). Unblocks TASK-0022. The orchestrator re-runs the command
  itself before merge (CLAUDE.md: agent-reported results are not facts).
- **TASK-0019 (sonnet · model `claude-sonnet-5-5`, fallback `claude-sonnet-5` — a lookup
  plus a test to an existing pattern; but a wrong number corrupts every cost chart, so not
  haiku)** — verify input, output, cache-read and cache-write prices against the vendor
  pricing page for every model the benchmark can serve, **including the 5.5 family the
  table is missing today** (`claude-sonnet-5-5` per D1; the table only has `claude-sonnet-5`,
  so lookups fall through to `default`). Each entry cites URL + retrieval date; UNVERIFIED
  markers go. New unit test recomputes cost for a recorded usage sample. Footprint:
  `graph/config/prices.json`, new `graph/tests/unit/prices.test.ts`. **Must not edit
  `graph/src/`** — the requested-vs-served lookup fix belongs to TASK-0022. The
  orchestrator spot-checks at least two prices against the source before merge.
- **TASK-0027 (sonnet · model `claude-sonnet-5-5`, fallback `claude-sonnet-5` — method is
  settled in the plan, see below)** — prove a definition change with runs in flight. Method
  (plan.md must adopt or justify a change): Temporal `patched()` on a test workflow derived
  from the real graph workflow shape, exercised with `TestWorkflowEnvironment`, plus a
  replay check (`Worker.runReplayHistory`) of a history captured before the change.
  Evidence write-up in `notes/spike-04-versioning.md`; D7's follow-up line gets a
  pointer to it via a log entry (decision-table row or note, per CLAUDE.md). Footprint:
  new `graph/tests/versioning/`, `notes/spike-04-versioning.md`, a new
  `test:versioning` script in `graph/package.json`. **Must not edit `graph/src/`.**
- **TASK-0013 (sonnet · model `claude-sonnet-5-5`, fallback `claude-sonnet-5` — the
  record schema and CLI shape are fully specified in spec section 7)** — the `bench` CLI
  skeleton, zod-validated stage-run record, SQLite store (`runs`, `stage_runs`, `scores`,
  `interventions`), `artifacts/<run_id>/`, JSONL export, `bench report` reading SQLite only,
  a stub contender end to end. Footprint: new `bench/harness/` (own `package.json`,
  exact versions, committed lockfile, Node 22) — location is checkpoint C2. **Must not
  read `bench/hidden-tests/`, `bench/tickets/expected.draft.yaml` or any
  `bench/*/reference.diff`** (scoring is TASK-0014, out of scope).

**Lane 2 — each after its Lane 1 dependency has merged:**

- **TASK-0043 (sonnet · model `claude-sonnet-5-5`, fallback `claude-sonnet-5` — fix
  specified by the card's ACs)** — added by amendment A1 (see execution log). Integration
  test must kill every worker tree it starts and use a per-run task queue. Footprint:
  `graph/tests/integration/` only. **Merges before TASK-0022.** Before any integration run,
  check for and kill stray `worker.ts` processes from earlier runs (`ps -axo pid,command |
  grep '[w]orker.ts'`).

- **TASK-0022 (sonnet · model `claude-sonnet-5-5`, fallback `claude-sonnet-5` — the
  transport decision is made by the operator at C3 and written into spec/plan before
  dispatch, so the implementer has no open judgment call; if C3 leaves it open, this
  becomes an opus escalation checkpoint)** — after TASK-0021 merges. Real Reasoning
  adapter behind `graph/src/ports/reasoning.ts`: zod-validated typed outputs for triage,
  route, design, plan; fail-closed gates; served model read from the response and
  recorded per step; cost computed on **model_served**, not `modelRequested`
  (`graph/src/workflow/activities.ts:29` today). Tests run against recorded fixtures — no
  live API call is required to pass, because the G API key (open item) does not exist
  yet. A live smoke call is a separate checkpoint (C4). Prompts versioned as files so
  TASK-0029 can freeze by tag. Footprint: `graph/src/adapters/` (new adapter),
  `graph/src/ports/reasoning.ts`, `graph/src/core/`, `graph/src/workflow/`, `graph/tests/
  unit/`, `graph/tests/workflow/`, new `graph/prompts/`, `graph/package.json` + lockfile.
  Merges after TASK-0019 and TASK-0027 so it reconciles against their package.json/test
  changes, not the other way round.
- **TASK-0018 (sonnet · model `claude-sonnet-5-5`, fallback `claude-sonnet-5` — thin
  adapter to the record schema TASK-0013 fixes)** — after TASK-0013 merges. Starts a
  Temporal run of `graph/` from `bench run --contender G`, drives gates from the team
  policy files (`graph/teams/{auto,default,strict}.json`) and records each as an
  intervention, normalises telemetry into the stage-run record. Footprint:
  `bench/harness/src/adapters/g/` (or the equivalent TASK-0013 establishes). **If it needs
  any change under `graph/src/`, it waits for TASK-0022 to merge first** and the change
  rides this task's PR. Against stub reasoning it must still pass; it does not require
  TASK-0022.

**Lane 3 — tail (droppable):**

- **TASK-0010 (haiku · model `claude-haiku-5-5`, fallback `claude-haiku-4-5` — repo
  hygiene to explicit operator rulings)** — only after checkpoint C5 rules on each spike.
  Note: `spikes/` (including `spikes/02-engine/data/`, with a `.sqlite`) is **already
  committed**, so AC #1 means `git rm --cached` + a `.gitignore` line, not only the line.
  Footprint: `.gitignore`, `spikes/`.

Tiers and model IDs come from `.claude/model-tiers.json` (`tiers.mjs --root . --check`
exited 0 at authoring, all three tiers `unchanged`). No escalation tier is assigned.
Record on each board task at dispatch, one line per dispatch:
`Dispatch: tier=<tier> pinned=<model-id> served=<model-id>` — `served=` from the
transcript. Verify the served model on the first dispatch before launching siblings.

## Per-PR gates this project enforces (enumerated — implementers cannot miss these)

- **Merge-drift gate: absent** (no `scripts/check-merge-drift.mjs`). Raw git stands:
  `git fetch origin && git pull --ff-only` at root before every claim; fetch + diff against
  `origin/main` before every PR and after every history move.
- **`graph/` touched →** `cd graph && npm run build && npm test && npm run
  test:workflow` green. Also `npm run test:integration` when `graph/container/`,
  `graph/src/adapters/docker-*`, `execute-host-*` or `graph/src/workflow/` changed.
  TASK-0027 adds `npm run test:versioning` to this list once merged.
- **`bench/harness/` touched →** its own `npm run build` (tsc) and `npm test` green.
- **`bench/orderdesk*` or `bench/verify/` touched →** `bash bench/verify/verify.sh` exits
  0 (no scoped task should touch these; touching them is a lane amendment).
- **Canary check on every PR:** `git diff origin/main...HEAD | grep -c
  BENCH-CANARY-7f3a91c2` is 0, and the implementer transcript has no hit. Any hit is a leak
  — stop and flag to the operator.
- **Dependency hygiene:** exact versions (no `^`/`~`), lockfile committed, Node 22.
- **Secrets:** no key, token or Keychain value in any file, log or test fixture. Recorded
  API fixtures are scrubbed of request headers.
- **Decisions:** any choice an implementer or orchestrator makes that the spec did not
  settle lands as a row in `notes/00-discovery-log.md` section 7 (three-way grade +
  evidence file) in the same PR. Expected: D12 (Reasoning transport, from C3), and the
  harness location (C2) if it is not `bench/harness/`.
- **Unverified claims** in notes/docs are marked UNVERIFIED.
- **Re-ground:** no wiki, so no freshness probe. `notes/HANDOFF.md` is updated in the PR of
  any task that changes what it says (TASK-0021 by AC; others when they move a "next step").

## Per-task artifacts required before PR

- [ ] `specs/{NNN}-{slug}/` carries a real `spec.md` (problem + requirements mapped
      to the card's ACs), `plan.md` (stating plainly that the constitution is the
      unratified template and planning against `CLAUDE.md`, `notes/` and the decision
      log), and `tasks.md` (phased checkboxes), committed on the task's branch — **or** an
      operator-signed escape line below names the task and what stands in for them.
- [ ] The card carries its Spec marker from the claim commit (`spec-bridge:link`
      against the stub), and phase ACs are seeded from tasks.md before implementation
      dispatch.
- [ ] The card carries a `Dispatch: tier=… pinned=… served=…` line for every dispatch.
- **Escape lines (operator-signed only):**
  - TASK-0021: verify-only re-run; stands in for the spec set: the board card's ACs plus
    the recorded command output in `notes/HANDOFF.md` — signed Evan Stern 2026-11-05.
  - TASK-0010: hygiene to the C5 ruling; stands in: the C5 ruling recorded on the card —
    signed Evan Stern 2026-11-05.
- **Host additions:** spec.md for TASK-0013/0018/0022 cites the spec section or decision it
  implements; spec.md for every `graph/` or `bench/harness/` task restates the
  benchmark-integrity read-ban verbatim in its constraints.

## Concurrency & conflict doctrine

- **Hotspots:** `graph/package.json` + `graph/package-lock.json` (TASK-0027 script,
  TASK-0022 deps) · `graph/src/workflow/activities.ts` and `graph/src/core/telemetry.ts`
  (TASK-0022; TASK-0019 is fenced out of them) · `graph/src/workflow/workflows.ts`
  (TASK-0022; TASK-0027 is fenced out) · `notes/HANDOFF.md` (TASK-0021 and any task that
  updates next steps) · `notes/00-discovery-log.md` section 7 (every decision row — take
  both sides, renumber D-ids on conflict) · `backlog/` (board commands from root only).
- **No pin-carrying branches** in this sweep (no wiki) — every branch is pin-free and
  **rebases** on `origin/main`. Take main's side for anything you didn't deliberately
  change.
- After every rebase: re-run the per-PR gates above, unconditionally.
- Merge order is the queue order above; two `graph/` PRs never merge without a rebase
  and green gates between them.
- Conflicting with a sibling session's open PR → the smaller PR merges first.
- **Claim before work:** the FIRST commit of any task claims it — board card →
  In Progress, the `specs/NNN-<slug>/` stub, and the `spec-bridge:link` marker — on the
  task branch cut from `origin/main`
  (`git worktree add .worktrees/task-<N> -b task-<N>-<slug> origin/main`). Check NNN
  against `origin/main`'s `specs/` before claiming. Push immediately
  (`git push -u origin <branch>`); never force-push a claim.
- **A rejected push means you lost the race:** fetch, re-read board and `specs/`; if
  another session holds the task or number, STOP the lane and tell the operator;
  otherwise merge `origin/main` into the claim branch and re-push (plain push).
- Verify a PR is merged (`gh api repos/kofile/agentic-sdlc-poc/pulls/<n> --jq .merged`)
  before deleting its branch/worktree; never delete+recreate a closed PR's head.
- Board/spec commands run from root, never inside a worktree; `git add` specific task
  files, never `backlog/` wholesale. `.worktrees/` must be gitignored before the first
  claim (it is not today — part of C0).

## Operator checkpoints (do not proceed silently)

- **C0 — before any claim:** push local `main` (37 board commits) to `origin`, and add
  `.worktrees/` to `.gitignore`. Both are git writes / a `.gitignore` change the operator
  must approve (CLAUDE.md; TASK-0010 notes a past unapproved `.gitignore` edit).
- **C1 — sign-off scope:** signing this runbook authorizes the sweep's git writes for the
  scoped tasks only — claim commits and pushes on task branches, PRs, serial merges to
  `main` after green gates, and board bookkeeping commits on `main`. Anything else (other
  remotes, history rewrites, D11's revisit) stays out.
- **C2 — harness location:** `bench/harness/` (proposed: matches "bench CLI", keeps
  harness beside its assets) vs a top-level `harness/` (keeps harness implementers further
  from `bench/hidden-tests/`, but adds a directory to `CLAUDE.md`'s layout). Decide before
  TASK-0013's spec.
- **C3 — Reasoning transport for TASK-0022:** Anthropic API via the TypeScript SDK
  (proposed: D4 says G uses a dedicated API key; the response carries the served model and
  usage natively) vs headless Claude Code (`claude -p`, closer to P but needs stream
  parsing and runs on a different billing path). Decided before TASK-0022's spec; lands as
  D12.
- **C4 — first live model call:** TASK-0022 merges on fixtures. The first real call needs
  the G API key and a spend note. Operator (2026-11-05): keys can be provided when needed,
  possibly not until 2026-11-06 — so nothing in this sweep waits on a key. When the key
  arrives it is stored in the Keychain and passed by file mount (CLAUDE.md secrets rule),
  then one smoke call verifies the served model from the response before any further use.
- **C5 — spikes ruling for TASK-0010:** per spike (`01-plugin-headless`, `02-engine`,
  `03-execute-host`): keep as evidence with a "not product code" README, or remove; and
  whether to untrack `spikes/02-engine/data/` (already in history on `origin`; removing it
  from HEAD does not remove it from history).
- **C6 — escape lines:** sign or strike the two candidates above.
- Tier escalations; lane amendments (amend this file, note why, tell the operator).

**Rulings at sign-off (2026-11-05, operator: "Sign off as proposed"):** C0 approved
(push `main`, gitignore `.worktrees/`). C1 as written. C2 → `bench/harness/`. C3 →
Anthropic API via the TypeScript SDK; recorded as D12 in TASK-0022's PR. C4 as written.
C6 → both escape lines signed. **C5 still open** (no per-spike proposal was made):
TASK-0010 does not start until the operator rules.

## Done means

- TASK-0021, 0019, 0027, 0013, 0022, 0018 (and 0010 unless dropped) are Done on the board,
  each via its own merged PR, Done set by `spec-bridge:sync` from ticked `tasks.md`.
- Every scoped card still carries its Spec marker and its `Dispatch:` line(s).
- Every scoped task has `specs/NNN-*/{spec,plan,tasks}.md` or a signed escape line.
- On `main`: `graph` build, `npm test`, `test:workflow`, `test:integration`,
  `test:versioning` green; `bench/harness` build and tests green — each re-run by the
  orchestrator, not agent-reported.
- `graph/config/prices.json` has no UNVERIFIED marker; `notes/HANDOFF.md` reflects the
  new state; D12 is in the Decisions table.
- No canary hit in any PR diff or transcript.
- `git worktree list` shows root only; this file's log complete and status flipped to done.

## Execution log

| date | task | PR | merge | tokens/cost (best-effort) | notes |
|------|------|----|-------|---------------------------|-------|
| 2026-11-05 | TASK-0021 | #1 | 474e2f6 | haiku ×1: ~91k subagent tokens | escape line; 4/4 pass. Post-merge the test failed on main from orphaned workers → TASK-0043 |
| 2026-11-05 | TASK-0019 | #2 | f784e3c | sonnet ×1: ~89k | all six prices spot-checked by independent fetch; old table had Sonnet 5 wrong (3/15 → 2/10) |
| 2026-11-05 | TASK-0027 | #3 | 0df22f0 | sonnet ×2: ~104k + ~101k | phases 1, 2; patch placed before design loop (plan.md deviation, accepted) |
| 2026-11-05 | TASK-0013 | #4 | 7acbdd8 | sonnet ×3: ~94k + ~96k + ~103k | phases 1, 2, 3; spec R3a (no silent zeros) added after phase 2; canary false positive from spec text, fixed |
| 2026-11-09 | TASK-0043 | #5 | f7a4223 | sonnet ×1: ~81k | spec 004; phases 1-2; 2 consecutive integration runs 0 leftover workers; Done via spec-bridge sync; merged by operator |
| 2026-11-05 | TASK-0022 | #6 | — | sonnet ×3: ~97k + ~102k + ~117k | in flight: spec 005; phases 1-3 done, PR open; main merged in after #5 (merge, not rebase: C1 bars force-push), re-gated green 2026-11-09 |
| 2026-11-05 | TASK-0018 | #7 | — | sonnet ×3: ~114k + ~125k + ~97k | in flight: spec 006; phases 1-2 + fix-up done, PR open, merges after #6. Spec R4 → D13; amendment R6a (gate.expected/correct optional). Follow-ups carded: TASK-0044, TASK-0045 |

**Lane 1 closed 2026-11-05.** Gates re-run on merged `main` by the orchestrator: graph
build ok, unit 32, workflow 10, versioning 1, integration 4/4 (after killing orphaned
workers); harness build ok, 41 tests. Merges were done by the operator (the session's
`gh pr merge` was refused by the permission classifier).

**Amendment A1 — approved by the operator 2026-11-05 ("Yes, add it"):** add TASK-0043 (integration test leaks worker
processes) to Lane 2, merging before TASK-0022, because TASK-0022 touches
`graph/src/workflow/` and so must pass `test:integration`, which is unreliable until the
leak is fixed. Tier: sonnet (`claude-sonnet-5-5`, fallback `claude-sonnet-5`) — the fix is
specified by the card's ACs.
