# Removing host content swallows cleanup errors

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-03, from the branch `calummoore/rust-viewer-checks-plan`: finding 4 of its first review round, confirmed by an independent check.
- **Location:** `packages/viewer/src/shell/catalogue_boundary.tsx:54-79`, `:87-102`, `:151-183`, and `:189-209`; `packages/viewer/src/viewer/component.tsx:162-167`; `packages/viewer/src/viewer/ready.tsx:86-91`; `packages/viewer/src/shell/marker_layer.tsx:26-33`.
- **Reason:** The fix moves host content out of the shell's composition. That is a Large change for an error that needs an unusual host cleanup exception, so the fix rule for a Rare product bug defers it to its own change.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Host:** the application that embeds `MoklyViewer` from `@mokly/viewer`
    and supplies its React slot content, marker content, and callbacks.
  - **`CatalogueBoundary`:** the outer error catcher in
    `packages/viewer/src/shell/catalogue_boundary.tsx`. It shows the catalogue
    failure state for an unmarked value, and rethrows a marked value.
  - **`HostContent`:** the inner error catcher in the same file, around each
    present slot and each marker's content. It marks a value that host content
    throws, then rethrows the same value.
  - **Host mark:** the record of `hostErrors()` in the same file. It keeps
    thrown objects by identity and primitives by value.
  - **Nearest mounted ancestor:** the surviving parent that React gives as the
    error owner to the cleanups of a deleted subtree.
- **Background:**
  - The viewer has two error contracts that must both hold:
    - A document of a supported version that the shell cannot render, an
      entry detail included, replaces the whole catalogue with its failure
      state and Try again. The embedded viewer emits one `onError` with code
      `catalogue`. `docs/protocol/mokly-viewer.md`, section Package And
      Props, states it.
    - A value that host code throws reaches the host unchanged. The host gets
      the same value, no `onError`, and no failure state, also with no host
      error boundary.
  - These pages state the second contract:
    - `docs/protocol/mokly-viewer-selection.md`: user callback exceptions are
      not reclassified, and a teardown rethrows the original exception
      unchanged.
    - `docs/protocol/mokly-viewer-markers.md`, section Errors And Lifecycle.
    - The catalogue boundary entries of `packages/viewer/README.md` and
      `packages/viewer/src/shell/README.md`.
    - `tests/browser/viewer_host_failures.spec.ts:1-6`. Its journeys assert
      `same: true`, the identical value, and no `error` event.
  - The code separates the two contracts like this:
    - `useHostProps` wraps each host callback and ref in `hostCall`, which
      marks a thrown value.
    - It wraps each present slot and each marker's content in its own
      `HostContent`. An absent slot gets no wrapper, so the layout keeps its
      empty-slot rules.
    - `CatalogueBoundary` rethrows a value that the host mark names. It
      renders null for any other value, and `componentDidCatch` calls
      `onFailure`.
    - The catcher's key changes only with the source, the frame adapter, or
      the detail source. So a replaced generation deletes the whole catcher,
      and its cleanup errors reach the host.
    - Frame adapter cleanups use `HostCleanupMark` of
      `packages/viewer/src/shell/host_cleanup.ts`.
  - React 19.3 runs the cleanups of a deleted subtree with the nearest
    mounted ancestor as the error owner.
    - This covers layout-effect cleanups, ref detaches, `componentWillUnmount`,
      and passive cleanups.
    - In `react-dom/cjs/react-dom-client.development.js` of react-dom 19.3.0,
      see `commitDeletionEffectsOnFiber`, `commitHookLayoutUnmountEffects`,
      `safelyDetachRef`, `safelyCallComponentWillUnmount`, and
      `commitPassiveUnmountEffectsInsideOfDeletedTree_begin`.
    - `captureCommitPhaseError`, at line 20217, starts its catcher search at
      that ancestor. So a deleted `HostContent` never sees the value.
  - The only class catchers in `packages/viewer/src` and `packages/ui/src` are
    the two in `catalogue_boundary.tsx`.
  - On `origin/main` at `f08d02df`, before this change, the viewer had no
    catcher. The same cleanup value reached the host's own error handling
    unchanged.
- **Problem:** A host content cleanup that throws during its own deletion
  skips its deleted `HostContent`. The value has no host mark, so
  `CatalogueBoundary` treats it as a catalogue failure. These deletion paths
  reach it:
  - Fixed slots: clearing `topBarStart`, `topBarEnd`, `railStart`, `railEnd`,
    `emptyState`, `sidePanel`, or `stageOverlay`, or replacing `slots` with
    `{}`. `useHostProps` rebuilds the wrappers when `slots` changes, so the
    slot's `HostContent` goes with its content.
  - Marker removal: a marker that leaves `markers` takes its `HostContent`.
  - Marker visibility: the marker layer renders content only for a visible
    placement. A scroll, a screen change, or a frame replacement hides a
    marker and deletes its `HostContent`, with no host change.
  - Unavailable selection: an invalid controlled selection makes `ready.tsx`
    replace the whole mounted shell with the unavailable state. The catcher
    survives, and every slot and marker goes with the shell.
  - Catalogue failure teardown: after a real catalogue failure,
    `CatalogueBoundary` renders null and deletes the shell under itself. A
    host cleanup that throws in that teardown joins the catalogue failure.
  - Example: mount a `topBarStart` child whose layout-effect cleanup throws an
    original error, then replace the slots with `{}`. The host sees the
    failure state and one `onError` with code `catalogue`. React gives the
    original value only to the root's caught-error handler, which logs it by
    default. The host's error boundary and the window error event do not get
    it. Try again recovers, because the cleared slot is gone.
- **Impact if no action:** A host cleanup failure hides the catalogue behind
  Try again. The host gets a false catalogue error, and it loses its original
  exception. Normal use does not meet it, because a host cleanup must throw.
- **Root question:** How does every host content failure reach the host
  unchanged, also when the viewer deletes that content alone or together with
  the whole shell?
- **Options:**
  - **A.** Keep stable host error scopes around each slot and around the
    marker content collection. Keep them mounted when their content
    disappears. Keep the empty-slot, `emptyState`, and overlay visibility
    rules. Add a regression that removes host content whose cleanup throws.
    It misses the unavailable selection and the catalogue failure teardown,
    which delete the scopes together with the shell. Effort: Medium.
  - **B.** Own host content above the catalogue catcher. Render each slot's
    content and each marker's content into UI-owned slot targets through
    portals, so no host content is a child of `CatalogueBoundary`. It covers
    every deletion path above by construction. It changes the composition of
    the embedded root. Effort: Large. B must keep every direct contract:
    - The host's React contexts still wrap its content, as they do today.
    - DOM events from host content behave as today. Escape from slot content
      still reaches the shell root's key handler, which closes the picker
      before the expanded frame, as `docs/protocol/mokly-shell-device-chrome.md`
      requires for the expanded frame.
    - The slot rules of `docs/protocol/mokly-viewer.md` stay. An omitted slot
      adds no space or control. `emptyState` replaces only the no-selection
      home body. `stageOverlay` covers only the stage, with the pointer
      events that the host chooses. Slot children stay ordinary React
      children of the viewer, and they rerender without a reset of the
      viewer state. The shell never reaches into their DOM or event handlers.
    - The viewer queries no DOM. Each target comes from a ref of an existing
      `@mokly/ui` layout component, such as `@mokly/ui/embedded-layout`, and
      the marker layer gives one container ref for each marker.
    - The host keeps the same value: an object by identity, a primitive by
      value.
    - The public API of the root entry stays browser-only and unchanged. B
      changes nothing visible, so it needs no new mockup and no new
      component.
    - The slot assertions of
      `packages/viewer/tests/embedded_viewer_render.test.tsx:22` and `:107`
      move from server markup to a client render, because a portal target
      needs a mounted ref.
  - **C.** Apply A. Also move the selection check of the ready viewer above
    the catcher, so the unavailable state replaces the catcher together with
    the shell. A catalogue error from that check still shows the failure
    state with one `onError` with code `catalogue`. Selection state and its
    one-time error move into `MoklyViewer`. It still misses the catalogue
    failure teardown, and a later in-shell switch that deletes host content
    needs the same care. Effort: Medium.
  - Each option adds regressions to `tests/browser/viewer_host_failures.spec.ts`,
    each with a host cleanup that throws: a cleared slot, a removed marker, a
    hidden marker, an invalid controlled selection, and, for B, a catalogue
    failure teardown. A host case asserts the same value, no `error` event,
    and no failure state. The teardown case keeps its one catalogue `onError`
    and also delivers the host value unchanged.
- **Left out:**
  - Remove the catalogue catcher: it breaks the approved failure state.
  - Catch errors only in host components: it asks hosts to change content.
  - Mark viewer errors instead of host errors: a viewer error from malformed
    content would then reach the host's tree, which
    `docs/protocol/mokly-viewer.md` forbids.
  - Find the source by component stack or deletion timing: host builds minify
    names, and one commit can delete viewer and host content together.
  - Give the catcher a new key on each slot removal: it resets the viewer
    state, against the slot rule of `docs/protocol/mokly-viewer.md`.
  - Keep the shell mounted under the unavailable state: C is better on every
    point, because this changes the unavailable screen.
  - A portal owner inside the catcher: B is better on every point, with the
    same portal cost and without host marks.
- **Wider fix:** B. A and C must know each place where the viewer deletes host
  content, so they are direct fixes.
- **Previous examples:** `origin/main` at `f08d02df` already keeps cleanup
  failures past replaced host bridges, in
  `packages/viewer/src/viewer/host_bridge_lifecycle.ts` and
  `packages/viewer/src/viewer/host_bridge_failure.ts`. No earlier example of a
  slot deletion was found.
- **Related:** [asynchronous-catalogue-failures.md](./asynchronous-catalogue-failures.md),
  same code: both items change which errors reach `CatalogueBoundary`. This
  item keeps host errors away from the catcher, and that item sends
  catalogue errors of asynchronous loads to it. The options do not conflict.
  Option B here moves host content above the catcher and keeps the shell
  store below it, so the render-time rethrow of that item still reaches the
  catcher. One later branch can take both items.
- **Recommendation:** B. It is the only option that keeps every host content
  failure away from the catalogue catcher, whatever the viewer deletes with
  that content. If B turns out to need a change of behaviour, apply C, not A.
- **Action:** fix after merge, apply B, because the problem needs an unusual
  host cleanup exception, and B is a separate Large composition change, as
  the fix rule for a Rare product bug directs.
