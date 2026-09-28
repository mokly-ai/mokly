# Interactive Views Shell

## Delivery Status

Implemented by Milestones 5, 7 and 9 of the
[interactive views plan](../../plans/interactive-views.md), on the private
route-scoped eligibility delivered in Milestone 6. This contract owns how the
React shell offers, selects and presents Static and Live. The
[interactive views overview](./mokly-interactive-views.md) owns configuration
and the per-entry opt-out, the
[Live runtime contract](./mokly-interactive-views-runtime.md) owns the document
and mount, the
[Serve delivery contract](./mokly-interactive-views-serve.md) owns the origin
and bundle, and the [design](./mokly-interactive-views-design.md) owns the
approved presentation.

## Control

The view toolbar shows a segmented control named "Preview mode" with Static
and Live when the private descriptor exists, the routed view is a current
screen or a current saved component variant, and that entry is eligible under
[Eligibility](#eligibility). It sits after the Dark preview toggle, or after
the viewport control when the shell shows no Dark preview toggle, and before
Highlight components. The standalone top-bar Appearance selector remains the
only color-scheme control. Pages, use-case steps, removed entries, removed
variants, opted-out entries and entries of unknown eligibility render no
control and leave no gap: their toolbar is exactly the static-only catalogue's.
While a comparison is shown the control is hidden, and Current restores it with
the choice unchanged. The descriptor and the route's private workspace are
present during server rendering and hydration, so the control, or its absence,
is part of the first paint. Export and publication never carry the descriptor
and never show the control.

At 760px and narrower, only a toolbar that shows the control takes its own
left-aligned row below the title, as the Live artboards draw it: the toolbar
that renders the control carries `data-preview-mode-offered`, and the narrow
row is scoped to that mark. Every other toolbar keeps the static-only layout of
the approved artboards: beside the title, and below it, starting where the
heading starts, only when the title leaves no room. Because the row follows
the control's presence, including the presence a pending view retains under
[Eligibility](#eligibility), the first paint already has its final layout, and
a navigation or comparison moves the toolbar only when the control itself
appears or disappears.

## Eligibility

The shell reads a view's eligibility only from the private workspace that the
store adopted for that exact route and source,
`useViewerLiveState().workspace?.interactive`. `true` offers the control and
lets Live prepare and mount. `false` is an opt-out, and an adopted workspace
without the value is unknown; both render no control, show the Static frame
and make no Live request. Ineligibility never changes the preview mode: a Live
selection stays selected while that view shows Static, and the next eligible
view mounts Live again.

Same-shell navigation, including Back and Forward, commits the destination
before its private workspace arrives, so the destination's eligibility is
pending until the store adopts that route's workspace;
`useViewerLiveState().workspacePending` marks that interval. Pending follows
the rule that status, comparison eligibility and change marks use while their
matching evidence is missing: keep a presentation rather than blanking it,
apply matching evidence in place, and never derive a capability from the
fallback. The retained presentation is whether the view the shell root
displayed immediately before offered the control; a comparison only hides it.
If it did, the pending view shows the control with the current selection and
generation-wide availability. After any other view, including an ineligible
workspace, a page, a flow or home, the pending view shows none.

A pending view never calls the preparation endpoint and never mounts a Live
frame. With Live selected and the control retained, the device frames show the
preparing state; otherwise they show the Static document. Pending ends when
the store adopts the route's workspace, whose eligibility then applies in
place, or when the evidence request for the current route and source fails or
is rejected under the [live capability contract](./mokly-live-capabilities.md).
That leaves eligibility unknown, so the view shows Static without the control
until a later revision supplies the route's workspace. Each navigation
therefore changes the control's presence at most once: a move between eligible
views whose evidence loads keeps it throughout, and an opted-out destination
loses it only when its evidence arrives.

## Preview Mode

Preview mode is shell state, not public selection. It starts Static, persists
across view changes in the current document, and is discarded by an ordinary
reload. A watched reload's one-shot recovery carries it, so a rebuild that
replaces the generation reloads the page with Live still selected and mounts
the Live frame on the new generation when that view is eligible.

## Frames

Static frames mount exactly as today. Selecting Live on an eligible view
mounts a new frame in the same device chrome: the same `/static/` path, query
and fragment on the Live origin, `sandbox="allow-same-origin allow-scripts"`,
and the cross-origin adapter with pending usage, so the frame subscribes to
navigation only. The frame origin is the descriptor's explicit origin,
otherwise the shell's own scheme and host name with the descriptor port.
Navigation events reach the shell's existing frame event router exactly like
Static links.

## Preparing And Unavailable

Preparing: when Live is selected for an eligible view and the descriptor is
not `ready`, the device frame shows a centered spinner with "Getting the live
preview ready" and the shell calls the preparation endpoint for the current
generation. Selecting Static, changing view or replacing the generation aborts
that call, and Static returns the static document immediately. A `ready`
result or event mounts the Live frame hidden behind the same state until the
adapter mount resolves, so a blank document never shows. The same state covers
a pending view with Live selected, without the call.

Unavailable: Static is selected and the Live segment is disabled but
focusable, with the tooltip and accessible description "Live preview is
unavailable for this view." A `failed` descriptor, a `failed` preparation or a
preparation error applies to every view of that generation; an adapter mount
failure such as `timeout`, `origin` or `unavailable` applies to that view only.
The reason stays diagnostic detail, not shell copy, and a new document starts
available again. Opted-out and unknown views are not unavailable: they have no
control at all.

## Inspector While Live

While Live is on screen, including the preparing state, highlight, pick and
controls stay Static-only. The inspector's Components, Props or Controls, and
Usage tabs keep their icons and open normally, but each panel shows only
"Switch to Static to inspect or edit this view."; Details is unchanged.
Highlight components is disabled with the description "Highlighting works in
Static." Switching to Live with unsaved prop edits discards them, exactly as
changing the saved variant does; the control is not disabled. An ineligible
view keeps ordinary inspection and editing whatever the preview mode.

## Verification

Unit tests cover eligibility from adopted, value-less, other-route and missing
workspaces; availability with and without a retained control; server-rendered
markup for eligible, opted-out and unknown screens and components, including a
toolbar identical to the static-only one and the narrow-row mark only on a
toolbar with the control; and the narrow row scoped to that mark. Browser
tests against real Serve cover control visibility per catalogue, view and
entry; the first paint of opted-out screens and components; Live selected
across eligible and opted-out screens and components, saved variants and Back;
held route evidence that neither prepares nor mounts Live and changes the
control at most once; route evidence that cannot load; frame origin and
sandbox per mode; preparing and both unavailable scopes; navigation from a
Live frame; preview-mode persistence, reset and watched-reload recovery; the
inspector notice; disabled highlighting; discarded edits; keyboard operation;
and the narrow toolbar's placement for eligible, opted-out, compared and
static-only views and across held route evidence.

## Related Docs

- [Interactive views overview](./mokly-interactive-views.md)
- [Live document and browser runtime](./mokly-interactive-views-runtime.md)
- [Interactive Serve delivery](./mokly-interactive-views-serve.md)
- [Interactive views design](./mokly-interactive-views-design.md)
- [Live viewer capabilities](./mokly-live-capabilities.md)
- [Live catalogue evidence updates](./mokly-live-evidence.md)
- [Viewer contract](./mokly-viewer.md)
- [Component controls](./mokly-component-controls.md)
