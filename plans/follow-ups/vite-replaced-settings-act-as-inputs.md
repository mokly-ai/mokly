# Replaced settings still act as compiler inputs

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from round 1 of the implementation review of the
  branch `calummoore/storybook-track-d-finish-nkpi`, finding 7, option E,
  which also covers the repeat finding 91. The branch applied option C of
  finding 7, a direct fix for `postcss`. This item is its wider fix.
- **Location:** `crates/mokly-catalogue/src/config_inputs.rs:46`,
  `crates/mokly-catalogue/src/config_postcss.rs:48`,
  `crates/mokly-graph/src/config_key.rs:10`,
  `crates/mokly-graph/src/config_key.rs:13`,
  `crates/mokly-cli/src/changes_base_sources.rs:163`, and
  `crates/mokly-render/src/stylesheets.rs:75`.
- **Reason:** The split reaches every consumer of the resolved configuration
  on both compile paths, beyond the direct fix of the branch that found it.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Vite adapter:** The optional compile path that compiles JavaScript and
    transforms stylesheets through the project's own Vite setup.
  - **Replaced setting:** A configuration field that the Vite setup replaces
    under the adapter. These are `postcss` and the `moduleResolution`
    aliases, conditions, main fields, extensions, and most loaders.
  - **`ResolvedConfig`:** The configuration that `mokly-catalogue` resolves
    at load. Validation, source protection, the configuration key, the
    stylesheet settings, base preparation, and the sidecar requests read it.
  - **Active inputs:** The settings that the selected compiler uses.
  - **Configuration key:** The digest of the configuration inputs, in
    `crates/mokly-graph/src/config_key.rs`.
- **Background:**
  - Under the adapter, the Vite setup takes the place of `postcss` and of the
    `moduleResolution` aliases, conditions, main fields, extensions, and
    loaders. An orchestrator design call of 2026-11-18 says so. The package
    roots and the `"empty"` opt-outs for `.css` and `.module.css` still
    apply.
  - The user decided on 2026-11-25 that each replaced setting that the
    configuration holds gives one `vite-replaced-setting` configuration
    warning. The section "Replaced Settings" of
    `docs/protocol/mokly-vite-adapter.md` states it. The warning reads the
    field that the author wrote, also an empty one, under a design call of
    the same date. The user rejected a `config-invalid` failure for a
    replaced setting.
  - The default compiler checks the `postcss` file at configuration load,
    before any sidecar starts. See
    `docs/protocol/mokly-imported-styles-errors.md:29` and commit
    `4614c4a90`.
  - A configuration error carries no warnings:
    `CatalogueError::Config(Issue)` at `crates/mokly-catalogue/src/error.rs:28`.
  - The shape check of `postcss`, a non-empty string, is the same for both
    compilers. `config_postcss::shape` runs in `config_validation::parse`,
    before the shared schema. One schema serves both compilers and the
    editor.
  - The render path already drops the `postcss` module under Vite, at
    `crates/mokly-render/src/stylesheets.rs:75`.
  - On 2026-11-25 the branch that found this item applied option C below.
    Under Vite, Mokly now resolves nothing from `postcss`. The file and
    real-path rules of `docs/protocol/mokly-imported-styles-errors.md`,
    `docs/protocol/mokly-configuration.md`, and
    `crates/mokly-catalogue/README.md` now apply to the default compiler
    only.
- **Problem:**
  - Only the render path and, after the direct fix, the `postcss` resolution
    choose between the authored settings and the active inputs of the
    selected compiler. Each other consumer of `ResolvedConfig` reads the
    authored settings on both compilers.
  - Under Vite, the replaced `moduleResolution` fields stay in the
    configuration key, at `crates/mokly-graph/src/config_key.rs:10`. So an
    edit of a field that has no effect still moves the key.
  - Before the direct fix, a replaced `postcss` value had these symptoms
    under Vite. A removed module file gave `config-invalid` before the
    warning, also in a non-strict build. An existing old module stayed an
    input in four ways:
    - a module identity
    - a watched and protected source
    - a part of the configuration key, at `config_key.rs:13`
    - a trigger of base dependency preparation, at
      `crates/mokly-cli/src/changes_base_sources.rs:163`
  - Each new replaced setting, and each new consumer of the configuration,
    must repeat the choice by hand.
- **Screenshot:** Show the terminal output of a non-strict Vite build after
  the removal of the old PostCSS file, and mark the configuration error.
- **Impact if no action:** A setting that has no effect under Vite can still
  move keys, protect files, start base preparation, or fail validation. Each
  new consumer of the configuration can bring the defect back.
- **Root question:** Under the Vite adapter, how does each consumer read only
  the settings that the selected compiler uses, while the warnings read the
  authored settings?
- **Options:** A, B, C, and D are direct fixes for `postcss`. The branch
  applied C. E is the wider fix.
  - **A.** Keep the file check on both compile paths. Document that the Vite
    warning applies only after validation succeeds. This narrows the warning
    promise. Effort: Small.
  - **B.** Keep the shape and path checks. Apply the missing-file error to
    the default compiler only. Under Vite, warn for a well-formed path to a
    removed file. Update the two contracts together. Effort: Small.
  - **C.** Under Vite, resolve nothing from `postcss`. Keep only the checks
    that need no source access: the shape, the path text, lexical
    confinement, and the suffix. Record no module, no authored source, and
    no base-preparation trigger from the field. The warning still reads the
    authored value. Applied on 2026-11-25. Effort: Small.
  - **D.** Keep the missing-file failure under Vite, with its own text: the
    setting has no effect under the Vite adapter, so remove it. The
    non-strict build stays blocked, although the user chose a warning over a
    `config-invalid` failure. Effort: Small.
  - **E.** Split the configuration at load:
    - Split the resolved configuration into the authored settings and the
      active inputs of the selected compiler.
    - Validation, source protection, the configuration key, the stylesheet
      settings, base preparation, and the sidecar requests read only the
      active inputs.
    - The warnings read the authored settings.
    - This also removes the replaced `moduleResolution` fields from the
      configuration key under Vite.
    - It also changes the environment part of the render key in
      `crates/mokly-render/src/render_environment.rs`.
    - Cost: it reaches every consumer of `ResolvedConfig` on both compilers.
    - Effort: Medium.
- **Left out:**
  - A warning beside the fatal error. D is better on every point. It gives
    the same outcome in one consistent message, and it needs no warning list
    on `CatalogueError::Config`.
  - Accept malformed field shapes. The shape check and the schema serve both
    compilers and the editor.
  - A later file check, at the first use by the default compiler, is not a
    real choice. The contract runs the check before any sidecar starts.
  - An editor schema that rejects `postcss` under Vite is not a real choice.
    It is the `config-invalid` rejection that the user rejected.
- **Wider fix:** E. One split of the authored settings and the active inputs
  keeps every replaced setting out of validation, keys, source protection,
  and preparation. The documentation rule that code and protocol agree was
  in force and did not prevent this conflict, so it is not the wider fix.
- **Previous examples:** Commit `4614c4a90` moved the check of the configured
  PostCSS file into configuration resolution.
- **Related:** `plans/follow-ups/esbuild-omitted-conditions.md` changes the
  same `ModuleResolution` value, so that an omitted `conditions` field stays
  absent. E keeps the replaced fields out of the Vite inputs. Give the two
  changes one design.
- **Recommendation:** E. It keeps every replaced setting out of the compiler
  inputs at one place, and it keeps the warning on the authored field.
- **Action:** fix after merge, apply E, because E reaches every consumer of
  the resolved configuration on both compile paths.
