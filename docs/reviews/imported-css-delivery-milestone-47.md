# Imported CSS Delivery Milestone 47 Review

## Scope And Outcome

This review covers [Imported CSS Delivery](../../plans/imported-css-delivery.md)
Milestone 47. It ran on 2026-10-02 after `108310a7` was pushed, using
[the implementation review prompt](../implementation-review-prompt.md) against
`origin/main` at `b4a02a30`. One read-only reviewer examined the changes since
`5a779f06`:

- `77a1f493` (Milestone 46) fixed the flaky imported-CSS watcher tests of
  Milestone 40 finding 12, by the user's decision. The tests now wait for
  explicit signals: the watch failure report, watcher and rebuild callbacks,
  and a shared helper that follows the event stream across Serve child
  restarts until the expected stylesheet or asset bytes are served. A new
  server-level test checks that an accepted stylesheet is served when its
  content update is announced. No product code changed.
- `0a3d1710` and `108310a7` updated the review records and the plan.

Findings that remain open in earlier records are not repeated.

The changes work as intended:

- No product defect was found. A restarted child already has the new styles
  when it announces readiness, and an in-place rebuild installs them before
  its update is announced.
- Under six-way parallel load, the parent session ran each fixed test 24 times
  without a failure. Before the fix, the worker-close test failed all 24 runs.
  The reviewer ran the worker-close test 18 more times under the same load,
  without a failure.
- The worker tests check more than before. The other changed tests check as
  much as before, except as findings 1 and 3 describe.
- No line of `main`'s own test files changed, and nothing was deleted or
  moved.
- PR #125's CI passed after one re-run. In the first run, `main`'s browser
  test "desktop: an appearance artboard draws one scheme control and previews
  that follow it" failed once with "Execution context was destroyed", because
  the preview frame reloaded while the test read it. This branch does not
  change that test, and it passed on every earlier run of this PR.

The reviewer confirmed each finding by changing code in a scratch copy and
running the tests. The parent session confirmed the test gaps and the wording.
Findings later resolved carry a resolution note; the others remain open for
the user's decision.

## Findings

1. **Medium — nothing now checks, across Serve's two processes, that new CSS
   is served when the reload is announced, but the records say it is
   checked.**
   - Context: watched Serve runs in two processes. The parent watches files
     and rebuilds; the child serves the catalogue. After a CSS edit, the
     parent sends the child the new styles and then an update. The child
     installs the styles and then announces the update on its event stream,
     and browsers reload. The protocol requires that the accepted styles and
     the reload event advance together (`docs/protocol/mokly-watch.md`, lines
     31–32). If the child announced first, a browser would reload onto the old
     CSS and stay there, because later Changes-only updates do not reload the
     page.
   - The product is correct today. The parent sends the styles first
     (`src/server/serve_watched.ts:224-233`, `src/server/supervisor.ts:197-204`),
     and the child installs them before it announces
     (`src/server/child.ts:100-113`).
   - Evidence from code changes in a scratch copy:
     - With the child installing the styles 100 ms late, every test that
       starts watched Serve still passed, and so did the new server-level
       test. Only the old version of "real watcher reloads an imported entry
       stylesheet beneath dist" failed, because it read the stylesheet once at
       the reload event. The new version waits through later updates, as the
       protocol asks of tests that use the real watcher.
     - The new server-level test (`tests/watched_content_resource_order.test.ts`)
       performs the install and the announcement itself on an in-process
       server. It catches a delay inside the server, but it never runs the
       child process or its message handling.
     - `main`'s test "watched live keeps catalogue and component generations
       together" (`tests/component_runtime_staging.test.ts:52`) still guards
       the parent's send order.
   - The records claim more. The Milestone 40 finding 12 note, the plan
     Status and Milestone 46, `plans/README.md` and `src/server/README.md` say
     that the server-level test pins the guarantee.
   - Impact: a later change that makes the child install styles
     asynchronously would pass CI, and developers would see stale imported CSS
     after a reload. Restoring the old assertion would bring back the flaky
     failures.
   - Options:
     - A) Add a deterministic test that runs `serve()` with the real child
       process and a watcher the test controls, the pattern `main`'s staging
       tests use. The test writes the CSS and fires one change event. At the
       first update whose page shows a higher content version, it checks that
       the stylesheet already has the new bytes. The reviewer's prototype
       passed 24 of 24 runs under six-way load and failed every run with the
       100 ms delay. Also correct the wording in these four files so that it
       names the layer each test checks.
     - B) Make the shared helper enforce the rule in every real-watcher test:
       at the first higher content version, the old bytes must be gone. This
       covers more tests, but an unrelated restart that arrives first could
       make it fail wrongly, which risks bringing back flaky failures.
     - C) Correct the wording only.
   - Recommended: A, plus one sentence in the `src/server/README.md` testing
     note: real-watcher tests deliberately tolerate intermediate states, so
     ordering guarantees need deterministic tests. That rule stops this kind of
     gap from recurring.
   - Resolved in `ec04332`, after PR #125 merged:
     `tests/watched_content_resource_order.test.ts` now also runs `serve()`
     with the real child and a watcher the test controls. One CSS edit
     rebuilds in place. At each later event, the test reads the stylesheet
     first; it checks those bytes only when the page's content version equals
     that event's version, which marks the content update itself. The test
     passed 24 of 24 runs under six-way load and failed 24 of 24 with the
     child installing styles 100 ms late. It also fails when the parent
     announces the update before it sends the styles. The four records now
     name the layer each test checks, and `src/server/README.md` states that
     real-watcher tests accept in-between states on purpose, so ordering
     guarantees need deterministic tests.
2. **Low — the helper's own tests do not cover its deadline on an open event
   stream or its startup retry.**
   - Context: in real Serve, the event stream stays open. If the expected
     state never arrives, the helper waits in a stream read until its deadline
     cancels the read. This works today: against a local server that held the
     stream open, the helper failed with its diagnostic after about 507 ms for
     a 500 ms deadline.
   - Evidence:
     - Every fake event stream in `tests/watched_resource_wait.test.ts` ends
       at once, so no test waits on an open stream. With the deadline's cancel
       signal removed from the stream request, all 11 direct tests still
       passed, while an open stream hung until it was stopped after 20
       seconds.
     - No test makes the first page request fail. With the startup retry
       removed, all 11 direct tests still passed, and the "watched shell was
       unavailable before the edit" error is never reached.
     - Every later match arrives through a new connection, never as a second
       update on the same stream.
     - The test "resource wait ignores an old child's evidence update until
       the new ready" passes only because the value it reads is "old"; the
       helper uses content versions only in its diagnostic.
   - Impact: a later edit could turn the helper's clear failure messages, the
     main gain of Milestone 46, into 60–90 second test timeouts, and no helper
     test would fail.
   - Options: A) add direct tests for an open stream that must fail near the
     deadline with the diagnostic, a startup connection that fails and then
     succeeds, one that never succeeds, and two updates on one stream; rename
     the evidence test to say what it checks; B) A, plus make the helper fail
     when the resource already matches before the edit, so a loose check
     cannot pass without the edit; C) leave as is.
   - Recommended: A. B is optional.
   - Resolved in `ec04332` with option A: the new
     `tests/watched_resource_wait_open_stream.test.ts` covers the deadline on
     an open stream and a second update on one open stream, and
     `tests/watched_resource_wait.test.ts` covers a startup retry that
     succeeds and a shell that never answers. Each change named above now
     fails a direct test: without the stream request's cancel signal, without
     the startup retry, or when the helper reconnects instead of reading the
     next update. The evidence test is renamed "resource wait reads old bytes
     at an evidence-only update, then accepts the restarted child's ready" and
     counts its resource reads. Option B was not adopted.
3. **Low — the 3,000-file watcher test's "one event" count can no longer
   fail.**
   - Context: `tests/watch_postcss_scale.test.ts` counts the watcher's reports
     of a new file. It now checks the count in the same step that receives the
     first report, so a duplicate report can never be counted.
   - Evidence: with a duplicate report added 1 ms after the first, the old
     25 ms poll caught it in 1 of 3 runs, and the new version in none.
   - Impact: small. The test suggests exactly-once reporting that nothing
     checks, but Serve's action queue merges duplicates, and the protocol
     promises a single rebuild only at the Serve level.
   - Options: A) drop the count and say in the test name that the watcher
     sees the new file; B) write a second file after the first report, wait
     for its report, and then check the count; C) leave as is.
   - Recommended: A, unless the watcher itself must report each file exactly
     once.
   - Resolved in `ec04332` with option A: the count is removed, and the test
     is renamed "a real 3,000-file watched directory becomes ready and reports
     an added file".

## Other Timing Patterns

These are not findings. The reviewer found these remaining time-based waits
in tests this branch added; none of them has failed:

- a fixed 500 ms pause before checking that generated output does not cause a
  rebuild (`tests/catalogue_watch_imported_styles.test.ts:101`). A check that
  something does not happen needs a waiting period, and deterministic tests in
  `tests/watch_postcss.test.ts` also cover it;
- `waitForBrowserReload`, which does not survive a restart, in
  `tests/watch_postcss_scale.test.ts:225`, where no restart is expected;
- wall-clock readiness budgets in `tests/watch_postcss_scale.test.ts`;
- a 9-second timer around a watcher event that is never cleared
  (`tests/imported_styles_supervision_watch.test.ts:57-65`).
