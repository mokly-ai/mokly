# Lazy CSS can precede later static CSS

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-25, from round 2 of the implementation review of the
  branch `calummoore/storybook-track-d-finish-nkpi`, findings 110 and 132,
  which repeat each other. This item merges the options of both findings
  and of their finding checks.
- **Location:** `packages/mokly/src/sidecar/vite-fetch.ts:106`,
  `crates/mokly-render/src/stylesheets.rs:252`,
  `docs/protocol/mokly-imported-styles.md:76`, and the section "Module Graph"
  of `docs/protocol/mokly-vite-adapter.md`.
- **Reason:** Every option except A changes the depth-first stylesheet order
  of the shared imported stylesheet contract, and no user decision covers
  that change.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Vite adapter:** The optional compile path that compiles JavaScript and
    transforms stylesheets through the project's own Vite setup.
  - **Static and dynamic import:** A static import loads before its importer
    runs. A dynamic `import()` loads when the code calls it.
  - **Root:** A JavaScript entry point that gets its own stylesheet bundle:
    the renderer, the Storybook preview, or an entry module.
  - **Cascade:** The browser's choice among CSS declarations. Among rules of
    equal priority, the later rule wins.
- **Background:**
  - Mokly collects the stylesheets of each root with a depth-first walk of
    the module graph, dynamic imports included, and it delivers every lazy
    stylesheet eagerly, under `docs/protocol/mokly-imported-styles.md:76` to
    line 80. The walk is at `crates/mokly-render/src/stylesheets.rs:252`.
  - Under the adapter, each module lists its static imports first, then its
    dynamic imports, under `docs/protocol/mokly-vite-adapter.md:146`. An
    orchestrator design call of 2026-11-19 chose this order, because a module
    evaluates its static imports first. The sidecar builds each list from
    Vite's `deps` and `dynamicDeps`, at
    `packages/mokly/src/sidecar/vite-fetch.ts:109`.
  - The document links the renderer's bundle, then the preview's bundle,
    then the entry's bundle, under `docs/protocol/mokly-rendering.md:133`.
  - Vite's single-file CSS output collects the static closure of each entry,
    then the queued dynamic chunks
    (`node_modules/vite/dist/node/chunks/node.js:30224`). The development
    client and the split build add lazy CSS after the initial CSS, when the
    import runs (`node_modules/vite/dist/client/client.mjs:1285`,
    `node.js:27026`). So in a view that shows a lazy fallback, Vite has no
    lazy CSS at all.
  - The graph test `tests/sidecar_vite.test.ts:17` checks the order inside one
    module only.
  - Later Storybook support work marks imported assets in the same `Module`
    record, at `packages/mokly/src/sidecar/vite-graph.ts:75`. If both changes
    touch the wire type, make one `shared-types` change.
  - The branch that found this item also keeps the load edges of nested
    plugin loads beside the import list. Keep load edges out of
    `Module.imports`, because a module that `this.load` reads is not an
    import of the emitted code.
- **Problem:** An entry can import a helper and then `late.css`. If the
  helper dynamically imports a module with `lazy.css`, the walk enters the
  helper's dynamic subtree before the later static siblings of the entry. So
  Mokly places `lazy.css` before `late.css`, while Vite loads it after the
  initial CSS. Two rules of equal priority then select different values in
  the mockup and in the application.
- **Screenshot:** After the lazy component loads, mark the element whose
  colour differs between the Vite application and the Mokly Canvas.
- **Impact if no action:** A mockup can show a cascade that differs from the
  project's Vite build, with no error.
- **Root question:** Which lazy stylesheets should a view include, and at
  which position, so that its cascade matches the project's Vite build in the
  state that the view shows?
- **Options:**
  - **A.** Keep the current depth-first order, and state it on the adapter
    page and in `docs/guides/authoring/vite.md`. An author who needs Vite's
    order moves the later static import, or imports the lazy stylesheet
    statically. Effort: Small.
  - **B.** Keep the edge kind of each import on the Vite graph, and collect
    the static closure of each root before its queued dynamic closures:
    - Carry the kind through the virtual-module flatten and the merge of
      query variants, at `packages/mokly/src/sidecar/vite-graph.ts:60` and
      line 78. A file that the importer reaches through a dynamic edge is
      dynamic. A file that any variant imports statically stays static.
    - Keep the kinds beside the existing import map, because the render keys
      read that map, at `crates/mokly-graph/src/render_calculation.rs:39`.
      The graph that the core retains must keep the kinds too, at
      `crates/mokly-render/src/bundle_attempt.rs:106`, or a restored
      generation loses the order.
    - Change the `Module` wire type, so the `shared-types` skill applies.
      Change the `Module.imports` comment at
      `crates/mokly-sidecar/src/results.rs:42` and three protocol
      statements: `docs/protocol/mokly-imported-styles.md:76`,
      `docs/protocol/mokly-vite-adapter.md:146`, and
      `docs/protocol/mokly-vite-adapter-styles.md:32`.
    - Put the walk test in
      `crates/mokly-render/src/_tests_/stylesheet_walk_tests.rs`, with a
      nested dynamic import followed by static CSS. Extend the graph test
      with the kinds.
    - Cost: B keeps the cross-root form. CSS that only the renderer's dynamic
      imports reach still comes before the static CSS of the entry. A view
      that shows a `React.lazy` fallback has no lazy CSS in Vite, but B
      delivers that CSS after the initial CSS. So a lazy rule can then win
      over a later static rule on a shared selector, where today the static
      rule wins, as in Vite.
    - Effort: Medium.
  - **C.** Apply B on both compile paths. The esbuild graph builder, at
    `packages/mokly/src/sidecar/metafile-edges.ts:156`, reads the `kind` of
    each metafile import record (`node_modules/esbuild/lib/main.d.ts:475`).
    It reports a `dynamic-import` edge as dynamic, and every other kind,
    `require-call` included, as static. The shared contract then states one
    stylesheet order for both paths. Cost: the default path changes its
    stylesheet order for each dynamic import before later static CSS, also
    inside one module. The esbuild recipe hash
    (`packages/mokly/src/sidecar/bundle-recipe.ts:95`) and the bundle cache
    must include the kinds, or a reused compile keeps the old order. The
    render keys of the affected catalogues move once. Effort: Large, or
    Medium on top of B.
  - **D.** Apply B, and place the CSS that only the renderer's dynamic
    imports reach after the static CSS of each entry. The renderer bundle
    keeps the renderer's static closure. Each entry bundle adds the
    renderer's lazy files before its own queued dynamic closures. Cost: each
    entry bundle carries a copy, and an entry without CSS of its own gets a
    bundle. The renderer exclusion and the renderer pruning change, at
    `crates/mokly-render/src/stylesheets.rs:172` and
    `crates/mokly-render/src/bundle_styles.rs:79`. Effort: Large.
  - **E.** Keep eager delivery, but split the bundle of each root into an
    initial part and a lazy part. Link every initial part of the document
    before every lazy part. This also puts the lazy CSS of the renderer and
    of the preview after the initial CSS of the entry. Cost: a second route
    for each root that reaches lazy CSS, a new link order in
    `docs/protocol/mokly-rendering.md:126`, and new route-collision and CSS
    attribution cases. Effort: Large.
  - **F.** Deliver lazy CSS for each view, and only for the dynamic imports
    that resolved before the view rendered. The sidecar records the modules
    that its runner evaluated through a dynamic import before the render,
    and it returns them with the render result. The core links the
    stylesheet closure of each such import after every initial bundle of the
    document, as Vite's preload helper appends a lazy stylesheet at the end
    of the head. Cost: the stylesheets of a view then depend on its render,
    not only on the module graph. Routes, render keys, the resource closure
    of a static build, and the CSS attribution of Changes change. The first
    render of a `React.lazy` component must give the same output in every
    render order first, or the CSS follows an accident of render order.
    Effort: Large.
- **Left out:**
  - Reorder each module's import list again. It fails the goal. Each list
    already has the static-first order. The difference comes from the walk,
    which enters the dynamic subtree of a static import before the later
    static siblings of its importer, at
    `crates/mokly-render/src/stylesheets.rs:260`.
  - Let the sidecar report an ordered stylesheet list for each root. B is
    better on every point: the same order at lower effort, one ordering home
    in the core, and no second result that replay must carry.
  - Deliver only the initial closure under the adapter. It fails the goal,
    because a view that shows lazy content loses its styles, for example
    after a top-level `await import()`, as in
    `tests/fixtures/vite/src/page.mockup.ts:7`.
  - Order by the evaluation that the sidecar observes. It breaks the rule
    that `bundle` evaluates no module of the generation, in the section
    "Bundling" of `docs/protocol/mokly-sidecar.md`. The order can also change
    between renders, against the byte-identical output rule in the section
    "Bundling" of `docs/protocol/mokly-imported-styles.md`.
  - Read the order from a Vite build in memory. B gives the order of Vite's
    single-file CSS output without a second compile, and the adapter loads
    the setup with the command `serve` only.
  - Move each dynamic edge up to the root in the reported graph. B is better
    on every point. The same graph feeds render keys, watch inputs, and asset
    collection, and the one list of a module cannot give a different
    position for each root that shares the module.
- **Wider fix:** F. It orders lazy CSS at the level of the document and
  includes only the lazy CSS that the view used, so it covers the cross-root
  form and the views that show a fallback. C applies one order wherever a
  graph reports edge kinds, so it also covers the esbuild path.
- **Previous examples:** The branch that found this item fixed the order
  inside one module in commit `562c25c68`, with the `Module.imports` comment
  at `crates/mokly-sidecar/src/results.rs:42` and the graph test. The review
  of that fix already recorded this case across modules.
- **Related:**
  - `plans/follow-ups/vite-graph-flatten-import-order.md`: the same code. Its
    direct fix keeps the static-first order of each module through the
    virtual-module flatten and the query-variant merge. B must carry the
    kinds through the same code.
  - `plans/follow-ups/react-lazy-first-render-fallback.md`: work that waits,
    for F only. F needs a render whose output does not depend on render
    order.
  - `plans/follow-ups/esbuild-dynamic-import-css-order.md`: C here also fixes
    that item. Decide the two together.
  - `plans/follow-ups/vite-replay-computed-imports.md`: the same code. If
    that item takes its option C, each captured target of a computed import
    is a dynamic edge, and B must give it the dynamic kind.
  - `plans/follow-ups/vite-renderer-pruning-css-modules.md`: the same code. B
    changes only the order of the walk, not the files that the renderer
    removes. D changes the renderer exclusion that that item also changes, so
    decide D with that item.
- **Recommendation:** B. It gives the order of Vite's own single-file CSS
  output, and it keeps eager, deterministic delivery. Choose C if the user
  also wants one rule on the default path.
- **Action:** ask the user, because every option except A changes the
  depth-first order of the shared stylesheet contract, and B gives the Vite
  path another order than the esbuild path.
