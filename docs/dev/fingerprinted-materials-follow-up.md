# Fingerprinted Materials: Supervisor Checkpoint Follow-up

This follows the supervisor check of `1a084753`. It fixes the two fingerprint
result changes and strengthens the guard model, replay and accounting proofs.
The checkpoint remains local: no M9 scale measurements or push.

## Corrections

1. **Skipped source references.** An equal sheet can skip after parsing while
   retaining raw namespace/selector URL resource records. Such an eligible outer span
   now keeps text materials for the whole view, on either side. Tests pin
   dependency evidence and prepared references for both inputs, all switches
   and both modes. Escaped utility classes and style id/navigation attributes
   keep fingerprints; the guard shares the material reader's resource-kind test.
   The RNW control caught the initially over-broad inclusion of id anchors; a
   focused regression failed before narrowing that predicate.
2. **Created/completed markers.** Seam windows reject crossing `<!--mokly-`
   as well as `mokly-inline-`. Indexed opener/close positions detect seams
   inside unfinished review/component markers, including opener names completed
   by a join. Only crossing occurrences count; whole comments/placeholders stay
   admissible. Source indexes are lazy, shared per side, and absent on shortcut
   paths. Checked canonical appendices and complete producer tokens need no
   additional scan. Each seam still copies at most 24 UTF-16 units.
3. **Independent guard model.** Seed `0x9f71ab` exercises 20,000 documents and
   every removal/copy/insert class. An independent oracle materializes full
   strings, scans actual seams and compares modeled rewrites with the real
   single/pair normalizer whenever the production guard admits them.
4. **Compiled catalogue differential.** Seed `0xf19e79` builds 56 catalogues
   covering markers in/around styles and attributes, ignores/signals, empty
   instances, caller copies, raw references and movement. It compares 448
   switch/mode outcomes and errors, plus exact material bytes/references on
   guarded views. Failure labels print the seed, case and switch settings.
5. **Skipped style-source guard.** Literal ignore boundaries and signals in
   content and tag attributes are partnered outside the style. All eight
   mode/case tests fail when the source guard is removed.
6. **Single/projected branches.** Separate byte-equality regressions isolate
   actual single-document normalization and projected one-sided signal removal.
   Each branch's removal fails its two mode-specific tests.
7. **Replay fidelity.** Each replay must match the original same-mode outcome
   and result/error, in addition to fingerprint/text equality. A forced-read
   failure proves equal replay errors cannot hide an original success. Replays
   retain original inputs when the mode already matches; generated-path filtering
   applies only when converting a committed input to derived mode. The named
   alias exclusions below remain production behavior, not M9 fixes.
8. **Exact counters.** Resolved, skipped and owned real fixtures in both modes
   pin all four constructed materials, normalization inputs, fingerprint input
   bytes, digest reuse and one fingerprinted view. The expectations count UTF-8
   bytes and distinguish projected appendices from stripped component markers.
9. **Delivery status.** Inline resource ownership now states that stored
   references for fingerprints are implemented. Inline-style skip wording
   includes the delivered after-parse skip and its separate source-record guard.
10. **Protocol index.** Material work counts are indexed. A directory-wide test
    requires every top-level protocol document to have an index link.
11. **Cleanup.** Removed the always-true fingerprinted-view condition and the
    redundant `Boolean(pages)` check. No full-path validation was loosened.

The head-only collision is tested both through nested fragments and through a
real empty instance. The base text material has no authored inline prefix;
the head creates an exact style-fingerprint lookalike after nested rewrites.
Reverting to the `1a084753` seam code changes `changed/material` to
`ignored-only` under all eight mode/switch combinations for each variant.
The malformed-marker error and a plain created prefix have separate tests.

## Mutations

Every mutation was restored byte-for-byte. Counts include parent tests where
Node reports them. Logs are in `.context/delegation/scalable/m9-supervisor/`.

| Mutation                                  | Failing tests |
| ----------------------------------------- | ------------: |
| Skip raw-reference fallback               |             9 |
| Skip crossing reserved-prefix detection   |             2 |
| Ignore open-marker state                  |             6 |
| Ignore partial opener-name completion     |             2 |
| Treat a whole nearby marker as crossing   |             1 |
| Ignore openers in inserted text           |             2 |
| Remove skipped style-source guard         |             8 |
| Remove actual single-document check       |             2 |
| Remove projected recipe check             |             2 |
| Count only actual material strings        |             6 |
| Disable digest reuse                      |             6 |
| Remove original base-prefix guard         |            14 |
| Remove original head-prefix guard         |            14 |
| Remove parse-failure fallback             |             4 |
| Remove original replay outcome comparison |             1 |
| Remove protocol index link                |             1 |
| Eagerly build marker indexes on the route |             2 |
| Rebuild the index on every access         |             1 |

`mutations.json`, `extra-mutations.json` and `anchor-mutation.json` record all
19 final mutations and their results.
Earlier isolated checks are retained in `guard-mutations-before.json` (source
8, single 2, projected 2 failures), `counter-mutations.json` (6 failures each)
`original-guard-collisions.log` (8 failures) and
`original-guard-all-collisions.log` (12 failures). The eager-index regression
first failed twice before lazy construction. The original raw-reference tests
failed four times; both documentation tests failed before their corrections.
A further opener-name test failed before support for joined names was added.
These are intentional failure evidence, not failing final verification.

## Replay Coverage And Existing Alias Issue

The replay captures 382 original catalogues, compares 380 (760 mode pairs),
explicitly excludes two (four pairs), and retains 7,844 fingerprinted views and
12,472 hashes. Exact totals are pinned. All eight RNW cases retain 64/64
fingerprinted complete views (512 views, 784 hashes total), unchanged from
`1a084753`. Optimized no-change/style controls retain 64/64 fast and 64/64 style
views in both modes.

1. **Low, supervisor-discovered, pre-existing: alias fast/complete disagreement.**
   In the two screen cases from
   [`changes_asset_aliases.test.ts`](../../tests/changes_asset_aliases.test.ts),
   committed-mode ordinary classification succeeds while full comparison rejects
   `image.svg` as a Git symlink or `images/logo.svg` as missing. Clean M8
   `5e5111dc` reproduces both. In native derived mode, ordinary and full comparison
   already return the same error. The exclusion is by the two exact catalogue
   names and covers their four replay pairs, as instructed. Original tests still
   run; excluded pairs are not counted as passing comparisons. No production
   resource/optimization behavior was changed. Leaving this unresolved means
   enabling the complete path can change successful committed alias handling
   into an error.

   **A (recommended):** separately establish consistent Git-alias handling and
   fast/complete equivalence, with these fixtures as regressions, after the user
   decides the intended behavior. **B:** retain the existing behavior and named
   exclusions. This checkpoint implements neither option.

Control evidence is `m8-alias-control.log` and `m8-alias-derived-control.log`,
from a clean, prepared detached worktree at `/tmp/mokly-m9-m8-control`.
The original-current mismatch is retained in `alias-original-mismatch.log`.
The strengthened replay also caught a harness-only generated-path rewrite on
already-derived inputs; `replay-input-fixed.log` records 13 passing focused
checks after preserving those original inputs.

## Verification And Remaining Work

The final targeted command passed 1,646 tests, with no skips/cancellations.
Its exact arguments are in `targeted-command.json`; results are in `targeted.log`.
All Node commands use
`npm exec --yes --package=node@24.19.0 --`; full browser/hydration suites use
`PLAYWRIGHT_CHANNEL=chromium`. The restarted VM reports Intel Xeon 2.90 GHz,
2899.962 MHz and eight CPUs. No benchmark samples are inferred from test times.

| Command / suite                                               | Result                                                       |
| ------------------------------------------------------------- | ------------------------------------------------------------ |
| `cargo xtask check --suite package`                           | Passed; both packages pass all five consumer smoke scenarios |
| `cargo xtask check --suite unit`                              | 4,736 passed                                                 |
| `cargo xtask check --suite browser`                           | 725 passed on pinned Chromium                                |
| `cargo xtask check --suite hydration`                         | 219 passed on pinned Chromium                                |
| `npm run typecheck`, `npm run lint`, `npm run format:check`   | Passed                                                       |
| `node scripts/verification/repository-ratchets.mjs`           | All four ratchets passed                                     |
| `cargo fmt --all -- --check`                                  | Passed                                                       |
| `cargo clippy --workspace --all-targets -- -D warnings`       | Passed                                                       |
| `cargo test --workspace`                                      | 11 passed                                                    |
| `cargo xtask rust-file-length-lint --all`, `git diff --check` | Passed                                                       |

The xtask suites also ran through the Node wrapper. All full suites have zero
skips/cancellations and recorded no authored-file changes during execution.
`verification.json` contains each exact argument list, timestamp, exit code and
file audit; `unit.json`, `browser.json` and `hydration.json` contain complete
suite evidence. Final changes only fill in this report/checklist, with Markdown
and diff checks repeated. Mainline deletion audits match the starting 317
pre-existing direct-tree absences; this follow-up adds no deletions.

Evidence also includes `all-switch-regressions-before.log`,
`reserved-seams-before.log`, `opener-name-before.log`, `seeded-targets.log`,
`lazy-index-tests.log`, `exact-counts-before.log`, `replay-outcomes-before.log`,
`route-marker-index-before.log`, and final targeted/suite/static logs. The M8
formal review findings remain verbatim in the plan and unimplemented; neither
`style_source_safety.ts` nor the style route changed.

After checkpoint approval, the existing M9 measurement plan compares all four
scenarios with M8 `5e5111dc` on the same host, then runs combined
`cargo xtask check` and pushes under the brief's documented `braces` audit rule.
The audit exception for merging remains the user's decision.
