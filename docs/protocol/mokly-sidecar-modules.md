# Sidecar Module Sources

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

This page expands the [sidecar bundling contract](./mokly-sidecar.md#bundling).
The source root and dependency roots identify one comparison side. All roots
are resolved to real filesystem paths before identity and confinement checks.

## Source And Dependency Files

A selected dependency root is the `node_modules` directory of a configured
package root, or a `node_modules` directory named directly by the request.
A resolved real file inside it is a dependency, even when the directory also
lies inside the source root. JavaScript and CSS imports use this same rule.
The first dependency root uses the logical prefix `node_modules/`. Additional
roots use `node_modules/.mokly-roots/{index}/`, with their zero-based position
in the selected root list, followed by the path relative to that root.
Logical names use POSIX separators and contain no absolute or parent path.
The core maps them back to the selected root when it reads dependency bytes.

Files inside the source root use source-relative names. A source-relative
name that contains a `node_modules` segment is also a dependency. Dependency
files contribute to the module graph and stylesheet closure, but never to
catalogue entry discovery, source attribution, or the catalogue source
inventory. Their installation is owned by the dependency tier.

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

## Authoring And Evaluation

Repository-owned imports of `@mokly/mokly` receive the attributed authoring
facade. Installed dependencies receive the unattributed API. Their JSX
wrapper call sites omit optional catalogue source metadata. The virtual
entry, authoring facade, and JSX shim do not appear as catalogue modules.
The JSX development shim forwards to the consumer's `react/jsx-runtime` and
attaches invocation metadata only to `defineComponent` wrappers under the
[instance rules](./mokly-instances.md#optional-invocation-source).

A `*.module.css` import compiles to a stub that reads its class map from the
generation table at evaluation. The core scopes the stylesheet after PostCSS
and supplies all maps with `cssModules` before `describe` evaluates the bundle.
`cssModules` installs the table without bundling or reading source files.
One esbuild compilation builds each generation, including its runtime style
adapters. The adapters capture the same library instances that the consumer
imports. Peer resolution uses that compiler's resolver from the configuration
directory. Virtual modules do not enter the source inventory. CSS Modules
in dependencies use the same logical dependency names as their graph records.
The sidecar fails closed when a map is absent. Installing maps after
evaluation is a protocol failure; callers dispose and re-bundle first.

The generation key includes the real source root and real selected dependency
roots. A base and a head never share per-generation maps or bindings merely
because their source bytes are equal. The pool's internal epoch separates
successive loaded lifetimes of the same generation id. A stale worker disposes
its copy and replays bundle, maps, describe, and bindings before more work.
The fragment key also includes the class-map table digest and effective
binding and entry fingerprints.

esbuild supplies the in-memory virtual entry, the shared consumer React
runtime, the authoring facade, and the module inventory. The sidecar performs
no file writes. A resolution diagnostic names the logical module and the
authored importer location. It does not expose another checkout, a dependency
cache, or the bundler's implementation path.
