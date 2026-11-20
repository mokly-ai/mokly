# Attribute the first Changes residual of installed-module watching

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-11-20, from the acceptance of the installed-module watch
  fix by the user and the performance orchestrator, on branch
  `calummoore/fu-installed-module-watch-paths-3tbn` at commit `4e1db659d`.
- **Location:** `crates/mokly-render/src/bundle_finish.rs:17` and line 23,
  `crates/mokly-render/src/bundle.rs:88`, line 148, and line 178,
  `crates/mokly-render/src/bundle_watch.rs:21` to line 29 and line 66,
  `crates/mokly-render/src/resolution_watch.rs:20`, line 36, line 83, and
  line 124, `crates/mokly-render/src/side.rs:160`, line 181, and line 240,
  `crates/mokly-render/src/stylesheet_cache.rs:168`,
  `crates/mokly-render/src/stylesheet_compiler.rs:82`,
  `crates/mokly-render/src/runtime.rs:87`,
  `crates/mokly-cli/src/serve_services.rs:134`,
  `crates/mokly-cli/src/serve_watch_plan.rs:42`, line 104, line 112, and line
  119, `crates/mokly-watch/src/plan.rs:133`,
  `crates/mokly-watch/src/native.rs:62` and line 67, and
  `crates/mokly-watch/src/native_scan.rs:12`.
- **Reason:** The user and the performance orchestrator accepted this cost
  on 2026-11-20 for a High correctness fix and asked for separate
  attribution work.

- **Terms:**
  - **First Changes:** the time from the Serve start to the first published
    Changes result.
  - **Graph end to ready:** the time from the end of the `graph.prepare` span
    to the end of the `serve.ready` span, in the `--debug-timings` records.
  - **Delivery:** one return of a JavaScript bundle or a stylesheet bundle to
    the render graph, also from a cache or from a retained state.
  - **Watch mapping:** the step that turns the logical resolution paths of
    one delivery into the exact lexical, physical, and canonical paths that
    Serve watches.
  - **Admitting directory:** the dependency root or the nested
    `node_modules` directory that holds one watch input and limits its native
    registration.
- **Background:**
  - Serve is the development command that serves a catalogue and rebuilds
    when an input changes.
  - On 2026-11-20, the user chose the approach of the installed-module watch
    fix. It is a High correctness fix.
  - Before the fix, Serve watched JavaScript resolution inputs at their
    logical names. An edit, an install, or a link retarget then started no
    rebuild in three setups.
    - The setups are a nested configuration, configured package roots, and
      an installation outside the repository.
  - A logical name is the name that the sidecar gives an installed module.
    In dependency root `n` after the first, it is
    `node_modules/.mokly-roots/{n}/{path}`. No code creates a `.mokly-roots`
    directory.
  - The fix gives JavaScript inputs the watch mapping and the admitting
    directories that stylesheet inputs already had.
  - `bundle_finish::finish`, at `crates/mokly-render/src/bundle_finish.rs:17`,
    calls `bundle_watch::inputs` at line 23. `crates/mokly-render/src/bundle.rs`
    calls `finish` at line 88, line 148, and line 178, also for retained
    states.
  - `bundle_watch::inputs`, at `crates/mokly-render/src/bundle_watch.rs:21`,
    returns no paths when the mapping is off, at line 26. Otherwise it takes
    a fresh source snapshot for each delivery, at line 29.
  - It maps the stamp files and the consumed-module directories of the
    bundle through `resolution_watch::inputs`, at line 66.
  - Each stylesheet delivery, also a cache hit, calls `watch_files` at
    `crates/mokly-render/src/stylesheet_cache.rs:168`.
    `CapturingCompiler::watch_files`, at
    `crates/mokly-render/src/stylesheet_compiler.rs:82`, calls
    `resolution_watch::inputs` too.
  - `main` already mapped stylesheet paths at each delivery. The fix moved
    that mapping into the shared `resolution_watch::inputs`. That function
    also adds repair paths for nested links.
  - `resolution_watch::inputs`, at `crates/mokly-render/src/resolution_watch.rs:20`,
    lists the candidates of each logical path through
    `SideInputs::watch_candidates`, at line 36.
  - `SideInputs::watch_candidates`, at `crates/mokly-render/src/side.rs:181`,
    adds each authored alias through `SideInputs::watch_aliases`, which is
    at line 160. It adds the physical source through
    `SideInputs::physical_source`, which is at line 240.
  - For each candidate, `canonical_candidate`, at `resolution_watch.rs:124`,
    projects the path and then its ancestors until one projection finds a
    node. `nested_repairs`, at line 83, makes more projections for the
    repair paths of nested `node_modules` links.
  - Only an original head maps. An original head is a runtime that
    `Runtime::new` builds without a `BaseSide`.
  - `Runtime::with_resolution_watching`, at
    `crates/mokly-render/src/runtime.rs:87`, turns the mapping on only when
    `head_styles` is `None`. Serve calls it at
    `crates/mokly-cli/src/serve_services.rs:134`.
  - Build, publish, and every base runtime keep the mapping off.
  - `PlanInputs::of`, at `crates/mokly-cli/src/serve_watch_plan.rs:42`, reads
    the JavaScript and stylesheet watch inputs of a prepared generation.
    `PlanRecord::new`, at line 104, gives both to `Plan::resolution`, at line
    112 and line 119.
  - `Plan::resolution`, at `crates/mokly-watch/src/plan.rs:133`, adds each
    admitted path as an exact input with its admitting directory.
  - A native registration is one directory watch of the core in the platform
    `notify` backend. On Linux, it is one inotify watch.
  - `NativeObserver::update`, at `crates/mokly-watch/src/native.rs:62`,
    qualifies the root directories and the parent directories of each exact
    input. Then it attaches the new registrations.
  - Each update starts a new `DirectoryChecks`, at line 67.
    `DirectoryChecks`, at `crates/mokly-watch/src/native_scan.rs:12`, keeps
    successful directory checks for that one update only.
  - In an external release check, the first commit of the fix, `22ae7ba19`,
    added about 270 ms to graph end to ready.
  - A separate local development profile then located that increase. It
    served `mokly.config.json` at the repository root, with temporary spans.
  - Its spans traced the increase to repeated projection of shared parent
    directories during native parent qualification.
  - A later commit of the fix, `86b8d35df`, added the `DirectoryChecks` memo.
    It cut the added gap to about 40 ms. No temporary span entered the
    product code.
  - The external performance report names the Mokly Cloud catalogue for the
    two checks below. It does not give their exact configuration or fixture
    revision.
  - So do not mix the numbers of the two external checks with the local
    development profile.
  - The performance orchestrator ran a release recheck of `86b8d35df`
    against a product-equal `main` control. The control had the same product
    code as the `main` base of `86b8d35df`.
  - The recheck used four interleaved warm rounds of a Serve start and three
    edits. It also ran one cold session of ten edits for each arm.
  - The release recheck results, `main` first and the fix second:
    - Graph end to ready, four runs: 134, 138, 125, and 134 ms against 171,
      171, 174, and 177 ms.
    - First Changes per round: 7.4, 6.5, 5.8, and 6.4 s, mean 6.53 s,
      against 6.7, 6.6, 6.3, and 7.2 s, mean 6.70 s.
    - Edits 1, 2, and 3: 3.06, 2.68, and 2.59 s against 3.13, 2.79, and
      2.59 s.
    - Session CPU: 29.1 s against 29.5 s.
    - Core inotify registrations: 60 against 291.
    - Cold ten-edit session: peak 3,080 MiB, CPU 95.8 s, and edit mean
      2.50 s, against 3,019 MiB, 95.2 s, and 2.52 s.
    - Output counts are equal.
    - The First Changes means lie within the round-to-round spread.
  - Then the orchestrator ran an integrated sanity check of `4e1db659d`
    against `main` at `78b08fdf8`. It used release cores, the same sidecar
    dist, and three interleaved warm rounds.
  - The integrated sanity results, `main` first and the fix second:
    - First Changes per round: 6.4, 6.1, and 6.0 s, mean 6.17 s, against
      6.7, 6.1, and 6.3 s, mean 6.37 s.
    - `review.capture-side`: 742 ms against 847 ms.
    - First `changes.classify`: 2,811 ms against 2,886 ms.
    - Edits 1, 2, and 3: 2.80, 2.60, and 2.53 s against 2.92, 2.55, and
      2.58 s.
    - Peak anonymous memory plus swap: 2,294 MiB against 2,352 MiB.
    - Output counts are equal.
  - Across the seven pairs of both checks, First Changes is about 0.19 s
    later with the fix. Five of the seven fix runs are higher.
  - About 0.04 s of that is before readiness, in graph end to ready.
  - The remaining 0.15 s or so has no assigned source. It appears near
    `review.capture-side` and the first `changes.classify`.
  - One hypothesis is the watch mapping of each delivery, also of each cache
    hit. Nobody has measured it.
  - Native registrations stay bounded on `examples/basic`. A fresh Serve
    process counted them after its first publication, from the inotify
    entries in the core's `/proc/{pid}/fdinfo`.
    - `main` at `78b08fdf8`: 121.
    - The fix: 169.
    - The fix with 256 unused packages installed before startup: 169.
  - So the count depends on the consumed modules and their admitting
    directories, not on the number of installed packages.
  - On 2026-11-20, the user and the performance orchestrator accepted the
    gap of about 0.04 s and the rest of about 0.15 s for this fix. They asked
    for this follow-up.
  - Every change keeps these requirements:
    - Each delivery, also a cache hit and a retained bundle, refreshes its
      alias-aware watch paths and the admitting directory of each path.
    - Native attachment and the file-time replay finish before Serve
      readiness.
    - The file-time replay is the modification-time check of exact input
      files in directories that the watcher did not observe. The "Watch
      Targets And Readiness" section of `docs/protocol/mokly-watch.md` holds
      its rule.
    - Build, publish, and every historical runtime keep the mapping off.
    - The confinement rules of the "Denial Rules" section of
      `docs/protocol/mokly-watch.md` stay, with the cache directory rule and
      the escaped-target rule.
    - Watch data stays out of the render input keys, the render store
      identity, and the catalogue sources.
    - The change alters no protocol requirement. It adds no rejection, gate,
      lint, or stricter validation.
- **Task:**
  1. Build release cores of the integrated fix commit
     `4e1db659d214fa807c13d5805cfddb3fc185525e` and of its `main` parent
     without the fix, `78b08fdf86d855ccd6bf72c51fee72a829dc4e88`. Use
     separate checkouts and Cargo targets, and one matching sidecar dist. Two
     trees that both hold the fix cannot show the old difference.
  2. In an isolated worktree, add temporary scoped spans and operation
     counts. Do not commit them.
  3. Cover each code path of the fix that can run between readiness and the
     first Changes result:
     - `bundle_watch::inputs` and `CapturingCompiler::watch_files`: the
       calls, the logical paths, the candidates, the projections, and the
       time.
     - `resolution_watch::inputs`, `SideInputs::watch_candidates`,
       `canonical_candidate`, and `nested_repairs`.
     - Each `PlanRecord::new`, `NativeObserver::update`, and
       `NativeObserver::covers` call, with its exact inputs and registrations.
     - The native events that the core receives before the first Changes
       result.
     - The child stages of `review.capture-side` and of the first
       `changes.classify`.
  4. Run paired, interleaved warm rounds of a Serve start and three edits
     with the two builds. Use `mokly.config.json` at the repository root, and
     record its fixture revision.
  5. Run enough rounds that each stage difference stands out from the round
     spread, or is bounded within it.
  6. Name the stages and the operation counts that hold the residual of
     about 0.15 s. Or bound the residual within the round-to-round noise.
  7. When the attribution locates the residual, identify one concrete change
     that keeps every requirement above. Do not presume a path cache that
     outlives one delivery or one native update. Do not defer native
     attachment or replay.
  8. Give the regression coverage of that change. The existing watch
     regression tests of the fix are these:
     - `crates/mokly-render/tests/integration/javascript_watch_alias_tests.rs`
     - `crates/mokly-render/tests/integration/stylesheet_watch_alias_tests.rs`
     - `crates/mokly-render/src/_tests_/bundle_watch_tests.rs`
     - `crates/mokly-cli/tests/serve_js/javascript_resolution_tests.rs`
     - `crates/mokly-watch/src/_tests_/native_dependency_tests.rs`
  9. Give the before and after verification of that change under the method
     above. Compare the candidate with the `main` of that time. Include First
     Changes, the attributed stages, edits, session CPU, peak memory, and the
     `examples/basic` registration count.
  10. When the best change alters a requirement above, give it to the user
      as a decision.
  11. Keep the existing gate, `cargo xtask check`, for any later code change
      from this item.
- **Impact if no action:** Each Serve start keeps the accepted cost. In the
  seven pairs, First Changes is about 0.19 s later, and about 0.15 s of that
  has no known source. Both performance checks passed.
- **Needs:** Release cores of `4e1db659d` and of its `main` parent
  `78b08fdf8`, with one matching sidecar dist. The catalogue of
  `mokly.config.json` at the repository root, with its fixture revision
  recorded. A machine on which no other build, test, or timing run is active.
- **Done when:**
  - A paired profile with operation counts locates the residual of about
    0.15 s in named stages, or bounds it within the round-to-round noise.
  - The report then gives one of these outcomes:
    - It bounds the residual within the round-to-round noise and proposes no
      speculative code change.
    - It proposes one concrete change that keeps every requirement above. It
      gives the regression coverage and the before and after verification of
      that change.
    - It explains why the requirements above need the work.
