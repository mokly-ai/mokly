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
reach the same process. A
[prepared context](./mokly-sidecar-postcss.md#prepared-contexts) lives in the
process that runs its `bundle` request, so its later requests and its release
reach that process. The
[source root scheduling rules](./mokly-sidecar-root-scheduling.md) choose the
process that changes root.

Decision: the process of the `bundle` request keeps the prepared child.
Placement at the first `processCss` request was rejected, because that request
usually reaches another idle process, which has no prepared child.

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
that source root. npm and pnpm links follow the same rule. A file outside
source, repository mapping, and selected dependencies fails closed for
JavaScript and CSS alike.

On the esbuild path, the graph lists each module's imports in record order
from the bundler's metafile. That order includes re-exports and dynamic
imports. The [module graph rules](./mokly-vite-adapter.md#module-graph) of
the Vite adapter define the graph of a Vite compile. Stylesheets use their
resolved logical names. The binary watches source files, hashes
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

The [workspace package source rule](./mokly-comparison-packages.md#workspace-package-sources)
applies to bundled imports of bare package specifiers, including JavaScript
imports of CSS. It also covers missing build targets for requires that Node
loads. Both bundle capture modes keep the workspace layout probes of every
layout that the rule tries in private reuse evidence, including when no
source matches. Each `package.json` that the rule reads to find a package
root and its `name` enters the same evidence, because an entry of
`moduleResolution.sourcePackages` applies by that `name`. In marked edit
evidence, build files, export targets, and source files that a lookup checks
for presence use path-only entries. Manifests and layout files carry digests.
A build file known to be a target of the restored Node `require` when the
bundle records the lookup also carries a digest. Build files read by a
synchronous PostCSS `require` carry digests in the stylesheet input evidence.
Layout files and package manifests used for build targets also enter the
bundle metadata. The bundle keeps the absent build and source candidates of
every tried layout as watch inputs. Selected source contents enter through
the module graph and stylesheet inputs.

Under the [Vite adapter](./mokly-vite-adapter.md#replaced-settings), the rule
applies to the file that the project's Vite setup selects, on the head and the
base. It covers a catalogue import, an import in the Vite config file, a
JavaScript import of a package CSS file, and a stylesheet `@import` of a
package CSS file. It also covers missing build targets for modules that Node
loads for the Vite config.

Each bundle starts from a virtual entry. The virtual entry imports each
configured entry module, stories file, and renderer, and the selected preview
file of each [Storybook folder](./mokly-storybook.md#storybook-folders) of the
stories files, and each import loads that file. TypeScript `paths` never apply
to these imports, in any attempt of a compile.
Decision: the imports of the virtual entry never follow `paths`, also when a
`paths` key matches the path of a configured file. Imports that follow `paths`
were rejected, because the
[marker rule](./mokly-sidecar-recipes.md#capture-modes) would then have to
count them. Every Serve edit compile would then lose its marker whenever the
sidecar cannot tell whether a key matches, as with a package `extends` such as
`expo/tsconfig.base`.

## Authoring And Evaluation

Bundle parsing ignores each module's package `type` and `tsconfig.json` parse
settings. A source `@jsxImportSource` pragma can select that module's JSX import
source; a tsconfig `jsxImportSource` setting does not. Use the source pragma
when a JSX library requires its own runtime. This parsing policy does not
disable the source-side tsconfig path resolution described above. Under the
[Vite adapter](./mokly-vite-adapter.md#moklys-plugin), the project's Vite
setup decides these parse settings instead. That setup also
[resolves imports](./mokly-vite-adapter.md#replaced-settings), so the
source-side tsconfig path resolution does not apply.

Repository-owned imports of `@mokly/mokly` receive the attributed authoring
facade. Installed dependencies receive the unattributed API. Their JSX
wrapper call sites omit optional catalogue source metadata. The virtual
entry, authoring facade, and JSX shim do not appear as catalogue modules.
The [JSX development shim](./mokly-sidecar.md#bundling) attaches invocation
metadata under the
[instance rules](./mokly-instances.md#optional-invocation-source). Invocation
source file names resolve from the configuration directory before conversion
to repository-relative invocation paths.

On the esbuild path, the core scopes each `*.module.css` stylesheet after
PostCSS. The
[Vite adapter stylesheet rules](./mokly-vite-adapter-styles.md#css-modules)
define the CSS Modules of a Vite compile. The core supplies all class maps
with `cssModules` before `describe` evaluates the bundle.
`cssModules` installs the maps without bundling or reading source files. A
root import and a subpath import of a style library use the same package copy
of its style registry. Wrappers keep the importer's CommonJS default-import interop:
Node's rule for `.mjs` and `.mts` importers, the `__esModule` default otherwise.
The rule matches unwrapped imports in the same Mokly bundle.
A wrapper diagnostic names the importer's logical source path as its location
and the wrapped file's logical name when it describes that module's exports.
Peers resolve from the configuration directory. When `@storybook/react` does
not resolve there, it resolves under the
[Storybook folder rules](./mokly-storybook.md#storybook-folders). Virtual
modules do not enter the source inventory. CSS Modules in dependencies use the
same logical dependency names as their graph records.
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

[Compiled recipes and release](./mokly-sidecar-recipes.md) define the
compiled recipe of each `bundle` result, the capture modes of a `bundle`
request, reuse and identity, released recipes, bundle cache seeding, and the
operation events of a worker.
