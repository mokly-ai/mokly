# Keep a stylesheet a stylesheet under every import name

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-23, from the branch
  `conductor/storybook-support-c-imported-assets`, track C of the Storybook
  support plan: review finding 9 of round 3.
- **Location:** `packages/mokly/src/sidecar/plugins.ts:45-70` and
  `docs/protocol/mokly-imported-assets.md:36-46`.
- **Reason:** The two fix rounds of that branch were used, and the finding is
  not critical.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Import attribute:** the `with { type: ... }` part of an import, such
    as `with { type: "json" }`.
  - **CSS route:** the resolve hook in `packages/mokly/src/sidecar/plugins.ts`
    that sends each import whose written name ends in `.css` to Mokly's
    stylesheet pipeline.
  - **Load hook:** the `onLoad` hook of the same file, which chooses the
    loader of every file that reaches it, in every resolution mode.
- **Background:**
  - Since 2026-11-23, an import attribute wins over every loader, except
    for a stylesheet, under `docs/protocol/mokly-imported-assets.md`.
  - The CSS route checks the written import name. An import that reaches a
    stylesheet without its `.css` name, such as `./theme`, `swiper/css`, or
    `@fontsource/inter`, goes to the load hook instead.
  - The default `resolveExtensions` include `.css`, so `./theme` can resolve
    to `theme.css`.
- **Problem:** With `.css: "empty"`, an import of `../theme` with the
  attribute `type: "json"` fails the build at `theme.css:1:1` with
  `Unexpected "." in JSON`. With `type: "text"`, it gives the CSS text. The branch before this
  change gave `{}` for both. Without an attribute, such an import fails every
  build with "Bundled source bytes were not recorded", also before the
  change, although the asset page says that Mokly's own loaders read CSS.
- **Impact if no action:** A catalogue that imports a stylesheet by a name
  without `.css` fails to build or gets the wrong value. Writing the full
  file name works around it.
- **Root question:** How can a stylesheet keep its stylesheet behaviour
  regardless of how the import names it?
- **Options:**
  - **A.** Route resolved CSS files with an attribute through the CSS route.
    A resolve hook alone misses native compiles. Effort: Small.
  - **B.** Classify CSS by its resolved file before any loader, in the
    resolve hooks of every resolution mode. The resolve hooks and the native
    plan are outside the files of that branch. Effort: Medium.
  - **C.** In the load hook, let a consumer `.css` or `.module.css` loader win
    over the attribute for a resolved `.css` file. The page then stays true
    only for names that end in `.css`. Effort: Small.
  - **D.** In the load hook, a resolved `.css` file skips the attribute and
    the JavaScript loaders, and gets the module of the CSS route: an empty
    default export for a plain stylesheet or an `empty` opt-out. The core
    then delivers it by its path. Package stylesheets such as `swiper/css`
    then build. Put the stylesheet module in a helper beside `plugins.ts`.
    Test with `text`, because a `json` case also passes through the full
    resolution retry. Effort: Medium.
  - **E.** D, and a CSS Modules file that an import reaches by another name
    gets its class map, through a `pluginData` marker that the two resolve
    hooks of `mokly:runtime` and `mokly:css-map:` accept. Those two lines
    belong to the resolve hooks. Effort: Medium.
- **Left out:**
  - Suppress the JSON error: the value stays wrong.
  - Reject an import without `.css`: it breaks the CSS exception and adds an
    error.
  - Remove `.css` from the default `resolveExtensions`: package exports and a
    CSS `main` stay broken.
- **Wider fix:** E. One rule at the load step holds for every name form and
  every resolution mode, and it gives CSS Modules their class maps.
- **Previous examples:**
  [bundle-recipe-query-suffix.md](bundle-recipe-query-suffix.md), where an
  import name differs from the resolved file path.
- **Related:** [file-loader-token-wording.md](file-loader-token-wording.md)
  edits the same "Loader choices" section of the styles guide.
- **Recommendation:** D. It holds in every resolution mode and adds no
  error. E protects the codebase best.
- **Action:** fix after merge, apply D, because the two fix rounds of the
  branch that found it were used, and the finding is not critical.
