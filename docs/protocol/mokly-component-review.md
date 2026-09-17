# Component Comparison Schema

## Delivery Status

The producer, source validator, artifact publisher, exporter, and browser decoder
implement this component-aware Review schema v3 for [change attribution](./mokly-component-changes.md).
`ReviewResult`, `ScreenReview`, `ViewReview`, and `ReviewState` refer to the
existing [schema-v2 contract](./mokly-changes.md) and
[named result interfaces](../../packages/viewer/src/review/types.ts). Manifest/usage types come
from the [component manifest](./mokly-component-manifest.md).

## Normative Result

```ts
interface ReviewEntryAddress {
  id: string;
  route: string;
  title: string;
}

interface ReviewEntrySides {
  before?: ReviewEntryAddress;
  after?: ReviewEntryAddress;
}

interface ScreenReviewV3 extends ScreenReview, ReviewEntrySides {}

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
  | { kind: "screen"; route: string };

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
  consumer:
    { kind: "screen"; route: string } | { kind: "component"; id: string };
  evidence: readonly AffectedUsageEvidence[];
}

interface ReviewResultV3 extends Omit<
  ReviewResult,
  "schemaVersion" | "screens"
> {
  schemaVersion: 3;
  screens: readonly ScreenReviewV3[];
  components: readonly ComponentReview[];
  changes: readonly ChangedEntry[];
  affectedConsumers: readonly AffectedConsumer[];
}
```

Every side-bearing record has at least one side, copied from the corresponding
validated branch-point/current manifest. Top-level id/route/title conveniences
match `after ?? before`. Screen pairing retains the current route key; component
pairing uses id, and variant pairing uses component id plus variant id. Screen
id changes at the same route remain metadata changes. Component route changes
retain both addresses; removed components/variants retain their former names.

Each screen result contains the union of its available before/after views.
Component variants contain their own view unions. `ViewReview.beforePath` and
`afterPath` are present exactly when that view exists on that side. Added/removed
views have the existing explicit missing-side states. Aggregate states retain
the current precedence: changed, added, removed, ignored-only, unchanged. A
metadata/dependency-only entry can have unchanged rendered view states.

View states describe the complete retained render after the existing manual-ignore
rules, including changed component-owned resources. Component ownership controls
direct Changes reasons separately; it never invents an `ignored-only` state for
a component-only edit. An affected-only screen or parent component can therefore
have changed view results without a Changes row. Caller input changes can have
unchanged view results when the current renderer does not display that prop.

All registered components appear in `components`, even if unchanged or unused.
All current/base screens appear in `screens`, including affected-only screens.
Neither array is the Changes filter. `changes` is its sole membership source;
its length is the Changes count, with no duplicate routed entry records.
Component variants, usages, or collection ancestors do not add rows/counts.

## Reasons And Secondary Evidence

Changed entries have nonempty, duplicate-free reasons. Added/removed reasons
require the corresponding missing side; metadata compares the explicit entry
projection, including component schema/controls/variants. Material means a
normalized content change; inputs means caller-owned data changed; structure
means caller-owned logical occurrence identity/order changed. Record every
applicable reason, without deriving membership from raw fragment paths alone.

A dependency reason's path must be in `changedPaths` and be independent evidence
under the ownership rules. A stylesheet dependency reason may carry the
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

Views carry optional dependency-only `reasons` alongside optional
`excludedResources` in both schemas. Omit either list when empty and sort it
uniquely by path. `matched` analysis requires selectors; `unresolved` permits an
empty selector list. Entry reasons merge retained view evidence by path with a
sorted selector union and unresolved precedence. Entry ownership can suppress
a view resource reason from direct membership; one view excluding a path does
not conflict with another keeping it. A component's reasons also aggregate owned
CSS retained at actual invocations, even if its saved variants all exclude that
path. Their unchanged view states remain accurate. Public stylesheet globs alone
add no reason, and an exact screen declaration cannot override rule exclusion.

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

`sharedImpact` on the result and entries retains the existing path-evidence
meaning; it does not override `changes`. Entry dependencies are the sorted union
of both sides. Existing `ignoredImpact` and view `ignoredIds` retain manual
Review-ignore evidence for screens; component variant views retain their own
manual ids. Component suppression is described through `affectedConsumers`,
not by pretending instance keys are legacy ignore ids.

## Validation And Canonical Output

Use one result schema and reason policy in Browse's lightweight classification,
comparison generation, publishing, and client decoding. Validate against both
source manifests while generating/publishing so evidence cannot name an unknown
entry, view, instance, or dependency. Require every component/screen ChangedEntry
to match its result record's side addresses. Use-case addresses and screen
reasons must match the source manifests' use-case steps. Unknown fields in new
structures, inconsistent sides, duplicate records/reasons, missing view evidence,
and invalid values fail rather than being silently dropped.

Source validation also receives the implementation-impact set computed from
the classifier's paired material, unchanged inputs and dependency policy. It
requires exact equality with the complete affected-consumer evidence derived
from that set and both manifests. Neither a subset nor the set of every changed
component is sufficient: saved-variant/control metadata edits can be direct
changes without implementation impact. Every classification path performs this
validation before returning results, including lightweight Browse updates.

The [selected live endpoint](./mokly-selected-comparisons.md) projects a validated
complete result onto one screen or saved variant. Its response uses this schema's
record and reference validation, while catalogue-wide source coverage and affected
evidence remain owned by the original background classification and shell inspector.

Entry ids and routes use normal catalogue validation. Snapshot paths are exact
artifact-root-relative paths under `snapshots/before/` or `snapshots/after/`,
as appropriate, retaining the selected fragment's relative path. Reject absolute
paths, traversal, encoded separators, source-root access, and non-regular files
using existing snapshot/resource validation. Props in variant addresses use
the corresponding side's schema and canonical wire codec. Instance keys are
opaque validated identifiers and never become filesystem paths or selectors.

Serving filesystem-backed retained snapshots repeats regular-file and confinement checks at
request time. Symlinks at the retained root, any descendant directory, or the
file itself return 404, including artifacts modified after generation.
Diagnostic Markdown renders authored titles as escaped single-line text and
uses safe code-span delimiters for refs and paths; JSON retains original values.
Selected live generations instead serve an immutable captured byte map; they do
not reopen filesystem paths when delivering a retained snapshot.

Lexical ordering uses UTF-16 code units, not a locale-sensitive collator.
Sort screens by route and components by id. Variants follow current authored
order, followed by removed variants in baseline order. Views retain
mobile/light, mobile/dark, desktop/light, desktop/dark order. Sort changes by
preferred side's route, then kind and id. Reasons sort by kind then path/route.
Affected records sort by changed component id, consumer kind, then route/id.
Evidence sorts by side (before then after), context route, variant id when
present, viewport/scheme order, and canonical JSON of the `via` list. The list's
own order is its dependency-chain order. Sort path/id sets uniquely and retain
the existing viewport/scheme/id ordering for `ignoredImpact`.

New object keys sort lexically; optional fields are omitted and required empty
arrays remain explicit. Emit two-space JSON and a final LF, with no timestamp,
absolute checkout path, or transient controls result. Serve no-store/nosniff
headers and retain immutable snapshot generations and unmodified documents.

Emit schema v3 when either source manifest has component metadata; otherwise
retain schema-v2 output. Readers keep the existing v2 contract without inventing
component usage or suppression. Unknown versions fail. Shared fixture tests must
cover valid/invalid schemas, deterministic round trips, current and removed
variants/consumers, metadata-only changes, zero Changes with affected screens,
and identical served/published membership. These are Milestone 3 requirements.
