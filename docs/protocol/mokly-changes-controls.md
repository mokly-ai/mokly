# Changes Screen Controls

Continuation of [Changes serving](./mokly-changes-serving.md).

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
