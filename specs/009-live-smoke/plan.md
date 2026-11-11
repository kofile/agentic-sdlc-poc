# Plan 009 — live smoke call

**Constitution check:** `.specify/memory/constitution.md` is the unfilled Spec Kit template
(unratified). Planned instead against `CLAUDE.md` (secrets rule), D12, spec 005 and the
follow-ups runbook (Lane 2, C8).

## Phase 1 — launcher, smoke script, tests (implementer, sonnet)

- `graph/scripts/with-g-key.sh` per R1. Shape:
  `SERVICE="${G_KEY_SERVICE:-claude-bench-g-api-key}"; umask 077; f="$(mktemp)";
  trap 'rm -f "$f"' EXIT; trap 'exit 130' INT; trap 'exit 143' TERM;
  if ! security find-generic-password -a "$USER" -s "$SERVICE" -w > "$f" 2>/dev/null; then
  echo "with-g-key: no Keychain item for service $SERVICE" >&2; exit 1; fi;
  export ANTHROPIC_API_KEY_FILE="$f" GRAPH_REASONING=anthropic; "$@"`. Not `exec` (the trap
  must run). Executable bit set.
- `graph/scripts/smoke-triage.ts` per R2, reusing `parseTicketFile`
  (`src/cli/parse-ticket.ts`), `AnthropicReasoning.fromEnv`, `TriageOutputSchema`,
  `costAndGaps` and the price-table loader the activities use (find it via
  `config.loadPriceTable` in `src/workflow/activities.ts`). Exit nonzero on
  `ReasoningOutputInvalid` and print its kind and usage (spend still recorded).
- `package.json`: `"smoke:triage": "node --import tsx scripts/smoke-triage.ts"`.
- `tests/unit/with-g-key.test.ts` per R3 (spawn bash with a temp dir holding a fake
  `security` first on `PATH`). Smoke refusal test: spawn the script without
  `GRAPH_REASONING` and assert nonzero + message, no network.
- Gates: `npm run build && npm test`. `tsconfig` may not include `scripts/`; if `tsc` does
  not cover it, type-check it the same way `src/cli/*.ts` is run (tsx) and say so.

## Phase 2 — live run (orchestrator)

Preconditions: TASK-0045 merged and merged into this branch; C8 confirmed by the operator.
Record `ls "$TMPDIR"` before, run `graph/scripts/with-g-key.sh npm run smoke:triage` from
`graph/`, record `ls "$TMPDIR"` after. Stop if output is invalid or served ≠
`claude-sonnet-5-5`; never loop calls.

## Phase 3 — evidence (implementer, sonnet)

From the orchestrator's recorded output (pasted into the brief, no key material):
`notes/spike-05-live-smoke.md` and the D12 row update.
