# Sass can read outside selected roots

- **Severity:** High. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-25, from round 1 of the implementation review of the
  branch `calummoore/storybook-track-d-finish-nkpi`, finding 62.
- **Location:** `packages/mokly/src/sidecar/vite-css-hooks.ts:56`,
  `packages/mokly/src/sidecar/vite-css-hooks.ts:89`,
  `packages/mokly/src/sidecar/vite-plugin-inputs.ts:20`,
  `packages/mokly/src/sidecar/vite-css-transform.ts:92`, and
  `docs/protocol/mokly-vite-adapter-inputs.md:45`.
- **Reason:** Every option makes a build fail that passes today, and a new
  build failure needs the user's answer, although the protocol already
  requires the failure.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Vite adapter:** The optional compile path that transforms stylesheets
    through the project's own Vite setup.
  - **Selected roots:** The source root and the selected dependency roots
    that Mokly permits for the current render.
  - **Sass load path:** A directory that Sass searches after its other
    importers find no stylesheet. The setup names it in
    `css.preprocessorOptions.scss.loadPaths`.
  - **Plugin report:** A file that a Vite plugin reports with
    `this.addWatchFile`. Mokly skips a report outside the selected roots.
- **Background:**
  - `docs/protocol/mokly-sidecar-modules.md:69` to line 75 says that a file
    outside the source, the repository mapping, and the selected dependencies
    fails closed, for JavaScript and CSS alike.
  - `docs/protocol/mokly-vite-adapter-inputs.md:45` says that a plugin's
    report of a file outside the source root and the selected dependency
    roots is skipped with a sidecar `diagnostic` event.
  - A load by a preprocessor is a stylesheet import under the fail-closed
    rule, not a setup read under the plugin trust rule.
    `docs/protocol/mokly-vite-adapter.md:158` states the confinement rule.
  - `configureViteCss` already fails each outside import that Vite's CSS
    resolvers find. A load path is a fallback for the same import.
  - Vite's own `vite:css` plugin reports each file that it compiles with
    `addWatchFile`, at `node_modules/vite/dist/node/chunks/node.js:29954`.
    Mokly's wrapper skips each report outside the roots, at
    `packages/mokly/src/sidecar/vite-plugin-inputs.ts:30`.
  - The resolver hook at `packages/mokly/src/sidecar/vite-css-hooks.ts:56`
    can search the Sass load paths and the Less include paths itself. It can
    use Vite's own Sass and Less resolvers, before Sass and Less fall back to
    those paths.
  - The user moved the design of a read sandbox around the sidecar to
    `plans/follow-ups/confined-postcss-inputs.md`.
- **Problem:**
  - Sass can load a partial from an outside load path after Vite's resolver
    finds no match. Vite reports the read through `addWatchFile`. Mokly drops
    the outside path and keeps the CSS. Sources:
    `node_modules/sass/types/options.d.ts:229`,
    `node_modules/vite/dist/node/chunks/node.js:30977`, and `node.js:29952`.
  - Less has the same gap. When Mokly's Less resolver finds nothing, Vite
    falls back to the Less file manager, at `node.js:31115`. So a Less
    `paths` entry outside the roots behaves like a Sass load path.
  - Vite's Stylus processor never calls the CSS resolvers that Mokly
    confines, at `node.js:31226`. So a Stylus `@import` of a `.styl` file
    outside the repository inlines that file with only the skip diagnostic.
    This holds also for a plain relative import.
  - The outside-root test at `tests/sidecar_vite_plugin_inputs.test.ts:65`
    covers only a JavaScript report.
- **Impact if no action:** Published CSS can depend on unchecked files on the
  build host. Changes can compare output that depends on the host's files
  instead of the selected sources.
- **Root question:** How does Mokly enforce the source boundary for files
  that a stylesheet preprocessor actually loads?
- **Options:**
  - **A.** Check the loaded file list of the same Sass compile before Mokly
    accepts its CSS. This needs a narrow hook in the Sass integration and a
    regression test for an outside partial. Effort: Large.
  - **B.** Carry the actual preprocessor reads in a separate input record.
    Check them with the same path policy as direct stylesheet imports before
    delivery. This reaches all supported preprocessors. Effort: Large.
  - **C.** Allow declared Sass load directories as extra roots. Define how
    both sides select, snapshot, and watch those directories. This changes
    the source boundary. Effort: Large.
  - **D.** Resolve the load paths through Mokly's confining resolver:
    - In `configureViteCss`, when the resolution of the setup finds nothing,
      search `css.preprocessorOptions.scss.loadPaths` and the Less `paths`
      with Vite's own Sass or Less resolver from each path.
    - Confine the result with `lookup.stylesheet`. An outside partial then
      fails at its import with the existing
      `outside sourceRoot and selected dependency roots` error, and Sass
      never reads it.
    - Apply the same check to the `file:` results of the project's Sass
      importers.
    - Add tests for a load path inside and outside the roots.
    - Cost: Mokly repeats the lookup order of Sass and Less, which can drift
      from upstream. Stylus stays open, because Vite does not resolve Stylus
      imports.
    - Effort: Medium.
  - **E.** Fail on an outside stylesheet that Vite's own CSS compile
    reports:
    - In the `vite:css` wrapper at
      `packages/mokly/src/sidecar/vite-css-hooks.ts:89`, fail the transform
      when a reported file is outside the roots and has one of Vite's
      stylesheet suffixes.
    - Use the existing confinement error with the file's base name. Keep the
      skip and its diagnostic for each other report.
    - Change the plugin report sentence at
      `docs/protocol/mokly-vite-adapter-inputs.md:45`. Say in
      `docs/guides/authoring/vite.md:92` that preprocessor load paths must
      stay inside the roots.
    - Add a test with an outside Sass load path.
    - E covers Sass load paths and importers, Less include paths, and Stylus
      imports, with `sass` and `sass-embedded`. It needs no preprocessor
      hook.
    - Risk: it uses the suffix and the hook, not the actual read. An outside
      stylesheet that a plugin of the PostCSS config reports also fails. The
      esbuild path ignores such a report, as
      `docs/protocol/mokly-imported-styles-postcss.md:81` says.
    - Effort: Small.
- **Left out:**
  - Reject a load directory up front. It also rejects configurations that
    never use the directory. It also misses Sass importers and Stylus
    imports.
  - Treat every plugin report as an import, for the reports of other
    plugins' hooks. A watch-only report outside the repository would then
    stop a valid build. This approach comes back as E for the reports of
    Vite's own CSS compile.
  - Remove the outside entries from the Sass and Less path options. It fails
    the goal for a load path that holds files inside and outside the roots,
    such as a parent directory. Sass also reports a missing stylesheet in
    place of the confinement error.
  - Admit outside reads as inputs with freshness evidence and watches. Option
    B of `plans/follow-ups/postcss-probes-external-reads-environment.md` does
    this for PostCSS reads on the esbuild path. Here it fails the goal. The
    CSS still depends on files outside both sides. The same outside file also
    still fails as a relative import but passes through a load path.
  - A read sandbox around the sidecar. It also denies outside reads that
    plugins make with the trust of the consumer build, as
    `docs/protocol/mokly-vite-adapter.md:109` allows. An example is a
    Browserslist file above the repository. The user moved that design to
    `plans/follow-ups/confined-postcss-inputs.md`. It is the only approach
    that also catches a read that no report names. An example is a project
    Sass importer that loads an outside file under a URL that is not a
    `file:` URL, at `node.js:30981`.
- **Wider fix:** B. Build it in the plugin report collector of the adapter,
  and take its stylesheet reads from the report boundary of E. B then needs
  no hook for each preprocessor.
- **Previous examples:** `plans/follow-ups/confined-postcss-inputs.md`
  discusses confinement and reads outside the mapped roots on the esbuild
  path.
- **Related:**
  - The branch that found this item built one plugin report collector for
    both compile paths. It is a first Mokly plugin with `order: "pre"` load
    and transform hooks. Put the check of E in the classification of that
    collector, so that one rule decides each report. The classification can
    then sort each report into one of these kinds:
    - a regular file
    - a directory
    - an absent candidate
    - an advisory report outside the roots
    - a stylesheet read outside the roots, which fails
  - `plans/follow-ups/vite-renderer-pruning-css-modules.md`: its options C
    and D need a record of actual reads with the importer and the import's
    conditions. The record of B here can serve both items.
- **Recommendation:** E, not the review's A. E closes the gap for each
  preprocessor at Small effort, with no new Sass hook. A is Large, covers Sass
  only, and leaves Less include paths and each Stylus import open. If the
  user wants the error at the import and no read of the outside file, choose
  D.
- **Action:** ask the user, because every option adds a build failure for a
  stylesheet that builds today.
