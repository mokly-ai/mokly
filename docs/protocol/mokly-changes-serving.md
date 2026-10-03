# Changes Serving And Comparison

Continuation of [Changes And Screen Comparisons](./mokly-changes.md).

## Generation and serving

The existing Git branch-point comparison engine, ownership checks, dependency
copying, ignored-region rules, and light/dark classifications remain in force.
The existing `review` configuration and authoring helpers are retained; the
configuration selects the Git base, internal snapshot directory, and shared
impact patterns. `serve --base` and `export --base` override the configured base.

The [consumer static export](./mokly-export.md) reuses this engine
and schema. Its [static delivery contract](./mokly-export-delivery.md)
defines direct generation URLs without requiring a hosting-provider redirect;
the server and repository adapter retain their stable redirect for compatibility.

The development shell requests `/__mokly/diffs/review.json` for the selected
entry on demand, following the
[selected comparison contract](./mokly-selected-comparisons.md). The response
redirects to an immutable generation; snapshot URLs resolve relative to that
response URL. No standalone HTML report or navigation payload is generated.
Only comparison JSON and snapshot files are served through this private route.
Before changing an open comparison's view or diff mode, the browser renews its
generation with HEAD. A missing or replaced generation is reacquired for the
same selection before new panes load; retained results reuse their loaded JSON.
Development responses disable caching. Refresh requests and watched invalidation reuse
the generation queue, retaining superseded snapshots briefly for in-flight
requests and draining active work before shutdown.

Published catalogues retain the same All / Changes navigation and screen controls.
Publishing generates one validated Git comparison in a private staging directory,
then packages its JSON and complete before/after snapshot trees under the resolved
generation path. Static shell metadata addresses that generation directly; the
repository adapter also retains the stable JSON redirect. The same client
resolves relative snapshot and resource URLs without a live server.
Snapshot HTTP responses disable caching and MIME sniffing. Diagnostic summaries
and internal ownership markers are not published.

No comparison data or snapshot document is requested until a user selects a diff
or opens a removed entry. Refresh and retry fetch the currently published
comparison; only publishing a new
artifact updates the underlying snapshots. Removed screens retain their Changes
rows and previous-version pages. Comparison failure aborts publishing
transactionally and preserves the previous artifact, except that recognized
earlier baseline output completes with Changes unavailable under the
compatibility contract. Publishing never
writes to a running development server's configured comparison directory.

## Design references

`design-changes-*` and the stacked [component designs](./mokly-component-design.md)
depict this behavior. The [pane](./mokly-comparison-panes.md#design-references)
and [shell](./mokly-shell-design.md) contracts own each state.

## Comparison engine

Live background classification, complete comparison generation, and publishing
with `--include-changes` compare the workspace with a configured base ref, defaulting
to `origin/main`. It resolves the merge base shared by `HEAD` and that ref, then
reads the `mockupsDir` tree at that branch point without checking it out. [Per-commit selection](./mokly-derived-baselines.md) uses verified v8 Git blobs
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

Before pairing, discard a baseline entry whose id belongs to a current entry of
another kind; the current entry is then added, and no removed record with that
id is emitted. Remaining entries pair by kind and id. Views pair by id,
viewport, and color scheme from the union of baseline and current v8 entries.
Each side's view set is its
entry's effective `colorSchemes`: a dark view present only in head is `added`,
and one present only in base is `removed`. Mobile and desktop still classify
separately from their own documents. The compatibility gate runs before
pairing, so both sides use manifest v8. Configured
shared-impact globs and manifest dependencies
identify changes that can affect many screens. A dependency is a repository file
or directory root: its own change or any descendant change is recorded as
evidence; Changes membership follows the rule linked above.
The configured comparison directory, including its symlink-resolved in-repository target, is excluded before changed-path and shared-impact evidence
is calculated.

Complete comparison output contains `review.json`, `summary.md`, an ownership marker,
and the isolated snapshots. No HTML report or navigation payload is written.
The summary's `output changes` count includes only screens classified as added,
removed, or changed, counting each screen once across all viewports and color
schemes. Changed views include retained rendering-resource evidence as well as
material document changes. Ignored-only screens remain a separate diagnostic count.
`impact evidence` independently counts screens with shared-impact or dependency
evidence, including screens with output changes; `impact-only` is the subset
without output changes and can overlap ignored-only. Neither evidence nor
ignored-only edits inflate output changes. These counts aggregate fragment
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
  schemaVersion: 4;
  baseRef: string;
  baseCommit: string; // merge base shared by HEAD and baseRef
  changedPaths: readonly string[];
  sharedImpact: readonly string[];
  ignoredImpact: readonly {
    id: string;
    viewport: "mobile" | "desktop";
    colorScheme: "light" | "dark";
    count: number;
  }[];
  screens: readonly {
    id: string;
    title: string;
    state: "added" | "removed" | "changed" | "ignored-only" | "unchanged";
    dependencies: readonly string[];
    sharedImpact: readonly string[];
    views: readonly {
      viewport: "mobile" | "desktop";
      colorScheme: "light" | "dark";
      state: "added" | "removed" | "changed" | "ignored-only" | "unchanged";
      ignoredIds: readonly string[];
      material?: true;
      reasons?: readonly {
        kind: "dependency";
        path: string;
        analysis?: {
          status: "matched" | "unresolved";
          selectors: readonly string[];
        };
      }[];
      excludedResources?: readonly {
        path: string;
        reason: "no-matching-rule";
      }[];
    }[];
  }[];
}
```

Version 4 addresses screens, components, variants, and views by entry id and
view axes and stores no route or artifact path. Snapshot paths come from
`snapshotViewPath`; a side the
view's state lacks (`added` has no `before`, `removed` has no `after`) has no
document. Component catalogues add component, variant, use-case, and
affected-consumer records addressed by entry id, defined by the
[component comparison schema](./mokly-component-review.md). Readers accept
only version 4.

Every catalogue emits the complete `ReviewResultV4` shape defined by the
[component comparison schema](./mokly-component-review.md), which extends the
screen fields above with `components`, `changes`, and `affectedConsumers`; a
catalogue without registered components emits those arrays empty rather than
a second screen-only shape.

Optional view `material`, `reasons`, and `excludedResources` implement
[CSS change attribution](./mokly-css-attribution.md). `material` is present
exactly when the view's normalized documents differ. Empty optional lists are
omitted; results without them mean the analysis did not run. Retained resource
reasons make paired views changed, and summary counts follow these states.

The [review validation contract](./mokly-component-review-validation.md)
exclusively owns every `review.json` array order. No timestamp or absolute
checkout path enters the JSON. Snapshot HTML retains its accepted bytes even
when ignore normalization changes classification.

## Review Ignore

`ReviewIgnore` marks repeated shell chrome with paired inert boundaries and no
layout wrapper. Its stable id uses plain lowercase kebab-case and may equal a
Windows device name; only entry ids apply the filename restriction. The id is
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
