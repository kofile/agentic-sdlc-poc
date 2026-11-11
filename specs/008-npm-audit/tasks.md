# Tasks 008 — npm audit dispositions

## Phase 1: graph on zod 4 and vitest 2.1.9

- [x] T001 `zod@4.6.7` and `vitest@2.1.9` exact in `graph/package.json`; lockfile regenerated
- [x] T002 zod 4 fallout fixed with minimal edits; `anthropic-schemas.ts` untouched
- [x] T003 build, unit, workflow, versioning green

## Phase 2: harness on zod 4 and vitest 2.1.9

- [x] T004 `zod@4.6.7` and `vitest@2.1.9` exact in `bench/harness/package.json`; lockfile regenerated
- [x] T005 zod 4 fallout fixed with minimal edits
- [x] T006 build and test green

## Phase 3: Dispositions recorded

- [x] T007 post-change `npm audit` in both packages, mapped to F1–F8
- [x] T008 decision rows (zod upgrade; vitest chain dev-only acceptance) in the discovery log

## Verification record (orchestrator, 2026-11-11, temporal-dev)

- zod 4.6.7 needed no source or test edits in either package (both implementers; diff is
  package.json + lockfile only).
- graph: build ok; unit 61; workflow 12; versioning 1; integration ALL PASS.
- harness: build ok; 73 passed + 1 skipped; `test:g` 1 passed.
- 0 node `worker.ts` processes afterwards.
- `npm audit --omit=dev`: 0 vulnerabilities in both packages.
- Full `npm audit` after the change, identical in both packages (6: 2 critical, 1 high, 3
  moderate, all dev-only), mapped to spec.md:
  - F1 zod GHSA-mrhx-c7xc-m3w5: **cleared** (4.6.7).
  - F2 vitest GHSA-9crc-q9x8-hgqq: **cleared** (2.1.9).
  - F3 vitest GHSA-5xrq-8626-4rwp, GHSA-82fw-gwwq-j7x9: open, accepted dev-only.
  - F4 @vitest/mocker GHSA-82fw-gwwq-j7x9, GHSA-qxg6-89mg-rqv8: open, accepted dev-only.
  - F5 vite (8 advisories): open, accepted dev-only.
  - F6 vite-node (via vite): open, accepted dev-only.
  - F7 esbuild GHSA-67mh-4wv8-2f99: open, accepted dev-only.
  - F8 tinypool GHSA-5gmw-xhrv-c9v3, GHSA-85c8-ppgw-ccpr: **not** fixed by vitest 2.1.9
    (tinypool stays 1.1.1); accepted dev-only.
