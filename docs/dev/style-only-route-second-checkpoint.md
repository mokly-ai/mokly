# Style-only Route Second Supervisor Checkpoint

This round starts at `563de1e5` on `calummoore/irvine-v6`, following the
[first supervisor checkpoint](./style-only-route-supervisor-checkpoint.md).
The host remains Intel Xeon @ 2.90GHz, 2899.930 MHz. This is a code checkpoint;
no benchmark measurement, push, final implementation review or later milestone
is included.

The [third checkpoint](./style-only-route-third-checkpoint.md) records subsequent
separator-joining, URL-token and required-only proof-cache corrections.

## Requested Corrections

1. Both quick checks reject literal `<!--mokly-review-` in eligible unowned
   style outer sources, including identical pages, one-sided regions and material
   adoption. The head alone supplies identical-source checks; non-identical
   checks inspect both analyses. Full comparison still owns state and validation.
   Per-view tests cover content/tag/split boundaries, mirrors and all four switches
   in both modes, including an unchanged marked style beside another ignored edit.
2. Derived base proofs check availability at every unvisited resource frontier,
   including transitive files. Identical and non-identical quick checks and the
   style route use `resourcesIfPresent`; committed mode keeps head-only traversal.
   Successful reads, edges and complete closures are reused. Failed partial
   closures never enter the complete-discovery cache. Required-only injected
   readers retain their single/bulk capabilities while probing availability.
3. Required reads/prefetch bypass cached optional absence, preserving the actual
   reader's own error. The regression asserts the identical failure under all
   switches; boundary tests also retain exact error objects for single/bulk reads.
   Complete traversal still uses required reads, never optional missing-file success.
4. Non-identical quick checks require equal ordered eligible style outer sources.
   Ignored title/template markup can otherwise change parsing context and style
   eligibility. Both cases and their mirrors now return the complete material result.
5. Inline Membership And States explicitly defines emitted `ignoredIds` from
   differing paired content in actual materials after inline canonicalization.
   A region removed with an eligible style contributes none. Original flat spans
   still own eligibility, validation and pairing; Changes/page analysis point to
   this delivered rule. No complete material-state policy changes.

The existing stable-closure test now observes `resourcesIfPresent` on the base:
its old one-base/one-head bound remains, with an added assertion that a successful
route performs zero required base traversals. Committed mode observes no base
traversal. Other outcome and reader-bound assertions remain intact.

## Approved Decoded-prefix Guard

A further probe found that an escaped `<` in a selector string serializes into
an orphan review material marker. The quick check returned unchanged while the
complete path threw, despite neither original source containing the literal
prefix. The supervisor rejected the proposed blanket `<`/backslash fallback
because it would penalize ordinary utility CSS, and approved narrow decoding.

`css/escape_decoding.ts` is a small pure source decoder: one to six hex digits,
one whitespace terminator with CRLF treated as one, non-hex escapes, string line
continuations, invalid code points and EOF. Source quotes, comments and separators
retain their boundaries; decoded quotes do not change string context. Unquoted
URL contents are distinguished from comments. No CSS parser or analysis runs.
Both quick checks reject ASCII-case-insensitive decoded `<!--mokly-` in eligible
content, in addition to the literal outer-source guard. Complete results remain
authoritative.

Decoder unit tests cover every requested boundary. Per-view regressions cover
the serialized-marker error in both modes under all four switches, for identical
and non-identical documents. Utility controls `.md\:flex`, `.w-1\/2`,
`.hover\:bg-red:hover`, `content:"\201C"` and ordinary literal `<` remain fast.
Mixed ASCII case takes fallback; a Unicode Kelvin-sign lookalike stays fast.

The seeded test uses seed `0x5eeda11` (99539473) and 144 generated sheets in
selector strings, declaration strings and identifiers. Material/component
markers and ordinary controls receive random escape subsets, widths, terminators
and string continuations, including `\3C` and `\00003c `.
Both modes compare both quick-switch configurations against the complete oracle:
**576 comparisons, 192 quick settlements**. Errors are compared too; failures
print seed, case, context and mode. The existing RNW differential still covers
640 single-window edits with seed `0x8c51a7`.

The real cumulative RNW test asserts production counters in each mode:
64/64 no-change views stay fast; 64/64 eligible component-style views use the
style route. Both catalogues equal the complete oracle.

## Regression And Mutation Evidence

Evidence is retained under `.context/delegation/scalable/`:

- `m8-round2-regressions-before.log`: 62 pass, 101 failures including parents,
  before implementing the five requested corrections.
- `m8-round2-required-errors-before.log`: both cached-absence diagnostic tests fail.
- `m8-round2-batch-proof-before.log`: the required-only bulk-probe compatibility
  case fails before its fix; existing positive/error cases pass.
- `m8-round2-escaped-marker-proposal.md` and its probe/prototype logs retain the
  original proposal, rejected broad rule and supervisor resolution. The narrow
  rule is the delivered implementation; the old prototype was restored afterward.
- `m8-round2-decoding-before.log`: 20 pass, 14 failures including parents; ordinary
  controls already pass while escaped-marker validation differs.
- `m8-round2-decoding-after.log`: the initial narrow-decoder run passes 47 tests,
  including the seeded comparisons and both RNW path-count controls.

All **13 mutations were rejected**, following a passing 232-test baseline.
`m8-round2-mutations.py` defines exact built-code edits;
`m8-round2-mutations.json` records names, files, failures and restoration hashes.
Every changed built file was restored byte-for-byte. Logs use
`m8-round2-mutant-<name>.log`:

| Mutation                 | Detecting proof                                               |
| ------------------------ | ------------------------------------------------------------- |
| `identical-marker-guard` | Identical content/tag/split markers and decoded-marker errors |
| `ordered-styles`         | Title/template context cases and mirrors                      |
| `transitive-proof`       | Missing indirect resources on route and both quick checks     |
| `required-single-error`  | Original required-reader error after optional absence         |
| `required-batch-error`   | Original bulk-reader error after optional absence             |
| `partial-closure-cache`  | Failed proof cannot satisfy a later required closure          |
| `decoded-prefix`         | Per-view escaped markers and seeded reserved prefixes         |
| `blanket-fallback`       | Utility escapes and ordinary literal `<` must stay fast       |
| `ascii-case`             | Mixed ASCII case must fall through                            |
| `hex-limit`              | Six-digit escapes and seventh-character boundary              |
| `hex-crlf`               | CRLF is one hex terminator                                    |
| `string-continuations`   | Escaped newlines inside strings                               |
| `surrogate-replacement`  | Invalid escaped code points become U+FFFD                     |

## Verification And Checkpoint

Every Node command uses `npm exec --yes --package=node@24.19.0 --`.
Browser/hydration use `PLAYWRIGHT_CHANNEL=chromium`; full-suite sources are frozen.
The final targeted run passes **923 tests**. Typecheck, Prettier, ESLint,
repository ratchets, Rust formatting/Clippy, all 11 Rust tests and the nine-file
Rust length audit pass. Evidence uses `m8-round2-{targeted,format,lint,ratchets,rust}.log`
and `m8-round2-typecheck-final.log`.

All full suites passed on October 3, 2026, with no failures, skips, cancellations
or retries. No browser timing exception, timeout edit or UI change was needed.

| Suite     | Result                                                                                               | UTC interval | Evidence prefix         |
| --------- | ---------------------------------------------------------------------------------------------------- | ------------ | ----------------------- |
| Package   | Build, typecheck, example, package validation and all five consumer scenarios for both packages pass | 17:19–17:22  | `m8-round2-package.log` |
| Unit      | 3,989 / 3,989 pass                                                                                   | 17:22–17:36  | `m8-round2-unit`        |
| Browser   | 725 / 725 pass                                                                                       | 17:36–18:05  | `m8-round2-browser`     |
| Hydration | 219 / 219 pass                                                                                       | 18:05–18:21  | `m8-round2-hydration`   |

The last three prefixes have `.json` and `.log` reports.
`m8-round2-verification.json` records exact commands, timestamps and exits.
`m8-round2-frozen-files.json` hashes all authored files, including new files;
each suite's post-check confirmed no changes. Only this report and plan
bookkeeping changed after the suites, followed by final Markdown checks.

Full-suite commands ran serially with the following environment:

```sh
for suite in package unit browser hydration; do
  PLAYWRIGHT_CHANNEL=chromium \
  MOKLY_VERIFICATION_REPORT=".context/delegation/scalable/m8-round2-$suite.json" \
  npm exec --yes --package=node@24.19.0 -- cargo xtask check --suite "$suite"
done
```

Targeted and static commands (all passed):

```sh
npm exec --yes --package=node@24.19.0 -- node --import tsx --test \
  tests/component_style_*.test.ts tests/page_quick_*.test.ts \
  tests/page_analysis_*.test.ts tests/component_fast_path*.test.ts \
  tests/component_resource_proof.test.ts tests/component_material_reader.test.ts \
  tests/deleted_resource_classification.test.ts tests/review_css_escape_decoding.test.ts \
  tests/component_protocol_docs.test.ts tests/protocol_doc_sizes.test.ts \
  tests/protocol_doc_history.test.ts
npm exec --yes --package=node@24.19.0 -- npm run typecheck
npm exec --yes --package=node@24.19.0 -- npm run format:check
npm exec --yes --package=node@24.19.0 -- npm run lint
npm exec --yes --package=node@24.19.0 -- node scripts/verification/repository-ratchets.mjs
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
cargo xtask rust-file-length-lint --all
```

The deletion audit adds no removals relative to `563de1e5`. The 317 direct-tree
absences relative to current `origin/main` match that starting checkpoint's
inventory; newer-main integration remains M10 work.
`m8-round2-{main-status,main-deletions,starting-main-deletions,checkpoint-deletions}.txt`
retains the audit. Authored source/tests/docs are included in the checkpoint;
`.context/` and ignored generated output remain excluded.

The unqualified `cargo xtask check`, measurements and push remain after supervisor
approval under the brief. The known `braces` audit blocker and the user's open
merge-to-main audit-exception decision remain documented; dependencies, overrides
and verification gates are unchanged.
