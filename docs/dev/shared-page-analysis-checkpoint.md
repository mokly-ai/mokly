# Shared Page Analysis Code Checkpoint

Milestone 7 of the [scalable analysis plan](../../plans/scalable-inline-style-analysis.md)
implements the [page-analysis contract](../protocol/mokly-page-analysis.md)
through its identical-text quick check. Fingerprints and the style-only route
were pending at this checkpoint; M8 is now covered by the
[style-route checkpoint](./style-only-route-checkpoint.md).
The [approved same-host measurements](./shared-page-analysis-measurements.md)
record all M7/control samples and retained work, not performance acceptance.

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
  or inline analysis runs on success. M8 adds fallback when source-span removal
  drops an eligible-style reference that canonical rules could retain.
  Fall-through shares analyses and discovery.
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

| Case and test                                                                                                      | M6 expectation                                                                                  | M7 expectation and reason                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `component_fast_path_template.test.ts`, select-discarded caller image                                              | Home has dependency/material reason                                                             | No Home change: copying source text cannot invent an absent parser record. Actual template-copy cases are unchanged.                                                                                                 |
| `component_fast_path_projected_resources.test.ts`, select-hidden srcset/style/HTML/import and import membership    | Home changes from rewritten discovery                                                           | No change: source visibility, not recovery after rewriting, owns reachability.                                                                                                                                       |
| Same file, malformed select/template implementation exposing a sibling                                             | Home changes                                                                                    | No change: removing implementation text does not expose previously discarded/inert sibling records.                                                                                                                  |
| `page_analysis_context.test.ts`, sibling, `:nth-child`, `:has()` next to ignored content                           | Excluded                                                                                        | Matched on both CSS paths: ignored nodes remain context.                                                                                                                                                             |
| Same file, surrounding `:empty` subject                                                                            | Matched                                                                                         | Excluded: the original ignored child still makes it nonempty. Ignored subjects and inert template descendants remain excluded.                                                                                       |
| `page_analysis_embedded_context.test.ts`, linked CSS in referenced HTML                                            | Excluded/unchanged                                                                              | Matched/changed: embedded reader trees retain the same original sibling context.                                                                                                                                     |
| `page_analysis_raw_ignores.test.ts`, paired textarea-bounded region containing a style                             | Changed because DOM-comment discovery missed the flat region                                    | `ignored-only`, id `raw`, no material/inline evidence; the one-sided region still analyzes the style.                                                                                                                |
| `page_analysis_references.test.ts`, partial attribute/style replacements                                           | Reparse may recover surviving URL characters                                                    | Drop the complete source record whenever any of its span is removed.                                                                                                                                                 |
| `changes_inline_references_fast_path.test.ts`, mixed reference fixture                                             | 8 fast/2 complete; every view runs inline analysis                                              | Same per-view paths/results; only the 2 Home views analyze inline rules and their distinct sheet parses once.                                                                                                        |
| `component_material_reader.test.ts` root-specific projection case, moved to `page_analysis_root_resources.test.ts` | Used a parser-discarded select image                                                            | Uses a real inert-template copy and forces complete comparison; ownership-before-read assertions remain, while select recovery has explicit oracle cases.                                                            |
| `page_analysis_context_receivers.test.ts`, table and SVG caller-slot receivers                                     | No Home entry reason: body-context copies lose table `td` style and SVG `image href` references | Home receives dependency (committed) or material (derived) evidence from the original receiving context. Actual resource evidence already makes the M6 per-view state `changed`; the difference is the entry reason. |
| `page_analysis_adopted_context.test.ts`, ignored root `.page` before visible `.visible`                            | Unchanged: removing the ignored tag loses `.page`                                               | Changed: the browser's adopted `.page` stays on the original root. References supplied by the ignored tag still drop by span.                                                                                        |
| `page_analysis_adopted_context.test.ts`, ignored root `.hidden` shadows visible `.visible`                         | Changed: removing `.hidden` makes `.visible` adoptable                                          | Unchanged: the original root retains the first `.hidden` class, so `.visible` does not match. Reversed source order retains visible-first precedence on both engines.                                                |

M8's supervisor fixes tighten that raw-reference proof: an eligible-style
reference record dropped by paired-ignore or removed-span intersection requires
full fallback, because canonical rules can retain its URL. Non-identical quick
checks also fall through when paired regions or their markers intersect an
eligible style. Successful quick checks still do no inline analysis; the
complete path remains authoritative for state and ignore evidence.

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
`page_analysis_work_bounds.test.ts` pins non-identical attempts: without
ownership edits, 1 committed/2 derived graph starts; owned fall-through with a
changed linked sheet, 4 starts in either mode. The pair shares one raw
normalization, and component-aware one-sided views perform none.
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

## Supervisor Fixes Before Measurement

These close implementation/documentation gaps in existing rules, not new
Decisions or matching domains. New tests were run against `ee4ead64` before
fixing production code; logs `m7-supervisor-before.log` and
`m7-supervisor-before-refined.log` preserve the failures.

- Adopted second/implied body and second html attributes retain the supplying
  tag's source spans; formatting clones inherit original provenance. Extractor
  and M6 page/embedded-resource differentials cover both modes and both paths.
  A further failing donor-span test prevents raw-text/comment/attribute/select/
  template/foreign-CDATA lookalikes from supplying provenance, including text-span edges.
  `m7-supervisor-cdata-before.log` records the additional CDATA regression first;
  the initial unit run was stopped, and complete verification restarted after the fix.
- Implied table containers inside paired ignored content stay excluded; mixed
  rows and implied body remain subjects. Clones inherit original subject status.
  Inline/linked page and embedded cases compare directly with the M6 oracle.
- Ownership-free attempts no longer project. Owned fall-through uses a stable
  exclusion predicate and cached discovery. Normalization is shared; unused
  style-finder parameters, one-sided normalization and embedded material
  derivation are removed.
- Projected appendices/wrappers remain verbatim after source/copy stripping;
  actual stripping stays byte-identical to M6, including marker lookalikes.
  Flat spans alone decide boundary enclosure for mixed DOM/raw-text markers.
- Stronger offset, split-style, discovery-cache and independent-reader
  assertions reject deliberate mutations (`m7-supervisor-mutants.log` and the
  isolated `m7-supervisor-split-span-mutant.log`); all mutations were restored.

## Verification And Deferred Evidence

The third round clarifies root attributes supplied by ignored start tags as
original-tree context, not a new rule. Both `html` and `body` adoption orders
are pinned against M6 on inline/linked/embedded paths in both modes; the
difference table names ignored `.page` adoption and `.hidden` shadowing.
Ignored-tag URL records still drop by span. Construction now validates every
source-less creation offset and each registered clone's located original once,
in the shared reference/style traversal, before selector-error containment.
Successful re-inventory does not repeat validation; no new HTML parse or tree
walk is added. The attribute lookup uses only attribute identity.

`m7-round3-before.log` and `m7-round3-invariant-before.log` retain failing tests
for the previously masked diagnostic, once-only validation, dead guard and
contradictory contract wording. The corpus now checks every producer spelling
(attribute name/decoded value or contributing style-text span), walks every
element for missing creation offsets and shared-token clone originals, and
keeps the separate exact clone-identity test distinct. The +1 attribute-span,
missing-offset and broken-clone mutations are rejected in
`m7-round3-span-mutant.log`, `m7-round3-creation-mutant.log` and
`m7-round3-clone-mutant.log`; all generated-code mutations are restored.
Round-three verification uses `m7-round3-*` logs/reports. Full browser retries
and measurements are explicitly deferred at this supervisor checkpoint.
Passed: 890 targeted tests, 290 further equivalence/docs tests, all 3,482 unit
tests and all 219 pinned-Chromium hydration tests, without failures, skips or
cancellations. Format, lint, typecheck and repository ratchets pass. No browser
gate exception is needed for these requested suites; prior browser evidence
remains retained in the linked report. Measurement stays pending review.

The second supervisor round replaces first-round donor recovery entirely:
`page_parser.ts` subclasses parse5 8.0.1's exported `Parser`, capturing original
start-token attributes and token-array identities before tree construction.
The default adapter uses those identities for adoption/clones and records the
creating token's UTF-16 offset for source-less elements. No regex recovery,
secondary tokenizer or unregistered-tree fallback remains; missing registration
is a typed internal review failure. This clarifies existing provenance rules.

Empty parser-created `p`/`br` subjects inside paired regions now stay excluded.
Located descendants retain the all-ignored rule, and implied roots remain
subjects. New `.page` and `head` tests replace ineffective global `body` tests.
Committed/derived inline, linked and embedded cases compare real results with
M6, with both fast-path settings for parser-created subjects and donor ignores.
Lookalikes in ignored/end/adopted tag attributes and doctypes cannot supply
spans. SVG/MathML template/select integration points and HTML-select root
adoption are covered. The entire extractor corpus now uses the production
adapter; the separate token-provenance test pins exact original/clone identity. Parse counting
intercepts both `parse` and inherited `Parser.parse`, preserving one tree.

Regression-first evidence is in `m7-round2-before.log` and
`m7-round2-before-extra.log`; `m7-round2-roots-positive.log` and
`m7-round2-roots-mutant.log` prove the replacement non-global tests catch loss
of root-subject status. The corrected derived fixtures keep the changed CSS
Git paths so the M6 oracle actually exercises stylesheet matching, rather
than unrelated byte-only material evidence. `m7-round2-reversion-mutants.log`
checks creation/root/clone reversions; all temporary generated-code mutations
are restored before verification. Final round-two evidence uses `m7-round2-*`
names, retaining the first round's history and browser host exception.
The final root fixture suppresses the host page's explicit head so an embedded
`head` rule cannot accidentally match the host instead of the implied reader
head. Its positive/mutated runs (`m7-round2-final-roots-*`) prove all 12
inline/linked/embedded, committed/derived root tests detect loss of the rule.

Round two passes 825 targeted tests, 280 further equivalence/docs tests, all
3,417 unit tests, and all 219 pinned-Chromium hydration tests. Static checks and
ratchets pass. The full pinned browser run retains the known six host-timing
specs and two additional waits; the requested two-spec, three-repeat diagnostic
passes 104/105 on the fixed tree and 105/105 on clean M6. Neither additional
failure is deterministic; M6 did not reproduce either in that short control.
The [browser report](./shared-page-browser-gate.md#second-round-verification-and-additional-waits)
retains every result and trace. The supervisor's bounded ABBA startup experiment
resolves the hold: fixed/M6 mean ratios are 0.5102 classification, 0.9693 idle
and 0.9092 server CPU. All fixed classification/CPU samples are faster; idle
samples overlap M6's spread or are faster. The Browse wait is therefore an
additional host-timing exception under the supervisor's decision rule, allowing
the local commit. No UI/timeout change or large-fixture measurement occurs.

All Node commands use 24.19.0. The checkpoint runs targeted page/CSS/fast-path/
Changes suites, `npm run prepare:verification`, the complete prepared unit,
Chromium and hydration suites, and format/lint/typecheck. Documentation tests
and a relative-link/anchor audit cover every edited Markdown file. Logs and
verification JSON are under `.context/delegation/scalable/`.

The initial pre-reboot checkpoint passed 704 targeted tests, 3,257 unit tests,
725 browser tests and 219 hydration tests using system Chrome, without failures,
skips or cancellations. Its preparation and fresh publication are recorded in
the [post-reboot investigation](./shared-page-browser-gate.md).

After the supervisor fixes and reboot, 724 page/CSS/fast-path tests, 222 further
equivalence/documentation tests and 3,316 full unit tests pass. Format, lint,
typecheck and ratchets pass. Pinned hydration passes all 219 tests. The supervisor
accepts the six pinned-browser host-timing specs for the local code commit:
the VM moved from a 2.90GHz to a 2.50GHz Xeon host, and cold pre-M7 M6 reproduces
the same failures. The linked investigation retains the duration ratios,
every failed/interrupted run and three cold direct-export timings. No UI code,
browser assertions or timeouts change. M10 requires the complete green suites
in CI or on a reference-CPU host before final acceptance.

The [measurement companion](./shared-page-analysis-measurements.md) records the
approved default ABBA and cumulative M6-then-M7 comparison, all fixed-wait
outcomes and supplementary uncapped pairs, inline headroom and retained work.
Same-host no-change improves about 65% cumulative, style about 50%; parsed-byte
reductions match M6's roughly 80%/83% model. Source-location/inventory overhead,
the separate page pass, timing spread and the changed host remain explicit.
Final verification uses pinned Chromium; the linked browser report records its
result and the supervisor-approved host-timing boundary before push.

## Post-measurement Verification And Push Hold

The supervisor authorizes local evidence commit `237c5a6c`, not a push or audit
exception. `PLAYWRIGHT_CHANNEL=chromium cargo xtask check` exits 1 at its first
dependency-audit command, with 13 transitive high-severity reports from unpatched
braces `GHSA-vfj7-8cjw-p6xm`. That failure remains recorded, not overridden.

On clean `237c5a6c`, Node 24.19.0, each remaining suite runs **once**, separately
through `cargo xtask check --suite <suite>`, with its own preparation. Browser
and hydration explicitly use `PLAYWRIGHT_CHANNEL=chromium`, matching CI.
No other build/suite runs concurrently, and no prepared output is silently reused.

| Suite     | UTC interval, October 3, 2026 | Result                                                                                   | Exit |
| --------- | ----------------------------- | ---------------------------------------------------------------------------------------- | ---- |
| package   | 03:46:38–03:49:19             | Build, typecheck, example validation, both packed packages' five consumer scenarios pass | 0    |
| unit      | 03:49:51–04:06:39             | 3,482/3,482 pass; no failures, skips or cancellations                                    | 0    |
| browser   | 04:12:04–04:43:53             | 725/725 pass; no failures, skips or cancellations                                        | 0    |
| hydration | 04:48:23–05:07:08             | 219/219 pass; no failures, skips or cancellations                                        | 0    |

**No browser exception is needed in this run.** Every previously recorded
host-timing spec passes, including Browse and the component-preview wait.
The ordinary-preview export completes in 213,412.60 ms, inside its unchanged
300 s setup limit. This green run does not erase the previous failures/control
evidence or waive M10's reference-machine acceptance requirement.

All Repository checks after the blocked audit also pass when run directly:
Prettier, ESLint, repository ratchets, Rust formatting, Clippy, 11 Rust tests and
the nine-file Rust length audit. No dependency, override, UI, timeout or gate
changes occur. The audit is the **only observed verification blocker**;
passing the individual suites is not a successful combined `cargo xtask check`.

Evidence remains under `.context/delegation/scalable/m7-measurements/`:
`remaining-{package,unit,browser,hydration}.log/.exit`, each before/after record,
unit/browser/hydration `.json` reports and `remaining-repository.log/.exit`.
The supervisor reports main's Repository job passed October 2 at 09:24 UTC,
before the advisory reached npm audit at 22:36 UTC; this is supplied context,
not an independent main audit. Push remains held for the user's gate decision.
M8 remains unstarted and also waits for M5 finding 1 and M6 finding 2 decisions.
