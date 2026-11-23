# A document's change in its other scheme marks no control

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-23, from the branch
  `calummoore/canvas-redesign-m12-right-panel-and-fo8u`.
- **Location:** `docs/protocol/mokly-viewer-appearance.md:57-60`, the
  standalone Appearance control and the embedded Dark preview control in
  `packages/viewer/src/shell`
- **Reason:** Milestone 12 found it while it moved the change marks to the
  Frames filter. The gap is older than the Canvas redesign, so the milestone
  did not change it.

- **Source:** Implementation.
- **Category:** Product bug.
- **Background:** A Markdown document shows one preview scheme. The appearance
  page says that a change confined to the other preview scheme marks the
  standalone Appearance control, and that an embedded viewer marks its Dark
  preview control instead.
- **Problem:** No document ever showed that mark. The viewer never derives a
  scheme-only change for a document.
- **Impact if no action:** A reader who looks at a changed document in one
  scheme does not learn that the other scheme changed.
- **Root question:** Does the viewer mark a document's change in its other
  scheme, as the page requires?
- **Options:**
  - **A.** Derive the mark from the document's view evidence, and show it on
    the Appearance control or the Dark preview control, as the page says. Add
    a unit test and a browser test. Effort: Small.
  - **B.** Change the page to say that a document marks no scheme-only change,
    and rely on the catalogue's Changes row. Effort: Small.
- **Left out:** A Frames filter for documents, because a document shows one
  reading frame.
- **Wider fix:** A.
- **Previous examples:** The screen's scheme marks on the Frames filter of
  Milestone 12.
- **Recommendation:** A. It builds the requirement in force.
- **Action:** fix after merge, apply A, because the page already requires it.
