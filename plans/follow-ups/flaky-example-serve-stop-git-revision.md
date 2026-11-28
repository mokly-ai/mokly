# Example Serve fails to stop after browser shards

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-18, from PR #341, branch `calummoore/mokly-stamp-early-exit`, at the request of the follow-up orchestrator, which owns the flaky-test items.
- **Location:** `tests/browser/hosts.ts:45-50`, `tests/browser/setup.ts:63` and `:141`, `tests/browser/example_setup.ts:32`, `tests/helpers/example_base.ts:1-8`, and `scripts/verification/serve-process.mjs:137-159`.
- **Reason:** On 2026-11-26 the user chose option B, and the branch `calummoore/ci-speed-flaky-decisions-a` applied it. The first failure that names the exit code and the signal came on 2026-11-28, so option A can start.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Example Serve worker:** a `mokly serve` process of the example catalogue that the global setup of the browser suite starts for the shared specs.
  - **Global teardown:** the function that `tests/browser/setup.ts` returns. It stops each browser host after the last test of the shard.
  - **Pull-request checkout:** the checkout of a pull request run, a detached merge commit with no local `main` branch.
  - **Serve process chain:** the Node worker, its `mokly` shim, and the shim's native Serve binary, started through `scripts/verification/serve-process-worker.mjs`.
  - **Stop guard:** the SIGKILL that `scripts/verification/serve-process.mjs` sends when the Node worker remains alive 10 seconds after SIGINT.
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
    - PR #341, run 44408550558 attempt 1, job 135170626095, `Browser (Node 22.15.0, shard 3/4)`, commit `12c3f5734`. PR #341 changes only the input stamp check of `mokly-render`, so the failure lies outside it.
    - The rerun of the same job, attempt 2, job 135182862242. It failed in the same way.
    - Release PR #292, branch `release-please--branches--main--components--mokly`, commit `e9a1de92e`, which changes no code: run 44356902536, job 134987433206, `Browser (Node 22.15.0, shard 3/4)`. The `Browser (Node 24, shard 3/4)` job of the same run passed.
    - A push run of `main` at commit `f0d5363df`: run 44338526521, job 134922074235, `Browser (Node 22.15.0, shard 4/4)`.
  - The push runs of `main` at `51677c31f`, `4614c4a90`, and `47a563ea0` passed.
  - A guess, not a confirmed cause: the failure depends on the pull-request checkout, which has no local `main` branch, while a push to `main` has one. The failed push run at `f0d5363df` shows that a pull-request checkout is not the only condition.
  - Nobody reproduced the failure. The 21 repetitions of 2026-11-19 below also did not show it.
  - The repetitions under option A, on 2026-11-19:
    - On 2026-11-19, the user chose option A. The user also said what follows when the repetitions name no source. That result gets no code change, an update of this item only, and a user decision that includes option B. This investigation is complete. It did not reproduce the failure, and it named no source.
    - All 21 runs of browser shard 3/4 passed:
      - 10 remote runs on a pull-request checkout. Each checkout step asserted a detached merge commit with two parents and no local branch.
      - 10 remote runs on `main` at commit `f4f0082fd`, with a local `main` branch.
      - 1 local run on `main` at commit `f4f0082fd`, with a local `main` branch.
    - Each run passed 715 tests, with 0 failed, skipped, cancelled, or timed out. The total is 15,015 passes.
    - The remote runs used GitHub-hosted `ubuntu-24.04` runners and the command `cargo xtask check --suite browser --shard 3/4`. The local run used the equivalent prepared command `node scripts/verification/run-browser.mjs --shard 3/4`.
    - The remote runs used Node 22.15.0, npm 11.21.0, Git 2.56.1, Rust 1.95.0, and Playwright 1.61.1. The local run also used Node 22.15.0.
    - Every run used the default of one Playwright test worker and no test retries. The stop guard stayed at 10 seconds.
    - The merge commit was `397c56eb5dbd363d713eb1163e533bba125f4ce1`. Its parents were `main` at `f4f0082fd4bc8a6ffb2575f7416c37a216dfd0dd` and the temporary diagnostic commit `71bc1d770b4f5a0614f5bccbb81ad3ae15a01f71`. The merge differed from `main` only in `.github/workflows/ci.yml`.
    - A temporary trace recorded each process exit, each signal, and each Git command. In all 21 runs, the Node worker, the shim, and the native binary each exited with code 0 and no signal. The trace caught the SIGINT at each step of the Serve process chain.
    - In no run did the stop guard send SIGKILL before the Node worker exited. Each later SIGKILL came from the normal cleanup that `stop` runs after the Node worker exits.
    - In each run, the shared Example Serve worker ran this Git command once. It exited with status 128 and the error `Needed a single revision`, and it ended before the stop:

      ```text
      git --no-optional-locks rev-parse --verify --end-of-options 'refs/mokly/browser-suite-no-base^{commit}'
      ```

    - The shared command passes `--no-watch`, so Serve does not poll Git references again for this host. On this path, the guess in option A, a reference poll that fails at shutdown, has no support.
    - The repetitions did not confirm the guess about the pull-request checkout. Neither checkout type reproduced the failure.
    - The first diagnostic run also started 10 `main` jobs that stopped in setup, before any browser test. Their `GITHUB_SHA` was the merge commit, which did not match the pinned `main` commit. These jobs are not counted. The temporary commit `c1e2dfb5a9208e23bf7307d48afa7638ccaa1bf6` set the source identity for the 10 counted remote `main` runs.
    - Run 44602176341 holds the merge runs and the 10 setup failures. Run 44602806738 holds the counted remote `main` runs, and there four contract assertions of the Viewer job rejected the temporary job. Neither run passed as a whole. Only their diagnostic shard jobs count here.
    - No product code, test, or workflow change was kept from the repetitions.
    - Limits of this evidence:
      - The four failed jobs ran on Blacksmith runners, label `blacksmith-4vcpu-ubuntu-2404`, on 2026-11-18. PR #342, commit `09db57306`, moved the browser shards to GitHub-hosted `ubuntu-24.04` runners on 2026-11-19, before the repetitions. So the repetitions did not use the runner type of the failures. This difference is not a known cause, and the evidence does not show that the move fixed the failure.
      - The old logs give no exit code and no signal. In the failed job of PR #341, attempt 1, about 11 seconds pass from the last passed test to the cleanup error. That gap fits a SIGKILL from the stop guard, but it does not prove one. It stays a guess, not a named source.
      - The 21 clean runs do not show that the failure is gone.
  - On 2026-11-20, the local combined gate of the miss-first capture branch hit the same cleanup failure after all 2,295 browser cases passed. There were no failed, skipped, or cancelled cases. The source was merge `a2b39c217`, with main parent `0a37561ea` and pending test-fixture updates. It used Node 24.21.0, Git 2.50.1, Rust 1.98.1, and one Playwright worker. The reporter failed with exit 1. The native exit code and signal of the failed host remain unavailable.
  - One unchanged targeted host lifecycle observation then passed. It used the shared Example command and readiness check, with an observation-only `strace`. The native binary, shim, and Node worker each exited with code 0 and no termination signal. SIGINT reached all three stages, and the stop guard sent no SIGKILL before the worker exited. This was a targeted lifecycle observation, not a rerun of all 2,295 browser cases. It named no source, and no product, test, or workflow fix was made.
  - On 2026-11-21, the complete gate at `a177da3ca` recorded the same global cleanup failure. It used Node 24.21.0 and one Playwright worker. Of 2,305 cases, 2,304 passed and one failed because the machine exhausted its OS file watch capacity. There were no skipped or cancelled cases. The original cleanup report still omitted the native exit code and signal.
  - The file watch failure was a separate machine prerequisite. The machine had 63,308 watches against a limit of 65,536. The Conductive runner owned 63,215 of those watches. Raising the machine limit to 1,048,576 changed no product, test, assertion, or workflow.
  - One narrow lifecycle check passed on `a177da3ca`, and one passed on the frozen main control `36cfd7cf7`. Both reached Browse readiness and Changes unavailable, kept exactly one expected Git diagnostic, and stopped with exit code 0 and no signal. These narrow checks did not reproduce the full Browser workload.
  - The unchanged full Browser rerun at `7f4220e7a` then passed all 2,305 cases, with zero failures, skips, or cancellations. Its strict reporter completed without errors. An ignored Node diagnostics-channel observer recorded the shared Example native binary, shim, and Node worker. All three exited with code 0 and no signal. The observer added no signal handler or stop policy. This pass identifies no cause for the earlier cleanup failure. No product, test, or workflow fix was made.
  - On 2026-11-28, a local run of the complete browser suite (`npm run test:browser`, 917 test cases) on the branch `calummoore/embedded-access-start-page-worker-and-1p13` at commit `55537c5c2` passed every case but exited 1 in teardown with `Example Serve did not stop cleanly, exit code null, signal SIGKILL` and one `[mokly/git-failed] Git exited with status 128: fatal: Needed a single revision` line. The rerun passed. That branch changed `PackageAssets::load` in `crates/mokly-server/src/assets.rs`, but not `scripts/verification/serve-process.mjs`, `tests/browser/hosts.ts`, or the Git code. The run log was not kept.
  - That failure is the first that names the signal. `signal SIGKILL` with `exit code null` means that the Node worker died from SIGKILL, which the 10-second stop guard of `scripts/verification/serve-process.mjs:143-149` sends. An outside kill, such as the out-of-memory killer, would look the same.
- **Problem:** Global teardown sometimes fails after every test passed because the Example Serve worker does not exit with code 0. Its output contains the same `[mokly/git-failed]` text as the expected initial diagnostic. Since 2026-11-26 the error names the exit code and the signal, and the first failure that named them, on 2026-11-28, ended with `signal SIGKILL` from the stop guard.
- **Impact if no action:** Required CI fails on healthy pull requests, and each author must rerun the job or ask why. One rerun of PR #341 failed again.
- **Root question:** Why does the Example Serve worker sometimes end with an exit code other than 0 when the global teardown stops it?
- **Options:**
  - **A.** Reproduce the failure first. Repeat the failing shard on a pull-request checkout, a detached merge commit with no local `main` branch, and also on `main`. Record the exit code, the signal, and the Git command that exits with status 128, with its revision argument. Then make the stop deterministic, and add no retry. When the cause is a product bug in Serve, for example a reference poll that fails at shutdown and changes the exit code, write a failing test of it first. Effort: Medium.
  - **B.** Make the host print the exit code and the signal of `server.stop()` beside the Serve output, then wait for the next failure in CI. This only improves the evidence, and a fix still needs A. Effort: Small.
- **Left out:**
  - A retry of the stop or of the shard, because the flaky-test rule of the `testing` skill forbids a retry.
  - A host that accepts any exit code, because it would hide a real failure of Serve at shutdown.
  - A change to the stop before a source is named, because the flaky-test rule of the `testing` skill needs a named source first.
  - Only two approaches are real, because before a source is named, work can only repeat the shard or add evidence to the next failure.
- **Wider fix:** None. The cause is unknown, so no class of failure is known yet.
- **Previous examples:** The deleted item `browser-host-cleanup-failure.md`, at the permalink above, recorded the same cleanup failure before PR #322 kept its inner errors.
- **Related:** None.
- **Recommendation:** B. The first recommendation was A, before the repetitions of 2026-11-19. All 21 clean runs gave no failure to study. B makes the next CI failure show the exit code and signal of `server.stop()`. A stays the only option that fixes the failure. It still needs a reproducible failure or a named source.
- **Action:** fix after merge, apply A, because the evidence that the user's choice of B on 2026-11-26 waited for came on 2026-11-28: the stop guard killed the worker.
- **Applied:** On 2026-11-26, `tests/browser/hosts.ts` started to name the exit code and the signal in the error, for example `Example Serve did not stop cleanly, exit code 1, signal null:`. `tests/browser_host_parent_death.test.ts` checks that text. A SIGKILL from the 10-second stop guard of `scripts/verification/serve-process.mjs` shows as `signal SIGKILL`.
