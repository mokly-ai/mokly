# Viewer readiness spec races a hover after navigation

- **Severity:** Low. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from the `browser` suite run on the branch
  `calummoore/live-channel-foundation-implementation-n1hi` (the live channel
  foundation), which does not change `tests/`, `packages/viewer`,
  `packages/frame`, `packages/ui`, `packages/mokly`, or a `mokly-*` crate.
- **Location:** `tests/browser/viewer_readiness.spec.ts:60-90`.
- **Reason:** The flake is in a Mokly browser spec that the failing branch
  does not touch, so one fix in its own branch reaches every open branch.

- **Source:** Implementation.
- **Category:** Flaky test.
- **Terms:**
  - **Sibling frame:** the desktop canvas frame of the screen `home`. The
    spec marks its view usage `pending` or `unavailable`, so the viewer must
    not inspect it on hover or click.
  - **Harness events:** the list `window.viewerHarness.get("one").events`
    that the viewer test host fills from the viewer's callbacks, such as
    `navigate`, `hover`, `click`, and `error`.
- **Background:**
  - Each of the four tests (same-origin or `postMessage`, `pending` or
    `unavailable`) highlights an instance in the mobile frame, clears the
    events, then hovers and clicks the button "Visible" in the sibling frame,
    and clicks the link "Open Action". It waits until the events hold one
    `navigate` to `action`. Then it asserts that the events hold no `error`,
    `hover`, or `click` (line 90).
  - The failure text, at line 90:
    `expect(received).toEqual(expected)`, expected `[]`, received one event
    with the name `hover`. Its value has `boxes: []`,
    `frame: { entryPath: "action" }`, and `instance: null`.
  - Rerun outcome, all on commit `68ce1a8b6` on 2026-11-25: one complete
    gate run passed all four tests. The next complete gate run failed three
    of them. Three runs of
    `npm run test:browser -- tests/browser/viewer_readiness.spec.ts` then
    failed three, passed four, and failed one. The test "same-origin pending
    sibling keeps navigation without automatic inspection" passed in every
    run.
- **Problem:** Suspected source: the link click navigates the canvas to the
  screen `action`, and the mouse pointer stays over the canvas. The new
  `action` frame then reports the pointer as a `hover` with no boxes. That
  event sometimes arrives after the `navigate` event and before the read at
  line 83, so the assertion sees it. The hover belongs to the new screen,
  not to the sibling frame that the test guards.
- **Impact if no action:** The `browser` suite fails now and then with no
  cause in the change under test, and each failure costs a complete gate
  rerun of about two hours on a workspace computer.
- **Root question:** How does the spec check that the sibling frame sends no
  inspection event, without counting events from the screen that the
  navigation opens?
- **Options:**
  - **A.** Filter the asserted `hover` and `click` events to the sibling
    frame, `entryPath` `home` with the desktop viewport. Effort: Small.
  - **B.** Assert the absence of `hover`, `click`, and `error` before the
    link click, after the hover and the click on "Visible". Then assert only
    the `navigate` event after the link click. Effort: Small.
- **Left out:** A retry, a sleep, or a longer wait, because the testing
  rules forbid them for a flaky test. Moving the mouse away before the read,
  because it hides the event instead of scoping the assertion.
- **Wider fix:** Not checked. Other browser specs that click a link and then
  assert the absence of `hover` events can have the same race.
- **Previous examples:** None found.
- **Recommendation:** B. It checks the guarded frame at the moment of its
  hover and click, and it does not depend on events after the navigation.
- **Action:** fix after merge.
