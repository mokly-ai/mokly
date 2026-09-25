# Changes Comparison Engine

Continuation of [Changes and screen comparisons](./mokly-changes.md).

## Design references

The synthetic design catalogue owns distinct mobile and desktop examples at
`design/review/controls/current.html` and `design/review/controls/overlay.html`.
Existing outcome and impact examples now depict the same catalogue shell.
Their stable authoring ids and routes are retained to preserve links.

See [the shell design](./mokly-shell-design.md) and
[runtime behavior](./mokly-runtime.md) for the surrounding contracts.

## Comparison engine

Live background classification, complete comparison generation, and publishing
with `--include-changes` compare the workspace with a configured base ref, defaulting
to `origin/main`. It resolves the merge base shared by `HEAD` and that ref, then
reads the `mockupsDir` tree at that branch point without checking it out. In
committed mode those are Git blobs; in
[derived mode](./mokly-derived-baselines.md) they come from the cached
rebuild of that commit produced with the commit's own code. The baseline is
never rendered with the current tree's code. Commits reachable only from the
configured base do not enter the comparison. Head generated artifacts come from
the validated compilation. Committed mode additionally checks their working-tree
bytes; derived mode retains compiled bytes through selected comparisons and
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

Screens pair by stable manifest route. Views pair by route, viewport, and color
scheme, enumerated from the union of base and head manifest entries. Each side's
view set is `["light", ...(screen.darkFragments ? ["dark"] : [])]`: a dark
view present only in head is `added`, and one present only in base is
`removed`. Mobile and desktop still classify separately from their fragments.
Added, removed, changed, and unchanged states handle historical versions 2/3/4 and current version 5
manifests during staged migrations; pre-dark bases simply have no
`darkFragments`. Configured shared-impact globs and manifest dependencies
identify changes that can affect many screens. A dependency is a repository file
or directory root: its own change or any descendant change affects the entry,
and Review records the matching changed path as evidence. The configured comparison
directory, including its symlink-resolved in-repository target, is excluded before changed-path and shared-impact evidence
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
evidence. Selected live responses contain only the requested screen or saved variant
and retain its snapshots in memory.

Base and head panes live under separate route-preserving snapshot roots. Local
resources referenced by pane HTML or CSS are copied transitively, including
binary fonts and images, while explicit HTTP(S)/data resources remain external.
HTTP(S) and data resource URLs are external. CSS protocol-relative `//` URLs
are likewise external, remain unchanged and are never fetched or inventoried.
HTML protocol-relative and root-absolute URLs and other scheme-qualified
resources are not portable in an isolated snapshot and fail comparison.
Current-worktree resources must resolve to regular public files. Every base
resource, including the pane document itself and each transitive dependency,
must be a regular Git file. Neither side may read from protected authoring inputs. Pane documents remain byte-unmodified and run in
script-disabled sandboxes.

`review.json` is the normative machine-readable result:

```ts
interface ReviewResult {
  schemaVersion: 2;
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
    route: string;
    title: string;
    state: "added" | "removed" | "changed" | "ignored-only" | "unchanged";
    dependencies: readonly string[];
    sharedImpact: readonly string[];
    views: readonly {
      viewport: "mobile" | "desktop";
      colorScheme: "light" | "dark";
      state: "added" | "removed" | "changed" | "ignored-only" | "unchanged";
      beforePath?: string;
      afterPath?: string;
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

Optional view `material`, `reasons`, and `excludedResources` implement
[CSS change attribution](./mokly-css-attribution.md). `material` is present
exactly when the view's normalized documents differ. Empty optional lists are
omitted; historical results without them remain valid. Retained resource reasons
make paired views changed. Entry `sharedImpact` includes a stylesheet only if
some view kept it, and summary counts follow these states.

Routes sort in deterministic catalogue order; views sort by viewport
(`mobile`, then `desktop`) and then color scheme (`light`, then `dark`).
Changed and impact paths sort lexically. No timestamp or absolute checkout path
enters the JSON. Before/after HTML remains unmodified in the artifact even when
ignore normalization changes classification.

## Review Ignore

`ReviewIgnore` marks repeated shell chrome with paired inert boundaries and no
layout wrapper. A stable kebab-case id is unique per generated document. Review
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
