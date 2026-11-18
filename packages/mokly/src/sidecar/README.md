# Render Sidecar

The render sidecar is the Node process that the Mokly binary starts to bundle,
describe, and render catalogue modules. The
[package README](../../README.md#key-code) names the other key code of
`@mokly/mokly`, and the
[render sidecar contract](../../../../docs/protocol/mokly-sidecar.md) defines
its requests and results. The paths below are relative to the package root.

## Key Code

- [`src/sidecar.ts`](../sidecar.ts) is the sidecar process entry, which
  reads framed requests from the binary and writes one response for each.
- [`src/sidecar/session.ts`](./session.ts) holds `Session`, which
  dispatches each sidecar request to its method. It removes the request-only
  `capture` and `plan` values of a `bundle` request before the reuse check,
  the compile, the identity, and the restore see the settings. It gives a
  `CaptureDurability` only to a `full` request.
- [`src/sidecar/transport.ts`](./transport.ts) splits and decodes
  the binary's typed requests and limits the size of each response.
- [`src/sidecar/bundle.ts`](./bundle.ts) holds `bundle`, which
  compiles the catalogue modules. Each call shares its read bytes across
  attempts, while each attempt keeps its own consumed-file and CSS-module
  records. esbuild resolves most imports itself, and
  [`src/sidecar/native-plan.ts`](./native-plan.ts) classifies the
  result. It plans a second compile when esbuild's own resolution would change
  the bundle. Its `planNative` keys each planned import by importer,
  specifier, and import kind, and it reports whether the native compile is
  exact. A failed native compile compiles again with full resolution. The
  resolve callback of `consumerPlugins` in
  [`src/sidecar/plugins.ts`](./plugins.ts) applies the resolution
  mode of
  [`src/sidecar/native-resolution.ts`](./native-resolution.ts). A
  planned compile resolves each import outside its plan with the full
  resolver. A `full` call keeps the native plan, also of an exact native
  compile. A `serveEdit` call with a plan runs one planned compile with that
  plan and no native compile. In a `full` call, one evidence owner and one
  preparation serve every attempt. A `serveEdit` call creates no evidence
  owner, no evidence plugin, and no durability check. It still records the
  consumed sources, the module graph, the metadata digests, and the directory
  lists.
  [`src/sidecar/bundle-entry.ts`](./bundle-entry.ts) builds the
  virtual entry module. `configuredFiles` in
  [`src/sidecar/configured-files.ts`](./configured-files.ts), the
  first plugin of each attempt, resolves each of its imports to the canonical
  configured file or selected preview file, so TypeScript `paths` never apply
  to it. Without a captured preview selection, a `serveEdit` call selects only
  a regular preview file.
- [`src/sidecar/bundle-recipe.ts`](./bundle-recipe.ts) holds
  `bundleRecipe`, which turns one compile into its compiled recipe: the module
  graph, the input digests, the reuse evidence, the toolchain identity, and
  the compilation identity. An incomplete recipe gets a fresh identity, also
  when `checkRecipeSize` in
  [`src/sidecar/recipe-size.ts`](./recipe-size.ts) drops its
  evidence to fit a frame. `checkRecipeSize` drops the optional plan of the
  result before it drops the evidence. A `serveEdit` compile gets empty,
  incomplete evidence with the `uncaptured: "serveEdit"` marker. A compile
  without a toolchain identity gets no marker. A `serveEdit` compile also gets
  no marker when `ServeEditImports.record`, which `bundleRecipe` calls before
  `resolutionInputs`, returns false.
- [`src/sidecar/serve-edit-imports.ts`](./serve-edit-imports.ts) holds
  `ServeEditImports`, which only a `serveEdit` compile creates. Its plugin
  clears `reusable` for an authored absolute specifier whose configuration it
  cannot read, or whose configuration has a `paths` key that matches it or
  contains `${configDir}`. It checks only specifiers that are written as
  absolute paths, so a bare alias with an absolute target goes to the next
  pass. Its `record` then calls `ServeEditPaths.record` in
  [`src/sidecar/serve-edit-paths.ts`](./serve-edit-paths.ts), which reads the
  metafile after the compile. For each authored bare import with a readable
  configuration chain, that pass adds the folders and the `package.json`
  candidates of the targets that esbuild tried before its selection to
  `lookupDirectories` and `lookupFiles`, which `resolutionInputs` turns into
  live inputs. Its `candidates` gives the mapped targets, then the `baseUrl`
  candidate of a bare request. For an alias with an absolute target, it gives
  the written path after a matched target instead, with no `baseUrl` step.
  `mappedPaths` in
  [`src/sidecar/mapped-paths.ts`](./mapped-paths.ts) gives the targets of the
  selected key in order, and `mappedSelection` in
  [`src/sidecar/mapped-selection.ts`](./mapped-selection.ts) places the
  selected module. `ServeEditPaths.scope` gives no settings for a
  configuration chain that it cannot read, such as one with a package
  `extends`, where `readConfig` stops before the local `compilerOptions`. Such
  an import adds nothing, also for a local `paths` map. A
  selection that the pass cannot place, or staged paths above the 8 MiB
  `EVIDENCE_LIMIT`, make `record` return false.
- [`src/sidecar/captured-plan.ts`](./captured-plan.ts) holds
  `capturedPlan`, which gives the result of a `full` compile its native plan
  only with complete, durable, and unmarked evidence. The plan and the
  evidence must fit 8 MiB together. It counts their JSON bytes without
  building an oversized string.
- [`src/sidecar/compiled.ts`](./compiled.ts) holds `reuse`, which
  accepts an earlier compilation only while its settings, dependency roots,
  toolchain, input digests, and directory lists still match. It tries the
  captured compilations first, and also checks their reuse evidence. Then a
  `serveEdit` request tries the marked compilations with these live checks
  alone. A `full` request never takes a marked compilation. Its `restore`
  installs a recipe without a compile.
- [`src/sidecar/toolchain.ts`](./toolchain.ts) holds
  `toolchainIdentity`, which each sidecar process computes once from the
  package root, the Mokly, esbuild, and Node versions, and every `dist/` file.
- [`src/sidecar/resolution-evidence.ts`](./resolution-evidence.ts)
  holds `ResolutionEvidence`, the esbuild plugin that records the candidate
  directories, manifests, and configurations of each import before esbuild
  resolves it. A form that it cannot map makes the evidence incomplete. Its
  `paths` step records every target of each matching key from `mappedPaths`,
  also for an absolute import.
  [`src/sidecar/resolution-request.ts`](./resolution-request.ts)
  applies written plugin names and aliases before built-in filtering.
  [`src/sidecar/config-inputs.ts`](./config-inputs.ts) records
  each `tsconfig.json` or `jsconfig.json` and its `extends` chain. Its
  `readConfig` resolves a relative `extends` or `baseUrl` from the canonical
  folder of the configuration that defines it, through
  `PhysicalInputs.canonicalFile`. That folder is also the base of the `paths`
  targets when no `baseUrl` applies. Its `configuration` then expands a
  `${configDir}` prefix from the folder of the top-level configuration, as
  found. [`src/sidecar/config-json.ts`](./config-json.ts) parses JSON
  with comments and trailing commas.
- [`src/sidecar/physical-inputs.ts`](./physical-inputs.ts) holds
  `PhysicalInputs`, the one owner of the evidence reads. It reads each
  metadata file within 1 MiB, parses the configurations, and queues each
  unique resolution request once. Each queued capture uses synchronous
  filesystem reads before esbuild resolves the import. Its retained
  observations, metadata read bytes, visited paths, and request keys each stay
  within 8 MiB. Each charged visited path keeps its first-touch kind. Later
  presence and kind probes of the same capture use that kind, but metadata
  content and link targets are still read. `currentEvidence` reads the
  evidence again for a reuse check, with no saved kind. The protected
  filesystem operations of the same owner are in
  [`src/sidecar/physical-input-reader.ts`](./physical-input-reader.ts),
  which uses bounded reads and `realpathSync.native` for canonical paths. Its
  `pathKinds` map holds the first-touch kinds, of the `CaptureKind` type in
  [`src/sidecar/capture-kind.ts`](./capture-kind.ts).
  [`src/sidecar/file-digests.ts`](./file-digests.ts) streams each
  file digest through one 64 KiB buffer and checks inputs with four workers.
- [`src/sidecar/capture-durability.ts`](./capture-durability.ts)
  holds `CaptureDurability`, which decides the `durable` flag of the reuse
  evidence when `hello` carries a `capture` hint. Before the first observation
  of a compile, it can wait once, until at most 50 ms after the compile starts.
  It records the stamps and the identity of each directory and metadata file
  at the first touch, and it reads them again after the last attempt. It never
  changes `complete`.
  [`src/sidecar/capture-paths.ts`](./capture-paths.ts) follows raw
  link targets and observes their parent directories within the same path bound.
  Through `CaptureDurability.sharePaths`, `CapturePaths.share` borrows the kinds
  that the physical owner already charged and witnessed. A repeat of a
  successful whole walk checks its recorded expansion charge again.
  `CaptureDurability.finish` still reads each witness afresh.
  [`src/sidecar/capture-runtime.ts`](./capture-runtime.ts) holds
  the stat and clock boundary and the age guard. On Windows, its
  `captureSnapshot` reads a witness through `handleStat`, a read-only handle
  stat, because some libuv versions report a wrong device for a path stat.
  `sameCaptureStat` compares a witness with its recheck.
  [`src/sidecar/capture-volumes.ts`](./capture-volumes.ts)
  classifies each volume by its Linux file system type or by the hint.
- [`src/sidecar/postcss.ts`](./postcss.ts) holds `PostcssWorkers`,
  which owns the PostCSS child processes.
- [`src/generated/sidecar`](../generated/sidecar) holds the request and
  result types that `cargo xtask generate-types` writes from the Rust types.
- The [Rust sidecar pool](../../../../crates/mokly-sidecar/README.md) starts and
  stops the sidecar processes.
