# Nested CSS URLs change escaped queries

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from round 1 of the implementation review of the
  branch `calummoore/storybook-track-d-finish-nkpi`, finding 67.
- **Location:** `packages/mokly/src/sidecar/vite-css-paths.ts:63`,
  `crates/mokly-css/src/compiler_assets.rs:73`, and
  `tests/vite_stylesheets.test.ts:95`.
- **Reason:** The defect changes only the text of the published CSS, and its
  wider fix waits for the user's answer on composed stylesheet assets.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Vite adapter:** The optional compile path that transforms stylesheets
    through the project's own Vite setup.
  - **URL suffix:** The query and the fragment after the path of an asset
    URL.
  - **Inlined stylesheet:** A stylesheet that Vite copies into its importer
    for an `@import`.
  - **`ViteCssUrls`:** Mokly's URL hook in
    `packages/mokly/src/sidecar/vite-css-paths.ts`. During a transform, it
    gives each relative `url()` a unique placeholder. After the transform,
    `restore` puts the rebased URL in place of the placeholder.
- **Background:**
  - Mokly uses only the path to find a CSS asset. It restores the original
    URL suffix on the delivered route. See
    `docs/protocol/mokly-imported-styles-assets.md:18`.
  - A host that meets the hosting contract finds files without the query.
    See `docs/protocol/mokly-export-delivery.md:7`. Serve finds a file by its
    path only, at `crates/mokly-server/src/application.rs:121`. So a doubled
    `%` gets the same asset bytes.
  - Vite inlines each nested import before Mokly sees its URLs. An
    orchestrator design call of 2026-11-23 chose this, because only the setup
    resolves aliased imports and the imports of preprocessors.
  - Both Vite transformers reach line 63 through the one URL resolver of
    `vite:css`, at `node_modules/vite/dist/node/chunks/node.js:29931` and
    `node.js:31432`.
  - Vite decodes each URL with `decodeURI`. `decodeURI` keeps each escape of
    `;/?:@&=+$,#`. Vite passes the raw text when decoding fails, at
    `node.js:29931`.
  - Vite's own development URL keeps the query that its decoder leaves, at
    `node.js:32621`. So only Mokly's `encodeURI` doubles the `%`.
  - Vite chooses the quotes of the `url()` from the placeholder alone, at
    `node.js:30779`. So a decoded space or quote in the final URL can break
    the token.
  - postcss-import and lightningcss read nested files from disk, at
    `node.js:30507` and `node.js:31344`. So no Vite hook sees their raw text.
    Under lightningcss, Vite runs no PostCSS step, at `node.js:30475`.
  - The core at `crates/mokly-css/src/compiler_assets.rs:73` sees only the
    transformed text. It cannot tell a changed suffix from an authored one.
  - The plugin report collector of the adapter skips Mokly's placeholder ids
    through `urls.owns`, at `packages/mokly/src/sidecar/vite-css-hooks.ts:89`
    and `packages/mokly/src/sidecar/vite-css-transform.ts:94`. Without that
    filter, the collector records a new random placeholder path as an absent
    file on each run.
- **Problem:**
  - In an inlined import, Vite's URL decoder leaves an escaped `%23` in a
    query intact. Mokly applies `encodeURI` to the full value at
    `vite-css-paths.ts:63`. So `?swatch=%23teal` becomes `?swatch=%2523teal`.
  - An invalid escape reaches line 63 raw, so line 63 escapes each of its
    `%` signs again.
  - `encodeURI` keeps `(`, `)`, and `'`. `restore` puts them into the `url()`
    that Vite left unquoted for the placeholder. So an authored `\(`, `\)`,
    or `\'` in an unquoted URL of an inlined stylesheet in another directory
    breaks the URL token. The browser then drops the declaration.
  - The nested-asset test at `tests/vite_stylesheets.test.ts:95` covers only
    a plain fragment.
- **Impact if no action:** The delivered asset request carries a different
  query value from the one that the author wrote. With an escaped bracket or
  quote in an unquoted URL, the browser drops the declaration.
- **Root question:** How does Mokly rebase a relative URL of an inlined
  stylesheet so that only its directory part changes?
- **Options:**
  - **A.** Save the suffix before Vite decodes the URL. Restore it through the
    existing placeholder. Add an escaped-query regression for the default
    transformer. A raw copy under lightningcss needs a lightningcss visitor.
    Effort: Medium.
  - **B.** Use the record of the source and the original URL that option B
    of `plans/follow-ups/vite-composed-stylesheet-assets.md` builds, across
    both transformers. Keep the suffix as data until the core writes the
    final URL. Effort: Large.
  - **C.** Encode around the escapes at line 63:
    - Keep each `%`, and encode the rest as now, for example with
      `url.split("%").map(encodeURI).join("%")`.
    - Make `restore` put the restored URL in a quoted CSS string.
    - Add `?swatch=%23teal`, and an unquoted URL with `\)`, to the nested
      stylesheet of the test at `tests/vite_stylesheets.test.ts:95`.
    - C fixes both transformers in one place and keeps the placeholder. It
      must know the `decodeURI` rule of Vite, so it is a direct fix.
    - Limits: the suffix can still differ in bytes, such as `(` for `%28`.
      An authored `%25` before two hex digits still decodes to other text.
    - Effort: Small.
- **Left out:**
  - Remove `encodeURI` completely. It fails the goal. Vite chooses the quotes
    from the placeholder alone, so a decoded space or quote then breaks the
    token.
  - Source-map provenance, in which Vite keeps each raw URL and Mokly finds
    the file of each URL in the CSS source map. It fails the goal when a
    PostCSS plugin writes coarse mappings or none. The composed rules of a
    CSS Module also have no source.
  - Match the decoded URL against the recorded bytes of its importer. It
    fails the goal when an earlier PostCSS plugin writes the URL. B gives the
    exact text on both transformers.
  - Upstream Vite is not a real choice. Vite's own URL keeps the query, and
    only Mokly's `encodeURI` doubles the `%`.
  - The core alone is not a real choice. It sees only the transformed text.
  - A Vite transform hook that runs before `vite:css` is not a real choice.
    No Vite hook sees the raw text of nested files.
- **Wider fix:** B. B still prevents the class when Vite changes its decoder,
  because the core then writes each URL from the authored text.
- **Previous examples:** `plans/follow-ups/bundle-recipe-query-suffix.md`
  records an earlier bundle recipe that lost the difference between the file
  path of an import and its query or fragment.
- **Related:**
  - `plans/follow-ups/vite-composed-stylesheet-assets.md`: the same code in
    `ViteCssUrls.resolve`, a shared wider fix, and work that waits. B here
    can start only when the user chooses B there. If the user chooses A
    there, and A sends the composed URLs through the same `resolve`, line 63
    also doubles the `%` in their queries. Then C must land with that A.
  - The plugin report collector of the adapter must keep the `urls.owns`
    filter while A or C keeps the placeholder. B can remove the filter only
    together with the placeholder.
  - After C lands, keep this item for B, and record C as done. If the user
    does not choose B of the composed asset item, ask the user whether B
    stays.
  - `plans/follow-ups/vite-css-url-resolution.md`: the same code. Its options
    B and C put their targets into the replacement table at line 63. Build
    each replacement with one encoding function, or land C here first, so
    that an escaped query keeps its text.
- **Recommendation:** C now, and B after the user chooses B of the composed
  asset item. C removes the doubled `%` on both transformers in a Small
  change, and B keeps its regression. The review recommended B alone.
- **Action:** fix after merge, apply C, and later B, because the item is Low
  and Rare, and B needs a record that waits for the user.
