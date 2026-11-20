# Serve watches installed modules at their logical paths

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-01, from the options check of the unmerged plan of the
  closed "perf 6" workspace, 2026-10-30, which put it outside its scope. On
  2026-11-20, round 1 of the implementation review of the branch
  `calummoore/mokly-stylesheet-resolution-evidence-fix-qnp4`, at commit
  `95d89823d`, added option D. D is the wider fix that the final call split
  off finding 1 of that review. The finding check of that round put the same
  JavaScript problem outside the scope of the branch.
- **Location:** `crates/mokly-render/src/bundle.rs:199` and line 209,
  `crates/mokly-cli/src/serve_watch_plan.rs:46` and line 99,
  `crates/mokly-render/src/bundle_attempt.rs:108` and line 128,
  `crates/mokly-watch/src/plan.rs:129`,
  `packages/mokly/src/sidecar/module-paths.ts:150`,
  `crates/mokly-render/src/runtime.rs:200`,
  `crates/mokly-render/src/side.rs:159`, and
  `crates/mokly-render/src/stylesheet_watch.rs:11`.
- **Reason:** The stylesheet resolution fix of 2026-11-20 changes only CSS
  watch inputs, and this work changes JavaScript watch inputs outside its
  diff.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Serve:** the development command that serves a catalogue and watches
    its inputs.
  - **Dependency root:** a `node_modules` directory that the sidecar
    resolves packages from, in Node lookup order from the configuration,
    then one for each `moduleResolution.packageRoots` entry.
  - **Authored alias:** the repository path that names a dependency root
    before symbolic links resolve, such as `app/node_modules` for a
    configuration in `app`.
  - **Logical path:** the name that the sidecar gives an installed module:
    `node_modules/{path}` in the first dependency root, and
    `node_modules/.mokly-roots/{n}/{path}` in root `n`.
  - **Resolution files and directories:** the repository-relative files, and
    directories with the names they hold, that Serve watches for each
    JavaScript generation, in `JavaScriptGeneration` of
    `crates/mokly-catalogue/src/render_sources.rs`.
- **Background:**
  - Mokly's Node sidecar, under `packages/mokly/src/sidecar`, bundles the
    JavaScript modules of a catalogue with esbuild. A canonical path, or real
    path, has every symbolic link resolved. `ModulePaths.create` resolves
    each dependency root to its canonical path, at
    `packages/mokly/src/sidecar/module-paths.ts:47`.
  - The sidecar reports each bundled module by its logical path, in
    `packages/mokly/src/sidecar/module-paths.ts:150`. Its resolution metadata
    and its consumed-module directories use the same logical names. The
    metadata holds the `package.json` and `tsconfig.json` candidates, also
    the missing ones.
  - `stamp` in `crates/mokly-render/src/bundle_attempt.rs:108` joins each
    logical path to the repository root. Line 128 leaves out `.css` modules.
  - `finish` in `crates/mokly-render/src/bundle.rs:173` strips the
    repository root again. It builds the resolution files at line 199 and
    the resolution directories at line 209. So both keep logical names, such
    as `node_modules/.mokly-roots/1/pkg/package.json`.
  - `PlanInputs::of` reads both at
    `crates/mokly-cli/src/serve_watch_plan.rs:46`. `PlanRecord::new` gives
    them to the watch plan without a mapping, at line 99. `Plan::resolution`
    in `crates/mokly-watch/src/plan.rs:129` watches each one under the
    repository root. The watch plan is their only reader outside tests.
  - No code creates a `.mokly-roots` directory, so the watch path of a module
    in a later root names no file. A module in the first root gets a watch
    path under `{repository}/node_modules`, also when that root is
    elsewhere. No run has reproduced the JavaScript case yet.
  - The source tree maps logical paths to the real dependency roots, in
    `SideTree::mapped` at `crates/mokly-render/src/sources.rs:37`. So the
    input check of a bundle reads the right file. The watcher does not use
    that map.
  - `Runtime::side`, at `crates/mokly-render/src/runtime.rs:200`, selects
    the dependency roots of a side. It resolves each root to its canonical
    path at line 224. It merges roots with one canonical path at line 228.
    It records each authored alias in `SideInputs.dependency_aliases`, at
    line 236. So two authored aliases can name one logical root.
  - Containment checks compare canonical paths, in `SideTree::project` at
    `crates/mokly-render/src/sources.rs:234` and in
    `SideInputs::logical_dependency` at `crates/mokly-render/src/side.rs:133`.
    So `SideInputs.dependency_roots` must stay canonical.
  - `Plan::classify`, at `crates/mokly-watch/src/plan.rs:197`, acts on an
    event at an exact watch path, at an ancestor of one, or in a resolution
    directory. A link that gets a new target gives an event at the path of
    the link. So each authored alias must be a watch path or an ancestor of
    one.
  - Since 2026-11-20, Serve also watches the captured resolution inputs of
    each stylesheet. `files`, at
    `crates/mokly-render/src/stylesheet_watch.rs:11`, maps each logical input
    to its watch paths. It calls `SideInputs::watch_candidates`, at
    `crates/mokly-render/src/side.rs:159`, for the path under the selected
    root and under every authored alias. Then it adds the canonical path of
    each candidate.
  - For each logical path, that mapping returns the path under the selected
    root, the path under every authored alias, and the canonical path of
    each. It also maps the bare root names `node_modules` and
    `node_modules/.mokly-roots/{n}`. It returns no `.mokly-roots` name.
  - The stylesheet cache maps the logical inputs again at each delivery, at
    `crates/mokly-render/src/stylesheet_cache.rs:155`. So a cache hit after
    a link retarget names the current installation. A base preparation skips
    this mapping.
  - The stylesheet watch had the same class of gap before its alias-aware
    mapping. Take `/repo/app/mokly.config.json`, where `app/node_modules`
    links to `/repo/install-one`. Root selection resolved the link, so the
    watch paths held `install-one` and `node_modules`, not
    `app/node_modules`. A retarget of `app/node_modules` gave an event that
    the watch plan ignored. Serve kept the old CSS.
  - The stylesheets that the renderer and the entry modules import become
    stylesheet roots of the render graph, at
    `crates/mokly-render/src/graph.rs:183`. So the stylesheet watch covers
    them. Nobody checked whether a watch covers a CSS Module that only the
    class-map pass compiles, at `crates/mokly-render/src/bundle.rs:262`.
  - `docs/protocol/mokly-watch.md` requires Serve to watch the sidecar's
    reported modules, also beneath `node_modules`. It counts missing
    manifest and tsconfig candidates as resolution metadata. Its denial
    rules prune `node_modules` from broad traversal, but they keep each
    exact required file.
- **Problem:** Serve watches JavaScript resolution files and directories at
  their logical paths. When the first dependency root is not
  `{repository}/node_modules`, or a module comes from a later root, that
  path names the wrong file or no file. An edit, an install, or a retarget
  of an authored alias there then starts no rebuild.
- **Impact if no action:** For a configuration in a nested package, or one
  with configured package roots, previews stay stale after an install or a
  link retarget. They stay stale until Serve restarts or another watched
  edit starts a rebuild.
- **Root question:** How can Serve observe a change at every path that
  selects a JavaScript module or its resolution metadata?
- **Options:**
  - **A.** Change nothing, and tell users to restart Serve after an install
    in a nested package. Effort: Small.
  - **B.** Map each logical path to its real path with the dependency roots
    of the side. Put the mapping in one helper that the input check and the
    watch plan share. Include the `.css` modules when the stylesheet watch
    does not cover them. It keeps one real path for each logical path, so a
    retarget of an authored alias still starts no rebuild. Effort: Medium
    (estimate).
  - **C.** Let the sidecar report the real path beside the logical path,
    and watch the real path. This changes the `bundle` result. The sidecar
    sees only real paths, so the core must still add each authored alias.
    Effort: Medium (estimate).
  - **D.** Send the JavaScript resolution files and directories through the
    alias-aware mapping that the stylesheet watch uses. One mapping then
    serves CSS and JavaScript, so no watch input can drop an authored alias.
    It meets the existing watch requirement, so no protocol page changes. It
    changes JavaScript watch inputs outside the files of the stylesheet
    resolution fix, and it needs a JavaScript regression test. Effort:
    Medium.
    - Reuse the whole mapping, with its canonical step, not only
      `SideInputs::watch_candidates`.
    - Move that mapping out of the stylesheet module, so that both callers
      share it.
    - Map in `finish`, with the `SideInputs` of each delivery, so that a
      retained bundle names the current installation.
    - Skip the mapping in a base preparation, as the stylesheet watch does.
    - Keep `SideInputs.dependency_roots` canonical.
    - Keep every authored alias, also when two aliases share one canonical
      root. Map the bare logical roots too.
    - Keep repository paths as they are.
    - Write the regression first, so that it fails before the change. Use a
      configuration in `app`. Link `app/node_modules` and `node_modules` to
      one installation. Link the `node_modules` of two configured package
      roots to a second one. Import a package from each installation.
    - Assert each alias, each canonical root, and the files below each, on
      a fresh compile and on reuse. Assert that no watch path holds
      `.mokly-roots`.
    - `crates/mokly-render/tests/integration/stylesheet_watch_alias_tests.rs`
      holds the CSS form of this fixture.
- **Left out:**
  - Watch the whole dependency root. Broad traversal prunes `node_modules`
    at every depth, under the denial rules of `docs/protocol/mokly-watch.md`.
    Its file count is large, and its events would still need the same
    classification.
  - Watch only the authored dependency directories in
    `PreparedCatalogue.dependency_directories`. It holds one alias, the
    longest, for each dependency root of a consumed module, at
    `crates/mokly-graph/src/dependency_inputs.rs:22`. A retarget of another
    alias, or of a root with only missing candidates, stays unseen.
  - Keep the authored roots beside the canonical roots in `SideInputs`.
    `SideInputs.dependency_aliases` already holds them, so D is better on
    every point.
  - Poll the identities of the selected roots. A native event in the parent
    directory of a link shows the same retarget, with no timer and no delay.
- **Wider fix:** D. One alias-aware mapping then serves every logical
  dependency watch input, so a new watch caller cannot drop an authored
  alias. D replaces B as the wider fix, because B keeps one real path for
  each logical path.
- **Previous examples:** The stylesheet watch gap above, found and fixed on
  2026-11-20 in the branch
  `calummoore/mokly-stylesheet-resolution-evidence-fix-qnp4`.
- **Related:**
  - The
    [kept base freshness checks](../../docs/protocol/mokly-base-preparation.md#freshness-checks)
    of Serve compare the base bundle's installed-module digests with the
    head bundle's. So they rely on the head watcher seeing install changes.
  - [jsconfig-resolution-input.md](./jsconfig-resolution-input.md): another
    gap in the watched resolution inputs.
- **Recommendation:** D. It fixes nested and configured roots with the
  mapping that the stylesheet watch already uses, and it changes no wire
  format. It replaces the earlier recommendation B, which misses a retarget
  of an authored alias.
- **Action:** fix after merge, apply D, because D reaches JavaScript watch
  inputs outside the diff of the CSS-only stylesheet resolution fix of
  2026-11-20.
