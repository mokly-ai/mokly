# Composed stylesheets lose their asset paths

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-25, from round 1 of the implementation review of the
  branch `calummoore/storybook-track-d-finish-nkpi`, finding 64.
- **Location:** `packages/mokly/src/sidecar/vite-css-paths.ts:56`,
  `crates/mokly-css/src/vite.rs:146`, and the section "CSS Modules" of
  `docs/protocol/mokly-vite-adapter-styles.md`.
- **Reason:** Each option changes an asset rule or a CSS Modules rule of the
  Vite adapter protocol, and no user decision covers that change.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Vite adapter:** The optional compile path that transforms stylesheets
    through the project's own Vite setup.
  - **Composition:** A `composes` declaration of a CSS Module. It adds classes
    and their rules from another stylesheet.
  - **PostCSS Modules:** The `postcss-modules` step that Vite's default CSS
    transformer uses for CSS Modules. Its `Loader` option reads the composed
    files.
  - **`ViteCssUrls.resolve`:** Mokly's hook in
    `packages/mokly/src/sidecar/vite-css-paths.ts`. It rebases each relative
    `url()` from the stylesheet that holds it.
- **Background:**
  - Mokly supports composition from another file under the adapter. See
    `docs/protocol/mokly-vite-adapter-styles.md:43`.
  - A relative asset URL resolves from the stylesheet that holds it. See
    `docs/protocol/mokly-imported-styles-assets.md:18`,
    `docs/protocol/mokly-vite-adapter-styles.md:32`, and
    `docs/guides/authoring/vite.md:110`. This rule stays. The project's own
    Vite build resolves a composed `url()` from the Vite root or leaves it
    unresolved, at `node_modules/vite/dist/node/chunks/node.js:8508` and
    `node.js:30713`. That is an upstream defect, and Vite warns about it.
  - Under the adapter, Mokly sets only the scoped names of CSS Modules. See
    `docs/protocol/mokly-vite-adapter-styles.md:83`. The user's decision of
    2026-11-06 chose the adapter because it removes Mokly's copies of the
    setup's CSS rules.
  - An orchestrator design call of 2026-11-23 chose Vite's own CSS Modules
    under the adapter. So Vite's default transformer flattens the composed
    rules into the stylesheet of the CSS Module.
  - PostCSS removes the source when it parses a joined string, at
    `node_modules/postcss/lib/container.js:205`. The scoped-name hook gets
    only a selector node, at `node_modules/vite/dist/node/chunks/build.js:5374`.
  - Short of a patch to PostCSS, the only hook is the `Loader` option of
    PostCSS Modules. Vite passes it on from `css.modules`, at
    `build.js:5717`, but Vite's type at
    `node_modules/vite/dist/node/index.d.ts:3115` does not name it. A loader
    also needs the ICSS `Parser`, which Vite bundles and does not export, at
    `build.js:187`.
  - PostCSS Modules runs first, and its loader gets none of the configured
    PostCSS plugins, at `node.js:30526` and `build.js:5731`.
  - The lightningcss transformer gives the resolver the file of each URL, at
    `node.js:31432`. So this problem is on the default transformer only.
  - Mokly supports `vite ^8.0.0`, at `packages/mokly/package.json:53`. An
    upstream fix in PostCSS Modules or Vite reaches only later Vite releases.
  - Each scoped name `mokly_<hash>_<local>` takes its hash from the logical
    path of the file that holds the rule, at
    `packages/mokly/src/sidecar/vite-css-hooks.ts:26`. So the name tells
    which file a rule came from.
  - Mokly runs Vite with `logLevel: "silent"`, at
    `packages/mokly/src/sidecar/vite-setup.ts:101`. So Vite's own warning for
    a URL without a file does not show.
- **Problem:** PostCSS Modules serializes the composed rules to a string and
  prepends it, at `build.js:5741`. PostCSS removes the source locations when
  it parses that string, at `container.js:203`. `ViteCssUrls.resolve` needs
  an importer. So the `./icon.svg` of a composed rule reaches the core
  relative to the top-level stylesheet, at `node.js:30711` and
  `crates/mokly-css/src/vite.rs:146`.
- **Screenshot:** In a component preview with two different icons of the same
  name, mark the background that shows the icon beside the top-level module.
- **Impact if no action:** A composed stylesheet in another directory can
  deliver the wrong image or font. The build can fail when the file exists
  only beside the composed stylesheet. A working Vite project rarely holds
  such a `url()`, because the project's own Vite build also loses its origin.
- **Root question:** How does each asset keep the stylesheet location that
  gives its relative URL meaning?
- **Options:**
  - **A.** Capture the origins of local URLs in the default CSS Modules
    loader, before it joins the composed rules. Add a regression with
    different images of the same name in both directories. A needs the same
    Mokly loader as C, and it adds a second URL rewrite to that loader. So it
    cannot cost less than C. Effort: Medium.
  - **B.** Carry the source location and the original URL together through
    Vite. Use the same record for imports, composition, and both CSS
    transformers, then deliver the asset in the core. Effort: Large.
  - **C.** Keep the original PostCSS nodes when the loader composes files.
    This needs a Mokly loader at the native CSS Modules loader boundary, and
    it keeps source locations for other PostCSS consumers. Vite's own URL
    rewrite then gives each composed URL its file, also in `@font-face`, and
    the existing `ViteCssUrls.resolve` rebases it. The loader must keep the
    export tokens and the rule order of Vite's loader. Effort: Medium with
    the `postcss-modules` package, Large with a hand copy.
  - **D.** Keep Vite's loader, and place each URL by its scoped names:
    - During a CSS Module transform, give each relative `url()` that reaches
      `ViteCssUrls.resolve` without an importer a placeholder that marks its
      origin as unknown.
    - After the transform, read the scoped names of the rule that holds the
      URL. Rebase the URL from the file that their hash names.
    - When no scoped name places the URL, or names of more than one file
      appear, keep the CSS Module as the base. Examples are `@font-face` and
      a `:global` rule. State that exception in the adapter protocol.
    - Add the regression with two different images of the same name.
    - D needs no Vite internal beyond the resolver hook that Mokly already
      sets. It keeps the rule that Mokly sets only the scoped names. The
      exception changes the asset contract for rules without a scoped name.
    - Effort: Medium.
  - **E.** Add a check to C or D:
    - Warn for each relative `url()` that still reaches
      `ViteCssUrls.resolve` without a source file and that the fix does not
      place. Keep the current base for that URL.
    - Vite gives a similar warning, but the silent log level hides it.
    - The check catches a lost origin on any path. Examples are a Vite
      release that stops passing `css.modules.Loader`, and a PostCSS plugin
      that creates declarations without a source.
    - It adds a warning field to `ViteCssResult`, at
      `crates/mokly-sidecar/src/results.rs:113`, and to the bundle. It adds a
      row to `docs/protocol/mokly-build-warnings.md`.
    - It needs the user's approval, because the warning fails `--strict`.
    - Effort: Medium.
- **Left out:**
  - Resolve every URL from the top-level stylesheet. It fails the goal when
    names repeat, or when the asset is only beside the composed file.
  - Search all composed folders. It fails the goal when more than one
    candidate folder holds a file of that name. D is not this search,
    because it picks the file from the scoped names of the rule.
  - Resolve from the Vite root, as the project's own Vite build does. It
    breaks the asset contract, which stays, and it copies a Vite defect.
  - A guide note that a composed `url()` resolves from the CSS Module. It
    keeps silent wrong assets when names repeat.
  - Deliver each composed file as its own stylesheet. Vite still prepends
    the composed rules, and the change breaks the design call that takes the
    scoped stylesheet from Vite's own CSS Modules.
  - A Mokly PostCSS plugin in the setup. PostCSS Modules runs first, and its
    loader gets no configured plugin.
  - An upstream fix alone. It reaches only later Vite releases. It can follow
    C.
  - A change in the core alone. The core gets the same flattened text. It
    can only search the composed folders, which stays out, or read the
    scoped names, which D does.
- **Wider fix:** E, with the chosen fix. Only a check at the point where a URL
  reaches Mokly without its file still catches the loss when the flattening
  changes shape. B needs a capture point at each flattening step, so for
  this class it is a direct fix. B stays the shared record for the URL text
  of `plans/follow-ups/vite-nested-css-url-escapes.md`.
- **Previous examples:** The same merged work already keeps the origin of
  assets in ordinary nested imports. The tests at
  `tests/vite_stylesheets.test.ts:95` and `tests/vite_stylesheets.test.ts:205`
  check the nested path and the composition path separately.
- **Related:**
  - `plans/follow-ups/vite-nested-css-url-escapes.md`: the same code in
    `ViteCssUrls.resolve`, at `vite-css-paths.ts:56` and line 63, and a shared
    wider fix. Its option B uses the record of B here, so its B waits for the
    answer to this item. C and D here send each composed URL through the same
    placeholder table as a nested URL. The fix of that item then covers both
    kinds of URL. A here rewrites the composed URL text inside the
    loader. That is a second URL path, and the fix of that item must cover it
    too.
  - `plans/follow-ups/vite-renderer-pruning-css-modules.md`: its option C
    needs a provenance record of each inlined rule. One record can serve
    that item and B here.
  - The `transformViteCss` row of the methods table in
    `docs/protocol/mokly-sidecar.md` links the generated `ViteCssResult` type.
    So the warning field of E needs no edit of that row.
- **Recommendation:** C, not the review's A. A cannot cost less than C. C
  keeps the processed nodes, so Vite's own URL rewrite gives each composed
  URL its file. If the user does not accept a Mokly loader inside Vite's CSS
  Modules, choose D.
- **Action:** ask the user, because each option changes an asset rule or a
  CSS Modules rule of the adapter protocol, which no user decision covers.
