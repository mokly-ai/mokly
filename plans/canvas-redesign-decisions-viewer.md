# Canvas redesign: decisions 6 to 12

This file continues [decisions 1 to 5](./canvas-redesign-decisions.md) of the
[Canvas redesign plan](./canvas-redesign.md). That file holds the shared
terms, the summary table and the notes about the options check.

## 6. Stage with several frames and zoom

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Docs or spec.
- **Location:** `packages/ui/src/stage/`, `packages/viewer/src/shell/`, `docs/protocol/mokly-shell-design.md`
- **Background:** The design shows each screen as four frames at once:
  desktop and mobile, in light and dark. The canvas pans and zooms, and the
  panels float over it. On phones a dock holds Catalogue, the panel tab and
  Fit. The stage today shows one scheme at a time, with no zoom.
- **Problem:** This is a new stage, not a restyle. The package builds it for
  `mokly serve` and the cloud alike.
- **Impact if no action:** The viewer looks like Canvas but keeps today's
  stage behaviour.
- **Root question:** How much of the design's canvas behaviour ships in this
  change?
- **Options:**
  - **A.** Restyle the current stage: dot grid, frame labels, size tags and
    Canvas surfaces. Keep the stage layout and the compact layout. Effort:
    Medium.
  - **B.** A, plus a fitted view of all four frames, with no pan or zoom.
    Effort: Large.
  - **C.** The full canvas: B, plus pan, zoom, pinch, floating panels, the
    phone dock and compare on every frame. Effort: Large.
  - **D.** A, plus the design's layout. The catalogue and the right panel
    float over a full-width dot grid, and a phone dock replaces the drawer.
    The stage keeps one scheme and has no zoom. Effort: Large.
- **Left out:** Zoom without the four frames, because it needs B's scaling
  work and today's stage already scrolls.
- **Wider fix:** None, because this is a choice of scope.
- **Previous examples:** None found.
- **Related:** Decision 7. Its right panel is fixed unless this decision is C
  or D.
- **Recommendation:** A. Cal wants this change to be mostly a redesign. B, C
  and D fit a later plan.
- **Action:** answered. It waited for the user, because Cal asked to check large features first.
- **Answer:** Cal chose **C** on 2026-11-20: the full canvas.

## 7. Inspect and Changes right panel

- **Severity:** Medium. **Effort:** Large.
- **Source:** Design.
- **Category:** Docs or spec.
- **Location:** `packages/ui/src/inspector/`, `packages/viewer/src/shell/inspector.tsx`, `docs/protocol/mokly-component-inspector-design.md`
- **Background:** The design puts a panel on the right with the tabs Inspect,
  Changes, Comment and Agent. Cal asked to skip Comment and Agent. Changes
  shows only on a changed screen. Today the inspector sits below the preview,
  with Details, Props, Usage and Components tabs.
- **Problem:** The design moves the inspector, and its Inspect tab replaces
  four tabs. Dropping Usage and Components removes functionality from
  `origin/main`.
- **Impact if no action:** The viewer keeps the inspector below the preview.
- **Root question:** Where does the inspector sit, and which tabs does it
  hold, in this change?
- **Options:**
  - **A.** Keep the inspector below the preview and restyle it. Effort:
    Small.
  - **B.** Move it to a right panel with Inspect and Changes. Inspect uses
    today's data, plus a selection outline with name and size tags. Changes
    holds the counts, base and head, the compare modes and next and previous
    change. The cloud adds the Mokly check through a slot. Usage and
    Components go away. Effort: Large.
  - **C.** B, plus the padding redline and box model. The frame probe must
    report inner layout sizes. Effort: Large.
  - **D.** A right panel with Inspect, Usage, Components and Changes. Inspect
    joins today's Details and Props, as the design draws it. Changes works as
    in B. No panel goes away. Effort: Large.
- **Left out:** The Comment and Agent tabs, because Cal asked to skip them. A
  cloud panel in the `sidePanel` slot, because the cloud may not copy Browse,
  and `mokly serve` would keep the old inspector.
- **Wider fix:** None, because this is a choice of scope.
- **Previous examples:** None found.
- **Related:** Decision 6. The panel floats only when decision 6 is C or D.
- **Recommendation:** D, changed from B by the options check. It follows
  Cal's panel and removes nothing that `origin/main` has.
- **Action:** answered. It waited for the user, because Cal asked to check large features first.
- **Answer:** Cal answered on 2026-11-20: "it should align with the mockup/design". That is **C**: Inspect with the box model, and Changes. My design call keeps Usage and the nested component tree as sections of Inspect, so no functionality goes away.

## 8. Overlay compare as a divider

- **Severity:** Low. **Effort:** Small.
- **Source:** Design.
- **Category:** Docs or spec.
- **Location:** `packages/ui/src/comparison-stage/comparison-stage.css:66`, `docs/protocol/mokly-comparison-panes.md`
- **Background:** In the design, Overlay shows base and head with a divider
  that you drag. Today Overlay shows the head at half opacity over the base.
- **Problem:** The design changes the behaviour of a compare mode.
- **Impact if no action:** The site and the product show Overlay in two ways.
- **Root question:** How does a reader compare base and head in one frame, in
  the product and on the site?
- **Options:**
  - **A.** Keep the half-opacity overlay. Draw no divider on the site.
    Effort: Small.
  - **B.** Change Overlay to a divider that you drag, with arrow keys, Home
    and End. It changes input routing and many browser specs. Effort: Large.
  - **C.** Keep Overlay and add a fifth Swipe mode with the divider. Effort:
    Large.
  - **D.** The product keeps its Overlay in this change, and the site draws
    the divider. A follow-up item applies B, C or E before go-live. Effort:
    Small.
  - **E.** Overlay becomes B's divider and keeps a Blend switch for the
    half-opacity view. Effort: Large.
- **Left out:** None.
- **Wider fix:** None, because this is a choice of behaviour.
- **Previous examples:** None found.
- **Related:** Decision 2, option D conflicts with option D here.
- **Recommendation:** D, changed from B by the options check. It keeps this
  change a redesign, and Cal lets the site show features before they ship.
- **Action:** answered. It waited for the user, because the options change behaviour that
  `mokly-comparison-panes.md` defines, or let the site and the product differ.
- **Answer:** Cal chose **C** on 2026-11-20: Overlay stays, and a fifth Swipe mode has the divider.

## 9. Live presence in the app

- **Severity:** Low. **Effort:** Small.
- **Source:** Design.
- **Category:** Docs or spec.
- **Location:** None
- **Background:** The design shows collaborator avatars in the bar, avatars on
  catalogue rows, and live cursors. The app has no presence service and no
  real-time transport.
- **Problem:** Presence needs a real-time backend and a protocol.
- **Impact if no action:** None for the redesign.
- **Root question:** Does the app show live presence in this change?
- **Options:**
  - **A.** Leave presence out of the app. The site still draws it. Effort:
    Small.
  - **B.** Add a presence service, the avatars and the cursors. Effort: Large.
  - **C.** Show the project members as an avatar group in the bar, with no
    live state. The group opens Share. Readers can take it for presence.
    Effort: Medium.
- **Left out:** Fake avatars in the app, because the app shows only real
  data.
- **Wider fix:** None, because this is a choice of scope.
- **Previous examples:** None found.
- **Recommendation:** A. It is a new feature with a backend, not a redesign.
- **Action:** answered. It waited for the user, because Cal asked to check large features first.
- **Answer:** Cal chose **A** on 2026-11-20, with a follow-up item for presence: [viewer live presence](./follow-ups/viewer-live-presence.md).

## 10. Docs "Your first screen" showpiece

- **Severity:** Low. **Effort:** Small.
- **Source:** Design.
- **Category:** Docs or spec.
- **Location:** `apps/site/src/docs/guides.ts`, `apps/site/src/docs/code-panel.ts`, `docs/protocol/cloud/site-delivery.md`
- **Background:** On the Your first screen guide, the design renders the
  guide's HTML beside its code. Wires link code lines to the elements. The
  guide text comes from the `@mokly/mokly` package Markdown.
- **Problem:** The site renders every guide through one Markdown pipeline. A
  showpiece needs a special case and a new script island.
- **Impact if no action:** The guide looks like the other Canvas docs pages.
- **Root question:** Does the redesign add a live demo inside a package guide?
- **Options:**
  - **A.** Leave it out. Every guide uses the Canvas docs layout. Effort:
    Small.
  - **B.** Add the showpiece for that guide only. Effort: Medium.
  - **C.** Add a general Markdown fence that renders an HTML sample beside its
    code, for any guide. Effort: Large.
- **Left out:** None.
- **Wider fix:** C, because a fence serves every guide.
- **Previous examples:** None found.
- **Recommendation:** A. It is a new feature, and the docs redesign stands
  without it.
- **Action:** answered. It waited for the user, because Cal asked to check large features first.
- **Answer:** Cal chose **C** on 2026-11-20: a general Markdown fence that renders an HTML sample beside its code.

## 11. Canvas designs for the remaining Browse states

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Implementation.
- **Category:** Mockup.
- **Location:** `examples/basic/specs/design/` (`browse/`, `changes/` and `components/`)
- **Background:** Milestone 1 drew Canvas as a new family of 29 Browse screens
  and states. Tests tie each of the 130 older design screens to the shipped
  package, so those screens kept today's look.
- **Problem:** Some states of today's shell have no Canvas design yet: the
  removed and moved outcomes, use-case flows, loading and recovery, search with
  the tag picker, and most component explorer pages.
- **Impact if no action:** Milestones 11 and 12 build those states without a
  design, and the catalogue shows two shell looks until Milestone 12.
- **Root question:** When does each remaining state of the shell get its
  Canvas design?
- **Options:**
  - **A.** Keep both families. Each implementation milestone draws the Canvas
    form of the states that it changes. Effort: Small now, more in each
    implementation milestone.
  - **B.** Add a second mockup milestone before Milestone 11 for every state
    whose layout changes. States that change only colour follow the package.
    Effort: Medium.
  - **C.** Redraw all 130 older screens now and retire the old family. Effort:
    Large.
- **Left out:** A colour-only re-theme of the older screens, because the
  result matches neither the shipped shell nor the target. Deleting the older
  screens now, because they depict shipped behaviour.
- **Wider fix:** None, because this is a choice of scope.
- **Previous examples:** None found.
- **Recommendation:** B. The plans rule asks for a design before the
  implementation, and B covers every changed layout in about a day.
- **Action:** ask the user, because each option has a real cost and no plan
  TODO covers these states.

## 12. New automatic checks from the mockup reviews

- **Severity:** Low. **Effort:** Small.
- **Source:** Review.
- **Category:** Test.
- **Location:** `docs/mockups/src/_tests_/`, `apps/site/tests/`, `xtask/`
- **Background:** The site mockup review fixed four defects: dim code below
  4.5:1, an Edit on GitHub link to an ignored path, an unhosted font and an
  unused module. For each class it proposed a wider check. Cal decided on
  2026-11-20 to reduce testing.
- **Problem:** Each wider check is a new gate, and new gates need Cal's
  approval.
- **Impact if no action:** The same classes of defect can return in later
  site work, and only review finds them.
- **Root question:** Which new checks guard the Canvas pages?
- **Options:**
  - **A.** Add none now. Record each as a follow-up item. Effort: Small.
  - **B.** Add the two cheap Node checks: every first font family is hosted,
    and every GitHub file link in the site mockups names a tracked file.
    Record the rest. Effort: Small.
  - **C.** Add all five: B, plus a contrast check of every site page, a
    browser check of the toolbar between 700px and 1440px, and the
    unused-export ratchet over `docs/mockups/src/`. Effort: Medium.
- **Left out:** None.
- **Wider fix:** C, because it covers every class.
- **Previous examples:** `plans/follow-ups/test-helper-unused-exports.md`.
- **Recommendation:** A. It follows Cal's choice to test less, and the
  regression tests of the four fixes stay.
- **Action:** ask the user, because every option except A adds a gate.
