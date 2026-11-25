# Props milestone assumes the saved-props copy exists

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from the branch
  `calummoore/storybook-milestone-1a-canvas-mockups-omnr`, review round 1,
  finding 6.
- **Location:**
  - `plans/storybook-support.md:2884-2886`, the second TODO of Milestone 24a,
    "The Props sentence after a failed edit".
  - `plans/storybook-support.md:1258-1264`, design call 32.
  - `examples/basic/specs/design/components/controls/parts/copy.ts:34-106`,
    the `CONTROLS_COPY` of the design catalogue, and `:108-119`,
    `SAVED_PREVIEW_COPY`.
  - `packages/viewer/src/shell/component_controls_copy.ts:28-100`, the
    `CONTROLS_COPY` of the viewer.
  - `examples/basic/specs/design/canvas/props/parts/forms.tsx:5-8`, `:54`, and
    `:62`, which read `SAVED_PREVIEW_COPY`.
  - `tests/viewer_controls_copy.test.ts:33-49`, which compares both copies.
- **Reason:** The orchestrator of `plans/storybook-support.md` owns the
  Milestone 24a TODO and design call 32, which the branch that found the
  problem may not edit.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Controls copy:** the settled text of the Props controls. The design
    catalogue and the viewer each hold one `CONTROLS_COPY` object.
  - **Saved-preview sentences:** the two alert sentences for a preview that
    still shows the saved props, because no edit has rendered yet.
- **Background:**
  - `plans/storybook-support.md` holds the Storybook support work. Its
    Milestone 24a is "The Props sentence after a failed edit". That milestone
    makes the Props tab of the viewer choose its alert sentence from the
    preview that the frame shows.
  - On 2026-11-23 the orchestrator of the plan made design call 29: until an
    edit renders, the Props tab says "The preview shows the saved props."
  - Design call 32, of the same date, says that the "Invalid prop value"
    mockup uses the new sentence "Check the highlighted values. The preview
    shows the saved props.", "which both copy files of the controls hold".
  - Commit `986ba28d2` added that sentence to both `CONTROLS_COPY` objects,
    as the key `invalidSavedPreview`.
  - Commit `73f6702c9` merged `main` into
    `calummoore/mokly-storybook-integration`. The merge took the whole file
    of `main` for both copies, so both lost `invalidSavedPreview`.
  - Design call 33, made on 2026-11-25 in Milestone 1a, keeps both
    saved-preview sentences in `SAVED_PREVIEW_COPY` of the design copy. They
    stay outside `CONTROLS_COPY` until Milestone 24a moves them into both
    copies.
  - The reason of design call 33: `tests/viewer_controls_copy.test.ts`
    requires both copies to hold the same keys with the same values.
  - `SAVED_PREVIEW_COPY.failedBody` is `CONTROLS_COPY.expiredBody`, "Your
    edits are kept. The preview shows the saved props.", which both copies
    already hold.
  - `SAVED_PREVIEW_COPY.invalid` is "Check the highlighted values. The
    preview shows the saved props.", which neither `CONTROLS_COPY` holds.
  - The second TODO of Milestone 24a reads: "Keep the viewer's copy equal to
    the copy of the controls mockups, which `tests/viewer_controls_copy.test.ts`
    compares. The viewer's copy already holds the new sentence of design call
    32."
- **Problem:** The TODO says that the viewer's copy already holds the new
  sentence, and design call 32 says that both copy files hold it. Since commit
  `73f6702c9`, neither statement is true.
- **Impact if no action:** An implementer of Milestone 24a can miss the copy
  change, or add the sentence to one copy only and fail the equality test.
- **Root question:** How does every live passage of the plan describe the
  saved-props copy as the code holds it, and the work that remains?
- **Options:** The letters follow the options of the review finding and of
  its finding check on the source branch. On 2026-11-25 the branch chose C.
  - **A.** Replace the stale statement of the TODO with a task. The task adds
    the saved-preview copy to both `CONTROLS_COPY` objects, and removes the
    temporary design copy. Effort: Small.
  - **B.** Replace the stale statement with a reference to design call 33.
    The reader then follows that reference for the details. Effort: Small.
  - **C.** The orchestrator applies the task of A, and gives design call 32 a
    note. Effort: Small.
    - The second TODO of Milestone 24a becomes: "Add both saved-preview
      sentences of `SAVED_PREVIEW_COPY` in
      `examples/basic/specs/design/components/controls/parts/copy.ts` to
      `CONTROLS_COPY` there and in
      `packages/viewer/src/shell/component_controls_copy.ts`, and remove
      `SAVED_PREVIEW_COPY`. Keep the viewer's copy equal to the copy of the
      controls mockups, which `tests/viewer_controls_copy.test.ts` compares."
    - Design call 32 ends with a note that starts "Changed on 2026-11-25 by
      design call 33:". The note says that only `SAVED_PREVIEW_COPY` of the
      design copy holds the new sentence, until Milestone 24a.
    - Design call 28 shows the form of such a note: "Changed on 2026-11-23 by
      design call 31: the Story row now sits between Source and the Storybook
      row."
  - **D.** Change the code so that the plan is true again. Effort: Small.
    - Restore `invalidSavedPreview` to both `CONTROLS_COPY` objects, as
      commit `986ba28d2` added it.
    - Draw Invalid value from that key, and Render failed from
      `CONTROLS_COPY.expiredBody`, which has the same text.
    - Delete `SAVED_PREVIEW_COPY`, and rewrite the copy sentences of design
      call 33.
    - D changes `packages/viewer` and reverses copy that the merge took from
      `main`, so the orchestrator must allow it.
- **Left out:**
  - Moving the choice of sentence of the viewer into Milestone 1a: a mockup
    milestone holds only mockup work.
  - A test that compares the plan with the code: the `testing` skill gives
    plan prose no test.
- **Wider fix:** None. The rule of the `plans` skill for the mockup milestone
  caught the drift, and design call 33 records it.
- **Previous examples:** None found.
- **Related:** [props-edit-attempt-records.md](props-edit-attempt-records.md)
  changes the same cases of `editOf` in
  `examples/basic/specs/design/canvas/props/parts/forms.tsx`. No options
  conflict.
- **Recommendation:** C. It corrects both stale passages of the plan that the
  orchestrator owns. D fits instead if the orchestrator allows the viewer
  edit, or finds that the merge dropped the key by mistake.
- **Action:** fix after merge, apply C, because the orchestrator of the plan
  owns these lines.
