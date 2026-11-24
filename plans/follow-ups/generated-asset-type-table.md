# Generate the asset type list for both languages

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-21, from the branch
  `conductor/storybook-support-c-imported-assets`, track C of the Storybook
  support plan: the wider fix of review finding 8 of round 2.
- **Location:** `crates/mokly-css/src/imported_assets.rs`,
  `packages/mokly/src/sidecar/asset-imports.ts:3`, and
  `tests/sidecar_imported_assets.test.ts`.
- **Reason:** The fix moves a table into a shared crate and adds it to the
  shared code generation, outside the files of that branch.

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
  - Since 2026-11-21, the Rust tables in `crates/mokly-css/src/imported_assets.rs`
    hold the stylesheet asset types and the import-only types once each.
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
    the text match. `xtask` does not depend on `mokly-css`, so the generator
    must reach the table. Effort: Medium.
  - **E.** C, with the table moved to `crates/mokly-model` as a documented
    export. `mokly-css`, `mokly-graph`, and `mokly-server` read it, and a
    Mokly Cloud crate can read it without `lightningcss`. Effort: Medium.
- **Left out:** A parity test of two lists keeps the copy. Sending the list in
  each bundle request changes the persisted bundle settings in about 30 Rust
  files.
- **Wider fix:** E. One export serves the generator, Serve, the stylesheet
  check, and the content type rule of
  [asset-content-type-rule.md](asset-content-type-rule.md).
- **Previous examples:** None found.
- **Related:** [asset-content-type-rule.md](asset-content-type-rule.md) needs
  the same table as an export for Mokly Cloud. One branch can do both.
- **Recommendation:** E. It removes the second list and serves the Cloud too.
- **Action:** fix after merge, apply E, because it changes a shared crate and
  the shared code generation outside the branch that found it.
