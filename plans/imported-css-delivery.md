# Imported CSS Delivery

## Status

Active. Created 2026-09-24 from the CSS-in-JS investigation on this branch.
Milestones 1, 1A, 2, 3, 4, 4A, and 5 (contract, binary-safe output, reserved
generated directory, CSS/asset bundling and follow-ups, and stylesheet links)
are complete; Milestones 6–9 remain. PostCSS will let Tailwind v4 and
autoprefixer use the consumer's configuration. Esbuild remains the only
bundler; the optional Vite compatibility package is a follow-up plan.

## Problem

Consumer modules can import CSS today, and the build accepts them, but the CSS
never reaches a rendered view:

- `import "./button.css"` and `import styles from "./card.module.css"` bundle
  with exit code 0. esbuild emits the CSS as a sibling `.mokly-consumer.css`
  output, and `src/build/load_graph.ts` keeps only the `.cjs` output. The
  generated HTML links nothing.
- CSS Modules are the worst case: markup carries `class="card_card"` while the
  rule that styles it is discarded, so screens render unstyled without any
  diagnostic.
- Imported CSS files are already inventoried in the manifest's `sourceFiles`,
  so they are watched and kept private, yet none of their content is public.
- A `url()` inside imported CSS fails the build with "No loader is configured
  for .woff2". A consumer-configured `file` loader silences the error but its
  copied files are discarded too, so the URLs point nowhere.
- The only supported route is consumer-authored public CSS under `mockupsDir`
  linked through `stylesheets` rules. Product CSS that lives beside components
  in `src/` must be copied or built there first.

Runtime CSS-in-JS libraries such as Emotion and styled-components already work
through the consumer renderer and are unaffected.

## Goal

Deliver every stylesheet the consumer graph imports as generated public output,
link it into every view that can use it, and keep every Mokly guarantee that
applies to generated HTML: complete source inventory, deterministic bytes,
stable routes for Changes, transactional writes, committed and derived Check,
on-demand Serve, export, and publication. Run the consumer's PostCSS
configuration over every imported stylesheet so Tailwind v4 and autoprefixer
work without a separate build step, with plugin-reported dependencies joining
the same inventory.

## Decisions

1. **Reserved generated directory.** All output from this feature lives under
   `<mockupsDir>/mokly-generated/`. Mokly owns every file below it. The
   directory is package-owned in the same way the manifest file is: configured
   entry-glob static prefixes, `entriesDir`, `stylesheets` paths,
   `review.outDir`, inventoried sources, and consumer-authored public files
   must not be inside it; discovery skips it for broad entry globs. Reject
   `publicExclude` only when a brace-expanded alternative starts with literal
   `mokly-generated`; Build rejects generated routes matched by any exclusion
   (including defaults), naming the glob. Build replaces its contents
   transactionally and removes files that the compilation no longer produces.
   Graph loading (including derived Check's prerequisite graph) and committed
   Check reject any symlink or non-regular entry in the reserved tree before
   walking it, without following the entry. Successful
   Builds prune only empty directories below the reserved root. Catalogue HTML
   routes may not begin with `mokly-generated/`; only portable generated CSS
   and asset routes with supported extensions are admitted there.
   Committed Check reports any unexpected file there as an orphan; derived
   Check rejects Git-tracked files there with the existing `.gitignore`
   guidance plus one directory rule.
2. **One stylesheet per root module, never one global bundle.** The roots are
   the configured renderer module first (not the built-in renderer), followed
   by every resolved entry module sorted by repository-relative path.
   Transformer-only CSS is inventoried, including nested imports and assets,
   but never delivered. Each root whose import graph reaches at least one stylesheet gets
   `mokly-generated/styles/<repository-relative module path>.css`, for example
   `mokly-generated/styles/src/screens/home.mockup.tsx.css`. Keeping the full
   module path including its extension avoids collisions between `x.ts` and
   `x.tsx`. A root that reaches no CSS produces no file.
3. **Link order.** `RenderInput.stylesheets` lists the matched `stylesheets`
   rule as today, then the renderer's generated stylesheet, then the entry's
   generated stylesheet. Links are relative to the fragment route and encoded
   exactly like configured links, so custom renderers that already emit
   `<link>` tags from `stylesheets` need no change. Page callbacks
   (`render: () => string`) receive no input today, so pages are not linked
   automatically; their reachable CSS is still bundled so a page can link it
   by relative path.
4. **Stylesheet order inside a root's bundle.** Stylesheets are collected in
   first-reachability depth-first order over the root's JavaScript import
   graph, following imports in source order and including each stylesheet
   once. Verified against esbuild: CSS reached through JavaScript is ordered by
   first import, while a stylesheet repeated through `@import` inside CSS keeps
   CSS semantics and moves to its last position. The bundle is produced by a
   second esbuild pass over a synthetic per-root stylesheet that `@import`s the
   collected files in that order; nested `@import` chains resolve there. Remote
   HTTP(S) `@import`s stay external, un-fetched and un-inventoried; valid
   prelude imports precede bundled local rules. The
   renderer's complete CSS closure (direct and nested imports) is excluded at
   every depth of the entry's CSS tree before PostCSS can inline it. Separate
   entries do not exclude each other's CSS. Strip only esbuild's source-path
   comments after configured transforms and URL rewriting.
5. **CSS Modules are named by Mokly, not by esbuild.** esbuild names classes
   `<file>_<class>` and appends suffixes on clashes, so adding an unrelated file
   can rename classes and create false Changes. Instead, a Mokly esbuild plugin
   transforms every `*.module.css` with Lightning CSS using a name pattern
   derived from the repository-relative file path and the local name, never
   from content or bundle-wide clash order. The plugin returns the class map as
   JavaScript to the graph pass and the transformed CSS to the stylesheet pass,
   so both agree by construction. Scope only classes, IDs and keyframes;
   preserve global custom properties, grid areas and container names. Use
   `customIdents: true` so keyframe declarations and animation references
   scope together; this also scopes counter-style and view-transition names.
   Provide a default class map and valid-identifier named exports. Cross-file `composes` is rejected;
   same-file and `global` composition work.
6. **Assets referenced by CSS are copied.** `url()` targets that resolve to
   repository files are emitted to `mokly-generated/assets/<repository-relative
path>` through esbuild's `file` loader with a path-mirroring asset name, and
   the stylesheet references them relatively. One asset referenced by several
   stylesheets is emitted once. The originals stay private inventoried inputs.
   Leave `data:`, remote, protocol-relative and fragment URLs unchanged;
   reject root-absolute URLs and unknown local asset extensions. Preserve
   query/fragment suffixes, including for in-repository `node_modules` assets;
   accept scoped npm package segments (`@scope`) immediately after
   `node_modules`, encoded as `%40scope` in links.
   Reject an asset inside `mockupsDir` unless it is already a graph source,
   rather than silently privatizing an existing public route.
   A route whose segments are not portable, for example a path with a space,
   fails the build naming the file and the rule.
7. **Generated outputs may be binary.** `Compilation.outputs` currently maps
   routes to strings. It becomes a map of routes to text or bytes, and every
   consumer of that map compares, writes, serves, captures, and exports bytes.
   This is a prerequisite refactor with no behavior change.
8. **Inventory is the union of both passes.** The stylesheet pass and
   transformer-only CSS traversal add `@import`ed stylesheets and `url()`
   assets to `sourceFiles`, so they are private, watched, and part of freshness
   checks. Serve/publish's inventory-only load must also collect CSS and
   report PostCSS dependencies.
9. **Loud failure for undelivered graph outputs.** After this change the graph
   pass must produce exactly one JavaScript output. A consumer `file` loader on
   a JavaScript-imported asset fails the build with guidance to use `dataurl`
   or `binary`, because such imports have no stable relative URL across views.
   `moduleResolution.loaders` may only map `.css` and `.module.css` to `empty`:
   `.css` opts out of plain and module CSS for the catalogue, while
   `.module.css` opts out only of modules. Other values fail config validation.
10. **No manifest schema change.** Ownership comes from the reserved directory,
    and per-view linkage is visible in the documents themselves, so manifest v5
    is unchanged. Changes attribution already follows linked stylesheets from
    documents and applies rule-level analysis to any stylesheet inside
    `mockupsDir`.
11. **One-time Changes jump.** Derived baselines are built with the base
    commit's own tooling. The first comparison after adopting this version
    shows every view that links a generated stylesheet as changed. This is
    documented, not worked around.
12. **PostCSS is explicit and runs before Mokly's own transforms.** A new
    top-level `postcss` config key names a config-relative PostCSS
    configuration module inside `repoRoot`; absent means PostCSS never runs.
    Mokly bundles local imports using esbuild so they join `configSourceFiles`,
    are watched, and stay private. Bare package imports resolve from each
    importer using Node ESM `import` conditions and stay external as absolute
    `file:` URLs; plugins run unbundled from consumer `node_modules`. Leave
    `mokly.config` loading unchanged. The module must default-export an object whose
    `plugins` is an array of plugin instances or an object mapping package
    names to options; package names resolve from the PostCSS module's
    directory, which keeps Tailwind, autoprefixer, and every other plugin a
    consumer dependency. `map` is accepted and ignored because Mokly emits no
    source maps; `parser`, `syntax`, `stringifier`, and any other key fail
    validation. Mokly runs the plugins on the renderer-pruned tree with `from`
    set to the source path, before CSS Modules naming and bundling. Cache by
    source path plus effective pruned-import set per compilation so both passes
    share a result; a different root-specific set requires reprocessing. Tailwind v4
    through `@tailwindcss/postcss` and autoprefixer are the tested plugins.
13. **Plugin-reported dependencies join the inventory.** A `dependency`
    message adds its repository file to `sourceFiles`. A `dir-dependency`
    message is expanded with the discovery walker and reported glob (default
    `**/*`), skipping denied paths and watching its allowed directory for
    additions. Never inventory generated output, paths outside `repoRoot`, or
    `node_modules`. An explicit generated-output dependency fails in both
    modes; a matching directory dependency fails in committed mode and skips
    generated files in derived mode. A reported file under `mockupsDir` that
    is not already a graph-inventoried source fails in either mode, avoiding
    silent privatization of public files. Errors name the plugin, stylesheet,
    file and Tailwind `@source not` guidance. Mokly pins no plugin versions.

## Non-goals

- Sass, Less, Stylus, and build-time CSS-in-JS tools that are not PostCSS
  plugins.
- PostCSS custom syntaxes, source maps, and PostCSS configuration discovery
  outside the configured module.
- JavaScript asset imports that return a URL.
- Vite configuration reuse or Vite plugin compatibility.
- A `define` setting for `import.meta.env`.
- Rebuilding only the stylesheet pass when nothing but CSS changed.
- Generating CSS from compatibility-transformer-only imports, or automatically
  injecting stylesheet links into complete page callbacks.

## Milestone 1: Documentation and protocol contract (complete)

Define the complete contract before any code changes so later milestones need
no guesswork.

- [x] Add `docs/protocol/mokly-imported-styles.md` (under 250 lines) and a linked
      `docs/protocol/mokly-imported-styles-errors.md` for exact diagnostics, covering:
      scope, the reserved directory and its validation rules, root modules and
      stylesheet routes, collection order and duplicate semantics, CSS Modules
      naming and the `composes` limitation, asset routes and URL rewriting,
      link order in `RenderInput.stylesheets`, page callbacks, inventory union,
      determinism, committed and derived Check behavior, Serve delivery, export
      and publication inclusion, watch classification, Changes attribution and
      the one-time jump, the `file` loader error, the `.css` `empty` opt-out,
      the `postcss` key with its module shape and plugin resolution, PostCSS
      run order and memoization, dependency and directory-dependency inventory,
      the committed-mode generated-output rule, the determinism caveat, and
      every error message class with its guidance.
- [x] Register the new contract in `docs/protocol/README.md`.
- [x] Align `docs/protocol/mokly-guides.md` with the explicitly labeled
      unimplemented Styles guide and current field-table validation.
- [x] Update `docs/protocol/mokly-configuration.md`: package-owned `.css`
      handling in `moduleResolution.loaders`, the reserved directory rejection
      for entry globs, `stylesheets` paths, `publicExclude`, and `review.outDir`,
      and the new `postcss` key with its validation rules.
- [x] Update `docs/protocol/mokly-rendering.md`: stylesheet link order and the
      reserved directory entries in the Generated Contract list.
- [x] Update `docs/protocol/mokly-source-protection.md` for the reserved
      directory, the union inventory, and plugin-reported dependencies, and
      `docs/protocol/mokly-watch.md` for stylesheet-pass inputs and PostCSS
      directory dependencies as rebuild inputs.
- [x] Update `docs/protocol/mokly-on-demand.md`, `mokly-export.md`,
      `mokly-publication.md`, and `mokly-derived-baselines.md` for reserved
      routes served from the live compilation, binary generated bytes in
      derived captures, and the directory `.gitignore` rule.
- [x] Update `docs/protocol/mokly-css-attribution.md` to state that generated
      stylesheets are in analysis scope and how their source files relate.
- [x] Update `docs/architecture/build-pipeline.md` and
      `docs/architecture/package-boundary.md` for the second pass, binary
      outputs, and the new ownership row.
- [x] Add `docs/guides/authoring/styles.md` (section `authoring`, order 10)
      covering plain CSS imports, CSS Modules, assets, runtime CSS-in-JS through
      the renderer including the `mainFields` note for styled-components in
      `"type": "module"` repositories, a Tailwind v4 and autoprefixer
      walkthrough with `@source` scoping, and the unsupported list. Update
      `docs/guides/authoring/config.md` where it describes `stylesheets` and
      add the `postcss` key to its field table.
- [x] Update `src/build/README.md` and the README's Authoring and Key code
      sections.
- [x] Run `npx prettier --check` on every changed Markdown file and review the
      diff for internal consistency across the protocol set.

## Milestone 1A: Contract review refinements (complete)

Resolve review findings without reopening Milestone 1 or changing product code.

- [x] Limit Lightning CSS Modules to classes, IDs and keyframes; verify every
      option and exported name with the workspace version, and clarify global
      tokens/grid/container values in the protocol, plan and Styles guide.
- [x] Define the literal-first-segment, brace-expanded `publicExclude` check
      and Build-time exclusion collision against all generated routes (including
      defaults); give both cases exact diagnostics.
- [x] Make entry-glob prefix, broad discovery skip, co-located `entriesDir`,
      and equal-to/inside `review.outDir` rules unambiguous.
- [x] Allow an npm `@scope` asset segment after `node_modules`; confirm
      esbuild's CSS URL, URL encoding, Serve decode and export resolution.
- [x] Keep bare PostCSS package imports external as absolute ESM file URLs
      after importer-relative resolution; verify real Tailwind/autoprefixer
      instance and object configurations without altering `mokly.config`.
- [x] Define external remote CSS `@import` ordering and inventory behavior;
      verify esbuild's placement in the root stylesheet.
- [x] Validate changed Markdown, run documentation/guide tests, review the
      diff, then commit with a heredoc/file message body and push without
      rewriting the Milestone 1 commit.

## Milestone 2: Binary-safe generated outputs (complete)

A refactor with no behavior change that lets later milestones emit fonts and
images as generated files.

- [x] Change `Compilation.outputs` in `src/build/compile.ts` to map routes to
      `string | Uint8Array` behind one typed `GeneratedFile` helper for reads,
      byte comparison, and byte length.
- [x] Write a failing synthetic binary corruption test first; audit every
      `Compilation.outputs` and `compileCatalogue` consumer, not only the
      initial file list, while retaining text semantics for HTML/manifest.
- [x] Update `src/build/transaction.ts`, `src/build/check.ts`,
      `src/build/tracked_output.ts`, `src/build/component_runtime.ts`,
      `src/cli/run.ts`, `src/export/run.ts`, `src/export/inputs.ts`,
      `src/review/compilation_assets.ts`, `src/review/head_assets.ts`,
      `src/review/screen_compare.ts`, and `src/review/component_compare.ts`:
      convert byte readers and comparisons, and confirm route/size-only or
      forwarding consumers need no text decoding.
- [x] Add `tests/build_binary_outputs.test.ts` proving a synthetic binary
      output is written, checked, staged, rolled back, captured for derived
      export, and served without corruption.
- [x] Synchronize the archive's required-guide list with the Styles guide
      added in Milestone 1; its existing release test catches missing guides.
- [x] Run `npm run build`, focused tests, `npm run example:build`,
      `npm run example:check`, `npm run lint`, `npm run typecheck`, and
      `cargo xtask check` with 100% pass rate; commit with a file/heredoc body
      and push the branch.

## Milestone 3: Reserved generated directory (complete)

Establish `mokly-generated/` as package-owned output before anything writes to
it.

- [x] Add `src/build/styles/routes.ts` with the reserved directory constant,
      the stylesheet and asset route derivations, and portable-segment
      validation with the documented npm-scope exception and error text.
- [x] Define and reject reserved-directory symlinks and non-regular entries
      before Build/committed Check ownership walks, without following them;
      test root symlinks, nested symlinks, and non-regular entries.
- [x] Report the first invalid reserved entry in full path sort order, even
      when a sibling file sorts before a nested entry in an earlier directory.
- [x] Reject catalogue routes starting with `mokly-generated/`, and admit only
      portable stylesheet/asset routes of the documented shapes and extensions
      within it; test rejected shapes and valid synthetic outputs.
- [x] Prune empty directories below the reserved root only on successful
      Build, without changing failed-write rollback; test nested cleanup.
- [x] Enforce literal-first-segment brace-expanded consumer public exclusions
      and Build-time collisions against all exclusions, including defaults,
      with the catalogued diagnostic and tests.
- [x] Clarify co-located `entries` globs versus the existing rejection of
      `entriesDir === mockupsDir`; keep other protocol and README references
      consistent with the implemented boundary.
- [x] Reject reserved `stylesheets` paths in `src/config/rules.ts`, static
      `entries` prefixes in `src/config/entry_globs.ts`, an equal-or-inside
      `entriesDir`/`review.outDir`, and brace-expanded first-segment
      `publicExclude` in `src/config/public_exclusions.ts`. Skip the reserved
      directory during broad entry discovery; check generated stylesheet/asset
      routes against **all** public exclusions (including defaults) in
      `src/build/output_paths.ts`, and reject inventoried sources inside it.
- [x] Extend `src/build/ownership.ts` so `generatedOwnershipDenial`,
      `pendingGeneratedOrphanRoutes`, and `unclaimedGeneratedRoutes` treat every
      regular file inside the reserved directory as owned generated output.
- [x] Extend derived Check in `src/build/tracked_output.ts` to add the
      directory rule to its `.gitignore` guidance when a tracked file is inside
      the reserved directory.
- [x] Add `tests/build_generated_directory.test.ts` and
      `tests/config_generated_directory.test.ts` covering validation rejections,
      including broad entry globs and `publicExclude` route collisions; orphan
      cleanup on Build, committed Check orphan reporting, derived Check rejection
      with the directory rule, and consumer public files elsewhere under
      `mockupsDir` remaining untouched.
- [x] Run the build, relevant tests, and `cargo xtask check`.

## Milestone 4: Collect and bundle imported CSS (complete)

Produce deterministic per-root stylesheets and assets inside the compilation.

- [x] Add `src/build/styles/collect.ts`: an esbuild plugin for the graph pass
      that loads plain `.css` as an empty side-effect module, transforms
      `*.module.css` with Lightning CSS into a class map plus retained CSS,
      records every stylesheet input, rejects cross-file `composes`, and fails
      on `file` loader outputs with the documented guidance. Honor a consumer
      `.css` `empty` loader as the opt-out.
- [x] Add `src/build/styles/order.ts`: derive each root's first-reachability
      depth-first stylesheet order from the graph metafile in
      `src/build/load_graph.ts`, keyed by the renderer path and each entry
      module; resolve the full renderer `@import` closure and prune its files
      at every depth of entry imports before PostCSS can inline them.
- [x] Add `src/build/styles/bundle.ts`: the second esbuild pass over synthetic
      per-root entries with the same resolution settings and Mokly plugins,
      `write: false`, `metafile: true`, the `file` loader for asset extensions
      with path-mirroring asset names under the reserved directory, relative
      URL rewriting, and source-path comment stripping. Inventory transformer-only
      CSS closures without emitting a route; skip bundling when no delivery
      root reaches CSS.
- [x] Union the stylesheet pass inputs into `sourceFiles` through
      `src/build/source_inventory.ts` and expose the per-root stylesheet and
      asset outputs on `LoadedGraph` for `compileCatalogue`.
- [x] Add `tests/build_imported_styles.test.ts` covering: a plain import
      produces the root stylesheet; two entries importing different CSS get
      separate files; shared CSS appears in both; the renderer's CSS gets its
      own file; the documented order rules including a repeated `@import`;
      CSS Modules names are stable when an unrelated module with the same
      basename is added and identical across two compilations; the class map
      matches the emitted rule; the opt-out loader; the `file` loader error;
      renderer/entry duplicates including nested `@import` and two entries
      sharing CSS; transformer-only CSS inventoried but undelivered; and
      unchanged behavior for a catalogue without CSS.
- [x] Add `tests/build_imported_styles_assets.test.ts` covering font and image
      `url()` copies, one copy for a shared asset, relative URL rewriting, a
      missing asset error, a non-portable route error, unchanged URL classes,
      root-absolute/unsupported-extension errors, `node_modules` assets
      including `@fontsource` scopes and remote CSS `@import`s,
      query/hash suffixes, public mockups asset rejection, and inventory of
      `@import`ed files and assets.
- [x] Cover the `style` export condition/main field under default and custom
      consumer resolution, prelude tokenization, transformer-only inventory,
      byte-safe Build/Check, deterministic CSS across processes, and precise
      failures in focused tests. Split the generated-directory test below 300
      lines and reuse the viewer's portable path rule for ordinary segments.
- [x] Add an analysis-only stylesheet resolver for transformer-only CSS so
      it joins the inventory without running the CSS bundler, and type the
      preprocessing result for future PostCSS dependency reporting.
- [x] Preserve CSS/asset outputs and stylesheet routes in retained Serve
      runtimes, accepted-graph recompilation, and watched-child IPC; test
      binary-safe transfer and derived Serve's background rebuild.
- [x] Load native Lightning CSS only for stylesheet processing so importing
      the CLI does not eagerly resolve a CommonJS dependency; align the older
      JavaScript `file` loader inventory test with the documented Build error.
- [x] Run the build, relevant tests, and `cargo xtask check`.

## Milestone 4A: Stylesheet pass follow-ups (complete)

Resolve stylesheet pass performance and deterministic-byte findings before linking.

- [x] Bundle the renderer alone and all entry roots in one multi-entry esbuild
      pass, preserving per-root prelude closure, metafile inventories, output
      routes, deterministic first-root errors, and shared-asset byte checks.
      Benchmark the same 60-entry catalogue before and after.
- [x] Memoize stylesheet preprocessing by the _effective_ pruned-import set;
      prove graph and stylesheet passes reuse unaffected text with a counting
      processor test.
- [x] Strip separator blank lines from esbuild input comments and finish CSS
      with exactly one newline; cover the resulting bytes.
- [x] Update the build README and protocol; run build, focused tests,
      example Build/Check, lint, typecheck, then `cargo xtask check`.
- [x] Commit and push independently; run post-push review using
      `docs/implementation-review-prompt.md` against `origin/main`.

## Milestone 5: Link generated stylesheets into every view (complete)

Make the delivered CSS reach rendered documents and pass validation.

- [x] Add `src/build/styles/links.ts` and extend `stylesheetsFor` in
      `src/build/render.ts` to append the renderer and entry stylesheet links
      after the configured rule, resolved and encoded like configured links.
- [x] Teach the public-file checks used by `stylesheetsFor` and the resource
      validators to accept pending generated routes from the current
      compilation, so Build validates links before files exist on disk.
- [x] Record the exporting resolved entry module for each definition,
      including helper-defined, re-exported and nested definitions, without
      changing the manifest or authored-source attribution.
- [x] Introduce one typed pending-generated-files view (HTML/CSS/opaque bytes)
      across full and on-demand render, link/resource validation and
      compatibility route discovery; CSS `url()` assets are pending targets,
      and reserved routes must never fall back to disk during compilation.
- [x] Serve accepted stylesheet and asset bytes from the on-demand generation
      at `/static/` routes, leaving remaining on-demand work to Milestone 7.
- [x] Write failing tests for entry ownership, generated CSS/asset validation
      against missing or stale on-disk output, and on-demand byte delivery.
- [x] Extend `tests/build_imported_styles.test.ts` with the link order, link
      resolution from nested fragment routes and dark fragments, saved variant
      and component views receiving the same links, and page callbacks
      receiving none while their entry stylesheet is still emitted.
- [x] Keep full compilation's transitive public HTML resource validation;
      update the protocol, guide, and READMEs for shipped link behavior.
- [x] Preserve internal-manifest privacy before the first Build: pending
      public resources never expose it, and retain its existing link error.
- [x] Run `npm run example:build` and `npm run example:check` to confirm the
      example catalogue, which imports no CSS yet, is byte-identical.
- [x] Run the build, relevant tests, and `cargo xtask check`.
- [x] Commit and push Milestone 5 independently; run the post-push review
      using `docs/implementation-review-prompt.md` against `origin/main`.

## Milestone 6: PostCSS pipeline

Run the consumer's PostCSS configuration over every imported stylesheet so
Tailwind v4 and autoprefixer work, with complete inventory and watch coverage.

- [ ] Add `postcss` with `npm install postcss` and confirm
      `npm run dependencies:check` still passes.
- [ ] Add the `postcss` config key to `src/config/types.ts` and a new
      `src/config/postcss.ts` that validates the config-relative path, requires
      a regular file inside `repoRoot`, loads the module through the shared
      esbuild config loader in `src/config/load.ts` with bare imports resolved
      via Node ESM `import` conditions from each importer and externalized as
      absolute `file:` URLs (without changing `mokly.config` loading), adds its metafile inputs
      to `configSourceFiles`, and normalizes the exported shape with the
      documented errors for missing `plugins`, unknown keys, and unresolvable
      package names.
- [ ] Add `src/build/styles/postcss.ts`: run the plugins per stylesheet with
      `from` set to the source path and `map: false`, collect `dependency` and
      `dir-dependency` messages, expand directories through the discovery
      walker using the reported glob (default `**/*`), apply explicit and
      directory generated-output plus public-file rules for both modes,
      and memoize by source and effective import-pruning set per compilation.
- [ ] Wire the runner into the load hook in `src/build/styles/collect.ts`
      ahead of CSS Modules naming for both passes, union dependency files into
      `sourceFiles`, and register directory dependencies as package-owned watch
      inputs.
- [ ] Add `tests/build_postcss.test.ts` using synthetic plugins with no new
      dev dependencies: a transform applies to imported and `@import`ed
      stylesheets; a transform inside a CSS Module runs before naming; an
      identical stylesheet/pruning input is processed once per compilation;
      `dependency` files join inventory and are private through `/static`;
      `dir-dependency` expansion honors the glob and skips denied directories;
      committed/derived generated-output and otherwise-public mockups-file
      errors and their guidance; a parent `docs/` glob still reaching mockups
      after `@source not "docs/mockups"` but `source(none)` avoiding that scan;
      inventory-only freshness; a plugin error
      names the plugin and file; package-name resolution from the PostCSS
      module's directory; `map` ignored and other keys rejected; a missing or
      escaping path rejected; and byte-identical output across two
      compilations.
- [ ] Add a `tests/catalogue_watch.test.ts` case where editing the PostCSS
      module, a reported dependency, or a file added under a directory
      dependency rebuilds and reloads.
- [ ] Run the build, relevant tests, and `cargo xtask check`.

## Milestone 7: Serve, watch, export, publication, and Changes

Carry the new outputs through every delivery path.

- [ ] Serve reserved-directory routes from the live compilation in
      `src/server/static_routes.ts` and on-demand route dispatch, and the
      controls preview path in
      `src/server/controls/transient_assets.ts`, never from a stale disk copy.
- [ ] Confirm watched edits to imported CSS, `@import`ed CSS, and referenced
      assets rebuild the graph and reload the browser; add cases to
      `tests/catalogue_watch.test.ts`.
- [ ] Include reserved-directory files in export and publication captures from
      compilation bytes in derived mode and from disk in committed mode; add
      cases to `tests/catalogue_export.test.ts` and verify
      `scripts/preview/build.mjs`.
- [ ] Add a Changes case to `tests/changes_css_attribution.test.ts` proving a
      CSS Modules edit keeps only views whose documents match the changed rule,
      and a case for a catalogue whose baseline predates generated stylesheets.
- [ ] Run the build, relevant tests, and `cargo xtask check`.

## Milestone 8: Example, guides, and smoke tests

Exercise the feature end to end in the tracked example.

- [ ] Add one component under `examples/basic/src/components` styled with a
      CSS Module and a plain stylesheet that references a small font or image,
      and use it from an existing entry so `npm run example:build` and
      `npm run example:check` cover generated stylesheets and assets.
- [ ] Add `tailwindcss`, `@tailwindcss/postcss`, and `autoprefixer` as root
      devDependencies for the example, add `examples/basic/postcss.config.mjs`
      and `postcss: "postcss.config.mjs"` to `examples/basic/mokly.config.ts`,
      and style one example component with Tailwind utilities scoped by
      `@source` to `examples/basic/src` plus one declaration autoprefixer
      expands for the configured browserslist. Confirm
      `npm run dependencies:check` passes with the new dev dependencies.
- [ ] Verify the guide added in Milestone 1 matches the shipped behavior and
      that `tests/package.test.ts` includes it in the packaged guides.
- [ ] Smoke test: run `npm run dev`, open the styled screen in mobile and
      desktop views and both color schemes, edit the CSS Module and then a
      Tailwind utility while serving, confirm each reload and that Changes
      lists only the affected screen, then run an export and open the exported
      screen from disk.
- [ ] Run the complete `npm test`, `npm run typecheck`, `npm run lint`, and
      `cargo xtask check`.

## Milestone 9: Commit, push, and review

- [ ] Run `git add -A`, commit using Conventional Commits, and push the branch.
- [ ] Review the complete local diff against `origin/main` using
      `docs/implementation-review-prompt.md` after the push. Report findings
      with severity, context, impact, lettered options, and a recommendation;
      do not change the implementation.

## Post-merge follow-up (non-blocking)

- Watch the first derived comparison on a consumer catalogue that adopts this
  version and confirm the documented one-time jump settles on the next commit.

## Follow-up plans (not part of this change)

- `define` support for `import.meta.env` style constants.
- Page render input carrying resolved stylesheet links.
- Rebuilding only the stylesheet pass when only CSS inputs changed, and a
  cross-compilation PostCSS cache for Serve.
- Optional `@mokly/vite` compatibility package that runs Vite's plugin
  container as the transform stage while esbuild keeps bundling.
- Ownership inference and bundle mapping listed under
  [CSS Change Attribution](./css-change-attribution.md).
