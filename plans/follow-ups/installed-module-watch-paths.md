# Serve watches installed modules at their logical paths

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-01, from the options check of the unmerged plan of the
  closed "perf 6" workspace, 2026-10-30, which put it outside its scope. On
  2026-11-20, round 1 of the implementation review of the branch
  `calummoore/mokly-stylesheet-resolution-evidence-fix-qnp4`, at commit
  `95d89823d`, added option D. D is the wider fix that the final call split
  off finding 1 of that review. The finding check of that round put the same
  JavaScript problem outside the scope of the branch. On 2026-11-20, round 2
  of that review, at commit `079b465e1`, added option E. E joins option D
  with the wider fix B of finding 2, as one class. Option F and the outside
  JavaScript case come from finding 2 and its check. Finding 3 added the
  advisory rule and the Serve-only rule.
- **Location:** `crates/mokly-render/src/bundle.rs:199` and line 209,
  `crates/mokly-cli/src/serve_watch_plan.rs:53` and line 112,
  `crates/mokly-render/src/bundle_attempt.rs:108` and line 128,
  `crates/mokly-watch/src/plan.rs:132` and line 147,
  `crates/mokly-watch/src/native_scan.rs:11` and line 17,
  `packages/mokly/src/sidecar/module-paths.ts:150`,
  `crates/mokly-render/src/runtime.rs:215`,
  `crates/mokly-render/src/side.rs:160`,
  `crates/mokly-render/src/stylesheet_watch.rs:14`,
  `crates/mokly-css/src/watch_inputs.rs:8`, and
  `crates/mokly-watch/src/stylesheet_inputs.rs:6`.
- **Reason:** The stylesheet resolution fix of 2026-11-20 changes only CSS
  watch inputs, and this work changes JavaScript watch inputs outside its
  diff.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Dependency root:** a `node_modules` directory that the sidecar
    resolves packages from, in Node lookup order from the configuration,
    then one for each `moduleResolution.packageRoots` entry.
  - **Admitting dependency directory:** the dependency root, or the nested
    `node_modules` directory that package lookup reaches, that holds one
    dependency watch input and bounds its native registration.
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
  - Serve is the development command that serves a catalogue and watches
    its inputs. Mokly's Node sidecar, under `packages/mokly/src/sidecar`,
    bundles the JavaScript modules of a catalogue with esbuild. A canonical
    path, or real path, has every symbolic link resolved.
    `ModulePaths.create` resolves each dependency root to its canonical
    path, at `packages/mokly/src/sidecar/module-paths.ts:47`.
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
    `crates/mokly-cli/src/serve_watch_plan.rs:53`. `PlanRecord::new` gives
    them to the watch plan without a mapping, at line 112. `Plan::resolution`
    in `crates/mokly-watch/src/plan.rs:132` watches each one under the
    repository root. The watch plan is their only reader outside tests.
  - No code creates a `.mokly-roots` directory, so the watch path of a module
    in a later root names no file. A module in the first root gets a watch
    path under `{repository}/node_modules`, also when that root is
    elsewhere. No run has reproduced the JavaScript case yet.
  - The source tree maps logical paths to the real dependency roots, in
    `SideTree::mapped` at `crates/mokly-render/src/sources.rs:37`. So the
    input check of a bundle reads the right file. The watcher does not use
    that map.
  - `Runtime::side`, at `crates/mokly-render/src/runtime.rs:215`, selects
    the dependency roots of a side. It resolves each root to its canonical
    path at line 239. It merges roots with one canonical path at line 243.
    It records each authored alias in `SideInputs.dependency_aliases`, at
    line 251. So two authored aliases can name one logical root.
  - Containment checks compare canonical paths, in `SideTree::project` at
    `crates/mokly-render/src/sources.rs:234` and in
    `SideInputs::logical_dependency` at `crates/mokly-render/src/side.rs:134`.
    So `SideInputs.dependency_roots` must stay canonical.
  - `Plan::classify`, at `crates/mokly-watch/src/plan.rs:223`, acts on an
    event at an exact watch path, at an ancestor of one, or in a resolution
    directory. A link that gets a new target gives an event at its path. So
    each authored alias must be a watch path or an ancestor of one.
  - `native_scan::parents`, at `crates/mokly-watch/src/native_scan.rs:11`,
    registers the ancestor directories of an exact watch path. On
    `origin/main` it keeps only directories inside the repository whose
    canonical path equals their written path. Each registration covers one
    directory, at `crates/mokly-watch/src/backend.rs:138`.
  - So with `/repo/node_modules` linked to `/deps/node_modules`, only `/repo`
    gets a registration. An edit, an install, or a new candidate under
    `/deps` gives no event. This holds for JavaScript modules and resolution
    files. A mapping of their paths alone does not change it, because their
    canonical paths under `/deps` lie outside the repository.
  - Since 2026-11-20, Serve also watches the captured resolution inputs of
    each stylesheet. `files`, at `crates/mokly-render/src/stylesheet_watch.rs:14`,
    maps each logical input. It calls `SideInputs::watch_candidates`, at
    `crates/mokly-render/src/side.rs:160`, for the path under the selected
    root and under every authored alias. Then it adds the canonical path of
    each candidate, and it keeps only paths in the repository or in their
    admitting directory. It maps the bare root names `node_modules` and
    `node_modules/.mokly-roots/{n}` too, and it returns no `.mokly-roots`
    name. Its watch fields stay out of the stylesheet keys and the catalogue
    sources.
  - Since the same fix, `files` returns a `mokly_css::watch_inputs::WatchInputs`
    with `files` and `dependency_roots`. `Bundle::resolution_roots` keeps the
    admitting dependency directory of each exact delivered path.
    `RenderGeneration::stylesheet_resolution_roots()` gives these pairs to
    Serve. Nested `node_modules` directories are projected at the current
    delivery.
  - `Plan::stylesheet_resolution` takes them with the canonical cache
    directory from `Locations::cache_root()` and the cache namespace of the
    repository. An input inside the repository keeps its behaviour. An outside
    input needs its own admitting directory, and neither may lie in either
    cache location. With no cache directory, no outside input is admitted, and
    startup still succeeds. `native_scan::input_parents` registers a canonical
    parent only within the admitting directory. Unpaired inputs, such as
    JavaScript inputs, keep the repository limit.
  - A failed attachment of an outside directory reports through the existing
    observer warning inbox, `Inbox` in `crates/mokly-watch/src/observer.rs`.
    An attachment in the repository keeps its behaviour. The rule that never
    watches the escaped target of a public watch input stays.
  - The CSS resolver counts any failed candidate projection as "no file", at
    `crates/mokly-css/src/resolver.rs:148`. Before the fix, the mapping
    projected such a rejected candidate again and failed the delivery. A
    self-referencing link `tokens.preferred.css` beside a valid `tokens.css`
    failed with `ELOOP`, also in `build` and `publish`. Now an optional
    projection error keeps the written path, and a cancellation stays an
    error, in `watch_candidate::optional` at
    `crates/mokly-render/src/watch_candidate.rs:14`. The required readers
    stay strict, at `crates/mokly-render/src/postcss_nested.rs:39` and
    `crates/mokly-render/src/sources.rs:78`.
  - The stylesheet cache maps the logical inputs again at each delivery, at
    `crates/mokly-render/src/stylesheet_cache.rs:155`. So a cache hit after
    a link retarget names the current installation. Only Serve opts in to
    this mapping, through `Runtime::with_stylesheet_watching()` at
    `crates/mokly-cli/src/serve_services.rs:111`. `build` and `publish` leave
    it off by default. Every historical runtime keeps it off, also one that
    needs no source extraction.
  - The stylesheet watch had the same class of gap before its alias-aware
    mapping. Take `/repo/app/mokly.config.json`, where `app/node_modules`
    links to `/repo/install-one`. Root selection resolved the link, so the
    watch paths held `install-one` and `node_modules`, not
    `app/node_modules`. A retarget of `app/node_modules` gave an event that
    the watch plan ignored. Serve kept the old CSS.
  - The stylesheets that the renderer and the entry modules import become
    stylesheet roots of the render graph, at
    `crates/mokly-render/src/graph.rs:183`. So the stylesheet watch covers
    them. The class-map pass drops the watch result of its compiles, at
    `crates/mokly-render/src/bundle.rs:257` and line 272. Nobody checked
    whether a watch covers a CSS Module that only that pass compiles, at
    line 262.
  - `docs/protocol/mokly-watch.md` requires Serve to watch the sidecar's
    reported modules, also beneath `node_modules`. It counts missing
    manifest and tsconfig candidates as resolution metadata. Its denial
    rules prune `node_modules` from broad traversal, but they keep each
    exact required file. They confine an exact input in a selected dependency
    root or a nested `node_modules` directory to that directory, also outside
    the repository.
- **Problem:** Serve watches JavaScript resolution files and directories at
  their logical paths, and it registers no directory of an installation
  outside the repository. When the first dependency root is not
  `{repository}/node_modules`, or a module comes from a later root, that
  path names the wrong file or no file. An edit, an install, or a retarget
  of an authored alias there then starts no rebuild.
- **Impact if no action:** This holds for a configuration in a nested
  package, with configured package roots, or with an installation outside the
  repository. Previews then stay stale after an edit, an install, or a link
  retarget, until Serve restarts or another watched edit starts a rebuild.
- **Root question:** How can Serve observe a change at every path that
  selects a JavaScript module or its resolution metadata, also inside an
  installation outside the repository?
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
    resolution fix, and it needs a JavaScript regression test. D alone
    leaves an installation outside the repository unregistered. Effort:
    Medium.
    - Reuse the whole mapping, with its canonical step, not only
      `SideInputs::watch_candidates`. Move it out of the stylesheet module,
      so that both callers share it.
    - Map in `finish`, with the `SideInputs` of each delivery, so that a
      retained bundle names the current installation.
    - Use `watch_candidate::optional`. Keep the written path when an
      optional projection fails, and keep a cancellation an error.
    - Map only in a runtime that `Runtime::with_stylesheet_watching()` or a
      shared form of it enables. `build`, `publish`, and every historical
      runtime keep the mapping off.
    - Keep the mapped paths out of every render input key and out of the
      catalogue sources.
    - Keep `SideInputs.dependency_roots` canonical, and keep repository paths
      as they are. Keep every authored alias, also when two aliases share one
      canonical root. Map the bare logical roots too.
    - Write the regression first, so that it fails before the change. Use a
      configuration in `app`. Link `app/node_modules` and `node_modules` to
      one installation. Link the `node_modules` of two configured package
      roots to a second one. Import a package from each installation.
    - Assert each alias, each canonical root, and the files below each, on
      a fresh compile and on reuse, and no `.mokly-roots` path. The CSS form
      is in `crates/mokly-render/tests/integration/stylesheet_watch_alias_tests.rs`.
    - Give a rejected candidate a failing projection. The bundle must still
      build, and the written path must stay watched, as
      `a_rejected_dependency_candidate_keeps_valid_css_and_its_repair_watch_path`
      checks for CSS.
  - **E.** Apply D, and return the JavaScript watch paths as
    `mokly_css::watch_inputs::WatchInputs`, with the admitting dependency
    directory of each path. Serve then gives these pairs to the plan with the
    same per-input bounds as stylesheet pairs. So native registration admits
    their canonical parents, also outside the repository. Effort: Medium.
    - Follow the stylesheet rules above. Take the admitting directory from
      each input path, and project nested `node_modules` directories at each
      delivery.
    - Give the pairs to `Plan::stylesheet_resolution`, or to a shared form of
      it with a neutral name.
    - Keep the repository limit for other inputs, the warning inbox, both
      cache exclusions, and the rule for escaped public targets.
    - Add a Serve case with the JavaScript package in a temporary directory
      outside the repository, beside
      `external_css_only_package_style_edit_publishes_the_new_stylesheet`.
  - **F.** Poll each exact input that no registered directory covers, with a
    full file identity, on a timer. `PlanRecord::unobserved` in
    `crates/mokly-cli/src/serve_watch_plan.rs` already lists them. It also
    covers a failed attachment. It adds up to one interval of delay,
    recurring status reads, and a new watch-runtime decision for the user.
    Effort: Medium.
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
  - Remove the repository limit for every input. Native registration would
    then register every ancestor of the repository, and escaped targets would
    lose their boundary.
  - A separate observer for each outside installation. It adds lifecycle
    work, and E reuses the registration of stylesheet inputs.
  - Directory roots for outside parents. Each root traverses its subtree and
    forces a second preparation, which the watch contract rejects for files.
  - Registration through the authored link. It fails the identity check of
    the observer, and macOS reports canonical event paths.
- **Wider fix:** E. One watch-input type,
  `mokly_css::watch_inputs::WatchInputs`, then carries the alias paths, the
  canonical paths, and the admitting directory of each CSS and JavaScript
  input. So no producer can drop an alias or its confinement boundary. B and
  D stay narrower: B keeps one real path, and D keeps no admitting directory.
- **Previous examples:** The stylesheet watch gap above, found and fixed on
  2026-11-20 in the branch
  `calummoore/mokly-stylesheet-resolution-evidence-fix-qnp4`. The same
  branch fixed two more stylesheet cases. An outside installation got no
  registration, and a rejected candidate failed the strict mapping.
- **Related:**
  - The
    [kept base freshness checks](../../docs/protocol/mokly-base-preparation.md#freshness-checks)
    of Serve compare the base bundle's installed-module digests with the
    head bundle's. So they rely on the head watcher seeing install changes.
  - [jsconfig-resolution-input.md](./jsconfig-resolution-input.md): another
    gap in the watched resolution inputs.
- **Recommendation:** E. It gives JavaScript inputs the alias-aware mapping,
  the advisory rule, the Serve-only rule, and the per-path admitting
  directory of stylesheet inputs. So one rule covers both kinds. It replaces
  the earlier recommendations B and D. B misses a retarget of an authored
  alias, and D leaves an installation outside the repository unregistered.
- **Action:** fix after merge, apply E, because E changes JavaScript
  watch-input producers outside the diff of the CSS-only stylesheet
  resolution fix of 2026-11-20.
