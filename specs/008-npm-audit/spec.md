# Spec 008 — npm audit dispositions (TASK-0045)

**Board:** TASK-0045 · **Runbook:** `docs/design/follow-ups-runbook.md` (Lane 1) · **Ruling:**
checkpoint C7, signed 2026-11-11 ("Sign off as proposed": (a), (b), (c) as proposed).

## Problem

`npm audit` reports the same findings in `graph/` and `bench/harness/` (re-run 2026-11-11 on
`origin/main` `30ec0f1`): one high in a direct production dependency (zod) and a dev-only
vitest chain (2 critical, 1 high, 3 moderate). The card asks for a recorded disposition per
finding and a fix or a decision row for every production finding.

## Findings and dispositions (audit snapshot 2026-11-11; identical in both packages)

| # | package | dep type | severity | advisories (affected range) | disposition (C7) |
|---|---------|----------|----------|-----------------------------|------------------|
| F1 | zod (graph 3.25.76, harness 3.24.1) | direct, production | high | GHSA-mrhx-c7xc-m3w5 (`<4.6.6`) | **Upgrade to 4.6.7** in both packages (C7a), provided the gates in R2 pass. If they cannot pass without changing the D12 transport contract, stop and accept with a decision row instead (C7a fallback) — an operator checkpoint, not an implementer call. |
| F2 | vitest 2.1.8 | direct, dev | critical | GHSA-9crc-q9x8-hgqq (`>=2.0.0 <2.1.9`) | **Fixed** by bump to 2.1.9 (C7b). |
| F3 | vitest 2.1.8 | direct, dev | critical | GHSA-5xrq-8626-4rwp (`<3.2.6`), GHSA-82fw-gwwq-j7x9 (`>=2.1.0 <4.1.11`) | **Accepted — dev-only, not applicable** (C7b): needs vitest 3/4; we never run the vitest UI, API server or browser mode, and tests run locally only. |
| F4 | @vitest/mocker | transitive, dev | moderate | GHSA-82fw-gwwq-j7x9, GHSA-qxg6-89mg-rqv8 (`<4.1.12`) | **Accepted — dev-only** (C7b), same rationale. |
| F5 | vite | transitive, dev | high | GHSA-4w7w-66w2-5vf9, -v6wh-96g9-6wx3, -698v-4r3x-3vcv, -r825-w8mm-5pxw, -587h-7wmj-h5pm, -9jrq-w75r-8gcw, -rq7h-c2jc-7f22, -fx2h-pf6j-xcff (`<=6.4.x`) | **Accepted — dev-only** (C7b): dev-server advisories; we never start a vite dev server. |
| F6 | vite-node | transitive, dev | moderate | via vite | **Accepted — dev-only** (C7b). |
| F7 | esbuild | transitive, dev | moderate | GHSA-67mh-4wv8-2f99 (`<=0.24.2`) | **Accepted — dev-only** (C7b): affects esbuild's dev server, which we never run. |
| F8 | tinypool | transitive, dev | critical | GHSA-5gmw-xhrv-c9v3 (`<=2.1.0`), GHSA-85c8-ppgw-ccpr (`<2.1.2`) | **Fixed if** vitest 2.1.9 resolves tinypool to a patched version; otherwise **accepted — dev-only** (C7b). The post-bump audit decides; record which. |

A vitest 4 major upgrade is out of scope (C7c); carded only if the operator wants it.

## Requirements

- **R1 (AC #1)** Every finding above ends with a recorded disposition: this table, updated
  with the post-change audit (what cleared, what remains and why), in this spec's tasks.md
  verification record.
- **R2 (AC #2, F1)** zod is `4.6.7` exact in `graph/package.json` and
  `bench/harness/package.json`, lockfiles regenerated and committed. All schema code compiles
  and behaves the same: `graph` build, unit, workflow, versioning and integration green;
  `bench/harness` build, test and `test:g` green. The D12 structured-output path must still
  pass: `graph/tests/unit/anthropic-schemas.test.ts` (zod ↔ hand-written JSON schema parity)
  and the recorded-fixture adapter tests. Behaviour that must not change: `.default()`
  values applied on parse, unknown keys handling as today, error messages carrying the issue
  path (bench `describe` in `src/core/run.ts` prints `path: message`).
- **R3 (F2)** vitest `2.1.9` exact in both packages, lockfiles committed.
- **R4** Decision rows in `notes/00-discovery-log.md` section 7 (next free D-ids, three-way
  grade, evidence = this spec): one for the zod upgrade (or its acceptance, if R2's fallback
  fires), one covering the dev-only vitest-chain acceptance (C7b).
- **R5** `npm audit` re-run in both packages after the change; output summary recorded in
  tasks.md. Expected: zero production findings (`npm audit --omit=dev` clean).

## Constraints

- Footprint: `graph/package.json` + lockfile, `bench/harness/package.json` + lockfile,
  schema code a zod major forces under `graph/src/` and `bench/harness/src/`, tests that
  reference zod internals, `notes/00-discovery-log.md` section 7, this spec dir.
- Exact versions, committed lockfiles, Node 22. No other dependency changes.
- Do not change the D12 transport contract (`graph/src/adapters/anthropic-schemas.ts` JSON
  schemas stay hand-written and identical; no switch to SDK zod helpers).
- Benchmark integrity, verbatim from CLAUDE.md: "When working on `graph/` or any contender
  code, do not read `bench/hidden-tests/`, `bench/tickets/expected.draft.yaml` or
  `bench/*/reference.diff`."
