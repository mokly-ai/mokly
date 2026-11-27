# Clicks in Changes on gated sets are untested

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-23, from the branch
  `calummoore/m12-variant-rows-lifecycle-qne8`.
- **Location:**
  - `packages/viewer/src/shell/workspace.tsx:75-99`: the `inspecting` ref, the
    `selecting` getter, the set gate and the shown tab.
  - `packages/viewer/src/shell/workspace_picks.ts:27-39` and `:64-77`:
    `useWorkspacePicks` takes `selecting` and returns the canvas's frames.
  - `packages/viewer/src/shell/use_canvas_selection.ts:171`, the frame click,
    and `:195-205`, the Escape clear.
  - `packages/viewer/src/shell/comparison_eligible_frames.ts:185-202`: the set
    gate, `comparisonOffered`.
  - `tests/browser/right_panel_tabs.spec.ts:69-97`, the test "in Changes a
    click on a frame selects nothing, and the canvas draws no selection": the
    only test of a click in Changes.
  - `tests/helpers/comparison_catalogue.ts:24-27` and `:74-80`: the Tag set.
  - `docs/protocol/mokly-viewer-selection-canvas.md:32-37`: the click rule.
- **Reason:** The click rule holds today, and its guard test needs a new unit
  harness that renders the whole workspace.

- **Source:** Implementation.
- **Category:** Test.

- **Terms:**
  - **Variant set:** a component's section on the canvas. It has a row for the
    component's own example and a row for each saved variant. Each row is its
    own catalogue entry.
  - **Set gate:** the rule that a variant set offers its Changes tab and its
    compare modes while any shown row compares, whichever row the route names.
  - **Gated set:** a variant set whose Changes tab comes from the set gate
    alone. Changes does not list the routed entry, and the routed entry does
    not compare, but another shown row does.
  - **Shown tab:** the tab of the right panel that the workspace draws, Inspect
    or Changes. `shownPanelTab` in `packages/viewer/src/shell/right_panel.tsx`
    shows Changes only where the workspace has a Changes tab.
- **Background:**
  - A click on a canvas frame selects an instance only while Inspect shows. In
    Changes, a click on a frame selects nothing, and the canvas draws no
    selection. "Clicks By Tab" in
    `docs/protocol/mokly-viewer-selection-canvas.md` states this rule.
  - The set gate is a decision of 2026-11-23. "Screen controls" in
    `docs/protocol/mokly-changes-controls.md` states it. Each shown row decides
    its own comparison, and a row that does not compare keeps Current. A
    screen, and a removed component or variant, keep the rule of their own
    shown views.
  - Before the set gate, the routed entry alone decided the Changes tab. The
    tab showed when Changes listed the entry or when the entry's own shown
    views were eligible.
  - Since the set gate, the workspace knows its shown tab only after the
    canvas's frames, because the gate counts the shown rows that compare.
    `useWorkspacePicks` in `packages/viewer/src/shell/workspace_picks.ts`
    returns those frames. It also takes `selecting`, which says whether a
    click on a frame selects.
  - So `selecting` is a getter, `() => boolean`.
    `packages/viewer/src/shell/use_canvas_selection.ts` calls it when a frame
    click or the Escape key arrives. A click selects, and Escape clears the
    selection, only while the getter returns true.
  - `packages/viewer/src/shell/workspace.tsx` computes the shown tab after the
    set gate. At line 99 it writes to a ref, `inspecting`, whether Inspect
    shows on an entry that is not removed. The getter reads that ref. A
    comment at lines 75-76 says why.
  - The Serve comparison fixture in `tests/helpers/comparison_catalogue.ts`
    holds the Tag set, `components/tag`. Its own example and its Plain variant
    are unmodified, and its Bold variant changed. The fixture's second commit
    removes its Old tag variant, which the canvas does not show.
  - Changes does not list `components/tag`, so only the set gate gives the Tag
    route its Changes tab. The test "a variant set whose routed row has no
    comparison offers the Changes tab and compares its changed rows" in
    `tests/browser/serve_comparison_rows.spec.ts` checks that tab.
  - In Changes, a click that selects nothing shows nothing. So a browser check
    gets no signal that the click arrived.
- **Problem:** No deterministic test sends a click on a frame while Changes
  shows on a gated set. The only test of a click in Changes runs on the screen
  `screens/changed`, where the old and the new tab rules agree. That test is
  "in Changes a click on a frame selects nothing, and the canvas draws no
  selection" in `tests/browser/right_panel_tabs.spec.ts`.
- **Impact if no action:** A later change can compute `selecting` from the old
  rule, the routed entry alone, and pass every test. A click in Changes
  then selects an instance on the Tag set.
- **Root question:** How does a test prove that a click on a frame selects
  nothing while Changes shows on a gated set?
- **Options:**
  - **A.** Add a browser check on the Tag set. It opens Changes, clicks
    Plain's frame, opens Inspect, and expects an empty Selection section. It
    relies on a margin of time between the click and the change of tab.
    Effort: Small.
  - **B.** Add a unit test that renders the workspace on a gated set with a
    fake frame adapter. It sends a frame click and an Escape while Changes
    shows. It then checks that the click selected nothing and that Escape kept
    the earlier selection. The harness is new, because no test renders
    `ComponentWorkspace` yet. It can start from `fakeAdapter` and
    `renderInShell` in `packages/viewer/tests/canvas_frame_fixture.tsx`, which
    `packages/viewer/tests/canvas_shell_keys.test.tsx` uses to send frame
    events. Its data can follow `shown` and `variant` in
    `packages/viewer/tests/comparison_eligible_frames.test.ts`, which add rows
    that compare to the Action set, whose own row does not. Effort: Medium.
  - **C.** Change nothing, and keep the comment in `workspace.tsx`.
    Effort: Small.
- **Left out:**
  - A check that clicks a frame and changes the tab at once, because the click
    can arrive after the change.
  - A test of `useCanvasSelection` alone, because
    `packages/viewer/tests/canvas_shell_keys.test.tsx` already gives it a
    getter, and the risk is the value that `workspace.tsx` gives.
  - A refactor that knows the shown tab before the canvas's frames, because
    the set gate needs those frames, and a test must still check the rule.
- **Wider fix:** None. The getter already reads the same shown tab that the
  right panel draws, and B catches a later change that splits them.
- **Previous examples:** None found.
- **Related:** [tag-picker-ignores-frame-input.md](tag-picker-ignores-frame-input.md)
  changes the same Escape handling in `use_canvas_selection.ts`. Its test can
  share the workspace harness that this item adds.
- **Recommendation:** B. It is the only option that checks the workspace's own
  value without a margin of time.
- **Action:** fix after merge, apply B, because it needs a new unit harness and
  the risk is a future regression, not a defect today.
