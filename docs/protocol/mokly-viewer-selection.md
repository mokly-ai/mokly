# Viewer Selection, Events And Shell State

This continues the [embeddable viewer contract](./mokly-viewer.md), which
defines the props and the types that this page uses.

## Selection, Events And Imperative Use

`screenPath` names one catalogue entry path: a screen, page, document, use
case, component, or a screen or component [variant](./mokly-variants.md); null
selects home. A path with no current or removed entry shows the not-found view
with usable navigation. A variant of either kind is selected by its own path;
selecting a component parent shows the parent's own view, rendered from its
own props, and there is no separate variant selection field. `view` selects
the All/Changes **catalogue filter**, not a comparison mode. Logical fragments
and comparison mode keep their route and runtime state.

`snapshotId` is the optional opaque identity published beside a removed entry
of any kind. With it, the pair must resolve exactly one removed record; an
unknown, stale, or cross-catalogue identity is unavailable. A path-only
selection of a removed record normalizes to its published identity when
present. Readers reject an index where a current and a removed record share a
path. When a newer index arrives, the selected removed record is matched by
its identity; a replaced or missing record becomes unavailable without
retargeting. The `snapshot` query of the removed entry's `/view/<path>/` URL,
its survival across axis and filter changes, and its removal by navigation to
current content follow the
[shell destination contract](./mokly-shell-destinations.md). Direct URLs and
Back/Forward restore the exact record, and titles, breadcrumbs, Details,
status, active rows, preview lookup, and navigation events always use it.
Removed screens expose only their read-only previous version, with no
component picking, inspection, or comparison action.

Defaults are home, All, Both, Light, empty search and no tags, overridden once
by `defaultSelection`. `selection` supplies the complete controlled state;
when present, require `onSelectionChange` and do not also accept
`defaultSelection`. A user action or imperative `select` merges a partial
update into current state, validates it and emits a complete next state only
if changed. Controlled changes stay proposals until the host supplies them
back; incoming props do not echo an event. Uncontrolled mode commits the next
state itself. Invalid selection props, including invalid snapshots, render an
unavailable state and emit one selection error; invalid imperative selections
reject without committing. A partial selection that explicitly supplies
`screenPath` without `snapshotId` returns to current content and clears a
historical selection; viewport, scheme, filter, search and tag changes keep
it. Shell links and pending route intents propose `{ screenPath, snapshotId }`
atomically. The component page's variant bar links to the parent's own entry
and its variant entries, proposing `select({ screenPath })` for the chosen
entry; comparison mode across siblings follows
[variant navigation](./mokly-variant-navigation.md). A committed selection
replaces frames and announces `onScreenNavigate` once. Switching control mode
requires remounting. Never mutate supplied objects or arrays.

The viewer rebuilds `variantOf` for current and removed entries of both kinds
from the index, so its hierarchy, breadcrumbs, details rows, aggregate mark,
and removed-variant adoption match Serve; removed variants attach only to a
current non-variant parent, otherwise each stays one flat fallback row, and
every removed entry appears exactly once. A shell-link activation while `view`
is `changes` proposes one atomic selection: an aggregate-only parent proposes
its first visible changed variant, and a changed destination opened from an
entry that is not itself changed also proposes its first changed view's axes
under the [Changes screen controls](./mokly-changes-controls.md#screen-controls),
unless the link carries a valid explicit axis under the shell destination
contract. Sticky axes otherwise survive shell links, imperative `select`
calls and supplied selection props.

Free text and tags follow the single [search rule](./mokly-folders.md#titles).
Public selection carries the normalized phrase as `search` and the deduplicated
list as `tags`; the visible input displays those tags as `tag:` terms.
Navigation proposes any filter clearing needed to reveal its destination as one
atomic selection update. Light-only views keep the fallback labels when Dark is
selected; no fake dark view is made. The shown status, the hidden-change marks
and the comparison eligibility of the effective views follow the Changes
screen controls in every delivery, with ready evidence applied only when its
entry path matches the selected preview. Controlled selection, comparison deep
links, and detail updates use that one decision; a deep link is honoured only
after it confirms eligibility, and every matching update recomputes it in
place.

`onSelectionChange` reports requested state changes. `onScreenNavigate` fires
once after a committed entry, snapshot or fragment transition, including
accepted frame links and Back/Forward; it is observational, not a second
router. Unknown frame-link behaviour for standalone, uncontrolled, and
controlled hosts is owned by the
[navigation contract](./mokly-navigation.md#enhanced-navigation-and-safe-degradation).
Instance hover and click report scoped keys and current frame-relative boxes;
hover exit uses null and empty boxes, clicks always have an instance. Flow
events identify the owning use case and step without changing the screen's
key. Titles and props come from the index and the detail, never from
cross-origin DOM messages. Automatic inspection requires a frame's own ready,
bounded usage from the detail; unavailable siblings stay navigable but emit no
pointer inspection events. Every current, visible frame with ready usage can
emit authenticated hover and click events, independent of an explicit
highlight's mask and label scope; such a click leaves an idle highlight intact
and ends inspection only while a pick is active. A detail update refreshes the
usage of mounted frames without reloading a frame whose `documentKey` is
unchanged. Inspection ownership, evidence invalidation, multi-frame
highlighting, marker positioning and the shared geometry scheduler are the
marker contract.

`highlightInstance`, `highlightInstances` and `scrollToInstance` operate on
exact current views and reject missing or unavailable instances without
navigation or replacement guessing; null and empty arguments clear.
`startPick` starts only on an inspectable Current view, emits `onPickStart`
after activation, and reuses the inspection visuals. The first accepted
instance click emits `onInstanceClick`, ends pick, then emits
`onPickEnd({ reason: "selected", instance })`. Cancel, Escape, navigation,
source replacement, evidence invalidation and errors end an active pick
exactly once with their reason; `cancelPick` is idempotent, and pick emits no
selection callback unless selection actually changes. No pick button exists
in the standalone shell. Concurrent `startPick` calls share one activation
and one start event; cancelling a pending activation rejects its promise, and
only an activated pick emits an end event. Starting pick focuses the viewer so
keyboard cancellation stays scoped. Any actual frame replacement, including
viewport, effective scheme, entry or fragment changes, ends active picking
exactly once with `navigation`, cancels pending activation and clears
inspection masks, labels and selection; changes that preserve the mounted
views do not end picking. Public operations keep the complete `InstanceRef`
scope. Late asynchronous work is fenced by request and frame generation;
obsolete promises reject with `disposed` and cannot affect replacement
presentation or events. Async failures reject the handle promise and emit one
product-safe `onError` without private paths. Unmount cancels without later
callbacks, user callback exceptions are not reclassified as viewer errors, and
during teardown every frame and runtime cleanup runs even when a host callback
throws, after which the original exception is rethrown unchanged.

## Shell Tree And State

The shell is one React component tree that renders only in the browser:
`MoklyViewer` in React hosts, and the `./browser` entry in the stub that Serve
and `build` deliver. There are no runtime-owned islands, no string-rendered
markup injected into the tree, and no second implementation of any shell
interaction. Route content renders from the validated index and the current
entry's detail; navigation never fetches shell HTML. Controlled props and
handle methods update shell state. The bundle reads the stored appearance,
disclosure and navigation-width preferences before its first render, so no
pre-render script and no ownership handoff exists. Frames are static
documents in sandboxed iframes; the shell reaches inside only viewer-owned
removed-preview and [comparison-pane](./mokly-comparison-panes.md) `srcdoc`
documents, to install their guard and scrolling controller.

A mounted viewer keeps this shell state:

- **Route** is derived from the URL and is the only source of route truth:
  the entry, comparison selection and the validated `fragment` query.
  `/view/<path>/`, `/view/<path>`, and `/view/<path>/index.html` name the same
  path; the entry and its kind resolve through the index. The standalone shell owns the document URL and history
  and normalises it to the canonical form; React hosts receive route changes
  through `onScreenNavigate` and own their own URL.
- **Selection** is the public `ViewerSelection`. The standalone shell keeps
  viewport, scheme and filters in memory across in-shell navigation.
- **Disclosure** covers navigation groups, the details inspector, navigation
  split width and responsive drawer. Group storage and reconciliation follow
  the [disclosure persistence contract](./mokly-disclosure-persistence.md).
  Details and split-width choices persist per origin; the drawer and tag
  picker panel reset on a full page load.
- **Scroll** is tracked per shell `data-mokly-scroll` region for history;
  comparison-document regions and the Scroll together choice follow their
  [scrolling contracts](./mokly-comparison-scrolling.md).
- **Workspace** state (props under edit, inspector tab and pane size, active
  pick, highlight scope) lives with the mounted view and is discarded on
  route change or source replacement.
- **Data** is the installed index and the details the shell holds for the
  page's lifetime. In Serve the standalone shell adopts each publication under
  the [Serve update rules](./mokly-shell-delivery.md#updates-in-serve). A React
  host supplies newer data by replacing `index`.

A source change (index object identity, URL value, object base origin, or
`detail` function identity) or an adapter change remounts the shell tree,
cancelling stale loads, pick and frame sessions. Selection changes do not
remount it. Cleanup tolerates React effect setup and cleanup replay with no
duplicate listeners or requests. The standalone shell in Serve reads the
temporary-render capability from the live descriptor under the
[component controls contract](./mokly-component-controls.md#rendering-boundary); a static build has
no descriptor, and a React host has no live capability, so its controls are
read-only under the [controls contract](./mokly-component-controls.md).
Private tokens never enter the index or a detail.

## Active Catalogue Visibility

Every successful outer route change, including in-shell navigation, Back,
and Forward, establishes one navigation invariant: when the route has a
catalogue row, that row is visible and marked `aria-current="page"`.

To establish the invariant, Browse must:

1. remove `aria-current` from every other row;
2. open each ancestor disclosure of the active row, including its Specs or
   Components section and, for an entry with variants or one of its variants,
   the parent row's variant list defined by the
   [variant contract](./mokly-variants.md);
3. preserve unrelated folder disclosures;
4. clear a search query only when it would hide the destination;
5. switch Changes to All only when the destination is not changed;
6. reapply navigation visibility after those adjustments; and
7. scroll the active row into the nearest visible part of the catalogue pane.

The responsive drawer closes after navigation so it does not cover the new
screen. Its tree keeps the opened destination path for the next time it is
opened. A user may collapse the active path afterward; the next route change
re-establishes the invariant.

Each user edit to search or the All/Changes filter opens groups to reveal the
rows matching the updated constraints. Reapplying the same active constraints
during a route change or a Serve publication must instead preserve groups the
user subsequently collapsed; only the destination row's ancestor path may be
reopened. Clearing every filtering constraint restores the disclosure state
captured before filtering began, except that an ancestor opened for the
navigated destination stays open so the active row stays visible.

Enhanced navigation preserves the selected viewport, colour scheme, and
details disclosure. It collapses an expanded frame before installing the
destination. Filters and search stay unchanged when the destination is already
visible. Destination queries for the view axes and removed-entry snapshots
follow the [shell destination contract](./mokly-shell-destinations.md).

## Related Docs

- [Embeddable viewer](./mokly-viewer.md)
- [Viewer markers and multi-instance highlights](./mokly-viewer-markers.md)
- [Shell delivery and read model routes](./mokly-shell-delivery.md)
- [Catalogue navigation](./mokly-navigation.md)
