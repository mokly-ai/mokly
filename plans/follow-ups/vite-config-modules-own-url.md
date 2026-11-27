# Config modules run from one data URL

- **Severity:** High. **Likelihood:** Rare. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from round 1 of the implementation review of the
  branch `calummoore/storybook-track-d-finish-nkpi`, finding 35, option D.
  The branch applied option B of that finding, a direct fix for
  `import.meta.resolve`. This item is its wider fix.
- **Location:** `packages/mokly/src/sidecar/vite-config-source.ts:26`,
  `packages/mokly/src/sidecar/vite-config-bundle.ts:157`,
  `packages/mokly/src/sidecar/vite-config-context.ts:25`,
  `packages/mokly/src/sidecar/vite-config-resolution.ts:19`, and
  `tests/sidecar_vite_config_loading.test.ts:26`.
- **Reason:** D replaces the config loader of the adapter, a Large change
  beyond the direct fix of the branch that found it.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Vite adapter:** The optional compile path that compiles JavaScript
    through the project's own Vite setup.
  - **`import.meta.resolve`:** A Node ES module method that resolves a module
    specifier relative to the module that calls it.
  - **Config bundle:** The esbuild bundle that Mokly builds from the Vite
    config file and its local imports. Mokly loads it from a `data:` URL.
  - **Module hooks:** Node's module customization hooks. A resolve hook and a
    load hook change how Node finds and reads a module.
  - **Selected installation:** The dependency installation that the
    resolution settings of a side select.
- **Background:**
  - Mokly loads every config file that Vite's default config loader accepts,
    in ES module or CommonJS form. See the section "The Setup" of
    `docs/protocol/mokly-vite-adapter.md`.
  - Vite 8.3.8's default config loader keeps `import.meta.resolve` in ES
    module configs, with the source file URL as the parent of the resolver.
    It throws for `import.meta.resolve` in a CommonJS config, at
    `node_modules/vite/dist/node/chunks/node.js:38103`. Its substitute takes
    an optional second argument, at `node.js:38102`, and uses a parent
    namespace, at `node.js:407`.
  - Mokly's use of Vite writes no file. An orchestrator design call of
    2026-11-18 and `docs/protocol/mokly-vite-adapter.md:104` state it.
  - On the base side, the location of a config module is in the base
    extraction, which has no `node_modules`, as
    `tests/vite_changes.test.ts:32` shows. So that location alone cannot
    resolve a package. Packages come from the side's selected installation.
  - The resolve hook that `withViteConfigResolution` installs gives the
    config's package lookups the side's lookup only while `loadViteConfig`
    runs. See `packages/mokly/src/sidecar/vite-config.ts:30` and
    `packages/mokly/src/sidecar/vite-config-resolution.ts:19`. Vite runs a
    plugin `config` hook later, in `resolveConfig`, at
    `packages/mokly/src/sidecar/vite-setup.ts:119`.
  - Vite's exported `loadConfigFromFile` writes into `node_modules/.vite-temp`,
    at `node.js:38171`. It resolves externals with Vite's own resolver from
    the config's directory, at `node.js:38066`. Vite does not export
    `bundleConfigFile`. Commit `fa9b18de2` replaced a loader on Vite's module
    runner, because it closed before late imports and could not load
    CommonJS.
  - On 2026-11-25 the branch that found this item applied option B below.
    Each config module gets one source context for its file properties and
    resolution methods. The context keeps the side's lookup.
  - Since the same date, a setup reload for a changed input runs in a fresh
    sidecar process. A reload for a stylesheet dependency stays in place.
- **Problem:**
  - Mokly gives each config module its original `import.meta.url` and file
    names, and then loads the bundle from a `data:` URL. Node binds the
    module's own `import.meta` values to that `data:` URL. A `data:` URL has
    no directory.
  - Before the direct fix, `import.meta.resolve` therefore lost the original
    file, and a relative resolution failed.
  - The direct fix lists each module value by hand. A value that it does not
    list repeats this defect.
  - The config wrapper resolves a computed `import()` with CommonJS
    `require.resolve` and then `pathToFileURL`, at
    `packages/mokly/src/sidecar/vite-config-context.ts:25`. So a package
    whose `exports` has only an `import` condition fails, and a dual package
    loads its `require` entry. An unprefixed builtin name such as `"path"`
    becomes a file path in the working directory. The review of 2026-11-25
    found this. D removes the wrapper, because Node then resolves `import()`
    itself.
- **Impact if no action:** A config that Vite accepts can fail in Mokly
  before the first catalogue entry compiles.
- **Root question:** How does each config module get every `import.meta`
  value and resolution from its own file, with packages from the side's
  selected installation?
- **Options:**
  - **A.** Put a resolver bound to the file in place of
    `import.meta.resolve`. Test a relative resolution in an ES module config.
    Effort: Small.
  - **B.** Give each config module one source context for its file
    properties and resolution methods. Use the selected installation and the
    ES module resolution conditions for the method. Test a local helper and a
    package target. The branch applied B on 2026-11-25. Effort: Medium.
  - **C.** Use Vite's own config compilation through an in-memory loader, if
    its API can keep the selected installation and write no file. In Vite
    8.3.8 it cannot: the exported loader writes a temporary file and
    resolves externals with Vite's own resolver. So C breaks the no-write
    design call and the selected installation. Effort: Large.
  - **D.** Run each local config module at its own file URL through Node's
    module hooks:
    - Use the module hooks in place of the esbuild bundle and its `data:`
      URL.
    - A load hook transforms each module in memory. A resolve hook gives bare
      imports the side's lookup.
    - Node then binds `import.meta.resolve` and the other `import.meta`
      values to the module's own file.
    - Each setup load needs new module records. In a fresh process, the URLs
      need no query. A setup reload that stays in place, for a stylesheet
      dependency, needs a query of the setup in `import.meta.url` and in the
      resolved URLs.
    - Risk: the local rules of the bundler, such as extensions, index files,
      and JSON imports, move into the hooks. Error locations need a new map.
    - Effort: Large.
- **Left out:**
  - `require.resolve` for ES module lookups. Packages can select different
    files for `require` and `import`, so it fails the goal.
  - A change of the bundle URL alone is not a real choice. A load hook or a
    temporary file can give the bundle the config's own URL. A bundled helper
    in another directory then resolves from the config's directory. A
    temporary file also breaks the no-write design call.
  - Resolution at bundle time is not a real choice. A computed argument still
    needs a runtime resolver, so a bundle-time step only adds a second path.
  - A narrower protocol promise is not a real choice. It costs as much as A,
    and configs that Vite accepts still fail.
- **Wider fix:** D. B still lists each module value by hand, so a value that
  it does not list repeats this defect. D lets Node bind every `import.meta`
  value to the module's own file.
- **Previous examples:** Commit `fa9b18de2` restored per-file config metadata
  and local CommonJS imports.
- **Related:**
  - `plans/follow-ups/vite-setup-error-location.md`: D replaces the config
    bundle that builds the error locator, so D must return a per-file
    locator.
  - `plans/follow-ups/vite-setup-read-time-evidence.md`: the load hook of D
    can take the read-time digest of each config module.
  - The branch that found this item records each repository file that Node
    resolves while the config loads. The resolve hook of D can hold that
    record too.
  - `plans/follow-ups/vite-base-workspace-export.md`: same code. Its fix goes
    inside `ViteLookup`, which the config bundle and the resolve hook of D
    both call. After D, each import of the Vite config resolves through Node
    and `ViteLookup.sync`, so the Node form of that fix covers it.
  - `plans/follow-ups/workspace-import-resolution-record.md`: same code. The
    Vite part of that record must reach the resolve hook of D.
- **Recommendation:** D. Node then binds every `import.meta` value and every
  import of a config module to its own file, so no value needs a hand copy.
- **Action:** fix after merge, apply D, because D replaces the config loader
  of the adapter, which is a Large change.
