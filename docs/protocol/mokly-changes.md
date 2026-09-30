# Changes and screen comparisons

The implemented [component attribution extension](./mokly-component-changes.md)
keeps affected-only consumers out of Changes and links them from the component.
Screen and Review-ignore behavior remains below.

The catalogue's All / Changes filter narrows one navigation tree. There is no
Review tab, report, or `mokly review`; `--out` belongs only to static `export`.

[Pages](./mokly-pages.md) participate in Changes and removed-entry states,
while comparison controls remain exclusive to changed screens and eligible
component variants. Each [variant](./mokly-variants.md) is an entry of its
parent's kind with its own route, row, count, views, and comparison; only its
navigation placement under the parent is variant-specific. The
[shared catalogue snapshot](./mokly-catalogue-changes.md) supplies metadata
independently of screen results; removed pages are flat Changes-only rows with
baseline ancestry. Review reads follow the [source policy](./mokly-source-protection.md).

Opt into [Published Changes](./mokly-publication.md) with
`npm run preview:build -- --include-changes`; default publication omits Changes,
comparisons, history, and removals. Both options omit live updates. Strict
baseline admission and pairing/order fixes run in Serve, export, and publish.

## Changes membership

Changes is a review list of added/removed screens and pages, material document changes,
reviewable entry metadata changes, and user flows that embed those screens.
A new or edited flow is included independently. Source edits, source moves,
dependency declaration edits, and shared-impact matches alone do not add
otherwise unchanged entries. Dependency and shared-impact evidence remains in
comparison details, accessible for every screen from All. Component-owned and
exact declared paths follow [component attribution](./mokly-component-changes.md#dependencies-and-styles).

Each variant of either kind is projected independently. Its metadata projection
contains `variantOf`, its parent's `{ id, title }`, and its copied `navPath`.
Changing `variantOf`, its `navPath`, or the parent title therefore marks the
variant changed, while a material or metadata change confined to the variant
never adds the parent. A flow is propagated only when its `screenId` step names
the exact changed screen, including a variant.

Before marking an existing fragment, compare its branch-point and working-tree
documents with the same paired ignore normalization and material-key rules as
the comparison engine. Ignored-only changes are excluded from Changes; real
content changes, material-key changes, and one-sided ignored-region adoption
with changed content remain eligible. Both viewports and every available color
scheme participate. Metadata includes address, titles, descriptions,
rationale, tags, related-doc links, flow steps and memberships, view structure,
and `navPath`; it excludes source locations and dependencies.
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
Both comparison paths share one rule. A resource is a verified deletion in
committed and derived modes, for every type including embedded HTML, only when
it was a regular file at the branch point, is now deleted, and remains
referenced by a current document. It marks consumers changed and never makes
Changes unavailable. Reject resources absent at the branch point, dangling or
escaping symlinks, unsafe or source-root paths, and newly missing files that are
not verified deletions. Snapshot generation still requires current references
to resolve.
Live classification walks a changed or moved document's branch-point resource
graph whenever the document changed or one of its current stylesheets changed,
regardless of whether any stylesheet is in the diff, so verified deletions of
non-stylesheet resources keep marking their consumers. Only an unchanged,
unmoved view with no changed stylesheet skips that walk, and the complete
comparison produces the same retained evidence for every view.

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
Live screen-only classification retains its analysis as `screenEvidence`, keyed
by entry id; the workspace selects its `resourceEvidence` slice without a
second analysis pass. Static exports select that slice from their packaged v4
comparison. Details merge the loaded comparison's evidence
with classification evidence, preserving retained stylesheet selectors,
exclusions, shared-impact, and ignored-content details without duplicate cards.
See [CSS evidence presentation](./mokly-css-evidence-presentation.md).

Classification reads baseline files without writing snapshots or a comparison;
derived mode uses the completed cache entry. Baseline reads are batched, shared
resource edges are cached, and cycles terminate. Apart from verified deletions,
an unavailable or invalid input makes Changes unavailable while preserving the
tabs and access through All in live Serve.
Watched updates and static publishing use this same membership calculation.
A classifier error in a screen-only catalogue is logged through the ordinary
safe diagnostic path and publishes unavailable; Serve never falls back to a
second comparison implementation.

Serve performs the calculation in a background worker after HTTP is ready and
complete generated output has been adopted, never during a shell request.
The watched parent publishes the result. Until the immutable changed-entry, baseline, and
component-evidence snapshot arrives, Browse keeps both tabs without inventing a
Changes count. A spinner occupies the reserved count slot, and selecting Changes
shows a loading sidebar. Derived mode publishes a distinct `preparing` state
before `pending` while its baseline rebuild runs; see the
[derived baselines contract](./mokly-derived-baselines.md). Content updates clear the previous snapshot and publish
pending status before notifying the browser, then publish a terminal ready or
unavailable status only when the latest sequence finishes. Empty ready results
show zero; unavailable results show a dash and a plain unavailable message.
Earlier baseline output follows the command and copy contract in
[Baseline Compatibility](./mokly-baseline-compatibility.md).
Tabs, count allocation and the tree origin remain fixed throughout;
late results from superseded generations are ignored. Non-watched Serve uses the
same asynchronous startup boundary, without observing later edits. Watched Git-only
ref changes reclassify completed output without rendering views again.

Component-aware classification preloads all baseline views in one bounded Git
batch across startup, watch, Browse evidence, and publishing; readers without
bulk support cache individual reads. Resource discovery stays lazy and obeys
ignore/ownership rules. An incomplete batch fails classification rather than
dropping views or weakening Git validation.

## Screen controls

The status beside the title and the comparison band describe the view actually
shown, not the entry-wide result or merely the requested axes. A Dark
selection on a light-only screen therefore resolves to its Light view for
status, control marks, and comparison presentation while retaining the Dark
control state and the visible Light-only fallback label. With one viewport and
one effective scheme selected, the view's review state maps `changed` to
Changed, `added` to Added, `removed` to Removed, and `unchanged` or
`ignored-only` to Unmodified. While Both is selected, the shown status is
Changed when any shown view is Changed, else Added when any is Added, else
Removed when any is Removed, else Unmodified. Comparison eligibility follows
that shown status under the existing kind rule: Changed is eligible, and
Removed is eligible only for a component variant. Thus an entry with
changes can show Unmodified with no comparison band while the marks on the view
controls and the `Changed views` row point to the views that changed.

Per-view evidence is authoritative only when it names every effective view in
the current selection. Unknown, pending, or partial per-view evidence preserves
the selected entry's fallback status and comparison eligibility as two
independent values. In particular, a Changed fallback status must not turn an
explicitly ineligible public selection into an eligible comparison. Switching
viewport or requested scheme recomputes the effective views, status, marks, and
eligibility without a page load, as does a background evidence refresh;
selecting a sibling variant is navigation to that entry.

Server rendering, controlled selection, and comparison deep links use the same
decision; a deep link is honored only after it confirms eligibility. Nonmatching
evidence retains the existing fallback decision.

Eligible views offer Current / Side by side / Overlay / Difference in an opaque
band beneath the heading. Added and Unmodified views retain their current
preview without that band; removed screens show their
[previous version](./mokly-removed-previews.md) without it. Affected-only
consumers can compare actual rendered differences while staying outside
Changes. Current is selected initially, including after navigation and reload.
Selecting Changes, opening a current screen, changing its viewport or color
scheme in Current, and receiving a watched update do not generate comparison
snapshots in development; opening a removed entry is the one selection that
requests its historical preview. Publications with Changes prepare snapshots
at build time, but never fetch or render them while browsing in Current. The first
explicit diff selection requests the comparison in either delivery mode.
Returning to Current cancels pending UI work and restores the current screen.
Navigation must never let a late comparison response replace another screen.
Shell-owned links carry comparison intent only when the destination view
is eligible. The destination revalidates that eligibility before honoring a
comparison query, so stale, manually edited, or historical URLs cannot bypass a
current-only state or trigger a hidden comparison request.

When a ready classification marks only some of a screen's views changed, the
view controls say so rather than leaving the reviewer to find the difference.
The theme control is marked when a changed view uses the other scheme, and the
viewport control when a changed view uses the other viewport; selecting both
viewports shows every viewport at once, so that control is never marked. The
details inspector lists the same views as `Changed views`. When the current
selection is not itself a changed entry, activating a changed row while the
Changes filter is selected opens that destination's first changed view instead
of the sticky selection, unless the URL names a viewport or scheme. Once a
changed entry is selected, later row activations keep the sticky axes while an
aggregate parent still redirects to its first visible changed variant. A direct
URL, an All-filter activation, Back, Forward, and a reload also keep the sticky
selection.
These marks and the `Changed views` row apply in exports with Changes as well as
in Serve.

Diffs render inside the existing main region with the catalogue, title, details,
viewport, and scheme controls retained. Both viewports are supported. Snapshot
frames follow the [pane](./mokly-comparison-panes.md) and
[scrolling](./mokly-comparison-scrolling.md) contracts: script-disabled,
device-sized documents with inert links and aligned regions. Overlay and
Difference use one chrome; Side by side uses two. Missing panes stay explicit,
dimensions match, and only Current offers expansion or pixel measurements.

Loading, unavailable, and failed comparison states use plain product copy.
Failure offers a retry. All and Changes share the same comparison eligibility.
Removed screens remain discoverable in Changes without offering a comparison;
they show their [previous version](./mokly-removed-previews.md) instead of a
current preview. Dependency and ignored-region
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

Before pairing, discard a baseline entry whose id belongs to a current entry of
another kind; the current entry is then added, and no removed record with that
id is emitted. Remaining entries pair by kind and id. Views pair by id,
viewport, and color scheme from the union of baseline and current v7 entries.
Each side's view set is its
entry's effective `colorSchemes`: a dark view present only in head is `added`,
and one present only in base is `removed`. Mobile and desktop still classify
separately from their own documents. The compatibility gate runs before
pairing, so both sides use manifest v7. Configured
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
Root-absolute, protocol-relative, and other scheme-qualified resource URLs are
not portable in an isolated snapshot and fail comparison instead of being
silently omitted.
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
