# Imported CSS Delivery Milestone 37 Review

## Scope And Outcome

This review covers [Imported CSS Delivery](../../plans/imported-css-delivery.md)
Milestone 37: the merge of `origin/main` at `0c8245f8` into the branch
(`d72abaeb`, with bookkeeping in `13218eb3`). It ran on 2026-09-30 after the
push, using [the implementation review prompt](../implementation-review-prompt.md)
against `origin/main`. Two read-only reviewers read commits only. One covered
runtime integration; the other covered documentation, tests and tooling.
Findings that remain open in earlier records are not repeated. The user's
decisions to keep `main`'s v7-only manifest reader and to leave `main`'s
Appearance-switching bug unchanged are not findings.

The runtime integration works:

- **Comparison panes.** Aligned comparison panes render imported CSS, CSS
  Modules and `url()` assets on both sides. This holds in watched and
  unwatched Serve and in static export, in committed and derived mode,
  including scoped package assets and a changed asset with non-UTF-8 bytes.
- **Links and routes.** Stylesheet links from `screens/`, `components/` and
  `pages/` view paths resolve in Build, Serve, export and publication.
  Generated routes cannot collide with v7 derived routes.
- **Publishing.** Delta publishing hashes and uploads generated stylesheets
  and binary assets as exact bytes in both output modes. A scratch test
  covered the current copy and both snapshot sides.
- **Example.** The example stays reachable through `navPath` and `folder()`,
  and its CSS and images serve byte-exact.
- **Tests.** No test was lost. All 2,587 of `main`'s test titles are present
  and none has fewer assertions. Changes to them are mechanical `textOutput`
  and `asChangeEvidence` adaptations. `git diff --diff-filter=D origin/main`
  is empty.
- **CI and gate.** The full gate and PR #125's CI passed.

The documentation merge has defects. Most come from one cause: the branch
had split several long protocol pages before the merge, and the merge kept
those old child pages beside `main`'s rewritten ones. The parent session's
preservation check counted a line as kept if its text appeared anywhere in
the tree. Old copies therefore satisfied it, and the check let the
duplicates through. The parent session confirmed findings 1, 2, 4 and 9. All
thirteen remain open for the user's decision.

## Findings

1. **High — old copies of split protocol pages contradict `main`'s current
   pages.**
   - What happens: the merge moved `main`'s current text into new child pages,
     such as `mokly-changes-serving.md`, `mokly-css-attribution-membership.md`,
     `mokly-watch-runtime.md` and three `*-mainline-*` pages. It also kept 11
     old branch child pages, about 1,630 lines. Neither side had pages that
     share five or more sentences; the merged tree has 17 such pairs.
   - Contradictions include:
     - `mokly-changes-engine.md` describes review results as "versions 2/3/4
       and current version 5" with `schemaVersion: 2`, while
       `mokly-changes-serving.md` requires `schemaVersion: 4` only.
     - `mokly-export-boundary.md` requires the "public v1 schema" for the
       ownership marker, while `main` requires schema 2.
     - `mokly-source-inventory.md` describes manifest v5 and v2/v3 readers,
       contrary to the v7-only reader. It is also the only page describing
       how imported CSS, assets and PostCSS dependencies enter `sourceFiles`.
     - The old publication page says an invalid historical manifest aborts
       publication; `main`'s page says Changes becomes unavailable.
     - Other old pages mention v2/v3 CSS attribution results, collection
       keys, id redirects and outdated CI counts.
   - Seven links on `main`'s pages were pointed at old pages. Eight child pages
     are not linked from their parent. Page names and the index use the
     integration term "mainline", and `tests/protocol_split_links.test.ts`
     requires the old pages to stay indexed.
   - Impact: `docs/protocol` ships in the npm package, and independent upload
     receivers implement from it. They would find two opposite
     specifications for the same formats.
   - Options: A) treat `main`'s pages as current: port the few branch-only
     rules (findings 3 and 4), delete the 11 old pages, re-point the links,
     rename the `*-mainline-*` pages, fold or link the generated-rendering
     page, and update the index and test; B) mark the old pages superseded
     and remove them from the index, although they would still ship; C)
     update every old page to the current formats, which keeps two copies of
     everything.
   - Recommended: A, plus guards: every continuation page must be linked from
     its parent, duplicate titles and large sentence overlap fail a test, the
     outdated-version check covers every protocol page, and merge audits
     compare each passage with its own file rather than the whole tree.
   - Resolved in `c260b5b2`: Ported current rules, removed the eleven obsolete branch-only pages, renamed the three current pages, reconciled rendering ownership and links, and added continuation, title and overlap guards. The ignored crosswalk records every old-page sentence.
2. **Medium — preview capture overrides `main`'s shared HTML-path
   normalizer.**
   - What happens: `main` moved preview capture onto
     `normalizeProviderHtmlAttributes`, which rewrites only canonical view URLs
     and confined static paths. `scripts/preview/capture.mjs` now uses the
     branch's older hand-written regex instead. The preservation note saying
     the normalizer "moved" is wrong: `artifact.mjs` already had its own call.
   - Reproduction: the merged capture strips `.html` from
     `/view/constructor/home.html`, `/static/../secret.html` and encoded
     traversal paths, which `main` leaves unchanged and `main`'s helper test
     requires. Today's shells emit only safe URLs, so output is identical now.
   - Impact: this silently overrides `main`'s code, against `AGENTS.md`, and
     brings back duplicate logic that `main` removed.
   - Options: A) restore `main`'s call in `staticPage` and test the capture
     output with `main`'s rejected-input table; B) drop normalization from
     `staticPage` and rely on `artifact.mjs`; C) also forbid hand-written
     `.html`-stripping regexes outside the shared helper.
   - Recommended: A.
   - Resolved in `c260b5b2`: Capture again uses the shared HTML-path normalizer; output tests retain rejected paths and normalize canonical links.
3. **Medium — the current comparison contract misstates protocol-relative CSS
   URLs.**
   - What happens: `mokly-changes-serving.md` and `mokly-removed-previews.md`
     say protocol-relative URLs fail comparison. The code treats a CSS `//`
     URL as external and rejects only an HTML `//` URL. The branch's correct
     sentence survives only in the old engine page from finding 1, so deleting
     that page would erase it.
   - Options: A) port the branch sentences into the current pages, ideally as
     one shared URL-classification section linked from Changes, removed
     previews, export and imported styles; B) change the code, breaking
     shipped behaviour and tests.
   - Recommended: A.
   - Resolved in `c260b5b2`: Comparison resource URL classification now has one owner: CSS `//` URLs stay external, while HTML `//` links fail comparison.
4. **Medium — branch-only edits were reverted where `main` had not touched the
   paragraph.**
   - What happens: where only the branch had changed a paragraph, the merge
     kept the old text:
     - `mokly-watch.md` lost the rules from two earlier Medium fixes: the
       constant-time index of required files, watch targets below skipped
       folders, when the watcher is replaced, and never watching the escaped
       target of a symlinked resource. They now appear only in
       `src/server/README.md`.
     - `mokly-configuration.md` again says any supported esbuild loader name
       is allowed, contradicting the imported-styles page, which rejects
       `css` loaders. A pointer also splits `main`'s `legacy` paragraph.
     - `mokly-css-attribution.md` lost two clauses: evidence may not use the
       Git-only authored path list, and a newer edit cannot add a route to an
       older generation's evidence.
   - Impact: the shipped spec is silent on behaviour that code and tests
     enforce, and two configuration pages contradict each other.
   - Options: A) restore the sentences and move the pointer; B) rely on the
     README.
   - Recommended: A, plus a three-way merge check: where only one side changed
     a passage, the merged text keeps that side's version or records why not.
   - Resolved in `c260b5b2`: Restored watch, loader and CSS-evidence rules, kept main's legacy paragraph whole, and added a per-path one-sided merge-preservation check with documented moves.
5. **Low — the merge brought back documentation drift that the branch had
   fixed.** Two pages say "five" clean consumer smokes where six run, and
   `xtask/README.md` says `consumer_cases` owns five. `npm-release.md` again
   says xtask "delegates to npm scripts" and omits the repository-wide length
   audit. Options: A) count-free wording and restore the two sentences; B)
   replace "five" with "six". Recommended: A, plus a test tying the documented
   scenarios to `package-smoke.mjs`.
   - Resolved in `c260b5b2`: Replaced fixed smoke counts with count-free wording and restored xtask and repository length-audit wording. This documentation-only correction has no new test, as requested.
6. **Low — two of `main`'s wording changes were overwritten.** `README.md`
   says "saved variants" where `main` had changed the row to "variants", and
   `docs/reviews/consumer-export-integration.md` rewrites a sentence in
   `main`'s historical review and drops a valid link. Recommended: restore
   `main`'s text.
   - Resolved in `c260b5b2`: Restored main's “variants” concept row and its historical review sentence and link.
7. **Low — the merge-aware ratchet change alters `main`'s tooling and fails
   during other merges.** `scripts/verification/ratchets/git.mjs` now compares
   against `MERGE_HEAD` during an uncommitted merge. Normal runs are
   unchanged, and it is documented and tested for a merge of `main`. But it
   changes a `main`-owned file without approval. During a merge of any other
   branch, or when a local `main` is ahead of `origin/main`, it fails with
   "origin/main moved during the merge". Options: A) use `MERGE_HEAD` only
   when it equals `origin/main`, fail only when `main` really moved, fall back
   otherwise, and test each case; B) revert to `main`'s version and run the
   ratchets after committing. Recommended: A if the user approves changing
   `main`'s tooling, otherwise B.
   - Resolved in `c260b5b2`: Merge mode uses `MERGE_HEAD` only for the target main tip, reports a moved target, and otherwise uses the normal merge base; fixture tests cover all five cases.
8. **Low — the branch's length audit blocks `main`'s workflow for over-length
   protocol pages.** `main` lets a capped page over 250 lines be edited if its
   cap is lowered. The branch's source-length audit fails any changed
   protocol page over 250 lines, so any edit to `main`'s 12 capped pages fails
   the gate. Options: A) make the audit respect `main`'s caps through one
   shared length-policy module; B) keep the strict rule and remove `main`'s
   documented workflow. Recommended: A.
   - Resolved in `c260b5b2`: A shared length policy honors exact, shrinking protocol caps while keeping uncapped pages at 250 lines and changed TypeScript/JavaScript at 300.
9. **Low — the imported-styles pages were not updated for the merge.** The
   error catalogue still lists "route must not start with mokly-generated/…",
   whose check the merge removed, and an example uses the pre-v7 path
   `app/home.mobile.html`. Recommended: remove the row, update the example,
   and add a test that every catalogued message exists in `src`.
   - Resolved in `c260b5b2`: Removed the stale diagnostic, corrected the v7 view path, and added a source-message catalogue guard.
10. **Low — a `main` test helper no longer fails on a missing fixture.**
    `tests/helpers/component_review_fixture.ts` used to throw
    `Missing fixture: <route>` and now returns `undefined` through
    `textOutput(...)!`. Recommended: use `generatedText(read(route), route)`,
    which keeps both the missing-file error and the binary guard.
    - Resolved in `c260b5b2`: The fixture reads through `generatedText`, preserving both failures; focused tests cover them.
11. **Low — `scripts/preview/inputs.d.mts` imports `ManifestV5`, which `main`
    removed.** `skipLibCheck` hides the error and turns the type into `any`.
    Options: A) import `ManifestV7`; B) also type-check hand-written script
    declarations without `skipLibCheck`. Recommended: A plus B.
    - Resolved in `c260b5b2`: Declarations use `ManifestV7` and the regular typecheck runs a strict script-declaration project.
12. **Low — one rewritten test no longer tests anything.**
    `tests/config_generated_directory.test.ts` replaces a fixture route string
    that the v7 fixture no longer contains, so its assertion is trivially
    true. Other tests cover the real guard. Options: A) assert that derived
    view and page routes never land under `mokly-generated/` and that the
    output-path check rejects HTML there; B) delete the no-op part.
    Recommended: A.
    - Resolved in `c260b5b2`: Replaced the inert assertion with derived-route and reserved-output validation tests; removing the guard makes the test fail.
13. **Low — no test covers derived-mode publishing of generated binary assets
    through the upload receiver, or assets on the comparison snapshot
    sides.** The receiver test is committed-mode only and checks only the
    current side. A scratch test covering both modes and both sides passes.
    Options: A) adopt the scratch test; B) parametrize the existing receiver
    test by output mode. Recommended: A.
    - Resolved in `c260b5b2`: A regular upload-receiver test checks committed and derived modes, including current and both snapshot copies of invalid-UTF-8 binary assets.
