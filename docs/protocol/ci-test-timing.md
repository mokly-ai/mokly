# CI Test Timing

Required tests check correctness without depending on machine speed. This
contract applies to the unit, browser, and hydration suites under `tests/`.
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
requires one working-directory resolution per metafile. Each root traversal
reads a metafile input at most once.

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

A polling deadline does not establish a speed contract.
A test-runner timeout is a hang guard for the whole test.
Keep it at least three times the test's typical duration.
An expected-state allowance inside a test can be longer than the runner timeout.
The runner timeout then bounds the whole test.
The inner allowance sets the failure message when it expires first.

The fixture setup budgets in `tests/helpers/fixture_timing.ts` stay unchanged.
Fixture phase reporting continues to follow
[CI suite evidence](./ci-suite-evidence.md).

## Shared Evidence Helpers

### Operation Counting Helper

`tests/helpers/operation_counts.ts` counts calls made by one synchronous
callback. It counts these operations separately:

- `fs.statSync`, `fs.lstatSync`, `fs.existsSync`, and `fs.readdirSync`.
- `fs.realpathSync` and `fs.realpathSync.native`.
- `path.relative`, `path.resolve`, and `Array.prototype.sort`.

It records each operation's total. For operations with path arguments, it
also records counts by the first path argument. Sort calls have no path
argument and need only a total. The wrapped `fs.realpathSync` keeps its
callable, counted `native` method attached.

The helper restores every original function when the callback finishes.
It also restores every original when the callback throws. A callback that
returns a promise or another thenable must fail because asynchronous work can
escape the counting window. Handle its rejection before reporting that error.
Do not await it. Rejection must also restore the original functions.
Reject nested counting calls before replacing any function.

Use `countOperations(callback)` to get the callback's `result` and `counts`.
Read totals from `counts.totals[operation]`.
Read path counts from `counts.byPath[operation].get(path)`.
The path maps use string keys. Convert other first arguments with `String`.
Sort has a total only.

The helper provides a two-size assertion with the acceptance relations in
[Operation Counts](#operation-counts). Equal once-only counts pass. Growing
once-only counts fail. A total above 4.5 times fails. Any asserted count
that is zero at the smaller size fails.

Use `assertOperationScaling(smaller, larger, onceOnly, scaledTotals)`.
Pass the two counter results as `smaller` and `larger`.
List once-only counts as `{ operation, path? }` objects.
List scaled totals by operation name. Omit `path` for a total.
Failure text names the operation, the selected path, and both counts.

Counted code must call `fs` and `path` functions through their default
imports. A named function import can escape the wrappers. The positive
smaller-size count prevents that missed interception from passing silently.
Count glob compilation with
`context.mock.method(Minimatch.prototype, "make")`. Minimatch 10 calls
`make` from its constructor. Count element reads of `config.sourceFiles`
and `metafile.inputs` with a test-owned `Proxy`.

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

Opt-in benchmarks outside `tests/` are outside this assertion rule. They
can enforce millisecond thresholds. `scripts/large/benchmark.mjs` keeps
`usableMs < 5000` for both cold and warm runs. The
[startup benchmark contract](./mokly-timings.md) remains unchanged.

## ESLint Guard

Apply `no-restricted-syntax` in `eslint.config.js` to every JavaScript and
TypeScript file under `tests/`, including browser and hydration specs.
The only exempt file is `tests/helpers/durations.ts`. Files under `src/`
and `scripts/` are outside the guard.

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

## Delivery Status

Implemented. Required tests use deterministic assertions and the shared
evidence helpers. The ESLint guard rejects the patterns above.
