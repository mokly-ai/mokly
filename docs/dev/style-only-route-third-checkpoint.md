# Style-only Route Third Supervisor Checkpoint

This round starts at `38515667` on `calummoore/irvine-v6`, following the
[second checkpoint](./style-only-route-second-checkpoint.md). Task-start host:
Intel Xeon @ 2.90GHz, 2899.930 MHz. This remains a code checkpoint; measurements,
push, the final implementation review and later milestones are excluded.

## Corrections

1. The previous guard assumed serialization preserved token separation. Mokly's
   `compact()` can drop comments between non-word tokens and whitespace next to
   `!`. The guard now accepts the specified conservative pattern: decoded `<`,
   followed by any CSS whitespace/comment/`!`/`-` run, then ASCII-case-insensitive
   `mokly-`. It also checks decoding after globally removing escaped newlines;
   the normal decoded check remains, so this cannot reduce fallbacks. It performs
   no native CSS parsing and does not depend on exact serializer joining rules.
2. The decoder enters URL state only for a standalone ident-like `url` token.
   Hash and at-keyword names, including escaped starts, remain block contexts;
   raw NUL counts as an ident character. Unit tests cover those cases and URL
   tokens after delimiter/comment boundaries. Per-view cases preserve full
   validation on identical and non-identical pages under all four switches.
3. Required-only proof probes read the underlying reader directly and cache only
   successful bytes through `resource_proof_reads.ts`. A rejected batch cannot
   install its error for every requested file. Individual probes retain successful
   bytes and discard failures. Mixed-batch regressions cover identical pages,
   outside ignored edits, a needed linked stylesheet and a style-route attempt;
   every switch combination equals the complete comparison.
4. Closure reuse now requires the exact same `Set` instance from the later
   `resources()` call. A reader with both `readMany` and `readManyIfExists` asserts
   one read per file, proving the optional-to-required transfer. A failed single
   probe must reach the underlying reader again on a later required read.
5. Changes links `inlineStyles` to inline-style evidence and `ignoredIds` to the
   actual-material membership/state rule. Fast-path/page-analysis contracts and
   the CSS README replace the invalid separator-boundary claim with the
   conservative joining rule and describe the URL/probe behavior.

The decoder unit test that implied safe comment/token separation was replaced
with lexical-context coverage; `style_source_safety.test.ts` directly proves
that separated pieces and outside-string continuations require fallback.
No complete-material state policy, canonical serializer or CSS matching policy
changed. Successful proof reads/closures still reuse the delivered caches.

## Per-view And Seeded Proofs

`page_quick_marker_separators.test.ts` pins `serializeBlock()` joining and tests
`<! --`, `<!/**/--`, `< !--` and `</**/!--` in declarations, at-rule preludes,
selector arguments and `@supports`, plus split ignore-start markers. Each case
uses both output modes, identical/non-identical sources and all four switches;
full results and errors remain authoritative. `page_quick_url_contexts.test.ts`
covers `#url`, `@url`, escaped starts and raw NUL. The direct decoder assertions
ensure the guard's global continuation fallback cannot mask a broken URL state.

The extended differential uses seed `0x5eeda33` (99539507): 144 generated sheets
with random separator runs, literal/escaped spellings, hash/at/NUL contexts and
continuations inside/outside strings. Every sheet runs as identical input, an
outside ignored edit and a style edit, in both output modes. All three optimized
switch combinations compare complete result/error objects with the oracle:
**2,592 comparisons**, including **232 fast** and **488 style** settlements.
Failures print seed, case, context, edit kind and mode. Utility controls explicitly
require their fast/style paths. The prior 576-comparison escape differential and
640-comparison real-RNW single-window differential remain in place.

The RNW production counter controls remain 64/64 fast for no change and 64/64
style for component styles in each mode. Ordinary utility escapes, curly-quote
escapes and literal `<` without the marker pattern stay eligible for quick checks.

## Regression And Mutation Evidence

Logs and scripts live under `.context/delegation/scalable/`:

- `m8-round3-regressions-before.log`: 210 pass, 322 failures including parents,
  reproducing the reported separator, decoder and failed-batch defects first.
- `m8-round3-regressions-after.log`: 553 passing focused tests after the fixes.
- `m8-round3-seeded.log`: both escape/joining differentials pass.
- `m8-round3-focused.log`: 598 passing tests including RNW path controls.

All **eight mutations were rejected**, after a passing 544-test baseline.
`m8-round3-mutations.py` defines exact built-code edits;
`m8-round3-mutations.json` records failures and byte-for-byte restoration hashes.
Each log is `m8-round3-mutant-<name>.log`:

| Mutation                 | Detecting test                                        |
| ------------------------ | ----------------------------------------------------- |
| `separator-superset`     | Split-marker per-view regressions and guard cases     |
| `global-continuations`   | Outside-string continuation guard case                |
| `url-prefix-kind`        | Direct hash/at-keyword decoder cases                  |
| `nul-ident`              | Direct raw-NUL decoder case                           |
| `proof-poisoning`        | Mixed-batch views and failed single-probe read count  |
| `closure-retention`      | Exact `Set` identity across proof and required lookup |
| `optional-transfer`      | One read per file with both bulk reader methods       |
| `successful-probe-bytes` | Successful required-only proof byte reuse             |

The two formerly surviving mutations now fail: closure retention as a no-op
fails identity assertions, and deleting optional-to-required transfer fails the
batched reader's exact read count. All mutated built files were restored.

## Verification And Checkpoint

Every Node command uses `npm exec --yes --package=node@24.19.0 --`.
Browser/hydration use `PLAYWRIGHT_CHANNEL=chromium`; authored files remain frozen
through the full suites. The targeted run passes **1,461 tests**. Typecheck,
Prettier, ESLint, repository ratchets, Rust formatting/Clippy, all 11 Rust tests
and the nine-file Rust length audit pass. Logs use
`m8-round3-{targeted,typecheck,typecheck-final,format,lint,ratchets,rust}.log`.
The initial lint run found two import-group spacing errors; both were corrected,
then lint/ratchets passed.

Final suite results on October 3, 2026:

| Run                | Result                                                                                               | UTC interval | Evidence prefix            |
| ------------------ | ---------------------------------------------------------------------------------------------------- | ------------ | -------------------------- |
| Package            | Build, typecheck, example, package validation and all five consumer scenarios for both packages pass | 19:54–19:56  | `m8-round3-package.log`    |
| Unit               | 4,527 / 4,527 pass                                                                                   | 19:56–20:11  | `m8-round3-unit`           |
| Browser first run  | 724 pass, 1 ArrowDown timeout                                                                        | 20:11–20:38  | `m8-round3-browser-first`  |
| Clean M7 control   | 29 pass, 1 matching ArrowDown timeout                                                                | 20:40–20:43  | `m8-round3-control-scroll` |
| Browser full rerun | 725 / 725 pass                                                                                       | 20:45–21:13  | `m8-round3-browser-retry`  |
| Hydration          | 219 / 219 pass                                                                                       | 21:13–21:28  | `m8-round3-hydration`      |

All test runs have zero skips/cancellations. JSON and text reports accompany
unit/browser/hydration prefixes. `m8-round3-verification.json` and
`m8-round3-verification-retry.json` record commands, timestamps and exits.
`m8-round3-frozen-files.json` hashes all authored files, including new files;
checks after every full suite confirmed no changes. Only this report and plan
bookkeeping changed afterward, followed by final Markdown checks.

The first browser failure was the existing `comparison_regions_input.spec.ts`
case "scroll keys after a click inside a panel scroll that panel in every version":
`ArrowDown`, expected true/received false, timeout 5,000 ms, `pressTogether` at
line 62 called from line 79. A separately installed, clean checkout of M7
`96ddc06c` was prepared again on the same Xeon host with Node 24.19.0 and pinned
Chromium. Its 30-repeat control reproduced that exact failure once, satisfying
the brief's environmental-failure rule. The subsequent full browser run passed
without code, UI or timeout changes. State/preparation logs use
`m8-round3-control-{state,prepare}.log`; failure traces/context are retained under
`m8-round3-browser-failure/` and `m8-round3-control-failure/`.

The full-suite commands below used `PLAYWRIGHT_CHANNEL=chromium` and
`MOKLY_VERIFICATION_REPORT` set to the matching JSON evidence path; the browser
command ran twice, with the control between runs:

```sh
npm exec --yes --package=node@24.19.0 -- cargo xtask check --suite package
npm exec --yes --package=node@24.19.0 -- cargo xtask check --suite unit
npm exec --yes --package=node@24.19.0 -- cargo xtask check --suite browser
npm exec --yes --package=node@24.19.0 -- cargo xtask check --suite hydration
```

Control commands, from `/tmp/mokly-m8-control-96ddc06c`:

```sh
npm exec --yes --package=node@24.19.0 -- npm run prepare:verification
PLAYWRIGHT_CHANNEL=chromium MOKLY_PLAYWRIGHT_PORT=4518 \
PLAYWRIGHT_JSON_OUTPUT_FILE=/home/vercel-sandbox/mokly/.context/delegation/scalable/m8-round3-control-scroll.json \
npm exec --yes --package=node@24.19.0 -- npx playwright test \
  tests/browser/comparison_regions_input.spec.ts --project=chromium \
  --grep 'scroll keys after a click inside a panel' --repeat-each=30 \
  --retries=0 --reporter=list,json
```

Targeted and static commands (all passed):

```sh
npm exec --yes --package=node@24.19.0 -- node --import tsx --test \
  tests/component_style_*.test.ts tests/page_quick_*.test.ts \
  tests/page_analysis_*.test.ts tests/component_fast_path*.test.ts \
  tests/component_resource_proof.test.ts tests/component_material_reader.test.ts \
  tests/deleted_resource_classification.test.ts tests/review_css_escape_decoding.test.ts \
  tests/style_source_safety.test.ts tests/component_protocol_docs.test.ts \
  tests/protocol_doc_sizes.test.ts tests/protocol_doc_history.test.ts
npm exec --yes --package=node@24.19.0 -- npm run typecheck
npm exec --yes --package=node@24.19.0 -- npm run typecheck:prepared
npm exec --yes --package=node@24.19.0 -- npm run format:check
npm exec --yes --package=node@24.19.0 -- npm run lint
npm exec --yes --package=node@24.19.0 -- node scripts/verification/repository-ratchets.mjs
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
cargo xtask rust-file-length-lint --all
```

The deletion audit adds no removals relative to `38515667`. The 317 direct-tree
absences relative to current `origin/main` match the starting inventory; newer
main integration remains M10 work. The audit uses
`m8-round3-{main-status,main-deletions,starting-main-deletions,checkpoint-deletions}.txt`.
Authored source/tests/docs are included in the checkpoint; `.context/` and ignored
generated output remain excluded.

The unqualified `cargo xtask check`, measurements and push follow supervisor
approval under the brief. The known `braces` audit blocker and the user's open
merge-to-main audit-exception decision remain documented; no dependency,
override or verification-gate changes are included.
