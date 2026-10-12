# Changes Serving And Comparison

Continuation of [Changes And Screen Comparisons](./mokly-changes.md).

## Delivery Status

Removal of baseline compatibility is implemented in
[M23B](../../plans/remove-source-path-evidence.md#milestone-23b-remove-baseline-compatibility).

The expanded v7 per-rule and page evidence is implemented in [M19](../../plans/remove-source-path-evidence.md#milestone-19-classify-css-by-where-its-rules-match) of the
[source-path removal plan](../../plans/remove-source-path-evidence.md); its comparison details for screens and component saved views are implemented in [M20](../../plans/remove-source-path-evidence.md#milestone-20-show-the-outside-component-evidence).

## Generation and serving

The [comparison serving contract](./mokly-comparison-serving.md) owns generation
lifetimes, on-demand requests and published delivery.

## Design references

`design/changes/*` and the stacked [component designs](./mokly-component-design.md)
depict this behavior. The [pane](./mokly-comparison-panes.md#design-references)
and [shell](./mokly-shell-design.md) contracts own each state.

## Comparison engine

Live background classification, complete comparison generation, and publishing
with `--include-changes` compare the workspace with a configured base ref, defaulting
to `origin/main`. It resolves the merge base shared by `HEAD` and that ref, then
reads the `mockupsDir` tree at that branch point without checking it out. [Per-commit selection](./mokly-derived-baselines.md) uses verified v10 Git blobs
or a cached rebuild produced with that commit's own code. The baseline is
never rendered with the current tree's code. Commits reachable only from the
configured base do not enter the comparison. Head generated artifacts come from
the validated in-memory compilation. Every command retains compiled bytes through selected comparisons and
compares all generated views even without changed Git output paths. Selected live
diffs reuse the accepted manifest and pinned classification; checked-input digests
reject changed snapshot inputs without repeating an exhaustive build.
Review inspects only the requested base paths, grouping exact literal pathspecs
into count- and byte-bounded `ls-tree` operations, and reads regular-file blobs
through output-byte- and object-count-bounded `cat-file` batches. A single blob
that cannot fit the output budget fails explicitly after metadata inspection
and before a `cat-file` content process is spawned. The initial view document
set is one logical batch request; transitively referenced assets are grouped by
dependency depth. File modes are still checked before any blob is accepted, so
batching does not weaken symlink or non-regular-file rejection.

Entries pair by kind and case-folded path. The [move contract](./mokly-moves.md) then
pairs the remaining baseline and current entries of one kind and records
`previousPath`; a paired entry's before side is the paired baseline entry. A
baseline entry whose path now belongs to a current entry of another kind is an
ordinary move candidate, but when it pairs with nothing it is discarded rather
than removed: the current entry is added, and no removed record with that path
is emitted. Views pair by viewport and color scheme within each paired entry.
Each side's view set is its entry's effective `colorSchemes`: a dark view
present only in head is `added`, and one present only in base is `removed`.
Mobile and desktop still classify separately from their own documents. The
compatibility gate runs before pairing, so both sides use manifest v10.
Source paths and retired declarations do not add reasons.
The configured comparison directory, including its symlink-resolved in-repository target, is excluded before changed-path evidence
is calculated.

Complete comparison output contains `review.json`, `summary.md`, an ownership marker,
and the isolated snapshots. No HTML report or navigation payload is written.
The summary's `output changes` count includes only screens classified as added,
removed, or changed, counting each screen once across all viewports and color
schemes. Changed views include retained rendering-resource evidence as well as
material document changes. Ignored-only screens remain a separate diagnostic count.
Neither unreferenced source edits nor ignored-only edits inflate output changes.
These counts aggregate fragment
comparisons per screen; the catalogue Changes total also considers reviewable
metadata and flows. Complete JSON retains every screen and its
evidence. Selected live responses contain only the requested entry and retain
its snapshots in memory.

Base and head panes live under separate snapshot roots. Their names come from
`snapshotViewPath` in the
[artifact path contract](./mokly-artifact-paths.md). Local
resources referenced by pane HTML or CSS are copied transitively, including
binary fonts and images, while explicit HTTP(S)/data resources remain external.

## Resource URL Classification

HTTP(S) and data resource URLs are external. CSS protocol-relative `//` URLs
are also external: they stay unchanged and are never fetched or inventoried.
HTML protocol-relative and root-absolute URLs, and other unsupported schemes,
are not portable in an isolated snapshot and fail comparison instead of being
silently omitted. Export and removed previews use the same classification.
Current resources and every base pane or transitive dependency must be regular
public files, never protected authoring inputs. Pane bytes stay unchanged on
disk and in artifacts; the viewer's script-disabled
[presentation](./mokly-comparison-panes.md#presentation) applies only in
memory.

`review.json` is the normative machine-readable result. Its screen records are:

```ts
interface ReviewResult {
  schemaVersion: 7;
  baseRef: string;
  baseCommit: string; // merge base shared by HEAD and baseRef
  changedPaths: readonly string[];
  ignoredImpact: readonly {
    id: string; // Review-ignore region id
    viewport: "mobile" | "desktop";
    colorScheme: "light" | "dark";
    count: number;
  }[];
  screens: readonly {
    path: string;
    previousPath?: string;
    title: string;
    state: "added" | "removed" | "changed" | "ignored-only" | "unchanged";
    views: readonly {
      viewport: "mobile" | "desktop";
      colorScheme: "light" | "dark";
      state: "added" | "removed" | "changed" | "ignored-only" | "unchanged";
      ignoredIds: readonly string[];
      material?: true;
      reasons?: readonly {
        kind: "dependency";
        path: string;
        analysis?: DependencyAnalysis;
      }[];
      excludedResources?: readonly {
        path: string;
        reason: "no-matching-rule";
      }[];
    }[];
  }[];
}
```

Version 6 addresses every entry and view by path and view
axes, with `screenPath` wherever a step names a screen,
optional `previousPath` on an entry the [move contract](./mokly-moves.md)
paired, and documents classified like pages: neither kind has a record here,
and the [catalogue change snapshot](./mokly-catalogue-changes.md) classifies
both. The result stores no route or artifact path. Snapshot paths come from
`snapshotViewPath`, using `previousPath` for the before side of a paired
entry; a side the view's state lacks (`added` has no `before`, `removed` has
no `after`) has no document. Component catalogues add component, variant,
use-case, and affected-consumer records addressed by entry path, defined by
the [component comparison schema](./mokly-component-review.md). Readers accept
only version 7.

Every catalogue emits the complete `ReviewResultV7` shape defined by the
[component comparison schema](./mokly-component-review.md), which extends the
screen fields above with `components`, `changes`, and `affectedConsumers`; a
catalogue without registered components emits empty `components` and
`affectedConsumers` arrays. Its `changes` still records directly changed
screens and use cases; there is no second screen-only shape.

Optional view `material`, `reasons`, and `excludedResources` implement
[CSS change attribution](./mokly-css-attribution.md). `material` is present
exactly when the view's normalized documents differ. Empty optional lists are
omitted. `DependencyAnalysis` uses the [per-rule evidence schema](./mokly-css-attribution-membership.md);
missing view evidence means no retained or excluded resources for that view. Retained resource
reasons make paired views changed, and summary counts follow these states.

The [review validation contract](./mokly-component-review-validation.md)
exclusively owns every `review.json` array order. No timestamp or absolute
checkout path enters the JSON. Snapshot HTML retains its accepted bytes even
when ignore normalization changes classification.

## Review Ignore

`ReviewIgnore` marks repeated shell chrome with paired inert boundaries and no
layout wrapper. Its stable id uses plain lowercase kebab-case and may equal a
Windows device name; only path segments apply that restriction. The id is
unique per generated document. Review
normalizes a region only when both sides contain one valid matching boundary.
One-sided adoption removes marker syntax but compares the real children.

Stateful repeated chrome supplies a deterministic material key derived from the
complete typed props used to render it. The signal remains outside the ignored
region and part of classification. One-sided material-signal adoption compares
real children. Malformed, duplicate, nested, overlapping, mismatched, or invalid
signals fail closed with route context.

Ignoring changes classification only. Stored fragments and compare panes keep
the real content. Ignored-only changes aggregate by id, viewport, and color
scheme instead of adding every consumer screen. Primary screen content must
never be ignored.

## Screen controls

Screen controls follow [the controls contract](./mokly-changes-controls.md).
