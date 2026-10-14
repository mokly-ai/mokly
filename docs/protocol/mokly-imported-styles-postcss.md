# Imported Stylesheet PostCSS And Dependency Inventory

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

This is the PostCSS and inventory companion to the
[imported stylesheet contract](./mokly-imported-styles.md).
[Exact diagnostics](./mokly-imported-styles-errors.md) apply throughout.

## PostCSS Module

The optional top-level `postcss` configuration names a config-relative
regular `.ts`, `.mts`, `.js`, `.mjs`, or `.cjs` module inside the repository;
there is no discovery. The module default-exports a non-array object whose
`plugins` is an ordered array of PostCSS 8 plugins, that is instances,
uncalled creators with `postcss: true`, plain plugin functions, and objects
with a `postcss` factory, or an insertion-ordered record that maps package
names to plain option objects. `map` is accepted and ignored; Mokly emits no
source maps. Any other key, a missing or invalid `plugins`, an escaping path,
or a failed package resolution fails configuration. PostCSS normalizes array
elements; a normalization failure maps to the indexed diagnostic.

The sidecar loads the module under its
[consumer PostCSS rules](./mokly-sidecar.md#consumer-postcss): once per bundle
generation, in a fresh isolated module context, with the plugins instantiated
once and reused for every stylesheet of that generation, so a stateful plugin
cannot keep candidates across generations or watched rebuilds. The sidecar
bundles the module's local imports with esbuild, resolves every bare package
import from its importer with Node's `import` conditions, and externalizes
it, so plugin packages and native bindings run unbundled from the consumer's
`node_modules`; a record-form package name resolves the same way from the
module's directory. `import.meta.url`, `import.meta.dirname`, and
`import.meta.filename` of each bundled local source are rewritten to that
source's real location. CommonJS modules and local `.cts` helpers use
`require` conditions, keep Node built-ins, and receive `require`,
`__dirname`, and `__filename` rooted at the real module path. The module's
local imports are private, watched configuration inputs in the source
inventory; a change reloads the configuration. On the base side of a
comparison the module runs with the base commit's sources and dependencies
under the [dependency tiers](./mokly-comparison.md#sides).

## Transform

The core calls `processCss` once per distinct effective stylesheet input,
with `from` set to the physical source path and `map: false`, after
renderer-exclusion pruning and before CSS Modules scoping and `lightningcss`
bundling. The effective input is the pair of the source path and the set of
local prelude imports pruned from that file for this root; the same file
with different pruning is a distinct input, and equal inputs are processed
once per generation. Mokly supplies PostCSS; the consumer supplies the
plugins and their versions. The request has the sidecar's `processCss`
deadline. A plugin that throws fails with the catalogued diagnostic; a
sidecar crash, timeout, or protocol error uses the sidecar's fail-closed
codes.

A plugin can inline nested local `@import`s from disk and bypass pruning. For
each processed input, the core walks the kept local prelude-import tree with
the stylesheet resolver, without running plugins. When an excluded renderer
file is reachable at depth two or more through a kept intermediate file and
a plugin reports that excluded file as a `dependency`, the build fails with
the nested-import diagnostic before the inventory checks; it never silently
duplicates the file. The diagnostic names the intermediate file that imports
the excluded file, which for a deeper chain is its direct importer. When no
plugin reports it, the bundler prunes it at the nested file as usual.

## Dependency Inventory

`processCss` returns the plugins' `dependency` and `dir-dependency`
messages. A `dependency.file` or `dir-dependency.dir` that is not absolute is
relative to its stylesheet. A physical path that a plugin reports under a
symlinked repository root is translated to the logical root, and the real
alias is kept for confinement and privacy checks. Reports outside the
repository's physical root or physically under `node_modules` are ignored
before normalization. A logical `node_modules` symlink into an in-repository
workspace package is different: its physical source and its logical alias
stay inventoried as exact required inputs, including CSS `url()` assets, and
a change to either path rebuilds.

For a directory message, the core walks regular files from the reported
directory with the discovery walk's denied directory list, does not honour
`.gitignore`, and matches each path relative to the reported directory with
its minimatch `glob`, or `**/*` when absent, with `dot: true` and
case-sensitive matching. The reported in-repository directory must exist and
be a directory even when it matches no file. The walk skips
`node_modules`, denied trees, and paths outside the repository, and never
follows a symlink below the reported directory; the reported directory itself
may be an in-repository symlink to an in-repository directory, whose matching
files keep both aliases. An allowed directory is registered for watching
additions as well as its current matching files.

An explicit `dependency.file` is an exact required input: an existing file
under `dist`, `target`, `coverage`, `test-results`, `playwright-report`, or
`.context` stays inventoried and watched, while a broad directory scan still
prunes those trees. Every reported file joins the source inventory of the
[source protection contract](./mokly-source-protection.md) and the watch
set. A reported file becomes a protected input, so a document that
references it
as a public file fails with the protected-target diagnostic of the
[referenced closure](./mokly-public-closure.md), whose reason names the
plugin and the Tailwind exclusion. The in-repository regular files are then
validated: a malformed message and a missing explicit file fail as the
catalogue states, and among missing inputs, exact files come before
directories. Each glob is compiled once per report,
classification is cached within the generation, and a file already checked
as an explicit dependency is not checked again. Diagnostics and inventory
order compare paths by UTF-16 code units without locale collation.

## Tailwind

Tailwind v4 recursively inlines local imports even without a Tailwind
directive, reports inlined and scanned files as dependencies, and reports
scanned directories with extension globs. Its default `base` is the process
working directory, its default `optimize` follows
`NODE_ENV === "production"`, and its default `transformAssetUrls` rebases
assets from inlined files. For reproducible output, prefer
`tailwindcss({ base: import.meta.dirname, optimize: false })`, or
`@import "tailwindcss" source(none)` with explicit `@source` paths.
`@source not "<path relative to the stylesheet>"` excludes direct scans of a
directory, but an ancestor directory dependency may still report a glob that
matches files that documents reference as public assets; exclude the
reported ancestor, or use
`source(none)` with explicit authored trees. Mokly never silently skips an
otherwise public matching file because Tailwind did not list it
individually. A component or CSS Module that needs Tailwind context but not
emitted CSS uses `@reference`; when the renderer already delivers Tailwind,
the entry's direct Tailwind import is pruned and `@apply` needs `@reference`.
