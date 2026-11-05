# Tasks 001 — Verify the per-model price table

## Phase 1: Source the prices

- [ ] T001 Fetch the vendor pricing page(s); record per-million input, output, cache-write (5m) and cache-read prices for each R2 model, with URL and retrieval date
- [ ] T002 List any R2 model not found on the vendor page (to be reported, not guessed)

## Phase 2: Rewrite the table and test it

- [ ] T003 Rewrite `graph/config/prices.json` per plan step 2; remove every UNVERIFIED marker; set `default` = `claude-sonnet-5-5`
- [ ] T004 Add `graph/tests/unit/prices.test.ts` (shape assertions + hand-computed cost recomputation)
- [ ] T005 Run `npm run build && npm test && npm run test:workflow` in `graph/`; all green
