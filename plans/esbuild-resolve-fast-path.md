# esbuild Resolve Fast Path

Status: Active. On branch `conductor/perf-1-esbuild-resolve-fast-path`, no
pull request yet. The plan closes when its PR merges.

The sidecar compiles every entry file and the renderer with one esbuild
call. A catch-all resolve callback in the sidecar plugins handles every
import of every file, also the files in `node_modules`. For each import,
esbuild waits while the callback asks esbuild to resolve the import again,
calls `realpath` twice, classifies the module, and records the dependency
usage. On `main` at `a9dd1e81`, measured on 2026-10-27 with a release build
on an eight-CPU machine, `sidecar.bundle.compile` took 6.7 to 7.5 s for the
head bundle of `examples/basic` and 7.6 to 7.9 s for the base bundle. The
same imports compile in about 0.5 s when esbuild resolves them itself. Of
the 5,036 imports that the callback handles, 4 are bare imports from
repository-owned files. Only these imports can need the base tier remap.

This plan lets esbuild resolve the other imports natively: the fast path.
After the native compile, the sidecar classifies each native import target
with the rules of the full path. When every target maps to itself and
esbuild gave none a package type or TypeScript settings, the native result
stands. Otherwise a second compile returns each classified target from the
plan through the resolve callback, without a resolver round trip, so every
module stays plugin-resolved as today. A failed native compile compiles
again on the full path. So the bundle result stays the same: modules,
digests, logical names, compiled code, compiled inputs, unmapped dependency
directories, and diagnostics. The plan keeps the CSS resolve callback, the
style adapters plugin, `onLoad`, and peer resolution. It does not cover the
sibling items perf 0 and perf 2 to perf 6.

The item decision, made by the user before this plan and recorded on
2026-10-27: option A of item 1. Return at once from the catch-all callback
for a relative import and for a bare import whose importer is inside a
dependency root, so that esbuild resolves them natively. After the compile,
replay the dependency usage of the skipped imports from the metafile. Keep
the full path for bare imports from repository-owned files, because the base
tier remap must run during resolution. Keep `onLoad`. The item records no
rejected options. Reason: the compile waits on callback round trips, not on
CPU.

Contract owners:

- [Sidecar module sources](../docs/protocol/mokly-sidecar-modules.md):
  logical names, repository mapping, base-source precedence, and dependency
  usage.
- [Sidecar bundling](../docs/protocol/mokly-sidecar.md#bundling):
  confinement and diagnostics.
- [Timings](../docs/protocol/mokly-timings.md): one `sidecar.operation`
  count for each esbuild call. Perf 0 edits this page. This plan only reads
  it.
- The [`@mokly/mokly` README](../packages/mokly/README.md), `### Key Code`.

## The item text and the code

The item text came from a reading of `89c12ef1`. These points differ at
`a9dd1e81`. The decisions below correct them.

- The item says that a bare import from a dependency file to a linked
  workspace package keeps the full path, because it is bare. Under the item
  decision, its importer is inside a dependency root, so it takes the fast
  path. On the base side, esbuild then returns the head checkout's file, and
  the bundle fails where today it maps the file to the base copy. A
  dependency file that imports a `node_modules` copy that the base commit
  tracks gets the head bytes instead of the base bytes. See decision 1.
- The item says that diagnostics keep their shape. This holds for an import
  that does not resolve: esbuild's own message has the same text and notes.
  It does not hold for an import that escapes the roots. The check after the
  compile fails closed, but without the importer location that the bundling
  contract requires. See decision 1.
- A `require` call inside `try` that cannot resolve fails the bundle today,
  because the callback returns the resolver error. esbuild's native rule
  allows the call and leaves it for run time. See decision 2.
- `dependencyUsage.resolved` returns at once for every import of the item's
  fast path in normal layouts. The part of the replay that records data is
  the module classification, which records nested `node_modules`
  directories. The tests target that part.
- The metafile lists no target for `require.resolve`, so these imports keep
  the full path. The inner resolution that the style adapters request keeps
  the full path too, so that the replay finds every fast-path import in the
  metafile.
- Native resolution is not the same as a resolve callback result. esbuild's
  own resolver gives each `.js`, `.jsx`, `.ts`, and `.tsx` file the `type` of
  its nearest package.json, and each file outside `node_modules` the parse
  options of its nearest tsconfig.json. A callback result carries neither.
  The [module sources contract](../docs/protocol/mokly-sidecar-modules.md)
  requires the bundle to ignore both. In `examples/basic`, 1,032 of 5,010
  native imports reach such a file: the catalogue files sit under the
  repository's `"type": "module"`. See decision 6.
- Each `build.resolve` call creates a new esbuild resolver, which reads the
  directories and manifests again. That is the cost of the full path. A
  separate resolve namespace that skips the inner callbacks made the compile
  slower, 9.1 to 9.6 s.
- On this machine the compile takes 6.7 to 7.9 s, not 12.3 to 12.9 s. The
  acceptance target of 1.5 s is unchanged. `repositoryOwned` is at
  `module-paths.ts:174`. The example bundle has 2,270 modules. The callback
  runs 10,085 times, 5,036 of them past its guard.

## Design

The design follows the decisions below.

- **Fast-path rule.** The catch-all callback returns at once when the
  resolution is the outer resolution of an import, the import kind is not
  `require-resolve`, and the import is not a bare import from a
  repository-owned importer directory. A bare specifier does not start with
  `.`, `/`, `#`, or a URL scheme, the rule that `importerDirectory` already
  uses. One helper holds that rule.
- **Native compile.** The first compile uses the fast path. It raises
  esbuild's `ignored-dynamic-import` message to an error, so that a handled
  `require` failure ends the compile.
- **Classification.** After a successful native compile, the
  `sidecar.bundle.classify` phase runs `paths.resolve` on each native import
  target. It also reads the target's esbuild settings: the `sideEffects` flag
  and whether esbuild gave the file a package type or tsconfig parse options.
  A tsconfig counts when plain JSON cannot read it, when it extends another,
  or when it sets a compiler option that esbuild reads for parsing. The plan
  maps each native import, keyed by importer, specifier, and kind, to its
  classified module and side-effects flag.
- **Exact native result.** When every target maps to itself, carries no
  such settings, and has an `original` specifier, the native result stands.
  The phase then records the dependency usage of each native import, with
  concurrent calls.
- **Planned compile.** Otherwise a second compile starts from new state. Its
  callback returns the planned module and side-effects flag for each planned
  import, records the same observation and usage as the full path, and
  resolves every other import on the full path. A target that the full path
  rejects stays unplanned, so the full path reports its diagnostic.
- **Full compile.** A failed native compile, or a failed classification,
  compiles again on the full path, the current code path.
- **Modules.** `native-resolution.ts` holds the rule and the plan types,
  `native-plan.ts` the classification, and `package-scope.ts` esbuild's
  package.json and tsconfig lookups. `bundle-entry.ts` and `bundle-recipe.ts`
  split the entry module and the recipe out of `bundle.ts`. Each attempt
  reports its own esbuild operation and compile span.

## Baseline

Release build of `a9dd1e81`, 2026-10-27, eight CPUs, eight sidecars, with
the shared measurement method of the perf workspaces. The warm example
column gives the median of three runs. The cold column gives the first run
after the build. The React column gives two runs of the 574-document
fixture. Evidence: `.context/esbuild-resolve-fast-path/baseline-keys.txt`.

| Measure                        | Example, warm | Example, cold | React fixture |
| ------------------------------ | ------------- | ------------- | ------------- |
| `sidecar.bundle.compile`, head | 6.9 s         | 7.3 s         | 6.0, 6.5 s    |
| `sidecar.bundle.compile`, base | 7.8 s         | 9.2 s         | 6.7, 6.7 s    |
| `serve.ready`                  | 12.8 s        | 13.9 s        | 6.6, 7.2 s    |
| `serve.background`             | 11.7 s        | 14.1 s        | 1.8, 1.9 s    |
| `changes.classify`             | 52.8 s        | 141.8 s       | 9.4, 9.6 s    |
| `review.base-tree`             | 32.9 s        | 119.7 s       | 9.1, 9.2 s    |
| `review.capture-side`          | 4.7 s         | 5.4 s         | 1.1, 1.1 s    |
| `review.compare-views`         | 19.1 s        | 21.2 s        | 0.2, 0.2 s    |
| `sidecar.render` count         | 2,090         | 1,995         | 324, 324      |
| `css.bundle` count, union      | 152, 9.4 s    | 152, 10.6 s   | 12, 0.3 s     |

Each edit run appends one comment line to `details.mockup.ts` after the
first classification. The table gives the median and the range of three
runs.

| Measure                                       | Median | Range          |
| --------------------------------------------- | ------ | -------------- |
| `watch.action`                                | 9.8 s  | 9.8 to 10.9 s  |
| `serve.background` after the edit             | 14.0 s | 13.8 to 15.0 s |
| `changes.classify` after the edit             | 70.5 s | 65.8 to 73.6 s |
| Edit to the end of the second classification  | 96.5 s | 89.7 to 97.3 s |
| `sidecar.bundle.compile` after the edit, head | 7.1 s  | 6.9 to 7.9 s   |
| `sidecar.bundle.compile` after the edit, base | 7.2 s  | 7.0 to 7.4 s   |

A first prototype, a patched copy of the package build outside the source
tree, measured the single native compile at 0.42 to 0.59 s. Decision 6 adds
the planned compile, so the final numbers below replace it. Evidence:
`.context/esbuild-resolve-fast-path/prototype.md`.

## After the change

On 2026-10-28 the machine ran about 1.5 to 2 times slower than during the
baseline, so the comparison below interleaves runs of the `origin/main`
sidecar build and the branch build in the same machine state. The table gives
medians of three serve runs and two edit runs of `examples/basic`, and two
serve runs of the React fixture. Each branch bundle of these fixtures runs a
native and a planned compile, because their files sit under the repository's
`"type": "module"`. Evidence:
`.context/esbuild-resolve-fast-path/measurements.md`.

| Measure                                      | `origin/main` | Branch      |
| -------------------------------------------- | ------------- | ----------- |
| `sidecar.bundle.compile`, head, all passes   | 12.3 s        | 2.3 s       |
| `sidecar.bundle.compile`, base, all passes   | 14.6 s        | 1.8 s       |
| `sidecar.bundle`, head and base              | 12.8, 15.5 s  | 3.0 s       |
| `serve.ready`                                | 22.1 s        | 13.5 s      |
| `serve.background`                           | 21.7 s        | 24.6 s      |
| `changes.classify`                           | 93.6 s        | 90.3 s      |
| `review.base-tree`                           | 58.1 s        | 51.4 s      |
| `review.capture-side`                        | 9.3 s         | 8.4 s       |
| `review.compare-views`                       | 34.9 s        | 29.6 s      |
| Start to Changes ready                       | 136.1 s       | 128.6 s     |
| `sidecar.render` count                       | 2,094         | 1,992       |
| `css.bundle` count, union                    | 152, 17.2 s   | 152, 19.1 s |
| `watch.action`                               | 14.6 s        | 6.1 s       |
| `serve.background` after the edit            | 20.6 s        | 20.0 s      |
| `changes.classify` after the edit            | 111.1 s       | 100.1 s     |
| Edit to the end of the second classification | 146.4 s       | 126.2 s     |
| React fixture `serve.ready`                  | 11.9 s        | 2.7 s       |
| React fixture `changes.classify`             | 18.0 s        | 6.1 s       |
| React fixture `sidecar.bundle`, head, base   | 11.2, 13.3 s  | 2.2, 2.2 s  |

Each compile pass took 0.5 to 2.1 s on the slowed machine. In sequential
runs before the slowdown, the passes took 0.5 to 0.9 s and a bundle 1.6 to
2.7 s. `serve.background` and the render times vary more between runs than
between the builds: the edit runs show the branch faster. The live heap after
one bundle is 9 MB on both builds.

## Decisions

The user answered all five decisions on 2026-10-27 with the recommended
option: 1A, 2A, 3B, 4A, and 5A. Each entry keeps the rejected options.

1. Fall back to the full path when native resolution diverges. Severity
   High, effort Medium.
   - A. Classify after the compile. Compile again with the full path on any
     divergence or failure. The result stays identical. A failing bundle
     pays one extra fast compile and reports two esbuild operations.
   - B. Keep the item rule without a fallback. Change the protocol: on the
     base side, dependency files lose repository mapping and the tracked
     copy precedence, and escape errors lose the importer location.
   - C. Keep the full path for every import on the base side. The base
     compile stays at about 7.8 s and misses the acceptance target.
   - Chosen: A. It is the only option that keeps every result identical and
     meets the target on both sides.
2. Keep or relax the failure of a handled `require`. Severity Medium,
   effort Small.
   - A. Keep today's failure: the log override ends the native attempt, and
     the full attempt reports today's message.
   - B. Use esbuild's native rule for fast-path imports. Such a bundle
     succeeds, and the call fails at run time inside its `try`. Bare imports
     from catalogue files keep today's failure. This option adds one protocol
     requirement.
   - Chosen: A. It keeps the results identical. A change to the failure
     rules belongs to its own item.
3. Fast-path scope for importers in nested `node_modules`. Severity Low,
   effort Small.
   - A. The item set: non-bare imports, and bare imports whose importer is
     inside a selected dependency root.
   - B. Every import except a bare import from a repository-owned file. The
     base remap never applies to the other importers.
   - Chosen: B. The full path does nothing for an importer that the remap
     never changes, and decision 1A keeps the results identical.
4. Relative imports from repository-owned files, the first open decision of
   the item. Severity Low, effort Small.
   - A. Take the fast path. With decision 1A, escape diagnostics stay the
     same through the fallback.
   - B. Keep the full path. The compile takes about 0.25 s longer.
   - Chosen: A. The results stay identical, and the compile is about a
     third faster.
5. The replay order of the dependency usage, the second open decision of
   the item. Severity Low, effort Small.
   - A. Concurrent calls in metafile order. The unmapped directories are a
     set that the bundle sorts, and each record depends only on its
     arguments and the file system.
   - B. One call at a time in metafile order.
   - Chosen: A. The order cannot change the result, so concurrent calls only
     save time.
6. Keep the parse rule for natively resolved files. Found during the work and
   decided on 2026-10-28 with the recommended option, under the user's rule
   for decisions that come up during the work. Severity High, effort Large.
   - A. Plan a second compile from the classified native imports whenever
     the native result could differ, and keep the native result otherwise.
     Every module stays plugin-resolved, so results stay identical. A bundle
     then runs one or two esbuild compiles.
   - B. Keep catalogue files on the full path and accept the package type for
     dependency files. This changes the CommonJS interop of typed dependency
     files and breaks the style wrapper rule, and the protocol must change.
   - C. Fall back to the full path whenever a native target carries a
     setting. `examples/basic` would always fall back.
   - Chosen: A. It is the only option that keeps the results identical and
     still removes the resolver round trips.

## Milestone 1: Documentation and protocol

The chosen options keep every requirement, so no protocol page changes.

- [x] Record the answers to the open decisions, with the date, in this plan.
- [x] Confirm that `docs/protocol/mokly-sidecar-modules.md` and the bundling
      section of `docs/protocol/mokly-sidecar.md` stay true under the
      answers. No sentence there describes the resolve callback. Change
      nothing that stays true.
- [x] If the user picks option B of decision 1, change the repository
      mapping and diagnostic requirements for dependency files in both
      pages. If the user picks option B of decision 2, add the requirement
      for a handled `require` failure to `mokly-sidecar-modules.md`. Not
      needed: the user picked A for both.

## Milestone 2: Fast path, classification, and fallback

Write each test before its code. The behaviour stays the same, so the new
tests pin today's results and the resolver round trips.

- [x] Add a test that counts resolver round trips at two sizes in a 1:4
      ratio: a dependency with N and 4N internal relative and bare imports.
      Count the `build.resolve` calls and the esbuild calls through a
      compile wrapper. Assert equal counts above zero at both sizes and the
      expected modules. The test fails before the change.
- [x] Add the shared bare-specifier rule and the fast-path rule. Use the
      shared rule in `importerDirectory`.
- [x] Add a resolution mode to `consumerPlugins`. In native mode, the
      catch-all callback returns at once for a fast-path import.
- [x] Add the `sidecar.bundle.classify` phase and the classification step.
- [x] Run the native attempt, then the full attempt on a failure or a
      divergence, each with new state. Add the log override to the native
      attempt.
- [x] Add the planned compile of decision 6: the plan, the planned callback
      result, and esbuild's side-effects and parse-setting lookups.
- [x] Add fixture tests. Each asserts the modules, the digests, the unmapped
      directories, and the esbuild call count. Each also compares the whole
      result, compiled code included, with the full path.
  - [x] Nested `node_modules`: a relative import into a nested
        `node_modules` directory outside the selected roots records that
        directory. A dependency with its own nested `node_modules` keeps its
        logical names. A bare import from a nested installation takes the
        fast path.
  - [x] pnpm layout: store packages that import each other through links
        stay on the fast path with one esbuild call.
  - [x] Workspace link: on the head side, a dependency that imports a linked
        workspace package stays on the fast path. On the base side, the
        same layout falls back and maps the module to the base copy.
  - [x] Tracked dependency copy: on the base side, a dependency that imports
        a tracked `node_modules` copy falls back and gets the base bytes.
  - [x] Diagnostics: an escape from a dependency fails with the importer
        location. A handled `require` failure fails with today's message.
        A `require.resolve` of an escaping path fails as today.
  - [x] Parse rule: a typed dependency keeps bundler interop through the
        planned compile, and a classic-JSX tsconfig keeps the development
        runtime.
  - [x] esbuild settings: the side-effects flag matches esbuild's resolver
        for each manifest shape, and the parse-setting rules hold.
- [x] Run the existing sidecar tests: `tests/sidecar_*.test.ts` and the Rust
      integration tests in `crates/mokly-render` that count esbuild calls.
      One test changed: the CSS Modules compile-count test now compares with
      a plain entry of its fixture, which compiles twice under the
      repository's package type.
- [x] Add the bundle entry point to `### Key Code` in
      `packages/mokly/README.md`.

Evidence: `.context/esbuild-resolve-fast-path/red-run.txt`, `green-run.txt`,
and `sidecar-tests.txt`.

## Milestone 3: Result identity and measurement

- [x] Compare the bundle results of the `origin/main` build and the branch
      build with the captured head and base parameters of `examples/basic`
      and the React fixture. Every field must match: modules with imports
      and digests, compiled and metadata inputs, directory listings, peers,
      CSS Modules, unmapped dependency directories, and the identity. Save
      the evidence under `.context/esbuild-resolve-fast-path/`. All 13 fields
      match, the emitted code included, on all four bundles.
- [x] Measure after the change with the shared method: three warm serve
      runs and three edit runs of `examples/basic`, and two serve runs of
      the React fixture. Add the after values to the baseline section. The
      machine slowed down, so interleaved runs of both builds give the
      comparison.
- [x] Run the mockup check: `npm run build`, then
      `npx mokly build --config examples/basic/mokly.config.json --strict --out ../../.context/example`.
      Smoke-test a React screen and the Changes view through `npm run dev`.
      The strict build wrote 2,382 files. Serve rendered the Details screen
      in both frames, and Changes reported no changes. The smoke test used
      the release binary, because the debug binary of `npm run dev` took
      longer than ten minutes to classify Changes.

Evidence: `.context/esbuild-resolve-fast-path/identity.txt`,
`measurements.md`, `mockup-build.txt`, and `smoke-screen.png`.

## Milestone 4: Verification, commit, review, and pull request

- [x] Run `cargo xtask check --suite repository` early, the targeted tests,
      and then the complete gate `cargo xtask check`. The remote gate passed
      every suite except browser shard 2 of 4, where one unrelated test
      failed once. The shard passed on its rerun, and the test passed ten of
      ten local runs.
- [x] Commit with Conventional Commits and push the branch after each
      milestone. `origin/main` at `2dd2937f` merged cleanly.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the review-fix rule: fix the `Auto-fix: yes` findings,
      re-review once, and report the rest. The orchestrator's process runs
      the review after the pull request opens.
  - Outside the scope: `tests/browser/same_origin_identity.spec.ts`. "An
    unowned exact-resource document gains no navigation privilege during
    handoff" failed once in the remote gate with "Cannot read properties of
    null (reading 'dispatchEvent')", then passed on the shard rerun and in
    ten local runs. Suspected source: the probe reads the frame document
    during the handoff race. Separate branch.
- [ ] Open the pull request with the before and after table when every
      other milestone TODO is ticked. Put its link in the status paragraph.
