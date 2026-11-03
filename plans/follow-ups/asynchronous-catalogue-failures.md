# Asynchronous catalogue failures bypass the catcher

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-03, from the branch `calummoore/rust-viewer-checks-plan`: finding 7 of its second review round, confirmed by an independent check.
- **Location:** `packages/viewer/src/catalogue/detail_reader.ts:12-17`; `packages/viewer/src/shell/data_detail_loader.ts:85-99`; `packages/viewer/src/shell/data_controller.ts:79-87` and `:205-254`; `packages/viewer/src/shell/data_commit.ts:54-86`; `packages/viewer/src/catalogue/shell_model.ts:96-105`; `packages/viewer/src/shell/data_refresh.ts:64-83`; `packages/viewer/src/shell/data_requests.ts:119-143` and `:161-204`; `packages/viewer/src/catalogue/detail_fences.ts:54-110`; `packages/viewer/src/shell/data_store.ts:57-103`; `packages/viewer/src/shell/catalogue_boundary.tsx:54-84`.
- **Reason:** Only a malformed document of the supported version starts it, and the Medium fix gets no harder later, so the fix rule for a Rare product bug defers it.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Entry detail:** the version 4 JSON document that supplies the views,
    usage, and comparison data of one catalogue entry.
  - **Delivery fence:** `fenceDetail` in
    `packages/viewer/src/catalogue/detail_fences.ts`. It binds a loaded
    detail to the installed index by revision, `detailId`, identity, and
    entry path and kind.
  - **Catalogue catcher:** `CatalogueBoundary` in
    `packages/viewer/src/shell/catalogue_boundary.tsx`, the React error
    boundary around the ready shell of the embedded and the standalone root.
  - **Data controller:** `ShellDataController` in
    `packages/viewer/src/shell/data_controller.ts`. It holds one shell root's
    installed index and accepted details outside React.
  - **Publication refresh:** `PublicationRefresh` in
    `packages/viewer/src/shell/data_refresh.ts`. It loads an updated Serve
    index and the details of the current route, then installs them.
- **Background:**
  - On 2026-11-03 the user chose to check the read model once, where it
    enters, with the core's Rust readers. The viewer keeps only the format
    version gates and the delivery fences, and it trusts the content.
    `docs/protocol/mokly-viewer.md`, section Package And Props, states it.
  - The same section requires this. A document of a supported version that
    the shell cannot render, an entry detail included, replaces the whole
    catalogue with its failure state and Try again. The embedded viewer emits
    one `onError` with `code: "catalogue"`. The error does not reach the
    host's React tree.
  - `docs/protocol/mokly-viewer-namespace.md`, section Version Gates, says
    that a malformed document of the supported version is not a version
    failure. It shows that error and retry state.
  - An agent design call of 2026-11-03 chose the catalogue catcher for this
    state. The namespace contract keeps a malformed document apart from a
    version failure, and a clean failure is better than a crash.
  - The embedded root wraps its ready shell in the catcher at
    `packages/viewer/src/viewer/component.tsx:162-178`. The standalone root
    of Serve and the static build does the same at
    `packages/viewer/src/standalone/shell.tsx:110-118`. React gives an error
    boundary the errors of rendering and of effects, not of a promise
    callback.
  - `readEntryDetail` at `packages/viewer/src/catalogue/detail_reader.ts:12-17`
    checks only `schemaVersion`, then returns `structuredClone(value)`. The
    delivery fence at `detail_fences.ts:54-85` does not read `views`.
  - The data controller's `#commit` at `data_controller.ts:243-254` sets the
    snapshot, calls `host.commit`, and signals a change. `useShellDataStore`
    at `packages/viewer/src/shell/data_store.ts:57` binds the controller to
    React. Its effect at `:100-103` requests the route's details again only
    when the route or the index changes.
  - `DetailLoader` at `packages/viewer/src/shell/data_detail_loader.ts:85-99`
    starts each load as `void loadFencedDetail(...).then(...)`, with no
    rejection handler. Line 93 removes the key from the loading set before
    line 98 calls `adopt`.
  - `#adopt` at `data_controller.ts:209-215` builds `withDetails(...)` or
    `withIndex(...)` as the argument of `#commit`. `withDetails` and
    `withHeldDetails` at `packages/viewer/src/shell/data_commit.ts:54-86`
    call `shellCatalogueModel`. That function merges every held detail into
    one working catalogue at `packages/viewer/src/catalogue/shell_model.ts:27-61`.
    `projectView` at `shell_model.ts:100` calls `detail?.views.find(...)`.
  - The publication refresh at `data_refresh.ts:64-83` calls `adopt` in a
    promise callback with no rejection handler. That `adopt` builds
    `withIndex(...)` at `data_controller.ts:82-83`.
  - `loadDetailPair` at `packages/viewer/src/shell/data_requests.ts:119-143`
    and `loadRefresh` at `:161-204` each put the transport call, the fence,
    and the route derivation in one `try`. Each catch turns every error
    except `MoklyVersionError` into `{ kind: "failed" }`.
    - A failed detail shows the entry's unavailable state with Try again. The
      embedded viewer reports one `onError` with code `catalogue` through
      `detailFailed` at `packages/viewer/src/viewer/ready.tsx:117`.
    - A failed refresh keeps the old catalogue and shows the refresh failure
      on its route.
    - The embedded `loadDetail` at
      `packages/viewer/src/viewer/index_source.ts:92-96` calls the host's
      `detail` callback. A host callback that throws or rejects is a
      transport failure today. `docs/protocol/mokly-viewer-selection.md` says
      that user callback exceptions are not reclassified as viewer errors.
  - On `origin/main` at `f08d02df`, `readEntryDetail` read `views` through
    `array(...)` at `packages/viewer/src/catalogue/detail_reader.ts:83`. It
    threw for null inside the `try` of `loadDetailPair`, so the entry showed
    its unavailable state. The loader, the controller, and `shell_model.ts`
    did not change. The reader now passes the malformed field.
- **Problem:** A version 4 detail with matching fences and `views: null`
  passes the reader and the fence. `withDetails` then throws a `TypeError` at
  `detail.views.find` inside the promise callback, before `#commit` runs. The
  catalogue catcher never sees the error, and no handler catches the
  rejected promise.
  - After the throw, the detail's key is not held, not failed, and not
    loading. `data_requests.ts:253-256` then gives the route the `loading`
    delivery, and no listener runs.
  - A refreshed Serve index that the projection cannot render throws in the
    same way in the refresh callback. The old catalogue stays, with no
    failure state.
  - The transport catches hide two more cases. A detail whose `identity` or
    `entry` is null throws in the fence at `detail_fences.ts:106` or `:110`,
    and the entry shows its unavailable state. A refreshed index whose
    `screens` is null throws in `routeDetailRequests` at
    `data_requests.ts:55` on a target route, when `currentEntry` spreads
    `index.screens` at `detail_fences.ts:93`. The route then shows the
    refresh failure. Neither shows the catalogue failure state.
  - No test covers these paths.
    `tests/browser/viewer_catalogue_failure.spec.ts:28-32` corrupts only the
    first index. `packages/viewer/tests/data_controller*.test.ts` reject
    details only with transport errors.
  - The trace is static. No run reproduced it.
- **Impact if no action:** The stage, Props, and Usage of the routed entry
  keep loading with no Try again. The embedded host gets no `onError`, and
  its page gets an unhandled promise rejection. A malformed refreshed index
  keeps the old Serve catalogue with no failure state.
- **Root question:** How can every catalogue document that the viewer cannot
  use reach the existing catalogue failure state?
- **Options:**
  - **A.** Catch projection failures at each asynchronous adoption call, and
    call a catalogue failure callback that the root supplies. Add a
    regression with a matching detail whose `views` is null. Each new
    adoption path must then forward its failures. Effort: Small.
  - **B.** Store the accepted index and details without a projection in
    promise callbacks. Build the working catalogue and rebind its route
    during React rendering, so the catcher owns projection failures. It
    changes the controller and store responsibilities. It must also move the
    route, disclosure, and filter rebinding of `shellStateWithCatalogue` at
    `data_commit.ts:124-149` into rendering. The first review graded it
    Medium. Effort: Large.
  - **C.** Give the data controller one shared projection method and an
    explicit failure state. Capture only viewer-owned projection failures
    there. Notify React, then rethrow that failure from `useShellDataStore`
    during rendering. Detail adoption and the publication refresh use the
    same method. Keep the handling of host callback exceptions. Add the
    detail regression, and check Try again. Content failures that the fence
    or the route derivation finds stay entry or refresh failures.
    Effort: Medium.
  - **D.** Make the transport calls the only place that turns an error into
    an entry or refresh failure. Effort: Medium.
    - Narrow the catches of `loadDetailPair` and `loadRefresh` to the
      `source.loadDetail` and `source.loadIndex` calls. Transport errors stay
      entry or refresh failures. `MoklyVersionError` stays a version failure.
    - Send each error that a fence, a route derivation, or an adoption throws
      on a loaded document into one controller failure state. Notify React.
      `useShellDataStore` rethrows that failure during rendering, so the
      catcher shows the failure state with Try again. The embedded viewer
      then emits one `onError` with code `catalogue`.
    - Keep the handling of host callback exceptions, such as a host `detail`
      callback that throws.
    - Add regressions for a matching detail whose `views` is null and for a
      detail whose `identity` is null. Check one `onError`, and check that
      Try again installs the catalogue.
    - Cost: a detail that the fence cannot read moves from the entry failure
      to the catalogue failure state. A malformed refreshed index on a target
      route moves from the refresh failure to that state. The protocol
      requires both moves.
    - Risk: a transport call outside the narrowed catch would show a fetch
      failure as a catalogue failure. The new cases catch the obvious one.
- **Left out:**
  - Restore content checks in the reader: it breaks the user's choice of
    2026-11-03 that the viewer checks no content.
  - Catch and ignore the rejected promise: the entry keeps loading, so it
    fails the goal.
  - Turn every projection failure into an entry failure: it breaks the
    requirement for a malformed entry detail. One malformed detail would show
    the entry state when the adoption finds it, and the catalogue state when
    rendering finds it.
  - A catcher around one entry: the projection merges every held detail into
    one model, so a catcher around one entry cannot contain the failure.
  - A listener for the window's `unhandledrejection` event: the window
    belongs to the host, several viewers can share it, and the listener also
    gets host rejections.
  - A check only at the receiver or the producer: Serve, the static build,
    and a host `detail` callback reach the viewer without a receiver. The
    user's choice of 2026-11-03 also removed the core's checks of its own
    output.
- **Wider fix:** D. It covers a content failure wherever the first read
  happens: the projection, the fence, or the route derivation. C must know
  that the failure comes from the projection.
- **Previous examples:** No earlier catalogue adoption example was found in
  the `origin/main` history or the plans. On `origin/main` at `f08d02df`,
  `packages/viewer/src/viewer/component.tsx:54-74` and `:136` keep an
  asynchronous host bridge failure in state and throw it during rendering.
  That is a precedent for the render-time rethrow, not a reason to treat a
  catalogue failure as a host failure.
- **Related:** [host-content-cleanup-errors.md](./host-content-cleanup-errors.md),
  same code: both items change which errors reach `CatalogueBoundary`. That
  item keeps host errors away from the catcher, and this item sends
  catalogue errors of asynchronous loads to it. The options do not conflict.
  Option B there moves host content above the catcher and keeps the shell
  store below it, so the render-time rethrow of C or D still reaches the
  catcher. One later branch can take both items.
- **Recommendation:** D. It uses one controller failure state for every
  loaded-document failure, at about the cost of C, through the same
  render-time path. The first review recommended C, which leaves the content
  failures that the transport catches turn into entry or refresh failures.
- **Action:** fix after merge, apply D, because this Medium and Rare defect
  needs malformed content of the supported version, and its fix does not get
  much harder after the merge.
- **Done when:**
  - In both roots, a matching detail whose `views` or `identity` is null
    shows the whole catalogue failure state with Try again. The embedded
    viewer emits exactly one `onError` with code `catalogue`, and no
    unhandled promise rejection reaches the host page.
  - A refreshed Serve index that the shell cannot render shows the same
    state.
  - A transport error still shows the entry or refresh failure. A version
    failure still shows the version headline. A value that host code throws
    still reaches the host unchanged.
  - Try again installs the catalogue when the source then serves good
    documents.
  - The status lines of `docs/protocol/mokly-viewer.md`,
    `docs/protocol/mokly-viewer-namespace.md`, `packages/viewer/README.md`,
    and `packages/viewer/src/shell/README.md` drop the clause that links this
    item, and they keep the clauses of other items. The branch deletes this
    item.
