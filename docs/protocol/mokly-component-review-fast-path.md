# Component Review Fast Path

## Delivery Status

Removal of baseline compatibility is implemented in
[M23B](../../plans/remove-source-path-evidence.md#milestone-23b-remove-baseline-compatibility).

Uniform CSS eligibility, root-boundary handling and catalogue-wide rule proof
are implemented in [M19](../../plans/remove-source-path-evidence.md#milestone-19-classify-css-by-where-its-rules-match) of the [source-path removal plan](../../plans/remove-source-path-evidence.md).

The fast path and its strict-v10 baseline boundary are implemented.
The fast path is implemented over the strict path-keyed manifest-v10 baseline boundary.
The [scalable analysis plan](../../plans/scalable-inline-style-analysis.md)
keeps the analysis-backed quick check, fingerprints and equivalent style route.
Performance acceptance is deferred under Decision 13 (2026-10-06).

This contract owns the unchanged-view decision used by component-aware Changes
classification. Input ownership and materiality remain defined by
[Component Change Attribution](./mokly-component-changes.md).

## Decision

The classifier tries to avoid full comparison for unchanged views. For a view
present on both sides, it first decides whether that view can differ.
It uses [page analysis](./mokly-page-analysis.md), and projects ownership only
when usage can edit text through instances or entry-owned slots. Root ranges
are validated by shared page analysis but do not themselves project text. Inline rule
analysis and implementation diffing happen only after quick-check fall-through.

The decision is part of materiality and must equal the complete comparison for
every view produced by the validated builder; differential fixtures are required
evidence. Malformed usage, required ranges or ignore syntax retain their normal
validation diagnostic; they are not proof of an unchanged view.

Apply these steps in order:

0. Try the [identical-text check](./mokly-page-analysis.md#identical-text-quick-check).
   If link normalization is present, require its metadata proof that equal
   original text normalizes equally on both sides. Without that proof, skip
   only step 0 and continue with the normalized quick check in step 1.
   A reused path after a move can otherwise change link identity
   without changing the HTML. The proof scans no document or stylesheet text.
   It shares the head analysis and raw seeds, skips projection and preserves
   usage reasons. If any eligible unowned style's outer source contains
   `<!--mokly-review-`, take fall-through: canonicalization may remove region
   markers or material signals even from identical texts. Inspect only the head
   in this check. Decode eligible content and use the conservative reserved-marker
   matcher below: serialization can decode escapes and join comments/whitespace.
   Also check after removing escaped newlines everywhere. These source-only
   checks run no inline analysis; failed proofs retain preparation.
1. Retain v10 component markers on both sides and apply paired manual-ignore
   normalization. If documents differ outside paired ignored regions, take the
   fall-through. Marker-stripped equality is insufficient because marker
   positions participate in ownership projection. For non-identical sources,
   require equal ordered eligible unowned style outer sources on both sides:
   ignored markup can change HTML parsing context and therefore style eligibility.
   Apply both guards on both sides: literal `<!--mokly-review-` in outer source,
   and the conservative decoded reserved-marker matcher in content. This includes
   paired/one-sided region markers and material signals. The complete
   path decides state, ignore evidence and validation after canonicalization.
2. Compare usage records canonically. Neither side having usage is eligible;
   exactly one side having it takes fall-through. When both exist, every
   field must match except `props` and `propsKey` on entry-owned instances.
   Both records must pass current v10 validation, including rejection of CSS owners.
   View axes, instance identity/ownership/order, instance-owned props, and every
   slot, range and resource record must match. Optional invocation
   `source` is excluded, as it is from every Changes projection.
3. Strip package component markers from both sides and apply paired
   manual-ignore normalization. If the documents differ, take fall-through.
   Discover resources from the page analyses' derived records under the
   [resource proof](#resource-and-one-sided-rules), preserving its reader and closure bounds on each side.
   Without ownership text edits, derive actual seeds directly from the analyses:
   do not prepare a projection merely because inline references may exist.
4. When either usage record has instances or entry-owned slots,
   compute the complete comparison's ownership projection, including v10 range
   validation and root-specific ownership, but no inline analysis. Retain
   preparation on fall-through, so a side is parsed only once. Require equal
   projected material and use provenance-derived resources plus conservative
   raw inline references; potential changed owned/excluded references take
   fall-through instead of requiring attribution in the quick check.
   Keep the exclusion predicate stable per view; fall-through reuses discovery
   for the same side, route, reference identity and exclusion policy.
5. If an actual or projected resource is a changed Git path, take the complete
   fall-through; ownership, exclusion, and rule analysis are decided there.
   CSS cannot be skipped through a resource owner record. Validate inserted-link
   provenance on original trees, and include its CSS paths in actual discovery
   even inside paired ignores. Compare provenance paths and declarers without
   treating offset shifts as topology changes.
6. Compare baseline/current closure membership and bytes
   independently for actual and projected material. Any difference takes the
   fall-through; equal unions do not replace equal per-comparison sets.
7. Otherwise content and resources are unchanged. State is `unchanged` when
   the single-document normalizations of both stripped sides match and
   `ignored-only` otherwise; `ignoredIds` come from paired normalization. Emit
   no `material`, resource reasons, `excludedResources`, `inlineStyles`, owned-resource, or
   implementation-impact evidence, exactly as the complete path would.

`inputs` and `structure` reasons come from validated usage, never document
text. An entry-owned input edit that renders identical HTML keeps its `inputs`
reason on either path. Entry-owned `props` and `propsKey` are the only usage
fields allowed to differ because the fast decision projects their signals like
the complete path. Nested input, topology, or ownership changes require full
projection and implementation analysis. Entry-level metadata, added/removed,
and dependency reasons are computed outside the per-view comparison.

On failed quick-check proof, try the [style-only route](./mokly-style-only-route.md)
with its exact conditions; otherwise run the complete comparison. It is not a
weaker fast-path resource decision. One-sided views run neither paired route.

## Source-only Escape Guard

Decode one to six hex digits after a backslash, consuming one following CSS
whitespace terminator (CRLF counts as one). Other escaped characters yield that
character. Inside source strings, escaped LF, CR, CRLF or FF is a removed line
continuation. Zero, surrogate and out-of-range escaped code points, and a trailing
backslash at EOF, yield U+FFFD. Escaped quotes do not open/close source strings.
Only a standalone ident-like `url` enters unquoted-URL state. Hash and at-keyword
names (including escaped starts) do not; raw NUL counts as an ident code point.

Canonical serialization can drop comments between non-word tokens and whitespace
next to `!`. Independently of its exact joining rules, fall through when decoded
content matches this conservative superset, ASCII case-insensitively:

```js
/<(?:[\t\n\f\r !-]|\/\*[\s\S]*?\*\/)*mokly-/i;
```

For this guard only, also remove backslash plus LF, CR, CRLF or FF everywhere
before decoding/matching. Accept either match, retaining the ordinary decoded
check so this extension cannot reduce fallbacks. Comments remain in the decoded
text and are accepted by the matcher; they do not prove a safe boundary.
This source scan performs no CSS analysis. Ordinary utility escapes and `<`
without this separator/marker pattern remain eligible. Complete results and
validation remain authoritative.

Before finalizing any CSS-bearing view, collect own-page matches from the
complete catalogue. Retain unfiltered sets for the nested-component test and
kept matches for component membership. The fast path may avoid local analysis only with the
same changed-resource proof as the complete path. It cannot finalize a consumer
before the rule-to-component set is complete. Selected comparisons reuse those
facts; cache reuse must invalidate when another own page changes them.

## Resource And One-Sided Rules

For both Git-blob and rebuilt baselines, traverse both readers independently
for each required material and compare membership and bytes. A changed Git
path in either closure takes fall-through. Equal unions are not proof of
equality. Traverse the
proof's base closure with optional reads at every graph depth, for both actual
and projected materials. Any missing seed or transitive file fails the proof;
it never throws a missing-resource error from the optimization. Successful
reads/closures remain reusable. Do not retain a failed partial closure as a
complete result. Required full-path reads keep their own validation and errors:
a cached optional absence must not substitute a different required-read error.
Readers without optional methods may probe their required reads; a failed probe
also falls through. Probe the underlying reader and cache only successfully
returned bytes; a rejected probe or batch must never poison required reads of
other files. Reuse successful bytes and the exact complete closure on fall-through.

Projected resources need not be a subset of actual resources: copying caller
content out of an inert template can expose recorded references. Parser-discarded
tokens remain absent under the page contract's provenance rule, even if reparsing
rewritten HTML would expose them. The identical-text check shares conservative
original/caller-copy seeds and needs no projection. Non-identical attempts
retain actual/projected proof where ownership edits require it, without inline
analysis. Reuse analyses and discovery on fall-through; any unattributed
fast-path material is rebuilt for complete attribution as the
[page contract](./mokly-page-analysis.md#identical-text-quick-check) requires.

Resource discovery is reused by the complete path. Cache discovery by side,
route, derived-reference identity and exclusion policy, without retaining
complete material HTML as a map key. The page contract defines copy exposure
and parser-context differences; do not reparse a projected page to compensate.

Added and removed views do not use the paired decision. Before normalizing the
one-sided v10 document, validate every recorded component range. A malformed
ownership tree fails with `$document` validation instead of becoming an
ordinary addition or removal.

Inline references require conservative proof even when a complete analysis
would omit them as owned or excluded. A potentially changed reference takes
fall-through. A resource record inside an eligible unowned style's outer span
that touches a paired-ignore or removed span also requires fall-through:
canonical rules can retain references dropped by raw source provenance.
This check uses source records and spans, without inline analysis. No fast-path
view, including a reference-bearing one, runs inline analysis or emits its evidence.
