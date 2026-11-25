# esbuild lists dynamic imports at source position

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from round 2 of the implementation review of the
  branch `calummoore/storybook-track-d-finish-nkpi`: the finding check of
  finding 110 put it outside the scope.
- **Location:** `packages/mokly/src/sidecar/metafile-edges.ts:156` to line
  165, and the esbuild order rule at
  `docs/protocol/mokly-sidecar-modules.md:77`.
- **Reason:** The esbuild order predates the Vite adapter work of the branch
  that found it, and each fix changes a requirement of the default compile
  path.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Esbuild path:** Mokly's default compile path, which bundles the
    catalogue's JavaScript with esbuild.
  - **Metafile:** Esbuild's report of the inputs and the import records of a
    bundle.
- **Background:**
  - The esbuild graph lists the imports of each module in source order,
    dynamic imports included, under `docs/protocol/mokly-sidecar-modules.md:77`
    to line 79. No recorded decision gives a reason for this order.
  - Mokly collects the stylesheets of each root with a depth-first walk of
    these lists, under `docs/protocol/mokly-imported-styles.md:76`.
  - The Vite adapter lists static imports first, then dynamic imports, under
    `docs/protocol/mokly-vite-adapter.md:146`, because the project's own Vite
    build loads lazy CSS after the initial CSS.
  - The esbuild metafile gives the `kind` of each import record
    (`node_modules/esbuild/lib/main.d.ts:475`), but `metafile-edges.ts:156`
    drops it.
  - The esbuild recipe hash covers each import list, at
    `packages/mokly/src/sidecar/bundle-recipe.ts:96`.
- **Problem:** On the esbuild path, the CSS behind an early dynamic import
  comes before a later static stylesheet of the same module. An application
  that Vite builds loads it after the initial CSS.
- **Impact if no action:** A project that builds with Vite but uses Mokly's
  default compile path can see a mockup cascade that differs from its
  application.
- **Root question:** In which order does the esbuild path place the
  stylesheets of dynamic imports?
- **Options:**
  - **A.** Keep the source order, and state it in the styles guide with the
    workaround: move the later static import before the dynamic import, or
    import the lazy stylesheet statically. Effort: Small.
  - **B.** List the static imports and re-exports first, then the dynamic
    imports, each group in record order, in `metafile-edges.ts`. Decide where
    CommonJS `require` calls go. State one order rule in the shared Bundling
    section of `docs/protocol/mokly-sidecar.md`, and remove the two
    path-specific order sentences. Cost: the stylesheet order of each
    affected catalogue changes, and the esbuild recipe hash and the render
    keys move once. Effort: Medium.
  - **C.** Report the edge kinds on both compile paths, and order the
    stylesheets in the core, as option C of
    `plans/follow-ups/vite-lazy-css-order.md` says. Effort: Large.
- **Left out:** None.
- **Wider fix:** C. One order rule in the core covers every depth on both
  compile paths.
- **Previous examples:** In round 1 of the same review, a finding check
  proposed the Vite order for the esbuild path. The final call kept one order
  for each compile path.
- **Related:** `plans/follow-ups/vite-lazy-css-order.md`: its option C also
  fixes this item. Decide the two together.
- **Recommendation:** B, unless the user takes option C of the lazy CSS order
  item. B gives the default path the order of a Vite build inside each
  module, at Medium effort.
- **Action:** ask the user, because each fix changes the esbuild order rule
  of `docs/protocol/mokly-sidecar-modules.md`, which no user decision covers.
