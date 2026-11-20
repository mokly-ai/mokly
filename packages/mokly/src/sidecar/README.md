# Render sidecar

The render sidecar is the Node process that runs the JavaScript of a catalogue
for the Mokly binary. [`../sidecar.ts`](../sidecar.ts) is the process entry.
This directory holds the request methods of the sidecar and the code that they
share: the esbuild and Vite compile paths, compiled recipes and their reuse,
evaluation, rendering, style collection, and PostCSS.

The [render sidecar contract](../../../../docs/protocol/mokly-sidecar.md)
defines the requests and their results. The
[package README](../../README.md#how-mokly-runs-your-code) gives the user view
of the sidecar.

## Development

The [package README](../../README.md#development) gives the build and test
commands. The `tests/sidecar_*.test.ts` files at the repository root test this
directory, and the `tests/sidecar_vite*.test.ts` files test the Vite compile
path.

### Key Code

- [`session.ts`](./session.ts) holds `Session`, which dispatches each sidecar
  request to its method. It removes the request-only `capture` and `plan`
  values of a `bundle` request before the reuse check, the compile, the
  identity, and the restore see the settings. It gives a `CaptureDurability`
  only to a `full` request. It sends a `bundle` request with `vite` to
  `ViteCompiler` instead of `bundle`. It awaits `evaluateVite` before
  `describe` and before each render.
- [`transport.ts`](./transport.ts) splits and decodes the binary's typed
  requests and limits the size of each response.
- [`bundle.ts`](./bundle.ts) holds `bundle`, which compiles the catalogue
  modules. Each call shares its read bytes across attempts, while each attempt
  keeps its own consumed-file and CSS-module records. esbuild resolves most
  imports itself, and [`native-plan.ts`](./native-plan.ts) classifies the
  result. It plans a second compile when esbuild's own resolution would change
  the bundle. Its `planNative` keys each planned import by importer,
  specifier, and import kind, and it reports whether the native compile is
  exact. A failed native compile compiles again with full resolution. The
  resolve callback of `consumerPlugins` in [`plugins.ts`](./plugins.ts)
  applies the resolution mode of
  [`native-resolution.ts`](./native-resolution.ts). A planned compile resolves
  each import outside its plan with the full resolver. A `full` call keeps the
  native plan, also of an exact native compile. A `serveEdit` call with a plan
  runs one planned compile with that plan and no native compile. In a `full`
  call, one evidence owner and one preparation serve every attempt. A
  `serveEdit` call creates no evidence owner, no evidence plugin, and no
  durability check. It still records the consumed sources, the module graph,
  the metadata digests, and the directory lists.
  [`bundle-entry.ts`](./bundle-entry.ts) builds the virtual entry module.
  Without a captured preview selection, a `serveEdit` call selects only a
  regular preview file.
- [`bundle-recipe.ts`](./bundle-recipe.ts) holds `bundleRecipe`, which turns
  one compile into its compiled recipe: the module graph, the input digests,
  the reuse evidence, the toolchain identity, and the compilation identity. An
  incomplete recipe gets a fresh identity, also when `checkRecipeSize` in
  [`recipe-size.ts`](./recipe-size.ts) drops its evidence to fit a frame.
  `checkRecipeSize` drops the optional plan of the result before it drops the
  evidence. A `serveEdit` compile gets empty, incomplete evidence with the
  `uncaptured: "serveEdit"` marker. A compile without a toolchain identity
  gets no marker.
- [`captured-plan.ts`](./captured-plan.ts) holds `capturedPlan`, which gives
  the result of a `full` compile its native plan only with complete, durable,
  and unmarked evidence. The plan and the evidence must fit 8 MiB together. It
  counts their JSON bytes without building an oversized string.
- [`compiled.ts`](./compiled.ts) holds `reuse`, which accepts an earlier
  compilation only while its settings, dependency roots, toolchain, input
  digests, and directory lists still match. It tries the captured
  compilations first, and also checks their reuse evidence. Then a `serveEdit`
  request tries the marked compilations with these live checks alone. A `full`
  request never takes a marked compilation. Its `restore` installs a recipe
  without a compile.
- [`toolchain.ts`](./toolchain.ts) holds `toolchainIdentity`, which each
  sidecar process computes once from the package root, the Mokly, esbuild,
  and Node versions, and every `dist/` file.
  [`vite-toolchain.ts`](./vite-toolchain.ts) adds the Vite version and the
  real path of the Vite package for a Vite compile and for its reuse check.
- [`resolution-evidence.ts`](./resolution-evidence.ts) holds
  `ResolutionEvidence`, the esbuild plugin that records the candidate
  directories, manifests, and configurations of each import before esbuild
  resolves it. A form that it cannot map makes the evidence incomplete.
  [`resolution-request.ts`](./resolution-request.ts) applies written plugin
  names and aliases before built-in filtering.
  [`config-inputs.ts`](./config-inputs.ts) records each `tsconfig.json` or
  `jsconfig.json` and its `extends` chain, and
  [`config-json.ts`](./config-json.ts) parses JSON with comments and trailing
  commas.
- [`physical-inputs.ts`](./physical-inputs.ts) holds `PhysicalInputs`, the
  one owner of the evidence reads. It reads each metadata file within 1 MiB,
  parses the configurations, and queues each unique resolution request once.
  Each queued capture uses synchronous filesystem reads before esbuild
  resolves the import. Its retained observations, metadata read bytes,
  visited paths, and request keys each stay within 8 MiB. Each charged visited
  path keeps its first-touch kind. Later presence and kind probes of the same
  capture use that kind, but metadata content and link targets are still
  read. `currentEvidence` reads the evidence again for a reuse check, with no
  saved kind. The protected filesystem operations of the same owner are in
  [`physical-input-reader.ts`](./physical-input-reader.ts), which uses
  bounded reads and `realpathSync.native` for canonical paths. Its `pathKinds`
  map holds the first-touch kinds, of the `CaptureKind` type in
  [`capture-kind.ts`](./capture-kind.ts).
  [`file-digests.ts`](./file-digests.ts) streams each file digest through one
  64 KiB buffer and checks inputs with four workers.
- [`capture-durability.ts`](./capture-durability.ts) holds
  `CaptureDurability`, which decides the `durable` flag of the reuse evidence
  when `hello` carries a `capture` hint. Before the first observation of a
  compile, it can wait once, until at most 50 ms after the compile starts. It
  records the stamps and the identity of each directory and metadata file at
  the first touch, and it reads them again after the last attempt. It never
  changes `complete`. [`capture-paths.ts`](./capture-paths.ts) follows raw
  link targets and observes their parent directories within the same path
  bound. Through `CaptureDurability.sharePaths`, `CapturePaths.share` borrows
  the kinds that the physical owner already charged and witnessed. A repeat of
  a successful whole walk checks its recorded expansion charge again.
  `CaptureDurability.finish` still reads each witness afresh.
  [`capture-runtime.ts`](./capture-runtime.ts) holds the stat and clock
  boundary and the age guard. On Windows, its `captureSnapshot` reads a
  witness through `handleStat`, a read-only handle stat, because some libuv
  versions report a wrong device for a path stat. `sameCaptureStat` compares a
  witness with its recheck. [`capture-volumes.ts`](./capture-volumes.ts)
  classifies each volume by its Linux file system type or by the hint.
- [`vite-compiler.ts`](./vite-compiler.ts) holds `ViteCompiler`, which
  compiles a `bundle` request with `vite` into a compiled recipe with a
  `ViteRecipe` and empty, incomplete reuse evidence. It keeps one Vite server
  and replaces it when the roots, the peers, or the setup stamp change.
  [`vite-setup.ts`](./vite-setup.ts) holds `viteSetup`, which loads the app's
  `vite.config.*` and starts the server with no HTTP server, watcher, hot
  reload, or dependency pre-bundling. Its `setupStamp` digests the config
  files, their imports, the env files, and the file list of the configuration
  directory.
- [`vite-config.ts`](./vite-config.ts) holds `loadViteConfig`, which runs the
  app's `vite.config.*` in Vite's module runner through `runViteConfig` in
  [`vite-config-runner.ts`](./vite-config-runner.ts), on both sides. Each
  import of the config resolves through `ViteLookup`, also a synchronous Node
  import that [`vite-config-resolution.ts`](./vite-config-resolution.ts)
  hooks.
- [`vite-resolution.ts`](./vite-resolution.ts) holds `ViteLookup`, the one
  lookup of a Vite compile, which applies the setup's aliases and then runs the
  setup's resolver from each importer candidate of `viteLookupImporters`.
  Setup loading, `moklyVitePlugin`, the runner fetches, the React peer table,
  and `viteExternalResolver` all resolve through it, on both sides.
- [`vite-lookup-paths.ts`](./vite-lookup-paths.ts) holds
  `viteLookupImporters`, which lists the importer candidates of a bare import
  in lookup order: the importer, its mapped path in the base side's selected
  installation, and the `node_modules` directory of each package root last. It
  records each package root candidate as a resolution input.
- [`vite-peers.ts`](./vite-peers.ts) holds `withVitePeers`, which runs the
  Vite compile inside one esbuild call, so that the consumer peer resolver of
  the esbuild path resolves `vite` and the peers other than React. Its
  `loadVite` loads that `vite` and finds the real path of its package.
  [`vite-node-peers.ts`](./vite-node-peers.ts) holds `withViteNodePeers`, a
  scoped Node resolve hook. `Session` runs each request inside it, so a
  dependency that Node loads for a Vite generation gets the side's one React
  runtime.
- [`vite-react-peers.ts`](./vite-react-peers.ts) holds `captureReactPeers`,
  which builds the React peer table through `ViteLookup` after the setup
  loads, so a setup alias of `react` or `react-dom` selects the one React
  runtime. Its `vitePeerPlugin` adds a first alias entry, so each React import
  reaches that table or the JSX development shim before a setup alias
  rewrites it.
- [`vite-external.ts`](./vite-external.ts) holds `viteExternalResolver`,
  which decides through `ViteLookup` whether Node loads a resolved package
  file, also a file that a setup alias selects.
- [`vite-graph.ts`](./vite-graph.ts) holds `walkVite`, which records every
  module fetch from the virtual entry in the `ViteRecipe` before any
  evaluation. Its `viteGraph` builds the module graph from these fetches.
  [`vite-fetch.ts`](./vite-fetch.ts) holds `createViteFetch`, the one boundary
  that fetches a module from the Vite server. Each fetch confines its file and
  records its bytes and imports. [`vite-plugin.ts`](./vite-plugin.ts) holds
  `moklyVitePlugin`, the `mokly` plugin, which runs before the plugins of the
  setup. It handles Mokly's virtual modules, React, the style library
  wrappers, the stylesheet stubs, and the confinement of each resolved file.
- [`vite-evaluate.ts`](./vite-evaluate.ts) holds `evaluateVite`, which
  evaluates a Vite generation once through Vite's module runner. The runner
  reads only the recorded fetches of the `ViteRecipe`, so a restored recipe
  needs no source read and no transform.
- [`virtual-modules.ts`](./virtual-modules.ts) builds the authoring facade,
  the JSX development shim, and the CSS Modules stub for both compile paths.
  It also limits the reserved runtime imports to Mokly's own virtual modules.
- [`postcss.ts`](./postcss.ts) holds `PostcssWorkers`, which owns the PostCSS
  child processes.

### Related Docs

- [Render sidecar](../../../../docs/protocol/mokly-sidecar.md) and
  [sidecar module sources](../../../../docs/protocol/mokly-sidecar-modules.md)
- [Compiled recipes and release](../../../../docs/protocol/mokly-sidecar-recipes.md)
- [Vite adapter](../../../../docs/protocol/mokly-vite-adapter.md)
- [PostCSS contract](../../../../docs/protocol/mokly-imported-styles-postcss.md)
- [`@mokly/mokly` package](../../README.md) and the
  [Rust sidecar pool](../../../../crates/mokly-sidecar/README.md)
