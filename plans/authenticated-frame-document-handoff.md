# Authenticated Frame Document Handoff

Close the medium review finding recorded against Milestones 13 and 14 of the
[React Browse Shell plan](./react-browse-shell.md#review-record): the
same-origin adapter installs its provisional navigation receiver on any
accessible current iframe document before that document passes the expected
resource check. This plan makes the receiver attach only to a document the
adapter has already authenticated, adds the adversarial regressions, and aligns
the protocol docs, without reopening the native-navigation gap that Milestones
13 and 14 closed.

## Problem

`mountLocalDocument` in
[`same_origin_mount.ts`](../packages/viewer/src/client/same_origin_mount.ts)
authenticates documents in two places: the replacement watcher
(`inspectReplacementDocument`, lines 81–95) and the iframe `load` handler
(lines 143–160) both require `sameFrameResource(doc.URL, url)` before adopting
a document. The mount start does not. Lines 252–255 read the frame's current
`contentDocument` and, if its `frameElement` is this frame, install the
logical-link receiver on it unconditionally, before `location.replace` starts
the assigned resource. Any same-origin document that is currently displayed in
the frame therefore gains parent-navigation privilege for the replacement
window, even when no mount ever authenticated it.

The sandbox is exactly `allow-same-origin`, so consumer scripts never run, but
an ordinary consumer-authored relative link with the default target navigates
the frame itself. The sequence that exploits the gap is:

1. The shell mounts document A and authenticates it.
2. A raw relative link in A navigates the frame to a same-origin document U
   that no mount requested. The `load` handler ignores U because the React
   `src` attribute still names A (`assignedFrameResource`), so the session
   keeps its receiver on the unloaded A and U keeps portable native links.
   This is the documented safe degradation.
3. Any replacement mount on that frame (viewport, scheme, variant, fragment or
   route handoff) disposes the prior owner through `ownFrame`, then adopts U as
   the still-visible document. A marker in U now emits a `navigation` event
   and moves the parent shell until the replacement document authenticates.

The [frame-adapter contract](../docs/protocol/mokly-frame-adapter.md#same-origin-implementation)
promises that unsupported and unowned documents gain no privilege, and the
[navigation contract](../docs/protocol/mokly-navigation.md#enhanced-navigation-and-safe-degradation)
says the receiver is installed on the still-visible document. Neither states
that the still-visible document must be one the adapter authenticated, so the
docs currently describe the unsafe behaviour as intended.

## Decisions

1. **Option A: transfer only the exact previously authenticated document
   identity.** A replacement mount adopts the current document only when it is
   the same `Document` object that a previous same-origin mount of the same
   frame authenticated. Object identity is the right key: with scripts disabled
   nothing inside the frame can call `history.replaceState` or `document.open`,
   so a `Document` never changes its resource identity, and every navigation
   commits a new `Document`. URL equality would be weaker (an unowned document
   at a trusted path) and hash changes are already non-identity.
2. **Option B (do not intercept until the new document authenticates) is
   rejected.** It reopens the native-navigation gap during every handoff that
   Milestones 13 and 14 closed, and the existing regressions
   ("logical activation stays host-owned during a frame source handoff" in
   [`browse_navigation.spec.ts`](../tests/browser/browse_navigation.spec.ts)
   and
   [`browse_navigation_hydration_handoff.spec.ts`](../tests/browser/browse_navigation_hydration_handoff.spec.ts))
   must keep passing unchanged. They are the proof that continuity survives.
3. **An initial document is accepted only when it is the requested resource.**
   The first same-origin mount of a frame has no prior adapter owner, so it may
   adopt its SSR-loaded document through the watcher's immediate resource
   check. Later mounts remember that the frame has already been mounted and
   exclude their exact pre-replacement `Document` from resource
   authentication unless identity transfer succeeds. This explicit
   initial-mount rule keeps hydration while preventing an unowned document at
   the next requested URL from impersonating the replacement. `about:blank`
   is never adopted.
4. **One authentication chokepoint with a branded type.** Every document the
   mount listens to must come from a new module that returns
   `AuthenticatedDocument` (a branded `Document`). Receiver installation and
   operation creation accept only that type, so a future call path cannot
   adopt a raw `Document` without going through authentication. This prevents
   the class of bug rather than patching one call site.
5. **Assigned-resource authentication and identity transfer stay distinct.**
   The `load` handler and watcher authenticate against the requested resource
   only; they never accept a transferred document, because a previously
   authenticated document can still fire the frame's `load` event during a
   replacement and must not resolve a mount for a different resource. The
   mount start uses identity transfer only.
6. **No server, export, mockup or visual change.** The Browse document adapter
   already strips markers from unowned `/static/` HTML; that boundary is not
   the one under repair, and the regressions must not depend on it. The
   adversarial fixture serves its own unowned same-origin document with a valid
   marker.

## Non-Goals

- The `load` handler's ignore branch (`assignedFrameResource`) keeps its
  current behaviour. After this change a stale receiver on an unloaded
  document is inert, and reworking session state for resolved mounts is a
  separate concern.
- The cross-origin `postMessageAdapter` never reads `contentDocument` and is
  unaffected. Any mount that is not same-origin records no identity, so a
  same-origin mount after a cross-origin one starts without a transfer.

## Milestone 1: Protocol And Documentation Contract

Summary: state the authenticated-handoff rule in the specs and package docs so
the implementation has a complete contract, and record the plan.

- [x] Rewrite the same-origin replacement paragraph in
      [`mokly-frame-adapter.md`](../docs/protocol/mokly-frame-adapter.md#same-origin-implementation):
      before changing `location` the adapter attaches its mount-time receiver
      only to the exact `Document` a previous same-origin mount of that frame
      authenticated; a document that no mount authenticated, including content
      the frame navigated to itself, keeps portable native links until the
      replacement document authenticates. Explain why object identity is the
      key and that resource authentication in the watcher and `load` handler
      never accepts a transferred document.
- [x] Add the adversarial unowned-document case to the protocol's
      `## Acceptance` section beside the retained same-origin tests.
- [x] Qualify the "still-visible document" sentence in
      [`mokly-navigation.md`](../docs/protocol/mokly-navigation.md#enhanced-navigation-and-safe-degradation):
      ownership is continuous across a handoff only for the authenticated
      still-visible document; a document the session did not authenticate is
      frame-owned until the replacement authenticates.
- [x] Update the `FrameMount.onEvent` paragraph in
      [`packages/viewer/README.md`](../packages/viewer/README.md) and the
      adapter paragraph in
      [`packages/viewer/src/client/README.md`](../packages/viewer/src/client/README.md)
      to describe the identity transfer and name the new module.
- [x] Add this plan to the active list in [`plans/README.md`](./README.md)
      and note in the React Browse Shell review record that the Milestone 13
      and 14 finding is tracked here.
- [x] Validate the changed Markdown with `npm run format:check` and review the
      diff; documentation-only work does not require `cargo xtask check`.
- [x] `git add -A`, commit with Conventional Commits, and push the branch.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

## Milestone 2: Authenticated Document Handoff

Tags: ui

Summary: prove the privilege leak with failing regressions, then gate adoption
behind a single authentication module while keeping every existing handoff
regression green.

- [x] Extend
      [`frame_adapter_fixture.ts`](../tests/browser/frame_adapter_fixture.ts)
      with `static/unowned.html`: a hand-written same-origin document served
      raw (only compilation outputs pass through `adaptBrowseDocument`) that
      carries an `<a>` with a syntactically valid `data-mokly-link="action"`
      marker and a portable `href` to `./silent.html`, plus a raw relative
      link in the fixture home body that navigates the frame to it.
- [x] Add a failing adapter-level browser regression (new
      `tests/browser/same_origin_identity.spec.ts`, keeping
      `same_origin_adapter.spec.ts` near its current length): mount the home
      document, click the raw link so the frame shows the unowned document,
      hold the home response with `page.route`, start a second
      `sameOriginAdapter().mount` on the same frame, then dispatch a cancelable
      click on the unowned marker through a bubble-phase probe listener
      installed after the mount started. The probe records
      `event.defaultPrevented` and then cancels native activation so the held
      replacement stays in flight. Assert `defaultPrevented` is `false` and no
      `navigation` event was emitted; release the response, await the mount,
      and assert a logical click in the authenticated replacement document
      still emits `navigation`.
- [x] Add a failing shell-level browser regression to
      [`browse_navigation_security.spec.ts`](../tests/browser/browse_navigation_security.spec.ts)
      using [`navigation_fixture.ts`](../tests/browser/navigation_fixture.ts):
      give Home a raw relative `./details.mobile.html` self-link and Details a
      `mock:extra` link, open home, follow the self-link inside the frame,
      hold `home.mobile.dark.html`, toggle the scheme, dispatch the same probe
      click on the details document's `mock:extra` link, and assert the outer
      URL stays on home with `defaultPrevented` false. Release the response and
      assert the frame reaches `ready` and a logical activation in it navigates
      the shell, proving continuity after authentication.
- [x] Confirm both new tests fail on the current implementation before the fix
      (record the assertion that fails in the plan's review record).
- [x] Create `packages/viewer/src/client/same_origin_identity.ts` owning:
      the branded `AuthenticatedDocument` type; a module-level
      `WeakSet<Document>` of authenticated documents (no retention, no
      clearing needed because a `Document` never changes identity);
      `authenticateAssignedDocument(frame, doc, expected)` which requires
      `doc.defaultView?.frameElement === frame` and `sameFrameResource`, then
      records and returns the branded document;
      `transferAuthenticatedDocument(frame, doc)` which returns the branded
      document only when it is already recorded for this frame; and the moved
      pure helpers `sameFrameResource`, `assignedFrameResource` and
      `normalizedHtmlPath`. Module and public items carry doc comments.
- [x] In `same_origin_mount.ts`, make `adoptActivationDocument` and `create`
      accept only `AuthenticatedDocument`; replace the unconditional adoption
      at mount start with `transferAuthenticatedDocument`; route the watcher
      and `load` handler through `authenticateAssignedDocument`; keep the
      `assignedFrameResource` ignore branch and every other behaviour
      unchanged. The file must shrink below its current 295 lines.
- [x] Add a node unit test `tests/same_origin_identity.test.ts` (imported from
      `packages/viewer/dist/client/same_origin_identity.js` like
      `post_message_adapter.test.ts`) covering resource identity rules
      (origin, userinfo, `.html` canonicalization, query, hash exclusion),
      structural-fake `frameElement` mismatch, transfer of a recorded document,
      and rejection of an unrecorded document at the same URL.
- [x] Run the viewer build and typecheck, the new unit test, the two new
      browser regressions, and the retained handoff regressions
      (`browse_navigation.spec.ts`, `browse_navigation_hydration_handoff.spec.ts`,
      `same_origin_adapter.spec.ts`, `frame_hook_lifecycle.spec.ts`,
      `viewer_replacement.spec.ts`) repeatedly enough to show they are
      deterministic; confirm `npm run package:check` accepts the new browser
      module in the generated inventory.
- [x] Run the complete `cargo xtask check` gate with no failures or skips.
- [x] After checks pass, `git add -A`, commit with Conventional Commits, and
      push the branch.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

## Milestone 3: Exact-Resource Starting Document Guard

Tags: ui

Summary: close the review-discovered same-object bypass without regressing
first hydration or authenticated handoff continuity.

- [x] Amend the frame-adapter and navigation protocols plus both viewer
      READMEs to define weak frame/mount provenance: the first same-origin
      mount may authenticate a matching SSR document, but a later mount must
      exclude its exact unrecorded pre-replacement `Document` from both watcher
      and `load` authentication even when its URL equals the new assignment.
- [x] Add adapter- and shell-level browser regressions that first navigate the
      frame natively to the exact resource the next mount will request, hold
      that replacement, and prove the unowned starting document keeps native
      activation until a different replacement `Document` authenticates.
- [x] Run both exact-resource regressions against the current implementation,
      confirm they fail at the `defaultPrevented` assertion, and record the
      failures in this plan's review record before changing production code.
- [x] Extend `same_origin_identity.ts` with weak frame provenance and a
      mount-scoped authentication capability. Preserve matching-document
      authentication for the first mount and authenticated identity transfer
      for later mounts, while rejecting the exact unrecorded starting object
      from every assigned-resource authentication path.
- [x] Route the replacement watcher and iframe `load` handler in
      `same_origin_mount.ts` through the mount-scoped capability, keeping the
      authenticated-document brand as the only receiver/operations input.
- [x] Extend the Node identity tests to cover first-mount hydration, an
      authenticated later handoff, rejection of an exact-URL unrecorded
      starting document, and authentication of the different replacement
      object at that same URL.
- [x] Run the viewer build and typecheck, the identity unit test, both new
      exact-resource browser regressions, and the retained handoff/security
      browser matrix repeatedly enough to show deterministic behavior; confirm
      the package inventory remains valid.
- [x] Run the complete `cargo xtask check` gate with no failures or skips.
- [x] After checks pass, `git add -A`, commit with Conventional Commits, and
      push the branch.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

## Milestone 4: Browser CI Synchronization

Tags: ui

Summary: remove timing-dependent waits exposed by the hosted Chromium shards
without weakening the navigation or handoff assertions.

- [x] Inspect the failed Node 22 trace and both shard-1 logs. Confirm that the
      hydration test deadlocks by waiting for the full page load while holding
      a load-blocking image request, and that the design-link test activates
      `Open Welcome` in the prior document before the preceding parent route
      and iframe replacement complete.
- [x] Make the initial-hydration test wait only for the outer document's DOM
      content before awaiting its deliberately held image request, preserving
      the assertion that navigation stays host-owned while the frame is still
      loading.
- [x] Make the published-design-link test await both the parent route and the
      completed replacement frame before interacting with controls in that
      destination document, following the browser-test guidance in the root
      README.
- [x] Run the two affected browser specs repeatedly with the CI Chromium
      channel and run the relevant formatting, lint, and type checks.
- [x] Run the complete `cargo xtask check` gate with no failures or skips.
- [ ] After checks pass, `git add -A`, commit with Conventional Commits, and
      push the branch.
- [ ] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

## Post-merge follow-up (non-blocking)

- Publish the viewer version containing the handoff fix; hosts that embed
  `sameOriginAdapter` pick it up on their next dependency update, and exported
  catalogues redeploy to pick up the new browser inventory.
- Smoke the deployed preview: follow a raw in-frame link, toggle the colour
  scheme, and confirm a marked link in the stale document stays in-frame.

## Review record

Milestone 1 (`fb36328`) was reviewed with the implementation review prompt
after the documentation check and push. No findings remain. The residual risk
is limited to the implementation and adversarial regressions delivered by
Milestone 2; the reviewed contract itself is internally aligned.

Before the Milestone 2 fix, both new browser regressions failed at their
`defaultPrevented` assertion: the adapter-level and shell-level probes each
received `true` instead of `false`, proving that the provisional receiver had
intercepted the unowned document's marked activation.

Before the Milestone 3 fix, both exact-resource regressions reproduced the
review finding. The adapter probe's `prevented` field was `true` instead of
`false` at `same_origin_identity.spec.ts:197`, and the shell probe's
`defaultPrevented` value was `true` instead of `false` at
`browse_navigation_hydration_handoff.spec.ts:134`. This proves the immediate
watcher promoted the exact unrecorded starting `Document` before either held
replacement response was released.

Milestone 2 (`b27533f`) was reviewed with the implementation review prompt
after the full gate and push. One finding remains for user decision; it was not
applied automatically.

1. **Medium — the immediate watcher can authenticate an unowned starting
   document whose URL already equals the next assigned resource.**
   `same_origin_mount.ts:90-105` runs `inspectReplacementDocument`
   synchronously at mount start, before `location.replace` at lines 257-262.
   Although identity transfer rejects an unrecorded current object, that watcher
   immediately sends the same object through URL-based
   `authenticateAssignedDocument` and installs the receiver when its URL matches
   the new assignment. A read-only browser probe navigated the mobile frame to
   `home.mobile.dark.html`, held a replacement request for that same resource,
   toggled the scheme, and observed `defaultPrevented: true`. Doing nothing
   leaves the original trust-boundary finding exploitable whenever consumer
   navigation anticipates the next viewport, scheme, variant, fragment, or
   route resource; such a document can emit parent-shell navigation during the
   held handoff despite never being authenticated by its prior mount.
   - **A.** Extend the identity boundary with weak frame/mount provenance and
     exclude the exact pre-replacement `Document` from assigned-resource
     authentication on a previously mounted frame unless identity transfer
     succeeds. Preserve initial hydration through an explicit initial-mount
     rule, and add adapter- and shell-level regressions where the unowned URL is
     exactly the next assignment.
   - **B.** Remove synchronous pre-replacement watcher authentication and wait
     for `location.replace` to expose a different `Document` object on every
     mount, accepting a native-navigation gap during initial hydration.
   - **C.** Treat a matching URL as sufficient ownership and narrow the
     protocol promise, accepting that document identity is not the effective
     trust key.

   **Recommendation: A.** The broader frame-provenance invariant preserves the
   existing continuity goal while preventing the entire same-object bypass;
   the exact-path adversarial matrix would keep future watcher or load-handler
   changes from reintroducing it. Option B is secure but regresses the retained
   hydration behavior, while C abandons the approved trust boundary.

Milestone 3 (`631cfe5`) resolves finding 1 with weak per-frame mount
provenance and a mount-scoped authentication capability that excludes the exact
unrecorded starting `Document` from both watcher and `load` authentication.
The post-push implementation review of the complete diff against `origin/main`
found no remaining findings. Residual risk is limited to browser-engine timing
outside the tested Chromium matrix; the direct adapter and hydrated shell cases
cover both exact-URL and different-URL unowned documents, first hydration, and
authenticated replacement continuity.

Milestone 4 traced the hosted failures to two test-ordering defects. The
initial-hydration test waited for the full outer load while deliberately holding
a frame image that blocked that load. The published-design test clicked a link
in the previous iframe document before the preceding parent route and frame
replacement completed. Two focused Playwright Chromium runs each passed all
seven affected-spec tests after the synchronization changes. The complete
`cargo xtask check` gate then passed 2,005 unit/integration tests and 529 browser
tests with no failures, skips, cancellations, or missing inventory.
