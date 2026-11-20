# Stabilize the catalogue request of static delivery

- **Severity:** Medium. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-01, from the 4-vCPU scratch CI run of the Linux CI
  runner size change, run 41327148872 attempt 1 on
  `calummoore/runner-size-measure-4vcpu`.
- **Location:** `tests/browser/design_catalogue.ts:24`, reached from
  `tests/browser/component_inspector_cases.ts:29`, and the static host of
  the delivery check. `tests/browser/setup.ts:82-95` starts that host
  through `tests/browser/hosts.ts:28-33`, and
  `tests/helpers/static_server.ts:15` creates its Node HTTP server.
- **Reason:** On 2026-11-19, ten repetitions under option B did not
  reproduce the failure, so its source is unknown and the next step needs a
  user decision.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Static delivery:** the CI job and remote gate command that builds the
    example catalogue and checks it through static HTTP and `file://` URLs,
    with `scripts/verification/static-delivery.mjs`.
  - **Catalogue request:** the `beforeAll` hook of `designCatalogue` in
    `tests/browser/design_catalogue.ts`. It reads
    `/mokly-viewer/index.json` with Playwright's request context.
  - **Delivery mode:** one of the two Playwright runs of static delivery,
    `static-http` or `file`, which both read the catalogue index from the
    static host over HTTP.
  - **Static host:** the Node HTTP server in `tests/helpers/static_server.ts`
    that serves the built example catalogue to the delivery check.
- **Background:**
  - Static delivery requires every assigned test to pass once in both
    modes. One failed test fails the job, and `Required CI` then fails.
  - On 2026-11-01 the Static delivery job failed once in its second mode,
    `file`. 650 tests passed, one failed, and two did not run.
  - The failed test was "portable inspector › desktop: inspector icons
    open, switch, and close without scripts". Its catalogue request failed
    with "Error: apiRequestContext.get: socket hang up" for
    `GET http://127.0.0.1:45469/mokly-viewer/index.json`.
  - A rerun of the failed jobs, attempt 2 of the same run, passed.
  - The run used `blacksmith-4vcpu-ubuntu-2404`. The VM had 15.4 GiB and a
    median CPU use of 41 percent, so CPU load is an unlikely cause. The
    runner size change changed only runner labels, so the failure lay
    outside it.
  - The failure text did not occur in the nine failed `main` runs from
    2026-10-29 to 2026-11-01.
  - Suspected source: a keep-alive race. It is a hypothesis, and no
    evidence confirms it:
    - In a worker process, Playwright 1.61.1 sends API requests through one
      shared keep-alive connection pool, which separate request contexts can
      share. A disposed request context leaves its idle connections in that
      pool.
      So a new request context alone does not guarantee a new connection.
    - The static host sets no timeout option. Node 22.15.0 then advertises
      a keep-alive timeout of 5 seconds. It adds an internal buffer of 1
      second, so its internal idle timeout is 6 seconds.
    - The race: the catalogue request reuses an idle connection at the
      moment that the static host closes it.
    - The failure log does not show whether the request reused a
      connection, or which side closed it.
    - Nobody reproduced the failure.
  - On 2026-11-19, the user asked for the work of option B. The **Action**
    line then said `fix after merge, apply B`: reproduce the failure first,
    then make the request deterministic. The user also asked for the CI
    history search below.
    For a result with no reproduction, the user asked for no code change,
    the run counts, the runners, and the result in this item. The user
    also asked for a decision that keeps the options of this item.
  - CI history search of 2026-11-19. It is a snapshot of the runs of
    `.github/workflows/ci.yml` created from 2026-11-01 to 2026-11-19, both
    days included:
    - This command listed the runs from 2026-11-02. A second `gh run list`
      command with `--created 2026-11-01` listed the first day.

      ```text
      gh run list --repo mokly-ai/mokly --workflow ci.yml --created '>=2026-11-02' --limit 1000 --json databaseId,headBranch,headSha,event,conclusion,createdAt,attempt,url
      ```

    - The two lists hold 358 runs. 352 of them ran for `main` or for a pull
      request. The other 6 were manual `workflow_dispatch` runs on other
      branches, and each passed in its latest attempt. The original run is
      one of the 6.
    - At query time, the latest attempts of the 352 runs gave these
      results: 234 passed, 61 failed, 51 were cancelled, and 6 were still
      running.
    - The search read the job list of 143 run attempts. These are the 118
      latest attempts that did not pass and the 25 earlier attempts of 22
      rerun runs. A passed latest attempt with no earlier attempt cannot
      hold a failed job, so the search did not read it.
    - The 143 attempts hold 172 Static delivery jobs: 132 passed, 1 failed,
      35 were cancelled, and 4 were still running.
    - The only failed Static delivery job is run 44396275746, attempt 1, job
      135126948360, on 2026-11-18. It ran on `blacksmith-4vcpu-ubuntu-2404`
      for a pull request from branch `conductor/storybook-support-a-mockups`.
    - Its log, from `gh run view --attempt 1 --job 135126948360 --log-failed`,
      shows a different failure:
      - The job stopped in its first mode. 16 tests failed, 566 did not run,
        and 71 passed.
      - Each of the 16 tests failed with "Error:
        expect(received).toEqual(expected) // deep equality" at
        `tests/browser/design_catalogue.ts:40`. This assertion runs after the
        catalogue request returned the index.
      - The branch added three design screens that the expected list of the
        test did not name: `design/components/states/stories/story-failed`,
        `design/components/states/stories/story-failed-changes`, and
        `design/components/states/stories/storybook-link`. They are not on
        `main`.
      - The log has no "socket hang up" text, no `apiRequestContext.get`
        error, and no other transport error of the catalogue request.
    - The log of the original run, 41327148872 attempt 1, still confirms the
      failure text above.
    - Result: in this snapshot, the failure of the catalogue request did not
      occur again.
    - The runner label of the Static delivery job in `ci.yml` on `main`:
      - Before 2026-11-01 17:48:43 UTC: `blacksmith-8vcpu-ubuntu-2404`.
      - From then: `blacksmith-4vcpu-ubuntu-2404`, the label of the original
        failure. PR #278, commit `d0000b543`, made this change.
      - From 2026-11-19 10:58:42 UTC: GitHub-hosted `ubuntu-24.04`. PR #342,
        commit `09db57306`, made this change.
    - Of the 352 runs, 69 were created before PR #278 changed the label, 247
      between the two changes, and 36 after PR #342. Of the 133 inspected
      Static delivery jobs with a result, 119 started before PR #342 changed
      the label, and 14 after it.
    - Limits of this evidence:
      - The counts are a snapshot at query time. The 6 runs and the 4 Static
        delivery jobs that were still running had no result then.
      - A cancelled job gives no complete result.
      - The search read only runs of `ci.yml` for `main` and pull requests.
        It did not read attempt 1 of manual run 41329583918, which passed on
        attempt 2. It read no local run.
      - Only 14 inspected job results came from GitHub-hosted runners. The
        search does not show that the move to these runners fixed the
        failure.
      - A period with no other failure does not show that the source is
        gone. The source stays unknown.
  - On 2026-11-19, `main` at commit `cdced5e96` still reads the catalogue
    with `request.get` at `tests/browser/design_catalogue.ts:24`.
    `tests/browser/setup.ts` still starts the static host of the delivery
    check.
  - Repetitions under option B, on 2026-11-19:
    - GitHub Actions run 44624858144, attempt 1, ran 10 separate jobs of a
      temporary workflow. Each job used a GitHub-hosted `ubuntu-24.04`
      runner, Node 22.15.0, npm 11.21.0, Playwright 1.61.1, and Chromium.
    - Each job repeated the setup of the CI Static delivery job: `npm ci`,
      the Chromium install, and `npm run build`. Then it ran the unchanged
      delivery command once:

      ```text
      npm run test:delivery:prepared
      ```

    - The jobs tested commit `f86e2c3e2cff148fea3d054a7cbd9f3895407f90`.
      That temporary commit added only the repetition workflow and the CI
      history search above to `main` at `cdced5e96`. It changed no test,
      host, or product code. The branch no longer holds it.
    - Every job used one Playwright worker. `playwright.config.ts` sets
      `retries: 0`, so no test was retried. No job was rerun.
    - All 10 jobs passed. In each job, both delivery modes ran. Each mode
      passed 653 tests, with 0 failed and 0 skipped.
    - Totals: 10 of 10 complete runs, 20 of 20 modes, and 13,060 test
      passes. Each mode report observed each of the 653 expected tests
      once.
    - The 10 delivery logs hold no "socket hang up" text, no
      `apiRequestContext.get` error, and no `ECONNRESET`, `ECONNREFUSED`, or
      `EPIPE` error.
    - Result: the repetitions did not reproduce the failure, and they named
      no source. No code changed.
    - Limits of this evidence:
      - The original failure ran on `blacksmith-4vcpu-ubuntu-2404`. CI no
        longer uses that runner, so the repetitions ran on another runner
        type. This difference is not a known cause.
      - The logs record no connection events. So a failure in these runs
        would also not show which side closed the connection.
      - 20 clean modes do not show that the failure is gone. They give no
        failure rate.
- **Problem:** The catalogue request can fail before its test starts, so a
  healthy delivery run can fail. The source of the one recorded failure is
  unknown.
- **Impact if no action:** A healthy CI run or remote gate can fail, and
  the developer must rerun it.
- **Root question:** What work should follow the unreproduced failure of the
  catalogue request?
- **Options:**
  - **A.** Change nothing, and rerun a failed job. Effort: Small.
  - **B.** Reproduce the failure by repeating the delivery run. Name the
    source. Then make the request deterministic, and add no retry. One way
    is a new connection for the catalogue request. Another way is a static
    host that keeps idle connections open longer than the request context
    does. Effort: Medium.
- **Left out:**
  - A retry of the request. The flaky-test rule of the `testing` skill
    forbids a retry.
  - A fix before a source is named. It can change code that is not the
    cause, and the same rule needs a named source before a fix.
  - Only two approaches are real. Each fix that rests on evidence needs a
    named source, so it is part of B. A retry breaks the flaky-test rule,
    which still applies.
- **Wider fix:** B, when the named source lies in the static host, because
  a fix there covers every request of the delivery check.
- **Previous examples:** None found.
- **Recommendation:** B. It is the only option that can remove the failure.
  It keeps every assertion, and it changes no code until evidence names the
  source. A costs less now, but a healthy run can still fail, and A does not
  look for the source.
- **Action:** ask the user, because the source remains unknown after ten
  clean repetitions on 2026-11-19, so no option is clearly best.
