# Generate the asset type list for both languages

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-21, from the branch
  `conductor/storybook-support-c-imported-assets`, track C of the Storybook
  support plan: the wider fix of review finding 8 of round 2.
- **Location:** `crates/mokly-model/src/content_types.rs`,
  `packages/mokly/src/sidecar/asset-imports.ts:3`, and
  `tests/sidecar_imported_assets.test.ts`.
- **Reason:** The fix adds the table to the shared code generation, outside
  the files of that branch.

- **Source:** Review.
- **Category:** Code structure.
- **Terms:**
  - **Asset type list:** the extensions that a JavaScript import delivers as a
    file, with their content types, under
    `docs/protocol/mokly-imported-assets.md`.
  - **Sidecar:** the Node process that bundles the product's JavaScript.
    `packages/mokly/src/sidecar/asset-imports.ts` decides there which imports
    give an asset token.
- **Background:**
  - The Rust tables in `crates/mokly-model/src/content_types.rs` hold the
    stylesheet asset types, the import-only types, and the `.txt` type once
    each. Since 2026-11-25 they are a documented export of `mokly-model`, and
    `mokly-css`, `mokly-graph`, `mokly-server`, and the Mokly Cloud crate
    `mkc-publications` read them. `xtask` already depends on `mokly-model`.
  - The sidecar keeps its own TypeScript list of the same extensions.
  - A Node test reads the Rust rows with a regular expression and compares
    them with the TypeScript list.
  - `cargo xtask generate-types` already writes TypeScript from Rust, for
    example `Namespace.ts` from `crates/mokly-model/src/namespace.rs`.
- **Problem:** The extension list exists in two languages, and only a text
  match of Rust source keeps them equal.
- **Impact if no action:** A format change of the Rust rows can break the
  test, and each new type needs an edit in two places.
- **Root question:** How can one definition give the asset extensions and
  their content types to Rust delivery, the stylesheet check, and the
  sidecar?
- **Options:**
  - **C.** Generate the TypeScript list from the Rust table with
    `cargo xtask generate-types`, and let the generated-file check replace
    the text match. Effort: Medium.
  - **E.** C, with the table moved to `crates/mokly-model` as a documented
    export. The move is done since 2026-11-25, when the content type rule
    moved the table there, so E is now the same work as C. Effort: Medium.
- **Left out:** A parity test of two lists keeps the copy. Sending the list in
  each bundle request changes the persisted bundle settings in about 30 Rust
  files.
- **Wider fix:** E. One export serves the generator, Serve, the stylesheet
  check, and the content type rule that Serve and Mokly Cloud share.
- **Previous examples:** None found.
- **Related:** None. The content type rule that needed the same export
  for Mokly Cloud was done on 2026-11-25.
- **Recommendation:** E. It removes the second list and serves the Cloud too.
- **Action:** fix after merge, apply E, because it changes a shared crate and
  the shared code generation outside the branch that found it.
