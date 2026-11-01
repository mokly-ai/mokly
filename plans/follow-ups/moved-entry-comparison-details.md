# Show comparison details for a pure move

- **Severity:** Low. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  user item 136, from the first decision of the viewer-103c work.
- **Location:** `packages/viewer/src/shell/workspace_evidence_data.ts:56-60`,
  `packages/viewer/src/shell/workspace_evidence.tsx:98` and `:110-114`,
  `packages/viewer/src/shell/entry_wording.ts:85` and `:101`, and the design
  artboard `examples/basic/specs/design/review/outcomes/moved.tsx`.
- **Reason:** On 2026-10-21 the user chose option B as work after the
  merge, not in the rebuild pull request.

- **Source:** Review.
- **Category:** Mockup.
- **Terms:**
  - **Pure move:** an entry that Changes lists only because its file moved,
    with no change to its own content.
  - **Comparison band:** the strip above a preview that offers a comparison
    of the current and previous versions.
  - **Terminal line:** the last line of the Details panel, "No changes to
    this screen.", for an entry with nothing changed.
- **Background:**
  - A pure move can still use shared components that changed. Its band then
    offers the comparison of those components in its views.
  - Details show the shared-component sentence only when the entry is not
    in Changes, `data.included === false`, at
    `workspace_evidence_data.ts:56-60`.
  - Otherwise, an `Unmodified` entry ends with the terminal line, at
    `workspace_evidence.tsx:110-114`.
  - On 2026-10-21 the user chose a shared-component sentence for each kind
    of entry. For a screen it reads "Changed components that this screen
    uses affect its preview." It
    replaced "Shared component changes affect this preview. This page has no
    independent entry in Changes." It is at `entry_wording.ts:101`.
  - The Moved design artboard shows changed content, so no design shows
    this state.
  - On 2026-10-21 the user chose option B, as work after the merge.
- **Problem:** For an entry that Changes lists only as a move, Details end
  with "No changes to this screen." But its band offers the comparison of
  the changed components that its views use.
- **Impact if no action:** The page offers a comparison and denies any
  change in the same state, which confuses a reviewer.
- **Root question:** What should Details say for a pure move whose views use
  changed components?
- **Options:**
  - **A.** Keep the terminal line. Effort: Small.
  - **B.** For an entry that Changes lists only as a move, show the
    shared-component sentence, which no longer says "no independent entry
    in Changes". Draw the design first. Effort: Large.
  - **C.** Leave out the terminal line when a shown view uses a changed
    component. Draw the design first. Effort: Large.
- **Left out:** Change the copy without a design. The mockup rule requires
  the design state first.
- **Wider fix:** B. The design gives the state one positive explanation.
- **Previous examples:** The user's wording choice of 2026-10-21 already
  made the shared-component sentence follow the entry's kind.
- **Related:** [affected-component-artboards.md](affected-component-artboards.md)
  adds other missing shared-impact artboards in the same design area. One
  mockup branch can draw both states, but each item has its own state.
- **Recommendation:** B. It keeps Details and the comparison band
  consistent.
- **Action:** fix after merge, apply B, because the user chose B on
  2026-10-21 as work after the merge.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L5785).
