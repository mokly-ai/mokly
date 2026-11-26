# Settings dialog ignores Escape before it takes keys

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-26, from branch
  `calummoore/flaky-app-settings-escape-before-dialog-8plh`, which fixed the
  flaky browser spec `Close returns to the page beneath from any address`.
- **Location:** `packages/app/src/settings/surface.tsx:147` to line 162, and
  `WebModalFrame` in the `@firna/ui` package, whose source is
  `src/modal/WebModalFrame.web.tsx` in the `Firna-AI/ui` repository.
- **Reason:** The protocol does not say whether the dialog must take Escape
  before it has moved focus into itself, so the product side needs the
  user's choice.

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
    overlay that registered a layer.
  - **Passive effect:** a React `useEffect` callback. React runs it after
    the commit, in the same task when the render was short, and in a later
    task when the scheduler yields.
- **Background:**
  - `WebModalFrame` moves focus into the dialog and registers its Escape
    layer in two passive effects of one component. React runs both in one
    step, after the dialog is in the document.
  - `SettingsDialog` in `packages/app/src/settings/surface.tsx` moves focus
    onto the rail link of the chosen pane in its own passive effect, in the
    same step.
  - `docs/protocol/cloud/settings-dialog.md` says that focus moves into the
    dialog on open, and that Escape closes it unless a form is dirty. It
    does not say what a key does in the moment before the dialog takes
    focus.
- **Problem:**
  - When React's scheduler yields between the commit and the passive
    effects, the dialog is on screen, but no Escape layer is registered
    yet. Chromium runs a queued key event before the next scheduler task,
    so an Escape in that gap closes nothing.
  - A probe run on 2026-11-26 recorded one such case: the dialog was in
    the document at 666 ms, Escape came at 688 ms with focus on the page
    body, no layer consumed the key, and focus moved into the dialog at
    689 ms.
  - Under CPU load on a 4-CPU machine, the unchanged spec failed 3 of 50
    runs at `doors.spec.ts:51`, and CI run 45831868876 failed in the same
    way. A local copy of `WebModalFrame` that runs the focus move and the
    layer 300 ms late made the spec fail 3 of 3 runs.
- **Impact if no action:** A reader who presses Escape in the first few
  milliseconds after the dialog appears sees it stay open, and must press
  again. The browser specs wait for focus inside the dialog, so the gate
  stays stable.
- **Root question:** Must the settings dialog take Escape from the moment
  it is on screen, or only once it has moved focus into itself?
- **Options:**
  - **A.** Keep the product. Add one sentence to
    `docs/protocol/cloud/settings-dialog.md`: the dialog takes keys once it
    has moved focus into itself. No code changes. Effort: Small.
  - **B.** In `@firna/ui`, run the focus move and the Escape-layer
    registration of `WebModalFrame` in layout effects, so both are in place
    before the browser paints the dialog. This change is in another
    repository, needs a release, and a version bump of `@firna/ui` in this
    repository. Every `WebModalFrame` user gets the change. Effort: Medium.
- **Left out:** A second Escape listener in `SettingsDialog`, registered
  in a layout effect: it would close the dialog twice when the frame's own
  layer also takes the key, and it would skip the escape-layer stack that
  lets a menu or a question over the dialog take Escape first. Changing
  nothing, also not the protocol, leaves the gap unrecorded, and A is
  better on every point.
- **Wider fix:** B. It closes the gap for every overlay of `@firna/ui`,
  not only for the settings dialog.
- **Previous examples:** In
  `packages/app/src/_tests_/settings/doors.spec.ts`, the browser spec
  `Escape closes a clean dialog and returns to the page beneath` already
  waited for the focus inside the dialog before it pressed Escape. The helper
  `openDialogInApp` in `packages/app/src/_tests_/settings/in-app.ts` now
  waits for the same signal.
- **Recommendation:** A. The gap lasts a few milliseconds, a second press
  closes the dialog, and the readiness signal that the specs use becomes a
  written rule. B best protects the codebase, because it removes the gap
  for every overlay.
- **Action:** ask the user, because the protocol does not settle what a key
  does before the dialog takes focus, and each option changes or adds a
  requirement.
