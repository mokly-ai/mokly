# Sidecar Module Sources

This page expands the [sidecar bundling contract](./mokly-sidecar.md#bundling).
The source root and dependency roots identify one comparison side. All roots
are resolved to real filesystem paths before identity and confinement checks.

## Source Root Workers

Each process keeps one source working directory for its whole lifetime,
including delayed callbacks. The working directory and `PWD` name the
canonical source directory.

Sidecars and PostCSS children omit every inherited variable whose name starts
with `MOKLY_`, and `INIT_CWD`, `npm_package_json`, and
`npm_config_local_prefix`. Mokly then sets its own names, such as
`MOKLY_POSTCSS_PHASES`. Windows matches the prefix without case. Other
environment values are inherited. The
[token exposure rule](./mokly-upload.md#token-exposure) states the result for
the publish token and the limit of this protection.

Decision: one removed prefix keeps every other variable. An allowed list as
for [base installs](./mokly-base-install-processes.md#environment)
was rejected, because consumer PostCSS settings and render code read other
variables.

A process serves one source root. A request for another root replaces the
process before replay, and a debug event records the slot and both roots. All
roots share the configured pool bound, so a one-worker pool replaces its
process when the source root changes. All requests of one live PostCSS context
reach the same process. The
[source root scheduling rules](./mokly-sidecar-root-scheduling.md) choose the
process that changes root.

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
A changed map uses a new evaluation digest and retains the old generation
until its final graph or request releases it.
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

Every private `bundle` result carries `compiled`: code, runtime import key,
captured entry text, resolved peers, physical input digests, logical metadata
digests, reuse evidence, the toolchain identity, and the compilation identity.
`restoreGeneration` installs that recipe with its original parameters, module
graph, and evaluated generation id. The bundle result carries the graph once. It
reads no current source file and invokes no compiler. Peer packages retain the
selected physical installation. Failed peer resolutions remain explicit and
raise `MODULE_NOT_FOUND`; native fallback cannot bypass that failure. Equal
compilations keep independent maps, bindings, and authoring registrations. A
`restoreGeneration` envelope above the [frame limit](./mokly-sidecar.md) fails
with `bundle-failed` before the sidecar installs anything.

A compilation is reused only while its inputs stay unchanged. These inputs
include the ancestor `package.json` and `tsconfig.json` candidates of each
consumed module up to its source or selected dependency root, the resolved
`react/package.json`, and the Storybook preview candidates, each including
absent files. Added or removed files in a consumed-module directory invalidate
reuse, so a higher-priority module cannot remain hidden. Manual `r` uses these
same input checks. Resolution metadata and directory membership remain
observable. CSS bytes belong to stylesheet processing rather than the
JavaScript compilation.

Reuse also requires an equal toolchain identity and unchanged reuse evidence.
The toolchain identity digests the Mokly, esbuild, and Node versions, every
file in the `dist/` directory of the Mokly package that runs the sidecar, and
the real root of that package. The reuse evidence records each file and
directory that can change how a bundled import or a peer resolves:

- the `jsconfig.json` candidate beside each `tsconfig.json` candidate, and
  each file that a tsconfig `extends` chain names;
- the package manifest of each resolved peer;
- each directory where the resolver can look for a candidate before it finds
  its result: relative paths with their extensions and index files, `paths`
  targets, `baseUrl`, each `node_modules` level, and each configured lookup
  root;
- the `package.json`, `tsconfig.json`, and `jsconfig.json` candidates above
  the source root, each up to the first present candidate or the filesystem
  root.

A recorded directory keeps every entry, the kind of each entry, and the real
target of each link. An absent file or directory is recorded as absent. A
candidate that cannot be read never matches a recorded absence. When the sidecar
cannot record the evidence of an import completely, the compilation is never
reused and never stored. When the binary reuses a bundle result without a
`bundle` request, it checks the same evidence. Reuse evidence moves no render
input key and is not a watch input. The compilation identity includes the
toolchain identity, the content of the recorded `jsconfig.json` and `extends`
files, the real path and the manifest content of each resolved peer, and the
content of each present `tsconfig.json` and `package.json` candidate above the
source root. So a change to one of them gives a new generation id. The other
reuse evidence stays out of the identity. An incomplete compilation gets a fresh
identity at each compile, also when the sidecar drops its evidence to fit the
frame limit. The binary then never reuses the definitions of an earlier
generation for it. A complete compilation keeps a deterministic identity.
Decision: a reuse check compares recorded digests, directory entries, and link
targets with the filesystem, so it copies no resolver rule. A second resolve
with esbuild was rejected, because it runs an esbuild operation on each reuse.
Package-manager install state files were rejected, because a manual link
change keeps them.

Each `bundle` call starts an unevaluated lifetime, also when the content id
matches an earlier evaluated lifetime. The core installs its maps,
description, and bindings before rendering. Releasing a generation or a
PostCSS context reaches every process that used it and starts no sidecar.

After the final graph or request releases a complete compilation, the pool keeps
its recipe in memory for later `bundle` calls. The pool keeps at most one
released recipe for each set of bundle settings: the last one released. The pool
compares settings without the evaluation digest. A later `bundle` call can reuse
that recipe. Equal settings, equal resolved roots, and the input rules above are
the only reuse checks, for released, stored, and live compilations alike.

The pool counts each released recipe at the size of its serialized
`restoreGeneration` envelope. The released recipes of one pool use at most
64 MiB in total, the value of the frame limit. A release of an incomplete recipe
or of a recipe above that bound removes the older released recipe of equal
settings and keeps nothing. When a new recipe takes the total above the bound,
the pool removes the least recently used recipes until the total fits. The pool
discards every released recipe when it stops: on shutdown, cancellation, and
forced termination. A release after the stop keeps nothing.

Decision: the pool keeps the last released recipe of each set of bundle
settings, in practice one head and one base recipe. The bound equals the
frame limit, so every recipe that a sidecar can restore fits. In a measured
Serve session with two edits and two reverts, this served all 6 of 10
bundles that repeated an earlier compile, with about 6.4 MiB of recipes.
Stores of many recipes within 16, 32, or 64 MiB were rejected. A `bundle`
call restores only one released recipe of its settings, so older recipes
would hold memory and never serve a bundle. A 128 MiB bound was rejected,
because it differs from 64 MiB only for a recipe above 32 MiB.

The binary also keeps the latest served compilation of each set of bundle
settings in the [bundle cache](./mokly-base-cache.md#bundle-entries), so a later
process can reuse it. Only a complete live or released compilation seeds a
`bundle` request. Without such a seed, the pool
installs the stored compilation with `restoreGeneration` before the request. The
reuse check then accepts it, or the sidecar compiles. A replay still restores a
live incomplete generation. The binary stores each served compilation with
complete and [stable](./mokly-base-cache.md#stable-capture) evidence that the
bundle cache lacks, also one served from memory. A failed bundle stores nothing.
Decision: a stored compilation reaches a sidecar only through
`restoreGeneration` and the reuse check. A check of the stored compilation in
the binary was rejected, because it needs new pool methods and the toolchain
identity in the binary. A sidecar that reads and writes the cache was
rejected, because the sidecar performs no file writes.

A worker emits an `operation` event for each catalogue `esbuild` call and each
PostCSS worker start or stop. The payload contains the operation and sidecar
PID. The core uses these events for exact counts, including failed calls.
They carry no source, CSS, props, or file paths.
