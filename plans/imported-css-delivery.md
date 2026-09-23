# Imported CSS Delivery

## Status

Active. Created 2026-09-24 from the CSS-in-JS investigation on this branch. No
milestone has started. The plan keeps esbuild as the only bundler; the optional
Vite compatibility package and PostCSS are recorded as follow-up plans.

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
on-demand Serve, export, and publication.

## Decisions

1. **Reserved generated directory.** All output from this feature lives under
   `<mockupsDir>/mokly-generated/`. Mokly owns every file below it. The
   directory is package-owned in the same way the manifest file is: configured
   entry globs, `stylesheets` paths, `publicExclude` rules, `review.outDir`,
   inventoried sources, and consumer-authored public files must not be inside
   it, and validation rejects them by name. Build replaces its contents
   transactionally and removes files that the compilation no longer produces.
   Committed Check reports any unexpected file there as an orphan; derived
   Check rejects Git-tracked files there with the existing `.gitignore`
   guidance plus one directory rule.
2. **One stylesheet per root module, never one global bundle.** The roots are
   the configured renderer module and every resolved entry module. Each root
   whose import graph reaches at least one stylesheet gets
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
   collected files in that order; nested `@import` chains resolve there.
   esbuild's source-path comments are stripped; no other rewriting happens.
5. **CSS Modules are named by Mokly, not by esbuild.** esbuild names classes
   `<file>_<class>` and appends suffixes on clashes, so adding an unrelated file
   can rename classes and create false Changes. Instead, a Mokly esbuild plugin
   transforms every `*.module.css` with Lightning CSS using a name pattern
   derived from the repository-relative file path and the local name, never
   from content or bundle-wide clash order. The plugin returns the class map as
   JavaScript to the graph pass and the transformed CSS to the stylesheet pass,
   so both agree by construction. `composes` between files is rejected with a
   build error in this change; same-file and `global` composition work.
6. **Assets referenced by CSS are copied.** `url()` targets that resolve to
   repository files are emitted to `mokly-generated/assets/<repository-relative
path>` through esbuild's `file` loader with a path-mirroring asset name, and
   the stylesheet references them relatively. One asset referenced by several
   stylesheets is emitted once. The originals stay private inventoried inputs.
   A route whose segments are not portable, for example a path with a space,
   fails the build naming the file and the rule.
7. **Generated outputs may be binary.** `Compilation.outputs` currently maps
   routes to strings. It becomes a map of routes to text or bytes, and every
   consumer of that map compares, writes, serves, captures, and exports bytes.
   This is a prerequisite refactor with no behavior change.
8. **Inventory is the union of both passes.** The stylesheet pass metafile adds
   `@import`ed stylesheets and `url()` assets to `sourceFiles`, so they are
   private, watched, and part of freshness checks.
9. **Loud failure for undelivered graph outputs.** After this change the graph
   pass must produce exactly one JavaScript output. A consumer `file` loader on
   a JavaScript-imported asset fails the build with guidance to use `dataurl`
   or `binary`, because such imports have no stable relative URL across views.
   `moduleResolution.loaders` may still map `.css` to `empty` to opt out of
   delivery for a whole catalogue.
10. **No manifest schema change.** Ownership comes from the reserved directory,
    and per-view linkage is visible in the documents themselves, so manifest v5
    is unchanged. Changes attribution already follows linked stylesheets from
    documents and applies rule-level analysis to any stylesheet inside
    `mockupsDir`.
11. **One-time Changes jump.** Derived baselines are built with the base
    commit's own tooling. The first comparison after adopting this version
    shows every view that links a generated stylesheet as changed. This is
    documented, not worked around.

## Non-goals

- Sass, Less, Stylus, PostCSS, Tailwind, and build-time CSS-in-JS plugins.
- JavaScript asset imports that return a URL.
- Vite configuration reuse or Vite plugin compatibility.
- A `define` setting for `import.meta.env`.
- Rebuilding only the stylesheet pass when nothing but CSS changed.

## Milestone 1: Documentation and protocol contract

Define the complete contract before any code changes so later milestones need
no guesswork.

- [ ] Add `docs/protocol/mokly-imported-styles.md` (under 250 lines) covering:
      scope, the reserved directory and its validation rules, root modules and
      stylesheet routes, collection order and duplicate semantics, CSS Modules
      naming and the `composes` limitation, asset routes and URL rewriting,
      link order in `RenderInput.stylesheets`, page callbacks, inventory union,
      determinism, committed and derived Check behavior, Serve delivery, export
      and publication inclusion, watch classification, Changes attribution and
      the one-time jump, the `file` loader error, the `.css` `empty` opt-out,
      and every error message class with its guidance.
- [ ] Register the new contract in `docs/protocol/README.md`.
- [ ] Update `docs/protocol/mokly-configuration.md`: package-owned `.css`
      handling in `moduleResolution.loaders`, the reserved directory rejection
      for entry globs, `stylesheets` paths, `publicExclude`, and `review.outDir`.
- [ ] Update `docs/protocol/mokly-rendering.md`: stylesheet link order and the
      reserved directory entries in the Generated Contract list.
- [ ] Update `docs/protocol/mokly-source-protection.md` for the reserved
      directory and the union inventory, and `docs/protocol/mokly-watch.md` for
      stylesheet-pass inputs as rebuild inputs.
- [ ] Update `docs/protocol/mokly-on-demand.md`, `mokly-export.md`,
      `mokly-publication.md`, and `mokly-derived-baselines.md` for reserved
      routes served from the live compilation, binary generated bytes in
      derived captures, and the directory `.gitignore` rule.
- [ ] Update `docs/protocol/mokly-css-attribution.md` to state that generated
      stylesheets are in analysis scope and how their source files relate.
- [ ] Update `docs/architecture/build-pipeline.md` and
      `docs/architecture/package-boundary.md` for the second pass, binary
      outputs, and the new ownership row.
- [ ] Add `docs/guides/authoring/styles.md` (section `authoring`, order 10)
      covering plain CSS imports, CSS Modules, assets, runtime CSS-in-JS through
      the renderer including the `mainFields` note for styled-components in
      `"type": "module"` repositories, and the unsupported list. Update
      `docs/guides/authoring/config.md` where it describes `stylesheets`.
- [ ] Update `src/build/README.md` and the README's Authoring and Key code
      sections.
- [ ] Run `npx prettier --check` on every changed Markdown file and review the
      diff for internal consistency across the protocol set.

## Milestone 2: Binary-safe generated outputs

A refactor with no behavior change that lets later milestones emit fonts and
images as generated files.

- [ ] Change `Compilation.outputs` in `src/build/compile.ts` to map routes to
      `string | Uint8Array` behind one typed `GeneratedFile` helper for reads,
      byte comparison, and byte length.
- [ ] Update `src/build/transaction.ts`, `src/build/check.ts`,
      `src/build/tracked_output.ts`, `src/build/component_runtime.ts`,
      `src/cli/run.ts`, `src/export/run.ts`, `src/export/inputs.ts`,
      `src/review/compilation_assets.ts`, `src/review/head_assets.ts`,
      `src/review/screen_compare.ts`, and `src/review/component_compare.ts` to
      read and compare bytes instead of assuming UTF-8 text.
- [ ] Add `tests/build_binary_outputs.test.ts` proving a synthetic binary
      output is written, checked, staged, rolled back, captured for derived
      export, and served without corruption.
- [ ] Run the build, relevant tests, and `cargo xtask check`.

## Milestone 3: Reserved generated directory

Establish `mokly-generated/` as package-owned output before anything writes to
it.

- [ ] Add `src/build/styles/routes.ts` with the reserved directory constant,
      the stylesheet and asset route derivations, and portable-segment
      validation with the documented error text.
- [ ] Reject the reserved directory in `src/config/rules.ts` for `stylesheets`
      paths, in entry glob, `publicExclude`, and `review.outDir` validation,
      and in `src/build/output_paths.ts` for inventoried sources inside it.
- [ ] Extend `src/build/ownership.ts` so `generatedOwnershipDenial`,
      `pendingGeneratedOrphanRoutes`, and `unclaimedGeneratedRoutes` treat every
      regular file inside the reserved directory as owned generated output.
- [ ] Extend derived Check in `src/build/tracked_output.ts` to add the
      directory rule to its `.gitignore` guidance when a tracked file is inside
      the reserved directory.
- [ ] Add `tests/build_generated_directory.test.ts` covering each validation
      rejection, orphan cleanup on Build, committed Check orphan reporting,
      derived Check rejection with the directory rule, and that consumer public
      files elsewhere under `mockupsDir` are untouched.
- [ ] Run the build, relevant tests, and `cargo xtask check`.

## Milestone 4: Collect and bundle imported CSS

Produce deterministic per-root stylesheets and assets inside the compilation.

- [ ] Add `src/build/styles/collect.ts`: an esbuild plugin for the graph pass
      that loads plain `.css` as an empty side-effect module, transforms
      `*.module.css` with Lightning CSS into a class map plus retained CSS,
      records every stylesheet input, rejects cross-file `composes`, and fails
      on `file` loader outputs with the documented guidance. Honor a consumer
      `.css` `empty` loader as the opt-out.
- [ ] Add `src/build/styles/order.ts`: derive each root's first-reachability
      depth-first stylesheet order from the graph metafile in
      `src/build/load_graph.ts`, keyed by the renderer path and each entry
      module.
- [ ] Add `src/build/styles/bundle.ts`: the second esbuild pass over synthetic
      per-root entries with the same resolution settings and Mokly plugins,
      `write: false`, `metafile: true`, the `file` loader for asset extensions
      with path-mirroring asset names under the reserved directory, relative
      URL rewriting, and source-path comment stripping. Skip the pass entirely
      when no root reaches CSS.
- [ ] Union the stylesheet pass inputs into `sourceFiles` through
      `src/build/source_inventory.ts` and expose the per-root stylesheet and
      asset outputs on `LoadedGraph` for `compileCatalogue`.
- [ ] Add `tests/build_imported_styles.test.ts` covering: a plain import
      produces the root stylesheet; two entries importing different CSS get
      separate files; shared CSS appears in both; the renderer's CSS gets its
      own file; the documented order rules including a repeated `@import`;
      CSS Modules names are stable when an unrelated module with the same
      basename is added and identical across two compilations; the class map
      matches the emitted rule; the opt-out loader; the `file` loader error;
      and unchanged behavior for a catalogue without CSS.
- [ ] Add `tests/build_imported_styles_assets.test.ts` covering font and image
      `url()` copies, one copy for a shared asset, relative URL rewriting, a
      missing asset error, a non-portable route error, and inventory membership
      of `@import`ed files and assets.
- [ ] Run the build, relevant tests, and `cargo xtask check`.

## Milestone 5: Link generated stylesheets into every view

Make the delivered CSS reach rendered documents and pass validation.

- [ ] Add `src/build/styles/links.ts` and extend `stylesheetsFor` in
      `src/build/render.ts` to append the renderer and entry stylesheet links
      after the configured rule, resolved and encoded like configured links.
- [ ] Teach the public-file checks used by `stylesheetsFor` and the resource
      validators to accept pending generated routes from the current
      compilation, so Build validates links before files exist on disk.
- [ ] Extend `tests/build_imported_styles.test.ts` with the link order, link
      resolution from nested fragment routes and dark fragments, saved variant
      and component views receiving the same links, and page callbacks
      receiving none.
- [ ] Run `npm run example:build` and `npm run example:check` to confirm the
      example catalogue, which imports no CSS yet, is byte-identical.
- [ ] Run the build, relevant tests, and `cargo xtask check`.

## Milestone 6: Serve, watch, export, publication, and Changes

Carry the new outputs through every delivery path.

- [ ] Serve reserved-directory routes from the live compilation in
      `src/server/fragments.ts` and the controls preview path in
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

## Milestone 7: Example, guides, and smoke tests

Exercise the feature end to end in the tracked example.

- [ ] Add one component under `examples/basic/src/components` styled with a
      CSS Module and a plain stylesheet that references a small font or image,
      and use it from an existing entry so `npm run example:build` and
      `npm run example:check` cover generated stylesheets and assets.
- [ ] Verify the guide added in Milestone 1 matches the shipped behavior and
      that `tests/package.test.ts` includes it in the packaged guides.
- [ ] Smoke test: run `npm run dev`, open the styled screen in mobile and
      desktop views and both color schemes, edit the CSS Module while serving,
      confirm the reload and that Changes lists only the affected screen, then
      run an export and open the exported screen from disk.
- [ ] Run the complete `npm test`, `npm run typecheck`, `npm run lint`, and
      `cargo xtask check`.

## Milestone 8: Commit, push, and review

- [ ] Run `git add -A`, commit using Conventional Commits, and push the branch.
- [ ] Review the complete local diff against `origin/main` using
      `docs/implementation-review-prompt.md` after the push. Report findings
      with severity, context, impact, lettered options, and a recommendation;
      do not change the implementation.

## Post-merge follow-up (non-blocking)

- Watch the first derived comparison on a consumer catalogue that adopts this
  version and confirm the documented one-time jump settles on the next commit.

## Follow-up plans (not part of this change)

- PostCSS step driven by the consumer's PostCSS configuration, plugging into
  the per-file load hook from Milestone 4 and adding reported dependencies to
  the inventory.
- `define` support for `import.meta.env` style constants.
- Page render input carrying resolved stylesheet links.
- Rebuilding only the stylesheet pass when only CSS inputs changed.
- Optional `@mokly/vite` compatibility package that runs Vite's plugin
  container as the transform stage while esbuild keeps bundling.
- Ownership inference and bundle mapping listed under
  [CSS Change Attribution](./css-change-attribution.md).
