# Commit info warning breaks a nested JSON report

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-10-29, from the CI run of PR #242 at `410de45e`.
- **Location:** `tests/browser/browser_error_rejection.spec.ts:10`, with the
  parse at line 33, the folder `tests/fixtures/browser-errors/`, and the
  spec's entry at `scripts/verification/browser-shard-weights.json:19`.
- **Reason:** On 2026-11-03 the user chose option D, the removal of the
  test, and asked for it in a later branch.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Nested Playwright run:** the inner `playwright test` process that this
    test starts, with the configuration
    `tests/fixtures/browser-errors/playwright.config.ts`.
  - **Commit info step:** the Playwright step that reads Git metadata for the
    report. It runs `git fetch` with a 3,000 ms time limit.
- **Background:**
  - The test "automatic browser errors fail real tests for both console and
    page errors" starts at `tests/browser/browser_error_rejection.spec.ts:10`.
  - It runs a nested Playwright run whose configuration selects the `json`
    reporter, at `tests/fixtures/browser-errors/playwright.config.ts:7`.
  - At line 33 it parses the whole standard output of the nested run with
    `JSON.parse`.
  - `docs/protocol/ci-suite-evidence.md:159-169` states the browser error
    rule: every browser spec fails on an unexpected console error or page
    error. This test is the only test that shows the rule failing a spec.
    It checks the test harness and no product code.
  - `tests/browser/browser_error_fixture.spec.ts` checks that the shared
    error fixture observes each error. It does not show that an unexpected
    error fails a spec.
  - On 2026-11-03 the user chose option D. That choice approves the removal
    of the last test of the browser error rule, which the `testing` skill
    reserves for the user.
- **Problem:**
  - Failure: the test failed in browser shard 4 of 4 of the CI run of
    PR #242 at `410de45e`. The date of the run was not recorded. PR #242
    merged on 2026-10-29.
  - Failure text:
    `SyntaxError: Unexpected token 'G', "GitCommitI"... is not valid JSON`.
  - The CI log shows
    `GitCommitInfo: timeout of 3000ms exceeded while running "git fetch origin ..."`
    just before.
  - Rerun outcome: the next CI run passed.
  - Suspected source: Playwright's commit info step wrote a warning line into
    the standard output that the test parses as JSON.
- **Impact if no action:** The browser suite can fail at random when the
  CI runner's Git fetch is slow. The test does not check the browser error
  rule in that run.
- **Root question:** How does the test read the nested JSON report without
  other output in the same stream?
- **Options:**
  - **A.** Write the nested JSON report to a file in the test's temporary
    output directory, and parse that file instead of the standard output.
    Effort: Small.
  - **B.** Turn off the commit info step in the nested configuration. Other
    warnings can still reach the standard output. Effort: Small.
  - **C.** Change nothing until the test fails again. Effort: Small.
  - **D.** Remove this test and `tests/fixtures/browser-errors/` under
    removal rule 3 of the `testing` skill, because it tests the test
    harness. It is the last test of the browser error rule, so the removal
    needs the user's approval. Effort: Small.
- **Left out:** A retry of the nested run. The `testing` skill
  forbids retries, because they hide the source.
- **Wider fix:** A. A report file keeps every later warning out of
  the parsed JSON.
- **Previous examples:** None found.
- **Related:** [flaky-viewer-selection-navigation.md](./flaky-viewer-selection-navigation.md)
  records the other unrelated browser failure that PR #242 met. It has a
  different test and a different source.
- **Recommendation:** D. The user chose it on 2026-11-03. The first
  recommendation was A, which keeps the test and parses a report file.
- **Action:** fix after merge, apply D, because the user chose D on
  2026-11-03 and asked for it in a later branch.
- **Work:**
  - Delete `tests/browser/browser_error_rejection.spec.ts` and the folder
    `tests/fixtures/browser-errors/`, which holds `errors.fixture.ts` and
    `playwright.config.ts`. Only this spec uses the folder.
  - Remove the spec's entry from
    `scripts/verification/browser-shard-weights.json`. Its weight is
    1,246 ms for its one test.
  - Keep the browser error rule in `docs/protocol/ci-suite-evidence.md`,
    section Browser Errors. Keep the code that applies the rule to every
    spec: `tests/browser/browser_test.ts`, `tests/browser/error_monitor.ts`,
    and `tests/browser/console_notices.ts`. Only the test of the rule goes.
  - Search `docs/`, `plans/`, and every `README.md` for
    `browser_error_rejection` and `browser-errors`. Update each live
    reference. On 2026-11-03 only this item named them.
  - Record the removal in the pull request description: the test, the
    reason, the user's approval of 2026-11-03, and the run time that it
    saves.
  - Delete this item in the same branch. Remove the link to it from
    `flaky-viewer-selection-navigation.md`.
