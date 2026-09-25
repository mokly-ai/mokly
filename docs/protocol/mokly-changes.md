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
component variants. A [variant screen](./mokly-screen-variants.md) is a
screen for every rule in this document: it has its own route, row, count
contribution, views, and comparison result, and only its navigation placement
under the parent screen is variant-specific. The
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

Each screen variant is projected independently. Its metadata projection
contains `variantOf`, its parent's `{ id, title }`, and the parent's collection
ancestors. Changing `variantOf` or the parent title therefore marks the variant
route, while a material or metadata change confined to the variant never adds
the parent route. A flow is propagated only when its `screenId` step names the
exact changed screen, including a variant.

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

The remaining contract is continued in [Changes Controls And Serving](./mokly-changes-controls.md) and [Changes Comparison Engine](./mokly-changes-engine.md).
