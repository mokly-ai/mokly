# Milestone 9 Fingerprinted Materials Checkpoint

This implementation checkpoint builds on M8 `5e5111dc`. It is a local commit,
not a measurement or push. The supervisor runs the checkpoint review before
approving the all-scenario M8/M9 measurements.

## Delivered Behavior

Complete component-aware views retain plain-string materials, using SHA-256
UTF-8/base64url fingerprints for canonical retained rule text or each skipped
style's complete outer source. Skipped elements keep their original positions;
empty retained rule sets still get a digest. Stored references, ownership,
exclusions, state, reasons, inline evidence and errors retain text-path behavior.
Parse failures keep original styles. The style route builds no materials and
computes no fingerprints, proved by counters and a hash-interception probe.

The frozen M8 renderer in `tests/helpers/inline_m8_rendering.ts` was captured
before implementation; ten baseline checks passed. Internal test-only switches
compare complete fingerprint and text results. They have no config or CLI
exposure. The complete path derives original ignore pairing from validated
metadata without eagerly normalizing the source sheet. Raw quick proofs retain
their existing lazy normalization and are counted separately.

The supervisor approved the [guard-gap fix](./fingerprinted-materials-guard-gap.md):
authored `mokly-inline-` in either original or at any delivered rewrite seam
retains text materials for the entire view. The streaming recipe check covers
component/ignore boundaries, material signals, eligible styles, caller copies,
placeholders, contract tokens and wrappers. It checks 12 UTF-16 units on each
side of every seam, walking across tiny pieces. Unknown derived marker structure
falls back to delivered validation. Original and canonical M8 marker guards also
retain text. The M8 findings are recorded verbatim after its TODOs and its review
TODO is ticked; `style_source_safety.ts` and the route are unchanged.

## Proof And Coverage

The original one-sided-adoption reproduction failed all eight switch/mode
comparisons before the fix. They now return the text oracle's `changed`,
`material`, material reason and empty ignored ids. Join variants compare exact
text materials as well as results. M8 marker-lookalike differentials compare
fingerprints against delivered text without changing the optimization policies.

| Control                                        | Before seam guard                          | After seam guard       |
| ---------------------------------------------- | ------------------------------------------ | ---------------------- |
| RNW complete views, each fixture/mode/scenario | 64/64 fingerprinted                        | 64/64 fingerprinted    |
| RNW totals, eight cases                        | 512 views / 784 hashes                     | 512 views / 784 hashes |
| Inline/CSS/Changes replay                      | 92 files / 382 catalogues / 764 mode pairs | Same                   |
| Replay fingerprints                            | 7,844 views / 12,472 hashes                | Same                   |

RNW optimized controls retain 64/64 fast no-change views and 64/64 routed
component-style views, in both modes. Replay returns original test outcomes and
read capabilities unchanged, then uses private readers for supplementary
comparison. Its batch-read/count and cleanup issues were fixed in the harness
alone, with dedicated reader regressions.

The work-bound tests compare 256 and 257 cumulative rules, resolved and skipped,
in both modes. Material lengths, normalization inputs, downstream material-hash
inputs and seam-window counts stay equal while the text oracle and fingerprint
input bytes grow. A separate 1 KiB/1 MiB source proof reads exactly 24 UTF-16
units at the same seam. These are work counts, not benchmark timings or claims
that HTML/CSS analysis itself is constant time.

All 13 mutations are caught by failing assertions; generated files are restored
byte-for-byte after each mutation:

| Removed or changed behavior               | Failing tests, including parents |
| ----------------------------------------- | -------------------------------: |
| Seam guard                                |                               10 |
| Component-marker stripping                |                                6 |
| One-sided material-signal removal         |                                6 |
| Traversal across tiny pieces              |                                3 |
| Bounded window size                       |                                1 |
| Base / head original-prefix guard         |                          14 / 14 |
| Canonical digest excludes wrapper         |                               10 |
| Skipped digest uses complete outer source |                                4 |
| Empty retained-set digest                 |                                6 |
| Stored-reference transfer                 |                                2 |
| Lazy source normalization                 |                                4 |
| Diagnostic scope restoration              |                                1 |

## Verification

All Node commands use `npm exec --yes --package=node@24.19.0 --`. Browser and
hydration suites use `PLAYWRIGHT_CHANNEL=chromium`. The host is Intel Xeon
2.90 GHz, reporting 2899.930 MHz, eight CPUs. Full-suite verification freezes
tracked and untracked authored files and records their hashes after each suite.

| Verification                                                    | Result                                                       |
| --------------------------------------------------------------- | ------------------------------------------------------------ |
| Focused M9/M8/provenance tests                                  | 1,540 passed                                                 |
| `cargo xtask check --suite package`                             | Passed; both packages pass all five consumer smoke scenarios |
| `cargo xtask check --suite unit`                                | 4,631 passed                                                 |
| `cargo xtask check --suite browser`                             | 725 passed on pinned Chromium                                |
| `cargo xtask check --suite hydration`                           | 219 passed on pinned Chromium                                |
| CLI timing/counter regression rerun                             | 13 passed                                                    |
| Final fingerprint/route/CLI suite, including the 92-file replay | 117 passed                                                   |
| `npm run typecheck` / `npm run lint` / `npm run format:check`   | Passed                                                       |
| `node scripts/verification/repository-ratchets.mjs`             | All four ratchets passed; protocol caps remain satisfied     |
| `cargo fmt --all -- --check`                                    | Passed                                                       |
| `cargo clippy --workspace --all-targets -- -D warnings`         | Passed                                                       |
| `cargo test --workspace`                                        | 11 passed                                                    |
| `cargo xtask rust-file-length-lint --all` / `git diff --check`  | Passed                                                       |

The four xtask suites also used the Node wrapper above. All suites have zero
skips/cancellations. Exact argument lists and timestamps are in
`verification.json`, `post-lint-verification.json` and
`final-targeted-command.json` under the evidence directory.

The initial full unit run passed 4,628/4,631: three old CLI timing assertions
rejected the new counter names. The helper now explicitly requires all nine
new integers and the seam bound, retaining rejection of unknown fields; all
4,631 tests passed on the full retry. Final lint found two import-order issues
and two unused replay-helper bindings. After that mechanical cleanup, build,
typecheck, lint, package verification, all fingerprint tests and the catalogue
replay were rerun successfully, followed by the remaining static checks.
The full unit/browser/hydration runs and the post-cleanup verification each
recorded no authored-file changes during execution. Final edits only complete
the documentation and checklist, with Markdown and diff checks repeated.

The deletion audit against `origin/main` exactly matches the starting 317
pre-existing direct-tree absences. M9 adds no deletions. Integration with main
remains the separate M10 task.

The combined `cargo xtask check` remains at the post-measurement gate under the
brief. Its known external blocker is unpatched `braces <=3.0.3`,
GHSA-vfj7-8cjw-p6xm, through the development Firna → React Native → Metro chain.
No dependency, override, gate, browser timeout or product UI is changed for it.

## Evidence And Remaining Work

Evidence lives under `.context/delegation/scalable/m9-checkpoint/`:

- `prefix-join-regression-before.log` and `prefix-join-{committed,derived}.json`:
  failing reproduction and actual/projected text evidence.
- `oracle-baseline.log`, `final-targeted-command.json`, `final-targeted.log`:
  baseline and exact final focused command/results.
- `rnw-{before,after}-seam.json`, `corpus-{before,after}-seam.json` and companion
  logs: unchanged admission totals and differential outcomes.
- `mutations.py`, `mutations.json`, `mutation-*.log`: exact mutations and failures.
- `initial-verification/`: the first full unit run and its three timing failures.
- `verification.json`, `unit.json`, `browser.json`, `hydration.json` and matching
  logs: passing full suites and the final-lint failures subsequently corrected.
- `typecheck-final.log`, `lint-fixed.log`, `post-lint-verification.json`,
  `post-lint-tests.log`, `package-final.log` and static logs: final cleanup checks.
- `starting-deletions.txt` and `precommit-deletions.txt`: unchanged mainline audit.

No M9 scale measurement or push has run. After approval, compare all four
scenarios cold/warm against clean M8 `5e5111dc` on the same host, using default
ABBA and one cumulative pair, then run the combined gate and push under the
brief. Formal milestone review remains the supervisor's responsibility.
