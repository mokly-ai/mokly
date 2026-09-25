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
those fixes. The user authorized fixes for findings 1, 2 and 4–20 as Milestones
10–11. A separate session merged `origin/main` as `922c1ec`, resolving finding 3
without including the uncommitted Milestone 10 work.

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

   Resolved in `b197b0c`: indexed required paths and covering watch roots reduced
   1,000/4,000-file readiness to 384 ms/1,483 ms; a 3,000-file addition rebuilt once.

2. **Medium — exported and published catalogues over-report Changes in
   derived mode.** `src/export/run.ts` passes Git's changed paths to
   `changedContentPaths` instead of the merged imported-CSS evidence. Ignored
   generated stylesheets then take the byte-comparison fallback, which marks
   every view linking them as changed without rule analysis. Live Serve and the
   export's own comparison data are correct. Recommended: one constructor for
   the merged evidence, with its own type, shared by live Changes,
   `compareReview` and export. Add export and publish tests that match live
   Changes.

   Resolved in `b197b0c`: typed merged evidence is shared by Review, export,
   publication and Changes, with both modes and all three edit classes tested.

3. **Medium — merging `origin/main` needs two manual repairs.** Main's #115
   changed the link-rewriting regex in `scripts/preview/catalogue.mjs`, which
   this branch moved to `scripts/preview/capture.mjs`. Keeping the branch file
   silently drops main's fix. Main's new test in
   `tests/design_appearance_variants.test.ts` also auto-merges, but it fails
   type-checking against the widened `GeneratedFile` outputs. Recommended:
   merge now, port the regex to `capture.mjs`, and read the test's outputs with
   `textOutput()`.

   Resolved by the separately requested merge `922c1ec`. The link rewrite in
   `scripts/preview/capture.mjs` retains `.html` before query/fragment suffixes,
   and the appearance test reads `GeneratedFile` text through `textOutput()`.

4. **Medium — `image-set(url(...))` breaks inside CSS Modules.** Lightning CSS
   rewrites it to quoted strings (`image-set("./a.png" 1x)`) after Mokly's
   string check has already run. Build then fails with a misleading missing
   target, and on-demand Serve fails every view. Recommended: restore `url()`
   after Lightning, or use its dependency analysis, and re-run the string guard
   on Lightning's output.

   Resolved in `b197b0c`: Lightning URL placeholders restore `url()` before
   esbuild, and transformed CSS is rechecked across six asset contexts.

5. **Medium — a crashed PostCSS worker hangs Build and Serve.**
   `src/build/styles/isolated_postcss.ts` rejects only in-flight requests, and
   only on a non-zero exit. A plugin that throws later or calls
   `process.exit(0)` leaves later requests waiting forever, including watched
   Serve's serial queue and its shutdown. Recommended: a small reusable worker
   request helper that fails permanently on any unexpected exit or error. Test
   crash, exit 0, late exception and calls made after the worker has died.

   Resolved in `b197b0c`: one request channel permanently rejects pending and
   future calls on worker error, messageerror or unexpected exit.

6. **Medium — explicit PostCSS dependencies under `dist`, `target`,
   `coverage` and similar are dropped.** `ignoredDependencyPath` treats denied
   folder names like `node_modules`. An `@reference` or `@plugin` file under
   `dist/` changes the output but is neither inventoried nor watched, which
   contradicts the contract. Recommended: one shared exact-required-input rule
   in `package_owned_paths.ts`, used by PostCSS, watch and freshness, with a
   test for each denied name.

   Resolved in `b197b0c`: explicit dependencies survive every denied-name
   directory while broad scans remain pruned and exact changes rebuild.

7. **Medium — a symlinked repository root drops PostCSS dependencies and skips
   guards.** Plugins report real paths, but the checks compare them with the
   configured symlink path. Reported files go missing from the inventory. The
   generated-output and public-file guards and the renderer's nested-import
   check stop firing. Recommended: one helper that maps reported real paths
   back to configured-root paths, used by esbuild metafiles, PostCSS reports
   and watch events, with symlinked-root tests.

   Resolved in `b197b0c`: physical reports/events map through the configured
   root; alias inventory, watch, generated/public guards and nested pruning pass.

8. **Low — an `@import` at end of file without a semicolon bypasses renderer
   pruning.** `ruleEnd` in `prelude.ts` finds no end at end of file, so the
   renderer's CSS reappears in entry stylesheets. Recommended: treat end of
   file as the end of the rule, and cross-check the scanner against esbuild's
   import edges.

   Resolved in `390a21a`: EOF imports now join the prelude and renderer closure;
   tokenizer cases are cross-checked with esbuild metafile edges.

9. **Low — the `image-set()` string rule is too broad and undocumented for
   public CSS.** It rejects quoted `data:` and `https:` URLs, and it breaks
   authored public stylesheets that built before this branch. Recommended:
   reject only quoted local URLs, and document the rule in the Config and
   Styles guides and in the pull request.

   Resolved in `390a21a`: quoted remote and data sources remain external; only
   local strings fail with `url()` guidance. This is a PR behavior change.

10. **Low — assets in workspace packages linked through `node_modules` are not
    inventoried.** `bundle.ts` and `transformer_inventory.ts` check the link
    path, not the real path. Recommended: one shared "package code" predicate.

    Resolved in `390a21a`: physical package identity keeps linked workspace
    CSS and images inventoried, watched and delivered under both aliases.

11. **Low — the virtual `mokly:styles:N` name still leaks for extensionless
    specifiers or `require()` of CSS outside `repoRoot`.** Recommended: check
    each root's CSS against `repoRoot` after the graph build. Never print
    virtual module names.

    Resolved in `390a21a`: graph metafile edges now name the authored importer
    and original specifier for extensionless, `require()` and dynamic CSS.

12. **Low — committed-mode Changes reloads the consumer graph on every
    classification.** The reload runs PostCSS again, and it can race a newer
    edit, leaving Changes unavailable until the next build. Recommended: pass
    one accepted-generation input (routes, outputs, delivered sources) through
    `readCatalogueChanges`.

    Resolved in `390a21a`: typed generation routes prevent committed PostCSS
    reloads and reject a newer entry racing an older accepted classification.

13. **Low — collecting large PostCSS dependency lists is slow.** It takes 3.4 s
    against Tailwind's 251 ms at 20,000 files, because of repeated sorting and
    path resolution. Recommended: compute each relative path once and resolve
    fixed roots once, with a timed test using Tailwind's report shape.

    Resolved in `390a21a`: cached roots and one sort reduced isolated 20,000-file
    collection from 3,430.5 ms to 1,436.1 ms in the measured fixture.

14. **Low — dependency diagnostics are ordered differently from the
    contract.** A missing file is reported before a public-mockups file.
    Recommended: run the public-file pass first, and test both failures
    together.

    Resolved in `390a21a`: public-file diagnostics precede regular-file checks,
    even when a missing dependency sorts first.

15. **Low — `src/review/README.md` describes the shared-impact rule per
    stylesheet, but the code uses one global flag.** Rendering is unaffected.
    Recommended: align the README and pin the rule with a test.

    Resolved in `390a21a`: the README and test state global stripping whenever
    any generated stylesheet bytes change.

16. **Low — the packaged Styles guide contains repository-only material.** It
    mentions the example component, `BROWSERSLIST_IGNORE_OLD_DATA` and the
    internal `encodeUrlPath`. It also says the failure applies to linked
    public files, when any public file under `mockupsDir` triggers it.
    Recommended: fix the text, and add a guide test that rejects repository
    paths.

    Resolved in `390a21a`: example-only guidance moved to the example README;
    packaged guide text uses product language and a copy-boundary test.

17. **Low — small protocol drift.** Two claims in `mokly-configuration.md` are
    outdated: plugin forms and loader values. The status sentence in
    `mokly-imported-styles.md` will go stale at merge. `mokly-rendering.md`
    still says "approved target", and the Lightning CSS scope in
    `dependency-security.md` and `npm-release.md` is outdated.
    `mokly-source-protection.md` has a garbled sentence. Recommended: fix each
    one, and link to the PostCSS protocol instead of restating it.

    Resolved in `390a21a`: plugin forms, loader rules, shipped status,
    Lightning CSS scope and source-inventory wording now agree with the code.

18. **Low — the plan ticks a test change that was never made.** Milestone 7
    names `tests/catalogue_export.test.ts`; the coverage lives in
    `tests/export_imported_styles.test.ts` and
    `tests/publication_imported_styles.test.ts`. Recommended: correct the
    TODO.

    Resolved in `390a21a`: Milestone 7 now names the actual export and
    publication test files.

19. **Low — files grew past the length guidelines.** Code:
    `src/server/http.ts` (334 lines) and `src/server/serve_watched.ts` (303).
    Protocol docs: `mokly-imported-styles.md` (280, against the plan's 250)
    and several existing protocol docs. Recommended: split them, and add a
    length check for TypeScript and protocol Markdown like the Rust lint.

    Resolved in `390a21a`: oversized modules, tests and protocol pages are
    split; `xtask` enforces changed-file limits and offers an `--all` audit.

20. **Low — no packed-install test covers imported CSS or PostCSS.** The
    package check does not require `dist/build/styles/postcss_worker.js`, which
    is loaded by URL at runtime. Recommended: a packed consumer with a CSS
    Module, a `url()` asset and a local PostCSS plugin.

    Resolved in `390a21a`: archive validation requires the worker and a sixth
    packed consumer builds and checks real CSS Module, PostCSS and binary URLs.

## Milestone 12 Review

The post-push review of `f154d3d` ran on 2026-09-25 with the same prompt
against `origin/main` (merge base `2ec4d83`). Three read-only reviewers
checked the Milestone 10 fixes, the Milestone 11 fixes, and the documentation
and length gate. They confirmed that fixes 2, 5, 6, 7, 12, 13, 15, 16, 18 and
20 are correct. The parent session checked, with its own fixture, derived
export Changes and CSS Module `image-set()`. The 16 findings below were each
reproduced in a scratch copy. They await the user's decision; the
implementation has not changed in response to them.

1. **High — CSS Modules drop `@import` rules and reject `url()` in custom
   properties.** The finding 4 fix enabled Lightning CSS
   `analyzeDependencies` in `src/build/styles/modules.ts`. That option removes
   every `@import` from module output, and Mokly never restores it. The option
   also fails on `--icon: url("./icon.svg")`, which built before the fix.
   Recommended: disable the option, turn quoted `image-set()` sources back into
   `url()` after Lightning, keep the second string check, and add a test that
   plain and module CSS deliver the same output.
2. **Medium — committed mode loses package assets to ordinary `.gitignore`
   rules.** Assets are mirrored under `mokly-generated/assets/node_modules/…`
   (or `dist/…`), which common ignore rules exclude. Fresh clones then fail
   Check, Changes over-reports, and Review throws. The bug predates Milestones
   10 and 11, and Milestone 11 widened it. Recommended: committed Build and
   Check fail when a generated route is ignored by Git, naming a negation rule,
   and a guide note documents it.
3. **Medium — required files under `dist`-like folders inside a watched root
   stop being watched when they appear during Serve.** Finding 1 removed
   covered files from the target list, and the watcher keeps its original
   skip list. Recommended: keep such files as explicit targets when a skipped
   segment lies between the root and the file, with real-watcher tests.
4. **Low — per-event watch classification still scans every source and
   recompiles directory globs** (13.9 ms per event at 20,000 sources).
   Recommended: use the per-generation index, compile globs once, and add a
   burst timing budget.
5. **Low — Milestone 11 adds about 220 ms per graph load.** Root validation
   and `isPackageCode` resolve real paths for every edge. Recommended: resolve
   only on failure, use one path mapper per metafile, and add a timed test.
6. **Low — the finding 8 scanner still disagrees with esbuild on malformed
   end-of-file imports.** Recommended: assert that the renderer's CSS closure
   equals esbuild's inputs, and fail with a "malformed @import" message
   otherwise.
7. **Low — changed assets in linked workspace packages attach shared-impact
   evidence to unrelated screens.** Recommended: an alias-aware map from
   source to asset route in the accepted generation.
8. **Low — a missing dependency directory is still reported before
   generated-output and public-file errors.** Recommended: defer it to the
   regular-file pass, and test all four diagnostics together.
9. **Low — virtual `mokly:styles:N` names still appear in other CSS-pass
   diagnostics.** Recommended: map virtual importers to their root in every
   diagnostic, and test that none contains the name.
10. **Low — the finding 9 pull request note describes the wrong change.**
    Compared with main, the breaking change is that quoted local `image-set()`
    sources in authored public CSS now fail Build. Public CSS `//` URLs are now
    accepted. Recommended: correct the note and prepare the pull request text
    or a `BREAKING CHANGE` footer.
11. **Low — the length gate fails when `cargo xtask` runs from a
    subdirectory.** Recommended: run every xtask subprocess from the workspace
    root, use one shared command builder, and add parse and dispatch tests.
12. **Low — the gate covers less than the documentation says.** It misses
    `packages/viewer/tests`, `packages/viewer/scripts`, `examples` and
    `.mts`/`.cts`. Recommended: cover all TypeScript and JavaScript files
    repository-wide, and document any exclusions.
13. **Low — the gate's test never covers committed branch changes, which is
    the path CI uses.** Recommended: add committed, staged-only, exact-limit
    and `--all` exit-code cases, plus one per directory and extension.
14. **Low — the protocol split broke one inbound link, and the stale-text
    tests miss continuation pages.** Recommended: fix the link, add a
    repository-wide link and anchor check, and group the stale-text tests by
    page family.
15. **Low — documentation drift.** The CI table omits the length audit, two
    documents say five packed consumers instead of six, `npm-release.md` says
    xtask only delegates to npm scripts and has an ambiguous "its", the
    Lightning CSS scope omits transformer inventory, and the Config guide says
    Mokly copies assets in authored public CSS. Recommended: fix each, and
    avoid hard-coded counts.
16. **Low — plan bookkeeping.** Milestone 9 is not marked complete, and a
    Milestone 11 TODO points at commit references that live in this record.
    Recommended: mark Milestone 9 complete and reword the TODO.
