# Sidecar Module Sources

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

This page expands the [sidecar bundling contract](./mokly-sidecar.md#bundling).
The source root and dependency roots identify one comparison side. All roots
are resolved to real filesystem paths before identity and confinement checks.

## Source Root Workers

Each process keeps one source working directory for its whole lifetime,
including delayed callbacks. Its `PWD` names that directory. Sidecars and
PostCSS children omit `INIT_CWD` and `npm_package_json`. Other environment
values are inherited.

A live PostCSS context keeps its affine slot. Independent eligible work uses
an idle worker with the same source root, then an unspawned slot within the
pool bound, then the oldest idle slot. A root change kills the old process
before replay and removes that slot's affinities for the old root. A debug
event records the slot and both roots. A recycled slot keeps only affinities
for the root of its replacement. All roots share the configured pool bound;
a one-worker pool replaces its process when the source root changes.

## Source And Dependency Files

A selected dependency root is the `node_modules` directory of a configured
package root, or a `node_modules` directory named directly by the request.
A resolved real file inside it is a dependency, even when the directory also
lies inside the source root. JavaScript and CSS imports use this same rule.
The first dependency root uses the logical prefix `node_modules/`. Additional
roots use `node_modules/.mokly-roots/{index}/`, with their zero-based position
in the selected root list, followed by the path relative to that root.
Logical names use POSIX separators and contain no absolute or parent path.
The core applies the base-source precedence below before reading installation bytes.

Other files inside the source root use source-relative names. A source-relative
name that contains a `node_modules` segment is also a dependency. Dependency
files contribute to the module graph and stylesheet closure, but never to
catalogue entry discovery, source attribution, or the catalogue source
inventory. Git tracking does not change that dependency classification.
A tracked file in the base Git tree supplies its base bytes before an installed
copy, including with equal dependency inputs. A source copy beneath a selected
package-root directory uses that root's logical prefix on both sides.
The core supplies the installation repository as `moduleResolution.dependencyRoot`.
After source-side resolution, bare imports start at the matching importer
directory in that tree. Nested dependencies outside selected roots keep their
repository-relative names, including `node_modules`. JavaScript, CSS, and
PostCSS use the same source precedence.

A workspace or local `file:` package can resolve outside `node_modules`
through a package-manager link. When its real path lies inside a supplied
repository root, it uses the same relative path inside the side's source
root. The mapped file must be regular and its real path must stay inside
that source root. Missing files and escaping symlinks fail closed. npm and
pnpm links follow the same rule. A file outside source, repository mapping,
and selected dependencies fails closed for JavaScript and CSS alike.

The graph lists each module's imports in record order from the bundler's
metafile. That order includes re-exports and dynamic imports. Stylesheets
use their resolved logical names. The binary watches source files, hashes
dependency inputs, and reads stylesheet order from these edges under the
[imported stylesheet contract](./mokly-imported-styles.md#roots-collection-and-deduplication).

`bundle` and `processCss` results can include `unmappedDependencyDirectories`:
used repository-relative `node_modules` directories outside the configured
root lookup. Missing data means an empty list. Observation retains lexical
package-directory links as well as canonical module paths, including pnpm
stores and outside-configuration importers. The core maps repository-relative
lookup through `dependencyRoot` and checks used directories in tier two.
Only a directory that cannot map produces the
[lookup fallback warning](./mokly-base-preparation.md#installation-and-bundle-settings).
These records never enter source inventory. Compiled recipes retain the records
through worker restoration and evaluation reuse.

Source-side tsconfig paths take precedence over package lookup. A mapped bare
package resolves inside its selected package scope, with the same conditions,
main fields, and extension settings. This prevents working tsconfig paths from
changing historical imports. Package lookup uses manifest hashes and directory membership, including absent
candidates. CSS text stays outside the JavaScript recipe. Workspace metadata
links map to the base source tree. PostCSS static,
dynamic, record-form, and synchronous requires use the same importer mapping.

Installation lookup metadata outside the source root uses the private prefix
`node_modules/.mokly-roots/installed/` followed by its logical dependency name.
These keys identify actual installation files and directory membership, even
when a tracked source directory has the same logical name. The core reads
these inputs from the selected installation without a source override.
They are compiler-input keys, not module or stylesheet names.

## Authoring And Evaluation

Repository-owned imports of `@mokly/mokly` receive the attributed authoring
facade. Installed dependencies receive the unattributed API. Their JSX
wrapper call sites omit optional catalogue source metadata. The virtual
entry, authoring facade, and JSX shim do not appear as catalogue modules.
The JSX development shim forwards to the consumer's `react/jsx-runtime` and
attaches invocation metadata only to `defineComponent` wrappers under the
[instance rules](./mokly-instances.md#optional-invocation-source).
Its source file names resolve from the compiler's configuration directory
before conversion to repository-relative invocation paths.

A `*.module.css` import compiles to a stub that reads its class map from the
generation table at evaluation. The core scopes the stylesheet after PostCSS
and supplies all maps with `cssModules` before `describe` evaluates the bundle.
`cssModules` installs the table without bundling or reading source files.
One esbuild invocation builds each distinct compilation, including runtime
style adapters. A root import supplies its own registry. A subpath import resolves
the registry from the directory of its resolved file, so both use the same
package copy. Wrappers keep the importer's CommonJS default-import interop:
Node's rule for `.mjs` and `.mts` importers, the `__esModule` default otherwise.
The rule matches unwrapped imports in the same Mokly bundle.
A wrapper diagnostic names the importer's logical source path as its location
and the wrapped file's logical name when it describes that module's exports.
Peer resolution uses that compiler's resolver from the configuration
directory. Virtual modules do not enter the source inventory. CSS Modules
in dependencies use the same logical dependency names as their graph records.
The sidecar fails closed when a map is absent. Installing maps after
evaluation is a protocol failure. A changed map uses a new evaluation digest
and retains the old generation until its final graph or request releases it.
An evaluation-only change reuses compiled code without another esbuild run.

The generation key includes the real source root and real selected dependency
roots. A base and a head never share per-generation maps or bindings merely
because their source bytes are equal. The pool's internal epoch separates
successive loaded lifetimes of the same generation id. A stale worker disposes
its copy and restores captured code, maps, describe, and bindings before more
work. Replays never compile the current filesystem for an old generation.
The fragment key also includes the class-map table digest and effective
binding and entry fingerprints.

esbuild supplies the in-memory virtual entry, the shared consumer React
runtime, the authoring facade, and the module inventory. The sidecar performs
no file writes. A resolution diagnostic names the logical module and the
authored importer location. It does not expose another checkout, a dependency
cache, or the bundler's implementation path.

## Compiled Recipes And Release

The private `bundle` result carries `compiled`: code, runtime import key,
captured entry text, resolved peers, physical input digests,
logical metadata digests, and the compilation identity. `restoreGeneration`
installs that recipe with its original parameters, module graph, and evaluated generation id. The bundle result carries the graph once.
It reads no current source file and invokes no compiler. Peer packages retain
the selected physical installation. Failed peer resolutions remain explicit and
raise `MODULE_NOT_FOUND`; native fallback cannot bypass that failure. Equal compilations share retained code
while their maps, bindings, and authoring registrations remain independent.

Before an evaluation-only bundle, the pool restores a compatible live compilation
on the selected slot, including after recycling. Independent slots therefore
reuse the same compilation without another esbuild call.

The reuse stamp includes ancestor `package.json` and `tsconfig.json` candidates
from each consumed module up to its source or selected dependency root, including
absent files. Added or removed files in a consumed-module directory invalidate
reuse, so a higher-priority module cannot remain hidden. Manual `r` uses these
same input checks. Resolution metadata and directory membership remain observable.
The reuse stamp also includes the resolved `react/package.json` and Storybook
preview candidates, including absent candidates. Every digest-only source
read uses `SourceTree::digest`; a source snapshot retains its digest without
retaining file contents. CSS bytes belong to stylesheet processing rather
than the JavaScript compile stamp.

Each `bundle` call starts an unevaluated lifetime, also when the content id
matches an earlier evaluated lifetime. The pool clears that slot's replay
markers and installs its maps, description, and bindings before rendering.
Each bundle result receives an internal pool epoch. Final lease release
records that epoch without waiting for a sidecar request. A late old release
cannot retire another live epoch with the same id. Idle slots dispose retired
state on the release worker. Busy slots apply it before their next request.
No release starts a sidecar. PostCSS context release follows the same queue
and reaches every slot which used the context. Context affinity routes all
requests of one context to one slot. PostCSS cache cleanup is queued without
acquiring that cache's mutex in a graph destructor. Only used contexts queue
cleanup. Compiler construction and CSS processing drain those notices.

A worker emits an `operation` event for each catalogue `esbuild` call and each
PostCSS worker start or stop. The payload contains the operation and sidecar
PID. The core uses these events for exact counts, including failed calls.
They carry no source, CSS, props, or file paths.
