# Discover CSS differential fixtures from tracked stylesheets

- **Severity:** Low. **Effort:** Medium.
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
- **Problem:**
  - The static list misses new stylesheets, so they leave the differential
    corpus without notice.
  - A moved or deleted listed file breaks the `mokly-css` test build,
    because `include_str!` fails.
  - The assertion `assert!(!sources.is_empty())`, at line 200, cannot fail,
    because the five generated stylesheets are always present.
- **Impact if no action:** Repository CSS can drop out of the differential
  coverage, and a rename elsewhere can break this crate's test build.
- **Root question:** How does the differential test cover every tracked
  stylesheet without a hand-kept list?
- **Options:**
  - **A.** Add the two missing files to the static list, and keep the list
    by hand. Effort: Small.
  - **B.** Discover the workspace stylesheets inside the unit test. This
    adds repository file access to a unit test. Effort: Medium.
  - **C.** Read the tracked stylesheets at test time in an integration test
    behind a test-support feature. Keep the generated cases in the unit
    test, and assert a nonempty repository set. Effort: Medium.
- **Left out:** Drop the repository stylesheets. It removes the coverage
  that found the scanner defects.
- **Wider fix:** C. It follows the tracked files, so no list can go stale.
- **Previous examples:** None found.
- **Recommendation:** C. It follows the tracked files and keeps unit tests
  free of repository file access.
- **Action:** ask the user, because condition 5 holds: on 2026-10-21 the
  user ruled that new review findings wait for the user after the merge.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6701).
