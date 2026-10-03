# Classification Diagnostics

`timings.ts` owns opt-in AsyncLocalStorage sessions, spans and comparison counters.
Disabled sessions construct no document-work collector, take no operation clocks
or heap samples, and retain no counter state. Call sites use one context check;
do not add counter-only parameters to production APIs.

`runWithDocumentWork` shares an existing collector across nested comparisons.
`readCatalogueChanges` includes the preceding page pass when either manifest
registers components; direct classification owns only its comparison loop.
Neither changes matching or resource policy. Build-time parses stay outside the
scope even when ordinary build timings are enabled.

`html_parse.ts` preserves parse5 options and counts each attempt at its owning
step. `document_work.ts` subtracts nested synchronous work from its caller and
samples V8 used heap immediately after every completed compared view. Its
sampler is injectable through the timing sink for deterministic tests; path
counts remain owned by `review/component_comparison_counts.ts`. Resource
I/O is outside local operation clocks. Counts have no document or path labels.

The same enabled collector owns inline element/segment/hit/parse/fallback
totals and emits one `review.inline-style-analysis` counts event on completion.
Batch failures count attempted distinct misses, never unverified duplicate hits.

The normative fields, units, rounding and emission rules live in
[the timing contract](../../docs/protocol/mokly-timings.md#component-analysis-counts).
Tests pin exact per-step parse counts and verify disabled collection, exclusive
durations, UTF-8 byte accounting and shared classification lifetime. Real Serve
tests pin the preceding page pass; real-view tests pin each heap sample and peak.
`pageAnalysis` counts the component-aware loop's single source-located original
view tree, shared by validation, discovery and selector matching. Resource
HTML is counted separately and retains its reader's own trees; the separate
page pass keeps its legacy steps and parse cache. Parse5 interception tests
reject uncounted, repeated or rewritten-page parses, including owned references.
`review/page_parser.ts` counts its single `Parser.parse` at the same owning
step; parser-token provenance adds no second parse. Interception covers both
parse5 entrypoints so the subclass cannot evade the count.
The style-only route records one `stylePath` per settled view and one head
`pageAnalysis` parse. Attempts that fall through record only `completePath`;
their element/segment counts reuse preparation instead of repeating parsing.
Usage-topology/signal checks still contribute `implementationMs` on shortcut
paths; that field alone does not imply a markup implementation comparison.

Run `npm run build`, then:

```bash
node --import tsx --test tests/component_document_work.test.ts tests/document_work_counters.test.ts tests/timings.test.ts
```
