# Style-only Route Code Checkpoint

Milestone 8 of the [scalable analysis plan](../../plans/scalable-inline-style-analysis.md)
implements the [route contract](../protocol/mokly-style-only-route.md). This is
the local code checkpoint; measurement approval and push remain pending. The
starting commit is `96ddc06c`; the task-start host reports Intel Xeon @ 2.90GHz,
2899.930 MHz. No benchmark measurement or default-size fixture regeneration
occurs here; the small generated fixtures are test inputs.

## Implementation

`component_style_route.ts` runs after the unchanged quick check and before full
comparison. Its numbered guards use original UTF-16 windows, eligible head
content spans, paired ignore/material spans, full-rule references and parsed
selector structure. It derives every base style span from the head spans and
window displacement, and attributes with the head original tree and ranges.

`inline_preparation.ts` shares all eligible elements' parse-reuse runs and the
view-wide cancellation/diff with full attribution. Rejected attempts retain
that preparation, including failures. Block-level cancellation, original
ordinals, grouped/nested displacement, selected occurrences and ordinary
retained-multiset composition stay unchanged. No residual-only equality proof,
fingerprints or other recorded review recommendation is implemented.

The route returns the same view/material flags, entry reasons, owned component
impact and optional inline evidence as the full path. It creates no page
materials or implementation comparison. Resource proof uses the existing head
raw seeds: committed mode traverses only the head closure; derived mode
traverses both independently. `stylePath` counts only settled views; unsuccessful
attempts count as complete only when full comparison finishes.

The internal `useStylePath: false` option disables only this route. Complete-path
oracles now disable both it and `useFastPath`; disabling only `useFastPath` can
still select the route. Neither option enters production config or CLI.

## Source-span Proof Clarification

A new regression exposed an incomplete seed proof: a style element contains an
unchanged `.entry` URL, paired ignore markers inside a CSS comment, and a changed
reference-free `.actual-only` rule. Source provenance drops the URL's entire
style-text record because it touches the ignore span. Full canonicalization
retains that rule/reference. Assuming raw seed coverage lost the changed image's
dependency evidence on the route.

The route now checks that shared raw seeds cover all stored canonical rule
references before trusting their closure. Missing coverage takes the contract's
conservative source/span fallback, preserving full evidence without adding another
discovery policy. The owning contract clarifies condition 6 and adds this precise
case to its sole test list. Regression-first evidence is retained in
`.context/delegation/scalable/m8-source-proof-before.log`; the fixed test covers
both modes. The existing identical-text shortcut's behavior is unchanged.
After the marker guard below, a second case places ignore markers in style tag
attributes, outside eligible content. It independently proves seed coverage
rather than relying on the new content-prefix fallback.

## Supervisor-approved Marker Gap Fix

The first complete verification run passed, but an additional oracle probe found
that changing `r-10` to `r-20` in `content:"<!--mokly-component:start:r-10-->"`
produces different states: the full path strips the marker from actual material,
while preserving projected canonical text. Direct canonical comparison alone
reported a material view change. The implementation paused for the brief's
required decision; the proposal and probe remain under the evidence prefix.

The supervisor approved option A with the single broader substring `<!--mokly-`:
any occurrence in original eligible content or composed actual/projected
canonical material, on either side, takes full fallback. The owning contract
records this as an M8 gap fix, with no Decision or full-path result change.
It covers component, ignore/material and future fingerprint markers. The original
proposal is retained with the supervisor resolution appended.

The new per-view tests failed first in both modes, including a CSS selector string
whose `\3c !--mokly-component:` spelling becomes the reserved prefix only during
native serialization. The ordinary `mokly` control still routes. A future-prefix
case prevents narrowing the guard back to a list of current marker classes.
Fallback retains parsed runs and proven diff attributions. Unchanged reference
pairs can use child-content selectors, so they still match both original trees;
a counted probe proves two diff attributions are reused while such a reference
is correctly re-evaluated after failed resource proof.

The source-span proof also rejects an eligible outer span containing only one
boundary of a paired ignore region. A start marker in an unchanged style tag
attribute and an end marker outside it form valid original input, but omitting
that style leaves a lone end marker in full material. The route must preserve
the full path's validation failure. `m8-ignore-boundary-before.log` captures
the failing regression first; the final in-progress unit run was intentionally
interrupted before tracked edits. Its `m8-final-*` output and stop note are
retained; the completed post-fix run uses `m8-verified-*` evidence instead.

## Proof And Oracle Coverage

`component_style_*.test.ts` covers the contract cases in both modes, comparing
each named view with route-disabled and complete-path oracles. Its helper asserts
one completed path per view, one page-analysis parse for routed views, and zero
projection/hash work. The child-process work probe intercepts both parse5 entry
points, accepts only the original head, and rejects calls to projection,
implementation comparison or full resource comparison. Ordinary usage-topology
and signal work still contributes to `implementationMs`.

Exact inline counters prove reuse of unchanged elements and preparation after
predicate rejection or parse failure. Grouped/nested displacement tests include
duplicates across elements, custom properties and references; an unchanged
whole-parser element proves that pair-wide full-diff fallback is preserved.

All **64 eligible views per mode** of the small cumulative component-style
fixture take the route. Catalogue results and membership equal both oracles. A deterministic
seed `0x8c51a7` applies 320 single-window edits to real RNW sheets in both modes
(640 differential comparisons): insertions, deletions, declaration changes,
formatting, escaped strings, syntax failures and marker lookalikes. Failures print seed, case, mode,
view and window. Earlier M7/M5 oracle helpers explicitly disable the new route
where their purpose is to exercise complete comparison.

Existing exact diagnostic assertions add `stylePath: 0`, and the count invariant
adds style settlements. No prior outcome assertion is weakened or removed.

## Verification

Every Node command uses `npm exec --yes --package=node@24.19.0 --`.
Targeted route and CSS/page-equivalence suites, static checks and complete suite
results are recorded below. Browser and hydration use
`PLAYWRIGHT_CHANNEL=chromium`, matching CI. Raw evidence uses the `m8-` prefix
under `.context/delegation/scalable/`.

The first frozen run passed package, all 3,649 unit tests, all 725 browser tests
and all 219 hydration tests with no failures, skips or cancellations. Hashes of
all 2,238 authored files remained unchanged across that run. Because the marker
gap fix followed it, final verification is repeated on the approved implementation;
the earlier `m8-checkpoint-*` reports remain retained rather than overwritten.

Final code verification uses the following commands, each suite preparing its
own output. The browser command ran again after the control described below.

```sh
for suite in package unit browser hydration; do
  PLAYWRIGHT_CHANNEL=chromium npm exec --yes --package=node@24.19.0 -- cargo xtask check --suite "$suite"
done
```

| Suite         | UTC interval, October 3, 2026 | Final result                                                                             |
| ------------- | ----------------------------- | ---------------------------------------------------------------------------------------- |
| Package       | 10:45:58–10:48:09             | Build, typecheck, example validation, package inspection and packed-consumer smokes pass |
| Unit          | 10:48:09–11:01:59             | 3,679/3,679 pass                                                                         |
| Browser rerun | 11:44:01–12:10:35             | 725/725 pass, pinned Chromium                                                            |
| Hydration     | 12:10:35–12:25:47             | 219/219 pass, pinned Chromium                                                            |

Every final suite has exit zero; no failed, skipped or cancelled test is accepted.
Hashes prove all **2,242 authored files** stayed unchanged through this run,
including the browser investigation and rerun. Only Markdown bookkeeping follows.

The following also pass; Node commands use the prefix stated above:

```sh
npm run typecheck
npm run format:check
npm run lint
node scripts/verification/repository-ratchets.mjs
node --import tsx --test --test-concurrency=2 tests/component_style_*.test.ts tests/component_protocol_docs.test.ts tests/protocol_doc_sizes.test.ts tests/protocol_doc_history.test.ts
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
cargo xtask rust-file-length-lint --all
```

The final targeted command passes **204 tests** (197 route tests and seven
documentation tests); the earlier CSS/page equivalence command passed 900.
Rust passes 11 tests and audits nine files. Every new TypeScript test/module
remains below 300 lines. Existing oracle changes disable both shortcuts where
complete comparison is intended; diagnostic expectations add the new zero count.

## Browser Control And Retained Evidence

The first final-code browser run (11:01:59–11:28:00) passed 724/725. The sole
failure was `comparison_regions_input.spec.ts`, “scroll keys after a click inside
a panel scroll that panel in every version”: `ArrowDown` failed its unchanged
5 s exact-offset assertion. It is retained, not relabeled as a passing run.

A detached, clean `/tmp/mokly-m8-control-96ddc06c` was installed with `npm ci`
and separately prepared with `npm run prepare:verification`, both under Node
24.19.0. Its source stayed clean at `96ddc06c`. The failing spec and viewer code
are byte-identical between that commit and this implementation. On the same
2.90GHz host, this unmodified pinned-browser control ran:

```sh
PLAYWRIGHT_CHANNEL=chromium MOKLY_PLAYWRIGHT_PORT=4518 npm exec --yes --package=node@24.19.0 -- npx playwright test tests/browser/comparison_regions_input.spec.ts --project=chromium --grep 'scroll keys after a click inside a panel' --repeat-each=30 --reporter=list,json
```

It passed 23 and failed seven, all with the **same ArrowDown timeout**. This meets
the delegation brief's previous-milestone reproduction requirement. No UI code,
test assertion, retry setting or timeout changed. The complete rerun above passes
all 725 tests; no browser exception is required for the checkpoint.

Evidence under `.context/delegation/scalable/` includes:

- `m8-verified-{package,unit,browser,browser-retry,hydration}.log/.exit/.before/.after`;
  unit/browser/browser-retry/hydration also retain complete `.json` reports.
- `m8-browser-control-{setup,install,prepare,scroll}.log`, control `scroll.json`,
  `m8-browser-scroll-failure/` and `m8-browser-scroll-control-artifacts/`.
- `m8-verified-{targeted,format,lint,ratchets,rust}.log`,
  `m8-boundary-typecheck.log`, and `m8-verified-frozen-{inputs,check}.json`.
- `m8-marker-{probe,contract-proposal,before}.*`, the source/ignore-boundary
  regression-first logs, the intentionally interrupted `m8-final-*` run and stop
  note, and `m8-coverage-mutant.log` (the mutant was rejected and restored).

The deletion audit introduces no removals relative to `96ddc06c`. The direct
`origin/main` deletion list is unchanged from that starting commit; main's later
additions remain deliberately unmerged until M10. Only the two previously
authorized component-ownership files are deleted in the merge-base diff.

The combined `cargo xtask check`, approved ABBA/control measurements, push and
supervisor review remain after checkpoint approval under the delegation brief.
The known external braces audit blocker does not authorize dependency or gate
changes. No M9 work is included.
