# Component Comparison Schema

## Delivery Status

The producer, source validator, artifact publisher, exporter, and browser decoder
implement this component-aware Review schema v4 for [change attribution](./mokly-component-changes.md).
`ReviewResult`, `ScreenReview`, `ViewReview`, and `ReviewState` refer to the
base [Changes contract](./mokly-changes.md) and
[named result interfaces](../../packages/viewer/src/review/types.ts). Manifest/usage types come
from the [component manifest](./mokly-component-manifest.md). Version 4,
defined by the [id-derived routes plan](../../plans/id-derived-routes.md),
addresses screens, components, variants, and views by entry id and view axes
and stores no artifact path.

## Normative Result

```ts
interface ReviewEntryAddress {
  id: string;
  title: string;
}

interface ReviewEntrySides {
  before?: ReviewEntryAddress;
  after?: ReviewEntryAddress;
}

interface ScreenReviewV4 extends ScreenReview, ReviewEntrySides {}

type ReviewVariantAddress = Pick<
  ManifestComponentVariant,
  "id" | "title" | "description" | "props" | "suppliedSlots"
>;

interface ComponentVariantReview {
  id: string;
  title: string;
  before?: ReviewVariantAddress;
  after?: ReviewVariantAddress;
  state: ReviewState;
  views: readonly ViewReview[];
}

interface ComponentReview
  extends Omit<ScreenReview, "views">, ReviewEntrySides {
  variants: readonly ComponentVariantReview[];
}

type EntryChangeReason =
  | {
      kind:
        "added" | "removed" | "metadata" | "material" | "inputs" | "structure";
    }
  | {
      kind: "dependency";
      path: string;
      analysis?: {
        status: "matched" | "unresolved";
        selectors: readonly string[];
      };
    }
  | { kind: "screen"; id: string };

interface ChangedEntry extends ReviewEntrySides {
  kind: "screen" | "component" | "use-case";
  reasons: readonly EntryChangeReason[];
}

type ComponentUsageContext =
  | {
      kind: "screen";
      entry: ReviewEntryAddress;
      viewport: Viewport;
      colorScheme: ColorScheme;
    }
  | {
      kind: "component";
      entry: ReviewEntryAddress;
      variantId: string;
      viewport: Viewport;
      colorScheme: ColorScheme;
    };

interface AffectedUsageEvidence {
  side: "before" | "after";
  context: ComponentUsageContext;
  via: readonly {
    componentId: string;
    instanceKey: string;
  }[];
}

interface AffectedConsumer {
  changedComponentId: string;
  consumer: { kind: "screen"; id: string } | { kind: "component"; id: string };
  evidence: readonly AffectedUsageEvidence[];
}

interface ReviewResultV4 extends Omit<
  ReviewResult,
  "schemaVersion" | "screens"
> {
  schemaVersion: 4;
  screens: readonly ScreenReviewV4[];
  components: readonly ComponentReview[];
  changes: readonly ChangedEntry[];
  affectedConsumers: readonly AffectedConsumer[];
}
```

Every side-bearing record has at least one side, copied from the corresponding
validated branch-point/current manifest. Top-level id/title conveniences match
`after ?? before`. Screens, components, and variants of both kinds pair by
entry id: a `ComponentVariantReview` and a `ReviewVariantAddress` name the
variant entry's global id, and a component usage context's `variantId` is that
same entry id. Title edits remain metadata changes; removed
components/variants retain their former names.

Each screen result contains the union of its available before/after views.
Component variants contain their own view unions. A view is addressed by its
`viewport` and `colorScheme`; the result stores no artifact path. A side's
snapshot file is `snapshots/<side>/<view route>` under the generation
directory, where the view route derives from the entry's kind, id, viewport,
and scheme under the
[derived route rule](./mokly-authoring.md#derived-routes). Added/removed views
have the existing explicit missing-side states, which are the only record of a
missing side. Aggregate states retain the current precedence: changed, added,
removed, ignored-only, unchanged. A metadata/dependency-only entry can have
unchanged rendered view states.

View states describe the complete retained render after the existing manual-ignore
rules, including changed component-owned resources. Component ownership controls
direct Changes reasons separately; it never invents an `ignored-only` state for
a component-only edit. An affected-only screen or parent component can therefore
have changed view results without a Changes row. Caller input changes can have
unchanged view results when the current renderer does not display that prop.

All registered components appear in `components`, even if unchanged or unused.
All current/base screens appear in `screens`, including affected-only screens.
Neither array is the Changes filter. `changes` is its sole membership source;
its length is the Changes count, with no duplicate entry records. A changed
component variant is its own `ChangedEntry` of kind `component`, addressed by
the variant entry id, exactly as a screen variant is its own screen row.
Usages and ancestor folders do not add rows/counts.

## Reasons And Secondary Evidence

Changed entries have nonempty, duplicate-free reasons. Added/removed reasons
require the corresponding missing side; metadata compares the explicit entry
projection, including a parent's schema/controls and a variant entry's props
and supplied slots. Material means a
normalized content change; inputs means caller-owned data changed; structure
means caller-owned logical occurrence identity/order changed. Record every
applicable reason, without deriving membership from raw fragment paths alone.

A dependency reason names a `changedPaths` path. Independent reasons follow
[component change attribution](./mokly-component-changes.md#dependencies-and-styles):
component ownership, an exact screen declaration, or an exact declaration for
an unowned path. Retained referenced resources may also supply reasons. A
stylesheet reason may carry the
[CSS change attribution](./mokly-css-attribution.md) `analysis` record;
its `selectors` are sorted and duplicate-free, `analysis` appears only on
stylesheet paths in analysis scope, a view carries `material: true` exactly
when its normalized documents differ, and a view's `excludedResources` paths must be in
`changedPaths` and never coincide with that view's dependency reasons. A screen reason is allowed only on a use case and
must reference a directly changed screen actually used on at least one side.
Use cases also retain their own metadata/dependency reasons. One screen with
only affected component evidence cannot produce a use-case screen reason.
An affected-only consumer has no ChangedEntry unless it has another direct
reason. Its full comparison remains available through the other result arrays.

A view reported `unchanged` or `ignored-only` through the
[unchanged view decision](./mokly-component-changes.md#unchanged-view-decision)
carries no `material`, `reasons`, or `excludedResources`, retains its
`ignoredIds`, and adds no implementation-impact or owned-resource evidence.
For valid builder output its record equals the complete comparison's record.
The linked contract defines eligibility, ownership projection, malformed
markers, and one-sided range validation.

Views omit empty `reasons` and `excludedResources` lists and sort both by path.
Entry reasons merge retained view evidence by path, with a sorted selector
union and unresolved precedence. Ownership may suppress a view resource reason
from entry membership; one view's exclusion does not cancel another's reason.
Components collect CSS kept at actual invocations when saved variants exclude
it. The [CSS contract](./mokly-css-attribution.md) defines selector requirements;
globs and declarations cannot override an excluded in-scope stylesheet.

Each affected record groups one changed component and one canonical consumer.
Its component id must appear in `changes` with kind component, and evidence
must be nonempty.
Build its evidence from the union of baseline/current actual usage, deduplicating
identical evidence. A consumer may also be directly changed. Self-impact is not
listed. A component is listed as affected only through an actual usage path, not
because it happens to share a directory or dependency declaration.

Every `via` is a nonempty caller-ownership chain from the consumer to the changed
component; its last component id equals `changedComponentId`. Each instance key
must exist in the referenced side/context's manifest usage, with its stated
component id and a valid ownership edge to the next occurrence. Direct screen
use has one element. A component consumer either owns the context entry or is
an earlier instance on that chain within a screen/another component's context.
The evidence's full context remains available to open that actual usage; never
invent a saved variant for a screen-supplied prop combination.

Use input ownership, not physical slot placement, to determine these edges. A
screen-supplied child in a container slot remains a direct screen dependency.
For removed consumers the before-side address and usage supply the link target.
Repeated physical placements do not duplicate logical evidence or screen counts;
the inspector can resolve that logical instance to its current ranges.

Result-level `sharedImpact` remains every changed path matching a configured
`review.sharedImpact` glob. For each v4 screen or component record, entry
`sharedImpact` is the sorted, duplicate-free union of:

1. Every matched changed path that is not a stylesheet, regardless of owner.
2. Every unowned changed path matched by a glob or contained by an explicit
   `declaredDependencies` root on either side, except a stylesheet in public
   analysis scope. Containment includes equality and descendants of the root.
3. Every path in that entry's final `dependency` reasons, including retained
   stylesheet and actual-invocation owner reasons.

This set is identical to the pre-change entry `sharedImpact` for every entry.
An out-of-scope stylesheet matched only by a glob belongs to an unowned path's
evidence; when a component owns it, only a retained owner or exact screen
reason adds it to that entry. In-scope stylesheets enter only through retained
reasons. Entry `sharedImpact` never overrides `changes`. Entry dependencies
remain the sorted union of both sides. `ignoredImpact` and view `ignoredIds`
retain manual Review-ignore evidence; `affectedConsumers` records suppression.

Validation and canonical output follow the [component review validation contract](./mokly-component-review-validation.md).
