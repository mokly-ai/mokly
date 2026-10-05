# M9 Separate Material Detail Checkpoint

This checkpoint implements the supervisor-approved split of M9 diagnostics.
The [full-worker ablation](./fingerprinted-materials-worker-ablation.md) recovered
15.09 s on average (2.49–2.97 ms/view spread) by reverting diagnostics, with
non-overlapping ranges. The [GC evidence](./fingerprinted-materials-gc.md) showed
86 M8 versus 371 M9 major collections at nearly equal allocation volume.
Timed acceptance must measure classification with M8-level core instrumentation.

## Implementation

`DocumentWork` and `timings.ts` are byte-identical to M8 `5e5111dc`. All nine M9
counters and the synchronous material scope now live in `MaterialWork`, with a
separate asynchronous context owned by the current core collector. Only
`MOKLY_MATERIAL_WORK=1` with enabled timings constructs it. Nested comparison
calls share that instance; disabled/different sessions cannot inherit it. A
`review.material-work` record emits once in `finally`, including partial failure
counts. Normal collection adds no material byte passes or collector methods.

The benchmark explicitly disables details in timed Serve workers, regardless of
inherited environment, and rejects/omits leaked detail fields. The independent
`details` command runs one untimed classification per selected deterministic
scenario. `Material companion` records carry identity, membership and exact
counts with `timed: false`, without classification/startup/delivery times or
cold/warm labels. Both paths restore the fixture after failure/interruption.
No companion data is copied into timed samples.

The timing/work-count contracts, diagnostics/review and harness READMEs describe
the split. Historical reports retain their values with a method-change note.
Only `README.md` changed under `tests/fixtures/large/`; the benchmark contract
and templates remain unchanged. The digest remains the M2 reference:
`5bd77afc91a1c433d6a1c0eea1ddaca987690c5948ac4165da5e78e3c3c6124e`.
No fixture regeneration or control-worktree edits were needed.

## Regression And Mutation Evidence

Test-first failures: four initial core-shape/detail-leak failures, followed by
caller-field and companion-tag leak failures. After the split, production probes
in both modes count every `MaterialWork` construction and method: zero with
details off or timings disabled, positive controls for every method with details
on, and identical comparison results. All existing exact counters, work bounds,
marker oracles and seeded proofs remain; counter tests now explicitly opt in.
Real Serve tests check inherited environment isolation, exact companion counts,
matching identities/membership, unchanged fixture bytes, and SIGINT restoration
during both preparation and sampling.

| Mutation                                                  | Result                                                      |
| --------------------------------------------------------- | ----------------------------------------------------------- |
| Remove detail-off branch                                  | Caught by both production probes.                           |
| Return a material collector prototype while off           | Caught by both production probes.                           |
| Construct an unused collector while off                   | Caught by constructor counts, both modes.                   |
| Call a material byte method while off without a collector | Caught by method counts, both modes.                        |
| Add M9 state to core collector                            | Caught by exact M8 instance shape.                          |
| Count only two assembled materials                        | Caught by all six resolved/skipped/owned exact-count cases. |
| Remove per-view digest memoization                        | Caught by all six exact-count cases.                        |
| Stop rejecting caller detail fields                       | Caught by timed-record test.                                |
| Stop omitting caller detail fields                        | Caught by timed-record test.                                |
| Enable details in timed Serve                             | Caught by real benchmark smoke test.                        |

Mutations were temporary, applied one at a time and restored. They change no
committed guard or oracle. Raw commands, exits and assertion output live under
`.context/delegation/scalable/m9-material-detail/`, including `before.log`,
`timed-record-before.log`, `tags-before.log`, `mutations.json`, and
`mutation-*.log`. Prior milestone mutation records remain unchanged.

## Verification

The VM rebooted around 08:20 UTC on 2026-10-05 during package verification.
The host changed from Xeon 2.90GHz to **Intel Xeon 2.50GHz** (2500.000 MHz).
Pre-reboot evidence is retained, but the interrupted package run is not a pass.
All package/unit/browser/hydration and static checks restart on the new host;
new logs live in the evidence directory's `post-reboot/` subdirectory.

All post-reboot checks below used Node 24.19.0; every browser/hydration run
explicitly set `PLAYWRIGHT_CHANNEL=chromium`. Authored files stayed frozen during
full verification and browser controls. The interrupted pre-reboot package run
is retained separately and is not counted as a pass.

| Check                                                         | Result                                                                                                      |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Focused material/diagnostic/large-fixture suites (pre-reboot) | 427 passed, zero failures/skips/cancellations.                                                              |
| Package suite, rebuilt after reboot                           | Passed build, declarations/typecheck, example checks, both packages and all five packed-consumer scenarios. |
| Full unit, after reboot                                       | 4,909 passed, zero failures/skips/cancellations.                                                            |
| Full pinned browser, after reboot                             | 722 passed, 1 failed, 2 timed out; zero skipped/interrupted. **Not a passing suite.**                       |
| Full pinned hydration, after reboot                           | 219 passed, zero failures/skips/cancellations.                                                              |
| Format, lint, repository ratchets                             | Passed; protocol caps, file lengths and exports remain enforced.                                            |
| Rust fmt, clippy and workspace tests                          | Passed; 11 tests.                                                                                           |

The replay retains 92 files, 382 catalogues, 760 compared mode pairs and four
named excluded pairs: 7,844 fingerprinted views and 12,472 hashes. RNW remains
64/64 fingerprinted per complete-path case, design remains 428/428 per mode,
and all 16 interleaving controls retain fingerprints. Shortcut RNW controls
remain 64/64 fast for unchanged and 64/64 style for eligible component edits.

Exact checkpoint commands (the suite loop runs each independently; the browser
failure was retained before hydration continued):

```bash
npm exec --yes --package=node@24.19.0 -- node --import tsx --test --test-concurrency=4 tests/material*.test.ts tests/document_work*.test.ts tests/component_document_work.test.ts tests/timings*.test.ts tests/large*.test.ts
for suite in package unit browser hydration; do
  PLAYWRIGHT_CHANNEL=chromium npm exec --yes --package=node@24.19.0 -- cargo xtask check --suite "$suite"
done
npm exec --yes --package=node@24.19.0 -- npm run format:check
npm exec --yes --package=node@24.19.0 -- npm run lint
npm exec --yes --package=node@24.19.0 -- node scripts/verification/repository-ratchets.mjs
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

The package/each suite includes its own `prepare:verification` rebuild. The
package suite includes `typecheck:prepared`, `example:check`, artifact checks
and smoke tests. `post-reboot/verification.json` records individual commands,
exits and durations; each suite has a `.log` and the unit/browser/hydration
have preserved `.json` reports. No large-fixture measurement was performed.

## Browser Control And Remaining Verification Issue

The full M9 browser run failed three cases:

1. `component_design_navigation`: its ordinary case reached the expected
   variants URL but the iframe stayed `interactive` instead of `complete` at
   the unchanged 5 s predicate (`workspace_actions.ts:84`, spec line 48).
2. `design_links`, mobile comparison/tags/flow: the 60 s test deadline expired
   in `page.goto` for `design-browse-use-case.html` (line 127).
3. `design_links`, desktop comparison/tags/flow: the 60 s deadline expired
   waiting for the final flow-link click (line 128).

A separately prepared, clean detached M8 `5e5111dc` checkout at
`/tmp/mokly-m9-m8-control` ran alone on the same 2.50GHz host, pinned Chromium,
port 4527, with its own dependencies and `npm run prepare:verification`.
Its first two-spec control passed six cases and timed out on the mobile
comparison/tags/flow case. The trace reaches the final flow-link click at line
128, one operation beyond the M9 mobile `goto` timeout. This confirms timing
variability in that test, but does not reproduce all three exact M9 failures.

Three focused repetitions then passed **21/21 on M9 and 21/21 on M8**, run
sequentially M9 then M8. A final complete M8 browser suite, including another
fresh preparation and the original suite order, passed **725/725**. The
component-readiness and desktop timeouts have not reproduced on clean M8;
none of the three original failures repeated in the focused M9 run. Successful
retries do not erase the full-run failures or satisfy the brief's same-failure
rule. **No environmental waiver is claimed.** No UI, browser test or timeout
was changed.

Control commands used Node 24.19.0 and pinned Chromium:

```bash
npm exec --yes --package=node@24.19.0 -- npm run prepare:verification
PLAYWRIGHT_CHANNEL=chromium MOKLY_PLAYWRIGHT_PORT=4527 npm exec --yes --package=node@24.19.0 -- node node_modules/@playwright/test/cli.js test --project=chromium --reporter=./scripts/verification/playwright-reporter.mjs tests/browser/component_design_navigation.spec.ts tests/browser/design_links.spec.ts
# Each tree separately; port 4517 on M9, 4527 on M8:
PLAYWRIGHT_CHANNEL=chromium MOKLY_PLAYWRIGHT_PORT=4527 npm exec --yes --package=node@24.19.0 -- node node_modules/@playwright/test/cli.js test --project=chromium --repeat-each=3 --reporter=./scripts/verification/playwright-reporter.mjs tests/browser/component_design_navigation.spec.ts tests/browser/design_links.spec.ts
PLAYWRIGHT_CHANNEL=chromium MOKLY_PLAYWRIGHT_PORT=4527 npm exec --yes --package=node@24.19.0 -- cargo xtask check --suite browser
```

The custom reporter's `MOKLY_PLAYWRIGHT_EVENT_REPORT` and the full control's
`MOKLY_VERIFICATION_REPORT` point to the retained evidence paths. Exact argv,
host observations and outcomes are in `post-reboot/*command.json`, `*host*`,
`m8-browser-control.*`, `{m8,m9}-browser-repeat.*`, `m8-browser-full.*` and
`browser-summary.json`; all failing traces are preserved in the adjacent
artifact directories. M8 remains clean after every run.

The requested local code checkpoint is reviewable, but its complete browser
verification remains unresolved. Recommendation: retain these failures for the
supervisor's checkpoint decision, keep the measurement/gate/push hold, and do
not make unrelated UI/timeout changes based on intermittent failures.
The combined `cargo xtask check`, remeasurement and push are deferred until
checkpoint approval. The previously recorded `braces` audit blocker remains
untouched; no dependency update or audit waiver is claimed in this checkpoint.
