# Example Server Isolation

Status: Active. Created 2026-10-07. After the review of PR #148, the user
chose option B: the browser test example servers must never write to the same
place during a test run. The [decisions](#decisions) await the user's
approval. No milestone has started.

## Outcome

The browser test harness starts one `mokly serve` example server for each
Playwright worker. Today these servers share writable folders. After this
change:

- The first server's command prepares the comparison baseline for `HEAD`
  before that server starts. Every server then finds a complete baseline and
  only reads it. No server builds the baseline, and no server waits for a
  build.
- Each server writes Review output to its own folder.
- The protocol docs list the files that the servers share. They state that
  shared files are complete and read-only before the tests start. They name
  the baseline lock limit and the Review folders.

This is test-harness, example-configuration and documentation work. It does
not change product code under `src/` or `packages/`, the CI workflow, or the
browser specs.

Contract owners:

- [CI suite evidence](../docs/protocol/ci-suite-evidence.md). It owns Test
  Concurrency and gets a new Example Servers section.
- [CI verification](../docs/protocol/ci-verification.md). It owns the
  `--base HEAD` input rule.
- [Baseline storage](../docs/protocol/mokly-baseline-storage.md). It owns the
  cache layout and the entry lock limit. This plan links to it and does not
  change it.
- [Local verification](../xtask/README.md) and the
  [repository README](../README.md).

## Problem

This is item 2 (severity Low) of the PR #148 review.

- Each example server prepares the Changes baseline for `HEAD` in the
  background. All servers use one cache entry,
  `.mokly-cache/baselines/<commit>/`.
- A cold build copies the commit and runs `npm ci`, `npm run build` and
  `npm run example:build`. One server builds under the entry lock. The other
  servers wait for the lock.
- A server waits at most 120 s (`LOCK_TIMEOUT_MS`). After that, it shows
  Changes as unavailable. A `--no-watch` server never tries again.
- Global setup accepts "ready" and "unavailable", so a run can start with
  different Changes states on different servers.
- All servers also use one Review folder. No current spec writes it.

The failure needs more than one server, an empty cache entry and a build that
takes longer than 120 s. Default runs use one browser worker, and CI uses one
worker on 2-vCPU runners, so normal runs do not fail.

Planning evidence: `.context/example-server-isolation/planning.md`.

## Verified Facts

The investigation confirmed the review, with these corrections and additions:

1. The example Review folder is `examples/basic/.context/basic-review`.
   `review.outDir` resolves from the config file's folder, not from the
   repository root.
2. Each server also writes `examples/basic/generated/` once, after it binds
   its port. The generated-output writer lock makes these writes run one at a
   time. A server publishes its first final Changes state only after its write
   ends, so global setup already waits for every write.
3. Among the specs on the example server, only
   `tests/browser/design_library_runtime.spec.ts` needs live Changes "ready".
   The "Changes" link that `tests/browser/design_index_entries.spec.ts:33`
   clicks is inside a design mockup frame.
   `tests/browser/react_shell_hydration.spec.ts:57` clicks the live filter, but
   that button renders in every Changes state.
4. Only a full Review request writes the Review folder: `review.json` under
   `/__mokly/diffs/` without `path` or `page`. The viewer always adds `path`.
5. Playwright 1.61.1 runs the `webServer` setup tasks one at a time, in array
   order, and all of them before `globalSetup`. Each task waits until its `url`
   responds. The default limit is 60 s. A `--list` run starts no server. The
   `env`, `name`, `timeout` and `wait` options are documented.
6. A scratch run proved the design. After one call to
   `prepareReviewRepository(config, "HEAD")`, three servers started together,
   and each server reported a baseline cache hit. A cold preparation took
   34.6 s on the sandbox. A warm one took 1.1 s.
7. A cache hit still takes the baseline entry lock. For the example, each
   server held it for 0.8 to 1.0 s.
8. A scratch reproduction used two in-process servers, a 2 s fixture build and
   a 500 ms lock limit. It ended `unavailable, ready`. With the preparation
   first, it ended `ready, ready`.
9. On CI (2 vCPU, one worker), the hydration job took about 88 s from its
   worker line to its first passed test. That time includes the cold baseline
   build.

## Shared Writable Places

| Place                                          | Writer today                                   | After this plan                                                                    |
| ---------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| `.mokly-cache/baselines/<HEAD commit>/`        | The first server that takes the entry lock     | The preparation step, before any server starts. Servers take the lock for a check. |
| `examples/basic/.context/basic-review/`        | Any server that serves a full Review request   | Not used by the test servers. Each server uses `basic-review-<port>/` beside it.   |
| `examples/basic/generated/`                    | Every server, same bytes, under the write lock | Unchanged. The docs state that every write ends before global setup returns.       |
| `generated-output.lock` and the entry `lock`   | Servers, for short periods                     | Unchanged. Lock files only coordinate writers.                                     |
| `.mokly-write-*`, `.mokly-review-*` temp names | Each process                                   | Unchanged. Each name is unique to one process.                                     |

## Design

This section uses the recommended option of each [decision](#decisions).

### Prepare the baseline in the first server's command

- Add `scripts/verification/example-baseline.mjs` and its declaration file
  `scripts/verification/example-baseline.d.mts`.
  - Export `prepareExampleBaseline(options)`. It loads the config with
    `loadConfig` from `dist/config/load.js`. It calls
    `prepareReviewRepository(config, base, { signal, onProgress })` from
    `dist/review/prepare.js`. Serve uses the same function, so the cache entry
    has the commit, the output path and the build commands that
    `mokly serve --base <ref>` reads.
  - As a command, it accepts `--config <path>` and `--base <ref>`. The defaults
    are `examples/basic/mokly.config.ts` and `HEAD`. Follow the command pattern
    of `scripts/verification/prepared.mjs`.
  - It writes one line to standard error when it starts. It writes one more
    line when it ends: built, reused or failed.
  - SIGINT and SIGTERM abort the preparation. The builder then stops and
    drains its process tree.
  - A failed preparation prints the error and exits with status 0
    (decision 5). The servers then start and retry the build, as today.
- In `tests/browser/example_servers.ts`, add `exampleWebServers(options)`. It
  returns the `webServer` entries:
  - Every entry runs
    `node dist/cli/bin.js serve --config examples/basic/mokly.config.ts --base HEAD --port <port> --no-watch`.
    It keeps `reuseExistingServer: false` and waits for
    `http://127.0.0.1:<port>/`. It sets its Review folder variable through
    `env`.
  - The first entry runs
    `node scripts/verification/example-baseline.mjs --config examples/basic/mokly.config.ts --base HEAD`,
    then the serve command, joined with `&&`. Its start limit is 180 s
    (decision 4).
  - One constant holds the base `HEAD` for both commands.
  - Each entry has the Playwright `name` `example <port>` (decision 7).
  - Each entry sets `cwd` to the working folder. The default is the
    repository root, so the relative command paths work from a config in
    any folder.
  - Options let a test pass another config path, working folder and port
    list.
- `playwright.config.ts` uses `exampleWebServers({ ports })`.

Why the order holds: Playwright starts the next server only after the current
server's `url` responds. The first server's `url` responds only after the
preparation ends and `mokly serve` binds its port. Every other server therefore
starts after the baseline is complete. The wiring test in Milestone 2 fails if
a Playwright upgrade changes this order.

### Give each server its own Review folder

- `examples/basic/mokly.config.ts` reads `review.outDir` from
  `MOKLY_EXAMPLE_REVIEW_DIR`. An unset or empty variable keeps
  `.context/basic-review`. `npm run dev`, the docs and other commands therefore
  do not change.
- `exampleWebServers` sets the variable to `.context/basic-review-<port>` for
  each server. The path resolves from the config folder to
  `examples/basic/.context/basic-review-<port>/`.
- Mokly's config validation already checks the folder. `.context` is a denied
  source folder, so these folders never reach discovery, watches or Changes
  evidence. `.gitignore` already ignores them.

### Global setup

- Global setup keeps the worker guard. It keeps waiting up to 180 s for every
  server's first comparison. "ready" and "unavailable" both stay acceptable
  (decision 3).
- The wait now covers compilation, the generated-output write and
  classification. The baseline already exists when the servers start.

### Time limits

- New: the first server's start limit is 180 s. Playwright's default of 60 s
  is too short for a cold build.
- Unchanged: the 180 s global setup wait, the 120 s baseline entry lock, the
  120 s generated-output writer lock, the five-second preview load and every
  test timeout.
- The longest wait before the first test grows from 180 s to 360 s. Only a
  hung or failing start uses that time.

## Decisions

Each decision awaits the user's approval. The plan follows the recommended
option.

### 1. Where to prepare the baseline

- **A. Recommended.** The first server's command runs the preparation script,
  then `mokly serve`. This covers `npm run test:browser`, direct
  `npx playwright test` runs, `cargo xtask check` and CI, because all of them
  load `playwright.config.ts`. It depends on a Playwright internal: the
  `webServer` tasks run one at a time, in array order. The Milestone 2 wiring
  test protects that dependency. It fails when the baseline is not complete
  before the second server starts. This option needs a new start limit
  (decision 4).
- **B.** The first server's readiness waits for its own final Changes. Mokly
  has no route that answers only then. This needs a product change, or a
  `wait.stdout` pattern on the rich reporter's "Changes ready" text without a
  `url`. It depends on the same task order, ties the tests to user-facing
  text, and makes the first server finish its whole comparison before the
  others start. A wiring test would protect the order.
- **C.** A separate step in `npm run test:browser` and in
  `scripts/verification/run-browser.mjs`. It does not depend on Playwright
  internals and needs no new limit. Direct `npx playwright test` runs with
  `MOKLY_PLAYWRIGHT_WORKERS` above 1 keep the race. Two call sites must stay
  the same, so a test would compare them.
- **D.** Global setup prepares the baseline and starts the servers itself,
  without `webServer`. It does not depend on Playwright internals and needs no
  new limit. It needs a new process manager for several servers: start,
  readiness, log prefixes, and process-group stop on teardown, on setup
  failure and on Windows. This is the largest change. Tests would cover the
  manager.

### 2. How each server gets its own Review folder

- **A. Recommended.** The example config reads an environment variable.
  Playwright's documented `webServer.env` sets it for each server. Only the
  example config and the harness change.
- **B.** Generate one config file for each server. This adds generated files
  to the source tree and needs cleanup.
- **C.** Add a CLI flag or an environment variable to Mokly that overrides
  `review.outDir`. This changes the product, and this plan does not need it.

### 3. What global setup checks

- **A. Recommended.** Keep the worker guard and the wait for every server's
  first comparison. Keep "unavailable" acceptable, so that a broken historical
  build does not stop the tests that do not need Changes. With the
  preparation step, a mixed state needs a failed preparation and then a retry
  that only some servers finish.
- **B.** As A, and print one warning line for each server whose Changes end
  unavailable. This adds no new failure.
- **C.** Require "ready" from every server. This adds a new gate, and it is
  part of the review's option A, which the user did not choose.

### 4. Time limits

- **A. Recommended.** Give the first server a start limit of 180 s. That is
  the limit that global setup uses today for a whole cold comparison, and
  about twice the measured CI time. Keep every other limit.
- **B.** Give the first server 300 s for slower machines. Keep every other
  limit.
- **C.** Keep the total wait at 180 s: 120 s for the first server and 60 s for
  global setup. Both margins become smaller.

Options C and D of decision 1 need no new limit.

### 5. When the preparation fails

- **A. Recommended.** Print the error and exit with status 0. The servers
  start and retry the build, as today, and Changes can end unavailable. This
  follows the repository rule to prefer graceful handling. The wiring test
  still fails if the script breaks silently, because the servers then build
  the baseline themselves.
- **B.** Exit with a non-zero status. Playwright then stops before any test
  runs. This is a new hard failure.

### 6. The shared generated output

- **A. Recommended.** Keep the startup writes. Document that every server
  writes the same bytes under the writer lock, and that global setup waits
  until all writes end.
- **B.** Start each server only after the previous server's first comparison
  ends. No two servers then work at the same time. The start becomes slower
  and needs a readiness signal that follows Changes.
- **C.** Change Serve to skip the write when the output is current. This is a
  product change.

### 7. Server log names

The review's option A suggested these names. The user asked to decide first.

- **A. Recommended.** Give each server the Playwright `name` `example <port>`.
  Its log lines then start with `[example 4517]` instead of `[WebServer]`.
- **B.** Keep the shared `[WebServer]` prefix.

### 8. Review items 3 and 4 from PR #148

- **A. Recommended.** Include both, because this plan edits the same files.
  Item 3: correct the "whole spec files" text in
  `docs/protocol/ci-suite-evidence.md` and `xtask/README.md`, because the
  hydration route spec uses parallel mode. Item 4: add a unit test for the
  `--workers` guard in `tests/browser/setup.ts`.
- **B.** Include only item 3.
- **C.** Leave both open.

Out of scope unless the user asks: item 1 (browser specs with more than one
worker miss the five-second preview load), item 5 (the CPU-based defaults
have no upper limit) and item 6 (the `release.yml` fallback gate runs
hydration with two workers).

## Milestone 1: Define the contract

Write the server start sequence and the shared-file rule into the protocol
docs and the READMEs. Do not change code or tests in this milestone.

- [ ] Record the user's choice for each [decision](#decisions). If the user
      chose another option, change the design and the later milestones to
      match it first.
- [ ] In `docs/protocol/ci-suite-evidence.md`, add an `## Example Servers`
      section after `## Test Concurrency`, and move the example server
      paragraph into it. Write each limit as a number of seconds, such as
      `180 s`, so that a test can compare it with the code. The section must
      state:
  - [ ] one server for each Playwright worker, on consecutive ports;
  - [ ] the start sequence: the first server's command runs
        `scripts/verification/example-baseline.mjs` with `--base HEAD`, then
        `mokly serve`; Playwright starts each later server after the previous
        server's URL responds; the dependency on that order and the test that
        protects it;
  - [ ] the first server's 180 s start limit, and the 180 s global setup wait
        for every server's first comparison;
  - [ ] the shared-file rule: shared files are complete before the tests
        start, and during the tests the servers only read them;
  - [ ] each shared place and when it is written, as the
        [table](#shared-writable-places) lists them, including the short lock
        hold for a cache hit;
  - [ ] the 120 s baseline entry lock limit with a link to
        [Baseline Storage](../docs/protocol/mokly-baseline-storage.md#cache-layout),
        and the result of a longer wait: Changes unavailable, with no retry
        under `--no-watch`;
  - [ ] the Review folders: `MOKLY_EXAMPLE_REVIEW_DIR`, the
        `examples/basic/.context/basic-review-<port>` pattern and the default
        for other commands;
  - [ ] what global setup checks, and why "unavailable" stays acceptable;
  - [ ] what happens when the preparation fails; and
  - [ ] the boundary: another Mokly process that writes the same checkout,
        such as `npm run dev`, can still change shared files during a run.
- [ ] Find each statement in `ci-suite-evidence.md` that says mutable trees,
      generated directories or servers stay worker-, fixture- or job-owned.
      Qualify each one for the shared example files.
- [ ] Decision 8: in Test Concurrency, replace "Each spec file still runs in
      one worker because `fullyParallel` stays `false`" with text that names
      the hydration route spec's parallel mode as the one exception.
- [ ] In `docs/protocol/ci-verification.md`, Deterministic Test Repository
      Inputs, replace "every worker's server uses that same command". Name the
      preparation step, the shared serve command and the file that builds
      both. Keep `tests/deployment.test.ts` as the owner of the `--base HEAD`
      check.
- [ ] Keep `ci-suite-evidence.md` at or below 250 lines.
- [ ] Update the READMEs:
  - [ ] `xtask/README.md`: the example server sentence and, for decision 8,
        the "whole spec files" wording;
  - [ ] `README.md`: in the local test run text, say that the first server
        prepares the baseline once and that each server has its own Review
        folder; and
  - [ ] `examples/basic/README.md`: the Review folder variable and its default.
- [ ] Run `npx prettier --check` on the changed Markdown. Run
      `node --import tsx --test tests/protocol_doc_sizes.test.ts tests/protocol_structure.test.ts tests/protocol_split_links.test.ts tests/protocol_doc_history.test.ts tests/guides_ci.test.ts`.
      Review the diff.

Evidence: `.context/example-server-isolation/milestone-1.md`.

## Milestone 2: Prepare the baseline before the servers start

Capture the race in tests first, then add the preparation step. The milestone
ends with every test green.

- [ ] Use Node 24.21.0 from `.nvmrc`. Run `npm ci` and
      `npm run prepare:verification`.
- [ ] Move the `webServer` entries from `playwright.config.ts` into
      `exampleWebServers(options)` in `tests/browser/example_servers.ts`. Do
      not change their behaviour. Update
      `tests/verification_example_servers.test.ts` and the command check in
      `tests/deployment.test.ts`, then run both.
- [ ] Add the failure-first race test
      `tests/verification_example_baseline_race.test.ts`:
  - [ ] Use `derivedFixture`. Remove its `mockupsDir`, as
        `tests/derived_serve.test.ts` does. Write a fixture config whose
        `review.baselineBuild` first waits for a release file that the test
        creates, then runs `node baseline.mjs`. The gate makes the race
        independent of timing.
  - [ ] Inject one `CachedBaselineBuilder` with `lockTimeoutMs: 500` into two
        `serve()` calls with `base: "HEAD"`, `port: 0` and `watch: false`.
        Start both servers together.
  - [ ] Release the gate after the build starts and the other server reaches
        a final state, or after a short bound. Assert that both servers reach
        `data-changes-status="ready"`.
  - [ ] Run the test. Record that it fails: one server ends "unavailable" and
        reports `baseline-lock-timeout`.
- [ ] Add the failure-first wiring test
      `tests/verification_example_server_startup.test.ts`:
  - [ ] Write a small Playwright project under `.context/`, as
        `tests/verification_browser_discovery.test.ts` does, with its own
        output folder.
  - [ ] Create a derived fixture with a build that takes about 2 s. Find two
        free consecutive ports.
  - [ ] Call `exampleWebServers` in the test with the fixture config, the
        repository root as the working folder and the ports. Write the
        entries as JSON into the project's config. Put a test-only step
        before each command that records when the command starts.
  - [ ] The project's spec waits until both servers show a final Changes
        state. It asserts that both are "ready". It asserts that `finishedAt`
        in the fixture's `complete.json` is earlier than the start of the
        second command. The failure message says that Playwright may no longer
        start web servers one at a time.
  - [ ] Give the test a deadline that fits a 2-vCPU runner, and record its
        duration.
  - [ ] Run the test. Record that it fails with the unchanged harness.
- [ ] Add `scripts/verification/example-baseline.mjs` and
      `scripts/verification/example-baseline.d.mts`, as the
      [design](#prepare-the-baseline-in-the-first-servers-command) describes.
- [ ] In `exampleWebServers`, put the preparation step before the first serve
      command, give the first entry the 180 s start limit, and give every
      entry its `name` (decision 7).
- [ ] Change the race test. Create the release file, then call
      `prepareExampleBaseline` for the fixture before the servers start.
      Assert that both servers reach "ready". Keep a second case without
      preparation. It asserts the documented result: one server shows Changes
      unavailable and reports `baseline-lock-timeout`.
- [ ] Add `tests/verification_example_baseline.test.ts` for the script:
  - [ ] the arguments and their defaults;
  - [ ] the start and end lines for a built baseline and a reused baseline;
  - [ ] a failed preparation prints the error and exits with status 0; and
  - [ ] SIGTERM during a slow fixture build stops the build and leaves no
        build process.
- [ ] Decision 8: move the worker guard in `tests/browser/setup.ts` into a
      pure function. Test that a worker count above the server count fails
      with the current message.
- [ ] Extend `tests/verification_example_servers.test.ts`:
  - [ ] only the first command runs the preparation step, both commands use
        the same base, only the first entry has the 180 s limit, and each
        entry has its name; and
  - [ ] the documentation rules: `ci-suite-evidence.md` names the script and
        states, in seconds, the first server's start limit, the global setup
        wait and `LOCK_TIMEOUT_MS` from `dist/baseline/cache_layout.js`.
- [ ] Run the new and changed tests, ESLint on the changed files, and
      `npm run typecheck`. Both failure-first tests now pass.
- [ ] Smoke tests on the real example:
  - [ ] Remove `.mokly-cache/baselines/<HEAD commit>/`. Write a scratch
        Playwright config under `.context/`. It imports
        `playwright.config.ts`, keeps its `webServer` entries, gives
        `globalSetup` as an absolute path, and points `testDir` at a scratch
        spec. The spec asserts that every server shows Changes "ready". Run
        it with `MOKLY_PLAYWRIGHT_WORKERS=3`. Record one preparation line, the
        time to the first test and the result.
  - [ ] Run `MOKLY_PLAYWRIGHT_WORKERS=3 npm run test:hydration:prepared` with
        a warm cache. Compare the duration with the earlier 4m59s.
  - [ ] Remove the cache entry again. Run
        `npx playwright test --project=chromium tests/browser/design_library_runtime.spec.ts`.
        It needs Changes "ready".

Evidence: `.context/example-server-isolation/milestone-2.md`.

## Milestone 3: Give each server its own Review folder

Point each server's Review output at its own folder, and test that two servers
can write Review output at the same time.

- [ ] In `examples/basic/mokly.config.ts`, read `review.outDir` from
      `MOKLY_EXAMPLE_REVIEW_DIR`. Keep `.context/basic-review` when the
      variable is unset or empty.
- [ ] In `exampleWebServers`, set the variable to
      `.context/basic-review-<port>` through each entry's `env`.
- [ ] Add tests:
  - [ ] in `tests/verification_example_servers.test.ts`: every entry sets a
        different folder, each folder uses its entry's port, and no folder is
        the default;
  - [ ] a config test in the same file, or in a new file if that file grows
        past 300 lines: `loadConfig` on the example config resolves
        `review.outDir` to `examples/basic/.context/basic-review` without the
        variable and with an empty value, and to
        `examples/basic/.context/basic-review-4517` with the variable. The
        test restores the environment;
  - [ ] in the wiring test: the fixture config reads the same variable. When
        both servers are ready, request the full Review from both servers at
        the same time. Assert that both requests succeed, that each folder
        holds `.mokly-review-artifact` and `review.json`, and that the default
        folder does not exist; and
  - [ ] the documentation rule: `ci-suite-evidence.md` names
        `MOKLY_EXAMPLE_REVIEW_DIR` and the folder pattern that the harness
        uses.
- [ ] Run the new and changed tests, ESLint on the changed files,
      `npm run typecheck` and `npm run example:check`.
- [ ] Smoke tests:
  - [ ] Start the servers with `MOKLY_PLAYWRIGHT_WORKERS=2` through the
        scratch config. Request the full Review from both servers. Confirm
        two folders under `examples/basic/.context/` and no write to
        `basic-review`.
  - [ ] Run `npm run dev -- --base HEAD --no-watch --port 0`. Request the full
        Review. Confirm that it writes `examples/basic/.context/basic-review`.

Evidence: `.context/example-server-isolation/milestone-3.md`.

## Milestone 4: Verify and deliver

Run the complete gate, deliver the branch, and review it.

- [ ] Run `git fetch origin main`. If `main` moved, merge it as the
      Mainline Feature Preservation rules in `AGENTS.md` require: audit the
      additions from the captured source tip, resolve conflicts path by path,
      check for exactly two parents, and review the remerge diff.
- [ ] Run `npm run format:check`, `npm run lint` and `npm run typecheck`.
- [ ] Run `cargo xtask check` and require a 100% pass rate. An earlier
      sandbox session saw two failures on `main` that this work does not
      touch: the "Tailwind-shaped 20,000-file" test in
      `tests/postcss_dependency_review.test.ts`, and the `ordinaryPreview`
      fixture setup limit in `preview_navigation.spec.ts` and
      `preview_design_links.spec.ts`. If they occur, confirm that they also
      fail on `main` on the same machine, record that, and confirm the pass
      rate with CI.
- [ ] Inspect the diff and the deletions against `origin/main` with
      `git diff --name-status origin/main` and
      `git diff --diff-filter=D --name-status origin/main`. Expect no
      deletions.
- [ ] Tick the completed TODOs in this plan.
- [ ] Run `git add -A`, commit with a Conventional Commit title of at most 50
      characters, such as `test: isolate example server shared state`, and
      push the branch with every new file tracked. Inspect
      `git diff --name-status origin/main..HEAD` again.
- [ ] After the push, use `docs/implementation-review-prompt.md` to review the
      complete diff against `origin/main`. Report numbered findings with a
      severity, a category, an effort grade, lettered options, a
      recommendation and an `Auto-fix` tag. Then apply the review-fix rule
      from `AGENTS.md`: fix the `Auto-fix: yes` findings, run the checks,
      commit, push and review once more. Fix any new `Auto-fix: yes` findings
      once more, then stop. Add each open finding as one line under this
      TODO.

Evidence: `.context/example-server-isolation/milestone-4.md`.

## Risks

- A future Playwright version could start web servers at the same time. The
  wiring test then fails.
- After a failed preparation, the servers retry the build, so the old race can
  return for that run (decision 5).
- By default, Playwright stops a server's process group with SIGKILL. A stop
  during the preparation can leave the build's own processes running, as a
  stop during a server's build can today. The next run reclaims the lock of
  the stopped holder.
- The cache-hit check holds the entry lock for about one second per server.
  With many workers, the last server waits for the checks of the others.
- Another Mokly process that writes the same checkout during a run, such as
  `npm run dev`, can still change shared files. The docs name this boundary.

## Post-merge follow-up (non-blocking)

- Compare the browser and hydration job durations of the first `main` CI run
  after the merge with the CI run of the pull request.
