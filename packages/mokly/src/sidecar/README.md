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

- [`src/sidecar.ts`](../sidecar.ts) is the sidecar process entry, which
  reads framed requests from the binary and writes one response for each. For
  a request with `quiet: true`, it silences consumer output until the reply.
- [`src/sidecar/timing-output.ts`](./timing-output.ts) holds `timingOutput`,
  which wraps standard error: timing records start on their own line and use
  the original writer, and its `quiet` control drops every other write.
- [`src/sidecar/session.ts`](./session.ts) holds `Session`, which
  dispatches each sidecar request to its method. It passes the params of a
  `prepareContext` request to `PostcssWorkers.prepare` and answers without
  waiting for the child. It removes the request-only
  `capture`, `plan`, and `preparation` values of a `bundle` request before the
  reuse check, the compile, the identity, and the restore see the settings. A
  `bundle` request starts no PostCSS child. When the bundle fails, the session disposes
  the context of its `preparation` before it returns the error. It gives a
  `CaptureDurability` only to a `full` esbuild request. It ignores a
  `restoreGeneration` request for an id that it already holds. It adds each
  generation that a `restoreGeneration` request installs to a `WeakSet`. Both
  reply forms of `bundle` follow the same checks of `reuse` and the same size
  check of `bundleResult`. The reply is a short
  `RestoredBundle` under the
  [restored reuse rules](../../../../docs/protocol/mokly-sidecar-recipes.md#restored-reuse)
  only when `reuse` selected a generation of that set, the size check kept the
  same reuse evidence, and the result has no plan. Every other `bundle` reply
  is the full result, such as after a fresh compile or after the reuse of a
  generation that a `bundle` request installed. A generation that a `bundle`
  request installs replaces the generation of an equal id, and it is never in
  that set.
  It keeps one `KeptContext` for the guarded compiles of its `serveEdit`
  requests, emits an `esbuild` operation for each of its rebuilds, and
  disposes of it at `shutdown`.
  It sends `vite` bundles and `transformViteCss` requests to `ViteCompiler`,
  and awaits `evaluateVite` before describing or rendering a Vite generation.
- [`src/sidecar/transport.ts`](./transport.ts) splits and decodes
  the binary's typed requests and limits the size of each response. Its
  `encodeResponse` encodes each response with `jsonText` from
  [`src/sidecar/json.ts`](./json.ts), which sorts object keys in UTF-16
  order and keeps negative zero.
- [`src/sidecar/describe.ts`](./describe.ts) holds `describe`, which
  evaluates the bundle and collects the definitions of the entry modules and
  the stories files. It walks each stories file once. Its local `withSource`
  helper turns the error of one step into `bundle-failed` that names the
  failing source, else the entry and stories files.
- [`src/sidecar/export-order.ts`](./export-order.ts) holds `orderedExports`,
  which restores source order with parsed names from the `ExportNameCache` of
  [`src/sidecar/export-name-cache.ts`](./export-name-cache.ts) that its caller
  passes. `describe` keeps one bounded cache for the process and passes it to
  `orderedExports` and `describeStoryFile`. Each call reads the current
  namespace values.
- [`src/sidecar/story-reader.ts`](./story-reader.ts) holds
  `readStories`, which composes CSF 2, CSF 3, and CSF Factories. It takes the
  preview of the stories file's Storybook folder from the `previews` export of
  the virtual entry. It gives Storybook that whole preview module, so that
  Storybook reads each preview setting from the default export and then from
  the named exports, or the composed settings of a `definePreview` preview. It
  loads `@storybook/react` from the entry that `storybookReact` of the compiled
  recipe gives for the folder, else from the configuration directory. It
  selects stories by their tags and keeps Storybook names, tags, descriptions,
  the folder, and the preview's composed `beforeAll` hook. It passes the cache
  from `describeStoryFile` to `orderedExports`. For a render, it wraps the
  `beforeEach` hooks of the project, the meta, and the story, so that each
  returned cleanup goes to the cleanup list of that render. It also adds a first
  project loader that gives the render the context that `load()` prepares.
- [`src/sidecar/stories.ts`](./stories.ts) holds `describeStoryFile`,
  which collects one stories file. It makes the first included story the
  parent and the other stories its variants. It records each story's data
  args, control hints, and ignored `mokly` parameter values, and omits
  function and React element args without warnings.
- [`src/sidecar/story-parameters.ts`](./story-parameters.ts) holds
  `readStoryParameters`, which reads a story's `mokly` parameter into the
  globals of each viewport and colour scheme, and into the ignored values with
  their paths and reasons.
- [`src/sidecar/story-setup.ts`](./story-setup.ts) holds
  `setupStories`, which keeps one active `beforeAll` setup for the process,
  keyed by its generation and its Storybook folder. Before a story of another
  generation or folder sets up, it runs the cleanup of the active setup. It
  remembers each setup failure by its generation and folder, and it throws
  that failure again for each later story of that pair.
- [`src/sidecar/render.ts`](./render.ts) holds `render`, which
  renders screens and Mokly components.
- [`src/sidecar/render-markup.ts`](./render-markup.ts) holds `renderMarkup`,
  which renders React to static markup, collects styles, and checks the
  markup for invalid markers and reserved elements.
- [`src/sidecar/story-render.ts`](./story-render.ts) holds `renderStory`.
  It first awaits `setupStories`, so that the `beforeAll` setup of the story's
  generation and Storybook folder is active before it composes a fresh portable
  story. Then it puts the requested data props on the story's args, removes
  each data arg that the request leaves out, and sets the view globals from the
  story's `mokly` parameter and the view. It awaits `load()`, and renders the
  story's `unboundStoryFn` on the context that `load()` prepared, so that the
  loaders, the hooks, the decorators, and the markup share one context. A
  Storybook without that function keeps the portable story call. Then it runs
  the render's `beforeEach` cleanups in reverse order in a `finally` block.
  A story error result carries the export ID, display name, and reason in
  logical source space. Mokly's authoring errors, coded errors, and errors
  from its output checks fail the request.
- [`src/sidecar/storybook-folders.ts`](./storybook-folders.ts) holds
  `storybookFolder`, which gives the Storybook folder of a stories file from
  the `storybookFolders` bundle param, with `.storybook` for a file without
  one, and `storybookFolders`, the sorted folders of the stories files.
  `storybookCandidates` gives the `main` or `preview` file names of a folder in
  Storybook's extension order. `probePreviews` makes the original preview
  selection of each folder before the compile: the first candidate that is a
  regular file, with its resolved file, and the names of the absent
  candidates. Its `PreviewProbe` also keeps the digests of the other present
  candidates and the link targets that the probe saw. `previewModules` gives
  the selected files. `namePreviews` adds each logical name from the compiler's
  entry edges. `recordPreviewInputs` adds every candidate to the
  physical and metadata inputs, and `previewsCurrent` checks the selection
  again before a reuse.
- [`src/sidecar/storybook-main.ts`](./storybook-main.ts) holds
  `storybookFrameworks`, which the `loadStorybook` method of `consumerRequire`
  in [`src/sidecar/paths.ts`](./paths.ts) calls when the configuration
  directory does not resolve `@storybook/react`. The esbuild compile calls
  `loadStorybook` from its peer lookup with the `main.*` cache of the call.
  The Vite compile calls it after `ViteContext` opens the setup. The reuse
  probe and the Vite stylesheet transform do not call it. For each folder,
  `storybookFrameworks` finds `main.*` in Storybook's order and reads its
  `framework` with Storybook's own loader from the project's `storybook`
  package. Then it resolves `@storybook/react` from the framework package. A
  framework named by an absolute directory resolves through its
  `package.json`. When a step finds no file or package, it throws the error
  that the lookup of `@storybook/react` from the configuration directory gave.
  The loader runs in a worker thread from
  [`src/sidecar/storybook-main-worker.ts`](./storybook-main-worker.ts), so
  that the TypeScript loader that Storybook registers and the module cache of
  `main.*` stay local to one read, also across edits in Serve. The worker
  resolves Node imports with the side's installation and repository mapping.
  It clears Mokly's aliases, conditions, main fields, extensions, and loaders.
  The worker keeps each distinct whole-file digest that it observes. It takes
  the digest of each repository file that the load opens for reading, from the descriptor
  before the caller reads, and it returns the resolved name of a read through
  a link beside the authored name. A loader failure names the file, the
  installed Storybook version, and the tested range. The result gives the
  `@storybook/react` entry of each folder, which the compiled recipe keeps as
  `storybookReact`, and the dependency directories that the loads used, which
  the recipe adds to `unmappedDependencyDirectories`. The same file holds
  `readStorybook`, which `Session` runs for a `readStorybook` request before
  discovery. It finds the `main.*` of one folder and resolves the `storybook`
  package from the configuration directory, else from the parent of the
  folder. The worker passes each `stories` entry to Storybook's
  `normalizeStoriesEntry`. The result keeps the entries in order and the
  dependency directories that the read used. It keeps all observed digests
  of repository files outside `node_modules` and the absent candidates.
- [`src/sidecar/storybook-inputs.ts`](./storybook-inputs.ts) holds
  `recordStorybookInputs`, which `bundleRecipe` and `viteMetadata` call. It
  records the fallback's reads and the direct lookup's `package.json`
  candidates, including absences, as physical inputs. Paths inside the source
  root or a selected dependency directory also become metadata inputs.
  Complete reuse evidence adds each file as an identity input. Conflicting
  observations of a file make the compilation ineligible for reuse.

### esbuild Compilation and Reuse

- [`src/sidecar/bundle.ts`](./bundle.ts) holds `bundle`, which
  compiles the catalogue modules. Each call shares its read bytes across
  attempts, while each attempt keeps its own consumed-file and CSS-module
  records. `startCapture` in
  [`src/sidecar/bundle-capture.ts`](./bundle-capture.ts) creates that shared
  state. It also keeps the `PreviewProbe` of the call and the `main.*` reads,
  so every attempt of a call uses the original preview selection and reads
  each `main.*` once. Each attempt takes its esbuild options and plugin order
  from `bundleOptions` in
  [`src/sidecar/bundle-options.ts`](./bundle-options.ts).
  A native compile treats a handled `require` failure as an error. Serve edit
  compiles retain diagnostics for `require` targets that can be unknown until
  evaluation. esbuild resolves most imports itself, and
  [`src/sidecar/native-plan.ts`](./native-plan.ts) classifies the
  result. It plans a second compile when esbuild's own resolution would change
  the bundle. Its `planNative` records each planned import through
  `PlanBuilder` and reports whether the native compile is exact. It also
  records selected native targets for the candidate collector of a captured
  compile. An uncaptured native Serve edit leaves relative imports to esbuild
  through a fixed filter. A skipped relative external edge makes its native
  result inexact, so its fresh plan drives the complete planned compile.
  Captured native attempts keep the broad consumer filter because the evidence
  callback already needs the Go/Node packet. A failed native compile compiles
  again with full resolution. The
  resolve callback of `consumerPlugins` in
  [`src/sidecar/plugins.ts`](./plugins.ts) applies the resolution
  mode of
  [`src/sidecar/native-resolution.ts`](./native-resolution.ts). A
  complete planned compile resolves each import outside its plan with the full
  resolver. A `full` call keeps the native plan, also of an exact native
  compile. In a `full` call, one full capture owner and one preparation serve
  every attempt. A `serveEdit` call creates no full capture owner, no evidence
  plugin, and no durability check. It still records the consumed sources, the
  module graph, the metadata digests, and the directory lists.
  [`src/sidecar/bundle-entry.ts`](./bundle-entry.ts) builds the
  virtual entry module. Its `previews` export holds the selected preview of
  each Storybook folder, keyed by the folder. On esbuild, the entry loads each
  preview with `require`, so a CommonJS preview and an ES module preview give
  Storybook the same exports. On Vite, it imports each preview as a namespace.
  `configuredFiles` in
  [`src/sidecar/configured-files.ts`](./configured-files.ts), the
  first plugin of each attempt, resolves each of its imports to the canonical
  configured file or selected preview file, so TypeScript `paths` never apply
  to it. Without a captured probe, `entryModule` runs `probePreviews` itself.
  It returns the probe. The recipe records its selections and their compiler
  edge names as `storybookPreviews`. `restore` adds the selected files to
  the configured files.
- For a `serveEdit` call with a plan, `bundle` runs no native compile. It
  starts with a guarded planned compile, in which esbuild itself resolves the
  selected safe relative specifiers of the plan. `PlannedRelative.create` in
  [`src/sidecar/planned-relative.ts`](./planned-relative.ts) classifies the
  relative specifiers of the plan on each request. A specifier is safe when
  none of its planned targets has distinct parse settings, such as a package
  `type` or `tsconfig.json` settings. Each of its targets must also keep its
  planned side-effect flag. `create` also counts the planned imports of each
  safe specifier. The resolve callback of `consumerPlugins` takes every
  specifier outside the selection. Its filters come from `specifierFilter` in
  [`src/sidecar/specifier-filter.ts`](./specifier-filter.ts). The selection
  comes from `selectSpecifiers` in
  [`src/sidecar/specifier-selection.ts`](./specifier-selection.ts). It sorts
  the safe specifiers once, by planned imports per character, highest first.
  In that order, it adds a specifier to a trie only when its new nodes keep
  the trie within 24,000 nodes. A specifier adds one node for each character
  after the prefix that it shares with the trie. A specifier that does not fit
  stays out, and a later specifier can still fit. So the selection prefers
  frequent, short safe specifiers within its node bound. `specifierPatterns` in
  [`src/sidecar/specifier-patterns.ts`](./specifier-patterns.ts) reuses that
  trie. It measures each distinct subtree once. It then emits the exact
  complement of the trie as disjoint patterns of bounded size, so no step
  builds one large pattern. Together the patterns match every specifier except
  the selected specifiers. When the patterns would pass their total bound,
  `specifierFilter` keeps no specifier. It caches one result, keyed by a
  digest of the freshly classified safe specifiers and their planned import
  counts. Every request still checks the target parse settings and side-effect
  flags. The cache keeps only that digest, the final patterns, and the
  selected specifiers. It keeps no trie, subtree sizes, import counts, plan,
  or filesystem facts. An unsafe specifier, a specifier outside the plan, and a
  safe specifier that the selection leaves out keep the callback. So an edit
  that adds a new specifier, such as `./new-file`, resolves it with the full
  resolver in the same compile. When `create` keeps no specifier, the compile
  is the complete planned compile. The callback records the importer,
  specifier, and kind key of each outer import that it answers, never of an
  inner resolution that a plugin requests. After the compile,
  `PlannedRelative.verify` checks each internal relative edge between physical
  files whose key the callback did not answer. When its key has a plan entry,
  its target must equal the planned path. When the selection holds its specifier,
  preparation already proved the parse settings and side-effect flag of that
  target. Every other edge, also one without a plan entry, needs
  `classifyNativeTarget`, which `planNative` also uses. Its target must map to
  itself, with no distinct parse settings and no module fallback, and a
  planned edge must keep its planned side-effect flag. So an omitted safe
  specifier can pass, while a target with distinct parse settings or another
  side-effect flag fails, even at the planned path. The metadata facts behind
  these checks must also stay unchanged from before preparation until the end
  of the proof. After its last metadata read, `MetadataProof` in
  [`src/sidecar/metadata-proof.ts`](./metadata-proof.ts) stats each
  `package.json`, `tsconfig.json`, and `jsconfig.json` that gave such a fact.
  It also checks the directories and links that locate those facts.
  Each must pass `mature`, the age guard of
  [`src/sidecar/capture-runtime.ts`](./capture-runtime.ts), against a start
  time. The sidecar takes that time before `PlannedRelative.create` reads any
  fact. So a change after that start fails the proof, also when a later write
  restores the old bytes. A change within the age guard before that start
  fails it too. The same rule proves a file or directory that only the proof
  reads, after the compile. A file or directory that the proof cannot stat
  also fails the proof. The whole proof needs no esbuild call and never waits.
  It creates no `CaptureDurability` and keeps no stamp after the request. A
  failed proof discards the guarded result. Each external edge
  whose specifier the selection holds also discards it, because such an edge has no
  target. Examples are a relative `require.resolve` and a failed relative
  `require` inside `try`. An external relative `require.resolve` or
  `require` edge that the callback did not answer discards it too. `verify`
  records the observations of the unanswered internal edges only after every
  edge passes. Their names are relative, and dependency usage records only bare
  names, so they add none.
  After a discarded result or a failed guarded compile, `bundle` runs the
  complete planned compile, in which the callback takes every import. That
  compile gives the result or the error. A guarded result that stands has the
  output, the evidence, the watch inputs, and the returned plan of the
  complete planned compile.
  The guarded compile rebuilds the kept context of the session; the complete
  planned compile is always a fresh build.
- [`src/sidecar/kept-context.ts`](./kept-context.ts) holds `KeptContext`, the
  one esbuild build context of a process under the
  [kept build context rules](../../../../docs/protocol/mokly-sidecar-kept-context.md).
  `bundle` uses it only as the compile function of a guarded attempt. Each
  request plugin sets up against a recorder, which lists its hooks. The setups
  follow the order of a fresh build: they run over a copy of the plugin list,
  `resolve` fails until every setup has ended, and the compile reads the build
  options after the setups, so an option that a setup assigns through
  `initialOptions` counts. The key of the context holds those build options
  without plugins, the plugin names, and the kind, filter, and namespace of
  each hook. An equal key rebuilds the context. Another key disposes of it and
  creates a new one, and a failed setup or rebuild disposes of it. The plugins
  of the context hold only those hook shapes and forward each call to the
  hooks of the current request, which the compile clears after its rebuild. A
  request's `onDispose` hooks run after its rebuild, as after a fresh build.
- [`src/sidecar/bundle-recipe.ts`](./bundle-recipe.ts) holds
  `bundleRecipe`, which turns one compile into its compiled recipe: the module
  graph with `importedAsset` flags, the input digests, the reuse evidence, the
  toolchain identity, and the compilation identity. A compile with a full
  capture owner hashes the asset flags into its identity. Without that owner,
  such as in a `serveEdit` compile, the compile hashes no module source into
  its identity, because its incomplete evidence adds the random runtime key.
  An incomplete recipe gets a fresh identity, also when `checkRecipeSize` in
  [`src/sidecar/recipe-size.ts`](./recipe-size.ts) drops its
  evidence to fit a frame. `checkRecipeSize` drops the optional plan of the
  result before it drops the evidence. For a new compile, `bundleRecipe`
  passes a request-local map through `bundleResult` in
  [`src/sidecar/compiled.ts`](./compiled.ts). The check then encodes the
  `compiled` and `modules` members once each with `jsonText` and counts the
  bytes of those texts. It keeps both texts when it drops the plan, and it
  encodes `compiled` again when it drops the evidence. A `serveEdit` compile
  gets incomplete evidence with the `uncaptured: "serveEdit"` marker, and its
  inputs hold its private folder and workspace lookup files. A compile without
  a toolchain identity gets no marker. A `serveEdit` compile also gets no
  marker when `ServeEditImports.record` returns no evidence. `bundleRecipe` calls it in
  the `sidecar.bundle.mapped-lookups` timing phase, before `resolutionInputs`.
- [`src/sidecar/asset-imports.ts`](./asset-imports.ts) holds the asset
  extension list, the longest consumer-loader lookup, the closed tokens, and
  the imported paths of each compile, keyed by its consumed-byte map.
- [`src/sidecar/recipe-encoding.ts`](./recipe-encoding.ts) keeps the texts
  of a new compile from its size check until its response. As its last
  step, `bundleRecipe` stores its request-local map with
  `prepareRecipeEncoding`, in a `WeakMap` keyed by the result object. When
  the check drops complete evidence, the recipe gets its fresh identity after
  the check, so `bundleRecipe` stores no texts. `encodeResponse` takes and
  removes the entry. `jsonText` then writes each saved text in place of its
  member object. A member object that code replaced after the check gets the
  normal encoding, and no text stays with a retained generation. The reuse
  branch of `Session` calls `bundleResult` with no map. Its check counts
  `JSON.stringify` texts, and its response gets the normal encoding.

### Resolution Evidence

- [`src/sidecar/serve-edit-imports.ts`](./serve-edit-imports.ts) holds
  `ServeEditImports`, which only a `serveEdit` compile creates. Its plugin
  clears `reusable` for an authored absolute specifier whose configuration it
  cannot read, or whose configuration has a `paths` key that matches it or
  contains `${configDir}`. It checks only specifiers that are written as
  absolute paths, so a bare alias with an absolute target goes to the next
  pass. While `reusable` stays set, its `record` calls `serveEditLookups` in
  [`src/sidecar/serve-edit-lookups.ts`](./serve-edit-lookups.ts). This
  coordinator walks the import edges once through `MetafileEdges.requests` in
  [`src/sidecar/metafile-edges.ts`](./metafile-edges.ts), which gives the
  effective request of each edge and flags its recorders, `ServeEditPaths` and
  `PackageFolderLookups`. Each recorder keeps its own inputs, limits, and
  staging: `accept` stages one request, and `finish` commits the checks. A
  request for both goes to `ServeEditPaths` first. From the first folder
  request that can depend on a configuration scope, such as a `#` request,
  the folder pass waits until `ServeEditPaths.finish` succeeds. A failure of
  either recorder withholds the marker. `moduleGraph` in
  [`src/sidecar/bundle-graph.ts`](./bundle-graph.ts) also uses `MetafileEdges`,
  which maps a `mokly-css:` edge to its physical stylesheet and follows a
  style wrapper to its first import, the wrapped module. Mokly's own
  authoring, JSX, and entry modules need no lookup. For each authored bare
  import with a readable configuration chain, `ServeEditPaths` in
  [`src/sidecar/serve-edit-paths.ts`](./serve-edit-paths.ts) stages the
  folders and the `package.json` candidates of the targets that esbuild tried
  before its selection. Its `finish` adds them to `lookupDirectories` and
  `lookupFiles`, which `resolutionInputs` turns into live inputs. In
  [`src/sidecar/mapped-paths.ts`](./mapped-paths.ts), `mappedCandidates` gives
  the mapped targets, then the `baseUrl` candidate of a bare request. For an
  alias with an absolute target, it gives the written path after a matched
  target instead, with no `baseUrl` step. `mappedPaths` in the same file gives
  the targets of the selected key in order. `mappedSelection` in
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
  `accept` return false. `ServeEditPaths.cachedScope` lends each valid
  configuration scope that it read to the folder pass with no new read.
- [`src/sidecar/resolution-plan.ts`](./resolution-plan.ts) holds
  `PlanBuilder`, which interns importer and target paths in one table, and
  `PlanLookup`, which indexes imports by importer position, specifier, and
  import kind. Planned resolution reads each target through the same table.
- [`src/sidecar/plan-candidates.ts`](./plan-candidates.ts) holds
  `PlanCandidates`, the bounded collector of plan-only candidate names for
  esbuild 0.28.2. It consumes the requests, paths, canonical mappings, and
  metadata bytes of the existing evidence capture. It adds no physical read.
  Matching absolute `paths` mappings and other unproved forms keep whole
  comparisons. Collector overflow keeps the plan without candidate names.
  [`src/sidecar/plan-candidate-names.ts`](./plan-candidate-names.ts)
  defines fixed-name charges, the name block test, and the upper bound on
  name charges.
  [`src/sidecar/plan-candidate-directories.ts`](./plan-candidate-directories.ts)
  merges lexical names into recorded canonical directories and adds their
  table positions. It skips each canonical directory that the evidence does
  not list as a directory. It adds new table rows only after every charge
  succeeds, so a failed charge keeps the original plan. Captured non-ASCII
  members and folded-name collisions keep whole comparisons. A selected native
  target absent from the merged names keeps its directory's whole comparison.
  [`src/sidecar/plan-candidate-metadata.ts`](./plan-candidate-metadata.ts)
  derives main-target names and checks export forms from already-read
  manifests. It reads them with `parsePackageJson`, so each repeated main
  field and `exports` value counts, in order. `bundleRecipe` attaches the
  names before the combined byte check.
  When the plan with names does not fit, it removes the names and their added
  table rows, and it checks the plan again.
- [`src/sidecar/captured-plan.ts`](./captured-plan.ts) holds
  `capturedPlan`, which gives the result of a `full` compile its native plan
  only with complete, durable, and unmarked evidence. The plan and the
  evidence must fit 8 MiB together. It counts their JSON bytes without
  building an oversized string.
- [`src/sidecar/compiled.ts`](./compiled.ts) holds `reuse`, which
  accepts an earlier compilation only while its settings, dependency roots,
  toolchain, input digests, and directory lists still match. For a request
  with stories files, `previewsCurrent` must also find the recorded
  `storybookPreviews` unchanged. It tries the captured compilations first, and
  also checks their reuse evidence. Then a `serveEdit` request tries the
  marked compilations with these live checks, their private folder files, and
  their preview link targets. A `full` request never takes a marked
  compilation. `reuse` reads first the input that failed the last check of the
  process, then the inputs whose digests differ from another held generation of
  equal settings. The checks stop at the first difference, so this order changes
  no result. `reuse` gives the generation whose compilation passed these
  checks to its optional `selected` callback. `restore` installs a recipe
  without a compile. `bundleResult` builds the full result of a generation and
  runs the size check on it.
- [`src/sidecar/toolchain.ts`](./toolchain.ts) holds
  `toolchainIdentity`, which each sidecar process computes once from the
  package root, the Mokly, esbuild, and Node versions, and every `dist/` file.
  [`vite-toolchain.ts`](./vite-toolchain.ts) adds the Vite version and real
  package path to Vite compile and reuse checks.
- [`src/sidecar/resolution-evidence.ts`](./resolution-evidence.ts)
  holds `ResolutionEvidence`, the esbuild plugin that records the candidate
  directories, manifests, and configurations of each import before esbuild
  resolves it. A form that it cannot map makes the evidence incomplete. Its
  `paths` step records every target of each matching key from `mappedPaths`,
  also for an absolute import. Its package step records the main-field and
  package-map targets of the own, PnP, installed, linked, and configured
  packages through the shared package-map description below. Each folder
  target of an `exports` map also marks candidate narrowing unproved, and an
  exact key keeps its priority over a folder key. With a PnP data file, its
  `finish` lets `PnpInputs` check each native bare selection.
  [`src/sidecar/resolution-request.ts`](./resolution-request.ts)
  applies written plugin names and aliases before built-in filtering.
  [`src/sidecar/config-inputs.ts`](./config-inputs.ts) records
  each `tsconfig.json` or `jsconfig.json` and its `extends` chain.
  `ConfigChain` resolves relative `extends` from the canonical folder of
  the configuration that declares it. That folder is also the base for
  `baseUrl` and for `paths` targets without a `baseUrl`. `ConfigInputs`
  expands a
  `${configDir}` prefix from the folder of the top-level configuration, as
  found. [`src/sidecar/config-json.ts`](./config-json.ts) parses JSON
  with comments and trailing commas.
- [`src/sidecar/module-paths.ts`](./module-paths.ts) holds `ModulePaths`,
  which maps resolved paths to the selected source tree. Its `resolve` and
  `resolveSync` add the `moduleResolution.sourcePackages` hint when lookup
  by package name reaches a missing target below a subfolder of the package
  root. An entry of `false` suppresses the hint when lookup reaches it.
  [`src/sidecar/module-path-errors.ts`](./module-path-errors.ts) builds that
  failure. A Vite call passes `mappedTargetHint`, so its hint takes the
  package from the mapped build target. `resolveSync` serves the requires
  that Node loads.
  `ConfiguredModuleFiles` in
  [`src/sidecar/module-configured-files.ts`](./module-configured-files.ts)
  holds the configured entry, stories, renderer, and PostCSS files and each
  added preview file. Its `has` matches the queried path directly or compares
  its real path with the configured files' real paths on the render side.
  `ModulePaths` skips the workspace package source rule for these files, so
  they keep their exact paths.
  [`src/sidecar/workspace-sources.ts`](./workspace-sources.ts) holds
  `WorkspaceSources`, which finds the source file of a workspace build target
  under the
  [workspace package source rule](../../../../docs/protocol/mokly-comparison-packages.md#workspace-package-sources).
  It takes the `sourcePackages` maps of the request in layout order. It tries
  the entry of each map for the package `name`, and then the detected layout,
  for which it uses `ConfigChain` to read `rootDir` and `outDir`.
  [`src/sidecar/workspace-lookups.ts`](./workspace-lookups.ts) holds
  `WorkspaceLookups`, which records the candidate files and directories that
  can change that choice. It records each `package.json` probe that
  `WorkspaceSources` uses to find the package root, including misses. Its
  `buildTarget` records the build target of each entry that `WorkspaceSources`
  tries. `marked` keeps the captured kind of each entry. Presence checks keep
  paths. Manifests, layout files, and workspace files loaded by the restored
  Node require through resolved peers keep digests. Recorded workspace builds
  also keep digests when the emitted bundle leaves a `require` target unresolved,
  uses the free `require` outside a direct call, imports the Node `module`
  builtin, or references `getBuiltinModule`.

### Package Folder and PnP Evidence

- [`src/sidecar/package-map.ts`](./package-map.ts) is the one package-map
  description that the full capture and the marked checks share.
  `packageMapTargets` gives the targets of the matching `exports` or `imports`
  keys, conditions, and arrays. It marks the folder-map targets and the key
  that esbuild selects, and its walk stops at a depth bound of 32 nested
  levels. `packageTarget` decodes a package-relative target as esbuild does,
  and `packageFolderCandidates` adds the main-field targets of a mapped
  folder. [`src/sidecar/package-json.ts`](./package-json.ts) holds
  `parsePackageJson`, which validates a manifest and returns a `PackageJson`.
  It keeps the order and every repeated key of the fields that resolution
  reads, because esbuild uses the first repeated key. Its lazy
  `folderExportsPossible` tells conservatively whether the `exports` of a
  manifest can hold a folder key, by the shared `packageFolderKey` test.
  `PhysicalInputs.packageJson` parses each manifest of the package walkers
  with it. In [`src/sidecar/package-lookup.ts`](./package-lookup.ts),
  `nearestPackage` finds the own package, and `packageDirectories` gives the
  installed, linked, and configured package roots lazily, in their order.
  [`src/sidecar/package-folders.ts`](./package-folders.ts) holds
  `PackageFolders`, which takes the shared `PnpLocations` and a
  `ConfigInputs`. After a compile, its `lookup` places a native selection. It
  first tries the configured candidates of `mappedCandidates`, with a lent
  scope when one exists, and a candidate that `mappedSelection` proves needs
  no folder checks. Otherwise it tries a `PackageFolderLocation` for each PnP
  root, the own package with `exports`, and each installed, linked, or
  configured root. A reachable PnP root counts when it places or contains the
  selected module, another root only when it places it, and an unplaced root
  only serves as a fallback. For a matching folder root that is not
  reachable, it sets `registry`, so the caller keeps the PnP state file. A
  selection that no root accounts for still counts as placed when a
  configured candidate contains it or the configuration chain cannot be
  followed. Otherwise, with a PnP state file, the lookup throws, so each
  caller fails closed. In its read-only mode, it adds no package or link
  observation. An ordinary bare scan can reuse a negative directory fact, but
  it reads again before unseen metadata and before a possible folder map.
  [`src/sidecar/package-folder-maps.ts`](./package-folder-maps.ts) holds
  `PackageFolderMaps`, whose `describe` walks the map targets of one root
  without choosing native conditions or owners, and `mergeFolderSelections`,
  which joins the results. For an ordinary `exports` map without a possible
  folder key, it tests every literal placement before any physical probe. An
  `imports` walk, and a forced walk after an `imports` folder mapping, set
  `requireComplete`, so the depth bound makes each caller fail closed.
  [`src/sidecar/package-folder-location.ts`](./package-folder-location.ts)
  holds `PackageFolderLocation`. It keeps the written package folder and
  manifest, which set the base of each map target, apart from the canonical
  folder and manifest identity, which the observations and the `full` audit
  use. Its `matches` also compares the physical files of a folder candidate,
  so a linked index file still places the selection. Ordinary mapped
  selections keep `mappedSelection` alone. Its `describe` gives its one
  `FolderCandidates` from
  [`src/sidecar/folder-candidates.ts`](./folder-candidates.ts). For the folder
  recorder, that list reserves the eventual table rows of each candidate at
  `folderRowBytes`, the marked table's staging charge, within the same
  `EVIDENCE_LIMIT`, and it releases every path at overflow. For the `full`
  audit, it keeps no path and reserves nothing. Its `present` flag tells
  whether a candidate exists. `collectFolderCandidates` adds the candidates
  of one mapped folder, and at overflow it throws for a placed or unknown
  selection, so each caller fails closed.
  [`src/sidecar/package-folder-lookups.ts`](./package-folder-lookups.ts) holds
  `PackageFolderLookups`. Its `accept` uses `PackageFolders`, with its own
  `PnpLocations` and the borrowed scopes, to find each import that a package
  folder mapping selects, and it stages the candidate folders and the written
  manifests. Its `PackageFolders` builds a non-strict `ConfigInputs` on the
  same `PhysicalInputs` budget, so an unreadable configuration chain adds no
  configured candidate, but a read failure makes the lookup incomplete.
  `accept` returns false for a known folder selection that stays unplaced,
  for candidates or staged paths past `EVIDENCE_LIMIT`, and for package
  metadata that it cannot read within the metadata bounds. Its `finish` also
  stages the PnP state files when a folder selection exists, or when
  `registry` reports a removed matching root. `markedFileEvidence` in
  [`src/sidecar/marked-file-evidence.ts`](./marked-file-evidence.ts) turns the
  folder files into the private evidence of the marked compilation: file,
  absent, and link entries beside the `uncaptured: "serveEdit"` marker.
  `finish` returns no evidence when the table passes `EVIDENCE_LIMIT`, holds
  another kind, or fails a fresh read. Otherwise it adds the candidate
  folders to the live lookup directories.
- [`src/sidecar/pnp-locations.ts`](./pnp-locations.ts) holds `PnpLocations`,
  the shared catalogue of PnP package roots. On first use, it reads the
  present PnP state file through `PhysicalInputs` and parses it with `pnpJson`
  into one `PnpIndex` for that pinned state. Its `roots(name, directory)`
  gives the physical root candidates of a package name and its alias
  identifiers, each with a reachable flag. When the importer mapping can move
  the start of a second resolve, every root counts as reachable.
  [`src/sidecar/pnp-index.ts`](./pnp-index.ts) holds `PnpIndex`, which indexes
  the pinned registry once. Its `roots` walks the ancestors of the start
  folder and copies no PnP locator, fallback, or ignore rule.
  [`src/sidecar/pnp-inputs.ts`](./pnp-inputs.ts) holds `PnpInputs`, the PnP
  capture and audit owner of a `full` compile. Its `capture` records the
  folder maps of each reachable root after a fresh read confirms the pinned
  state file and manifest. For a matching folder root that is not reachable,
  `discover` observes only the state-file chain. `covered(pkg)` records the
  canonical manifest of a covered root. Its `finish` checks each native bare
  selection through a read-only `PackageFolders` that borrows the
  `ConfigInputs` of `ResolutionEvidence`. It makes the evidence incomplete for
  an uncovered folder map, a native selection that nothing accounts for, a
  metadata bound, or another lookup error.
  [`src/sidecar/pnp-json.ts`](./pnp-json.ts) reads `.pnp.data.json` and the
  state that `.pnp.cjs` or `.pnp.js` embeds, without running their code.
  `pnpFiles` in [`src/sidecar/pnp-files.ts`](./pnp-files.ts) gives the PnP
  state files that native discovery checks, up to the first present one.

### Reading and Verifying Evidence

- [`src/sidecar/physical-inputs.ts`](./physical-inputs.ts) holds
  `PhysicalInputs`, the one owner of the evidence reads. It reads each
  metadata file within 1 MiB and queues each unique resolution request once.
  `MetadataInputs` in [`src/sidecar/metadata-inputs.ts`](./metadata-inputs.ts)
  parses its configurations and package manifests from the same snapshots,
  within its one read budget, and caches each strict and tolerant parse by its
  file entry. Each queued capture uses synchronous filesystem reads before
  esbuild resolves the import. Its retained
  observations, metadata read bytes, visited paths, and request keys each stay
  within 8 MiB. Each charged visited path keeps its first-touch kind. Later
  presence and kind probes of the same capture use that kind, but metadata
  content and link targets are still read. `PhysicalPathInputs` in
  [`src/sidecar/physical-path-inputs.ts`](./physical-path-inputs.ts) gives it
  the path facts, on the same visited-path allowance. Its `canonicalFile` and
  `canonicalDirectory` have a bounded mode that observes nothing, and an
  inspected path keeps at most one negative directory fact. The protected
  filesystem operations of the same owner are in
  [`src/sidecar/physical-input-reader.ts`](./physical-input-reader.ts),
  which uses bounded reads and `realpathSync.native` for canonical paths. Its
  `currentEvidence` reads the evidence again for a reuse check, through a new
  `PhysicalInputReader` with no capture cache and no saved kind. Its
  `pathKinds` map holds the first-touch kinds, of the `CaptureKind` type in
  [`src/sidecar/capture-kind.ts`](./capture-kind.ts).
  [`src/sidecar/file-digests.ts`](./file-digests.ts) hashes 64 KiB chunks.
  Four workers overlap first reads. Other reads are synchronous, with yields.
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

### Vite Compilation and Replay

- [`vite-compiler.ts`](./vite-compiler.ts) compiles `vite` requests into a
  `ViteRecipe` with incomplete reuse evidence that holds only the link targets
  of the preview probe. It runs the `@storybook/react` framework fallback
  only after `ViteContext` admits the setup, so a request that needs a fresh
  worker stops before it loads `main.*`.
  [`vite-context.ts`](./vite-context.ts) defines `ViteContext`, which keeps one
  Vite server for the JavaScript and stylesheet requests of a side. Its setup
  key takes only the bundle params that `open` classifies as setup inputs, so
  a change to the entry files, the stories files, or their Storybook folders
  keeps the server. The classification names every `BundleParams` field, so
  the type check fails until a new field is classified. It sends
  `fresh-worker-required` when a setup reload needs empty Node module caches.
  A stylesheet dependency edit can replace the server in the same process.
  Before replacement, the old server receives the detected file changes.
  [`vite-setup.ts`](./vite-setup.ts) loads `vite.config.*` and starts Vite without
  HTTP, file watching, hot reload, or dependency pre-bundling.
  [`vite-setup-snapshot.ts`](./vite-setup-snapshot.ts) checks setup observations
  and derives the setup identity from logical names and digests.
  [`vite-setup-input.ts`](./vite-setup-input.ts) digests a candidate, present or absent.
  [`vite-postcss-lookup.ts`](./vite-postcss-lookup.ts) tracks the candidates of
  Vite's PostCSS config lookup inside the side's roots.
  [`vite-working-env.ts`](./vite-working-env.ts) serves one dotenv byte snapshot
  per candidate during setup. [`vite-base-env.ts`](./vite-base-env.ts) selects
  its historical or working file and resolves committed links.
- [`vite-config.ts`](./vite-config.ts) loads the app's config in memory on both
  sides with Vite's default loader semantics. A function export receives `serve`
  and `development`. [`vite-config-bundle.ts`](./vite-config-bundle.ts) uses
  esbuild for the config and local imports without writing a file. It runs the
  result as ESM or CommonJS by config type. Installed packages stay external and
  resolve through `ViteLookup`. [`vite-config-resolution.ts`](./vite-config-resolution.ts)
  routes native config imports through that lookup. Its resolve hook records
  each local file that Node resolves during setup, with the digest of the file
  bytes at that moment. It adds no `load` hook, because a process-wide `load`
  hook breaks some CommonJS imports on Node 22.
  [`vite-config-source.ts`](./vite-config-source.ts) records the bytes of each
  bundled file and sets each script's values for `__dirname`, `__filename`, and
  `import.meta`.
  [`vite-config-context.ts`](./vite-config-context.ts) resolves dynamic `require`
  and `import()` from their own module and binds `import.meta.resolve` to that
  module's URL. [`vite-config-errors.ts`](./vite-config-errors.ts)
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
  The lookup itself loads no `main.*`, so the reuse probe and the stylesheet
  transform run no framework fallback.
  [`vite-node-peers.ts`](./vite-node-peers.ts) scopes Node's resolve hook to each
  request so dependencies of a Vite generation load one React runtime.
  It keeps the peer paths of evaluated generations. It also keeps the digests
  and directory membership of recorded inputs that the repository ownership rule
  treats as unowned. A conflict returns `fresh-worker-required` before evaluation.
  [`vite-react-peers.ts`](./vite-react-peers.ts) builds that table after setup
  using the setup's aliases. Mokly's first resolver claims React imports and
  uses the table to serve them and the JSX development shim.
- [`vite-external.ts`](./vite-external.ts) uses `ViteLookup` to choose the package
  file Node loads, also for setup aliases. It uses the extension or nearest
  manifest `type` to choose ESM or CommonJS. [`vite-styles.ts`](./vite-styles.ts)
  wraps `styled-components`, `react-native-web`, and `@emotion/react` from the
  copy that resolves. It checks the external resolver first and keeps the
  [CommonJS default import rules](../../../../docs/protocol/mokly-sidecar-modules.md#authoring-and-evaluation).
- [`vite-graph.ts`](./vite-graph.ts) records every fetch from the virtual entry
  before evaluation and builds the module graph. [`vite-fetch.ts`](./vite-fetch.ts)
  confines files and records their bytes and imports at the fetch boundary.
  [`vite-plugin.ts`](./vite-plugin.ts) resolves every import in its first
  ordered hook, before aliases and setup hooks. It resolves protected imports
  itself, and sends each other import through `ViteLookup`, which runs the
  setup's hooks, confines the selected file, and applies the workspace source
  step with the import name.
  [`vite-resolve-dispatch.ts`](./vite-resolve-dispatch.ts) runs that lookup
  with the active hook's `this.resolve` and its request options, or with
  Vite's own skip history when no hook is active. It also serves the virtual modules and
  stylesheet stubs.
- [`vite-plugin-inputs.ts`](./vite-plugin-inputs.ts) captures `this.load` and
  `this.addWatchFile` in the contexts of load, transform, and resolve hooks.
  Its own first plugin tracks the resolve calls, also those that `ViteLookup`
  delegates. Resolve reports belong to the original importer. It retains each module's reports and
  load edges while Vite reuses its transform. JavaScript fetches and inline
  stylesheet transforms collect reports from the module and its nested loads.
  They keep reports for files that the module also imports. Reports outside
  the selected roots or for existing non-file paths emit a diagnostic.
- [`vite-inputs.ts`](./vite-inputs.ts) records consumed bytes, rejects inconsistent
  reads, and verifies the files again after compilation. [`vite-metadata.ts`](./vite-metadata.ts)
  builds digests for setup files, plugin inputs, React manifests, the preview
  candidates of the compile's `PreviewProbe`, Storybook framework fallback
  inputs, package
  and TypeScript config candidates, and consumed files outside the graph.
  [`vite-invalidation.ts`](./vite-invalidation.ts) compares the last input snapshot
  with the disk. It invalidates virtual, changed, and unsnapshotted modules, or
  all modules when a directory list changes. [`vite-watch-events.ts`](./vite-watch-events.ts)
  passes each change to the setup's watcher listeners and to Vite's environment
  containers before transforms run again or the server is replaced in the
  same process.
- [`vite-evaluate.ts`](./vite-evaluate.ts) runs the generation once through Vite's
  module runner. A restored recipe uses its recorded fetches without reading
  current source files or running transforms. [`vite-urls.ts`](./vite-urls.ts)
  converts URLs, IDs, query variants, and virtual names to files and logical names.
  [`vite-errors.ts`](./vite-errors.ts) reports transform and resolve failures
  with the logical module, plugin, and, once loaded, the installed and tested
  Vite versions. For evaluation, it reports `bundle-failed` with the logical
  module that failed and the error text. A failure outside a module uses the
  label `Vite evaluation` and gives the installed version and tested range.
  The formatters rewrite absolute paths to logical names.
  `viteStylesheetFailure` uses the requested stylesheet path instead. When the
  failure has a line and a column in a file inside the side's source root, it
  names that file with the line and the column. A location in a virtual module
  or outside the source root gives only the requested stylesheet path.

### Vite Stylesheets

- `ViteCompiler.stylesheet` in [`vite-compiler.ts`](./vite-compiler.ts) answers
  `transformViteCss`. It first checks the requested path with Vite's own
  `isCSSRequest`. A path that Vite does not read as a stylesheet, such as
  `Action.CSS`, fails with "Vite reads only a lowercase stylesheet suffix". It
  requests one stylesheet through the setup as an inline module.
  [`vite-css-transform.ts`](./vite-css-transform.ts) defines
  `ViteCssTransform`, whose `run` method runs that request. It returns the CSS,
  the class map of a CSS Module, and the digests of the inputs of the
  transform. The retained server uses the source digest to report edits to a
  stylesheet even when the catalogue has no JavaScript. The `importedBy` field
  maps each stylesheet input with no plugin report to the logical path of its
  direct importer.
- [`vite-css-hooks.ts`](./vite-css-hooks.ts) holds the hooks that `viteSetup`
  installs. They set Mokly's scoped names on both CSS transformers. They route
  Vite's stylesheet resolver through `resolveViteStylesheet` of
  [`vite-stylesheet-lookup.ts`](./vite-stylesheet-lookup.ts) during a
  transform. It resolves the authored import with Vite's resolver, and again
  without the relative preference. When the two files differ, it keeps the
  relative file. Only a package import gets the workspace source step.
  For each file that this resolver resolves, they record the direct importer.
  They wrap `vite:css` and `vite:css-post`, so one native transform gives the
  class map and the inline CSS. A late `@import` that Vite drops is a failure.
- [`vite-css-paths.ts`](./vite-css-paths.ts) decides which files are Vite
  stylesheets and CSS Modules. Its `ViteCssUrls` keeps each authored relative
  `url()` and rebases the URL of an inlined file onto the requested stylesheet.

### Shared Rendering and Styles

- [`virtual-modules.ts`](./virtual-modules.ts) builds the authoring facade, the
  JSX development shim, and CSS Modules stubs for both compilers. It limits the
  reserved runtime imports to Mokly's own virtual modules.
- [`src/sidecar/styles.ts`](./styles.ts) holds `collectStyles`, which
  collects the styles of one render. It filters the React Native Web registry
  text with the `RegistryIndex` of the generation, from
  [`src/sidecar/registry-index.ts`](./registry-index.ts). `registryIndexOf`
  keeps one index for each generation object under a weak key. The index ends
  with its generation at `dispose`, at `shutdown`, or when a `bundle` result
  replaces the generation. The index of a generation holds at most
  `REGISTRY_TEXT_LIMIT` registry texts, which is 1, and `REGISTRY_OUTPUT_LIMIT`
  filtered outputs for each text, which is 64. At a limit, the least recently
  used entry leaves first. So the memory of an index is a function of its one
  text. The index holds the text, the parsed tree and the analysis of the
  text, and at most 64 outputs. Each output is at most the size of the text.
  The key of an output takes a few characters for each rule that the output
  keeps. A measurement on 2026-11-23 used the 12,821-character registry text
  of the mokly-cloud catalogue. It counted each output as one flat string, as
  the sidecar holds it after it encodes the response. With that text and one
  output, one index retains about 0.33 MB. A strict build of that catalogue
  filtered 1,557 distinct fragments with that text. They gave only 2 distinct
  outputs, and with them the index retains about the same, 0.31 MB. With 64
  outputs that each hold almost the whole text, it retains about 1.2 MB. For a
  text that the index cannot analyse, such as a text that does not parse, the
  index calls `registryStyles` in
  [`src/sidecar/registry-styles.ts`](./registry-styles.ts), the filter without
  an index, which gives its own output or error. The index gives the same
  bytes as `registryStyles`.
- [`src/sidecar/postcss.ts`](./postcss.ts) holds `PostcssWorkers`,
  which owns the PostCSS child processes. Its `prepare` starts the child of a
  [prepared context](../../../../docs/protocol/mokly-sidecar-postcss.md#prepared-contexts)
  with the roots and resolution settings of the `prepareContext` request. That
  child processes no stylesheet before the first `process` call
  of its context, and that call takes the child, also after the child failed.
  `dispose` also stops a start whose path lookup still runs, so that start
  forks no child.
- [`src/sidecar/postcss-module.ts`](./postcss-module.ts) holds
  `importPostcssModule`, which bundles the PostCSS module or a plugin module of
  the repository with esbuild. [`src/sidecar/postcss-worker.ts`](./postcss-worker.ts)
  marks dependencies reached by a bundle, loaded by Node, or reported as
  an exact file by a plugin. The core uses these marks for the
  [`ignored-module` warning](../../../../docs/protocol/mokly-comparison-packages.md#ignored-modules).
- [`src/generated/sidecar`](../generated/sidecar) holds the request and
  result types that `cargo xtask generate-types` writes from the Rust types.
  `BundleReply`, the reply of `bundle`, is the full `BundleResult` or the short
  `RestoredBundle`.

## Related Docs

- [Sidecar module sources](../../../../docs/protocol/mokly-sidecar-modules.md)
- [Compiled recipes and release](../../../../docs/protocol/mokly-sidecar-recipes.md)
- [Vite adapter](../../../../docs/protocol/mokly-vite-adapter.md)
- [PostCSS contract](../../../../docs/protocol/mokly-imported-styles-postcss.md)
- [Package key code](../../README.md#key-code)
- The [Rust sidecar pool](../../../../crates/mokly-sidecar/README.md) starts and
  stops the sidecar processes.
