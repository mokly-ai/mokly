# CI Test Timing

Required tests check correctness without depending on machine speed. This
contract applies to the unit, browser, and hydration suites in the test roots
`tests/` and `packages/viewer/tests/`.
It supplements [CI suite evidence](./ci-suite-evidence.md).

## Assertion Rule

Tests must not assert elapsed wall-clock time as an upper or lower bound.
An assertion that work finishes before a millisecond limit is forbidden.
An assertion that work takes at least a given duration is also forbidden.
Keep correctness assertions when replacing either form.

The four evidence methods below replace elapsed-time assertions for scale,
watch targets, non-blocking behavior, and timeout duration. A test that makes
no elapsed-time assertion does not need a fake clock.

### Operation Counts

Run the same operation at two input sizes in a 1:4 ratio. For each count
used by an assertion, apply these acceptance relations:

- The count at the smaller size must be greater than zero. This includes
  per-path counts and totals. A missed interception must fail the test.
- Counts for work that happens once per run must be equal at both sizes.
  This includes fixed-root projection, sorts, glob compilation, index
  construction, and working-directory resolution.
- Each counted total at the larger size must be at most 4.5 times its total
  at the smaller size. Linear work grows by about 4 times. Quadratic work
  grows by about 16 times.

Apply equality checks even when total growth passes. Repeated fixed-root
resolution can remain linear while violating the once-per-run contract.
Keep the operation's result assertions beside its count assertions.

The [stylesheet collection contract](./mokly-imported-styles.md#roots-collection-and-deduplication)
requires a fixed number of working-directory and `repoRoot` resolutions for
one metafile or one source inventory. That number must not grow with the
number of inputs or edges. This also holds when the working directory is a
symlink or equals `repoRoot`. Each root traversal reads a metafile input at
most once.

Use the combined `{ operation: "realpath", path }` selection for a once-only
check of a fixed root. This includes a working directory, `repoRoot`, and the
mockups directory. Code can resolve these roots through `fs.realpathSync`
or `fs.realpathSync.native`.

### Captured Watcher Targets

Capture the targets passed to the watcher factory. Assert that the factory
receives each required directory-dependency root. Assert that it receives no
source file covered by that root. Follow the
[watch-target contract](./mokly-watch.md).
Required files below a denied-name directory keep their explicit targets,
as that contract requires.

Keep readiness and added-file event checks under the test timeout. Keep
existing single-watcher and single-rebuild assertions. Readiness duration
can be reported as text, but it cannot decide whether the test passes.

### Event Order

For a non-blocking contract, assert that the fast response settles while
the slow job is still pending. Check the response's expected result too.
Do not infer this order from a short elapsed-time limit.

### Fake Clocks

Use a fake clock to assert a timeout's duration. Assert that the request
remains pending immediately before the timeout boundary. Advance to the
boundary and assert the documented timeout result.

For the [frame adapter](./mokly-frame-adapter.md), install `page.clock` after
the frame mounts and before the request starts. The request must remain
pending at 4,999 ms and return `timeout` at 5,000 ms. Its next request must
return `disposed`. These values are fake-clock time, not elapsed wall time.

For a Node product timer, use `t.mock.timers`. Enable the mock after setup.
Mock only the APIs that the timer uses. In `tests/demand_safety.test.ts`,
enable only `setTimeout` after runtime preparation. The `DocumentService`
job must remain pending at fake 999 ms and fail at fake 1,000 ms. The later
recovery read has no wall-clock limit.

## Allowed Clock Uses

The following uses can still read a real clock:

- Test-runner `timeout` options stop hung tests.
- Polling deadlines wait for an expected state. Their allowed duration must
  be at least 10 seconds (10,000 ms). This includes product timeout options
  that a test supplies when it expects the operation to succeed.
- Timestamps used as test data can come from a clock. For example,
  `new Date(Date.now() - 10_000)` represents an earlier timestamp.

A successful `acquireOutputLock(root, { timeoutMs })` call is an
expected-state wait. Its test-supplied `timeoutMs` must allow at least
10 seconds.

A timeout that the test expects to expire tests the timeout outcome. It
can stay short if the test makes no elapsed-time assertion. For example,
`acquireOutputLock(root, { timeoutMs: 100 })` inside `assert.rejects` can
use a real timer to check the timeout outcome.

A per-attempt wait inside a retry loop can stay short when the loop's own
deadline allows at least 10 seconds. For example, a 1-second panel wait
inside one Playwright `toPass` attempt lets its 15-second loop retry a click.

`playwright.config.ts` sets the default assertion timeout, `expect.timeout`,
to 15,000 ms. Web-first assertions and `expect.poll` therefore meet the
10-second minimum by default. `tests/verification_concurrency.test.ts`
keeps that default at 10,000 ms or more. An explicit Playwright assertion or
action timeout below 10 seconds is allowed only for a timeout-outcome check
or a per-attempt wait inside a retry loop.

A polling deadline does not establish a speed contract.
A test-runner timeout is a hang guard for the whole test.
Keep it at least three times the test's typical duration.
An expected-state allowance inside a test can be longer than the runner timeout.
The runner timeout then bounds the whole test.
The inner allowance sets the failure message when it expires first.

The fixture setup budgets in `tests/helpers/fixture_timing.ts` stay unchanged.
Fixture phase reporting continues to follow
[CI suite evidence](./ci-suite-evidence.md).

### Polling

Hand-written waits must poll for an expected state only with `waitUntil`
from `tests/helpers/wait_until.ts`. Do not write a counted loop of N pauses
of M ms or a clock-deadline loop. Exported waits, including those in
`tests/helpers/server_http.ts` and `tests/helpers/watched_catalogue.ts`,
must use `waitUntil` and keep their public signatures. Each replacement wait
allows at least the larger of 15 seconds and its current allowance.
Keep its current poll interval.

A loop whose attempts do more than check a state is not a polling wait.
For example, a loop can retry an operation that has side effects.

## Shared Evidence Helpers

See [CI Test Timing Helpers](./ci-test-timing-helpers.md) for the polling,
operation counting, and duration reporting contracts.

## Benchmark Boundary

Opt-in benchmarks outside the test roots are outside this assertion rule. They
can enforce millisecond thresholds. `scripts/large/benchmark.mjs` keeps
`usableMs < 5000` for both cold and warm runs. The
[startup benchmark contract](./mokly-timings.md) remains unchanged.

## ESLint Guard

Apply `no-restricted-syntax` in `eslint.config.js` to every JavaScript and
TypeScript file in each test root listed by
`scripts/verification/test-roots.mjs`: `tests/` and `packages/viewer/tests/`.
This includes browser and hydration specs. Unit-test discovery reads the
same list, so a new root gets the guard automatically. The only exempt file
is `tests/helpers/durations.ts`. Product code and scripts outside the test
roots are outside the guard.

The guard rejects two patterns, including inside a `page.evaluate` callback:

- A subtraction with a clock call on the left and a nonliteral operand on
  the right. It applies to every clock form below.
- A clock call plus a number literal below 10,000. It applies to every form
  below except `process.hrtime.bigint()`.

The clock forms are `performance.now()`, `Date.now()`,
`process.hrtime.bigint()`, member-expression clocks such as
`window.performance.now()` and `globalThis.performance.now()`, and
`new Date().getTime()` without constructor arguments. A parsed date such as
`new Date(value).getTime()` is not a clock read and stays allowed.

`eslint.config.js` holds the selectors.
`tests/test_timing_lint.test.ts` fixes the rejected and allowed forms.

Deadlines of 10,000 ms or more, deadline comparisons, and literal timestamp
offsets remain allowed. Examples include `performance.now() + 20_000`,
`performance.now() < deadline`, and `new Date(Date.now() - 10_000)`.
Variable deadlines such as `Date.now() + timeoutMs` pass the syntax check.
They must still allow at least 10 seconds when polling for an expected state.
Indirect calls such as `clock() - started` also pass the selectors. They
still must follow the assertion and duration-reporting rules above.

The lint message must name `docs/protocol/ci-test-timing.md`. Rule tests use
`ESLint.lintText` to check rejected and allowed forms in each scoped path.

## Delivery Status

The following rules are planned in
[Deterministic Test Timing Review Fixes](../../plans/deterministic-test-timing-review-fixes.md):

- Short per-attempt waits preserve retries inside loops with at least 10 seconds.
- Playwright's default assertion timeout is 15,000 ms, with a 10,000 ms floor.
- Shared polling waits use `waitUntil`, and Node product timers use mock timers.
- Combined realpath counts keep root resolution fixed for metafiles and inventories.
- The lint guard reads shared test roots and covers all stated clock forms.

The other rules are implemented. Required tests use deterministic assertions,
operation counts, duration text, and the existing lint guard.
