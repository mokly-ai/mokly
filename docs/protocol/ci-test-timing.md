# CI Test Timing

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

Required tests check correctness without depending on machine speed. This
contract applies to every Node test file that the viewer suite discovers under
`tests/` and `packages/viewer/tests/`, and to the browser specs under
`tests/browser/`. Rust tests under `crates/` and `xtask/` follow the same
assertion rule; the job timeout of the
[CI workflow contract](./ci-workflow.md) is their hang guard. It supplements
[CI suite evidence](./ci-suite-evidence.md).

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
  This includes sorts, index construction, and working-directory resolution.
- Each counted total at the larger size must be at most 4.5 times its total
  at the smaller size. Linear work grows by about 4 times. Quadratic work
  grows by about 16 times.

Apply equality checks even when total growth passes. Repeated fixed-root
resolution can remain linear while violating the once-per-run contract.
Keep the operation's result assertions beside its count assertions.

A Rust test applies the same relations with its own counters, for example the
number of Git commands that a base-side extraction issues at two catalogue
sizes.

### Captured Watcher Targets

A test of the watch crate captures the targets passed to the file watcher.
Assert that the watcher receives each required directory-dependency root.
Assert that it receives no source file covered by that root. Follow the
[watch-target contract](./mokly-watch.md). Required files below a denied-name
directory keep their explicit targets, as that contract requires.

Keep readiness and added-file event checks under the test timeout. Keep
single-watcher and single-rebuild assertions. Readiness duration can be
reported as text, but it cannot decide whether the test passes.

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

## Allowed Clock Uses

The following uses can still read a real clock:

- Test-runner `timeout` options stop hung tests.
- Polling deadlines wait for an expected state. Their allowed duration must
  be at least 10 seconds (10,000 ms). This includes product timeout options
  that a test supplies when it expects the operation to succeed.
- Timestamps used as test data can come from a clock. For example,
  `new Date(Date.now() - 10_000)` represents an earlier timestamp.

Waiting for the `Mokly listening at` line of `mokly serve`, or for a frame's
`ready` reply,
is an expected-state wait. Its test-supplied allowance must allow at least
10 seconds.

A timeout that the test expects to expire tests the timeout outcome. It
can stay short if the test makes no elapsed-time assertion. For example, a
request with a 100 ms allowance inside `assert.rejects` can use a real timer
to check the timeout outcome.

A polling deadline does not establish a speed contract.
A test-runner timeout is a hang guard for the whole test.
Keep it at least three times the test's typical duration.
CI job timeouts follow the same rule for the whole job, including setup and
builds. Repository jobs allow 75 minutes, Viewer jobs allow 40 minutes, and
browser shards, static-delivery jobs, and native jobs allow 60 minutes. Required
CI and other jobs allow 30 minutes. The separate optional design matrix follows its own
[workflow guards](./ci-workflow.md#design-attribution-matrix).
Record typical durations separately from these hang guards.
An expected-state allowance inside a test can be longer than the runner timeout.
The runner timeout then bounds the whole test.
The inner allowance sets the failure message when it expires first.

The combined React large-fixture watch journey is the one accepted exception
to the three-times rule. It keeps a 300,000 ms runner timeout. On a small
runner, CPU contention can push the journey past that guard, so its rare
timeouts are accepted. One test per edit kind was rejected, because the
combined journey proves that one Serve process handles the three React edits
in order.

The fixture setup budgets live in `tests/helpers/fixture_timing.ts`. Full
catalogue setup uses a 600,000 ms budget. Isolated catalogue setup uses a
180,000 ms budget: the link-control `beforeAll` hook, the watched catalogue
test fixture, the branch-point copy's and the small comparison copies' worker
fixtures, and the shared Serve comparison test fixture. Their test bodies keep
the normal 60,000 ms timeout. Fixture phase reporting follows
[CI suite evidence](./ci-suite-evidence.md).

## Shared Evidence Helpers

### Duration Reporting Helper

Required tests report durations only as text through
`tests/helpers/durations.ts`. Use that text in `context.diagnostic` or a
Playwright annotation. A reported duration must never be a failure condition.
The helper is the only test module that directly subtracts clock reads.

The helper returns the result of synchronous and asynchronous callbacks.
It reports text once when the callback succeeds, throws, or rejects.
It preserves the callback's failure and exposes no numeric duration.

Use `reportDuration(label, report, callback)` for one report line.
Pass the reporter as a function, for example `(text) => context.diagnostic(text)`.
Await it to get the callback's result.
The callback's error takes precedence if the reporter also throws.
Use `startDuration()` to get a function that returns bare duration text.
Call that function when the observation ends to combine the text with counts.
Both forms use one decimal place followed by ` ms`.

## Benchmark Boundary

Opt-in benchmarks outside the test directories are outside this assertion
rule. They can enforce millisecond thresholds. The
[diagnostics contract](./mokly-timings.md#budgets) owns the large-catalogue
budgets and their thresholds.

## ESLint Guard

Apply `no-restricted-syntax` in `eslint.config.js` to every JavaScript and
TypeScript file under `tests/` and `packages/viewer/tests/`, including browser
specs. The only exempt file is `tests/helpers/durations.ts`. Every other file
is outside the guard.

The guard rejects two patterns, including inside a `page.evaluate` callback:

- A subtraction with a clock call on the left and a nonliteral operand on
  the right. The clock calls are `performance.now()`, `Date.now()`, and
  `process.hrtime.bigint()`.
- `performance.now()` or `Date.now()` plus a number literal below 10,000.

Use these selectors:

```text
BinaryExpression[operator='-'][right.type!='Literal']:matches([left.type='CallExpression'][left.callee.property.name='now'][left.callee.object.name=/^(performance|Date)$/], [left.callee.property.name='bigint'][left.callee.object.property.name='hrtime'])
BinaryExpression[operator='+'][left.callee.property.name='now'][left.callee.object.name=/^(performance|Date)$/][right.type='Literal'][right.value<10000]
```

Deadlines of 10,000 ms or more, deadline comparisons, and literal timestamp
offsets remain allowed. Examples include `performance.now() + 20_000`,
`performance.now() < deadline`, and `new Date(Date.now() - 10_000)`.
Variable deadlines such as `Date.now() + timeoutMs` pass the syntax check.
They must still allow at least 10 seconds when polling for an expected state.
Indirect calls such as `clock() - started` also pass the selectors. They
still must follow the assertion and duration-reporting rules above.

The lint message must name `docs/protocol/ci-test-timing.md`. Rule tests use
`ESLint.lintText` to check rejected and allowed forms in each scoped path.
