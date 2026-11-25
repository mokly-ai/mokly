# Virtual imports break the static-first import order

- **Severity:** High. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from round 2 of the implementation review of the
  branch `calummoore/storybook-track-d-finish-nkpi`: a new problem that the
  finding checks of findings 110 and 132 found.
- **Location:** `packages/mokly/src/sidecar/vite-graph.ts:60`,
  `packages/mokly/src/sidecar/vite-graph.ts:78`,
  `packages/mokly/src/sidecar/vite-fetch.ts:109`, and the section "Module
  Graph" of `docs/protocol/mokly-vite-adapter.md`.
- **Reason:** It needs a rare graph shape, and
  `plans/follow-ups/vite-lazy-css-order.md` changes the same graph code.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Vite adapter:** The optional compile path that compiles JavaScript
    through the project's own Vite setup.
  - **Virtual module:** A module that a plugin serves without a file, such
    as `virtual:icons`. It is not a module of Mokly's graph, and its file
    imports count as imports of its importer.
  - **Query variant:** A second record of one file with a query, such as
    `?raw`.
- **Background:**
  - Under the adapter, each module of the graph lists its static imports and
    re-exports first, then its dynamic imports, under
    `docs/protocol/mokly-vite-adapter.md:146`. An orchestrator design call of
    2026-11-19 chose this order, because a module evaluates its static
    imports first. The stylesheet walk follows these lists, so the order
    decides the CSS order.
  - The walk records the imports of each module from Vite's `deps` and
    `dynamicDeps`, static first, at
    `packages/mokly/src/sidecar/vite-fetch.ts:109`. The list keeps no edge
    kind.
  - `viteGraph` puts the file imports of a virtual module at the position of
    that module in its importer's list, at
    `packages/mokly/src/sidecar/vite-graph.ts:60` to line 72.
  - When two records name one file, such as a query variant, `viteGraph`
    appends the imports of the second record after the imports of the first,
    at line 78.
- **Problem:** A file that a statically imported virtual module imports
  dynamically comes before the later static imports of the importer. After a
  merge of two records, the static imports of the second record come after
  the dynamic imports of the first. In both cases, the list of a module puts
  a dynamic import before a later static import, against the adapter page.
- **Impact if no action:** The stylesheet behind such a dynamic import comes
  before a later static stylesheet, so the mockup cascade can differ from the
  project's Vite build.
- **Root question:** How does the Vite graph keep the static-first order of
  each module through virtual modules and query variants?
- **Options:**
  - **A.** Keep the edge kind inside the sidecar until `viteGraph` builds
    each list. A dynamic edge of a statically imported virtual module joins
    the dynamic part of the importer's list. A merge of two records puts each
    static edge first, then each dynamic edge, and a file that any record
    imports statically stays static. Test a virtual module with a dynamic
    stylesheet import before a later static stylesheet, and a query variant.
    No wire change. Effort: Small.
  - **B.** Apply option B of `plans/follow-ups/vite-lazy-css-order.md`, which
    reports the edge kinds on the wire and covers this case. Cost: it waits
    for that answer. Effort: Medium.
- **Left out:** Fewer than three approaches are real. The order rule is in
  force, and only the place that keeps the edge kind differs.
- **Wider fix:** B. Edge kinds on the wire let the core order the
  stylesheets at every depth. A is a direct fix.
- **Previous examples:** The branch that found this item fixed the order
  inside one module in commit `562c25c68`. Its graph test,
  `tests/sidecar_vite.test.ts:17`, has no virtual module and no query
  variant.
- **Related:** `plans/follow-ups/vite-lazy-css-order.md`: the same code and a
  shared wider fix. Its option B must carry the kinds through the same
  flatten and merge. A agrees with each answer there, because each of its
  options keeps the static-first order of each module.
- **Recommendation:** A. It restores the rule in force at Small effort, and
  it does not wait for the answer on the lazy CSS order.
- **Action:** fix after merge, apply A, because it needs a rare graph shape,
  and the fix does not get harder after the merge.
