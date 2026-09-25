# Changes Controls And Serving

Continuation of [Changes and screen comparisons](./mokly-changes.md).

## Screen controls

The status beside the title and the comparison band describe the view actually
shown, not the entry's route-wide result or merely the requested axes. A Dark
selection on a light-only screen therefore resolves to its Light view for
status, control marks, and comparison presentation while retaining the Dark
control state and the visible Light-only fallback label. With one viewport and
one effective scheme selected, the view's review state maps `changed` to
Changed, `added` to Added, `removed` to Removed, and `unchanged` or
`ignored-only` to Unmodified. While Both is selected, the shown status is
Changed when any shown view is Changed, else Added when any is Added, else
Removed when any is Removed, else Unmodified. Comparison eligibility follows
that shown status under the existing kind rule: Changed is eligible, and
Removed is eligible only for a component saved variant. Thus a route with
changes can show Unmodified with no comparison band while the marks on the view
controls and the `Changed views` row point to the views that changed.

Per-view evidence is authoritative only when it names every effective view in
the current selection. Unknown, pending, or partial per-view evidence preserves
the selected entry or saved variant's fallback status and comparison eligibility
as two independent values. In particular, a Changed fallback status must not
turn an explicitly ineligible public selection into an eligible comparison.
Switching viewport, requested scheme, or saved variant recomputes the effective
views, status, marks, and eligibility without a page load, as does a background
evidence refresh.

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
Shell-owned links carry comparison intent only when the destination saved view
is eligible. The destination revalidates that eligibility before honoring a
comparison query, so stale, manually edited, or historical URLs cannot bypass a
current-only state or trigger a hidden comparison request.

When a ready classification marks only some of a screen's views changed, the
view controls say so rather than leaving the reviewer to find the difference.
The theme control is marked when a changed view uses the other scheme, and the
viewport control when a changed view uses the other viewport; selecting both
viewports shows every viewport at once, so that control is never marked. The
details inspector lists the same views as `Changed views`. When the current
selection is not itself a changed route, activating a changed row while the
Changes filter is selected opens that destination's first changed view instead
of the sticky selection, unless the URL names a viewport or scheme. Once a
changed route is selected, later row activations keep the sticky axes while an
aggregate parent still redirects to its first visible changed variant. A direct
URL, an All-filter activation, Back, Forward, and a reload also keep the sticky
selection.
These marks and the `Changed views` row apply in exports with Changes as well as
in Serve.

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

Continue with [Changes Comparison Engine](./mokly-changes-engine.md).
