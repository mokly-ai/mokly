# Recorded GitHub release races check delivery

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-02, from the ten-run check of the app browser suite in the Milestone 2 app work item of the branch `calummoore/mokly-cli-upgrade`, an unrelated flaky test.
- **Location:** `apps/app/src/_tests_/database-fixture.ts:70-110`, which holds `forgetInstallation` and `releaseRecordedGitHub`.
- **Reason:** On 2026-11-20, 40 natural repetitions did not reproduce the cleanup failure, so option A waits for a user decision under the flaky-test rule.
- **Category:** Test.
- **Related:** `plans/follow-ups/installation-release-fails-on-late-check-row.md` records the same cleanup failure from CI, with reproduction guidance. Keep both histories when the future fix consolidates them.

- **Terms:**
  - **Recorded GitHub:** The GitHub double of the app browser suite. It replays recorded answers for one App installation, provider ID 1, which holds the repository `octocat/Hello-World`.
  - **`releaseRecordedGitHub`:** The harness function in `apps/app/src/_tests_/database-fixture.ts` that deletes the rows of the recorded installation, so that the next test can install the App again.
  - **Check worker:** The background loop of the API in `crates/mkc-api/src/check_runtime.rs`. Every five seconds it delivers the due events of the `publication_events` outbox as GitHub check runs, and it writes each check run to `github_check_runs`.
- **Background:** The list below gives the facts.
  - Every viewer test that calls `publishedProject` in `apps/app/src/_tests_/viewer/support.ts` signs in, creates a project and publishes to it. `createProject` in `apps/app/src/_tests_/harness.ts` calls `installApp`, which calls `releaseRecordedGitHub` first.
  - So the project of each test is bound to the same recorded repository, and the publication of each test queues a check event for that repository.
  - `releaseRecordedGitHub` sends all its statements in one `psql -c` command, so they run in one transaction. `forgetInstallation` deletes the `github_check_runs` rows of the repository first. It deletes the `github_installations` row last, and that delete cascades to `github_repositories`.
  - `github_check_runs.repository_id` references `github_repositories` with no delete action, in `crates/mkc-db/migrations/202609161530_github_app/up.sql`. `builds.repository_id` references it in the same way, in `crates/mkc-db/migrations/202610100900_cloud_builds/up.sql`.
  - The suite runs on one Playwright worker, but the check worker of the API runs beside it. A test can end before the check worker delivers the check of its publication.
  - The check worker writes each check run in its own one-statement transaction, in `crates/mkc-publications/src/check_provider.rs`. When that write fails, the worker logs a warning and retries the event later.
- **Problem:** The check worker can write a `github_check_runs` row for the recorded repository after the release deleted the check runs and before it deletes the installation. The cascade then fails on the foreign key, and the next test fails in its setup.
- **Impact if no action:** A viewer test can fail at random in its setup. Each failure costs a rerun of the app browser checks.
- **Root question:** How does the harness give the next test a clean recorded installation while the API still delivers the check of an earlier test?
- **Options:**
  - **A.** Run the release in one explicit transaction that first takes `LOCK TABLE github_check_runs, builds IN SHARE ROW EXCLUSIVE MODE`. A concurrent check-run write then waits until the release commits. After that, the write fails its own foreign-key check in the API, which logs a warning and retries the event, as it did in the failed run. Effort: Small.
  - **B.** Before the release, poll until the outbox holds no undelivered and live event of a publication in a project that is bound to the recorded repository. Give the poll a deadline of at least 10 seconds. The worker runs every five seconds, so a release can wait that long, and a delivery that fails and backs off holds the poll until its deadline. Effort: Small.
  - **C.** Let the shared `publish` helper in `apps/app/src/_tests_/publish.ts` return only after the check worker delivered or dead-lettered the check event of its publication. No delivery then outlives its test, but each publishing test can wait up to five seconds more. Effort: Medium.
  - **D.** Give each test its own installation and repository identifiers, so that no delivery of an earlier test touches the rows that a later test releases. The recordings answer for one installation today, so they need answers for any identifier. Effort: Large.
- **Left out:** The list below gives the approaches that the options leave out.
  - A retry of the release on the foreign-key error. The flaky-test rule forbids a retry, because it hides the race.
  - `ON DELETE CASCADE` on `github_check_runs.repository_id`. It changes the product schema with a migration to fix a test harness.
  - A setting that stops the check worker in the browser harness. It adds an API setting that only tests use, and the suite then no longer runs the check delivery that every real publication starts.
- **Wider fix:** D. Isolated state per test removes every race on the shared recorded installation, not only the race of the check worker.
- **Previous examples:** `plans/follow-ups/app-build-tests-fail-on-late-route-fetch.md`, where work that an earlier step started also outlives its test in the same suite.
- **Recommendation:** A. It removes the race inside the one function that owns the release, with no wait and no retry. D best protects the codebase.
- **Action:** ask the user, because the failure did not reproduce in 40 natural repetitions on 2026-11-20, and the user asked to decide that case. Until then, the action was `fix after merge, apply A`, as the history below records.

Failure, as history. These facts come from the recorded run.

- On 2026-11-02, a ten-run check ran 27 tests of `apps/app` on one worker, on the work tree that became commit `5f45e7b2`. The command was `playwright test --config playwright.config.ts --tsconfig tsconfig.runtime.json --retries=0 --repeat-each=10` with the named tests. 269 of 270 runs passed.
- The failed run was repeat 5 of `src/_tests_/viewer-mobile.spec.ts:217`, "a late package slot does not restore after leaving its path", on the `mobile` project. The other 9 runs of that test passed. No other run of the full app browser suites of that work item failed this way.
- The error text was:
  `ERROR: update or delete on table "github_repositories" violates foreign key constraint "github_check_runs_repository_id_fkey" on table "github_check_runs"`
  and `DETAIL: Key (id)=(01a19a20-a4ae-7698-9ff7-fa79dd727a37) is still referenced from table "github_check_runs".`
- The stack ran from `sql` at `database-fixture.ts:12` and `releaseRecordedGitHub` at `database-fixture.ts:101`, through `installApp` at `harness.ts:234`, `createProject` at `harness.ts:337` and `publishedProject` at `viewer/support.ts:84`, to the test at `viewer-mobile.spec.ts:220`.
- At 02:40:15.553 UTC the API logged the warning "publication check delivery failed" for event `01a19a20-f548-76a1-8a7a-2d1b3ca112d2`, at attempt 1 and not dead-lettered. Its context was "record created or recovered GitHub check", and its cause was `insert or update on table "github_check_runs" violates foreign key constraint "github_check_runs_repository_id_fkey"`. So the check worker and the release met on the same foreign key at the same moment.

Additional occurrence on 2026-11-04:

- The full gate after merging main `08b3a98b` into the retention branch hit the
  same error in `viewer-mobile.spec.ts:126`,
  `the compact bar keeps every action in More and a panel is a sheet`.
- The first attempt failed after 1.5 seconds. The existing runner retry passed
  after 4.7 seconds. The app suite reported one flaky case and 372 other passed
  cases in 27.5 minutes.
- Postgres reported the same foreign-key error for repository
  `01a1a63b-cb7b-73f9-9301-e7a46e5a553a`. The stack again passed through `sql`,
  `releaseRecordedGitHub`, `installApp`, `createProject` and `publishedProject`.
- The test and cleanup helper match captured main exactly. No assertion,
  fixture operation or retry setting changed in the retention integration.
  The suspected background-write ordering remains a separate investigation.

Investigation on 2026-11-20, as history. It changed no tracked code, test or configuration.

- Until this investigation, the kind was Outside the scope. The reason and the action were:
  - Reason: The release statements are the same on `origin/main` and this branch did not change them, so one fix in a separate branch reaches every open branch.
  - Action: fix after merge, apply A, because the release code is the same on `origin/main` and the flake is outside the branch that met it.
- On 2026-11-20 the user asked to reproduce the failure first, with the steps in `plans/follow-ups/installation-release-fails-on-late-check-row.md`. Option A was to follow only if the reproduction and its source justified it. If the repetitions did not reproduce the failure, no code was to change, and the user was to decide the next step.
- The investigation ran at commit `4696ee41b` of `origin/main`. The release, the check write and the foreign keys were as the Background says. It used Postgres 16.15 and the browser setup of `apps/app/README.md`. That setup has the real API, the recorded GitHub, the exported app, one worker and an isolated schema.
- Natural run: `viewer-handoff-mobile.spec.ts:42`, "a later pointer action cancels the package slot restore", and `:63`, "a late package slot does not restore after leaving its path", ran in order 20 times. The command ran from the repository root:
  `PLAYWRIGHT_JSON_OUTPUT_FILE={absolute evidence folder}/before-results.json npm run test:browser --workspace @mokly-cloud/app -- src/_tests_/viewer-handoff-mobile.spec.ts:42 src/_tests_/viewer-handoff-mobile.spec.ts:63 --project=mobile --retries=0 --repeat-each=20 --reporter=list,json`
  - All 40 runs passed, with no failed, skipped or flaky run. Each test passed 20 of 20. The command exited with 0 after 295.6 seconds. So the natural runs did not reproduce the cleanup failure.
  - Postgres logged 16 inserts into `github_check_runs`: 15 committed and 1 failed. All 16 match `record_github_check`, which only the check worker calls outside tests, from `crates/mkc-publications/src/check_provider.rs`.
  - The failed insert came after one `:42` run ended at 02:25:11.794 UTC:
    - At 02:25:12.714 the check worker read the repository of that run.
    - From 02:25:12.733 to 12.736 the release at the start of the next `:63` run deleted that repository, with no error.
    - At 02:25:12.757 the check worker inserted the check row. The insert failed on `github_check_runs_repository_id_fkey`, because the repository was gone.
    - At 02:25:12.759671 the API logged "publication check delivery failed" for event `01a1f6c5-a73f-737c-addf-3317754a87c6`, at attempt 1, with 0 permanent failures, not dead-lettered. Its context was "record created or recovered GitHub check".
  - The `:63` run passed. So the check worker met a release in a natural run, but after the release committed. The API write failed, not the release. This is not a natural cleanup failure.
- Controlled order. It is a diagnostic, not a natural failure and not an after-fix result.
  - One run of `:42` on `mobile` passed: 1 of 1, exit 0, in 7.2 seconds. It left the recorded installation in the suite schema.
  - A separate untracked script held an open transaction that inserted a check row for the recorded repository. Then it started the unchanged `releaseRecordedGitHub`.
  - With no sleep, the script read `pg_stat_activity` until the release waited for the held transaction. The release waited at the `github_repositories` row that the installation delete cascades to. Then the script committed the held insert.
  - The diagnostic set `deadlock_timeout=1ms` to log the lock wait. It made no elapsed-time assertion.
  - The release exited with 1 on the recorded error, `update or delete on table "github_repositories" violates foreign key constraint "github_check_runs_repository_id_fkey" on table "github_check_runs"`. The stack ran from `sql` at `database-fixture.ts:12` and `releaseRecordedGitHub` at `database-fixture.ts:101`.
  - The release rolled back. The held check row, the repository and the installation stayed, one row each.
- Option A, the table lock, is not applied. No after-fix pass count exists.
