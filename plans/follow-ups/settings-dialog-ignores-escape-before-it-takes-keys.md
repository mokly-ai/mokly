# Settings dialog ignores Escape before it takes keys

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-26, from branch
  `calummoore/flaky-app-settings-escape-before-dialog-8plh`, which fixed the
  flaky browser spec `Close returns to the page beneath from any address`
  with a test-side wait, and from review finding 1 of that branch.
- **Location:** `packages/app/src/settings/surface.tsx:147` to line 162,
  `docs/protocol/cloud/settings-dialog.md:62`, and `WebModalFrame` in the
  `@firna/ui` package, whose source is `src/modal/WebModalFrame.web.tsx` in
  the `Firna-AI/ui` repository.
- **Reason:** Each option either narrows a protocol requirement or adds a
  second Escape path or a change in another repository, and the options have
  real trade-offs, so the user chooses.

- **Source:** Implementation.
- **Category:** Product bug.
- **Terms:**
  - **Settings dialog:** the modal dialog of the Expo app that shows the
    settings panes. The `settings` query parameter of the address opens it.
  - **`WebModalFrame`:** the `@firna/ui` modal frame that the settings
    dialog uses for its portal, focus trap, inert page, Escape, and
    backdrop.
  - **Escape-layer stack:** the `@firna/ui` module `escapeLayer`. One
    document-level capture listener sends Escape to the most recent open
    overlay that registered a layer. The package does not export it.
  - **Passive effect:** a React `useEffect` callback. React runs it after
    the commit, in the same task when the render was short, and in a later
    task when the scheduler yields.
- **Background:**
  - `WebModalFrame` moves focus into the dialog and registers its Escape
    layer in two passive effects of one component. React runs both in one
    step, after the dialog is in the document.
  - `SettingsDialog` in `packages/app/src/settings/surface.tsx` is the
    parent of the frame. Its own passive effect moves focus onto the rail
    link of the chosen pane, in the same step, after the frame's effects.
  - `docs/protocol/cloud/settings-dialog.md` says: "Focus moves into the
    dialog on open" and "Escape closes unless a form is dirty". It gives no
    exception for the moment before the dialog takes focus.
  - The browser specs now wait for that focus before they press a key,
    through `expectDialogTakesKeys` in
    `packages/app/src/_tests_/settings/in-app.ts`. The helper
    `openDialogInApp` calls it. So does the spec
    `Escape closes a clean dialog and returns to the page beneath`.
- **Problem:**
  - When React's scheduler yields between the commit and the passive
    effects, the dialog is on screen, but no Escape layer is registered
    yet. Chromium runs a queued key event before the next scheduler task,
    so an Escape in that gap closes nothing. This breaks the requirement
    that Escape closes a clean dialog.
  - A probe run on 2026-11-26 recorded one such case: the dialog was in
    the document at 666 ms, Escape came at 688 ms with focus on the page
    body, no layer consumed the key, and focus moved into the dialog at
    689 ms.
  - Under CPU load on a 4-CPU machine, the spec without the wait failed 3
    of 50 runs at `doors.spec.ts:51`, as in CI run 45831868876. A local
    copy of `WebModalFrame` that moved focus and registered Escape 300 ms
    late made it fail 3 of 3 runs.
- **Impact if no action:** A reader who presses Escape in the few
  milliseconds after the dialog appears sees it stay open, and must press
  again. The gap is usually zero, and some tens of milliseconds on a loaded
  machine. The browser specs stay stable, because they wait for focus.
- **Root question:** How does the settings dialog meet "Escape closes" from
  the moment it is on screen, or must the requirement allow a short gap?
- **Options:**
  - **A.** Keep the product, and narrow the requirement: add to
    `docs/protocol/cloud/settings-dialog.md` that the dialog takes keys once
    it has moved focus into itself. No code changes. It accepts the gap for
    every reader. Effort: Small.
  - **B.** In `SettingsDialog`, add a document Escape listener in a layout
    effect. It calls the dialog's close only until a passive effect of
    `SettingsDialog` marks the frame ready, which happens after the frame's
    own layer exists. Before that moment no frame layer and no menu exists,
    so nothing closes twice and no overlay loses Escape. It needs a
    regression test that holds the frame's effects back. It is a second
    close path beside the frame's, which goes away when `@firna/ui` closes
    the gap. Effort: Medium.
  - **C.** In `@firna/ui`, run the focus move and the Escape-layer
    registration of `WebModalFrame` in layout effects, so both are in place
    before the browser paints the dialog. It needs a change and a test in
    the `Firna-AI/ui` repository, a release, and a version bump of
    `@firna/ui` here. Every `WebModalFrame` user gets the fix. Effort:
    Medium.
- **Left out:** Deleting this item, because the probe shows that the gap is
  real. A second, unguarded Escape listener in `SettingsDialog`, because it
  would close the dialog twice once the frame's own layer also takes the
  key, and it would take Escape from a menu or a question over the dialog.
- **Wider fix:** C. It removes the gap for every overlay of `@firna/ui`.
- **Previous examples:** In
  `packages/app/src/_tests_/settings/doors.spec.ts`, the spec
  `Escape closes a clean dialog and returns to the page beneath` waited for
  focus inside the dialog before Escape, before the helper existed. The
  flaky spec `Close returns to the page beneath from any address` failed in
  CI run 45831868876.
- **Related:** The test helper `openDialog` in
  `packages/app/src/_tests_/harness.ts` returns once the dialog is visible,
  not once it takes keys. Today every spec that presses a key after it
  first waits for pane content, which renders after the dialog's effects.
  If A is chosen, make `openDialog` wait through `expectDialogTakesKeys`
  too, so that a later spec cannot meet the gap. If B or C is chosen, no
  opener needs the wait.
- **Recommendation:** C. It keeps the requirement in force, fixes the cause
  where it lives, and adds no second close path. A is the cheapest, and C
  best protects the codebase.
- **Action:** ask the user, because A narrows a requirement in force, and B
  and C have real trade-offs: a local second close path against a change
  and release in another repository.
