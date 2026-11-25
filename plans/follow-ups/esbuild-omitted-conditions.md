# Omitted conditions remove esbuild's module condition

- **Severity:** Medium. **Likelihood:** Common. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from the finding check of finding 8 in round 1 of
  the implementation review of the branch
  `calummoore/storybook-track-d-finish-nkpi`, which put it outside the scope.
- **Location:** `packages/mokly/src/sidecar/resolution.ts:8`,
  `crates/mokly-render/src/side.rs:70`,
  `crates/mokly-cli/src/base_dependency_selection.rs:41`, and the section
  "Module Resolution" of `docs/protocol/mokly-configuration.md`.
- **Reason:** The line comes from commit `d935e6a66`, before the branch that
  found it, and its fix changes the shared transport type and the render
  keys.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **`moduleResolution`:** The configuration object that sets the aliases,
    conditions, main fields, extensions, loaders, and package roots of the
    esbuild compile path.
  - **Conditions:** The custom export conditions that esbuild uses when the
    `exports` field of a package selects a file.
  - **`module` condition:** The export condition that esbuild adds by default
    when no custom conditions are set.
  - **`ModuleResolution`:** The transport type of these settings between the
    core and the sidecar, generated into
    `packages/mokly/src/generated/sidecar/ModuleResolution.ts`.
- **Background:**
  - The section "Module Resolution" of `docs/protocol/mokly-configuration.md`
    says that `moduleResolution` has no defaults beyond esbuild's platform
    behaviour in the sidecar.
  - The core turns an omitted `conditions` field into an empty list, with
    `unwrap_or_default()` at `crates/mokly-render/src/side.rs:70`. The
    base-side dependency selection does the same, at
    `crates/mokly-cli/src/base_dependency_selection.rs:41`.
  - `resolutionOptions` gives esbuild `conditions: settings.conditions` on
    every compile, at `packages/mokly/src/sidecar/resolution.ts:8`. It gives
    `mainFields` and `resolveExtensions` only when their lists are not empty.
    `resolutionOptions` also feeds the PostCSS module lookups and the peer
    lookups of the Vite path.
  - The installed esbuild 0.28.2 sends `--conditions=` for an empty list, at
    `node_modules/esbuild/lib/main.js:732`.
  - A run on 2026-11-25 with esbuild 0.28.2 on Linux checked the effect. The
    `package.json` of a package `pkg` had this `exports` field:
    `{".": {"module": "./module.js", "default": "./default.js"}}`. An entry
    file called `require("pkg")`. The build call was
    `esbuild.buildSync({ entryPoints: [entry], bundle: true, write: false, platform: "node", metafile: true })`,
    as the sidecar bundles with `platform: "node"`. The results were:
    - `conditions` omitted: esbuild selected `module.js`.
    - `conditions: []`: esbuild selected `default.js`.
    - `conditions: ["custom"]`: esbuild selected `default.js`.
  - A design call of 2026-11-25 says that under the Vite adapter an authored
    `conditions` field gives the `vite-replaced-setting` warning, also when
    it is empty. Its reason rests on the field that the author wrote, so it
    stays true under each option below.
- **Problem:** A configuration that omits `conditions` gives esbuild an
  explicit empty list, so esbuild drops its default `module` condition. A
  package that offers a `module` target then resolves to another target than
  esbuild's own default. An omitted field and an empty list give esbuild the
  same option, so the author cannot get esbuild's default. This contradicts
  the rule of no defaults beyond esbuild's platform behaviour.
- **Impact if no action:** The esbuild path can load another file of a
  package than the project's own esbuild build loads. The only workaround is
  to write `"conditions": ["module"]` in the configuration.
- **Root question:** How does the esbuild path give esbuild the conditions
  that the author wrote, and esbuild's own default when the author wrote
  none?
- **Options:**
  - **A.** Change the protocol, not the code. State in
    `docs/protocol/mokly-configuration.md` that an omitted `conditions` field
    equals an empty list, so esbuild's default `module` condition never
    applies. This changes a requirement, so it needs the user. Effort: Small.
  - **B.** Carry an omitted `conditions` field as absent through
    `ModuleResolution`. Give esbuild `conditions` only when the configuration
    holds the field. Change the transport type and its generated TypeScript,
    the base-side selection, the CSS and PostCSS resolution inputs, the
    render keys, and their tests. Cost: package resolution on the esbuild
    path changes for each configuration that omits the field. Effort: Medium.
  - **C.** Give esbuild `conditions` only when the list is not empty, as for
    `mainFields` and `resolveExtensions`. It is a one-line change in
    `resolutionOptions`. Cost: an authored empty list then also gets
    esbuild's default, so the author can no longer remove the `module`
    condition with `[]`. That is itself a default beyond esbuild's behaviour
    for an explicit empty list. Effort: Small.
- **Left out:**
  - Change nothing. The code keeps contradicting the protocol.
  - A warning for an omitted `conditions` field. It does not fix the
    selection, and a new warning needs the user.
- **Wider fix:** B. The transport then carries the field as the author wrote
  it, present or absent, so Mokly adds no default of its own. The same rule
  can later apply to `mainFields` and `resolveExtensions`, whose empty lists
  Mokly drops today.
- **Previous examples:** None found.
- **Related:** `plans/follow-ups/vite-replaced-settings-act-as-inputs.md`
  keeps the replaced settings out of the Vite inputs, and B here changes the
  same `ModuleResolution` value. Give the two changes one design.
- **Recommendation:** B. It meets the protocol rule exactly: esbuild gets the
  conditions that the author wrote, and its own default when the author
  wrote none.
- **Action:** fix after merge, apply B, because the line predates the branch
  that found it, and B changes the shared transport type and the render
  keys.
