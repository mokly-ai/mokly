# Component Review Fast Path

## Delivery Status

The fast path and its strict-v7 baseline boundary are implemented. The delivered
decision prepares inline analysis for possible references. Approved target of
the [scalable analysis plan](../../plans/scalable-inline-style-analysis.md):
[M7](../../plans/scalable-inline-style-analysis.md#milestone-7-shared-page-analysis)
delivers the analysis-backed quick check below with no inline work;
[M8](../../plans/scalable-inline-style-analysis.md#milestone-8-style-only-route)
adds the equivalent style-only attempt before complete fall-through.

This contract owns the unchanged-view decision used by component-aware Changes
classification. Input ownership and materiality remain defined by
[Component Change Attribution](./mokly-component-changes.md).

## Decision

Classification cost follows the size of the change, not the catalogue. For a
view present on both sides, the classifier first decides whether it can differ.
It uses [page analysis](./mokly-page-analysis.md), and projects ownership only
when usage can edit text through instances or entry-owned slots. Inline rule
analysis and implementation diffing happen only after quick-check fall-through.

The decision is part of materiality and must equal the complete comparison for
every view produced by the validated builder; differential fixtures are required
evidence. Malformed usage, required ranges or ignore syntax retain their normal
validation diagnostic; they are not proof of an unchanged view.

Apply these steps in order:

0. Try the [identical-text check](./mokly-page-analysis.md#identical-text-quick-check).
   It shares the head analysis and raw seeds, skips projection and preserves
   usage reasons. Its failed resource proof retains preparation for fall-through.
1. Retain v7 component markers on both sides and apply paired manual-ignore
   normalization. If documents differ outside paired ignored regions, take the
   fall-through. Marker-stripped equality is insufficient because marker
   positions participate in ownership projection.
2. Compare usage records canonically. Neither side having usage is eligible;
   exactly one side having it takes fall-through. When both exist, every
   field must match except `props` and `propsKey` on entry-owned instances.
   View axes, instance identity/ownership/order, instance-owned props, and every
   slot and range record must match. Optional invocation
   `source` is excluded, as it is from every Changes projection.
3. Strip package component markers from both sides and apply paired
   manual-ignore normalization. If the documents differ, take fall-through.
   Discover resources from the page analyses' derived records under the
   [resource proof](#resource-and-one-sided-rules), preserving its mode-specific
   reader and closure bounds.
4. When either usage record has instances or entry-owned slots,
   compute the complete comparison's ownership projection, including v7 range
   validation and root-specific ownership, but no inline analysis. Retain
   preparation on fall-through, so a side is parsed only once. Require equal
   projected material and use provenance-derived resources plus conservative
   raw inline references; potential changed owned/excluded references take
   fall-through instead of requiring attribution in the quick check.
5. If an actual or projected resource is a changed Git path, take the complete
   fall-through; ownership, exclusion, and rule analysis are decided there.
6. In derived mode, compare baseline/current closure membership and bytes
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

## Resource And One-Sided Rules

Committed mode traverses only the head reader's actual closure, plus its
projected closure when required below; a changed Git path in either takes
fall-through. With shared seeds, a base-only dependency is reachable only
through a resource whose content differs and whose changed Git path is already
in the head closure. Base traversal is therefore redundant. Derived mode
traverses both readers independently for each required material and compares
membership and bytes; equal unions are not proof of equality.

Projected resources need not be a subset of actual resources: copying caller
content out of an inert template can expose recorded references. Parser-discarded
tokens remain absent under the page contract's provenance rule, even if reparsing
rewritten HTML would expose them. The delivered decision requires independent
actual and projected proof for views with instances, entry-owned slots or
possible inline references. [M7 page reuse](./mokly-page-analysis.md#identical-text-quick-check)
limits projection to ownership text edits; other views retain actual-only proof.
Reuse preparation on fall-through.

Resource discovery is reused by the complete path. Cache discovery by side,
route, derived-reference identity and exclusion policy, without retaining
complete material HTML as a map key. The page contract defines copy exposure
and parser-context differences; do not reparse a projected page to compensate.

Added and removed views do not use the paired decision. Before normalizing the
one-sided v7 document, validate every recorded component range. A malformed
ownership tree fails with `$document` validation instead of becoming an
ordinary addition or removal.

Inline references require conservative proof even when a complete analysis
would omit them as owned or excluded. A potentially changed reference takes
fall-through. No fast-path view, including a reference-bearing one, runs inline
analysis or emits its evidence.
