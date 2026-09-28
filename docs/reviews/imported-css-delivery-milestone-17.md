# Imported CSS Delivery Milestone 17 Review

## Scope And Outcome

This review covers [Imported CSS Delivery](../../plans/imported-css-delivery.md)
Milestone 17. It ran on 2026-09-27 after `8f1166c` was pushed, using
[the implementation review prompt](../implementation-review-prompt.md) against
`origin/main`. Two read-only reviewers examined the changes since `d98d85d`:
`7b454b0` (Milestone 15) and `0ce4f20` (Milestone 16), which fixed 14 findings
from the [main review record](./imported-css-delivery.md) and the
[Milestone 14 review record](./imported-css-delivery-milestone-14.md), plus the
`8f1166c` bookkeeping. They also looked for defects the fixes introduced
elsewhere. Findings that remain open by the user's choice (M12-4, M12-6, M12-7
and M14-1) are not repeated.

Each of the 14 fixes works for the case it targeted:

- Builds produce byte-identical output, and `graph.load` on the example fell by
  about 216 ms (20 %) between `d98d85d` and `8f1166c`.
- Diagnostics follow the documented order and no longer show virtual module
  names.
- `cargo xtask source-file-length-lint` passes from the repository root and
  from `xtask/`.
- The committed-mode Git check handles nested `.gitignore` files,
  `.git/info/exclude`, existing negations, tracked files and a symlinked
  repository root.
- release-please 17 parses the reconstructed squash message as a breaking
  `feat!` change.

The 15 findings below were each reproduced in a scratch copy. The parent session
independently confirmed finding 2. Finding 2 was resolved in `3aa7d67`, and
findings 3, 8 and 9 no longer apply after that change. The other findings
remain open for the user's decision.

## Findings

1. **Medium — suggested `.gitignore` lines do not work when a directory rule
   matches.**
   - What happens: Git cannot re-include a file whose parent directory is
     ignored, and `git check-ignore -v` names the parent's rule without saying
     it matched a parent.
   - Reproductions:
     - A repository that followed the derived-mode advice to ignore
       `/mockups/mokly-generated/` and then switched to committed mode is told
       to add `!/mockups/mokly-generated/**`. After adding it, Build fails with
       the same message, because `!/mockups/mokly-generated/` is also needed.
     - An `app/` rule gets per-file lines that cannot work.
     - A `/mockups/` rule added after output was committed escapes the
       ignored-mockups-directory check, because tracked content hides the
       directory from `check-ignore`.
   - Impact: the printed and documented fix loops on the most likely migration
     path, derived to committed.
   - Options: A) check each directory between `mockupsDir` and every route with
     `--no-index`, and suggest negating the highest ignored directory itself
     (`!/<dir>/` and `!/<dir>/**`); B) always suggest both reserved-directory
     lines; C) print guidance instead of lines.
   - Recommended: A, plus a test helper that applies every suggested line and
     asserts that Build then succeeds, so new rule shapes cannot regress.
2. **Medium — browser targets make Lightning CSS rewrite modern CSS in CSS
   Modules into approximations that render wrongly in current browsers.**
   - What happens: since `7b454b0`, every CSS Module gets Browserslist or
     default targets, and Lightning CSS polyfills features those targets lack:
     - `inset-inline-start` and `:dir(rtl)` become `:lang(...)` lists, so a
       `dir="rtl"` page without a matching `lang` lays out as left-to-right.
     - `light-dark(red, blue)` becomes a custom-property polyfill that is
       transparent unless the same module declares `color-scheme`.

     Chrome 153 rendered plain and module copies of the same rules
     differently. Before `7b454b0` these rules passed through unchanged.

   - Root cause: this is the fourth defect caused by Lightning CSS re-printing
     module CSS. The first three are Milestone 12 finding 1 (deleted
     `@import`s), the `image-set()` string rewrite, and Milestone 14 finding 2
     (lost fallbacks). No Lightning CSS configuration preserves authored CSS:
     without targets it drops fallbacks, and with targets it polyfills.
   - Impact: renaming a file to `.module.css` silently changes rendering,
     including right-to-left layouts and `light-dark()` theming in Mokly's own
     light and dark views.
   - Options:
     - A) Keep targets but exclude the `DirSelector` and `LightDark`
       transforms. Logical properties then still become `:dir()` rules, and
       excluding `LogicalProperties` instead loses the Safari 14 longhand
       fallback.
     - B) Scope CSS Modules without re-printing the CSS: rename classes, IDs
       and keyframes in the authored text, for example with the PostCSS CSS
       Modules plugins that css-loader and Vite use. Plain and module CSS then
       differ only in names. The Browserslist target machinery and the
       `image-set()` restorer go away, and findings 3, 8 and 9 become moot.
       This adds small dependencies, a dependency-policy decision.
     - C) Document the rewriting.
   - Recommended: B, with a real-browser test comparing computed styles for
     plain and module copies across logical properties, `:dir()`,
     `light-dark()`, nesting, colours and fallbacks. A direct fix (A) leaves
     the source of four defects in place.

   Resolved in `3aa7d67`: rename-only PostCSS CSS Modules plugins preserve
   authored CSS; exact-byte and Chrome computed-style parity tests cover it.

3. **Medium — CSS Modules inside `node_modules` miss the fixed default
   targets.** `hasBrowserslistConfig` treats the installed
   `node_modules/browserslist` package directory as a `browserslist` config
   file. Browserslist then falls back to its own `defaults` query (Safari
   26.5, iOS 18.5, Firefox 140 with the installed data), and a design-system
   package's module loses `-webkit-backdrop-filter` and the `100vh` fallback.
   - Impact: Milestone 14 finding 2 persists for packages, and output depends on
     the installed browser data.
   - Options: A) accept only regular `browserslist` and `.browserslistrc`
     files, as Browserslist does, and test package and workspace modules;
     B) use Browserslist's own lookup, bounded by `repoRoot`.
   - Recommended: A now; moot if finding 2 takes option B.

   No longer applies after `3aa7d67`: module delivery has no Browserslist
   lookup or browser targets, including for package stylesheets.

4. **Low — a global Git excludes file named `.gitignore` gets wrong advice.**
   Any source ending in `.gitignore` is treated as a repository file, so
   `~/.gitignore` produces a path outside the repository that varies with the
   working directory. No test covers the `info/exclude` or global-excludes
   mapping. Recommended: treat only in-repository relative paths named
   `.gitignore` as per-directory files, map everything else to the root
   `.gitignore`, and test both with a temporary `HOME`.
5. **Low — a symlinked `mockupsDir` breaks committed Build.** Git fails with
   "pathspec … is beyond a symbolic link", which is rethrown raw. This layout
   is supported, but its fixtures sit under the ignored `.context/` directory,
   so the check never runs in tests. Recommended: check the real
   repository-relative paths, add a fixture with its own Git repository, and
   give other Git failures in this check a catalogued message.
6. **Low — the Git ignore check scales with routes times tracked files.**
   Without `--no-index`, `check-ignore --stdin` consults the index for every
   path on each committed Build, Check, export and watched rebuild:
   0.45 s at 10,000 tracked files and 4,800 routes, 7.7 s at 64,000 and
   10,000. Recommended: use `--no-index`, drop tracked files with one
   `git ls-files -z` call (which also closes the tracked-directory blind spot
   in finding 1), and add a timing budget test.
7. **Low — the M12-3 real-watcher tests pass without the fix.** They create the
   `dist` stylesheet before Serve starts, or accept any later reload. Reverting
   the fix leaves both green; only the unit tests fail. Recommended: add the
   import while Serve runs, let the rebuild settle, then assert a new rebuild
   report, the new CSS and a new watcher.
8. **Low — the plain-versus-module normalization hides target-driven
   differences.** The test runs both outputs through Lightning CSS with the
   module targets, so the plain side receives the same lossy rewrites. Added
   `:dir()`, `light-dark()` and `inset-inline-start` scenarios pass although
   Chrome renders them differently, and removing module targets also passes.
   Recommended: normalize without targets, and add the browser parity test from
   finding 2.

   No longer applies after `3aa7d67`: the test compares emitted stylesheets
   directly after removing only scoped-name prefixes; Chrome parity is pinned.

9. **Low — the Browserslist guidance contradicts itself.** The Styles guide says
   one `.browserslistrc` gives Mokly and autoprefixer the same targets, but its
   PostCSS sample still passes `overrideBrowserslist`, which makes autoprefixer
   ignore that file. Mokly's lookup also stops at `repoRoot`, so a monorepo root
   `browserslist` key reaches autoprefixer but not Mokly, and the docs do not
   say so. Recommended: fix the sample, document the boundary and
   `BROWSERSLIST_CONFIG`, and add a stale-text test. Moot if finding 2 takes
   option B.

   No longer applies after `3aa7d67`: Mokly does not read Browserslist for
   CSS Modules; the guide identifies autoprefixer as the only target consumer.

10. **Low — the breaking-change note misses real breaks compared with
    `origin/main`.** The `BREAKING CHANGE:` footer in `0ce4f20` becomes the next
    changelog's breaking section, and it was written from the branch's own
    history. Compared with `origin/main` it omits:
    - CSS Module class names change format (`card_card` becomes
      `mokly_<hash>_card`), so public CSS that targeted the old names stops
      matching.
    - Cross-file `composes` now fails Build.
    - Quoted local `image-set()` sources and a local `@import` after rules in
      imported CSS now fail Build.
    - Derived-mode repositories that import CSS must ignore
      `<mockupsDir>/mokly-generated/`.

    Its CSS Modules sentence compares with unreleased branch builds; on
    `origin/main`, CSS Module CSS was never delivered. The PR draft repeats
    these gaps, overstates an asset-failure change, and lists open issues only
    by internal ID.
    - Options: A) put a corrected full commit message in the PR body between
      `BEGIN_COMMIT_OVERRIDE` and `END_COMMIT_OVERRIDE`, which release-please 17
      reads instead of the squash text; B) edit the squash message in the merge
      dialog; C) add a follow-up footer (the misleading sentence stays).
    - Recommended: A, plus a PR-template or plan step that audits breaking
      changes against `origin/main`.

11. **Low — the Markdown link checker mishandles same-page links, HTML links,
    inline code and some anchors.** A link to a heading on the same page
    resolves to the folder `README.md` instead of the current file. `<a href>`
    links are never read. Link syntax inside inline code is checked as a real
    link; the checker failed on this record's own example until it was
    reworded. Anchors differ from GitHub for headings containing code spans, a
    leading symbol, or links. Recommended: fix in place with checker unit tests
    pinned to known GitHub anchors; a Markdown parser and `github-slugger` would
    need a dependency-policy decision.
12. **Low — the M12-5 speed-up is not protected, and the mapper still resolves
    real paths per input.** Re-adding all three removed costs raised
    `graph.load` from 888 to 1,090 ms while every new test passed, because the
    timing budgets are loose. Root validation has no budget test. Mapping keys
    back still re-resolves the working directory's real path for inputs outside
    it (2,298 of 2,453 example inputs). Unused per-call helpers remain
    exported, and `src/build/README.md` overstates the change. Recommended:
    count `realpath` calls with a mock instead of timing, use the cached real
    path when mapping back, delete the unused helpers and fix the README.
13. **Low — the length-gate tests leave two regressions uncaught.**
    - Reverting the working-directory fix in the standalone
      `source-file-length-lint` command leaves all xtask tests green, and the
      command is built in two places.
    - No test expects success, so a script that always fails passes, and the
      pass message counts every changed path rather than the files checked.

    Recommended: one shared command builder with a command type that cannot run
    without a working directory, an accurate count, and exit-0 test cases.

14. **Low — the virtual-name test does not check that import paths are shown
    relative.** With the new relative-path display disabled, errors show
    machine-specific absolute paths and the test still passes. Recommended:
    assert the exact message, and add a shared check that no CSS or PostCSS
    error contains the fixture root path or a virtual module name.
15. **Low — xtask test style.** `cli_tests.rs` uses an inline
    `crate::check::CheckRequest` path, and `command_tests.rs` has no module doc
    comment, both against `AGENTS.md`. Recommended: add the import and the doc
    comment.
