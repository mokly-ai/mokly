# Unified Generated Output And Imported Styles

## Delivery Status

The unified layout follows [Generated Output Simplification](../../plans/generated-output-simplification.md).
The [imported CSS contract](./mokly-imported-styles.md),
[CSS configuration](./mokly-configuration-imported-styles.md),
[generated rendering](./mokly-rendering-generated.md),
[artifact paths](./mokly-artifact-paths.md), and
[export capture](./mokly-export-public-files.md) retain all non-mode behavior.
The layout and command rules below apply across them.

## One Owned Tree

All paths in the compiled output map and `generatedFiles` are relative to
`<mockupsDir>/mokly-generated/`, with POSIX separators:

```text
<mockupsDir>/
  mokly-generated/
    mokly-manifest.json
    <path>/index[.<viewport>][.dark].html
    <copied Markdown resources at their derived paths>
    styles/<repository-relative renderer or entry module path>.css
    assets/<repository-relative CSS asset path>
  <authored closure files at their existing catalogue-relative paths>
```

Preserve file-derived entry paths, folder records and parent/variant paths. A logical
entry route need not have a generated HTML file: component parents and use
cases remain shell routes. The manifest inventory records actual files only.
Keep the module extension before `.css`: `src/home.mockup.tsx` produces
`styles/src/home.mockup.tsx.css`. Asset bytes remain opaque. Keep supported
extensions, MIME types, portable segments, npm-scope exception, deterministic
root order, and byte-identical asset deduplication from `main`.

`GENERATED_DIRECTORY` remains defined only in
`packages/viewer/src/catalogue/delivery_paths.ts`, exported by
`@mokly/viewer/data`. The style route builder imports this shared constant.
No second definition or duplicate directory prefix is permitted. Generated
style and asset keys in the output map are relative to the generated root.

Keep authored entries, renderer, package roots and PostCSS modules
outside this tree through both lexical and physical aliases. Broad entry globs
skip it; explicit inputs inside it fail the existing `config-invalid` setting
diagnostic. Stylesheet rules stay catalogue-relative and cannot target this
child. Entry modules may sit below `mockupsDir` as protected authored sources,
but a configured root must not equal `mockupsDir`, including through a real-path
alias. Preserve the current `config-invalid` error:
`authored source directories must not equal mockupsDir`. Do not restore
`publicExclude`. Imported CSS keeps public-source privacy checks.

Reserve `styles` and `assets` as the first segment of any generated HTML page
or fragment route, including supplied internal routes and future route kinds.
Compare the segment case-insensitively, consistent with output collision
checks. `styles/a/index.html` and `ASSETS/a/index.html` fail;
`reports/styles/index.html` does not match a reserved segment. Reject before rendering or
writing, even if no CSS exists. Use `build-invalid` with this exact body:

```text
generated HTML route uses reserved first segment <segment>: <route>; styles and assets are reserved for generated stylesheets and assets
```

Substitute the original segment spelling and generated-root-relative route,
without quotes. Existing invalid-route checks run first. Check reserved
segments next, then duplicate/case-folded/file-directory collisions. Path-derived entries can reach these prefixes; test both compilation and the
lower-level route boundary. This does not add an authored `route` option. Only v9 baselines
reach a content reader; there is no earlier route model to adapt.

Generated HTML uses the path-derived document and view names in
[artifact paths](./mokly-artifact-paths.md). A component variant includes its
parent path and its own slug. Shell-only use cases have no generated HTML.
Markdown documents have one file per enabled scheme and copied resources.

## One Reference Rule

Build, on-demand rendering, Serve, watches, Changes, export, and publication
must resolve local references through the same generation and path policy:

1. Resolve the URL against the referring file's actual catalogue-relative
   location. Preserve query/fragment, use POSIX relative hrefs and encode each
   path segment once. Apply existing scheme, traversal, alias and source checks.
2. A target inside `mokly-generated/` must be an actual public pending output
   in that generation: HTML, compiled CSS, or a copied asset. Never satisfy it
   from disk. The manifest is private even before it exists and always fails
   the internal-metadata reference check.
3. Any other local target must be a confined authored regular file below
   `mockupsDir`, outside the generated tree, and not protected source. Collect
   that file in `assetClosure` and traverse its HTML/CSS references. No directory
   walk grants public access. A local target outside both sets is invalid.

Authored paths below `styles/` or `assets/` still use the ordinary private-directory
checks. Those names alone do not grant generated-file access; only an accepted
file below the outer `mokly-generated/` prefix gets that access.

Generated CSS traverses `@import` and `url()` against the pending output map;
binary resources are checked by existence and bytes, never parsed as text.
Keep local `image-set()` string rejection and remote/data URL handling.
An input CSS file or asset outside `mockupsDir` can be copied by the imported
CSS pipeline into the generated set; its original source path stays private
and never enters `assetClosure`. Direct links outside `mockupsDir` stay invalid.

For a view at `mokly-generated/home/index.mobile.html`, the entry CSS href
is `../styles/src/home.mockup.tsx.css`; a catalogue-root `styles.css` href is
`../../styles.css`. From `styles/src/home.mockup.tsx.css`, a copied
`assets/src/logo.png` uses `../../assets/src/logo.png`. No generated href adds
another `mokly-generated/` prefix. The same relative bytes must work from disk,
under Serve's `/static/`, and below an export's `static/`.

The [renderer stylesheet contract](./mokly-rendering.md#renderer-stylesheets)
owns the complete `RenderInput.stylesheets` list and its order. Custom renderers
emit those links. Component declarations add their links through the
[component stylesheet contract](./mokly-component-stylesheets.md). Whole-page
callbacks still receive no injected stylesheet links; their authored links
must follow this layout. The owning entry root is the module that yielded
the definition, not necessarily the module that called its helper.

## Commands And Accepted Generations

No output-mode branches or Git-ignore committability checks participate in
the imported CSS implementation. `check` reads the current index, using
the complete expected tree including pages, manifest, CSS, and binary assets.
Keep the exact tracked/mixed/untracked and stale-output errors in
[generated output](./mokly-generated-output.md#tracked-state-and-commands).
Untracked checks never inspect an old output tree, even for CSS ownership.
Build can write ignored output; neither `.gitignore` nor head tracking gates it.
CLI publish separately requires a clean checkout and compares committed output
or requires ignored derived output under the [upload contract](./mokly-upload.md).

Preserve the repository-scoped generated-output lock and its exact holder,
realpath-alias, bounded wait, cancellation, dead-holder reclamation and cleanup
guarantees. Acquire it once for the entire generated-tree transaction, including
validation, staging, backup, install, rollback and cleanup. Build, watched Build
and the opted-in Serve parent use the same lock; the child never acquires it.
Cancellation stops waiting for the lock, not a transaction already underway.
Keep the output.lock timing span. Plain Serve, export and publication neither
write generated output nor acquire its writer lock; their independent source,
resource-byte and capture stability checks remain required.

Only `build`, `build --watch`, and `serve --build` write the whole tree through
the existing transaction. Carry raw bytes through staging, rollback, retained
runtimes, and worker/child IPC. Validate an existing tree's regular-file and
symlink safety at a writer boundary or tracked check, without following links;
do not let unused disk output block an in-memory command. Failed compilation
or cancellation retains the last accepted HTTP generation and output tree.

Plain Serve, export, publication, selected comparisons and component previews
use accepted in-memory CSS/assets even when local output is absent or stale.
Serve exposes only accepted generated files and the validated authored closure;
the private manifest returns 404. Export and publication omit that manifest.
Retain lazy per-generation CSS validation and route indexes, MIME
handling, GET/HEAD behavior, source-input drift checks and cancellation fences.

Imported CSS, nested imports, assets, PostCSS configuration/helpers and plugin
dependencies rebuild; ordinary linked authored CSS reloads. Directory reports
watch future matching additions. A watched writer completes full compilation
before installing anything; generated and transaction paths never trigger its
watcher. `serve --build --no-watch` writes once. The Serve child never writes.

## PostCSS Content Inputs Without Modes

Preserve isolated per-graph plugin worker, module resolution, pruning
before PostCSS, CSS Modules after PostCSS, dependency aliases, source inventory,
diagnostic ordering, exact-required-input exceptions and worker-failure handling.
Apply one output policy regardless of Git tracking:

- Explicit `dependency.file` inside the generated tree, including a physical
  alias, fails `build-invalid` before public-file and regular-file checks.
  Its exact body is `PostCSS plugin <plugin> scanned Mokly-generated output in <stylesheet>: <file>; exclude mockupsDir from the plugin's sources (Tailwind: @source not "<relative-mockups-dir>")`.
  `<stylesheet>` and `<file>` are repository-relative POSIX paths; `<file>`
  keeps the reported logical spelling. `<relative-mockups-dir>` is relative
  to the stylesheet, with `./` when neither `.` nor `..` starts it. See
  [the error catalogue](./mokly-imported-styles-errors.md).
- Every `dir-dependency` expansion skips the entire generated tree and its
  aliases before reading descendants, matching globs or adding watch roots.
  A report rooted inside it contributes no files or watches. Do this even
  when output is tracked. Remove the committed-mode directory-scan error.
- Keep Review/cache/dependency and denied-directory exclusions. Remaining
  plugin-only inputs under `mockupsDir` still fail public-file guard
  unless already graph-inventoried; exclusion of generated output does not
  make authored public files into private inputs.

Mokly's dependency filter does not control a plugin's own filesystem reads.
Consumer content scanners must exclude the generated tree themselves. Retain
the Tailwind guidance from `main`: use `source(none)` and explicit authored
`@source` paths, or exclusions that cover the actual reported ancestor scan
roots. No default broad scan may take generated HTML/CSS as authored content.
Verify that absent, built, stale, tracked and ignored output produce identical
plugin input inventories and compiled bytes with this configuration.

## Changes And Historical Resources

Compare accepted generated stylesheet and asset bytes with the pinned base's
bytes independently of changed Git paths. Select the base reader per commit
under the [manifest contract](./mokly-generated-manifest.md). Do not inspect
the current index or require head disk equality. Reuse accepted outputs and
the retained delivered-source map instead of rescanning a newer consumer graph.

Compare resource membership on both v9 sides using each side's own descriptor.
Use generated-relative stylesheet/asset keys and separate catalogue-relative
authored closure keys, including when catalogue roots move. Do not normalize
older layouts into v9. A pre-v9 manifest selected inside the generated tree or found after the base's
own build produces the typed earlier-baseline unavailable outcome. Committed
root-level metadata cannot suppress a rebuild; invalid caches rebuild.
Feed changed compiled CSS to uniform rule attribution. Its private sources
and PostCSS candidates are rebuild inputs, never comparison evidence. Equal
normalized changed rules join generated copies across entry roots. Kept own-page
matches change components; outside matches and unresolved rules give pages
direct rows. Preserve inserted-link provenance, removed-resource rules,
component fast paths and generation consistency. Pre-v9 baselines do not
produce a one-time stylesheet Changes jump because their content is not read.

Acceptance covers CSS/Modules/PostCSS regressions and the
tracking, transaction, baseline and closure tests. Add reserved-route rejection,
raw binary inventory hashes, no stale-disk fallback, all three styled delivery
surfaces, watcher success/failure, output-independent PostCSS scans, and v9
comparisons across moved catalogue roots. Test the exact unavailable outcome
for every pre-v9 base instead of accepting a v7-to-v9 content comparison.

The approved [path/output integration](./mokly-path-output-integration.md)
defines the current path-derived layout. Its
[format inventory](./mokly-format-versions.md) defines manifest v9, catalogue v5,
review v6 and all other boundaries. Only v9 baseline content is readable after
that integration; the earlier-version product outcome remains unchanged.
