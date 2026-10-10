# Component Review Reasons And Evidence

Continuation of [Component Comparison Schema](./mokly-component-review.md).

## Reasons And Secondary Evidence

Changed entries have duplicate-free reasons, empty only for a paired pure move. Added/removed reasons
require the corresponding missing side; metadata compares the explicit entry
projection, including a parent's schema/controls and a variant entry's props
and supplied slots. Material means a
normalized content change; inputs means caller-owned data changed; structure
means caller-owned logical occurrence identity/order changed. Record every
applicable reason, without deriving membership from raw fragment paths alone.

A dependency reason names a rendered-resource path in `changedPaths`.
[Component change attribution](./mokly-component-changes.md#rendered-resources-and-styles)
defines non-CSS record/inline owners and own-page CSS membership. Source paths
and declarations alone add no evidence. A
stylesheet reason may carry the
[CSS change attribution](./mokly-css-attribution.md) `analysis` record;
its `selectors` are sorted and duplicate-free, `analysis` appears only on
stylesheet paths in analysis scope, a view carries `material: true` exactly
when its actual comparison material differs under the
[changes contract's definition](./mokly-changes.md), and a view's
`excludedResources` paths must be in `changedPaths` and never coincide with
that view's dependency reasons. A screen reason names a step's `screenPath`, is allowed only on a use case
and must reference a directly changed screen actually used on at least one
side.
Use cases also retain their own metadata/dependency reasons. One screen with
only affected component evidence cannot produce a use-case screen reason.
An affected-only consumer has no ChangedEntry unless it has another direct
reason. Its full comparison remains available through the other result arrays.

A view reported `unchanged` or `ignored-only` through the
[unchanged view decision](./mokly-component-review-fast-path.md)
carries no `material`, `reasons`, `excludedResources` or `inlineStyles`, retains
`ignoredIds`, and adds no implementation-impact or owned-resource evidence. For
valid builder output its record equals the complete comparison. The linked
fast-path contract owns eligibility, projections and range validation.

Views omit empty `reasons` and `excludedResources` and sort both by path.
Optional `inlineStyles` follows the emission rules below and strict
[view validation](./mokly-component-review-validation.md#inline-style-evidence-validation).
Entry reasons merge retained view evidence by path with selector unions and
unresolved precedence. Ownership may suppress entry membership, not actual
view evidence; one view's exclusion does not cancel another's retained reason.
Components collect resource evidence at actual invocations even when variants
exclude it. Source declarations supply no evidence. CSS exclusion depends on the retained
rule proof.

Each affected record groups one changed component and one canonical consumer.
Its `changedComponentId` must name a component that appears in `changes` with
kind component, and evidence must be nonempty.
Build its evidence from the union of baseline/current actual usage, deduplicating
identical evidence. A consumer may also be directly changed. Self-impact is not
listed. A component is listed as affected only through an actual usage path, not
because it happens to share a directory or source location.

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

`ignoredImpact` and view `ignoredIds` retain manual Review-ignore evidence.
`affectedConsumers` records suppression. Review v7 has no source-path dependency
or shared-impact fields. Retained resource reasons remain the only path evidence.

Validation and canonical output follow the [component review validation contract](./mokly-component-review-validation.md).
