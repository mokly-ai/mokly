# Changes and screen comparisons

The implemented [component attribution extension](./mokly-component-changes.md)
keeps component-only consumers out of Changes while linking them from the
component's Affected screens list. Screen and manual Review-ignore behavior
remains documented below.

The catalogue is Mokly's only browsing surface. Its All / Changes filter
narrows the same navigation tree. There is no Review tab, launcher, report
section, or `mokly review` command; `--out` belongs only to static `export`.

[Pages](./mokly-pages.md) participate in Changes and removed-entry states,
while comparison controls remain exclusive to changed screens and eligible
component variants. The
[shared catalogue snapshot](./mokly-catalogue-changes.md) supplies metadata
independently of screen results; removed pages are flat Changes-only rows with
baseline ancestry. Review reads follow the [source policy](./mokly-source-protection.md).

[Published Changes](./mokly-publication.md) are opt-in through
`npm run preview:build -- --include-changes`. Default publication omits Changes,
comparisons, history, and removals; both options omit live updates.

## Changes membership

Changes is a review list of added/removed screens and pages, material document changes,
reviewable route metadata changes, and user flows that embed those screens.
A new or edited flow is included independently. Source edits, source moves,
dependency declaration edits, and shared-impact matches alone do not add
otherwise unchanged entries. Dependency and shared-impact evidence remains in
comparison details, accessible for every screen from All.

Before marking an existing fragment, compare its branch-point and working-tree
documents with the same paired ignore normalization and material-key rules as
the comparison engine. Ignored-only changes are excluded from Changes; real
content changes, material-key changes, and one-sided ignored-region adoption
with changed content remain eligible. Both viewports and every available color
scheme participate. Metadata includes route/address, titles, descriptions,
rationale, tags, related-doc links, flow steps and memberships, view structure,
and collection ancestry; it excludes source locations and dependencies.
Valid generated ownership headers are excluded from document comparison, so a
source move alone stays unchanged. Stored snapshots retain the original headers.

Changes to local resources referenced by a fragment also keep that screen in
Changes. Follow CSS imports, CSS URLs, and embedded-document resources
transitively using the snapshot resource resolver and public-file confinement.
Only references outside paired ignored regions participate; speculative
preload/prefetch hints alone do not establish rendered impact. A linked resource
edit is conservative evidence of a rendering change, not a pixel measurement.
Unreferenced public files never add entries through a broad shared-impact glob.
Every reachable existing resource is validated, including images and fonts;
finding a changed resource does not skip its CSS/HTML references or later graph
edges. Added screens, newly available views, and existing material fragment
changes do not bypass resource validation. Whole-document pages use these same
rules for their single generated document and its rendered resources; they do
not gain screen comparison controls or viewport variants.
For public file and directory aliases, compare changed Git paths against both
the referenced route and its validated physical path relative to the real
`mockupsDir`. Editing a target marks its consumers even when the alias itself
is unchanged. Obtain both identities from the same confined reader used by
resource watching; source, internal-metadata, and escape checks still apply.
Historical snapshot reads continue to require regular Git files and reject
symlink blobs; detecting current impact does not relax baseline validation.
A deleted resource still marks its consumers only when its closest existing
ancestor is a confined public directory and its baseline is a regular Git file.
Live classification walks a changed or moved document's branch-point resource
graph whenever the document changed or one of its current stylesheets changed,
regardless of whether any stylesheet is in the diff, so verified deletions of
non-stylesheet resources keep marking their consumers. Only an unchanged,
unmoved view with no changed stylesheet skips that walk, and the complete
comparison produces the same retained evidence for every view.
Dangling symlinks, escaping symlinks, source-root references, and newly missing
resources fail validation rather than being treated as deletions. Snapshot
generation still requires current references to resolve, including resources
whose verified deletion made their consumers eligible for Changes.

Linked stylesheet edits are narrowed by
[CSS change attribution](./mokly-css-attribution.md): a changed stylesheet
keeps a view in Changes only when a changed
rule could match that view's document or the analysis cannot resolve the rule.
Stylesheets whose changed rules match nothing on a view are recorded as examined
and excluded rather than as dependency evidence. Fonts, images, and embedded
documents keep file-level attribution.
This same analysis runs in live classification, watched updates, complete and
selected comparisons, and publication. A newline-only edit has no changed rules
and leaves consumers out of Changes; every viewport and scheme retains its own
kept or excluded resource evidence.

The shell receives this per-view resource evidence for screen-only catalogues
as well as component catalogues, including in Current before snapshots exist.
Live v2 classification retains its existing analysis as `screenEvidence`; the
workspace selects its `resourceEvidence` slice without a second analysis pass.
Static exports select that slice from their existing v2 comparison. Both result
schema versions remain unchanged. Details merge the loaded comparison's evidence
with classification evidence, preserving retained stylesheet selectors,
exclusions, and legacy shared-impact/ignored-content details without duplicate
cards. See [CSS evidence in the shell](./mokly-css-evidence-shell.md#shell-derivation).

This detection reads baseline files without writing snapshots or generating a
comparison; derived mode obtains them from the completed cache entry. Baseline reads are batched; shared resource edges
are cached within one calculation and cycles terminate. Apart from verified
resource deletions, an unavailable or invalid input leaves Changes explicitly
unavailable, preserving the tabs and access through All in live Serve.
Watched updates and static publishing use this same membership calculation.

Serve performs the calculation in a background worker after HTTP is ready and
complete generated output has been adopted, never during a shell request.
The watched parent publishes the result. Until the immutable route, baseline, and
component-evidence snapshot arrives, Browse keeps both tabs without inventing a
Changes count. A spinner occupies the reserved count slot, and selecting Changes
shows a loading sidebar. Derived mode publishes a distinct `preparing` state
before `pending` while its baseline rebuild runs; see the
[derived baselines contract](./mokly-derived-baselines.md). Content updates clear the previous snapshot and publish
pending status before notifying the browser, then publish a terminal ready or
unavailable status only when the latest sequence finishes. Empty ready results
show zero; unavailable results show a dash and a plain unavailable message.
Tabs, count allocation and the tree origin remain fixed throughout;
late results from superseded generations are ignored. Non-watched Serve uses the
same asynchronous startup boundary, without observing later edits. Watched Git-only
ref changes reclassify completed output without rendering views again.

Component-aware classification preloads every baseline screen and saved-variant
view in one logical, bounded Git batch, including mobile, desktop, dark and
removed views. This applies to asynchronous watched startup, immutable Browse
evidence, watched updates and publishing, including a screen-only baseline
during component adoption. Readers without bulk support retain individual
cached reads. Resource discovery stays lazy and follows the comparison's ignore
and ownership rules; prefetching view documents does not traverse excluded or
hint-only resources. An incomplete or invalid batch fails classification rather than silently
dropping views or disabling Git file validation.

## Screen controls

Review-enabled changed screens and saved component variants with actual Changed
or Removed comparison views offer Current / Side by side / Overlay / Difference in an opaque band
beneath the heading. Known unchanged views show Unmodified without that band;
known added views show Added with their current preview and no comparison band;
known removed screens show Removed with a current empty state and no comparison band
(the approved [removed previews](./mokly-removed-previews.md) replace that empty
state with the baseline views); unknown evidence has no invented status. Eligibility follows saved view evidence,
so affected-only consumers can compare their actual rendered differences while
staying outside Changes. Current is selected initially, including
after navigation and reload. Selecting Changes, opening a current screen, changing
its viewport or color scheme in Current, and receiving a watched update do not
generate comparison snapshots in development; opening a removed entry is the one
selection that requests its historical preview. Publications with Changes prepare snapshots at build time, but never fetch or render them while browsing in Current. The first
explicit diff selection requests the comparison in either delivery mode.
Returning to Current cancels pending UI work and restores the current screen.
Navigation must never let a late comparison response replace another screen.
Shell-owned links carry comparison intent only when the destination saved view
is eligible. The destination revalidates that eligibility before honoring a
comparison query, so stale, manually edited, or historical URLs cannot bypass a
current-only state or trigger a hidden comparison request.

Diffs render inside the existing main region with the catalogue, title, details,
viewport, and scheme controls retained. Both viewports are supported. Snapshot
frames remain sandboxed without scripts or catalogue navigation privileges.
Overlay places the current snapshot at 50% opacity above its baseline;
Difference uses CSS difference blending. These are document comparisons, not
pixel measurements. They must never display invented pixel counts or percentages.
Missing current views for removed component variants remain explicit and legible in every mode.
Comparison frames retain matching dimensions; individual browser expansion is
available only in Current so it cannot misalign an overlay.

Loading, unavailable, and failed comparison states use plain product copy.
Failure offers a retry. All and Changes share the same comparison eligibility.
Removed screens remain discoverable in Changes without offering a comparison;
they show an explicit current empty state today and their previous version once
[removed previews](./mokly-removed-previews.md) ship. Dependency and ignored-region
evidence stays secondary to the screen preview. Evidence availability is
independent of comparison-mode eligibility and the inspector's initial
disclosure; Added and Removed screens can retain factual Details without gaining
comparison controls.

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

The development shell requests `/__mokly/diffs/review.json` with the selected
`route` and optional saved `variant` on demand, following the
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
rows, screen pages, and id redirects; a current entry takes precedence when an id
has been reused. Comparison failure aborts publishing transactionally, preserving
the previous artifact. Publishing never writes to a running development server's
configured comparison directory.

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
Root-absolute, protocol-relative, and other scheme-qualified resource URLs are
not portable in an isolated snapshot and fail comparison instead of being
silently omitted.
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
