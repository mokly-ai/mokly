# Component Comparison Records

## Delivery Status

The expanded `DependencyAnalysis` from the [CSS evidence schema](./mokly-css-attribution-membership.md)
is implemented in [M19](../../plans/remove-source-path-evidence.md#milestone-19-classify-css-by-where-its-rules-match) of the [source-path removal plan](../../plans/remove-source-path-evidence.md), within v5.

Implemented for the unified comparison v5 format. The [comparison contract](./mokly-component-review.md) owns attribution, and [validation](./mokly-component-review-validation.md) owns source coverage.

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
      analysis?: DependencyAnalysis;
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

interface ReviewResultV5 {
  baseCommit: string;
  baseRef: string;
  changedPaths: readonly string[];
  ignoredImpact: readonly {
    viewport: Viewport;
    colorScheme: ColorScheme;
    id: string;
    count: number;
  }[];
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

For page material, both comparison paths omit Mokly-inserted links for child-declared CSS, but retain a saved page's root-owned links and all renderer-authored links. Resource and CSS evidence still use the final linked document under [component attribution](./mokly-component-changes.md).
