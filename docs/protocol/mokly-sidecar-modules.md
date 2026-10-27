# Sidecar Module Sources

Status: In progress under the [per-entry render keys plan](../../plans/per-entry-render-keys.md).

This page expands the [sidecar bundling contract](./mokly-sidecar.md#bundling).
The source root and dependency roots identify one comparison side. All roots
are resolved to real filesystem paths before identity and confinement checks.

## Source Root Workers

Each process keeps one source working directory for its whole lifetime,
including delayed callbacks. The working directory and `PWD` name the
canonical source directory. Sidecars and PostCSS children omit `INIT_CWD`,
`npm_package_json`, and `npm_config_local_prefix`. Other environment values
are inherited.

A process serves one source root. A request for another root replaces the
process before replay, and a debug event records the slot and both roots. All
roots share the configured pool bound, so a one-worker pool replaces its
process when the source root changes. All requests of one live PostCSS context
reach the same process.

## Source And Dependency Files

A selected dependency root is the `node_modules` directory of a configured
package root, or a `node_modules` directory named directly by the request.
A resolved real file inside it is a dependency, even when the directory also
lies inside the source root. JavaScript and CSS imports use this same rule.
The first dependency root uses the logical prefix `node_modules/`. Additional
roots use `node_modules/.mokly-roots/{index}/`, with their zero-based position
in the selected root list, followed by the path relative to that root.
Logical names use POSIX separators and contain no absolute or parent path.
`node_modules/.mokly-roots/` is reserved for Mokly logical names and
installation metadata. Source and installed package paths must not use it.
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
These records never enter source inventory. A restored or reused compilation
reports the same records.

Source-side tsconfig paths take precedence over package lookup. A mapped bare
package resolves inside its selected package scope, with the same conditions,
main fields, and extension settings. This prevents working tsconfig paths from
changing historical imports. Workspace metadata links map to the base source
tree. PostCSS static, dynamic, record-form, and synchronous requires use the
same importer mapping. Installation metadata outside the source root is read
from the selected installation, even when a tracked source directory has the
same logical name.

## Authoring And Evaluation

Bundle parsing ignores each module's package `type` and `tsconfig.json` parse
settings. A source `@jsxImportSource` pragma can select that module's JSX import
source; a tsconfig `jsxImportSource` setting does not. Use the source pragma
when a JSX library requires its own runtime. This parsing policy does not
disable the source-side tsconfig path resolution described above.

Repository-owned imports of `@mokly/mokly` receive the attributed authoring
facade. Installed dependencies receive the unattributed API. Their JSX
wrapper call sites omit optional catalogue source metadata. The virtual
entry, authoring facade, and JSX shim do not appear as catalogue modules.
The [JSX development shim](./mokly-sidecar.md#bundling) attaches invocation
metadata under the
[instance rules](./mokly-instances.md#optional-invocation-source). Invocation
source file names resolve from the configuration directory before conversion
to repository-relative invocation paths.

The core scopes each `*.module.css` stylesheet after PostCSS and supplies all
class maps with `cssModules` before `describe` evaluates the bundle.
`cssModules` installs the maps without bundling or reading source files. A
root import and a subpath import of a style library use the same package copy
of its style registry. Wrappers keep the importer's CommonJS default-import interop:
Node's rule for `.mjs` and `.mts` importers, the `__esModule` default otherwise.
The rule matches unwrapped imports in the same Mokly bundle.
A wrapper diagnostic names the importer's logical source path as its location
and the wrapped file's logical name when it describes that module's exports.
Peers resolve from the configuration directory. Virtual modules do not enter the source inventory. CSS Modules
in dependencies use the same logical dependency names as their graph records.
The sidecar fails closed when a map is absent. Installing maps after
evaluation is a protocol failure. A changed map uses a new evaluation digest
and retains the old generation until its final graph or request releases it.
An evaluation-only change reuses compiled code without another compilation.
Replays never compile the current filesystem for an old generation.

The bundle keeps the authored name of every function and class, also when
two modules declare the same top-level name. A function's `name` and its
stack frame names show the authored name. Decision: names stay authored, so
a module outside a definition's imports cannot change its render. A guide
note alone was rejected, because a cached render could then stay stale.

The sidecar performs no file writes. A resolution diagnostic names the logical module and the
authored importer location. It does not expose another checkout, a dependency
cache, or the bundler's implementation path.

## Compiled Recipes And Release

The private `bundle` result carries `compiled`: code, runtime import key,
captured entry text, resolved peers, physical input digests,
logical metadata digests, and the compilation identity. `restoreGeneration`
installs that recipe with its original parameters, module graph, and evaluated generation id. The bundle result carries the graph once.
It reads no current source file and invokes no compiler. Peer packages retain
the selected physical installation. Failed peer resolutions remain explicit and
raise `MODULE_NOT_FOUND`; native fallback cannot bypass that failure. Equal
compilations keep independent maps, bindings, and authoring registrations.
A `restoreGeneration` envelope above the
[frame limit](./mokly-sidecar.md) fails with `bundle-failed` before the sidecar
installs anything.

A compilation is reused only while its inputs stay unchanged. These inputs
include the ancestor `package.json` and `tsconfig.json` candidates of each
consumed module up to its source or selected dependency root, the resolved
`react/package.json`, and the Storybook preview candidates, each including
absent files. Added or removed files in a consumed-module directory invalidate
reuse, so a higher-priority module cannot remain hidden. Manual `r` uses these
same input checks. Resolution metadata and directory membership remain
observable. CSS bytes belong to stylesheet processing rather than the
JavaScript compilation.

Each `bundle` call starts an unevaluated lifetime, also when the content id
matches an earlier evaluated lifetime. The core installs its maps,
description, and bindings before rendering. Releasing a generation or a
PostCSS context reaches every process that used it and starts no sidecar.

A worker emits an `operation` event for each catalogue `esbuild` call and each
PostCSS worker start or stop. The payload contains the operation and sidecar
PID. The core uses these events for exact counts, including failed calls.
They carry no source, CSS, props, or file paths.
