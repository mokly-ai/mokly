# Component Comparison Schema

## Delivery Status

The producer, source validator, artifact publisher, exporter, and browser
decoder implement this path-keyed component-aware schema v5 for
[change attribution](./mokly-component-changes.md). `ReviewResult`,
`ScreenReview`, `ViewReview`, and `ReviewState` refer to the base
[Changes contract](./mokly-changes.md) and
[named result interfaces](../../packages/viewer/src/review/types.ts).
Manifest/usage types come from the
[component manifest](./mokly-component-manifest.md). Version 5 addresses
screens, components, variants, and views by entry path and view axes, carries
`previousPath` for paired moves, and stores no artifact path.
Optional `inlineStyles` evidence follows [inline style ownership](./mokly-inline-styles.md).

## Normative Result

```ts
interface ReviewEntryAddress {
  path: string;
  title: string;
}

interface ReviewEntrySides {
  before?: ReviewEntryAddress;
  after?: ReviewEntryAddress;
  previousPath?: string;
}

interface ScreenReviewV5 extends ScreenReview, ReviewEntrySides {}

type ReviewVariantAddress = Pick<
  ManifestComponentVariant,
  "path" | "title" | "description" | "props" | "suppliedSlots"
>;

interface ComponentVariantReview {
  path: string;
  previousPath?: string;
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
  | { kind: "screen"; screenPath: string };

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
      variantPath: string;
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
  consumer:
    { kind: "screen"; path: string } | { kind: "component"; path: string };
  evidence: readonly AffectedUsageEvidence[];
}

interface ReviewResultV5 extends Omit<
  ReviewResult,
  "schemaVersion" | "screens"
> {
  schemaVersion: 5;
  screens: readonly ScreenReviewV5[];
  components: readonly ComponentReview[];
  changes: readonly ChangedEntry[];
  affectedConsumers: readonly AffectedConsumer[];
}
```

Every side-bearing record has at least one side, copied from the corresponding
validated branch-point/current manifest. Top-level path/title conveniences
match `after ?? before`. Screens, components, and variants of both kinds pair
by entry path, then the [move contract](./mokly-moves.md) pairs the remaining
removed and added entries of one kind; `previousPath` is the paired baseline
entry's path, present exactly on such records, which carry both sides. A
`ComponentVariantReview` and a `ReviewVariantAddress` name the variant entry's
path, and a component usage context's `variantPath` is that same path.
`componentId` and `changedComponentId` keep their names and hold the parent
component's path, the only identity a component has. Title edits remain
metadata changes; removed components/variants retain their former names.

Each screen result contains the union of its available before/after views.
Component variants contain their own view unions. A view is addressed by its
`viewport` and `colorScheme`; the result stores no artifact path. A side's
snapshot file is `snapshotViewPath(side, path, viewport, colorScheme)` under
the generation directory, from the
[artifact path contract](./mokly-artifact-paths.md), where the before side of
a paired entry uses its `previousPath`. Added/removed views
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
the variant entry path, exactly as a screen variant is its own screen row.
Usages and ancestor folders do not add rows/counts.

## Reasons And Secondary Evidence

Changed entries have duplicate-free reasons, empty only for a paired pure move. Added/removed reasons
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
exclude it. Globs and declarations cannot override in-scope CSS exclusion.

Each affected record groups one changed component and one canonical consumer.
Its `changedComponentId` must name a component that appears in `changes` with
kind component, and evidence must be nonempty.
Build its evidence from the union of baseline/current actual usage, deduplicating
identical evidence. A consumer may also be directly changed. Self-impact is not
listed. A component is listed as affected only through an actual usage path, not
because it happens to share a directory or dependency declaration.

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

Result-level `sharedImpact` remains every changed path matching a configured
`review.sharedImpact` glob. For each v5 screen or component record, entry
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

## Inline Style Evidence

The [inline evidence contract](./mokly-inline-style-evidence.md) owns its typed
shape, emission conditions and delivery through every v5 result boundary.
