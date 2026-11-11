# Spec 009 — live smoke call for G reasoning (TASK-0048)

**Board:** TASK-0048 · **Runbook:** `docs/design/follow-ups-runbook.md` (Lane 2) · **Decision:**
D12 (Anthropic API transport) · **Checkpoints:** C4 (first live call, first-batch runbook),
C8 (G key stored by the operator).

## Problem

`graph/src/adapters/anthropic-reasoning.ts` (D12) is tested only against recorded fixtures.
D12 marks live behaviour UNVERIFIED. One real triage call proves the transport, the
structured-output path, zod validation on the real response, and that the served model read
from the response is the one we priced.

## Requirements

- **R1 (AC #1) Launcher** `graph/scripts/with-g-key.sh <command…>`, bash, `set -euo pipefail`,
  never `set -x`:
  1. read the key with `security find-generic-password -a "$USER" -s "$SERVICE" -w`, where
     `SERVICE` defaults to `claude-bench-g-api-key` and can be overridden by
     `G_KEY_SERVICE` (used by tests with a dummy service; the override exists for tests only);
  2. write it to a `mktemp` file created with mode 0600 (`umask 077` before `mktemp`), never to
     stdout/stderr, never into an env var other than through the file;
  3. `trap` removes the file on EXIT (also INT/TERM), success or failure;
  4. export `ANTHROPIC_API_KEY_FILE=<tmpfile>` and `GRAPH_REASONING=anthropic`;
  5. run `"$@"` and exit with its status.
  A missing Keychain item fails with a message naming the service, not a key value.
- **R2 (AC #2) Smoke command** `graph/scripts/smoke-triage.ts` (run with
  `node --import tsx`), exposed as `npm run smoke:triage`: parses
  `graph/tickets/sample-ticket.md` with the existing `parseTicketFile`, builds
  `AnthropicReasoning.fromEnv()`, makes one `triage` call with the same request shape the
  workflow activity uses (`prompt: JSON.stringify({ ticket })`, `TriageOutputSchema`,
  `modelRequested: 'claude-sonnet-5-5'`), and prints one JSON object to stdout:
  `model_requested`, `model_served`, `attempts`, `llm_calls`, `prompt_version`, the four
  token counts and `source`, `cost_usd` (from `costAndGaps` with the loaded price table),
  `gaps`, and the validated triage output. It refuses to run unless
  `GRAPH_REASONING=anthropic` (no silent stub). It never prints env values or the key file
  contents. The ticket path is fixed to the sample ticket; it accepts no other ticket.
- **R3 Tests (no network, no Keychain):** a vitest unit test drives the launcher with a fake
  `security` on `PATH` (a stub script that prints a dummy key) and a child command that
  reports: the file exists, its mode is 0600, `GRAPH_REASONING=anthropic`, the dummy key is
  in the file. After exit the file is gone — on success and on a failing child (exit code
  propagated). Missing item → nonzero exit and the service name in stderr, dummy key never
  on stdout/stderr. The smoke script's refusal without `GRAPH_REASONING=anthropic` is
  tested.
- **R4 (AC #2, #3) Live run — orchestrator only.** After C8 (operator confirms the key is
  stored) and after TASK-0045 merges (final dependency set): `graph/scripts/with-g-key.sh
  npm run smoke:triage`. Pass = exit 0, output schema-valid, `model_served` =
  `claude-sonnet-5-5`. Spend cap $1 for the task; one call (≤3 attempts by the adapter's
  retry bound). Tokens and computed cost recorded and checked against the Anthropic console
  usage page (operator reads the console; the orchestrator records what the operator reports,
  or marks it UNVERIFIED).
- **R5 (AC #4) Evidence** `notes/spike-05-live-smoke.md`: command, date, served model,
  tokens, computed cost, console check, the triage output, temp-file cleanup check
  (`ls "$TMPDIR"` before/after), key-hygiene grep result. D12's UNVERIFIED clause in
  `notes/00-discovery-log.md` section 7 is replaced with a pointer to that note.

## Constraints

- No implementer reads, handles or runs anything with the real key. Implementers use the
  dummy service and the fake `security` only. The live call is the orchestrator's.
- Key hygiene gate: the runbook's "Key hygiene (TASK-0048)" grep over
  `git diff origin/main...HEAD` (for the Anthropic key prefix) returns nothing; the
  evidence note and transcripts carry no key material. Never write that prefix literally
  into a tracked file, or the gate hits its own description.
- Footprint: `graph/scripts/`, `graph/package.json` (one script line), `graph/tests/unit/`,
  `notes/spike-05-live-smoke.md`, `notes/00-discovery-log.md` (D12 row only), this spec dir.
- No new dependencies.
- Benchmark integrity, verbatim from CLAUDE.md: "When working on `graph/` or any contender
  code, do not read `bench/hidden-tests/`, `bench/tickets/expected.draft.yaml` or
  `bench/*/reference.diff`."
