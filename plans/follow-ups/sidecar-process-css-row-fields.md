# The processCss row omits a result field

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from round 2 of the implementation review of the
  branch `calummoore/storybook-track-d-finish-nkpi`: the finding check of
  finding 143 put it outside the scope.
- **Location:** The `processCss` row of the methods table at
  `docs/protocol/mokly-sidecar.md:69`, and
  `packages/mokly/src/generated/sidecar/CssResult.ts:15`.
- **Reason:** The field came with commit `d935e6a66`, before the branch that
  found the gap.

- **Source:** Review.
- **Category:** Docs or spec.
- **Background:**
  - The methods table of `docs/protocol/mokly-sidecar.md` gives the params
    and the result of each sidecar method. The `processCss` result cell
    reads `{ text, dependencies, readEvidence }`.
  - The generated `CssResult` type also has the optional
    `unmappedDependencyDirectories` field, at
    `packages/mokly/src/generated/sidecar/CssResult.ts:15`.
    `docs/protocol/mokly-sidecar-modules.md` defines it.
  - The `transformViteCss` and `cssModules` rows of the same table link their
    generated types.
  - The `documentation` skill puts a field list in generated reference.
- **Problem:** The `processCss` result cell omits the optional
  `unmappedDependencyDirectories` field.
- **Impact if no action:** A reader who builds a `processCss` reply from the
  table misses this field.
- **Root question:** How does the `processCss` row of the methods table stay
  equal to the wire?
- **Options:**
  - **A.** Add the field to the cell by hand, with a link to its home.
    Effort: Small.
  - **B.** Link the generated `ProcessCssParams` and `CssResult` types from
    the row, as the `transformViteCss` row does. Keep in prose only what the
    types cannot show. Effort: Small.
  - **C.** Apply B to every row of the table, as option C of
    `plans/follow-ups/sidecar-bundle-row-fields.md` says. Cost: the edit
    rewrites older rows, and the table loses its short field summaries.
    Effort: Small.
- **Left out:** A check that compares the table with the generated types. No
  test asserts the words of a protocol page.
- **Wider fix:** C. Generated types then give each field list, so no row
  needs an edit for a new field.
- **Previous examples:** `plans/follow-ups/sidecar-bundle-row-fields.md`
  records the same omission for the `bundle` row.
- **Related:** `plans/follow-ups/sidecar-bundle-row-fields.md`: a shared
  wider fix. One edit under C closes both items.
- **Recommendation:** C. It closes this item and the `bundle` row item in one
  Small edit.
- **Action:** fix after merge, apply C, because the field predates the branch
  that found the gap, and one edit can close the `bundle` row item too.
