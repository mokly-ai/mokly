# A raw stylesheet import gives an empty object

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from review area 4 of round 1 of the implementation
  review of the branch `calummoore/storybook-track-d-finish-nkpi`, which put
  it outside the scope.
- **Location:** `packages/mokly/src/sidecar/vite-plugin.ts:114`,
  `packages/mokly/src/sidecar/vite-plugin.ts:154`,
  `packages/mokly/src/sidecar/vite-graph.ts:48`, and
  `docs/guides/authoring/vite.md:47`.
- **Reason:** The line came with merged Vite adapter code before the branch
  that found it, and the fix changes the module graph rule of the adapter.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Vite adapter:** The optional compile path that compiles JavaScript and
    transforms stylesheets through the project's own Vite setup.
  - **Query import:** An import whose specifier ends in a Vite query, such as
    `./card.css?raw`. Under `vite dev`, `?raw` gives the file text as a
    string, and `?inline` gives the transformed CSS as a string. Neither
    applies the CSS to the page.
  - **Module graph:** The files and import edges that the sidecar reports for
    a generation. The core reads the stylesheet order from these edges.
  - **`viteCss`:** The function in `packages/mokly/src/sidecar/vite-urls.ts`
    that gives Mokly's virtual id for a stylesheet import: `\0mokly-css:`
    and the file path in base64url form.
- **Background:**
  - The guide `docs/guides/authoring/vite.md:47` promises that queries such
    as `?raw` work as in `vite dev`.
  - The section "Module Graph" of `docs/protocol/mokly-vite-adapter.md` says
    that a file that a query selects, such as `?raw`, `?url`, or `?react`,
    counts as its file with its bytes. No rule says how Mokly delivers a
    query import of a stylesheet.
  - The resolve hook of Mokly's plugin returns `viteCss(confined)` for each
    resolved import whose file is a stylesheet, at `vite-plugin.ts:114`. That
    id drops the query part of the resolved id. The last branch of the same
    hook keeps the query: `confined + resolved.id.slice(file.length)`.
  - The load hook then returns `export default {};` for a plain stylesheet,
    or the class map module for a CSS Module, at `vite-plugin.ts:154` to
    line 164.
  - `viteGraph` in `packages/mokly/src/sidecar/vite-graph.ts` maps each
    module id to its file. So a query import of a stylesheet becomes an edge
    to the stylesheet itself. The stylesheet scan of the core, in
    `crates/mokly-render/src/stylesheets.rs`, delivers each imported file
    with a stylesheet suffix.
  - The Vite tests use `?raw` only on `.txt` and `.ts` files, at
    `tests/fixtures/vite/src/page.mockup.ts:5`,
    `tests/fixtures/vite/src/screen.mockup.tsx:6`, and
    `tests/fixtures/vite_incremental.ts:65`. No test imports a stylesheet
    with a query.
  - The line came with commit `38c310ccc` on 2026-11-23, which sends
    stylesheets through the project's Vite setup.
- **Problem:**
  - `import text from "./card.css?raw"` gives `{}` in place of the CSS text.
    The same import of a CSS Module gives its class map. `?inline` gives the
    same wrong values.
  - The graph edge goes to the stylesheet itself. So the core probably also
    links its CSS into the document of the entry, which `vite dev` does not
    do for these queries. Nobody has checked this second effect with a run.
- **Impact if no action:** A view that shows the text of a stylesheet renders
  `[object Object]`, or it fails when it calls a string method on the value.
  The page can also get CSS that the project's own build does not apply.
- **Root question:** How does a query import of a stylesheet give the value
  and the page effect that `vite dev` gives?
- **Options:**
  - **A.** Keep the query and tell the core:
    - Keep the query of a stylesheet import in the module id, so that Vite's
      own query handling gives the value.
    - Mark such an edge in the module graph as no stylesheet import, for
      example with a separate list of the imports that are not stylesheets.
      The file stays a module input with its bytes, and the core does not
      deliver it as a stylesheet.
    - Add the rule to the section "Module Graph" of
      `docs/protocol/mokly-vite-adapter.md`.
    - Test `?raw` and `?inline` on a plain stylesheet and on a CSS Module.
      Check the value, and check that the document links no stylesheet for
      the import.
    - Effort: Medium.
  - **B.** Answer `?raw` in Mokly's load hook only. Return the file text as
    the default export, as Vite does. Keep the delivery as today. Cost:
    Mokly copies one rule of Vite, `?inline` stays wrong, and the CSS stays
    linked. Effort: Small.
  - **C.** Narrow the guide promise. Say in `docs/guides/authoring/vite.md`
    that a query import of a stylesheet does not work under the adapter, and
    fail such an import with a diagnostic. Cost: a new failure for imports
    that `vite dev` accepts, which needs the user. Effort: Small.
- **Left out:**
  - Change nothing. The guide promise stays false.
  - Treat each query import of a stylesheet as an asset URL. `?raw` and
    `?inline` give strings, not URLs, so it fails the goal.
- **Wider fix:** A. One graph rule then covers every query of a stylesheet,
  and Vite's own plugins give each value. B must copy each query rule of
  Vite.
- **Previous examples:** `plans/follow-ups/bundle-recipe-query-suffix.md`
  records an earlier loss of the query of an import, in the bundle recipes
  of the esbuild path.
- **Recommendation:** A. It meets the guide promise for every query, and the
  project's own Vite gives each value.
- **Action:** fix after merge, apply A, because the line predates the branch
  that found it, and A changes the module graph rule of the adapter.
