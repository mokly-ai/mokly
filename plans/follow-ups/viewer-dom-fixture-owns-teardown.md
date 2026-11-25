# One viewer DOM fixture owns setup and teardown

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from branch
  `calummoore/ci-speed-fix-mokly-js-flaky-tests-3h72`, review finding 1,
  the wider fix that the branch split off.
- **Location:** `packages/viewer/tests/dom_teardown.ts`, and each viewer
  test file that calls `GlobalRegistrator.register` from
  `@happy-dom/global-registrator`: about 24 files under
  `packages/viewer/tests/`, among them `canvas_frame_fixture.tsx`,
  `refresh_shell_fixture.tsx`, `appearance_fixture.ts`,
  `removed_preview_detail.test.tsx`, and `comparison_row_documents.test.tsx`.
- **Reason:** The fixture changes the window setup of every viewer test
  that uses happy-dom, so it needs its own change and review.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **happy-dom window:** the `window` and `document` globals that
    `GlobalRegistrator.register()` puts on `globalThis` for a Node test.
  - **`unregisterDom`:** the helper in
    `packages/viewer/tests/dom_teardown.ts`. It queues an idle-priority task
    on React DOM's own `scheduler` copy and removes the window only after
    that task runs, so React's queued tasks run while `window` exists.
- **Background:**
  - React DOM queues the passive effects of a commit outside `act` as a
    task on its scheduler. An unmount runs those effects, but the queued
    task stays. The task reads `window.event` when it runs.
  - Before 2026-11-25, the viewer tests removed the window with
    `GlobalRegistrator.unregister()`. The test "a Dark frame that shows its
    Light view names its own frame in its panes' titles" in
    `packages/viewer/tests/comparison_pane_titles.test.tsx` then failed in
    CI five times from 2026-11-24 to 2026-11-25 with
    `ReferenceError: window is not defined` at
    `react-dom-client.development.js:17920`, called from
    `performWorkUntilDeadline` of `scheduler.development.js`.
  - Under CPU load the test passed 85 of 100 runs before the fix and 100 of
    100 runs after it.
  - Each viewer test now registers the window itself, with its own URL and
    settings, and removes it with `unregisterDom`. The rule is in
    `packages/viewer/README.md`, next to the test commands.
- **Problem:** Registration and teardown are two separate calls in each
  file. A new test can register a window and remove it with
  `GlobalRegistrator.unregister()`, and the race comes back.
- **Impact if no action:** A new viewer test that copies the direct call
  can fail now and then with `window is not defined`.
- **Root question:** How can every viewer test that installs a happy-dom
  window get the safe teardown without a second call to remember?
- **Options:**
  - **A.** Keep the README rule and `unregisterDom` as they are. A reviewer
    catches a direct call. Effort: Small.
  - **B.** Add one viewer fixture that registers the window with the
    caller's URL and settings, takes an optional cleanup that runs first,
    and removes the window with `unregisterDom` in `t.after`. Move every
    registration to it, and keep `unregisterDom` private to it. Effort:
    Medium.
  - **C.** Do A, and add a `no-restricted-syntax` entry in
    `eslint.config.js` for `packages/viewer/tests/**` that rejects
    `GlobalRegistrator.unregister` outside `dom_teardown.ts`, with a lint
    test like the other `tests/*_lint.test.ts` files. It is a new lint, so
    the user must approve it. It does not catch an aliased call. Effort:
    Small.
  - **D.** Register one window per test process and never remove it, as
    `packages/ui/tests/dom.ts` does. Reset the URL and the document between
    tests. This removes the teardown step. Many viewer tests register their
    own URL and settings, so state can leak between tests of one file.
    Effort: Large.
- **Left out:** A retry, a sleep, or a longer wait, because the flaky-test
  rule of the `testing` skill forbids them.
- **Wider fix:** B. The fixture makes the safe teardown part of the
  registration.
- **Previous examples:** The comparison pane titles failure above. The
  shared fixtures under `tests/` follow a similar rule:
  `scripts/eslint/no-late-fixture-teardown.mjs` enforces their
  `beforeRemove()` teardown.
- **Recommendation:** B. It removes the second call. C is a cheap guard if
  the user approves a new lint.
- **Action:** fix after merge, apply B, because it changes the window setup
  of every viewer test that uses happy-dom.
