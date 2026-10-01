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
root against its interval. `rule_collector.ts` guards descendants/declaration
runs and preserves the delivered depth-first records. Contextual encoding,
import and namespace statements always use whole-element parsing.

`segment_analysis.ts` resolves hits, verifies the entire batch before inserting
anything, and rebases immutable local runs. `inline_rule_lists.ts` rebases again
in document order; its weak parser association supports standalone injected
parsers without a second cache in the production classification wrapper.

`rule_identity.ts` stores address/identity, rank, canonical text and references
once in a weak rule association; the custom-property flag stays on the record.
Ordinal copies share that immutable data. `diff.ts`, `material.ts` and
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
Real committed/derived catalogues compare segment assembly against a whole
parser oracle. M5 cancellation, page reuse and fingerprints are not implemented
by these modules yet.

See [parse reuse](../../../docs/protocol/mokly-css-parse-reuse.md),
[inline ownership](../../../docs/protocol/mokly-inline-styles.md),
[CSS attribution](../../../docs/protocol/mokly-css-attribution.md) and
[diagnostic counts](../../../docs/protocol/mokly-timings.md#component-analysis-counts).
