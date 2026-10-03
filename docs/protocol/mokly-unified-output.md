# Unified Generated Output And Imported Styles

## Delivery Status

Approved target for Milestone 11 of
[Generated Output Simplification](../../plans/generated-output-simplification.md).
Milestone 9 changes documentation only. Until Milestone 11 lands,
[generated output](./mokly-generated-output.md) describes this branch's v6
implementation. This document defines the merge changes; unchanged contracts
on both branches remain required. No output mode is restored.

The audited `origin/main` is `b2c82c1591c91f2550a66c464833b1f864bdab07`.
Its `mokly-imported-styles*.md`, `mokly-configuration-imported-styles.md`,
`mokly-rendering-generated.md`, `mokly-artifact-paths.md`, and
`mokly-export-public-files.md` are not present here yet. Milestone 11 must
merge them, reconcile the changes below, and add links. Their CSS processing,
validation, and delivery contracts remain in force except for the explicit
output-mode and layout replacements below.

## One Owned Tree

All paths in the compiled output map and `generatedFiles` are relative to
`<mockupsDir>/mokly-generated/`, with POSIX separators:

```text
<mockupsDir>/
  mokly-generated/
    mokly-manifest.json
    pages/<id>.html
    screens/<id>.<viewport>[.dark].html
    components/<id>.<viewport>[.dark].html
    styles/<repository-relative renderer or entry module path>.css
    assets/<repository-relative CSS asset path>
  <authored closure files at their existing catalogue-relative paths>
```

Preserve `main`'s kind/id route derivation and variant identities. A logical
entry route need not have a generated HTML file: component parents and use
cases remain shell routes. The manifest inventory records actual files only.
Keep the module extension before `.css`: `src/home.mockup.tsx` produces
`styles/src/home.mockup.tsx.css`. Asset bytes remain opaque. Keep supported
extensions, MIME types, portable segments, npm-scope exception, deterministic
root order, and byte-identical asset deduplication from `main`.

`GENERATED_DIRECTORY` remains defined only in
`packages/viewer/src/catalogue/delivery_paths.ts`, exported by
`@mokly/viewer/data`. Replace `main`'s definition in `src/build/styles/routes.ts`
with a direct import. Do not retain a second constant or prepend the directory
twice when moving `main`'s catalogue-relative style routes into this map.

Keep authored entries, renderer, transformer, package roots and PostCSS modules
outside this tree through both lexical and physical aliases. Broad entry globs
skip it; explicit inputs inside it fail the existing `config-invalid` setting
diagnostic. Stylesheet rules stay catalogue-relative and cannot target this
child. Retain this branch's supported `entriesDir === mockupsDir` layout with
protected source inventory; do not restore `main`'s old directory-wide ban or
`publicExclude`. Imported CSS keeps `main`'s public-source privacy checks.

Reserve `styles` and `assets` as the first segment of any generated HTML page
or fragment route, including supplied internal routes and future route kinds.
Compare the segment case-insensitively, consistent with output collision
checks. `styles/a.html` and `ASSETS/a.html` fail; `pages/styles.html` and
`styles.html` do not match a reserved segment. Reject before rendering or
writing, even if no CSS exists. Use `build-invalid` with this exact body:

```text
generated HTML route uses reserved first segment <segment>: <route>; styles and assets are reserved for generated stylesheets and assets
```

Substitute the original segment spelling and generated-root-relative route,
without quotes. Existing invalid-route checks run first. Check reserved
segments next, then duplicate/case-folded/file-directory collisions. Current
identity helpers cannot produce these prefixes; test the lower-level route
boundary too. This does not add an authored `route` option or reject historical
routes accepted by their version-specific reader.

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

Generated CSS traverses `@import` and `url()` against the pending output map;
binary resources are checked by existence and bytes, never parsed as text.
Keep `main`'s local `image-set()` string rejection and remote/data URL handling.
An input CSS file or asset outside `mockupsDir` can be copied by the imported
CSS pipeline into the generated set; its original source path stays private
and never enters `assetClosure`. Direct links outside `mockupsDir` stay invalid.

For a view at `mokly-generated/screens/home.mobile.html`, the entry CSS href
is `../styles/src/home.mockup.tsx.css`; a catalogue-root `styles.css` href is
`../../styles.css`. From `styles/src/home.mockup.tsx.css`, a copied
`assets/src/logo.png` uses `../../assets/src/logo.png`. No generated href adds
another `mokly-generated/` prefix. The same relative bytes must work from disk,
under Serve's `/static/`, and below an export's `static/`.

Retain `RenderInput.stylesheets` order: matching shared rule, scheme rule,
renderer bundle, entry bundle. Custom renderers emit those links. Whole-page
callbacks still receive no injected stylesheet links; their authored links
must follow this layout. The owning entry root is the module that yielded
the definition, not necessarily the module that called its helper.

## Commands And Accepted Generations

Remove committed/derived branches and Git-ignore committability checks from
the imported CSS implementation. Only `check` reads the current index, using
the complete expected tree including pages, manifest, CSS, and binary assets.
Keep the exact tracked/mixed/untracked and stale-output errors in
[generated output](./mokly-generated-output.md#tracked-state-and-commands).
Untracked checks never inspect an old output tree, even for CSS ownership.
Build can write ignored output; neither `.gitignore` nor head tracking gates it.

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
Retain `main`'s lazy per-generation CSS validation and route indexes, MIME
handling, GET/HEAD behavior, source-input drift checks and cancellation fences.

Imported CSS, nested imports, assets, PostCSS configuration/helpers and plugin
dependencies rebuild; ordinary linked authored CSS reloads. Directory reports
watch future matching additions. A watched writer completes full compilation
before installing anything; generated and transaction paths never trigger its
watcher. `serve --build --no-watch` writes once. The Serve child never writes.

## PostCSS Content Inputs Without Modes

Preserve `main`'s isolated per-graph plugin worker, module resolution, pruning
before PostCSS, CSS Modules after PostCSS, dependency aliases, source inventory,
diagnostic ordering, exact-required-input exceptions and worker-failure handling.
Apply one output policy regardless of Git tracking:

- Explicit `dependency.file` inside the generated tree, including a physical
  alias, fails `build-invalid` before public-file and regular-file checks.
  Its exact body is `PostCSS plugin <plugin> scanned Mokly-generated output in <stylesheet>: <file>; exclude <generated-root> from the plugin's sources`.
  All paths are repository-relative POSIX paths; `<file>` keeps the reported
  logical spelling and `<generated-root>` names `<mockupsDir>/mokly-generated`.
- Every `dir-dependency` expansion skips the entire generated tree and its
  aliases before reading descendants, matching globs or adding watch roots.
  A report rooted inside it contributes no files or watches. Do this even
  when output is tracked. Remove the committed-mode directory-scan error.
- Keep Review/cache/dependency and denied-directory exclusions. Remaining
  plugin-only inputs under `mockupsDir` still fail `main`'s public-file guard
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

Compare resource membership on both sides. Resolve v7's
`mokly-generated/styles/...` and v8's `styles/...` against their own descriptors
to the same generated-resource key. Keep authored closure keys separate.
Feed changed compiled CSS to rule-aware attribution; its private CSS source
is dependency evidence, not a second public stylesheet. Preserve `main`'s
delivered-source suppression, shared-impact fallbacks, removed-resource rules,
component fast paths and generation consistency. A real new stylesheet link
against a pre-CSS baseline can cause the documented one-time Changes jump.

Acceptance must retain `main`'s CSS/Modules/PostCSS regressions and this branch's
tracking, transaction, baseline and closure tests. Add reserved-route rejection,
raw binary inventory hashes, no stale-disk fallback, all three styled delivery
surfaces, watcher success/failure, output-independent PostCSS scans, and a v7
to v8 comparison whose unchanged stylesheet is not reported changed solely
because its storage root moved.
