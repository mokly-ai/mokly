# CSS differential test uses a fragile stylesheet list

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  finding 1 of the final review of `rebuild/port-111c` at `b152d0dc`.
- **Location:** `crates/mokly-css/src/_tests_/token_differential_tests.rs:187-200`
  and the fixture lists in
  `crates/mokly-css/src/_tests_/token_differential_fixtures_1.rs`,
  `_2.rs`, and `_3.rs`.
- **Reason:** The plan recorded this finding after the user's rule of
  2026-10-21 that new review findings wait for the user after the merge.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Differential test:** a test that runs the old and the new statement
    reader of the CSS Modules scanners on the same stylesheets and requires
    equal results.
- **Background:**
  - The test `parser_differential_covers_repository_stylesheets_and_generated_cases`
    reads 51 repository stylesheets and five generated ones.
  - The three fixture files embed each repository stylesheet with
    `include_str!` and a fixed path, 17 entries each.
  - The final review found that the list misses two stylesheets that
    PR #227 added. The plan does not name them.
  - A finding check confirmed it. The review report listed seven options,
    A to G. The plan records only the recommendation, which matches option
    C below.
  - Before PR #249, on 2026-10-30, the list missed five of the 56 tracked
    stylesheets:
    - From PR #227: `tests/fixtures/render-keys/specs/c.module.css` and
      `tests/fixtures/render-keys/specs/u/u.css`.
    - From PR #243: `appearance-selector.css`, `change-mark.css`, and
      `comparison-toolbar.css`, each in its folder under `packages/ui/src`.
  - Since PR #249 of 2026-10-30, the list misses 11 of the 62 tracked
    stylesheets. They are the five above and six that PR #249 added under
    `packages/ui/src`: `styles.css`, and `catalogue-navigation.css`,
    `catalogue-tree.css`, `screen-header.css`, `segmented-control.css`, and
    `top-bar.css`, each in its folder.
  - PR #241 removed the old statement reader from the product on
    2026-10-28. The test file `token_differential_tests.rs` keeps a copy of
    it, `legacy_next` and its helpers, at lines 54-150. So the test checks
    that the new statement reader gives the output of its removed
    predecessor. That is an output-equivalence check of a migration.
  - The `testing` skill of 2026-10-30 lists output equivalence and
    migrations under "What never gets a test". Its removal rule 3 lets an
    agent remove such a test without the user. Before the removal, each
    product assertion of the test moves to a test of its requirement. The
    user's rule of 2026-10-21 still reserves the choice of this item.
  - Other tests protect the statement rule of
    `docs/protocol/mokly-imported-styles-modules.md`: the CSS Modules
    scanners read each statement that `lightningcss` keeps with the same
    start and kind. So the differential test is not the last test of that
    rule. The other tests are:
    - four statement and grammar tests in
      `crates/mokly-css/src/_tests_/token_sections_tests.rs`
    - `top_level_html_comments_keep_at_rule_kinds` in
      `crates/mokly-css/src/_tests_/modules_tests.rs`
    - `html_comment_prefixes_only_move_the_starts_after_them` in
      `token_differential_tests.rs`, which reads only the new statement
      reader
- **Problem:**
  - The static list misses new stylesheets, so they leave the differential
    corpus without notice.
  - A moved or deleted listed file breaks the `mokly-css` test build,
    because `include_str!` fails.
  - The assertion `assert!(!sources.is_empty())`, at line 200, cannot fail,
    because the five generated stylesheets are always present.
- **Impact if no action:** Repository CSS can drop out of the differential
  coverage, and a rename elsewhere can break this crate's test build.
- **Root question:** How do the tests protect the new statement reader
  without a fragile, hand-kept stylesheet list?
- **Options:**
  - **D.** Remove the one-time equivalence test in four steps. It drops the
    comparison over the 51 listed repository stylesheets. Effort: Small.
    1. Run the differential test once. Save its output under `.context/`.
    2. Move each product assertion of the test to a test of its
       requirement.
    3. Remove
       `parser_differential_covers_repository_stylesheets_and_generated_cases`
       and each helper and fixture that only it uses. These include the
       copy of the old statement reader and the three fixture files.
    4. Keep `html_comment_prefixes_only_move_the_starts_after_them` and the
       helpers that it uses.
- **Left out:** Fewer than three approaches remain, because each other
  recorded approach keeps or widens the equivalence test. The `testing`
  skill keeps such a test out of the suite, so the options check may not
  give it. On 2026-10-29 this item gave these approaches:
  - **A.** Add the two missing files to the static list, and keep the list
    by hand. Effort: Small. It keeps the equivalence test.
  - **B.** Discover the workspace stylesheets inside the unit test. This
    adds repository file access to a unit test. Effort: Medium. It widens
    the equivalence test.
  - **C.** Read the tracked stylesheets at test time in an integration test
    behind a test-support feature. Keep the generated cases in the unit
    test, and assert a nonempty repository set. Effort: Medium. It widens
    the equivalence test. C was the recommendation, because it follows the
    tracked files and keeps unit tests free of repository file access. It
    was also the wider fix, because no list can go stale.
  - Drop the repository stylesheets. This item left it out, because it
    removes the coverage that found the scanner defects. It also keeps the
    copy of the old statement reader for the generated cases. D removes the
    whole comparison on purpose, and the other tests above protect the
    statement rule.
- **Wider fix:** D. Without the equivalence test, no stylesheet
  list exists to go stale. Under the fix rule of the
  `decisions-and-findings` skill, a test of a one-time proof is not a wider
  fix. So C is no longer one.
- **Previous examples:** None found.
- **Recommendation:** D. It removes the hand-kept list, the build
  break on a moved stylesheet, the copy of the old statement reader, and the
  assertion that cannot fail. The recommendation was C before the `testing`
  skill of 2026-10-30.
- **Action:** ask the user, because on 2026-10-21 the user ruled that new review
  findings wait for the user after the merge.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6701).
