# Large React Changes test counted two classifications

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-17, from the complete gate of the branch
  `calummoore/mokly-keep-base-side-in-memory-2-hjj4` at commit `0158b4dc3`.
  An options check of the same day corrected and extended it.
- **Location:** `tests/browser/large_changes.spec.ts:73` and `:94` to line
  96, `tests/browser/large_watch.spec.ts:65`,
  `scripts/large/comparison_profile.ts:14` to line 54,
  `scripts/large/benchmark.ts:217`, `scripts/large/setup.ts:20` to line 41
  and `:65`, `tests/fixtures/large/generate.ts:65` to line 83,
  `crates/mokly-cli/src/serve_watch.rs:93` to line 143,
  `crates/mokly-cli/src/serve_watch_files.rs:19` to line 21,
  `crates/mokly-server/src/background.rs:57`,
  `crates/mokly-server/src/changes_background.rs:82` and line 97, and
  `crates/mokly-server/src/publication.rs:279` to line 293.
- **Reason:** The test failed once in a complete gate of a branch that does
  not change it, its harness, its fixture setup, or the startup replay code,
  and the unchanged test passed on the rerun. Under the decision of
  2026-11-17, the failure is fixture timing, and F with E go to a separate
  branch.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Large benchmark harness:** the opt-in scripts under `scripts/large/`.
    The test runs their `changes` scenario on a tiny generated fixture.
  - **Classification:** one Changes comparison that Serve runs in the
    background. Its core timing span is `changes.classify`.
  - **Startup replay:** after a preparation finds input files that the
    watcher does not observe yet, Serve attaches the watcher and replays a
    change for each such file that changed since shortly before the window
    start that `begin()` sets.
  - **Owner replacement:** a new published state with new documents. Serve
    then cancels the running classification and starts a new one.
  - **Harness evidence:** the files that the harness writes under `.context/`
    of the fixture root: `measurements.json`, and the log and the
    `-timings.json` file of each state.
- **Background:**
  - `tests/browser/large_changes.spec.ts:12` defines "large changes
    delivers browser evidence for html" and "large changes delivers browser
    evidence for react". Each test prepares a fixture at line 20 and runs the
    `changes` scenario with one sidecar at line 27. It checks a cold result
    and a warm result, each from its own Serve process.
  - Line 73 asserts `result.comparison.length === 1` for each result. A
    failure prints only the default message, such as `2 !== 1`.
  - The `finally` at line 94 to line 96 removes the fixture root, with its
    harness evidence. `tests/browser/large_watch.spec.ts:65` does the same in
    the large watch spec.
  - `scripts/large/benchmark.ts:217` fills `comparison` with
    `comparisonProfile(running.timings)`. `comparisonProfile`, at
    `scripts/large/comparison_profile.ts:14` to line 22, keeps every core
    `changes.classify` end event. It does not check the span status, so a
    cancelled classification also counts.
  - The harness already keeps the `id` and the `status` of each record, at
    `comparison_profile.ts:48` to line 54. `scripts/large/run_output.ts:26`
    to line 40 writes the log and the timings of each state.
  - A `changes.classify` span starts with `status = "error"` and records
    `ok` only when it publishes, at
    `crates/mokly-server/src/changes_execution.rs:22`.
    `docs/protocol/mokly-timings.md:19` allows only `ok` and `error`. So the
    status cannot tell a cancelled classification from a failed one.
  - `prepareFixture` at `scripts/large/setup.ts:42` generates the fixture at
    line 58, calls `prepareToolchain` at line 60, and calls `commitFixture`
    at line 65. `commitFixture`, defined at line 20, commits the fixture,
    appends an unrelated CSS rule at line 35 to line 39, and returns. The
    test then starts Serve at once. Correction: the first version of this
    item named line 20, the definition, as the call.
  - For the React variant, `tests/fixtures/large/generate.ts:65` to line 83
    writes six files outside the configured `specs` root at line 43: four
    modules under `src/`, `renderer.tsx` at line 79, and `theme.ts` at line
    80 to line 83. The HTML variant has no such files. Correction: the first
    version missed `theme.ts`.
  - `WatchedInputs::candidate` at `crates/mokly-cli/src/serve_watch.rs:111`
    finds the inputs that the watcher does not observe yet, at line 121. Its
    `replay` at line 93 calls `serve_watch_files::changed` at
    `crates/mokly-cli/src/serve_watch_files.rs:64`. That call counts a write
    from up to 100 ms before the window start, at line 19, or up to two
    seconds before it for whole-second modification times, at line 21.
  - The window starts when `begin()` runs, at `serve_watch.rs:107`
    to line 110. `serve_preparation::initial` calls it before the first
    `prepare`, at `crates/mokly-cli/src/serve_preparation.rs:37`. That call
    comes after `ServeServices::new` loads the configuration, at
    `crates/mokly-cli/src/entry_serve.rs:88`, `:146`, and `:157`.
  - The test `files_changed_from_the_margin_before_the_start_until_now_replay_once`
    at `crates/mokly-cli/src/_tests_/serve_watch_stale_tests.rs:74` pins this
    replay. It came with PR #222, commit `140bb0ef8`.
  - `UsagePass::run` at `crates/mokly-server/src/background.rs:41` starts
    Changes again when the published documents change, at line 57, also when
    the generation string stays the same. `SharedPublication::replace`, at
    `crates/mokly-server/src/publication.rs:279` to line 293, checks the
    deployment, the render token, and the next revision, but not the
    generation key.
  - `crates/mokly-server/src/changes_background.rs:82` cancels the running
    classification when its origin is no longer current. The reference poll
    at line 96 to line 98 also cancels it and queues new work. Line 97
    compares `next.as_ref().ok()` with `expected`, so a failed read also
    restarts it. The poll runs `git --no-optional-locks rev-parse --verify`
    for HEAD and for the base, at
    `crates/mokly-cli/src/serve_changes_native.rs:37` to line 70. The harness
    passes the base commit id, at `scripts/large/benchmark.ts:39` to line 41.
    So in this test only a failed read can restart through the poll.
- **Problem:**
  - On 2026-11-17, the complete gate at commit
    `0158b4dc379f0953d82d7e781b030e4127502991` ran 2,287 browser tests. Only
    "large changes delivers browser evidence for react" failed. The other
    2,286 tests passed, with no skip and no cancellation.
  - The failure text was
    `AssertionError: Expected values to be strictly equal: 2 !== 1`, at
    `tests/browser/large_changes.spec.ts:73:16`. So one result had two
    `changes.classify` records.
  - The browser trace showed the cold result at ready revision 8 and the warm
    result at ready revision 7. Both had the same live generation and the
    same ready comparison generation. The report did not show which result
    had two records, or the status of the extra record.
  - Trace comparison: in the failed cold run, revisions 3 to 5 were
    `pending`, 6 `preparing`, 7 `pending`, and 8 `ready`. In a passing cold
    run, revisions 1 to 3 were `pending`, 4 `preparing`, 5 `pending`, and 6
    `ready`. Both warm runs had `preparing` at revision 5 and `ready` at 7. So
    the failed cold run had two extra `pending` revisions before its only
    `preparing` revision. This points to the cold process and to one extra
    publication before the delivered classification began. It is not proof:
    only one passing sample exists, and its cold and warm counts already
    differ by one.
  - Rerun outcome: after the branch merged `main` with PR #300 as
    `134244c52`, the unchanged test passed 1 of 1. The test took 9.3 seconds,
    and setup and execution took 46.9 seconds.
  - CI history: on 2026-11-17, a search of the CI runs since 2026-11-01 found
    no failure of `large_changes.spec.ts`.
  - A diagnostic run of the same harness on the same fixture with one
    sidecar also passed. It recorded one successful cold classification, one
    successful warm classification, and no `watch.action` span. The React
    modules were written 35.08 ms before the benchmark call.
  - Window timing in that run: the first `config.load` of the cold core ran
    from 11 ms to 71 ms on its own clock, and the next one, inside the first
    preparation, started at 90 ms. So `begin()` came at least 106 ms after
    the React writes, before the Node and shim start-up time is added. The
    100 ms margin then needs a cold path to `begin()` that is faster than in
    that run. The two-second margin needs a modification time with no
    sub-second part, and the fixture times have sub-millisecond parts.
  - Suspected source, not confirmed: a React input falls in the startup
    replay window. The replay rebuilds once before the first Changes result
    is ready. The new publication replaces the owner, so Serve cancels the
    first classification and runs a second one. Both `changes.classify` spans
    end, and `comparisonProfile` counts both. The window timing above shows
    that this trigger is possible, but the evidence does not show it.
  - The test, the harness, the fixture setup, and the startup replay code
    match `origin/main` byte for byte. The branch changes how Serve keeps the
    base and cancels its readers, so an interaction with that change is not
    excluded until the suspected order fails on `main` too.
  - A native watch event, or a failed read of the reference poll, could also
    restart the classification. Correction: the first version named a
    changed Git reference. HEAD and the base do not change after setup, so
    only a failed read can restart through the poll.
  - The same class: a failure of the large watch spec also keeps no harness
    evidence, because its `finally` at
    `tests/browser/large_watch.spec.ts:65` removes the fixture root.
  - Repetitions, 2026-11-17: the exact React test ran 30 times on the branch
    at `134244c52` and then 30 times on `main` at `794b30a91`, on the same
    idle machine, with one worker, Git 2.50.1, and Bun 1.4.4. There was no
    retry and no skip. The branch passed 29 and failed 1. `main` passed 30
    and failed 0.
  - The failed branch attempt failed in its cold result with `2 !== 1`. On
    the core clock of that process, a watch rebuild, `watch.action`, ran from
    1,561 ms to 2,537 ms and ended `ok`. The first classification ran from
    2,411 ms to 2,543 ms and ended `error`. The second ran from 2,572 ms to
    5,572 ms and ended `ok`. So the first classification started 126 ms
    before the rebuild ended, and it ended 6 ms after it. The cold index was
    ready at revision 8, and the warm index at revision 7.
  - Cold watch rebuilds happened in 23 of the 30 branch attempts and in 25 of
    the 30 `main` attempts. Only the failed branch attempt started its first
    classification before its rebuild ended. Every `main` classification
    started at least 149 ms after its rebuild ended. No warm process had a
    rebuild. The files that triggered the rebuild were not recorded.
  - A cold Serve process has an empty kept-base slot, so `ServeBase::find_kept`
    runs no freshness check there. The checkout sample of the base
    preparation comes after the watch start.
  - An excluded first diagnostic of 2026-11-17 passed one run with Git 2.43.0
    and Bun 1.3.14, not with the pinned tools of the repetitions. Neither of
    its processes had a watch rebuild. It is kept here as evidence, not as a
    comparison.
  - A compact diagnostic of 2026-11-17 ran the exact test once on the branch,
    with Git 2.50.1 and Bun 1.4.4, after a build that exited 0. It passed 1
    of 1, with no retry and no skip. The test took 12.1 seconds, and 58.2
    seconds with setup. The cold and the warm process each ran one
    classification, with no `watch.action`, no accepted drain event, and no
    non-access native event.
  - In that run, temporary diagnostics recorded the replay window. The cold
    `src/` modules were written 123.834810 ms before `begin()`, outside the
    100 ms margin, so none was replayed. In the warm process they were
    6,395.745145 ms before `begin()`.
  - The compact run shows no sign that the branch starts classification
    earlier, or keeps the rebuild window open longer, than `main` on the same
    fixture. The exact trigger of the rebuild in the failed attempt stays
    unrecorded. A startup replay is plausible, but not proven.
- **Impact if no action:** The browser suite can fail at random on a correct
  change, and each failure costs a gate rerun. A real change in the number
  of classifications can hide behind the flake. Each failure also deletes the
  evidence that a cause investigation needs.
- **Root question:** Why does one Serve process of the large Changes test
  record a second classification when no input changes after setup, and how
  does the test keep its count of one on every run, with the assertion at
  line 73 kept?
- **Assumptions:**
  - A to D, and the fix clause of A, keep Serve's restart of Changes for
    every new owner, also for the same generation. Source: the code, at
    `background.rs:57`, `changes_background.rs:82`, and
    `publication.rs:279` to line 293. It is not a requirement: no rule in
    `docs/protocol` requires a restart for the same content, and the count
    exists to catch that repeated work. H drops it.
  - A to D keep the scenario on watching Serve. Source: the code, at
    `scripts/large/benchmark.ts:162` to line 174. The scale benchmark in
    `docs/protocol/mokly-timings.md` does not set the watch mode, so coverage
    of the default mode is a preference, not a requirement. G drops it, at a
    coverage cost.
  - The first root question, A, and B assume that the startup order is the
    cause. Source: the leading hypothesis of the first diagnosis. The trace
    supports part of it, because it points to the cold process. The window
    timing does not show it. E and F drop it, because they record evidence
    instead of assuming a cause.
  - A to D send the work to a separate branch. Source: the rule for unrelated
    flaky tests in the `testing` skill, because the diff does not touch the
    test. This holds for the route, but it does not prove that the cause is
    outside the base retention change of the branch. E and F give that
    evidence at the next failure.
- **Options:**
  - **B.** Give each generated fixture file a fixed modification time well
    before the commit, in the fixture setup, so that no setup write falls in
    the replay window. It removes the suspected race without a sleep, and it
    applies to every large fixture. It is the likely direct fix when evidence
    confirms the replay. It does not help if the source is another restart.
    As written, it also misses the CSS rule that `commitFixture` appends
    after the commit, at `scripts/large/setup.ts:35` to line 39, the last
    setup write. Effort: Small.
  - **C.** Make the harness record the status and the span identifier of each
    `changes.classify` record in its report, and change no assertion.
    Correction: this is already in place. `comparison_profile.ts:48` to line
    54 returns the `id` and the `status`, `benchmark.ts:217` puts them in the
    report, and `run_output.ts:26` to line 40 writes the timings. The test
    loses them at its failure message and in its `finally`. So C as written
    changes nothing, and E and F carry its purpose. Effort: Small.
  - **D.** Count only the classification that produced the delivered result.
    The assertion at line 73 then no longer catches a cancelled or repeated
    classification, so this loosens what the test checks. The `testing`
    skill sends that choice to the user. Effort: Small.
  - **E.** Give the assertion at line 73 a message that keeps the count and
    names the state, `cold` or `warm`, and the `id`, the `status`, and the
    `durationMs` of each record in `result.comparison`. The assertion stays.
    A custom message replaces the default `2 !== 1` text, so the message must
    hold the count. It costs nothing when the test passes. A cancelled, a
    replaced, and a failed classification all end with `status: "error"`, so
    E names the extra record but not its trigger. Effort: Small.
  - **F.** Add one helper that each large browser spec calls in its `finally`
    before it removes the fixture root. When the test fails, the helper
    attaches the harness evidence to the Playwright result. These files hold
    the `id` and the `status` of every `changes.classify` record and every
    `watch.action` span. So the next failure names the process and the extra
    record. Correction: the first version also said that it names the
    trigger. The closed cause report of 2026-11-17 shows that the logs and
    timings record each `watch.action` and its action, but not the watched
    paths, and not whether an event was native or a startup replay. So the
    saved files keep the span `id`, `status`, and duration, and they can
    prove that a watch rebuild overlapped a classification. They cannot
    promise the exact trigger. It also covers
    `tests/browser/large_watch.spec.ts`, which deletes the same evidence. It
    adds about 1.6 MB of attachments to each failed run, from the file sizes
    of a passing run. A rerun replaces the Playwright output folder, so the
    attachments must be copied before a rerun. Effort: Small.
  - **G.** Run the `changes` scenario of this spec with `--no-watch`, through
    a harness option. Serve then has no watcher and no startup replay. It
    probably has no reference poll too, because
    `crates/mokly-cli/src/entry_serve.rs:202` passes `!options.no_watch` as
    `watching`. Nobody traced that value to `ChangesPass` yet. The assertion
    stays. The test then stops covering watching Serve, the default mode, so
    a repeated classification there fails no test. The `testing` skill sends
    that loss of coverage to the user, as it does for D. Effort: Small.
  - **A.** First search the CI history of `main` for this failure text. It can
    settle the branch question with no runtime work. That search found no
    failure since 2026-11-01, as the problem says. Investigate at runtime
    only when the retained evidence of a natural failure cannot name the
    source. Then, in a separate branch and on an isolated fixture with an
    unchanged binary, hold a React input in the replay window during the
    first compilation. Record the accepted watch action, the status and the
    span identifier of each classification, and the delivered index. Run the
    same case on `main`. Fix the confirmed source with an explicit readiness
    signal or event order, and keep every assertion. Correction: the pinned
    replay always replays a forced write in the window, so the forced case
    very likely shows the mechanism on the branch and on `main` alike. It
    does not show that the gate run met that mechanism. Effort: Medium.
  - **H.** Make Serve keep the running classification when a rebuild publishes
    the same generation key. Another way is to skip the publication of an
    identical generation. Then a rebuild that changes no content does not
    restart Changes, whatever starts it: a startup replay, or a native event
    for a file whose content stays the same. It is a product change in the
    publication path, in the area that this branch changes. It needs a check
    of the protocol rules for revisions and restarts, care for state outside
    the generation key, such as warnings, a user decision, and its own
    regression test. It does not cover a restart after a failed reference
    read. Effort: Large.
- **Left out:**
  - A retry, a sleep, a longer time limit, a skip, or an expected count of
    two or fewer. The `testing` skill forbids them, because they hide the
    source. A delay between the setup and the Serve start is a sleep, so it
    stays out too.
  - Remove or shorten the startup replay. The replay keeps an edit that
    arrives during startup, and its own test pins it. A change there is a
    product change that the evidence does not justify. The passing run does
    not show that a setup write reached its 100 ms margin.
  - A separate option for the reference poll. In this test only a failed
    `git rev-parse` read can restart through it, and no evidence points to
    one.
  - A separate option for the CI history of `main`. It is the first step of
    A.
- **Wider fix:** H, the structural fix: a rebuild that changes no content no
  longer restarts Changes, whatever starts it. F is the detection fix, in
  place of C: each later failure of a large spec keeps its evidence for a
  cause investigation, but that evidence alone may not name the trigger. B
  is a direct fix only: it must know the detail that failed, and it does not
  help for another trigger.
- **Previous examples:**
  - `plans/follow-ups/flaky-large-watch-react.md` records that PR #222 found
    an extra startup rebuild in the large React watch test, which caused two
    404 responses. PR #222 fixed that rebuild on 2026-10-28.
- **Related:**
  - `plans/follow-ups/flaky-large-watch-react.md`: the same React fixture and
    harness, in `tests/browser/large_watch.spec.ts`. That item covers rare
    timeouts, not a count. Option F of this item also keeps the evidence of
    that spec.
  - `plans/follow-ups/watch-resource-attach-gap.md`: the same startup replay
    code, about edits that the replay can miss. A fix there must keep the
    count of this test.
- **Recommendation:** F, with E in the same change. The options check of
  2026-11-17 changed the recommendation from A. F and E are Small, keep
  every assertion, and need no runtime experiment. They make the next
  natural failure name the process and the extra record, and show whether a
  watch rebuild overlapped the classification. That saved evidence supports
  a cause investigation, which may still need a narrow diagnostic to name
  the trigger. H best protects the codebase, because it removes a restart
  that changes no content.
- **Decision:** On 2026-11-17 the performance orchestrator answered this item
  for the user, with a condition:
  - First run the exact test "large changes delivers browser evidence for
    react" 30 times on the branch, at commit `134244c52` or later. Then run
    it 30 times on `main` at commit `794b30a91`. Use the same machine, and run
    no other runtime work at the same time. Only a temporary, uncommitted
    change that keeps the failure logs is allowed.
  - When the branch fails one or more times and `main` fails none, find and
    fix the branch defect before the pull request.
  - Otherwise, the test is an unrelated flake. Leave the test unchanged, and
    record `fix after merge, apply F with E`, with the counts.
  - D, G, and H are rejected for now.
  - Result of the repetitions: the branch failed 1 of 30 and `main` 0 of 30,
    so the branch-defect criterion held at first.
  - A later decision of the performance orchestrator, also of 2026-11-17,
    qualifies that criterion. One compact diagnostic with the pinned tools
    decides. If it shows that the branch starts classification earlier, or
    keeps the rebuild window open longer, than `main` on the same fixture,
    fix that cause, keep the assertion, and run 30 branch cases again. If it
    does not, record fixture timing and defer F with E to a separate branch.
    Its reason: the startup rebuild begins before classification, the empty
    cold slot runs no freshness check, and `main` also performs startup
    rebuilds.
  - Outcome: the compact diagnostic showed neither. So the failure is
    fixture timing, and this branch makes no test change and no product
    change for it.
- **Action:** fix after merge, apply F with E, in a separate branch, because
  the later decision of 2026-11-17 classified the failure as fixture timing
  and deferred F with E.
