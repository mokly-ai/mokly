# Commit info warning breaks a nested JSON report

- **Severity:** Low. **Effort:** Small.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from the CI run of PR #242 at `410de45e`.
- **Location:** `tests/browser/browser_error_rejection.spec.ts:33`.
- **Reason:** The test is unrelated to PR #242 and passed on the next run.

`tests/browser/browser_error_rejection.spec.ts`, "automatic browser errors
fail real tests for both console and page errors", failed in browser shard
4 of 4 with `SyntaxError: Unexpected token 'G', "GitCommitI"... is not valid
JSON`. The CI log shows `GitCommitInfo: timeout of 3000ms exceeded while
running "git fetch origin ..."` just before. The suspected source: the
test runs Playwright inside the test and parses its JSON output, and
Playwright's commit info step wrote a warning line into that output. The
next CI run passed.
