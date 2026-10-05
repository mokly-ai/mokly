# Changes and screen comparisons

## Delivery Status

Uniform CSS membership and evidence are implemented in [M19](../../plans/remove-source-path-evidence.md#milestone-19-classify-css-by-where-its-rules-match) of the
[source-path removal plan](../../plans/remove-source-path-evidence.md); comparison details for screens and component saved views are implemented in [M20](../../plans/remove-source-path-evidence.md#milestone-20-show-the-outside-component-evidence).

The remaining contract is implemented.

The implemented [component attribution extension](./mokly-component-changes.md)
keeps affected-only consumers out of Changes and links them from the component.
Screen and Review-ignore behavior remains below. Pairing uses kind and path,
then the move signals; review result v5 carries `previousPath` on paired moves.
Documents use the page material rules. The viewer presents paired entries under
the [move contract](./mokly-moves.md).

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

Changes is a review list of added, removed and moved screens, pages and documents, material document changes,
reviewable route metadata changes, and user flows that embed those screens.
A new or edited flow is included independently. In every catalogue, including
ones with registered components, a source edit or unreferenced
public file alone neither adds an entry to Changes nor supplies comparison
evidence. There are no declared-path or shared-glob reasons. Retained rendered
resource/CSS evidence, Review-ignore normalization, metadata, ancestry, flow
propagation and component usage attribution still apply. A changed component
may list its unchanged consumers under Affected screens; those consumers do
not become Changes rows solely because of component usage.
Mokly-inserted links for a rendered child component's declared CSS are not
consumer page material. A component page keeps its root component's inserted
links; renderer-authored links remain page content even if a declaration reuses them.
Rendered-resource and CSS evidence use final linked documents, not this
comparison-only projection. See the
[component attribution contract](./mokly-component-changes.md).

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
source move alone stays unchanged. Resource URLs compare by their resolved route;
accepted source moves map generated styles/assets and copied document resources
under the [move normalisation rule](./mokly-moves.md#normalisation). Equal mapped
resource bytes do not add material, dependency or shared-impact reasons. CSS URL
spellings use that same map; real resource edits retain normal attribution.
Inventoried owned sources relocated with their defining module compare by
logical path and confined bytes; only byte-identical moves lose dependency
reasons. Stored snapshots retain the original headers, paths and resource URLs.

Changes to local resources referenced by a fragment supply resource evidence.
Direct rows follow CSS rule attribution and non-CSS ownership below. Follow CSS imports, CSS URLs, and embedded-document resources
transitively using the snapshot resource resolver and public-file confinement.
Only references outside paired ignored regions participate; speculative
preload/prefetch hints alone do not establish rendered impact. A linked resource
edit is conservative evidence of a rendering change, not a pixel measurement.
Unreferenced public files never add entries or comparison reasons.
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
keeps view evidence when a rule matches or is unresolved. Components change
only through kept own-page matches after nested filtering. A page gets its own row for matches outside
components changed by that rule, or for unresolved rules. All four CSS delivery
paths follow [one rule](./mokly-css-attribution-rules.md).
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
exclusions and ignored-content details without duplicate cards.
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

Screen controls and change-view selection follow the
[control contract](./mokly-changes-serving.md#screen-controls).
