# Setup errors can omit the configuration file

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from round 1 of the implementation review of the
  branch `calummoore/storybook-track-d-finish-nkpi`, finding 39.
- **Location:** `packages/mokly/src/sidecar/vite-config.ts:33`,
  `packages/mokly/src/sidecar/vite-setup.ts:118`,
  `packages/mokly/src/sidecar/vite-compiler.ts:128`,
  `packages/mokly/src/sidecar/vite-compiler.ts:172`,
  `packages/mokly/src/sidecar/vite-errors.ts:29`, and
  `tests/sidecar_vite_config_loading.test.ts:119`.
- **Reason:** It is a Rare diagnostic defect of Medium severity, and the
  build error itself stays intact, so the branch that found it kept its
  scope.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Vite adapter:** The optional compile path that compiles JavaScript and
    transforms stylesheets through the project's own Vite setup.
  - **Setup:** The Vite config, its plugins, and the Vite server that Mokly
    loads for one side.
  - **Locator:** The source-map locator that the config loader builds from
    its esbuild config bundle, at
    `packages/mokly/src/sidecar/vite-config-bundle.ts:154`. It maps a stack
    frame to the config import that holds it.
  - **`loadSetup`:** The sidecar step that loads, resolves, and starts the
    setup. The `bundle` request and the `transformViteCss` request both use
    it.
- **Background:**
  - `docs/protocol/mokly-vite-adapter.md:161` says that a failure to load the
    setup names the Vite config file or the config import that failed. No
    Vite diagnostic shows an absolute path or a virtual module. An
    orchestrator design call of 2026-11-20 states the same rule. It asks for
    the config file or the config import, not for the plugin.
  - The message keeps the text of Vite in the form
    `{location}: {plugin}: {message}`.
  - The tests at `tests/sidecar_vite_config_loading.test.ts:119` cover
    exceptions that the config file or its imports throw while they evaluate.
  - The `transformViteCss` request opens the same setup. In a catalogue
    without JavaScript it is the first open, under a design call of
    2026-11-18. Its catch wraps each setup failure as
    `Vite plugin vite failed for {stylesheet}`, also a failure that already
    names the config file. See `packages/mokly/src/sidecar/vite-compiler.ts:172`
    and `viteStylesheetFailure` at `packages/mokly/src/sidecar/vite-errors.ts:29`.
    So a catalogue without JavaScript reports its setup failure at a
    stylesheet.
  - A hook that the config or a config import defines can throw inside
    `resolveConfig` or `createServer`. The locator maps that stack frame to
    the config import, and it falls back to the config file. See
    `vite-config-bundle.ts:154` and
    `packages/mokly/src/sidecar/vite-config-errors.ts:12`. `loadViteConfig`
    drops the locator together with the path.
  - Some failures name no file. Examples are a setup without a Vite config
    file, and Mokly's own bundle errors, such as
    `Vite setup changed during compilation` at `vite-compiler.ts:81`. Their
    message can start with an empty location.
  - Each setup error ends with `Vite {version}; tested range {range}`, at
    `vite-compiler.ts:130` and `vite-config.ts:45`. The range text comes from
    the peer declaration of `@mokly/mokly`. A regression test must not
    hard-code the range.
  - `docs/protocol/mokly-vite-adapter.md` has 249 lines under its 250-line
    cap.
- **Problem:** Mokly drops the selected config path after the export loads.
  If Vite then rejects a setting such as `envPrefix: ""`, the error has no
  module id. The fallback is the configuration directory. It formats as an
  empty location when it equals the source root.
- **Impact if no action:** The build fails with the setting error, but it
  gives the author no config file to open.
- **Root question:** How does every setup error identify the file that the
  author can correct?
- **Options:**
  - **A.** Use the selected config path as the fallback for Vite
    configuration validation errors. Add the invalid prefix case to the
    config error test. Effort: Small.
  - **B.** Keep the logical config location through setup evaluation,
    validation, and server creation. Use it when an error has no more
    specific import location. Effort: Medium.
  - **C.** Add structured source locations to setup errors across the sidecar
    and the core. This changes the diagnostic interface beyond the adapter.
    Effort: Large.
  - **D.** Locate setup failures once, in `loadSetup`:
    - Return the selected file and the locator from `loadViteConfig`.
    - Apply them to each error of the three steps of `loadSetup`. A hook in a
      config import then names that import, and other errors name the config
      file.
    - Let `transformViteCss` pass this located failure through without the
      stylesheet wrapper.
    - Give a failure that names no file a fixed, non-empty name in place of
      the configuration directory. Record that name in
      `docs/protocol/mokly-vite-adapter.md`. The page needs room under its
      cap.
    - Test `envPrefix: ""` through both requests, and a `configResolved` hook
      that throws in a config import.
    - Effort: Medium.
- **Left out:**
  - Search the error messages for a config file name. It fails the goal,
    because the validation errors of Vite have no file name.
  - Check known settings, such as `envPrefix`, in Mokly before Vite runs. It
    copies the rules of Vite and misses the other validation and hook errors.
  - A fixed name in place of an empty location, with no other change. It
    names no config file. D includes it.
  - Name the plugin whose setup hook threw. The design call of 2026-11-20
    asks a setup load failure to name the config file or the config import.
- **Wider fix:** D. One wrapper around the shared setup steps covers each
  request and each step, also a new step. B must carry the location into
  each phase.
- **Previous examples:** Commit `fa9b18de2` corrected setup errors that fell
  back to the entry file. `plans/follow-ups/sidecar-read-failure-location.md`
  records a similar problem of diagnostic attribution.
- **Related:**
  - At config load, the branch that found this item also records read-time
    digests of the config modules. It also records the files that the config
    loads through Node. One config load result can carry those records, the
    selected file, and the locator, so the fixes do not conflict.
  - `plans/follow-ups/vite-config-modules-own-url.md`: its fix replaces the
    esbuild config bundle that builds the locator. If it lands first, D needs
    the same per-file locator from the new loader.
  - `plans/follow-ups/vite-version-range-ci.md`: it decides whether the
    tested range in the message is true.
  - `plans/follow-ups/vite-replay-computed-imports.md`: through C only. A
    structured source location can also carry the authored caller of its
    missing-fetch diagnostic. This link does not change the recommendation.
  - `plans/follow-ups/vite-outside-env-directory.md`: its option A is a setup
    failure for an `envDir` outside the roots. The env snapshot runs after
    the setup loads, so D here does not reach that failure, and A must name
    the config file itself.
  - `plans/follow-ups/vite-config-request-kind.md`: same code. A
    `transformViteCss` request can open the setup first, as here. Its options
    C and D change the settings of that request, and its options A and B
    change the module paths with which the config loads.
- **Recommendation:** D, not the review's B. D is B at the one step that both
  requests share. It reuses the locator that the loader already builds, for
  the same Medium effort.
- **Action:** fix after merge, apply D, because it is a Rare diagnostic
  defect of Medium severity, and the build error itself stays intact.
