# Shared Page Analysis Code Checkpoint

Milestone 7 of the [scalable analysis plan](../../plans/scalable-inline-style-analysis.md)
implements the [page-analysis contract](../protocol/mokly-page-analysis.md)
through its identical-text quick check. Fingerprints and the style-only route
remain pending. This is a code checkpoint, not a performance acceptance run.

## Delivered Boundaries

- `PageAnalysisPair` owns lazy original analyses for one compared view. Each
  used side has one source-located parse5 tree, validated UTF-16 ranges, flat
  ignore spans, eligible style spans and source-reference records. Style and
  reference inventory share a traversal; no normalized/material HTML is parsed.
- Inline and linked selectors share those trees and original owner ranges.
  A WeakMap predicate suppresses only final ignored subjects, not their context.
- Plain-string materials remain byte-identical to the delivered engine.
  Auxiliary recipes derive actual/projected references from wholly surviving
  spans, source copies and producer-supplied insertions. Stored rule references
  seed canonical appendices and inferred owner groups without synthetic HTML.
- Same path, original bytes and canonical topology use only head analysis.
  Committed proof traverses the head reader; derived proof traverses both
  independently and compares membership/bytes. No projection, material hashing
  or inline analysis is needed. Fall-through shares analyses and discovery.
- The scope flag comes from either **input** manifest registering components,
  before identity-kind reconciliation. Component-free shared loops and the
  separate `classifyChangedContent` page path retain their matching/cache policy.
  Embedded HTML has its own reader tree and separately counted parse step.
  Its reference discovery stays unchanged: when paired normalization changes
  resource text, that reader parses it separately from the original matching tree.

## Differential Evidence

The delivered M6 orchestration was captured before changing call sites under
`tests/helpers/page_m6/`. It retains text-material discovery, normalized-tree
matching and the prior style finder. Its imports use the preserved legacy
branches; it is not an oracle made from new expected results.

`page_analysis_materials.test.ts` compares every actual/projected side of the
real design catalogue (unchanged and a real theme edit), both small scale
renderers and inline ownership/reference fixtures in both output modes.
It compares string materials, resolved seeds, transitive closures and public
per-view results against that oracle. Separate cases name the intentional
provenance/context differences instead of allowing unrelated mismatches.

| Case and test                                                                                                      | M6 expectation                                               | M7 expectation and reason                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `component_fast_path_template.test.ts`, select-discarded caller image                                              | Home has dependency/material reason                          | No Home change: copying source text cannot invent an absent parser record. Actual template-copy cases are unchanged.                                      |
| `component_fast_path_projected_resources.test.ts`, select-hidden srcset/style/HTML/import and import membership    | Home changes from rewritten discovery                        | No change: source visibility, not recovery after rewriting, owns reachability.                                                                            |
| Same file, malformed select/template implementation exposing a sibling                                             | Home changes                                                 | No change: removing implementation text does not expose previously discarded/inert sibling records.                                                       |
| `page_analysis_context.test.ts`, sibling, `:nth-child`, `:has()` next to ignored content                           | Excluded                                                     | Matched on both CSS paths: ignored nodes remain context.                                                                                                  |
| Same file, surrounding `:empty` subject                                                                            | Matched                                                      | Excluded: the original ignored child still makes it nonempty. Ignored subjects and inert template descendants remain excluded.                            |
| `page_analysis_embedded_context.test.ts`, linked CSS in referenced HTML                                            | Excluded/unchanged                                           | Matched/changed: embedded reader trees retain the same original sibling context.                                                                          |
| `page_analysis_raw_ignores.test.ts`, paired textarea-bounded region containing a style                             | Changed because DOM-comment discovery missed the flat region | `ignored-only`, id `raw`, no material/inline evidence; the one-sided region still analyzes the style.                                                     |
| `page_analysis_references.test.ts`, partial attribute/style replacements                                           | Reparse may recover surviving URL characters                 | Drop the complete source record whenever any of its span is removed.                                                                                      |
| `changes_inline_references_fast_path.test.ts`, mixed reference fixture                                             | 8 fast/2 complete; every view runs inline analysis           | Same per-view paths/results; only the 2 Home views analyze inline rules and their distinct sheet parses once.                                             |
| `component_material_reader.test.ts` root-specific projection case, moved to `page_analysis_root_resources.test.ts` | Used a parser-discarded select image                         | Uses a real inert-template copy and forces complete comparison; ownership-before-read assertions remain, while select recovery has explicit oracle cases. |

## Parse And Reader Bounds

Exact counter tests pin these before/after counts; embedded parses are separate
from page-side parses, not hidden in the totals:

| Small-fixture comparison                                   |                               Delivered M6 |                                                                            M7 |
| ---------------------------------------------------------- | -----------------------------------------: | ----------------------------------------------------------------------------: |
| One identical fast view                                    |                  3 range + 2 reference = 5 |                                                              1 `pageAnalysis` |
| One complete view with inline/linked CSS and embedded HTML |                      22 across seven steps |                                  2 `pageAnalysis` + 2 `resourceReference` = 4 |
| One added or removed view                                  |                      Not a paired shortcut |                                                1 original-side `pageAnalysis` |
| Identical paired view's resource-graph occurrences         | Actual and projected proofs could both run | At most 1 committed or 2 derived, independent of ownership/reference presence |

`page_analysis_parse_counting.test.ts` intercepts **every** parse5 call in a
child process, rejects non-original inputs and missing source locations, and
checks exactly one parse per used side. It also covers inferred-owner resource
traversal. `page_analysis_quick_resources.test.ts` observes each reader's real
transitive CSS reads, independent derived memberships and prepared fall-through.
`server_document_work.test.ts` retains nonzero legacy page/resource steps beside
the component steps in one session. Separate scope tests cover both output modes.

## Failures Fixed Before The Checkpoint

- A failed non-identical shortcut could reuse its unattributed projection and
  skip inline ownership. Failing committed/derived oracle tests with ignored
  text edits and an unchanged owned URL reproduce the false entry reason;
  fall-through now rebuilds attributed materials from the retained analyses.
- Inferred-owner traversal reparsed a generated `<style>` wrapper, violating
  the page parse bound. It now uses stored references in the component-aware
  path; the exact counts and parse5 interception reject that regression.
- Embedded-reference discovery initially used original resource records even
  when delivered normalization exposed a resource token. A failing oracle case
  pins that unchanged reader policy; only matching uses the original tree.
- Producer references initially added a property to inline material objects.
  They now live in a weak association; every M4/M5 material-shape and byte-equality
  assertion stays unchanged, alongside the new provenance checks.
- An unclosed style lacked an end tag but still contributed ordinary resource
  references. Inventory now spans contributing text nodes; extractor
  differentials cover unfinished and foreign-namespace styles.
- Scope derived from identity-filtered entries could lose the baseline's
  component registration when its ids became screens. A real generation test
  fails unless the flag uses the two input manifests.

## Verification And Deferred Evidence

All Node commands use 24.19.0. The checkpoint runs targeted page/CSS/fast-path/
Changes suites, `npm run prepare:verification`, the complete prepared unit,
Chromium and hydration suites, and format/lint/typecheck. Documentation tests
and a relative-link/anchor audit cover every edited Markdown file. Logs and
verification JSON are under `.context/delegation/scalable/`.

Passed: 704 targeted tests, 3,257 complete unit tests, 725 Chromium tests and
219 hydration tests, with no failures, skips or cancellations. Format, lint,
typecheck and repository ratchets pass; the link audit covers 13 edited/new
Markdown files, 220 local links and 84 anchors with no failures.

After supervisor approval, record both fixtures' no-change/component-style
cold/warm samples, inline delivery headroom and retained HTML-byte/per-step
work against M6. Source-location/inventory overhead and the separate page pass
remain explicit; fewer parsed bytes are not a predicted timing ratio. No fixture
is regenerated or measured at this checkpoint. `cargo xtask check` and push
remain after the approved measurements, as instructed.
