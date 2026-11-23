# Changes Screen Controls

Continuation of [Changes serving](./mokly-changes-serving.md).

## Screen controls

The status beside the title and the compare modes describe the views actually
shown, not the entry-wide result or merely the requested axes. A Dark
selection on a light-only screen therefore resolves to its Light view for
status, control marks, and comparison presentation while retaining the Dark
control state and the visible Light-only fallback label. With one view shown,
the view's review state maps `changed` to Changed, `added` to Added, `removed`
to Removed, and `unchanged` or `ignored-only` to Unmodified. While several
views are shown, the shown status is Changed when any shown view is Changed,
else Added when any is Added, else Removed when any is Removed, else
Unmodified. Comparison eligibility follows
that shown status under the kind rule: Changed is eligible, and
Removed is eligible only for a component. Thus an entry with
changes can show Unmodified with no compare modes while the marks on the
Frames filter's toggles and the `Changed views` row point to the views that
changed. Changed
components make the one exception: when the entry detail marks the entry
comparison-eligible, an Unmodified view whose usage holds a changed component
that the detail's `relatedComponents` names stays eligible while it shows
Unmodified. This holds in or out of Changes: for an entry that Changes does not
list, a pure move, a component variant, and an entry whose other views changed
alike. While several views are shown, one eligible shown view makes the
comparison eligible.

Per-view evidence is authoritative only when it names every effective view in
the current selection. Unknown, pending, or partial per-view evidence preserves
the selected entry's fallback status and comparison eligibility as two
independent values. In particular, a Changed fallback status must not turn an
explicitly ineligible public selection into an eligible comparison. Switching
viewport or requested scheme recomputes the effective views, status, marks, and
eligibility without a page load, as does a background evidence refresh;
selecting a sibling variant is navigation to that entry.

Controlled selection and comparison deep links use the same decision; a deep link is honored only after it confirms eligibility. Nonmatching
evidence uses the fallback decision.

Eligible views offer the five compare modes of the
[Changes tab](#changes-tab). A shown status of Added offers Current alone.
Unmodified views that use no changed component retain their current preview
without compare modes; removed screens show their
[previous version](./mokly-removed-previews.md) without them. Affected
consumers can compare actual rendered differences while their views stay
Unmodified, and an affected-only consumer stays outside Changes. On a
component's [variant set](./mokly-shell-canvas-stage.md#section), each shown
row is its own entry and decides its own comparison under the rules above, from
its own shown views and its own entry detail. The set offers its Changes tab
and the five compare modes while any shown row compares, whatever the routed
entry's own status. A row that does not compare keeps Current, its current
frames, while a mode shows. A screen, and a removed component or variant, which
has no current frames, offer the compare modes from their own shown views
alone. Decision: the shown rows of a set decide its Changes tab and its compare
modes, not the routed entry alone, because the canvas shows every row and each
row compares on its own; the routed entry alone would hide a changed variant's
comparison on the route of its unmodified parent or of an Added sibling.
Current is selected initially, including after navigation to another section
and after reload.
Selecting Changes, opening a current screen, changing its viewport or color
scheme in Current, and receiving a watched update do not generate comparison
snapshots in development; opening a removed entry is the one selection that
requests its historical preview. A static build with Changes prepares snapshots
at build time, but never fetch or render them while browsing in Current. The first
explicit diff selection requests the comparison in either delivery mode.
Returning to Current cancels pending UI work and restores the current screen.
Navigation must never let a late comparison response replace another screen.
Shell-owned links carry comparison intent only when the destination view
is eligible. An eligible Affected link names a view that its destination can compare:
a Changed view, or an Unmodified view whose usage holds the changed component.
An Added view is never eligible, so its Affected link opens Current without a
comparison query.
The destination revalidates that eligibility before honoring a
comparison query, so stale, manually edited, or historical URLs cannot bypass a
current-only state or trigger a hidden comparison request. It honors the query
once for each navigation, when that eligibility is first known, by selecting
Side by side and the Changes tab, where the canvas shows that mode. A watched
update or a later eligibility change never applies it again.

When a ready classification marks only some of a screen's views changed,
Inspect says so rather than leaving the reviewer to find the difference.
On the canvas, a toggle of the
[Frames filter](./mokly-shell-canvas-stage.md#frames-filter) that hides a
changed view is marked. Inspect's head lists the same views as
`Changed views`. When the current selection is not itself a changed entry,
activating a changed row while the
Changes filter is selected opens that destination's first changed view instead
of the sticky selection, unless the URL names a viewport or scheme. Once a
changed entry is selected, later row activations keep the sticky axes while an
unmodified container row still redirects to its first visible changed variant
or member under [variant navigation](./mokly-variant-navigation.md#changes-rows). A direct
URL, an All-filter activation, Back, Forward, and a reload open no first
changed view.
These marks and the `Changed views` row apply in a static build with Changes as
well as in Serve.

Diffs render in the frames of the canvas, with the catalogue and the right
panel retained. Each shown frame of a compared row compares its own view, and
a row that does not compare keeps its current frames. Snapshot frames
follow the [pane](./mokly-comparison-panes.md) and
[scrolling](./mokly-comparison-scrolling.md) contracts: script-disabled,
frame-sized documents with inert links and aligned regions. Overlay,
Difference and Swipe show both versions inside each compared frame;
Side by side shows the two versions of one chosen frame next to each other.
Missing panes stay explicit, dimensions match, and only Current offers pixel
measurements.

Loading, unavailable, and failed comparison states use plain product copy.
Failure offers a retry. All and Changes share the same comparison eligibility.
Removed screens remain discoverable in Changes without offering a comparison;
they show their [previous version](./mokly-removed-previews.md) instead of a
current preview. Dependency and ignored-region
evidence stays secondary to the screen preview. Evidence availability is
independent of comparison-mode eligibility and of the right panel's tab; Added
and Removed screens can retain factual evidence without gaining comparison
modes.

## Changes Tab

The Changes tab of the
[right panel](./mokly-component-inspector-design.md#right-panel) holds, in
this order: the change stepper, one host slot, Compared, the compare modes and
the comparison details.

The change stepper reads `Change N of M`: the entry's place among the entries
that the Changes filter lists, in the filter's order. Previous change and Next
change open the entry before and after it on the Changes tab. The first entry
has no previous change and the last entry no next change, so those controls
are disabled. An entry that the Changes filter does not list has no stepper.

The host slot follows the stepper. A host fills it through the `changesStart`
key of the [viewer's slots](./mokly-viewer.md#rendered-features-and-slots),
and Mokly Cloud places its check there. The open-source shell leaves the slot
empty, and an empty slot takes no space.

Compared names the two versions on a rail. Before reads `Branch point on` and
the base, such as `origin/main`, and Current reads `This branch`. An entry
that the branch added has no version before, so its rail holds Current alone
with the line `Added on this branch, so there is no base to compare.` A
variant set opened on a row that the branch added names both versions, as for
a changed entry, while another of its shown rows compares; the added row's own
frames stay current. An entry that the branch removed has no current version,
so its rail holds the version before alone with the line
`Removed on this branch, so there is no current version to compare.`

The compare modes are tiles in the order of their keys: Current (1), Side by
side (2), Overlay (3), Difference (4) and Swipe (5). Each tile shows its icon,
its name and its key, and the tile of the shown mode is marked current. While
Changes is the selected tab, each key selects an offered mode unless focus is
in a text field. The frames of the canvas show the chosen mode only while
Changes is the selected tab; Inspect shows their current versions, and the
chosen mode and its loaded comparison stay, so a return to Changes shows that
mode without a new load. Side by side adds a chip for each frame of a compared
row, such as Desktop · Light, and the chosen chip names the compared frame.
Every mode other than Current adds the Scroll together switch and Refresh. The
[comparison panes](./mokly-comparison-panes.md#layout) define what each mode
shows.

The comparison details follow the modes. They hold the evidence of the
[comparison details design](./mokly-component-workspace-design.md#comparison-details),
whose branch-point sentence the Compared rail replaces.

Serving and comparison-engine behavior continues in
[Changes Serving And Comparison](./mokly-changes-serving.md).
