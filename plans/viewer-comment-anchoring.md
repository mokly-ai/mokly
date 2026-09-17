# Viewer Comment Anchoring

Extend `@mokly/viewer` so a host application can build a comments feature on top
of it: anchor a comment to a component instance, show every comment's marker on
the preview, highlight every commented instance at once, and reopen a comment on
any saved component variant. The viewer keeps knowing no comment model, tenant,
auth or storage; hosts own comment data and comment UI. This plan adds the
missing presentation and navigation primitives only.

## Findings that shape the design

- Anchor identity already exists. `InstanceRef` (screen, optional variant and
  step, viewport, scheme, key) plus `identity.id`, `deploymentId` and
  `revision` from the read model form a complete stored reference, and
  `resolveInstance` classifies a stored record as present, moved or missing
  ([instance identity](../docs/protocol/mokly-instances.md)).
- Anchor capture exists: `startPick` ends with `onPickEnd({ reason: "selected" })`,
  and `onInstanceClick` fires on ready frames outside pick mode. Slots
  (`sidePanel`, `topBarEnd`, `stageOverlay`) host the surrounding UI.
- No host-usable geometry exists. Boxes arrive only inside hover/click events,
  relative to the frame and unmapped to the stage. The in-frame `geometry`
  notification is consumed at
  [`frames.ts:115`](../packages/viewer/src/viewer/frames.ts#L115) to refresh the
  package-owned label buttons, and the frame-to-viewer mapping lives privately in
  [`frame_labels.ts`](../packages/viewer/src/viewer/frame_labels.ts) and
  [`same_origin_highlight.ts`](../packages/viewer/src/client/same_origin_highlight.ts).
  `stageOverlay` is one box over the whole stage
  ([`slot_layout.ts`](../packages/viewer/src/viewer/slot_layout.ts)), so a host
  cannot place a marker on an instance, keep it there while the preview scrolls,
  or know when the anchor is off screen.
- Neither label layer refreshes on outer stage scrolling or frame expansion:
  the viewer label layer is `z-index: 11` while an expanded frame is far above
  it, and no viewer-root scroll or resize listener refreshes labels. The
  Milestone 11 review of the viewer plan also recorded a P2 lost-wakeup for
  geometry notifications raised during an asynchronous boundary list.
- Highlights address one instance. `HighlightRequest` accepts a single
  `InstanceRef` or the workspace key
  ([`highlight_request.ts`](../packages/viewer/src/viewer/highlight_request.ts)),
  so "show every commented instance" is impossible without repeated calls that
  replace each other.
- Saved variants are not selectable. `ViewerSelection` has no `variantId`;
  `ViewerRouting` keeps the variant as a private route detail sourced from the
  workspace select, which pushes URL state directly
  ([`workspace.ts`](../packages/viewer/src/client/workspace.ts#L267)), so a
  controlled host can neither propose nor restore a variant, and
  `highlightInstance`/`scrollToInstance` reject refs on a non-default variant.
- Instance-only anchoring: clicks outside any instance emit nothing
  ([`same_origin_pointer.ts`](../packages/viewer/src/client/same_origin_pointer.ts#L36)),
  pages carry no usage, and screens without component usage cannot be picked.
  Point or region anchoring would change the frame adapter wire contract and the
  embedded inspector bundle.

## Decisions

1. **Markers are host content positioned by the viewer.** A `markers` prop
   supplies `{ id, instance, content }` records; the viewer renders each
   marker's React content inside a container that tracks the instance's visible
   bounds in the viewer's coordinate space and reports `visible`, `hidden` or
   `unavailable` per marker. Hosts never receive raw geometry, so internal
   selectors, scaling and clipping stay non-API, and every host gets scroll,
   resize, expansion, evidence and replacement handling for free. A raw
   measurement API is not added.
2. **Multi-instance highlight is atomic.** `highlightInstances(refs)` accepts
   many exact refs spanning viewports and flow steps; if any ref has no matching
   ready current view the whole request rejects and nothing changes, matching
   the existing "never guess a replacement" rule. `highlightInstance` remains
   as single-ref sugar. Label text stays the existing "Component · id".
3. **`variantId` joins `ViewerSelection`; `fragment` does not.** A saved
   variant is navigational state that hosts must restore and controlled hosts
   must round-trip. Logical fragments remain observable through
   `onScreenNavigate` only.
4. **Markers and highlights match exact refs against the effective mounted
   view.** A marker for the mobile/light view shows only while that view is
   mounted; a dark selection that falls back to a light-only view mounts the
   light view, so light refs match it. Hosts that want a comment on several
   views supply one marker per view.
5. **Point and region anchoring are out of scope.** They require a new pick
   mode on the frame adapter wire protocol and inspector bundle. If point
   comments are required, create a separate plan; nothing here precludes it.
6. **The Milestone 11 P2 finding is addressed here** (option A: a generation
   and dirty-bit coalescer in the inspection owner) because markers depend on
   the same geometry invalidation path. The user may strike this TODO.
7. **No visible change to `mokly serve` or `mokly export`.** Marker and label
   layers exist only in the React viewer; standalone shell markup, CSS and
   behavior are unchanged. Vanilla bundle byte changes are documented, not
   visible.
8. **No mockup milestone.** Marker visuals are host-owned and multi-highlight
   reuses the existing Highlight components masks and labels, so no screen is
   designed. If a genuine visual gap appears, add a `Tags: mockup` milestone
   before the affected UI work.

## Proposed public contract

Milestone 1 formalizes this contract in the protocol docs; it is the design
target for the later milestones.

```ts
interface ViewerSelection {
  screenId: string | null;
  /** Saved variant of a selected component; absent means its default variant. */
  variantId?: string;
  view: "all" | "changes";
  viewport: "mobile" | "desktop" | "both";
  colorScheme: "light" | "dark";
  search: string;
  tags: readonly string[];
}
interface ViewerMarker {
  id: string;
  instance: InstanceRef;
  content: ReactNode;
}
type MarkerStatus = "visible" | "hidden" | "unavailable";
interface MarkerState {
  id: string;
  status: MarkerStatus;
}
interface ViewerError {
  code: "catalogue" | "selection" | "frame" | "comparison" | "markers";
  message: string;
}
interface MoklyViewerHandle {
  select(selection: Partial<ViewerSelection>): void;
  highlightInstance(instance: InstanceRef | null): Promise<void>;
  highlightInstances(instances: readonly InstanceRef[]): Promise<void>;
  scrollToInstance(instance: InstanceRef): Promise<void>;
  startPick(): Promise<void>;
  cancelPick(): void;
}
interface MoklyViewerProps {
  // existing props unchanged
  markers?: readonly ViewerMarker[];
  onMarkerChange?: (states: readonly MarkerState[]) => void;
}
```

Selection rules: `variantId` is valid only when `screenId` is a component (or
removed component) that has that variant; otherwise imperative selections reject
and controlled props render the unavailable state with one selection error. A
partial update that changes `screenId` without naming `variantId` drops the
variant. The workspace variant select proposes `select({ variantId })`; in
controlled mode nothing changes until the host supplies it back. Variant commits
replace frames and announce `onScreenNavigate` exactly as today.

Marker rules: a marker's container is an absolutely positioned box equal to the
union of the instance's currently visible boxes in the referenced frame, scaled
with the frame chrome, clipped to the frame's visible area, and positioned in the
viewer's coordinate space. Containers have `pointer-events: none`; host content
opts in. `visible` requires at least one box; `hidden` means the view is mounted
and ready with the instance present but nothing visible; `unavailable` covers
everything else (no matching current frame, pending or unavailable usage, missing
key, page entries, non-Current comparison mode, measurement failure). Positions
refresh after in-frame geometry notifications, viewer-root scroll and resize,
frame expansion, frame replacement, evidence adoption and `markers` changes,
coalesced to one measurement per animation frame per frame session.
`onMarkerChange` reports the complete list once after the first evaluation and
then only when a status changes. Duplicate marker ids render no markers and emit
one `onError({ code: "markers" })`. Markers never start picks, emit instance
events or change selection. `renderViewer` does not accept markers. Unmount and
source replacement stop all marker work without later callbacks.

Highlight rules: `highlightInstances([])` and `highlightInstance(null)` clear.
Scope is the union of every matched session; each session receives only the keys
of refs matching it. Evidence loss of any referenced instance, frame replacement,
picking and superseded-work fencing behave exactly as for one ref.

## Milestone 1: Protocol documentation

Define the complete contract above before any implementation.

- [x] Add `docs/protocol/mokly-viewer-markers.md` covering markers, marker
      states, positioning, refresh triggers, error and lifecycle rules, and
      `highlightInstances` scope semantics; keep it under ~250 lines.
- [x] Update `docs/protocol/mokly-viewer.md`: add `variantId` to the selection
      contract and its validation, reset and proposal rules; add the new handle
      method, props, event and error code to the API listing; link the markers
      document; state that outer scroll, resize and frame expansion refresh
      package labels and markers. Trim or relocate text so the file stays near
      the length guideline.
- [x] Update `docs/protocol/mokly-frame-adapter.md` to state that
      `listInstanceBoundaries` and `geometry` notifications also feed host
      markers and that the wire schema and inspector bundle are unchanged.
- [x] Update `packages/viewer/README.md` (Public API, Quick Start marker
      example), the root `README.md` viewer paragraph, and
      `docs/architecture/package-boundary.md` (markers are host content; the
      viewer still knows no comment model).
- [x] Add this plan to `plans/README.md` under Active.
- [x] Validate the changed Markdown with `npx prettier --check` on the changed
      files and review the diff for internal consistency.
- [x] Run `git add -A`, commit with Conventional Commits and push the branch.
- [x] After that push, use [the implementation review prompt](../docs/implementation-review-prompt.md)
      against the complete local diff from `origin/main`; report numbered
      findings with severity, impact, lettered options and a recommendation
      without fixing.

### Milestone 1 verification notes

Prettier passed for all eight changed Markdown files. Relative links resolve,
`git diff --check` passes, the dedicated marker contract is 158 lines and the
main viewer contract is 279 lines after relocating inspection detail. The diff
was reviewed for selection, marker, multi-highlight, adapter and package-boundary
consistency. This documentation-only milestone does not require `cargo xtask
check` under the repository rules.

### Milestone 1 post-push review

No findings. The required prompt reviewed the complete nine-file diff against
`origin/main` after commit `37a2995` was pushed. It checked the selection and
marker contracts, adapter-wire invariants, host/package ownership, public README
examples and plan alignment. Worktree, index and untracked inventories were
clean, and the review made no changes. Residual risk is implementation
conformance, covered by the focused and complete gates in Milestones 2–4.

## Milestone 2: Saved variant selection

Tags: ui

Make the saved variant part of viewer selection so hosts can propose, restore
and round-trip it, then address instance refs on any variant.

- [ ] Add `variantId` to `ViewerSelection`, `defaultSelection`,
      `normalizeSelection` (now model-aware), `sameSelection` and
      `revealSelection` in `packages/viewer/src/viewer/selection.ts`; drop the
      variant on `screenId` changes that omit it. Split the file if it exceeds
      the length guideline.
- [ ] Replace `ViewerRouting`'s private variant with selection-owned state:
      shell links with `?variant=` and pending route intents propose
      `{ screenId, variantId }` atomically; `commit` applies the variant, updates
      the scoped URL, replaces frames and announces once.
- [ ] Extend `installWorkspace` with an optional variant proposal hook and a
      returned `setVariant` operation so the viewer intercepts the
      `[data-workspace-variant]` change, proposes a selection, and applies the
      committed variant without re-installing the workspace or pushing history
      itself. Standalone Serve/export keep the current direct behavior.
- [ ] Render the initial variant in `islandMarkup` and `routeMarkup` so SSR and
      route replacement select the requested option, and accept `variantId` in
      `renderViewer` initial selections.
- [ ] Node tests in `packages/viewer/tests/selection.test.ts` and
      `server.test.tsx`: normalization, invalid variants, drop-on-screen-change,
      equality, SSR option selection.
- [ ] Browser tests (`tests/browser/viewer_selection.spec.ts` or a new
      `viewer_variants.spec.ts`) on both adapters: uncontrolled select via the
      workspace control and via `select`; controlled proposal without change
      until supplied back; invalid imperative variant rejects with one selection
      error; `onScreenNavigate` carries `variantId`; `highlightInstance` and
      `scrollToInstance` succeed on a non-default variant after selection and
      still reject on a mismatched variant; frame replacement ends an active
      pick with `navigation`.
- [ ] Confirm the standalone shell markup, CSS and Serve/export behavior are
      unchanged; document any vanilla bundle byte change.
- [ ] Run focused tests, then `PLAYWRIGHT_CHANNEL=chromium cargo xtask check`;
      require zero failures, retries and skips.
- [ ] After checks pass, run `git add -A`, commit with Conventional Commits and
      push the branch.
- [ ] After that push, use [the implementation review prompt](../docs/implementation-review-prompt.md)
      against the complete local diff from `origin/main`; report numbered
      findings with severity, impact, lettered options and a recommendation
      without fixing.

## Milestone 3: Multi-instance highlight

Tags: ui

Highlight every commented instance at once using the existing masks and labels.

- [ ] Add `{ kind: "instances"; instances: readonly InstanceRef[] }` to
      `HighlightRequest`; `highlightKeys` returns the keys of refs matching each
      frame; `inspectionScope` selects the union of matched sessions.
- [ ] Add `highlightInstances` to `ViewerFrames`, `ViewerRuntime`, the
      imperative handle and `MoklyViewerHandle`; reject atomically with the
      adapter's `missing-instance` semantics when any ref has no matching ready
      current view; keep `highlightInstance` as sugar over it.
- [ ] Keep evidence validation (`validInspection`), pick interplay, replacement
      and superseded-work fencing correct for multi-session scopes.
- [ ] Node tests for request scoping and key partitioning; browser tests on
      both adapters covering Both, two flow steps, mixed schemes, atomic
      rejection leaving prior highlights untouched, evidence loss of one ref
      clearing all masks and ending a pick with `evidence`, and clearing with
      an empty list.
- [ ] Run focused tests, then `PLAYWRIGHT_CHANNEL=chromium cargo xtask check`;
      require zero failures, retries and skips.
- [ ] After checks pass, run `git add -A`, commit with Conventional Commits and
      push the branch.
- [ ] After that push, use [the implementation review prompt](../docs/implementation-review-prompt.md)
      against the complete local diff from `origin/main`; report numbered
      findings with severity, impact, lettered options and a recommendation
      without fixing.

## Milestone 4: Host markers

Tags: ui

Position host-owned marker content on instances and keep it there.

- [ ] Add a React-owned marker layer to `ViewerLayout` (empty in SSR) and a
      runtime-owned placement store consumed with `useSyncExternalStore`;
      containers are keyed by marker id, positioned from store state, and carry
      `pointer-events: none`. Put new code in `packages/viewer/src/viewer/`
      modules such as `markers.ts`, `marker_store.ts`, `marker_layer.tsx` and
      `geometry_refresh.ts`, keeping every file near the length guideline.
- [ ] Implement placement: match each marker against current sessions with
      `matchesInstance`, measure with `listInstanceBoundaries`, map boxes with
      the frame rectangle, chrome scale, `clientLeft`/`clientTop` and
      `visibleFrameBox` clipping, and derive `visible`/`hidden`/`unavailable`.
- [ ] Implement the shared refresh scheduler: in-frame `geometry`
      notifications, viewer-root capture-phase scroll, `ResizeObserver` on the
      root, stage and frames, frame expansion, frame replacement, evidence
      adoption and `markers` prop changes; coalesce to one measurement per
      animation frame per session with a generation and dirty bit so a
      notification raised during an asynchronous list schedules one trailing
      refresh (viewer plan Milestone 11 P2, option A). Route package label
      refreshes through the same scheduler.
- [ ] Raise the marker and label layers above an expanded frame while one is
      expanded; restore afterwards.
- [ ] Wire `markers` and `onMarkerChange` through `MoklyViewer`, `ReadyViewer`
      and `ViewerRuntime`; validate duplicate ids with the `markers` error code;
      emit states once after the first evaluation and then on change only;
      report measurement failures once per refresh generation; stop all marker
      work on dispose and source replacement with no later callbacks.
- [ ] Extend `packages/viewer/tests/browser_entry.tsx` with marker fixtures
      and add browser tests on both adapters: initial placement and status,
      position tracking through inner and outer scrolling, resize and frame
      expansion, Both with one viewport marker, flow step markers, variant
      markers after Milestone 2 selection, hidden after scroll-out,
      unavailable on other screens, non-Current comparison, pending usage and
      missing keys, evidence updates in both directions, duplicate ids,
      marker changes without remount, host content click handling, no
      instance or pick events from marker interaction, and clean unmount.
- [ ] Node tests for status derivation, box union and coordinate mapping, and
      a custom-adapter regression for geometry raised during an asynchronous
      boundary list.
- [ ] Confirm the standalone shell markup, CSS and Serve/export behavior are
      unchanged; document any vanilla bundle byte change. Run
      `npm run package:smoke` and confirm the packed viewer exposes the new
      API from a clean install.
- [ ] Run focused tests, then `PLAYWRIGHT_CHANNEL=chromium cargo xtask check`;
      require zero failures, retries and skips.
- [ ] After checks pass, run `git add -A`, commit with Conventional Commits and
      push the branch.
- [ ] After that push, use [the implementation review prompt](../docs/implementation-review-prompt.md)
      against the complete local diff from `origin/main`; report numbered
      findings with severity, impact, lettered options and a recommendation
      without fixing.

## Post-merge follow-up (non-blocking)

- [ ] Merge the release-please PR that ships the next viewer minor with its
      paired CLI patch under the existing [release contract](../docs/protocol/npm-release.md).
- [ ] From a clean consumer, mount the published viewer with the postMessage
      adapter against a published export on a second origin and exercise
      markers, `highlightInstances` and variant selection end to end.
- [ ] Close this plan in `plans/README.md` when the implementation PR merges.
