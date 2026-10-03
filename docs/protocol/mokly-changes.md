# Changes and screen comparisons

The implemented [component attribution extension](./mokly-component-changes.md)
keeps affected-only consumers out of Changes and links them from the component.
Screen and Review-ignore behavior remains below. Pairing uses kind and path;
review result v5 omits `previousPath` until move detection is implemented.
Documents use the page material rules. Move pairing and opening a folder
screen's first changed member from its row remain planned in the
[path identity plan](../../plans/path-identity.md).

The catalogue's All / Changes filter narrows one navigation tree. There is no
Review tab, report, or `mokly review`; `--out` belongs only to static `export`.

[Pages](./mokly-pages.md) and [documents](./mokly-documents.md) participate in
Changes and removed-entry states, while comparison controls remain exclusive
to changed screens and eligible component variants. Each
[variant](./mokly-variants.md) is an entry of its parent's kind with its own
path, row, count, views, and comparison; only its navigation placement under
the parent is variant-specific. The
[shared catalogue snapshot](./mokly-catalogue-changes.md) supplies metadata
independently of screen results; removed pages and documents are flat
Changes-only rows with baseline folder titles, and an entry the
[move contract](./mokly-moves.md) pairs with its baseline keeps one row
labelled Moved. Review reads follow the [source policy](./mokly-source-protection.md).

Opt into [Published Changes](./mokly-publication.md) with
`npm run preview:build -- --include-changes`; default publication omits Changes,
comparisons, history, and removals. Both options omit live updates. Strict
baseline admission and pairing/order fixes run in Serve, export, and publish.

## Changes membership

Changes is a review list of added, removed, and moved screens, pages, and
documents, material document changes, reviewable entry metadata changes, and
user flows that embed those screens.
A new or edited flow is included independently. Source edits, source moves,
dependency declaration edits, and shared-impact matches alone do not add
otherwise unchanged entries. Dependency and shared-impact evidence remains in
comparison details, accessible for every screen from All. Component-owned and
exact declared paths follow [component attribution](./mokly-component-changes.md#dependencies-and-styles).

Each variant of either kind is projected independently. Its metadata projection
contains `variantOf` and its parent's title. Changing the parent title
therefore marks the variant changed, while a material or metadata change
confined to the variant never adds the parent; a parent that moves carries its
variants with it under the [move contract](./mokly-moves.md). A flow is
propagated only when its `screenPath` step names the exact changed screen,
including a variant.

Before marking an existing fragment, compare its branch-point and working-tree
documents with the same paired ignore normalization and material-key rules as
the comparison engine. Ignored-only changes are excluded from Changes; real
content changes, material-key changes, and one-sided ignored-region adoption
with changed content remain eligible. Both viewports and every available color
scheme participate. Metadata includes address, titles, descriptions,
rationale, tags, related-doc links, flow steps and memberships, and view
structure; it excludes folder titles, source locations, and dependencies.
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
changes do not bypass resource validation. Pages and documents use these same
rules for their generated documents and rendered resources; they do not gain
screen comparison controls or viewport variants.
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
by entry path; the workspace selects its `resourceEvidence` slice without a
second analysis pass. Static exports select that slice from their packaged v5
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
unmodified container row still redirects to its first visible changed variant
or member under [variant navigation](./mokly-variant-navigation.md#changes-rows). A direct
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

Serving and comparison-engine behavior continues in
[Changes Serving And Comparison](./mokly-changes-serving.md).
