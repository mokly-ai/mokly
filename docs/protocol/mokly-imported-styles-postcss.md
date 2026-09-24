# Imported Stylesheet PostCSS And Dependency Inventory

This is the PostCSS and inventory companion to the [imported stylesheet
contract](./mokly-imported-styles.md). [Exact diagnostics](./mokly-imported-styles-errors.md)
apply throughout. PostCSS support is planned in Milestone 6.

Optional top-level `postcss` is a config-relative path to a regular `.ts`,
`.mts`, `.js`, `.mjs`, or `.cjs` module inside `repoRoot`; no discovery. Bundle
local imports with esbuild and retain them in `configSourceFiles` (private,
watched config-reload inputs). Resolve **every bare package import** from its
importer with Node ESM `import` conditions and externalize it as an absolute
`file:` URL in the temporary bundle; plugin packages and native bindings run
unbundled from the consumer's `node_modules`. Do not change how `mokly.config`
loads. The PostCSS module must default-export a non-array object with `plugins`
as either an ordered array of PostCSS plugin instances or an insertion-ordered
record mapping package names to plain option objects. Resolve object-form
package names with the same Node ESM conditions from the PostCSS module's
directory, instantiate with those options, and preserve declared order.
`map` is accepted but ignored; Mokly emits no source maps. Reject any other
keys, missing/invalid plugins, escaping paths and failed package resolution.

Run the consumer's plugins in order once for each distinct effective
stylesheet input with `from` set to its physical source path, `map: false`,
**after** renderer-exclusion pruning and **before** CSS Modules naming and
esbuild CSS bundling. PostCSS may inline local `@import`s (Tailwind v4 does),
so preprocessing must prune the entire local import tree before it can see
excluded content. Cache by `(source path, effective pruned-import set)`
within a compilation and share that result between graph and CSS passes;
the effective set consists only of resolved local prelude imports excluded
from that file, not every file in the renderer's closure;
the same file with different root-specific pruning is a distinct input and
must be processed again. Mokly supplies PostCSS, not consumer plugins or
their versions.

Inventory is the sorted, unique, repo-relative union of config/graph inputs,
entry roots, CSS-pass inputs including nested imports and `url()` assets,
transformer-only CSS closure, and PostCSS `dependency` messages and expanded
`dir-dependency` matches. Retain both logical and in-repository realpath
aliases. Inventory-only `loadConsumerGraph(config, false)` **must run the same
CSS collection/pass and dependency reporting** without evaluating renderer
callbacks; `assertFreshSourceInventory` compares this union to
`manifest.sourceFiles` for Serve and publish. No manifest schema change.

Interpret a plugin's `dependency.file` or `dir-dependency.dir` relative to
its stylesheet when not absolute. Ignore inputs outside `repoRoot` (also
physical escapes) and under `node_modules` before normalizing; never feed
them to `normalizeSourceFiles`. For directory messages, recursively walk
regular files from the reported directory with the discovery walk's denied
directory list; do not honor `.gitignore`, but match each path relative to
the reported directory using its minimatch `glob`, or `**/*` if absent
(`dot: true`, case-sensitive). Require a reported in-repository directory to
exist and be a directory even if it currently matches no files. Skip
`node_modules`, `.mokly-cache`, `review.outDir`, denied trees and paths outside
`repoRoot`. Register allowed directories for watching additions as well as
current matching files.

**Validation precedence:** Explicit `dependency` naming Mokly-owned output
fails in both modes. For directory matches, committed mode fails when the
glob reaches an existing generated fragment, manifest or file below
`mokly-generated/`; derived mode skips those files. Neither mode inventories
Mokly output. Next, any plugin-reported file inside `mockupsDir` that is not
**already a graph-inventoried source** fails (including public CSS or HTML);
this applies to explicit files and expanded directories in both modes.
Entries below `mockupsDir` already in the graph are allowed. Finally validate
the remaining in-repo regular files. An excluded generated or denied path
cannot be restored by a plugin glob or explicit watch rule. Directory reports
outside the root or inside `node_modules` are ignored; malformed in-repo
messages and missing explicit files fail as specified in the error catalogue.
For Tailwind, `@source not "<path relative to the stylesheet>"` excludes
direct scans of that directory, but an **ancestor** directory dependency
may still report a glob matching files beneath `mockupsDir`. In that case
exclude the matching reported ancestor (if safe for other authored sources),
or prefer `@import "tailwindcss" source(none)` plus `@source` for explicit
authored trees. Do not silently skip an otherwise-public matching file just
because Tailwind did not list it individually. Dependencies in `node_modules`
may still affect the processor's output, but are not private source inventory
entries.
