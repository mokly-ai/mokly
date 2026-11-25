# The bundle method row omits wire fields

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from the finding check of finding 94 in round 1 of
  the implementation review of the branch
  `calummoore/storybook-track-d-finish-nkpi`, which put the two older fields
  outside the scope.
- **Location:** The `bundle` row of the methods table in
  `docs/protocol/mokly-sidecar.md`,
  `packages/mokly/src/generated/sidecar/BundleRequest.ts`, and
  `packages/mokly/src/generated/sidecar/BundleResult.ts`.
- **Reason:** The missing fields are older than the branch that found the
  gap, and that branch changed only the `viteInputs` part of the row.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Methods table:** The table in the section "Methods" of
    `docs/protocol/mokly-sidecar.md`. It lists the params and the result of
    each sidecar method.
  - **Evaluation digest:** The optional `evaluation` field of a `bundle`
    request. It is the core input digest that keeps the resolved bindings
    and the CSS Modules of a generation apart.
  - **Resolution plan:** The map of the imports that a native esbuild
    attempt resolved, under `docs/protocol/mokly-sidecar-plans.md`.
- **Background:**
  - On 2026-11-25 the `bundle` row named the entry files, the renderer, the
    stories files, and the resolution settings. It also named the source
    root, the configuration directory, the repository roots, and the optional
    `vite`, `viteInputs`, `capture`, and `preparation` fields. Its result cell
    named `{ generation, modules, compiled }` or a short result.
  - The generated `BundleRequest` type also has two optional fields. The
    `evaluation` field came with commit `d935e6a66`. The request-only `plan`
    field came with commit `be242a628`.
  - The generated `BundleResult` type also has the optional `plan` and
    `unmappedDependencyDirectories` fields.
  - The homes of these fields exist.
    `docs/protocol/mokly-sidecar-plans.md` defines the request-only `plan`
    value and the `plan` result field.
    `docs/protocol/mokly-sidecar-modules.md` defines the evaluation digest
    and `unmappedDependencyDirectories`.
    `docs/protocol/mokly-sidecar-release.md` says that the pool compares
    settings without the evaluation digest.
  - On 2026-11-25 the `transformViteCss` row of the same table started to
    link its generated params and result types. It keeps in prose only what
    the types cannot show.
  - The page had 222 of its 250 allowed lines on 2026-11-25.
- **Problem:** The `bundle` row lists its fields by hand. It omits the
  optional `evaluation` and `plan` request fields. Its result cell omits the
  optional `plan` and `unmappedDependencyDirectories` result fields.
- **Impact if no action:** A reader who builds a `bundle` request or a test
  reply from the table misses these fields.
- **Root question:** How does the `bundle` row of the methods table stay
  equal to the wire?
- **Options:**
  - **A.** Add the missing fields to the row by hand, each with a link to its
    home. This keeps a second field list beside the generated types. Effort:
    Small.
  - **B.** Link the generated `BundleRequest` and `BundleReply` types from the
    row, as the `transformViteCss` row does. Keep in prose only what the
    types cannot show, such as the short result and the links to the homes
    of `capture`, `preparation`, and `viteInputs`. Effort: Small.
  - **C.** Apply B to every row of the methods table. Each row names its
    generated params and result types, with a link to each file. Each row
    keeps in prose only what the types cannot show, such as a default, the
    short bundle result, and "nothing". Cost: the edit rewrites rows that are
    older than the Vite adapter work, and the table loses its short field
    summaries. Effort: Small.
- **Left out:** A check that compares the table with the generated types. No
  test asserts the words of a protocol page.
- **Wider fix:** None. For docs drift, the `documentation` skill is the wider
  fix in force: a field list belongs in generated reference. C applies the
  same rule to the other rows and adds no guard.
- **Previous examples:** Until 2026-11-25 the `transformViteCss` row of the
  same table omitted the `importedBy` result field and described the wrong
  settings.
- **Related:** `plans/follow-ups/bundle-reuse-outcome-field.md` adds a reuse
  field to the `bundle` reply, in the same row. Under B or C, that field
  needs no edit of the row. Make both changes in one edit when both items
  are open. `plans/follow-ups/sidecar-process-css-row-fields.md` records the
  same omission in the `processCss` row. C here closes both items in one
  edit.
- **Recommendation:** B. The generated types then supply the field list, so a
  field change needs no edit of the row, and the row matches the
  `transformViteCss` row.
- **Action:** fix after merge, apply B, because the missing fields are older
  than the branch that found the gap.
