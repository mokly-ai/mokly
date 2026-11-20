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
  plan and no native compile. In a `full` call, one full capture owner and one
  preparation serve every attempt. A `serveEdit` call creates no full capture
  owner, no evidence plugin, and no durability check. It still records the
  consumed sources, the module graph, the metadata digests, and the directory
  lists. For its private folder files, `PackageFolderLookups` owns a separate
  `PhysicalInputs`.
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
  result before it drops the evidence. A `serveEdit` compile gets incomplete
  evidence with the `uncaptured: "serveEdit"` marker, and its inputs hold only
  its private folder files. A compile without a toolchain identity gets no
  marker. A `serveEdit` compile also gets no marker when
  `ServeEditImports.record` returns false or `PackageFolderLookups.record`
  returns no evidence.
  `bundleRecipe` calls both in the `sidecar.bundle.mapped-lookups` timing
  phase, before `resolutionInputs`.
- [`src/sidecar/serve-edit-imports.ts`](./serve-edit-imports.ts) holds
  `ServeEditImports`, which only a `serveEdit` compile creates. Its plugin
  clears `reusable` for an authored absolute specifier whose configuration it
  cannot read, or whose configuration has a `paths` key that matches it or
  contains `${configDir}`. It checks only specifiers that are written as
  absolute paths, so a bare alias with an absolute target goes to the next
  pass. Its `record` then calls `ServeEditPaths.record` in
  [`src/sidecar/serve-edit-paths.ts`](./serve-edit-paths.ts), which reads the
  metafile after the compile. It reads each edge through `MetafileEdges` in
  [`src/sidecar/metafile-edges.ts`](./metafile-edges.ts), which `moduleGraph`
  in [`src/sidecar/bundle-graph.ts`](./bundle-graph.ts) also uses. That reader
  maps a `mokly-css:` edge to its physical stylesheet, and it follows a style
  wrapper to its first import, the wrapped module. Mokly's own authoring,
  JSX, and entry modules need no lookup. For each authored bare import
  with a readable configuration chain, that pass adds the folders and the
  `package.json` candidates of the targets that esbuild tried before its
  selection to `lookupDirectories` and `lookupFiles`, which `resolutionInputs`
  turns into live inputs. `mappedCandidates` in
  [`src/sidecar/mapped-paths.ts`](./mapped-paths.ts) gives the mapped targets,
  then the `baseUrl` candidate of a bare request. For an alias with an
  absolute target, it gives the written path after a matched target instead,
  with no `baseUrl` step. `mappedPaths` in the same file gives the targets of
  the selected key in order. `mappedSelection` in
  [`src/sidecar/mapped-selection.ts`](./mapped-selection.ts) compares each
  candidate with the selected module. A candidate file, one of its extension
  or TypeScript rewrite files, or an `index` file with a resolve extension
  directly inside the canonical candidate folder proves that candidate, and
  the pass stops at it. Any other module inside that folder is only
  contained, because an entry field of the folder's `package.json` or a later
  candidate can select it. The pass then adds that folder and its
  `package.json`, and it goes on with the remaining candidates, because it
  cannot tell which candidate selected the module. When no later candidate
  proves the module, the containing folder places it. So a compilation keeps
  its marker when a mapped package folder selects its module through an entry
  field. `ServeEditPaths.scope` gives no settings for a configuration chain
  that it cannot read, such as one with a package `extends`, where
  `readConfig` stops before the local `compilerOptions`. Such an import adds
  nothing, also for a local `paths` map. A configured selection without a
  physical file, a selection outside the dependencies that no candidate
  proves or contains, or staged paths above the 8 MiB `EVIDENCE_LIMIT` make
  `record` return false.
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
  and their private folder files. A `full` request never takes a marked
  compilation. Its `restore` installs a recipe without a compile.
- [`src/sidecar/toolchain.ts`](./toolchain.ts) holds
  `toolchainIdentity`, which each sidecar process computes once from the
  package root, the Mokly, esbuild, and Node versions, and every `dist/` file.
- [`src/sidecar/resolution-evidence.ts`](./resolution-evidence.ts)
  holds `ResolutionEvidence`, the esbuild plugin that records the candidate
  directories, manifests, and configurations of each import before esbuild
  resolves it. A form that it cannot map makes the evidence incomplete. Its
  `paths` step records every target of each matching key from `mappedPaths`,
  also for an absolute import. Its package step records the main-field and
  package-map targets of the own, PnP, installed, linked, and configured
  packages through the shared package-map description below. When a PnP
  data file exists, its `finish` lets `PnpInputs` check each native bare
  selection.
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
- [`src/sidecar/package-map.ts`](./package-map.ts) is the one package-map
  description that the full capture and the marked checks share.
  `packageMapTargets` gives the targets of the matching `exports` or `imports`
  keys, conditions, and arrays. It marks the folder-map targets and the key
  that esbuild selects. `packageTarget` decodes a package-relative target as
  esbuild does, and `packageFolderCandidates` adds the main-field targets of a
  mapped folder. [`src/sidecar/package-json.ts`](./package-json.ts) holds
  `parsePackageJson`, which validates a manifest and returns a `PackageJson`.
  It keeps the order and every repeated key of the fields that resolution
  reads, because esbuild uses the first repeated key.
  `PhysicalInputs.packageJson` parses each manifest of the package walkers
  with it. In [`src/sidecar/package-lookup.ts`](./package-lookup.ts),
  `nearestPackage` finds the own package, and `packageDirectories` gives the
  installed, linked, and configured package roots.
  [`src/sidecar/package-folders.ts`](./package-folders.ts) holds
  `PackageFolders`, which takes the shared `PnpLocations` and a
  `ConfigInputs`. After a compile, its `lookup` places a native selection
  among these candidates. It first tries the configured candidates of
  `mappedCandidates`. When `mappedSelection` proves one of them, as in the
  `paths` pass above, the selection needs no folder checks. Otherwise a
  package root counts only when its canonical folder, from
  `PhysicalInputs.canonicalDirectory`, contains the selected module: a
  `PnpLocations` root, the own package with `exports`, or an installed,
  linked, or configured root. When no qualified root accounts for the
  selection, it still counts as placed when a configured candidate contains
  the selected module, or when the configuration chain cannot be followed.
  Otherwise, with a PnP state file, the lookup throws, so each caller fails
  closed. In its read-only mode, it adds no package or link observation.
  `lookup` returns the candidates, the defining manifests, and whether it
  placed the module.
  [`src/sidecar/package-folder-lookups.ts`](./package-folder-lookups.ts) holds
  `PackageFolderLookups`. Its `record` uses `PackageFolders`, with its own
  `PnpLocations`, to find each import that a package folder mapping selects,
  and it adds the candidate folders to the live lookup directories. Its
  `PackageFolders` builds a non-strict `ConfigInputs` on the same
  `PhysicalInputs` budget. A configuration chain that it cannot follow, such
  as one with a package `extends`, then adds no configured candidate. A read
  failure still makes the lookup incomplete. `markedFileEvidence` in
  [`src/sidecar/marked-file-evidence.ts`](./marked-file-evidence.ts) turns the
  folder files into the private evidence of the marked compilation: file,
  absent, and link entries beside the `uncaptured: "serveEdit"` marker.
  `record` returns no evidence when it cannot place such an import, when its
  staged paths or its table pass `EVIDENCE_LIMIT`, when it cannot read the
  package metadata of an import within the metadata bounds, or when the table
  holds another kind or fails a fresh read.
- [`src/sidecar/pnp-locations.ts`](./pnp-locations.ts) holds `PnpLocations`,
  the shared catalogue of PnP package roots. On first use, it finds the
  present PnP state file, reads it through `PhysicalInputs`, and parses it
  with `pnpJson`. Its `roots` gives the physical root candidates of a package
  name and its alias identifiers, without copying PnP locator, fallback, or
  ignore selection. [`src/sidecar/pnp-inputs.ts`](./pnp-inputs.ts) holds
  `PnpInputs`, the PnP capture and audit owner of a `full` compile. Its
  `capture` records the folder maps of the `PnpLocations` roots, after a
  fresh read confirms the pinned state file and manifest. Its `finish` checks
  each native bare selection through a read-only `PackageFolders` that
  borrows the `ConfigInputs` of `ResolutionEvidence`. It makes the evidence
  incomplete for an uncovered folder map, a native selection that nothing
  accounts for, a metadata bound, or another lookup error.
  [`src/sidecar/pnp-json.ts`](./pnp-json.ts) reads `.pnp.data.json` and the
  state that `.pnp.cjs` or `.pnp.js` embeds, without running their code.
  `pnpFiles` in [`src/sidecar/pnp-files.ts`](./pnp-files.ts) gives the PnP
  state files that native discovery checks, up to the first present one.
- [`src/sidecar/physical-inputs.ts`](./physical-inputs.ts) holds
  `PhysicalInputs`, the one owner of the evidence reads. It reads each
  metadata file within 1 MiB and queues each unique resolution request once.
  `MetadataInputs` in [`src/sidecar/metadata-inputs.ts`](./metadata-inputs.ts)
  parses its configurations and package manifests from the same snapshots,
  within its one read budget. Each queued capture uses synchronous
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
