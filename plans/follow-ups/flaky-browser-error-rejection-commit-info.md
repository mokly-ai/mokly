# Commit info warning breaks a nested JSON report

- **Severity:** Low (estimate). **Effort:** Small (estimate).
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from the CI run of PR #242 at `410de45e`.
- **Location:** `tests/browser/browser_error_rejection.spec.ts:10`, with the
  parse at line 33, and
  `tests/fixtures/browser-errors/playwright.config.ts:7`.
- **Reason:** The test is unrelated to PR #242 and passed on the next run.

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
    Effort: Small (estimate).
  - **B.** Turn off the commit info step in the nested configuration. Other
    warnings can still reach the standard output. Effort: Small (estimate).
  - **C.** Change nothing until the test fails again. Effort: Small
    (estimate).
  - **D.** Remove this test and `tests/fixtures/browser-errors/` under
    removal rule 3 of the `testing` skill, because it tests the test
    harness. It is the last test of the browser error rule, so the removal
    needs the user's approval. Effort: Small (estimate).
- **Left out:** A retry of the nested run. The `deterministic-tests` skill
  forbids retries, because they hide the source.
- **Wider fix:** A (estimate). A report file keeps every later warning out of
  the parsed JSON.
- **Previous examples:** None found.
- **Related:** [flaky-viewer-selection-navigation.md](./flaky-viewer-selection-navigation.md)
  records the other unrelated browser failure that PR #242 met. It has a
  different test and a different source.
- **Recommendation:** A (estimate). It removes the mixed stream, whatever
  writes to it.
- **Action:** ask the user, because condition 6 holds (estimate): the
  failure was not reproduced, so the `deterministic-tests` skill gives
  `ask the user`.
