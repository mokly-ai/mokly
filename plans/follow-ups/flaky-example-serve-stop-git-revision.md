# Example Serve fails to stop after browser shards

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-18, from PR #341, branch `calummoore/mokly-stamp-early-exit`, at the request of the follow-up orchestrator, which owns the flaky-test items.
- **Location:** `tests/browser/hosts.ts:45-50`, `tests/browser/setup.ts:63` and `:141`, `tests/browser/example_setup.ts:32`, `tests/helpers/example_base.ts:1-8`, and `scripts/verification/serve-process.mjs:137-159`.
- **Reason:** The failure lies outside PR #341, which changes only the input stamp check of `mokly-render`. The same failure hit a release pull request with no code change and one push run of `main`.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Example Serve worker:** a `mokly serve` process of the example catalogue that the global setup of the browser suite starts for the shared specs.
  - **Global teardown:** the function that `tests/browser/setup.ts` returns. It stops each browser host after the last test of the shard.
  - **Pull-request checkout:** the checkout of a pull request run, a detached merge commit with no local `main` branch.
- **Background:**
  - `exampleServerCommand` in `tests/browser/example_servers.ts` starts the Example Serve worker with `--base refs/mokly/browser-suite-no-base`, a reference that does not exist. `validateExampleDiagnostics` in `tests/helpers/example_base.ts` expects exactly one `[mokly/git-failed]` line in the output of that Serve.
  - `serveHost` in `tests/browser/hosts.ts:45-50` stops Serve with `server.stop()`. It throws "Example Serve did not stop cleanly" with the Serve output when the exit code is not 0. `stop` in `scripts/verification/serve-process.mjs:137-159` sends SIGINT, and SIGKILL after 10 seconds. A process that the kill stops also has no exit code 0.
  - On 2026-11-18, PR #322, commit `ae79b95cd`, made the cleanup error keep its inner errors. This failure is the first cause that the kept errors name. PR #322 deleted the earlier item, which is at its last commit: https://github.com/mokly-ai/mokly/blob/159231c31/plans/follow-ups/browser-host-cleanup-failure.md
  - The failure text, with the port of each run:

    ```text
    AggregateError: Browser host cleanup failed
      Error: Example Serve worker 1 (http://127.0.0.1:{port}) cleanup failed
        [cause]: Error: Example Serve did not stop cleanly:
        Mokly cache: {cache path}
        Mokly listening at http://127.0.0.1:{port}
        [mokly/git-failed] Git exited with status 128: fatal: Needed a single revision
    ```

  - The stack runs through `tests/browser/setup.ts:63` and `:141`, `tests/browser/hosts.ts:48`, and `tests/browser/example_setup.ts:32`.
  - These jobs failed this way. In each, every test of the shard passed, and only the global teardown failed:
    - PR #341, run 44408550558 attempt 1, job 135170626095, `Browser (Node 22.15.0, shard 3/4)`, commit `12c3f5734`.
    - The rerun of the same job, attempt 2, job 135182862242. It failed in the same way.
    - Release PR #292, branch `release-please--branches--main--components--mokly`, commit `e9a1de92e`, which changes no code: run 44356902536, job 134987433206, `Browser (Node 22.15.0, shard 3/4)`. The `Browser (Node 24, shard 3/4)` job of the same run passed.
    - A push run of `main` at commit `f0d5363df`: run 44338526521, job 134922074235, `Browser (Node 22.15.0, shard 4/4)`.
  - The push runs of `main` at `51677c31f`, `4614c4a90`, and `47a563ea0` passed.
  - A guess, not a confirmed cause: the failure depends on the pull-request checkout, which has no local `main` branch, while a push to `main` has one. The failed push run at `f0d5363df` shows that a pull-request checkout is not the only condition.
  - Nobody reproduced the failure.
- **Problem:** The global teardown fails after every test of a shard passed, because the Example Serve worker does not exit with code 0. The output names a Git failure. The expected `[mokly/git-failed]` line has the same text, so the output does not show whether the stop failed on a second Git failure, or for another reason.
- **Impact if no action:** Required CI fails on healthy pull requests, and each author must rerun the job or ask why. One rerun of PR #341 failed again.
- **Root question:** Why does the Example Serve worker sometimes end with an exit code other than 0 when the global teardown stops it?
- **Options:**
  - **A.** Reproduce the failure first. Repeat the failing shard on a pull-request checkout, a detached merge commit with no local `main` branch, and also on `main`. Record the exit code, the signal, and the Git command that exits with status 128, with its revision argument. Then make the stop deterministic, and add no retry. When the cause is a product bug in Serve, for example a reference poll that fails at shutdown and changes the exit code, write a failing test of it first. Effort: Medium.
  - **B.** Make the host print the exit code and the signal of `server.stop()` beside the Serve output, then wait for the next failure in CI. This only improves the evidence, and a fix still needs A. Effort: Small.
- **Left out:**
  - A retry of the stop or of the shard, because the flaky-test rule of the `testing` skill forbids a retry.
  - A host that accepts any exit code, because it would hide a real failure of Serve at shutdown.
- **Wider fix:** None. The cause is unknown, so no class of failure is known yet.
- **Previous examples:** The deleted item `browser-host-cleanup-failure.md`, at the permalink above, recorded the same cleanup failure before PR #322 kept its inner errors.
- **Related:** None.
- **Recommendation:** A. A reproduction names the Git command and the exit path, so the fix can keep every check of the teardown.
- **Action:** fix after merge, apply A, because the failure is outside the scope of PR #341, and the follow-up orchestrator owns it.
