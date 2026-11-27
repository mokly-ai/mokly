# Replay cannot load computed import targets

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-25, from round 1 of the implementation review of the
  branch `calummoore/storybook-track-d-finish-nkpi`, finding 37.
- **Location:** `packages/mokly/src/sidecar/vite-fetch.ts:132`,
  `packages/mokly/src/sidecar/vite-graph.ts:34`,
  `packages/mokly/src/sidecar/vite-evaluate.ts:114`,
  `tests/sidecar_vite_recipe.test.ts:13`, and the sections "Evaluation And One
  React Runtime" and "Recipes And Reuse" of
  `docs/protocol/mokly-vite-adapter.md`.
- **Reason:** No requirement says which computed imports the Vite adapter
  promises to load, and the user reviews each new requirement.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Vite adapter:** The optional compile path that compiles JavaScript
    through the project's own Vite setup.
  - **Computed import:** A dynamic `import()` whose specifier the code makes
    at run time, for example from an env value.
  - **Recipe:** The compiled record of one Vite generation. It holds each
    module fetch that the compile recorded.
  - **Replay:** The evaluation of a Vite generation from its recipe. Replay
    reads no current source file and runs no transform.
  - **Transform record:** Vite's result for one transformed module. It lists
    the static imports in `deps` and the dynamic imports in `dynamicDeps`.
- **Background:**
  - Vite's development runner can request a module when execution computes
    its path.
  - `docs/protocol/mokly-vite-adapter.md` says that `bundle` evaluates
    nothing, and that each module of a generation evaluates once. It also
    says that `restoreGeneration` replays a recipe in another process
    without a read of a current source file and without a transform.
    `docs/protocol/mokly-sidecar-recipes.md:22` and
    `docs/protocol/mokly-sidecar-modules.md:166` state the same rules. So an
    old generation never renders the bytes of a later edit.
  - The adapter records only the imports that Vite reports during the
    compile. `packages/mokly/src/sidecar/vite-fetch.ts:132` builds the import
    list of each module from `deps` and `dynamicDeps`. The recipe walk at
    `packages/mokly/src/sidecar/vite-graph.ts:34` follows that list.
  - Vite's SSR transform records a dynamic import only when its argument is
    a string literal, at `node_modules/vite/dist/node/chunks/node.js:16628`.
  - In serve mode, Vite turns a template literal with a `./` or `../` prefix
    and a file extension into `import.meta.glob`, at `node.js:32924`. The
    glob gives string-literal imports, at `node.js:27971`, and the walk
    records them. No Mokly test covers either form. The fixture uses only
    `import("./lazy.js")`, at `tests/fixtures/vite/src/page.mockup.ts:7`.
  - The runner loads a computed `data:` URL without a fetch, at
    `node_modules/vite/dist/node/module-runner.js:1199`, so it replays. A
    computed `node:` import misses, because replay answers `getBuiltins` with
    an empty list, at `packages/mokly/src/sidecar/vite-evaluate.ts:102`.
  - `docs/protocol/mokly-sidecar-modules.md:174` says that a resolution
    diagnostic names the logical module and the authored importer location.
    `docs/protocol/mokly-vite-adapter.md:161` says the same for the logical
    module. The replay miss names only the importer module. So a message that
    names the requested target applies a rule in force. Only the suggested
    import forms are new text.
  - A sidecar `diagnostic` event goes to the terminal reporter, at
    `crates/mokly-sidecar/src/workers.rs:18`. It has no build-warning code,
    so the strict rule does not count it.
  - The esbuild path runs one CommonJS bundle through `new Function`, at
    `packages/mokly/src/sidecar/evaluate.ts:52`, and records no fetches. A
    shared rule for both compile paths needs its own check.
  - Authors read `docs/guides/authoring/vite.md`, which ships with the
    package.
- **Problem:** An import that `@vite-ignore` marks can take a local path from
  an env value. Vite's development runner can load it, but Mokly fails with
  `Vite recipe has no recorded module fetch`. The protocol does not say which
  computed imports the adapter supports.
- **Impact if no action:** Authors meet a generic replay failure during
  evaluation. The failure does not say which import form to use. The failure
  fails closed and names the importer module. The author can change the
  import to a form that Vite records. These forms are a string literal,
  `import.meta.glob`, and a template literal with a `./` or `../` prefix and
  a file extension.
- **Root question:** Which dynamic imports does the Vite adapter promise to
  load from a recipe, and how does the author learn that an import is outside
  that promise before it fails?
- **Options:** Each option states the boundary in
  `docs/guides/authoring/vite.md` and in the section "Recipes And Reuse" of
  `docs/protocol/mokly-vite-adapter.md`. The boundary text names computed
  `data:` URLs and builtins. B and D add a replay test of each import form
  that the message suggests.
  - **A.** Document that Vite must find each local import target during the
    compile. Replay failures keep their current message. Effort: Small.
  - **B.** Record the supported boundary. Make the missing-fetch diagnostic
    name the authored caller and suggest an import form that Vite can find.
    Keep replay independent of the current filesystem. Effort: Medium.
  - **C.** Add an explicit list of candidate modules for computed imports,
    and capture those modules in the recipe. This adds configuration and
    makes recipes larger. The module graph order rule in the section "Module
    Graph" of `docs/protocol/mokly-vite-adapter.md` must then give the
    candidates a position. Effort: Large.
  - **D.** Apply B, and give a notice at compile time:
    - During the compile, find each dynamic import that Vite left without a
      record in a module that Vite transforms. This includes an import with
      `@vite-ignore`.
    - Read it from the transform record at
      `packages/mokly/src/sidecar/vite-fetch.ts:132`, so that a transform that
      Serve reuses also reports it.
    - Emit one sidecar `diagnostic` event for each such import. Give the
      logical module, the line from the transform's source map, and the
      import forms that Vite records.
    - Keep the replay failure for an import that runs.
    - D adds no gate, because the event has no build-warning code.
    - Cost: the notice also shows for an import that never runs, and for a
      computed `data:` URL, which works. The scan must skip the token in
      strings and comments.
    - Effort: Medium.
- **Left out:**
  - Fetch the current source when replay misses a target. An old generation
    could then render the bytes of a later edit.
  - Capture a missed target at its first evaluation in the compiling
    process, and add it to the recipe. The fetch reads bytes after the
    compile snapshot, and a target that runs only in another process or a
    later render still misses.
  - Run a discovery evaluation during `bundle`. It breaks the rules that
    `bundle` evaluates nothing and that each module evaluates once. An import
    that runs only during a render still misses.
  - Load a computed package target through Node at replay. The module graph
    never records that package, so render keys and Serve's watch miss it.
    Replay has no Vite resolver, so aliases and conditions can select another
    file. Node's import cache also keeps old exports in a retained process.
  - Treat each computed import as a glob over the source root. Every source
    file then enters the recipe and the inputs of the importer, so each edit
    moves its render keys.
  - Fail the compile on each unanalyzed dynamic import. It fails catalogues
    that build today when their computed import never runs. The always-on
    rules allow a failure only when the output would be wrong or unsafe. D
    gives the same early signal without a failure.
  - Forward Vite's own warnings, and remove `logLevel: "silent"` at
    `packages/mokly/src/sidecar/vite-setup.ts:101`. Vite gives no warning for
    an import with `@vite-ignore`, at `node.js:26693` and `node.js:32972`. D
    can reuse the text of Vite's rejected template-literal forms, at
    `node.js:32841`.
- **Wider fix:** D, not C. D reports every unanalyzed dynamic import,
  whatever the shape of its specifier. C must know each target. C also needs
  a replay lookup by file, because the recipe keys each fetch by URL and
  importer, at `packages/mokly/src/sidecar/vite-urls.ts:40`.
- **Previous examples:** `plans/follow-ups/base-template-import-resolution.md`
  records a separate computed import case on the default compile path.
- **Related:**
  - `plans/follow-ups/vite-import-glob-new-files.md`: this item points
    authors to `import.meta.glob`. That item records that Serve misses a new
    file that matches such a glob in a new subdirectory.
  - `plans/follow-ups/vite-lazy-css-order.md`: under C here, each captured
    target of a computed import is a dynamic edge, and its option B must give
    that edge the dynamic kind.
- **Recommendation:** D, not the review's B. D keeps the boundary text and
  the replay message of B. It also names each unanalyzed import with its line
  at compile time, also when the import runs only in a later render.
- **Action:** ask the user, because no requirement says which computed
  imports the adapter promises to load, so the boundary is a spec gap.
