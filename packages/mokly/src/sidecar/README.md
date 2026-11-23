# Render Sidecar

The render sidecar is the Node process that the Mokly binary starts to compile,
describe, and render catalogue modules. It uses esbuild by default and can use
Vite. The [render sidecar contract](../../../../docs/protocol/mokly-sidecar.md)
defines its requests and results. The
[package README](../../README.md#how-mokly-runs-your-code) explains how Mokly
runs authored code.

## Development

The [package README](../../README.md#development) gives the build and test
commands. The `tests/sidecar_*.test.ts` files at the repository root test the
sidecar. The `tests/sidecar_vite*.test.ts` files test the Vite compile path.

## Key Code

- [`../sidecar.ts`](../sidecar.ts) reads framed requests from the binary and
  writes one response for each. `quiet: true` silences consumer output until
  the reply.
- [`timing-output.ts`](./timing-output.ts) wraps standard error. Timing records
  start on their own line and use the original writer. `quiet` drops other writes.
- [`session.ts`](./session.ts) dispatches each request. `Session` strips `capture`
  and `plan` from bundle settings before reuse, compilation, identity, and
  restore. It gives a `CaptureDurability` only to a `full` esbuild request. It
  sends `vite` bundles and `transformViteCss` requests to `ViteCompiler`, and
  awaits `evaluateVite` before describing or rendering a Vite generation.
- [`transport.ts`](./transport.ts) splits and decodes the binary's typed requests
  and limits each response size.
- [`../generated/sidecar`](../generated/sidecar) holds the request and result
  types that `cargo xtask generate-types` writes from the Rust types.

### esbuild Compilation and Reuse

- [`bundle.ts`](./bundle.ts) shares source reads across esbuild attempts. Each
  attempt tracks its own sources and CSS modules. [`native-plan.ts`](./native-plan.ts)
  checks whether esbuild's native resolution is exact and keys planned imports
  by importer, specifier, and import kind. An inexact compile starts a planned
  compile. A failed native compile falls back to full resolution.
- [`plugins.ts`](./plugins.ts) applies the resolution mode of
  [`native-resolution.ts`](./native-resolution.ts). The full resolver handles
  imports outside a plan. A `full` call keeps the native plan even if the native
  compile was exact, and shares one capture owner and preparation across attempts.
  A `serveEdit` call with a plan skips the native attempt. It has no full capture
  owner, evidence plugin, or durability check, but keeps the sources, module
  graph, digests, and directory lists.
- [`bundle-entry.ts`](./bundle-entry.ts) builds the virtual entry.
  [`configured-files.ts`](./configured-files.ts) is the first plugin of each
  attempt. It sends each entry import to the canonical configured or selected
  preview file before TypeScript `paths` can apply. Without a captured preview
  selection, `serveEdit` selects only a regular preview file.
- [`bundle-recipe.ts`](./bundle-recipe.ts) builds the graph, input digests, reuse
  evidence, and toolchain and compilation identities. Incomplete recipes get a
  fresh identity. [`recipe-size.ts`](./recipe-size.ts) drops the optional plan,
  then the evidence, if the result exceeds a frame. `serveEdit` evidence is
  incomplete and contains only private package-folder files. Without a toolchain
  identity or successful `ServeEditImports.record`, the recipe gets no marker.
  `bundleRecipe` runs that check in `sidecar.bundle.mapped-lookups` before
  `resolutionInputs`.
- [`captured-plan.ts`](./captured-plan.ts) attaches a native plan only to complete,
  durable, unmarked `full` evidence. It counts the combined JSON bytes within
  8 MiB without building an oversized string.
- [`compiled.ts`](./compiled.ts) checks settings, dependency roots, toolchain,
  input digests, and directory lists before reuse. It first checks captured
  compilations and their evidence. Only `serveEdit` can also use the marked
  compilations, with their live checks and private folder files. `restore`
  installs a recipe without a compile.
- [`toolchain.ts`](./toolchain.ts) identifies the package root, Mokly, Node,
  esbuild, and every `dist/` file once per process. [`vite-toolchain.ts`](./vite-toolchain.ts)
  adds the Vite version and real package path to Vite compile and reuse checks.

### Resolution Evidence

- [`resolution-evidence.ts`](./resolution-evidence.ts) records candidate
  directories, manifests, and configurations before esbuild resolves an import.
  An unmapped form makes evidence incomplete. It records all targets of matching
  `paths` keys, even for absolute imports, and main fields and maps of own, PnP,
  installed, linked, and configured packages. Its `finish` audits native bare
  selections with `PnpInputs` when a PnP state file is present.
- [`resolution-request.ts`](./resolution-request.ts) applies written plugin names
  and aliases before builtin filtering. [`config-inputs.ts`](./config-inputs.ts)
  records the `tsconfig.json` or `jsconfig.json` and its `extends` chain.
  `readConfig` resolves relative `extends` and `baseUrl` from the canonical
  folder that defines them. That folder also anchors `paths` without `baseUrl`.
  `configuration` expands `${configDir}` from the top-level configuration's
  folder as found. [`config-json.ts`](./config-json.ts) accepts comments and
  trailing commas.
- [`serve-edit-imports.ts`](./serve-edit-imports.ts) withholds marked reuse for a
  written absolute import with unreadable config, a matching `paths` key, or a
  key with `${configDir}`. A bare alias with an absolute target still goes to
  [`serve-edit-lookups.ts`](./serve-edit-lookups.ts). That coordinator uses
  [`metafile-edges.ts`](./metafile-edges.ts) to classify each edge once and pass
  it to `ServeEditPaths` and `PackageFolderLookups`. Path staging comes first.
  Each recorder stages one request at `accept` and commits its checks at `finish`.
  Folder requests that can need a config scope, starting with the first such
  edge, wait for successful path staging. A failed recorder withholds the marker.
- [`bundle-graph.ts`](./bundle-graph.ts) also uses `MetafileEdges`. It maps
  `mokly-css:` to its stylesheet and follows a style wrapper to its wrapped
  import. Mokly's own authoring, JSX, and entry modules need no lookup.
- [`serve-edit-paths.ts`](./serve-edit-paths.ts) stages candidate folders and
  manifests before a bare selection and adds them to `lookupDirectories` and
  `lookupFiles` for `resolutionInputs`. It lends readable scopes to the folder
  pass. A chain it cannot read, such as a package `extends`, lends no scope or
  local `paths`. A missing physical selection, an unaccounted selection outside
  dependencies, or staging above `EVIDENCE_LIMIT` (8 MiB) withholds the marker.
- [`mapped-paths.ts`](./mapped-paths.ts) returns the selected key's targets in
  order, then the `baseUrl` candidate for a bare request or the written path for
  an alias with an absolute target. [`mapped-selection.ts`](./mapped-selection.ts)
  proves a candidate by a direct file, extension or TypeScript rewrite, or a
  direct `index` with a resolve extension. Otherwise a folder can contain the
  selection without proving it. The pass stages that folder and manifest and
  continues. If no later candidate proves it, the containing folder places it,
  including when a manifest entry field selected the module.

### Package Folder and PnP Evidence

- [`package-map.ts`](./package-map.ts) shares one description across full and
  marked captures. It collects matching `exports` and `imports` targets,
  conditions, and arrays to depth 32. It flags folder targets and the selected
  key, decodes relative targets as esbuild does, and adds mapped main fields.
- [`package-json.ts`](./package-json.ts) keeps the order and duplicate keys of
  the resolution fields because esbuild uses the first repeat. Its lazy
  `folderExportsPossible` uses `packageFolderKey`. `PhysicalInputs.packageJson`
  uses `parsePackageJson` to validate each manifest. [`package-lookup.ts`](./package-lookup.ts)
  finds the own package and yields installed, linked, and configured roots in order.
- [`package-folders.ts`](./package-folders.ts) places native selections. It tries
  configured candidates with a borrowed scope, then PnP roots, the own package
  with `exports`, and the other roots. A proven configured candidate needs no
  folder checks. A reachable PnP root can contain the selection; other roots must
  place it. An unplaced root is only a fallback. An unreachable matching folder
  map sets `registry`, so the caller keeps the PnP state file. An
  unreadable config chain or a containing configured candidate accounts for an
  otherwise unplaced selection. An unaccounted PnP selection fails closed. The
  read-only audit adds no package or link observations. A negative directory
  fact is not reused for unseen metadata or a possible folder map.
- [`package-folder-maps.ts`](./package-folder-maps.ts) describes and joins map
  targets. An ordinary `exports` map with no possible folder key tests literal
  placements before probing.
  An `imports` walk, or a forced walk after an `imports` folder target, fails
  closed at the depth limit. [`package-folder-location.ts`](./package-folder-location.ts)
  resolves map targets from written paths and uses canonical paths for observations
  and the audit. It compares physical files so a linked index still places its module.
- [`folder-candidates.ts`](./folder-candidates.ts) records presence and reserves
  row bytes and paths against `EVIDENCE_LIMIT` for marked capture, not for the
  full audit. Overflow releases staged paths and fails for a placed or unknown
  selection.
- [`package-folder-lookups.ts`](./package-folder-lookups.ts) stages candidate
  folders, written manifests, and the PnP state files needed by selected or
  removed roots. Its non-strict `ConfigInputs` uses the same physical read budget.
  An unreadable config chain adds no configured candidate. A read failure,
  unplaced known selection, or metadata bound withholds evidence.
  [`marked-file-evidence.ts`](./marked-file-evidence.ts) records private file,
  absent, and link entries beside `uncaptured: "serveEdit"`. If the table fits,
  has only those kinds, and fresh reads agree, the folder pass adds the candidate
  folders to the live lists.
- [`pnp-locations.ts`](./pnp-locations.ts) gives the alias-aware package roots and
  their reachability from a pinned state file. If an importer mapping can move
  resolution, all its roots count as reachable. [`pnp-index.ts`](./pnp-index.ts)
  indexes that state once and walks ancestors without copying locator, fallback,
  or ignore rules. [`pnp-json.ts`](./pnp-json.ts) parses `.pnp.data.json` and state
  embedded in `.pnp.cjs` or `.pnp.js` without execution. [`pnp-files.ts`](./pnp-files.ts)
  gives the state candidates up to the first present file.
- [`pnp-inputs.ts`](./pnp-inputs.ts) captures reachable folder maps after fresh
  state and manifest reads. For an unreachable matching root it observes only
  the state-file chain. It records covered canonical manifests and audits native
  selections with read-only `PackageFolders`. An uncovered map, unaccounted
  selection, metadata bound, or lookup error makes full evidence incomplete.

### Reading and Verifying Evidence

- [`physical-inputs.ts`](./physical-inputs.ts) owns synchronous evidence reads
  before resolution. It reads metadata files within 1 MiB and queues unique
  requests. Observations, read bytes, visited paths, and request keys each have an
  8 MiB bound. [`metadata-inputs.ts`](./metadata-inputs.ts) shares that budget and
  caches strict and tolerant parses from the same snapshots.
- [`physical-path-inputs.ts`](./physical-path-inputs.ts) shares the path budget.
  It keeps one negative directory fact per inspected path and supports bounded
  canonical probes without observations. Each visited path keeps its first-touch
  [`CaptureKind`](./capture-kind.ts), but later reads still check metadata and
  link targets. [`physical-input-reader.ts`](./physical-input-reader.ts) provides
  bounded reads and `realpathSync.native`. `currentEvidence` checks reuse with a
  fresh reader and no saved path kinds. [`file-digests.ts`](./file-digests.ts)
  streams each file through one 64 KiB buffer and checks inputs with four workers.
- [`capture-durability.ts`](./capture-durability.ts) sets `durable`, not `complete`,
  when `hello` supplies a capture hint. It can wait once up to 50 ms from compile
  start, then records the first directory and metadata identities and stamps.
  It reads the witnesses again after the last attempt.
  [`capture-paths.ts`](./capture-paths.ts) walks raw link targets and their parents
  under the shared path bound, borrows witnessed kinds, and rechecks the expansion
  charge on repeat walks. [`capture-runtime.ts`](./capture-runtime.ts) provides
  the clock, age guard, stat comparison, and Windows handle stat for accurate
  device IDs. [`capture-volumes.ts`](./capture-volumes.ts) classifies volumes by
  Linux filesystem type or by the hint.

### Vite Compilation and Replay

- [`vite-compiler.ts`](./vite-compiler.ts) compiles `vite` requests into a
  `ViteRecipe` with empty, incomplete reuse evidence.
  [`vite-context.ts`](./vite-context.ts) defines `ViteContext`, which keeps one
  Vite server for the JavaScript and stylesheet requests of a side. It replaces
  the server when roots, peers, the setup stamp, or metadata change. A change
  to a file that a stylesheet transform reported also replaces it.
  [`vite-setup.ts`](./vite-setup.ts) loads `vite.config.*` and starts Vite without
  HTTP, file watching, hot reload, or dependency pre-bundling. `setupStamp`
  digests the config, its imports, env files, and the configuration file list.
- [`vite-config.ts`](./vite-config.ts) loads the app's config in memory on both
  sides with Vite's default loader semantics. A function export receives `serve`
  and `development`. [`vite-config-bundle.ts`](./vite-config-bundle.ts) uses
  esbuild for the config and local imports without writing a file. It runs the
  result as ESM or CommonJS by config type. Installed packages stay external and
  resolve through `ViteLookup`. [`vite-config-resolution.ts`](./vite-config-resolution.ts)
  routes Node's bare imports through that lookup while the config loads.
  [`vite-config-source.ts`](./vite-config-source.ts) sets each bundled module's
  file values for `__dirname`, `__filename`, and `import.meta`.
  [`vite-config-context.ts`](./vite-config-context.ts) resolves dynamic `require`
  and `import()` from their own module. [`vite-config-errors.ts`](./vite-config-errors.ts)
  names a failing config file or import from the esbuild location or source map.
- [`vite-resolution.ts`](./vite-resolution.ts) owns the shared `ViteLookup`.
  Setup loads, the Mokly plugin, runner fetches, stylesheet imports, React
  peers, and external imports use it on both sides. It applies aliases, then
  tries each importer from
  [`vite-lookup-paths.ts`](./vite-lookup-paths.ts): the original path, its mapped
  installation path, then `node_modules` at each package root. It records package
  root candidates. `nodeEntry` asks Vite's server environment for the file that
  Node will load, from an existing importer at or above each candidate. Config
  imports, React peers, and external resolution use it, including when `resolve`
  receives an external result without a file.
- [`vite-peers.ts`](./vite-peers.ts) runs one esbuild peer lookup for Vite and
  peers other than React, then loads Vite and finds its real package path.
  [`vite-node-peers.ts`](./vite-node-peers.ts) scopes Node's resolve hook to each
  request so dependencies of a Vite generation load one React runtime.
  [`vite-react-peers.ts`](./vite-react-peers.ts) builds that table after setup and
  puts its alias rule first, so React and the JSX development shim reach the
  table before a setup alias can rewrite their imports.
- [`vite-external.ts`](./vite-external.ts) uses `ViteLookup` to choose the package
  file Node loads, also for setup aliases. It uses the extension or nearest
  manifest `type` to choose ESM or CommonJS. [`vite-styles.ts`](./vite-styles.ts)
  wraps `styled-components`, `react-native-web`, and `@emotion/react` from the
  copy that resolves. It checks the external resolver first and keeps the
  [CommonJS default import rules](../../../../docs/protocol/mokly-sidecar-modules.md#authoring-and-evaluation).
- [`vite-graph.ts`](./vite-graph.ts) records every fetch from the virtual entry
  before evaluation and builds the module graph. [`vite-fetch.ts`](./vite-fetch.ts)
  confines files and records their bytes and imports at the fetch boundary.
  [`vite-plugin.ts`](./vite-plugin.ts) handles virtual modules, React, style
  wrappers, stylesheet stubs, and path confinement before the setup plugins.
- [`vite-plugin-inputs.ts`](./vite-plugin-inputs.ts) pairs plugin `this.load` with
  `this.addWatchFile` in load and transform hooks. It emits a diagnostic instead
  of recording paths outside the source and dependency roots. After a fetch it
  retains each watched path that is not a code import of that module, even if
  another edge already names the file.
- [`vite-inputs.ts`](./vite-inputs.ts) records consumed bytes, rejects inconsistent
  reads, and verifies the files again after compilation. [`vite-metadata.ts`](./vite-metadata.ts)
  builds digests for setup files, plugin inputs, React manifests, preview, package
  and TypeScript config candidates, and consumed files outside the graph.
  [`vite-invalidation.ts`](./vite-invalidation.ts) compares the last input snapshot
  with the disk. It invalidates virtual, changed, and unsnapshotted modules, or
  all modules when a directory list changes.
- [`vite-evaluate.ts`](./vite-evaluate.ts) runs the generation once through Vite's
  module runner. A restored recipe uses only its recorded fetches, without reads
  or transforms. [`vite-urls.ts`](./vite-urls.ts) converts URLs, IDs, query
  variants, and virtual names to files and logical names.
  [`vite-errors.ts`](./vite-errors.ts) reports `bundle-failed` with the logical
  module, plugin, and, once loaded, the installed and tested Vite versions. It
  rewrites absolute paths to logical names and virtual names to “entry module”.
  `viteStylesheetFailure` uses the requested stylesheet path instead.

### Vite Stylesheets

- `ViteCompiler.stylesheet` in [`vite-compiler.ts`](./vite-compiler.ts) answers
  `transformViteCss`. It requests one stylesheet through the setup as an inline
  module. [`vite-css-transform.ts`](./vite-css-transform.ts) defines
  `ViteCssTransform`, which runs that request. It returns the CSS, the class
  map of a CSS Module, and the digests of the inputs of the transform.
- [`vite-css-hooks.ts`](./vite-css-hooks.ts) holds the hooks that `viteSetup`
  installs. They set Mokly's scoped names on both CSS transformers. They route
  Vite's stylesheet resolver through `ViteLookup.stylesheet` during a transform.
  They wrap `vite:css` and `vite:css-post`, so one native transform gives the
  class map and the inline CSS. A late `@import` that Vite drops is a failure.
- [`vite-css-paths.ts`](./vite-css-paths.ts) decides which files are Vite
  stylesheets and CSS Modules. Its `ViteCssUrls` keeps each authored relative
  `url()` and rebases the URL of an inlined file onto the requested stylesheet.

### Shared Rendering and Styles

- [`virtual-modules.ts`](./virtual-modules.ts) builds the authoring facade, the
  JSX development shim, and CSS Modules stubs for both compilers. It limits the
  reserved runtime imports to Mokly's own virtual modules.
- [`postcss.ts`](./postcss.ts) owns the PostCSS child processes.

## Related Docs

- [Sidecar module sources](../../../../docs/protocol/mokly-sidecar-modules.md)
- [Compiled recipes and release](../../../../docs/protocol/mokly-sidecar-recipes.md)
- [Vite adapter](../../../../docs/protocol/mokly-vite-adapter.md)
- [PostCSS contract](../../../../docs/protocol/mokly-imported-styles-postcss.md)
- [Package key code](../../README.md#key-code)
- [Rust sidecar pool](../../../../crates/mokly-sidecar/README.md)
