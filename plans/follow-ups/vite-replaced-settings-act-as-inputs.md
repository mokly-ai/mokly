# Replaced settings still act as compiler inputs

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from round 1 of the implementation review of the
  branch `calummoore/storybook-track-d-finish-nkpi`, finding 7, option E,
  which also covers the repeat finding 91. The branch applied option C of
  finding 7, a direct fix for `postcss`. This item is its wider fix. On
  2026-11-25, round 2 of the same review added findings 112 and 139, which
  repeat each other: the render key symptom, the two protocol lines, the
  regression, and options F to I. The final call of round 2 kept E.
- **Location:** `crates/mokly-catalogue/src/config_inputs.rs:46`,
  `crates/mokly-catalogue/src/config_postcss.rs:48`,
  `crates/mokly-graph/src/config_key.rs:10`,
  `crates/mokly-graph/src/config_key.rs:13`,
  `crates/mokly-cli/src/changes_base_sources.rs:163`,
  `crates/mokly-render/src/stylesheets.rs:75`,
  `crates/mokly-render/src/side.rs:66`,
  `crates/mokly-render/src/render_environment.rs:151`,
  `crates/mokly-cli/src/base_dependency_selection.rs:16`,
  `docs/protocol/mokly-watch.md:78`, and
  `docs/protocol/mokly-watch-runtime.md:43`.
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
  - The replaced fields change no Vite output. The sidecar empties `aliases`
    and `resolveExtensions` (`packages/mokly/src/sidecar/vite-context.ts:36`,
    `packages/mokly/src/sidecar/vite-peers.ts:21`), and it reads only the two
    opt-outs (`packages/mokly/src/sidecar/vite-plugin.ts:187`). One reader
    stays: the restore of a generation uses the authored params
    (`packages/mokly/src/sidecar/vite-compiler.ts:131`), and its runtime
    fallback reads `resolveExtensions` for a module that Node cannot find
    (`packages/mokly/src/sidecar/compiled.ts:72`). A fix that sends the
    active values keeps this reader and the key equal.
  - A fix of 2026-11-25 gave equal Vite setup inputs equal render identities
    on both sides. It added the test
    `an_unchanged_vite_base_with_a_tracked_env_reuses_head_renders`, at
    `crates/mokly-render/tests/integration/side_reuse_tests.rs:163`. That test
    is the harness for the regression of E.
- **Problem:**
  - Only the render path and, after the direct fix, the `postcss` resolution
    choose between the authored settings and the active inputs of the
    selected compiler. Each other consumer of `ResolvedConfig` reads the
    authored settings on both compilers.
  - Under Vite, the replaced `moduleResolution` fields stay in the
    configuration key, at `crates/mokly-graph/src/config_key.rs:10`. So an
    edit of a field that has no effect still moves the key.
  - Under Vite, the bundle request and the render environment also carry
    the replaced fields. The head builder at
    `crates/mokly-render/src/side.rs:66` and the base builder at
    `crates/mokly-cli/src/base_dependency_selection.rs:16` read the authored
    fields. The render environment hashes the whole resolution record, at
    `crates/mokly-render/src/render_environment.rs:151`. So an edit of only a
    replaced field moves every JavaScript render key, and a base that
    differs only in a replaced field shares no render with the head. The
    advice of the warning creates that state on the branch that removes the
    field.
  - A fragment key holds the render input key and is shared across
    generations and sides (`crates/mokly-graph/src/fragments.rs:18`), and the
    render cache lives for the whole command
    (`crates/mokly-cli/src/entry_serve.rs:42`). So an edit of a replaced
    field renders every JavaScript fragment again. The bundle reuse key
    moves too (`crates/mokly-render/src/bundle_inputs.rs:94`). The stylesheet
    settings print the same fields (`crates/mokly-render/src/stylesheets.rs:61`),
    so every stylesheet root key moves, and Vite transforms every stylesheet
    again.
  - Two protocol rules have no Vite scope. `docs/protocol/mokly-watch.md:78`
    says that the bundle settings move every key.
    `docs/protocol/mokly-watch-runtime.md:43` says that a changed module
    resolution setting produces a new bundle generation. The fix must scope
    both rules to the settings that the selected compiler uses. Under the
    adapter, a replaced setting is not a bundle setting, so it moves no key
    and gives no new generation. This agrees with
    `docs/protocol/mokly-runtime.md:46`: a watched change renders only the
    outputs whose inputs changed. `docs/protocol/mokly-vite-adapter.md` has
    249 of its 250 lines, so the sentence goes on
    `docs/protocol/mokly-vite-adapter-inputs.md`.
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
  applied C. E is the wider fix, and F is its typed form. G and H are
  interim fixes for the keys. I carries the types of F onto the wire.
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
    - It reaches the side builders of both sides,
      `crates/mokly-render/src/side.rs:66` and
      `crates/mokly-cli/src/base_dependency_selection.rs:16`, and the
      stylesheet settings, at `crates/mokly-render/src/stylesheets.rs:61`. The
      bundle params, the bundle reuse key, and the render environment then
      follow from the side builders.
    - Add the protocol sentence of the problem above.
    - Regression: give only the base of
      `an_unchanged_vite_base_with_a_tracked_env_reuses_head_renders` a
      `moduleResolution.aliases` entry. Check that the base makes no render
      call and that the document keys are equal. Then give only the base a
      `".module.css": "empty"` loader, and check that the keys move. Add a
      head case in which an edit of only a replaced field makes no render
      call at the next preparation.
    - Cost: it reaches every consumer of `ResolvedConfig` on both compilers.
    - Effort: Medium.
  - **F.** Apply E, and give the active settings one type for each compiler
    at configuration load. The esbuild value holds every `moduleResolution`
    field. The Vite value holds the package roots and the `.css` and
    `.module.css` opt-outs. Each compiler consumer reads only its value, and
    only the warnings, at `crates/mokly-catalogue/src/config_warnings.rs:45`,
    read the authored fields. One function destructures `moduleResolution`
    with no `..` pattern and builds both values. So a new field fails to
    compile until someone classifies it, and the warnings and the keys cannot
    disagree. Effort: Medium, or Large if `ResolvedConfig.input` must change
    its shape for each test that builds it.
  - **G.** An interim filter: remove the replaced fields from the render key
    and the configuration key under Vite. Build the filter from an allowlist
    that keeps the package roots and the two opt-outs. Cost: the request
    still carries the authored values, so the key and the request can
    differ. Effort: Small.
  - **H.** An interim direct fix: build one effective Vite settings value at
    the two side builders, and use it in the bundle params, the stylesheet
    settings, and the render keys. Cost: the configuration key still holds
    the authored fields, so the document keys of the two sides stay unequal.
    Effort: Medium.
  - **I.** Apply F, and carry the same type onto the wire. Give the bundle
    request a resolution type for each compiler, and generate its TypeScript
    from Rust. Change the Vite readers
    (`packages/mokly/src/sidecar/vite-context.ts:36`,
    `packages/mokly/src/sidecar/vite-peers.ts:21`,
    `packages/mokly/src/sidecar/vite-plugin.ts:187`,
    `packages/mokly/src/sidecar/vite-node-peers.ts:94`) and the restore at
    `packages/mokly/src/sidecar/vite-compiler.ts:131`. No core builder can
    then send a replaced field to a Vite side. Cost: a shared-type change
    across Rust and the sidecar, both side builders, the generated types, and
    tests on both compile paths. Effort: Large.
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
  - Keep the keys, and rely on the warning, which tells the author to remove
    the field. It fails the goal while the two sides differ. The render store
    does not reduce the cost, because it skips each document whose compile
    has no stable reuse evidence (`docs/protocol/mokly-render-store.md:51`),
    and a Vite compile records none.
  - A sidecar report of the settings that a compile read, for the core to
    key on. E is better on every point, because it also covers the
    configuration key and the stylesheet settings, and it sends only the
    active values.
  - State in the protocol that a replaced setting stays a bundle setting. It
    fails the goal, and the warning tells the author that the setting has no
    effect.
  - Remove the whole `moduleResolution` from the Vite environment. It fails
    the goal, because the package roots, the selected installation, and the
    two opt-outs still apply.
  - A filter of the render key only. G is better on every point, because it
    also covers the configuration key at the same Small effort.
- **Wider fix:** E, under two conditions. First, the consumers reach only the
  active record. Today `side.rs:66`, `base_dependency_selection.rs:16`,
  `stylesheets.rs:61`, and `config_key.rs:10` read `config.input` directly,
  and such direct reads caused this item. Second, one function builds the
  active record from an allowlist and gives the field list of the warnings.
  F gives both conditions by type, and I extends them to the wire. Without
  these conditions, E is one more set of filters that a new field or a new
  consumer can bypass. The documentation rule that code and protocol agree
  was in force and did not prevent this conflict, so it is not the wider
  fix.
- **Previous examples:** Commit `4614c4a90` moved the check of the configured
  PostCSS file into configuration resolution.
- **Related:**
  - `plans/follow-ups/esbuild-omitted-conditions.md` changes the same
    `ModuleResolution` value, so that an omitted `conditions` field stays
    absent. E keeps the replaced fields out of the Vite inputs. Give the two
    changes one design.
  - `plans/follow-ups/vite-config-request-kind.md`: same code. Its options C
    and D fill the entry and stories lists of the `transformViteCss` call,
    which carries the bundle settings that I here changes. Give the two
    changes one design.
- **Recommendation:** E, with the two conditions of the wider fix. It keeps
  every replaced setting out of the compiler inputs at one place, and it
  keeps the warning on the authored field. Choose F, the typed form, when
  `ResolvedConfig.input` can keep its shape. If the user wants stable render
  keys before E lands, H is the interim fix, not G, because G lets the
  request and the key differ.
- **Action:** fix after merge, apply E, because E reaches every consumer of
  the resolved configuration on both compile paths.
