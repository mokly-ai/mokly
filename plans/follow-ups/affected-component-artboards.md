# Add the missing affected-component artboards

- **Severity:** Low. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  user item 104, from decision 6 of the 82 B delegate and finding 1 of the
  103 C review. Rewritten on 2026-11-23 on the branch
  `calummoore/canvas-redesign-m12-right-panel-and-fo8u`, after the Canvas
  designs replaced the design files that it named and drew the shipped
  `UsageList`.
- **Location:** `examples/basic/specs/design/canvas/components/affected.tsx`,
  the affected-screen artboard;
  `examples/basic/specs/design/canvas/components/parts/inspect_default.tsx:31-50`,
  the Action's Affected list; `COMPONENT_STYLE_COPY` in
  `examples/basic/specs/design/parts/stylesheet_evidence.tsx`, the component
  copy that no artboard draws; and
  `docs/protocol/mokly-component-design.md:77-84` and `:128-133`.
- **Reason:** Option B sides with the product in a mockup and product
  mismatch, and no user decision settles that mismatch.

- **Source:** Review.
- **Category:** Mockup.
- **Terms:**
  - **Affected-only component:** a component that Changes does not list,
    but that uses a changed component, so its preview can differ.
  - **Artboard:** one design mockup state in the design catalogue under
    `examples/basic/specs/design`.
  - **Affected list:** the section of a changed component's Usage that lists
    the consumers that its change affects.
- **Background:**
  - The design catalogue defines each product state before the viewer
    builds it.
  - The affected-screen artboard, `design/canvas/components/affected` in
    `affected.tsx`, covers the screen state. Welcome, opened from the Action's
    Affected list, compares in Side by side while it stays Unmodified and
    outside Changes. `docs/protocol/mokly-component-design.md:128-133`
    describes it, and says that a component in Welcome's position ends with
    "Changed components that this variant uses affect its preview."
  - No artboard draws that component state. `COMPONENT_STYLE_COPY` in
    `stylesheet_evidence.tsx` holds its copy, "Components this variant uses
    changed" and that last sentence, but no design screen uses those two
    fields. The product writes the same words in
    `packages/viewer/src/shell/entry_wording.ts:91` and `:101`.
  - The Moved artboard, `examples/basic/specs/design/canvas/outcomes/moved.tsx`,
    shows changed content, so it does not cover an Unmodified affected view.
  - The designs draw the shipped `UsageList` of `@mokly/ui`. The Action's
    Affected list holds only Welcome and Details, because the contract lists
    affected screens. Toolbar, a component whose default variant uses the
    Action, appears under Used by alone, at `inspect_default.tsx:31-50`.
    `docs/protocol/mokly-component-design.md:77-84` lists only Welcome and
    Details there.
  - The product lists affected components too. In the example catalogue,
    Card's Affected list holds the Toolbar component, as
    `tests/browser/static_workspace_evidence.spec.ts:33-46` checks.
  - A review on 2026-10-21 widened option B to three component states.
  - The plan also asked to correct the sentence of
    `docs/protocol/mokly-component-design.md` about known unchanged shown
    views. Lines 37-42 now give such an entry a Changes tab when a shown row
    uses a changed component that its own entry detail names.
- **Problem:** No artboard depicts an affected-only component's comparison,
  which reads "Components this variant uses changed". The designs also show
  no component in an Affected list.
- **Impact if no action:** Viewer work on these component states has no
  reviewed design.
- **Root question:** How do the design mockups show a component that only
  changed components affect?
- **Options:**
  - **A.** Keep the component case in the words of the design contract only,
    at `docs/protocol/mokly-component-design.md:132-133`, and draw no new
    state. Effort: Small.
  - **B.** Draw three new states in a separate design branch. The states are
    the affected component variant's comparison, an Unmodified view in
    Changes whose Changes tab offers the comparison, and an Affected list that
    shows components. Effort: Large.
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
- **Action:** ask the user, because B lists components under Affected in the
  design, while `docs/protocol/mokly-component-design.md:77-84` lists only
  screens there, and no user decision settles that mismatch.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5918).
