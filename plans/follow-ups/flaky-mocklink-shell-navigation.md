# Flaky MockLink shell navigation

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-17, from the local complete gate of the branch `calummoore/mokly-mimalloc-global-allocator-i7qn` at `86dabdd3`, with its allocator change not yet committed.
- **Location:** `tests/browser/browse_navigation.spec.ts:49`, the test "MockLink navigation reveals the destination and preserves shell state", with its `load` wait at lines 55-57 and the failed assertion at line 77. The nested frame of the suspected source is at `tests/browser/navigation_fixture.ts:32`. The test "keyboard navigation retains constraints that already show the destination" starts at line 115 of the same spec, and it fails in `tests/browser/navigation_destination.ts:4`, called at line 126.
- **Reason:** The allocator branch changes only the memory allocator of the `mokly` binary and no browser, viewer, frame, or test code, and the test passed on its rerun.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Browse shell:** the catalogue web app at `/view/{path}/` that Serve and
    the static build deliver, with each screen in preview frames.
  - **MockLink:** the `@mokly/mokly` authoring component that renders a link
    with a portable `href` to the destination file and a `data-mokly-link`
    marker.
  - **Same-origin mount:** the step of the built-in `sameOriginAdapter` that
    takes ownership of one preview frame, in
    `packages/frame/src/adapters/same_origin_mount.ts`.
  - **Receiver:** the activation listener that a same-origin mount attaches
    to the frame document to turn a marked link activation into a shell
    navigation.
  - **Frame state:** the `data-mokly-frame-state` attribute of a preview
    frame, with values such as `loading`, `ready`, and `error`.
- **Background:**
  - The test starts at `tests/browser/browse_navigation.spec.ts:49`. It opens
    `/view/fixture/nested/home/`, chooses the Mobile viewport, and chooses the
    Dark appearance. The scheme change reloads the mobile frame with
    `index.mobile.dark.html`.
  - The helper `actAndWaitForFrameLoad`, at lines 26-47, waits only for the
    `load` event of the frame element. It does not wait for the frame state
    `ready`. The helper `navigateFrom` of the same spec waits for
    `data-mokly-frame-state="ready"` before its click, at lines 224-227.
  - The test then searches for `home`, chooses the Changes filter, and clicks
    `#mock-link` in the mobile frame, at lines 72-75. Lines 77-79 expect the
    shell URL to end with `/view/fixture/nested/details/?fragment=section`.
  - The keyboard test at line 115 opens the same Home screen, fills the
    search with `details`, focuses `#mock-link` in the mobile frame, and
    presses Enter, at lines 119-124. It waits for no frame state first. Its
    helper `expectDestination`, at `tests/browser/navigation_destination.ts:4`,
    expects the same Details URL.
  - The Home screen of the fixture, in `tests/browser/navigation_fixture.ts`,
    holds a nested frame with the source
    `https://cross-origin.example.test/nested.html`, at line 32. The `.test`
    top-level domain is reserved for testing and has no public DNS answer.
    The `load` event of a frame waits for the frames that it holds.
  - Three sibling specs fulfil that request locally with `page.route`:
    `tests/browser/browse_navigation_handoff.spec.ts:30`,
    `tests/browser/browse_navigation_ownership.spec.ts:23`, and
    `tests/browser/browse_navigation_security.spec.ts:21`.
    `browse_navigation.spec.ts` does not, so Chromium asks the DNS resolver
    of the machine.
  - `docs/protocol/mokly-frame-adapter.md:74-76` requires that a mount that
    gets no reply within 5,000 ms rejects with `timeout`. The same-origin
    mount sets this timer at
    `packages/frame/src/adapters/same_origin_mount.ts:143-146`, and the timer
    also disposes the mount. The `load` listener at line 206 clears the timer
    when it adopts the assigned document.
  - While the new document loads, the same-origin mount attaches its receiver
    to it, at lines 65-76 and 102-106. The `dispose` function, at lines
    112-123, removes the receiver and the `load` listener.
  - `docs/protocol/mokly-navigation.md:183-191` says that readiness gates
    inspection, not logical navigation. It also says that disposal removes
    the receiver, and that without a receiver the portable link stays
    frame-owned.
  - When a mount rejects, `packages/viewer/src/shell/frame_mount_hook.ts:151-157`
    sets the frame state `error`. The preview frame in
    `packages/ui/src/preview-frame/preview-frame.tsx` then shows "This preview
    could not be loaded."
  - `docs/protocol/ci-suite-evidence.md:64-68` records that a page that needs
    more than five seconds to load, for example under CPU load, fails in the
    browser suite although it loads correctly alone.
- **Problem:**
  - The same test failed in the local complete gate on 2026-11-17 at
    `2ecc62e95`. This run passed 2,459 Rust tests and 3,021 viewer tests.
    The browser suite passed 2,285 tests and failed two, with no skips.
    This failure occurred at the frame-load helper at line 41, called from
    line 55. The assertion expected `data-test-load-state="complete"` and
    received `"pending"` after 15,000 ms. The iframe entered `error`.
    The trace records `net::ERR_NAME_NOT_RESOLVED` for
    `https://cross-origin.example.test/nested.html` and two aborted requests.
    Same-origin Home requests completed with HTTP 200 in about 10–22 ms.
    One selected rerun against the same build passed one test, with no
    failures or skips. Its test time was 2.0 seconds. No test, assertion,
    timeout, or retry changed. The suspected source remains nested DNS
    delaying frame readiness beyond the mount deadline.
  - Failure: the test failed once in the local complete gate,
    `cargo xtask check`, on 2026-11-17. The run used Node 24.22.1, Chrome 151,
    and one Playwright worker. The gate passed the repository suite and all
    3,020 Node tests. The browser suite ran 2,287 tests: 2,286 passed, 1
    failed, and none skipped.
  - Failure text:

    ```text
    ✖ chromium › browse_navigation.spec.ts › MockLink navigation reveals the destination and preserves shell state
    Error: expect(page).toHaveURL(expected) failed

    Expected pattern: /\/view\/fixture\/nested\/details\/\?fragment=section$/
    Received string:  "http://127.0.0.1:39631/view/fixture/nested/home/"
    Timeout: 10000ms

    Call log:
      - Expect "toHaveURL" with timeout 10000ms
        23 × unexpected value "http://127.0.0.1:39631/view/fixture/nested/home/"

        at /home/user/code/mokly/tests/browser/browse_navigation.spec.ts:77:22
    ```

  - The browser suite then failed its report check with
    `report process outcome is not a successful zero exit`. The gate reported
    that `npm run test:browser:prepared` failed with status 1.
  - Rerun outcome: a filtered rerun of this one test against the same build
    passed. Its output was
    `✓ 1 [chromium] › tests/browser/browse_navigation.spec.ts:49:1 › MockLink navigation reveals the destination and preserves shell state (1.6s)`
    and `1 passed (39.8s)`. The failed attempt took 17.7 s.
  - The Playwright trace of the failed attempt gives these facts. Times count
    from the end of the scheme change.
    - Every same-origin request of the page finished within 52 ms.
    - The nested frame requests for
      `https://cross-origin.example.test/nested.html` from the dark Home
      documents failed with `net::ERR_NAME_NOT_RESOLVED`. The trace records
      no end time for them.
    - The `load` wait at lines 55-57 took 5.6 s.
    - Between +4.6 s and +5.1 s, the frame state changed from `loading` to
      `error`. The `load` event had not fired at +5.1 s. It fired before
      +5.6 s.
    - The click on `#mock-link` ran at +6.2 s. The link was
      `<a id="mock-link" href="../details/index.mobile.dark.html#section" data-mokly-link="fixture/nested/details#section">`.
      The frame itself then loaded
      `/static/mokly-generated/fixture/nested/details/index.mobile.dark.html#section`.
    - The shell URL stayed `/view/fixture/nested/home/` for the 10 s of the
      assertion. The page snapshot at the failure shows the heading Home, the
      search text `home`, the Changes filter pressed, a disabled Highlight
      components button, and the status "This preview could not be loaded."
  - Suspected source: frame readiness during the appearance reload, with DNS
    timing as its trigger. A slow DNS answer for the reserved host can hold
    the `load` event of the dark Home document past the 5,000 ms mount
    deadline. The mount then rejects with `timeout` and removes its receiver,
    as the contract requires. The test waits only for the `load` event, so it
    clicks a frame that the shell no longer owns. The portable `href` then
    navigates the frame, not the shell.
  - Not proven: nobody reproduced the failure. The trace gives no frame error
    code and no end time for the DNS failure. By a read of the code, only the
    5,000 ms timer can reject the mount at that time, before the `load`
    event. CPU load from other work on the machine can also delay the `load`
    event. The trace does not rule out a receiver that the shell lost while
    the mount was still live.
  - Second occurrence, 2026-11-17: the local complete gate of the branch
    `calummoore/mokly-keep-base-side-in-memory-2-hjj4` at `134244c52` ran
    2,287 browser tests. 2,285 passed, 2 failed, and none skipped. Both
    failures were in this spec.
    - The MockLink test failed at line 77 after 16.3 s. The shell URL stayed
      `http://127.0.0.1:42721/view/fixture/nested/home/` for the 10,000 ms of
      the assertion, with 24 unexpected values. Its snapshot shows Home, the
      search text `home`, the Changes filter, Mobile, Dark, a disabled
      Highlight button, and "This preview could not be loaded."
    - The keyboard test failed in `navigation_destination.ts:4`, called at
      line 126, after 10.6 s. The shell URL stayed
      `http://127.0.0.1:43017/view/fixture/nested/home/`, with 24 unexpected
      values. Its snapshot shows Home, the search text `details`, All, and
      Both, and no preview error. So the two snapshots alone do not prove
      that both tests lost their receiver in the same way.
    - The keyboard trace records two requests to
      `https://cross-origin.example.test/nested.html`, with the status and
      the total time `-1`. This gives no exact DNS completion time.
    - That branch changes no code under `packages/frame`, `packages/viewer`,
      or `packages/mokly`, and neither this spec nor its fixtures. It changes
      Rust Serve delivery and comparison code. The fixture starts
      `serve --no-watch` and creates no Git repository. A read-only check did
      not prove that the Rust change has no indirect effect.
    - Rerun outcome: one unchanged run of both tests at `134244c52` passed 2
      of 2, with no failure and no skip, and exit status 0. Playwright
      reported `2 passed (46.2s)`, setup included. The MockLink test took
      1.5 s, and the keyboard test took 628 ms.
- **Impact if no action:** The browser suite can fail at random on a correct
  change, in the complete gate and in CI. Each failure costs a rerun of the
  browser suite, which took about 49 minutes in this run. A real frame
  ownership defect can hide behind a flake label.
- **Root question:** How does the test make sure that the shell owns the
  reloaded mobile frame when it clicks the MockLink, so that a correct shell
  always passes?
- **Options:**
  - **A.** Reproduce the failure and confirm the source first. For example,
    hold the nested cross-origin request with `page.route` until the frame
    state turns `error`, then release it. Then fulfil that request locally in
    a `beforeEach` of `tests/browser/browse_navigation.spec.ts`, as the three
    sibling specs do. After the scheme change, also wait for
    `data-mokly-frame-state="ready"` on the mobile frame before the click, as
    `navigateFrom` does. Keep every assertion. Effort: Small.
  - **B.** A, and move the route into one helper beside
    `startNavigationFixture` in `tests/browser/navigation_fixture.ts`. Every
    spec that loads this Home screen calls it, with its own response body
    where it needs one. This also changes the specs that fulfil the request
    today. Effort: Small.
  - **C.** Change the product so that a same-origin mount keeps host-owned
    navigation of its authenticated document after the deadline, or so that
    the deadline does not wait for nested frames. This changes the
    requirements at `docs/protocol/mokly-frame-adapter.md:74-76` and
    `docs/protocol/mokly-navigation.md:183-191`. It also stops a slow but
    working page from showing "This preview could not be loaded." Effort:
    Medium.
  - **D.** If the reproduction shows a receiver lost while the mount is still
    live, treat it as a product bug. Add a failing browser test first, then
    fix the frame ownership code in
    `packages/frame/src/adapters/same_origin_mount.ts`. Effort: Medium.
- **Left out:**
  - A retry, a sleep, a longer expect or mount time limit, a skip, or a
    quarantine. The `testing` skill forbids them, because they hide the
    source.
  - Removing the nested cross-origin frame from the fixture. The ownership
    spec fulfils it with marked links to check nested frames, so the change
    would drop that coverage.
  - Change nothing until the test fails again. It fails the goal, because the
    test keeps its dependency on DNS timing.
- **Wider fix:** None. The deterministic-tests rules of the `testing` skill
  already supply the wider process rule: a flaky test gets a named source and
  an explicit readiness signal, and never a retry, a sleep, a skip, or a
  longer time limit. B only shares one route among the specs of this fixture.
- **Previous examples:**
  - The same-origin handoff test, in
    [flaky-same-origin-handoff.md at its last commit](https://github.com/mokly-ai/mokly/blob/c7e7d9b88efc84152eb33539ed8ed7ca2ad2bb93/plans/follow-ups/flaky-same-origin-handoff.md).
    Its confirmed source: the preparation poll accepted the committed URL
    while the document still loaded. The fix of 2026-11-01 also waits for a
    complete document and its action link.
  - `docs/protocol/ci-suite-evidence.md:64-68` names the five-second preview
    deadline as a known cause of browser failures under CPU load.
- **Recommendation:** Start with the investigation in A, in a separate branch.
  Confirm the source before selecting a test or product fix.
  Keep every assertion and the current requirements during that investigation.
- **Action:** fix after merge, investigate A first, because the allocator diff
  changes no navigation code or test. The investigation authorizes no product
  requirement change. Bring any later requirement choice to the user.
- **Owner, 2026-11-17:** the branch
  `calummoore/mokly-flaky-mocklink-navigation-test-meoa` owns the fix. The
  performance orchestrator confirmed that both failures of the second
  occurrence match this item. A held-request reproduction on that branch
  passed 0 of 3 attempts before its fix and 10 of 10 after it. This
  reproduction is newer than the "Not proven" note under **Problem**. The
  complete gate of that branch is running.
