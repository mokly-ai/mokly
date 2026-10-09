# Component Comparison Schema

## Delivery Status

CSS per-rule attribution and the revised v7 evidence are implemented in [M19](../../plans/remove-source-path-evidence.md#milestone-19-classify-css-by-where-its-rules-match)
of the [source-path removal plan](../../plans/remove-source-path-evidence.md). Comparison details are implemented in [M20](../../plans/remove-source-path-evidence.md#milestone-20-show-the-outside-component-evidence).

The producer, source validator, artifact publisher, exporter, and browser
decoder implement this path-keyed component-aware schema v7 for
[change attribution](./mokly-component-changes.md). `ReviewResult`,
`ScreenReview`, `ViewReview`, and `ReviewState` refer to the base
[Changes contract](./mokly-changes.md) and
[named result interfaces](../../packages/viewer/src/review/types.ts).
Manifest/usage types come from the
[component manifest](./mokly-component-manifest.md). Version 7 addresses
screens, components, variants, and views by entry path and view axes, carries
`previousPath` for paired moves, and stores no artifact path.

## Normative Result

Every catalogue emits the [comparison v7 records](./mokly-component-comparison-records.md).

## Reasons And Secondary Evidence

Changed entries have duplicate-free reasons, empty only for a paired pure move. Added/removed reasons
require the corresponding missing side; metadata compares the explicit entry
projection, including a parent's schema/controls and a variant entry's props
and supplied slots. Material means a
normalized content change; inputs means caller-owned data changed; structure
means caller-owned logical occurrence identity/order changed. Record every
applicable reason, without deriving membership from raw fragment paths alone.

A dependency reason names a `changedPaths` path. Independent reasons follow
[component change attribution](./mokly-component-changes.md#rendered-resources-and-styles):
only retained rendered resources supply path evidence. Non-CSS file ownership
comes from renderer `resources` and inferred inline references. Inline document
material uses inferred owners, and returned renderer `styles` is ignored. CSS uses own-page rule
matches kept after nested filtering, never stylesheet owner records. A
stylesheet reason may carry the
[CSS change attribution](./mokly-css-attribution.md) `analysis` record;
its `selectors` are sorted and duplicate-free, `analysis` appears only on
stylesheet paths in analysis scope, a view carries `material: true` exactly
when its actual materials differ after normalization, inserted-link removal
and inline canonicalization, and a view's `excludedResources` paths must be in
`changedPaths` and never coincide with that view's dependency reasons. A screen reason names a step's `screenPath`, is allowed only on a use case, and
must reference a directly changed screen actually used on at least one side.
Use cases also retain their own metadata reasons. One screen with
only affected component evidence cannot produce a use-case screen reason.
An affected-only consumer has no ChangedEntry unless it has another direct
reason. Its full comparison remains available through the other result arrays.
For a non-stylesheet resource, a retained view `dependency` reason is also a
direct component reason for each rendered owner named by that view's
`resources` record, even if no saved variant uses the resource. A consuming
screen with no independent change remains affected-only; unowned resources
retain ordinary view-level evidence.

A view reported `unchanged` or `ignored-only` through the
[unchanged view decision](./mokly-component-changes.md#unchanged-view-decision)
carries no `material`, `reasons`, or `excludedResources`, retains its
`ignoredIds`, and adds no implementation-impact or owned-resource evidence.
For valid builder output its record equals the complete comparison's record.
The linked contract defines eligibility, ownership projection, malformed
markers, and one-sided range validation.

Views omit empty `reasons` and `excludedResources` lists and sort both by path.
Entry reasons merge by path and rule key under the
[CSS evidence schema](./mokly-css-attribution-membership.md). It adds per-rule
changed component paths and page evidence in review result v7. A component-only rule can be absent from a consumer's entry reasons while still
appearing in its view evidence. CSS at an actual invocation cannot change a
component whose own pages keep no match for that rule. Non-CSS resource
ownership keeps its current suppression policy. One view's exclusion never
cancels another's retained evidence.

Each affected record groups one changed component and one canonical consumer.
Its `changedComponentId` must name a component that appears in `changes` with
kind component, and evidence must be nonempty.
Build its evidence from the union of baseline/current actual usage, deduplicating
identical evidence. A consumer may also be directly changed. Self-impact is not
listed. A component is listed as affected only through an actual usage path, not
because it happens to share a directory.

Every `via` is a nonempty caller-ownership chain from the consumer to the changed
component; its last `componentId`, mapped through accepted pairs, equals `changedComponentId`. Each instance key
must exist in the referenced side/context's manifest usage, with its stated
`componentId` and a valid ownership edge to the next occurrence. Direct screen
use has one element. A component consumer either owns the context entry or is
an earlier instance on that chain within a screen/another component's context.
The evidence's full context remains available to open that actual usage; never
invent a saved variant for a screen-supplied prop combination.

Use input ownership, not physical slot placement, to determine these edges. A
screen-supplied child in a container slot remains a direct screen dependency.
The [branch-point lookup](./mokly-branch-point-lookup.md#reference-sides) resolves
each evidence destination from its own side; stored evidence paths never change.
Repeated physical placements do not duplicate logical evidence or screen counts;
the inspector can resolve that logical instance to its current ranges.

The v7 result has no `sharedImpact`; its entries omit `dependencies` and
`sharedImpact` (both removed). The inherited `kind: "dependency"` reason names a referenced
resource, not a manually declared repository path. Existing `ignoredImpact`
and view `ignoredIds` retain manual
Review-ignore evidence for screens; component variant views retain their own
manual ids. Component suppression is described through `affectedConsumers`,
not by pretending instance keys are legacy ignore ids.

## Inline Style Evidence

The [inline evidence contract](./mokly-inline-style-evidence.md) owns the typed
`inlineStyles` payload, emission conditions and paired-view validation. Complete,
live, selected and published v7 results retain it. Catalogue v6 carries it in
view `resourceEvidence`, including through the Serve/export screen-evidence
projection. It has no synthetic stylesheet path. Supplemental inline reason
rules are in [review evidence](./mokly-component-review-evidence.md).

## Validation And Publication

The [validation contract](./mokly-component-review-validation.md) owns source
coverage, affected-consumer proof, canonical ordering, snapshot confinement,
and strict reader admission. Its rules apply to both background classification
and captured comparisons. The [fast-path contract](./mokly-component-review-fast-path.md)
requires the complete and unchanged-view decisions to produce equivalent records.
Every catalogue writes version 7; older public comparisons must be regenerated.
