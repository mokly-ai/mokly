# Imported CSS Delivery Review

## Scope And Outcome

The final review for [Imported CSS Delivery](../../plans/imported-css-delivery.md)
ran on 2026-09-25 after `f5adc76` was pushed. It used
[the implementation review prompt](../implementation-review-prompt.md) to review
the complete committed diff against `origin/main` (merge base `d4228f9`). Four
independent read-only reviewers covered the CSS pipeline, configuration and
PostCSS, output safety and delivery, and documentation. The parent session
checked Changes attribution with its own fixture. Every finding below was
reproduced in a scratch copy unless noted otherwise.

An earlier supervision review of `6676894` found 10 High or Medium and
15 Low defects. Milestones 8A and 8B fixed all of them, and this review confirmed
those fixes. The findings below are new. The implementation has not changed in
response to them; they await the user's decision.

## Findings

1. **High — watched Serve slows to minutes with large PostCSS inventories.**
   Tailwind reports every scanned file as a dependency, so each one joins
   `sourceFiles` and becomes a watch target. `isRequiredWatchPath` in
   `src/server/watch_paths.ts` rebuilds and scans that whole list for every
   path chokidar checks, so the cost is quadratic. Measured watcher readiness:
   12.5 s at 1,000 files, 51 s at 2,000, 172 s at 4,000. Adding one file
   rebuilds the watcher and loads the graph twice more. Recommended: cache the
   required paths and their ancestors once per config, stop adding
   individually covered files as watch targets, and add a scale test.
2. **Medium — exported and published catalogues over-report Changes in
   derived mode.** `src/export/run.ts` passes Git's changed paths to
   `changedContentPaths` instead of the merged imported-CSS evidence. Ignored
   generated stylesheets then take the byte-comparison fallback, which marks
   every view linking them as changed without rule analysis. Live Serve and the
   export's own comparison data are correct. Recommended: one constructor for
   the merged evidence, with its own type, shared by live Changes,
   `compareReview` and export. Add export and publish tests that match live
   Changes.
3. **Medium — merging `origin/main` needs two manual repairs.** Main's #115
   changed the link-rewriting regex in `scripts/preview/catalogue.mjs`, which
   this branch moved to `scripts/preview/capture.mjs`. Keeping the branch file
   silently drops main's fix. Main's new test in
   `tests/design_appearance_variants.test.ts` also auto-merges, but it fails
   type-checking against the widened `GeneratedFile` outputs. Recommended:
   merge now, port the regex to `capture.mjs`, and read the test's outputs with
   `textOutput()`.
4. **Medium — `image-set(url(...))` breaks inside CSS Modules.** Lightning CSS
   rewrites it to quoted strings (`image-set("./a.png" 1x)`) after Mokly's
   string check has already run. Build then fails with a misleading missing
   target, and on-demand Serve fails every view. Recommended: restore `url()`
   after Lightning, or use its dependency analysis, and re-run the string guard
   on Lightning's output.
5. **Medium — a crashed PostCSS worker hangs Build and Serve.**
   `src/build/styles/isolated_postcss.ts` rejects only in-flight requests, and
   only on a non-zero exit. A plugin that throws later or calls
   `process.exit(0)` leaves later requests waiting forever, including watched
   Serve's serial queue and its shutdown. Recommended: a small reusable worker
   request helper that fails permanently on any unexpected exit or error. Test
   crash, exit 0, late exception and calls made after the worker has died.
6. **Medium — explicit PostCSS dependencies under `dist`, `target`,
   `coverage` and similar are dropped.** `ignoredDependencyPath` treats denied
   folder names like `node_modules`. An `@reference` or `@plugin` file under
   `dist/` changes the output but is neither inventoried nor watched, which
   contradicts the contract. Recommended: one shared exact-required-input rule
   in `package_owned_paths.ts`, used by PostCSS, watch and freshness, with a
   test for each denied name.
7. **Medium — a symlinked repository root drops PostCSS dependencies and skips
   guards.** Plugins report real paths, but the checks compare them with the
   configured symlink path. Reported files go missing from the inventory. The
   generated-output and public-file guards and the renderer's nested-import
   check stop firing. Recommended: one helper that maps reported real paths
   back to configured-root paths, used by esbuild metafiles, PostCSS reports
   and watch events, with symlinked-root tests.
8. **Low — an `@import` at end of file without a semicolon bypasses renderer
   pruning.** `ruleEnd` in `prelude.ts` finds no end at end of file, so the
   renderer's CSS reappears in entry stylesheets. Recommended: treat end of
   file as the end of the rule, and cross-check the scanner against esbuild's
   import edges.
9. **Low — the `image-set()` string rule is too broad and undocumented for
   public CSS.** It rejects quoted `data:` and `https:` URLs, and it breaks
   authored public stylesheets that built before this branch. Recommended:
   reject only quoted local URLs, and document the rule in the Config and
   Styles guides and in the pull request.
10. **Low — assets in workspace packages linked through `node_modules` are not
    inventoried.** `bundle.ts` and `transformer_inventory.ts` check the link
    path, not the real path. Recommended: one shared "package code" predicate.
11. **Low — the virtual `mokly:styles:N` name still leaks for extensionless
    specifiers or `require()` of CSS outside `repoRoot`.** Recommended: check
    each root's CSS against `repoRoot` after the graph build. Never print
    virtual module names.
12. **Low — committed-mode Changes reloads the consumer graph on every
    classification.** The reload runs PostCSS again, and it can race a newer
    edit, leaving Changes unavailable until the next build. Recommended: pass
    one accepted-generation input (routes, outputs, delivered sources) through
    `readCatalogueChanges`.
13. **Low — collecting large PostCSS dependency lists is slow.** It takes 3.4 s
    against Tailwind's 251 ms at 20,000 files, because of repeated sorting and
    path resolution. Recommended: compute each relative path once and resolve
    fixed roots once, with a timed test using Tailwind's report shape.
14. **Low — dependency diagnostics are ordered differently from the
    contract.** A missing file is reported before a public-mockups file.
    Recommended: run the public-file pass first, and test both failures
    together.
15. **Low — `src/review/README.md` describes the shared-impact rule per
    stylesheet, but the code uses one global flag.** Rendering is unaffected.
    Recommended: align the README and pin the rule with a test.
16. **Low — the packaged Styles guide contains repository-only material.** It
    mentions the example component, `BROWSERSLIST_IGNORE_OLD_DATA` and the
    internal `encodeUrlPath`. It also says the failure applies to linked
    public files, when any public file under `mockupsDir` triggers it.
    Recommended: fix the text, and add a guide test that rejects repository
    paths.
17. **Low — small protocol drift.** Two claims in `mokly-configuration.md` are
    outdated: plugin forms and loader values. The status sentence in
    `mokly-imported-styles.md` will go stale at merge. `mokly-rendering.md`
    still says "approved target", and the Lightning CSS scope in
    `dependency-security.md` and `npm-release.md` is outdated.
    `mokly-source-protection.md` has a garbled sentence. Recommended: fix each
    one, and link to the PostCSS protocol instead of restating it.
18. **Low — the plan ticks a test change that was never made.** Milestone 7
    names `tests/catalogue_export.test.ts`; the coverage lives in
    `tests/export_imported_styles.test.ts` and
    `tests/publication_imported_styles.test.ts`. Recommended: correct the
    TODO.
19. **Low — files grew past the length guidelines.** Code:
    `src/server/http.ts` (334 lines) and `src/server/serve_watched.ts` (303).
    Protocol docs: `mokly-imported-styles.md` (280, against the plan's 250)
    and several existing protocol docs. Recommended: split them, and add a
    length check for TypeScript and protocol Markdown like the Rust lint.
20. **Low — no packed-install test covers imported CSS or PostCSS.** The
    package check does not require `dist/build/styles/postcss_worker.js`, which
    is loaded by URL at runtime. Recommended: a packed consumer with a CSS
    Module, a `url()` asset and a local PostCSS plugin.
