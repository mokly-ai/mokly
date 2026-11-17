# Installation release fails on a late check row

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-02, from CI run 41370073016 of the branch `calummoore/ci-pipeline-duration`, an unrelated flaky test.
- **Location:** `ts/app/src/_tests_/database-fixture.ts:11-17`, `:70-88` and `:100-110`, `ts/app/src/_tests_/harness.ts:233-239`, `crates/mkc-publications/src/check_provider.rs:120-133`, `crates/mkc-publications/src/check_worker.rs:42-60`, `crates/mkc-api/src/check_runtime.rs:62-77`, and `crates/mkc-db/migrations/202609161530_github_app/up.sql:18` and `:99`.
- **Reason:** The branch that met the flake changes neither the test, the release helper nor the check writer, and the flaky-test rule fixes an unrelated flaky test in its own branch.
- **Checked:** 2026-11-02, at commit `07febda2`. These files are the same as on `main` at `10834d30`. The release still runs its deletes in one `psql -c` call, the check delivery still records each check row in its own transaction, and the foreign key still has no delete action. Nobody ran a controlled reproduction.
- **Category:** Test.
- **Related:** `plans/follow-ups/recorded-github-release-races-check-delivery.md` records the same failure in local runs, including a new occurrence on 2026-11-04. Keep both histories when the future fix consolidates them.

- **Terms:**
  - **Recorded installation:** The GitHub App installation with GitHub id 1 that the recorded GitHub double replays for every account. The app browser suite shares it between tests.
  - **Release:** `releaseRecordedGitHub` in `ts/app/src/_tests_/database-fixture.ts`. It deletes the recorded installation and what it holds, so that the next walk can install it again.
  - **Check delivery:** The background loop of the API that runs the check batches every five seconds. A publication batch claims pending rows of `publication_events`, creates the check on GitHub, and then records it as a row of `github_check_runs`.
- **Background:** The list below gives facts from the code.
  - `installApp` at `harness.ts:233-239` calls the release first. `installThroughApi` at `harness.ts:252` does the same, and `onboarding.spec.ts`, `connect.spec.ts` and `settings/github-accounts.spec.ts` call it directly five times.
  - The release sends one `psql -c` call through `sql` at `database-fixture.ts:11-17`. From `forgetInstallation`, it deletes in this order: the check rows of the installation's repositories, their builds, their project links, the organization integrations, and the installations. It then deletes the user integrations and the GitHub identity of the recorded person.
  - The installation delete cascades to its repositories, because `github_repositories.installation_id` has `ON DELETE CASCADE` at `up.sql:18`. `github_check_runs.repository_id` references `github_repositories` with no delete action, at `up.sql:99`. So the cascade fails while any check row still names the repository.
  - The psql documentation says that a `-c` string with several statements runs as one transaction. With the default isolation of Postgres, each statement sees the rows that other transactions committed before it started.
  - The browser suite runs the real API with its background loops. The check delivery loop sleeps five seconds between batches, at `check_runtime.rs:73`. `PublicationChecks::run_batch` in `check_worker.rs` claims the pending events. `GitHubCheckRuns::upsert` in `check_provider.rs` creates the check on the recorded GitHub, and then calls `record_github_check` in a transaction of its own.
  - In `publication_events`, an event is pending while it has no `delivered_at` and no `dead_lettered_at`, as the index `publication_events_pending` shows.
- **Problem:**
  - Confirmed: once in CI, the release failed with a foreign-key error at the start of a test, and the retry passed. The failure text is in the history below.
  - Suspected, not reproduced: a check row for the recorded repository committed while the release ran, after its first delete and before its installation delete. The most likely writer is the check delivery of the test before, which also publishes. Another background writer, such as GitHub reconciliation, is not ruled out.
- **Impact if no action:** Any test that releases the installation after a test that published can fail one attempt this way. Two failed attempts in a row fail its App shard job and cost a CI rerun.
- **Root question:** How does a test hand back the recorded installation while background work of the API can still write rows for its repository?
- **Options:**
  - **A.** Reproduce the race with a controlled event order first. Then make the release wait for the source that the reproduction names, through an explicit readiness signal, and keep every assertion. Effort: Medium.
    - For the check delivery, the release would poll with `expect.poll`, with a deadline of at least 10 seconds, until `publication_events` holds no pending event for the projects of the recorded repository.
    - Cost: the release becomes asynchronous, and each install can wait up to one check delivery cycle.
  - **B.** Lock the rows of the recorded repository at the start of the release. A check row that comes later then waits for the release and fails in the worker, not in the test. Cost: the worker logs a failed batch, and its event stays pending for a removed repository. Nobody checked how the worker handles that. Effort: Medium.
  - **C.** Add `ON DELETE CASCADE` to `github_check_runs.repository_id` in a new migration, so that the cascade also removes a late check row. Cost: it changes product data behaviour, because a removed repository then loses its check history, so it needs the user. A check row that comes after the cascade still fails in the worker. Effort: Medium.
  - **D.** Give each test its own installation, so that no test hands back an installation that the publication of another test can still use. Cost: the recorded GitHub replays one person and two installations, so the double and its recordings must change. Effort: Large.
- **Left out:**
  - Change nothing. It fails the goal, because two failed attempts in a row fail the job.
  - A retry of the release on the foreign-key error, a sleep before it, or a longer time limit. The flaky-test rule forbids each.
  - A second delete of the check rows just before the installation delete. It makes the window smaller, but the race stays.
  - A switch in the API that pauses the check delivery during a release. Product code would then detect a test, which the testing skill forbids.
  - A test of the release helper itself. The testing skill gives the harness internals no test of their own. The browser tests that install the App cover it.
  - A fix before a reproduction. The flaky-test rule requires a reproduction first.
- **Wider fix:** D. It removes the shared installation that lets the background work of one test reach the next test. A fixes the one shared release helper, so it covers every caller, but only for the source that the reproduction names.
- **Previous examples:** `plans/follow-ups/app-build-tests-fail-on-late-route-fetch.md` records other asynchronous work that outlives its test in the same suite: a route handler awaits `route.fetch()` after its test ends. No earlier record of this foreign-key error was found in `plans/` or `docs/`.
- **Recommendation:** A. It reproduces the race before it changes anything, keeps every assertion, and waits on a state, not on time. D best protects the suite from this class, but it is Large.
- **Action:** fix after merge, apply A, because the test, its helper and the check writer are outside the branch that met the flake. If the reproduction names no source, the flaky-test rule gives the outcome ask the user. If it names a source in product code, the fix is a product bug fix with a failing test first.

To reproduce and prove the fix:

- Run `viewer-mobile.spec.ts:198` and then `:219` in order on the `mobile` project with `--retries=0` and `--repeat-each=20`. Record the pass count under `.context/`.
- Force the order at the database, with no sleep. In the suite's database schema, open a transaction that inserts a check row for the recorded repository, and leave it open. Run the release. It waits at the installation delete. Commit the held insert. The release should then fail with the same error.
- Then show which background writer commits such a row during a natural run, for example from the API log of the two tests in order.
- After the fix, run the same tests 10 times with `--retries=0`, and record the pass counts before and after under `.context/`. Do not commit a temporary hold or a test of the release.

Failure, as history. These facts come from the CI log of the job below.

- On 2026-11-02, attempt 1 of CI run 41370073016 ran on the branch `calummoore/ci-pipeline-duration`, at commit `07febda2`. All 12 jobs passed.
- In job 125038450894, App checks 4/4, the first attempt of the mobile test `viewer-mobile.spec.ts:202`, "a late package slot does not restore after leaving its path", failed after 784 milliseconds. The retry passed in 2.5 seconds, and the job reported "1 flaky" and "79 passed (4.3m)".
- The test before it in the same job was `viewer-mobile.spec.ts:183`, "a later pointer action cancels the package slot restore". It also publishes a project, and it passed in 2.4 seconds.
- The failure came at the start of the test: from `publishedProject` at `viewer/support.ts:84`, through `createProject` at `harness.ts:337` and `installApp` at `harness.ts:234`, to the release at `database-fixture.ts:101` and `sql` at line 12.
- The error text was:

  ```text
  ERROR:  update or delete on table "github_repositories" violates foreign key constraint "github_check_runs_repository_id_fkey" on table "github_check_runs"
  DETAIL:  Key (id)=(<repository id>) is still referenced from table "github_check_runs".
  ```

- Locally, shard 4 and the complete App browser suite of 371 tests passed with no retry.
