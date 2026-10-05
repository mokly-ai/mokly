# Component Review Fast Path

## Delivery Status

Removal of baseline compatibility is implemented in
[M23B](../../plans/remove-source-path-evidence.md#milestone-23b-remove-baseline-compatibility).

Uniform CSS eligibility, root-boundary handling and catalogue-wide rule proof
are implemented in [M19](../../plans/remove-source-path-evidence.md#milestone-19-classify-css-by-where-its-rules-match) of the [source-path removal plan](../../plans/remove-source-path-evidence.md).

The fast path and its strict-v8 baseline boundary are implemented.
The fast path is implemented over the strict path-keyed manifest-v8 baseline boundary.

This contract owns the unchanged-view decision used by component-aware Changes
classification. Input ownership and materiality remain defined by
[Component Change Attribution](./mokly-component-changes.md).

## Decision

Classification cost follows the size of the change, not the catalogue. For a
view present on both sides, the classifier first decides whether it can differ.
It validates ranges and projects ownership only when usage can edit text through
instances, root ranges, styles, or entry-owned slots, then performs CSS analysis and
implementation diffing only after complete-path fall-through.

The decision is part of materiality and must equal the complete comparison for
every view produced by the validated builder; differential fixtures are required
evidence. Identical handcrafted documents with equally malformed ownership
markers are outside this equivalence for views without ownership text edits,
because those views do not repeat range validation.

Apply these steps in order:

1. Retain v8 component markers on both sides and apply paired manual-ignore
   normalization. If documents differ outside paired ignored regions, take the
   complete path. Marker-stripped equality is insufficient because marker
   positions participate in ownership projection.
2. Compare usage records canonically. Neither side having usage is eligible;
   exactly one side having it takes the complete path. When both exist, every
   field must match except `props` and `propsKey` on entry-owned instances.
   Both records must pass current v8 validation, including rejection of CSS owners.
   View axes, instance identity/ownership/order, instance-owned props, and every
   slot, range, style, and resource record must match. Optional invocation
   `source` is excluded, as it is from every Changes projection.
3. Strip package component markers from both sides and apply paired
   manual-ignore normalization. If the documents differ, take the complete
   path. Discover the head closure in committed mode and both closures
   independently in derived mode.
4. When either usage record has instances, a root range, styles, or entry-owned slots,
   compute the complete comparison's ownership projection, including v8 range
   validation and root-specific ownership. Require equal projected HTML and
   discover its resources with the same exclusions: head only in committed
   mode, both sides in derived mode.
5. If an actual or projected resource is a changed Git path, take the complete
   path; non-CSS ownership, exclusion and rule analysis are decided there. CSS
   cannot be skipped through a resource owner record.
6. In derived mode, compare baseline/current closure membership and bytes
   independently for actual and projected material. Any difference takes the
   complete path; equal unions do not replace equal per-comparison sets.
7. Otherwise content and resources are unchanged. State is `unchanged` when
   the single-document normalizations of both stripped sides match and
   `ignored-only` otherwise; `ignoredIds` come from paired normalization. Emit
   no `material`, `reasons`, or `excludedResources`, owned-resource, or
   implementation-impact evidence, exactly as the complete path would.

`inputs` and `structure` reasons come from validated usage, never document
text. An entry-owned input edit that renders identical HTML keeps its `inputs`
reason on either path. Entry-owned `props` and `propsKey` are the only usage
fields allowed to differ because the fast decision projects their signals like
the complete path. Nested input, topology, or ownership changes require full
projection and implementation analysis. Entry-level metadata, added/removed,
and dependency reasons are computed outside the per-view comparison.

Before finalizing any CSS-bearing view, collect own-page matches from the
complete catalogue. Retain unfiltered sets for the nested-component test and
kept matches for component membership. The fast path may avoid local analysis only with the
same changed-resource proof as the complete path. It cannot finalize a consumer
before the rule-to-component set is complete. Selected comparisons reuse those
facts; cache reuse must invalidate when another own page changes them.

## Resource And One-Sided Rules

Projected resources are not necessarily a subset of actual-document resources.
HTML parsing can discard caller slot content inside `template` or `select`, and
ownership projection can expose it. Removing implementation text can expose a
sibling hidden by malformed HTML. Views whose usage cannot edit document text
retain actual-only proof; views with instances, root ranges, styles, or entry-owned slots
require safe actual and projected comparisons. Reuse identical
`(document, exclusion)` discovery on fall-through.

Resource discovery is reused by the complete path. Cache normalized text by
derived document identity, content digest, and exclusion callback identity so
one classification never repeats discovery for the same document and policy or
retains a complete document as a map key.

Added and removed views do not use the paired decision. Before normalizing the
one-sided v8 document, validate every recorded component range. A malformed
ownership tree fails with `$document` validation instead of becoming an
ordinary addition or removal.
