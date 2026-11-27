# Describe file loader imports as asset tokens

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-23, from the branch
  `conductor/storybook-support-c-imported-assets`, track C of the Storybook
  support plan: review finding 10 of round 3.
- **Location:** `docs/guides/authoring/styles.md:153-165`,
  `docs/guides/authoring/config.md:81`,
  `crates/mokly-sidecar/src/results.rs:30`,
  `crates/mokly-catalogue/src/render_sources.rs:34`,
  `crates/mokly-graph/src/delivery_inputs.rs:19`,
  `crates/mokly-render/src/imported_assets.rs:1`, and
  `packages/mokly/src/sidecar/README.md:55`.
- **Reason:** The two fix rounds of that branch were used.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Asset token:** the string that an asset import gives to component code.
    Mokly replaces it with a document-relative URL in each document, under
    `docs/protocol/mokly-imported-assets.md`.
  - **`importedAsset`:** the flag of the module record that marks a module
    whose import gives an asset token.
- **Background:**
  - Since 2026-11-23, a configured `file` loader gives the same asset import
    as the default for images, fonts, and media, and also for `.txt`.
  - The protocol page states this correctly.
- **Problem:**
  - Both guides say that a `file` loader gives code a URL. Code gets an
    asset token.
  - `docs/guides/authoring/styles.md` also says that a configured loader
    overrides asset delivery, which is false for a `file` loader.
  - The flag comment in `crates/mokly-sidecar/src/results.rs`, the generated
    `Module.ts`, three more Rust doc comments, and the sidecar README call
    the flag "asset-default" only.
  - [attributed-import-module-names.md](attributed-import-module-names.md)
    defines an asset import as one that gives the component a URL.
- **Impact if no action:** Authors can take the token for a URL that they
  can fetch during a render, and maintainers can miss that `file` loads set
  the flag too.
- **Root question:** How can every guide, comment, and item describe a
  `file` loader import as the same asset import as a default import?
- **Options:**
  - **A.** Correct both guides and the flag comment, and regenerate
    `Module.ts`. Effort: Small.
  - **B.** Explain the difference once in the styles guide and link to it
    from the config guide, and correct the flag comment. Effort: Small.
  - **C.** A, and also the three Rust doc comments, the sidecar README, the
    "overrides" sentence, and the two follow-up items. Effort: Small.
  - **D.** B, with the corrections of C. The "Loader choices" section of the
    styles guide holds the one `file` rule: the same value and delivery as
    an image import, and each other configured loader replaces the delivery.
    The config guide keeps one sentence and links to that section. Effort:
    Small.
- **Left out:** Change the runtime value: one value cannot be a correct
  relative URL for documents at different depths. Rename `importedAsset`:
  the name already matches the protocol term.
- **Wider fix:** None. The `documentation` skill already requires one home
  for each fact and docs that match the code.
- **Previous examples:** None found.
- **Related:** [css-exception-resolved-file.md](css-exception-resolved-file.md)
  edits the same "Loader choices" section.
- **Recommendation:** D. Each fact then lives in one place, and every stale
  description of this cause is corrected.
- **Action:** fix after merge, apply D, because the two fix rounds of the
  branch that found it were used.
