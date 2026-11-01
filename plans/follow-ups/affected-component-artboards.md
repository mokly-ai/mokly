# Add the missing affected-component artboards

- **Severity:** Low. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  user item 104, from decision 6 of the 82 B delegate and finding 1 of the
  103 C review.
- **Location:** `examples/basic/specs/design/components/parts/component_usage.tsx:92-94`,
  `examples/basic/specs/design/components/states/shared-impact/screens.tsx:32-38`,
  and `packages/viewer/src/shell/workspace_usage.tsx:68`.
- **Reason:** On 2026-10-21 the user deferred the open review items until
  after the merge and kept each choice for a later decision.

- **Source:** Review.
- **Category:** Mockup.
- **Terms:**
  - **Affected-only component:** a component that Changes does not list,
    but that uses a changed component, so its preview can differ.
  - **Artboard:** one design mockup state in the design catalogue under
    `examples/basic/specs/design`.
- **Background:**
  - The design catalogue defines each product state before the viewer
    builds it.
  - The viewer's Usage panel lists "Affected screens and components", at
    `workspace_usage.tsx:68`.
  - The shared design Usage list still names only "Affected screens", at
    `component_usage.tsx:92-94`.
  - The affected-screen artboard, `AffectedScreenDesktop` and
    `AffectedScreenMobile` in `shared-impact/screens.tsx:32-38`, covers the
    screen state. The Moved artboard, `review/outcomes/moved.tsx`, shows
    changed content, so it does not cover an Unmodified affected view.
  - A review on 2026-10-21 widened option B to three component states.
  - The plan also asked to correct the sentence of
    `docs/protocol/mokly-component-design.md` about known unchanged shown
    views. Line 26 now gives them a comparison row when a shown view uses a
    changed component that the entry detail names.
- **Problem:** No artboard depicts an affected-only component's comparison,
  which reads "Components this variant uses changed". The design Usage list
  shows only screens in Affected.
- **Impact if no action:** Viewer work on these component states has no
  reviewed design, and the design copy disagrees with the product copy.
- **Root question:** How do the design mockups show a component that only
  changed components affect?
- **Options:**
  - **A.** Keep the component case in the design copy only. Correct the
    Usage list copy. Effort: Small.
  - **B.** Draw three new states in a separate design branch. The states
    are the affected component variant, an Unmodified view in Changes with
    the band, and an Affected list that shows components. Correct the shared
    Usage list copy. Effort: Large.
- **Left out:** Build the states in the viewer before their mockups. The
  mockup rule puts the design first. Fewer than three approaches exist,
  because a design state is either drawn or described in copy.
- **Wider fix:** B. It defines the complete affected-component state set.
- **Previous examples:** The affected-screen artboard covers the screen
  state only.
- **Related:** [moved-entry-comparison-details.md](moved-entry-comparison-details.md)
  needs a design state for a pure move in the same shared-impact area. One
  mockup branch can draw both, but each item has its own state.
- **Recommendation:** B. It gives every product state a reviewed mockup.
- **Action:** ask the user, because on 2026-10-21 the user deferred the open
  review items past the merge to decide each one later.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5918).
