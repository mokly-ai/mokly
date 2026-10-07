# Component Comparison Schema

## Delivery Status

The producer, source validator, artifact publisher, exporter, and browser
decoder implement this path-keyed component-aware schema v6 for
[change attribution](./mokly-component-changes.md). `ReviewResult`,
`ScreenReview`, `ViewReview`, and `ReviewState` refer to the base
[Changes contract](./mokly-changes.md) and
[named result interfaces](../../packages/viewer/src/review/types.ts).
Manifest/usage types come from the
[component manifest](./mokly-component-manifest.md). Version 6 addresses
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

interface ScreenReviewV6 extends ScreenReview, ReviewEntrySides {}

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

interface ReviewResultV6 {
  baseRef: string;
  baseCommit: string;
  changedPaths: readonly string[];
  sharedImpact: readonly string[];
  ignoredImpact: readonly {
    id: string;
    viewport: Viewport;
    colorScheme: ColorScheme;
    count: number;
  }[];
  schemaVersion: 6;
  screens: readonly ScreenReviewV6[];
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

See [Component review reasons and evidence](./mokly-component-review-evidence.md) for the complete rules.

## Inline Style Evidence

The [inline evidence contract](./mokly-inline-style-evidence.md) owns its typed
shape, emission conditions and delivery through every v6 result boundary.
