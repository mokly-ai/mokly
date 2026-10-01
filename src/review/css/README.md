# CSS Rule Analysis

Internal linked-stylesheet and component-aware inline analysis. Public wire
records and attribution policies remain in the protocol documents; these
modules only reuse parsing and stored rule material.

## Parsing And Lifetime

`CssResourceAnalysis` owns two independent 64 MiB estimated-byte LRUs for its
classification lifetime. Linked files use exact whole-input keys. Eligible
inline elements use normalized top-level segment keys; uncertain elements
fall back to the whole-input cache, including parse failures. Batched errors
are never cached as verified segment runs. Eviction changes only parsing time.

`segments.ts` is a non-throwing UTF-16 boundary scanner. `rules.ts` invokes
Lightning CSS once per element's distinct misses and verifies every native
root against its interval and requires one extra root at the fixed appended
`@mokly-segment-end;` sentinel's exact offset, proving the last terminator was
consumed even when native CSS accepts an unclosed EOF comment. The sentinel
is never part of a cached run. `rule_collector.ts` guards descendants/declaration
runs and preserves the delivered depth-first records. Contextual encoding,
import and namespace statements always use whole-element parsing.

`segment_analysis.ts` resolves hits and verifies the entire batch before inserting
anything. `inline_rule_runs.ts` keeps cached runs plus document ordinal offsets;
its weak parser association supports standalone injected parsers without a second
production cache. Production parses expose runs only; M4 rebasing and whole-list
assembly adapters live under `tests/helpers/inline_parse.ts`.

`inline_segment_changes.ts` cancels cached identity runs earliest-first, expands
only surviving rules and reference-bearing matched copies, and runs the ordinary
diff on survivors. A whole-element fallback disables cancellation for the pair.
`inline_rule_deltas.ts` pairs remaining exact reference occurrences without
reusing added/removed/changed copies. `inline_rendering.ts` selects by document
ordinal, sorts existing rule references once per side by canonical rank/identity
and filters that order for projected material before concatenating stored text.
Exact selected-copy counts preserve duplicate multiplicity without copying rules;
resolved results retain runs, not full-list compatibility getters.

`rule_identity.ts` stores address/identity, rank, canonical text and references
once in a weak rule association; the custom-property flag stays on the record.
Data is computed on first use, after copying raw material for cached rules;
already-detached immutable rules are not copied again. Document ordinal bases
avoid a second assembly copy. `diff.ts`, `material.ts` and
`inline_rendering.ts` consume it without rebuilding keys or rendering text.
Statement/block form belongs in both keys: `@layer a;` versus `@layer a{}` is
a removed/added, conservatively unresolved change on both paths.

## Retention And Diagnostics

`byte_lru.ts` and `parse_cache.ts` detach every retained key/string through
independent UTF-16 bytes and account for every slot, including derived data
and identity runs. `cache_error.ts` freezes safe failure snapshots constructed
with stack recording disabled, restoring the global limit in `finally`.
Deleting a visible stack alone does not clear V8's hidden source-retaining
frames. Opaque errors remain uncached.

Production-entry-point GC tests use style/source slices from 48 MiB pages;
direct slot probes additionally pin every stored string and spaced paths.
Timing-only segment totals belong to the shared diagnostics context, never
to production parameters or a disabled-session collector.

## Development

After building, run `node --import tsx --test tests/review_css_*.test.ts`.
Differentials replay the delivered parser corpus, real cumulative React
Native Web rendering, Emotion-style elements and 1,000 seeded mutations.
Real committed/derived catalogues compare against whole-list classification.
Captured M4 orchestration under `tests/helpers/inline_m4_*.ts` pins flat pairing,
materials and reference behavior; grouped displacement and the duplicate-copy
correction have explicit expected results. Seeded flat mutations and real RNW
views exercise cancellation; a counting diff proves N-to-N+1 sheets analyse one
rule. Cached-rule Proxies reject copying during composition, and mixed-element
fallback tests reject partial cancellation. Page reuse and fingerprints remain
later-milestone work.

See [parse reuse](../../../docs/protocol/mokly-css-parse-reuse.md),
[inline ownership](../../../docs/protocol/mokly-inline-styles.md),
[CSS attribution](../../../docs/protocol/mokly-css-attribution.md) and
[diagnostic counts](../../../docs/protocol/mokly-timings.md#component-analysis-counts).
