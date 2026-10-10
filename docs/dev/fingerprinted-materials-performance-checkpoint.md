# Fingerprint Performance Scope Checkpoint

The supervisor approved option A for all three fixes in the
[profile report](./fingerprinted-materials-profiles.md). This checkpoint keeps
original validation and comparison semantics, makes fingerprint bookkeeping lazy,
shares exact-source proofs inside one view and reuses successful quick-check
source safety only on complete-path fall-through. No M8 review finding, marker
rule, style-route code, oracle or performance threshold is changed.

## Implementation

`PageAnalysis` calls the existing flat validator eagerly. It retains validated
material keys only when present and constructs the id set, signal spans and
component-marker inventory on demand. The regions-only window helper returns
validated regions without those inventories. Material ids reuse validated keys;
an original without signals never scans for a second signal inventory. Temporary
validation segments remain local and are not captured by the tree traversal.

`FingerprintSourceProofs` is allocated lazily by a `PageAnalysisPair`. Exact
original strings share marker indexes; style indexes additionally require exact
ordered skipped outer sources. Occurrence proofs additionally require identical
eligible start/end positions. Cached keys are snapshots; caches never cross views.
The existing occurrence algorithm and all seam windows/position checks remain.

Both quick checks remember successful source-safety inputs only when they fall
through. Skipped complete analyses may consume the proof only with matching
ordered outer-source/content strings on both sides and both path switches enabled.
Missing proofs, mismatches, resolved analyses and either disabled switch use the
existing guard. Settled shortcuts retain no proof snapshot and add no source scan.
`style_source_safety.ts`, `style_windows.ts` and `component_style_route.ts` are
unchanged. Materials, references, fingerprint hashes and diagnostic definitions
retain their contracts.

## Test-First Evidence

Evidence is `.context/delegation/scalable/m9-performance/`.
`failing-inventories-sharing.log` records 14 initial failures: all 12 shortcut
mode/scenario/signal combinations allocate an eager id set, and both compiled
complete-view cases build two marker indexes. `failing-safety-reuse.log` records
four failing enabled-switch assertions (plus their parent failures): identical
quick fall-through scans three times instead of one, non-identical four instead
of two. Both modes reproduce the work. The other switch combinations pass.

The first lazy implementation exposed an additional scan, caught before fixing it:
`failing-lazy-rescans.log` records two failures when requesting material ids scanned
the original again. Reusing the eagerly validated keys removes that work, and no
signals means no lazy signal scan. Existing complete-path errors stay eager.

New tests pin exact per-view paths and scans on compiled fixtures, including valid
signals outside styles; exact complete/text results; lazy errors under all four
switches; identical source with different eligible occurrences; changed/missing
proofs; snapshot isolation; both disabled switches; resolved reference-bearing
styles; and absence of cross-view reuse. The existing marker-index test now
asserts the same reuse through the new owning cache instead of `PageAnalysis`.

## Mutation Checks

Every mutation runs against built output, then restores those bytes in `finally`.
No mutated build is used for verification or measurements. All 18 new mutations
fail their targeted assertions; `mutations.json` retains exact commands and counts.

| Mutation                                              | Failed tests |
| ----------------------------------------------------- | -----------: |
| Eager material ids / signal spans / component markers |      12 each |
| Regions-only helper scans signal spans                |            1 |
| Eager proof cache on a shortcut                       |           12 |
| Disable identical-source sharing                      |            2 |
| Share different original strings                      |            1 |
| Disable marker / style / occurrence reuse             |    3 / 2 / 3 |
| Match skipped sources by length only                  |            1 |
| Ignore eligible occurrence positions                  |            2 |
| Do not record successful safety                       |            8 |
| Ignore outer-source / content proof keys              |       1 each |
| Reuse despite disabled path switches                  |            8 |
| Reuse skipped safety for resolved analysis            |            2 |
| Admit a missing safety proof                          |            5 |

The previous nine position-exact seam/identity mutations also fail, recorded in
`previous-mutations/mutations.json`: removed source identity (9 failed tests),
touching treated as intersection (13), omitted index (1), wrong distance (2),
omitted material offset (1), same-piece ending (1), mixed source endings (1),
incorrect insert position (1) and a retained-piece scan (1). All 27 attempts
are caught. The seeded proofs remain in the targeted and full suites.

## Verification And Next Step

`npm exec --yes --package=node@24.19.0 -- npm run prepare:verification` passes
and generates the example's 430 files. The targeted command recorded in
`targeted-command.json` runs 115 files with `node --import tsx --test
--test-concurrency=2`: **1,805 passed, zero failures/skips**. It includes every
marker, seam and occurrence regression, the 12,000-recipe oracle, seeded compiled
catalogues and all new work assertions. One initial test type annotation was
missing; it is corrected and the subsequent TypeScript check passes.

Coverage is unchanged from `b11e51d0`: RNW 64/64 per fixture/scenario/mode,
design 428/428 per mode, interleaving 16/16, and catalogue replay 382 catalogues,
760 included mode pairs, 7,844 fingerprinted views and 12,472 hashes. The existing
two named alias exclusions (four pairs) remain unchanged; replay reports zero
failures. `*-final.json` retains all coverage records.

All 13 checks in `verification.json` pass with no authored-file changes during
the successful frozen run. The first static attempt caught one import-order
error in the moved marker-index test; it was corrected before restarting, with
the failed logs retained under `initial-static/`. All Node commands below use
`npm exec --yes --package=node@24.19.0 --`; browser/hydration run with
`PLAYWRIGHT_CHANNEL=chromium` throughout.

| Command after the Node wrapper                      | Result                                                 |
| --------------------------------------------------- | ------------------------------------------------------ |
| `npm run typecheck`                                 | pass, both packages                                    |
| `npm run format:check`                              | pass                                                   |
| `npm run lint`                                      | pass                                                   |
| `node scripts/verification/repository-ratchets.mjs` | file/export/protocol checks pass                       |
| `cargo xtask check --suite package`                 | both packed packages, all five consumer scenarios pass |
| `cargo xtask check --suite unit`                    | 4,895 passed, zero failures/skips/cancellations        |
| `cargo xtask check --suite browser`                 | 725 passed, zero failures/skips/cancellations          |
| `cargo xtask check --suite hydration`               | 219 passed, zero failures/skips/cancellations          |

The native commands `cargo fmt --all -- --check`, `cargo clippy --workspace
--all-targets -- -D warnings`, `cargo test --workspace` (11 tests),
`cargo xtask rust-file-length-lint --all` and `git diff --check` also pass.
Logs, exact commands, suite JSON and the frozen source hashes are retained beside
`verification.json`. Final report/plan edits receive Markdown/link/diff checks;
production and test bytes remain those verified. The deletion audit is unchanged.

The code checkpoint is committed locally without pushing. No measurement or
combined `cargo xtask check` is run before the supervisor reviews this diff.
The known `braces` audit rule remains unchanged for that later combined gate.

After approval, remeasure M8 `5e5111dc` versus this fix on the same host: default
ABBA for no-change/linked and one cumulative M8-then-M9 pair for style/linked,
cold/warm. Preserve the [pre-fix report](./fingerprinted-materials-measurements.md)
and add fixed results with spreads. Timings currently expose no GC counter, so
capture default no-change cold worker profiles on both trees after timed runs.
Report before the gate if any fast/style cell remains clearly slower with
non-overlapping ranges. The combined audit-aware gate and push follow only after
that review boundary; the formal M9 review remains the supervisor's task.
