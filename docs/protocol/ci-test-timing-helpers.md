# CI Test Timing Helpers

Continuation of [CI Test Timing](./ci-test-timing.md).

## Shared Evidence Helpers

### Polling Helper

Use `waitUntil(probe, options)` from `tests/helpers/wait_until.ts`.
The probe can be synchronous or asynchronous. It can return a value or a
boolean. The helper resolves with the first result that is not `undefined`,
`null`, or `false`. This includes `0` and an empty string. The return type
excludes `undefined`, `null`, and `false`. It rethrows probe errors unchanged
and does not retry them.

The options are:

- `timeoutMs`: defaults to 15,000 ms. A value below 10,000 ms rejects with
  `RangeError` before the first probe.
- `intervalMs`: defaults to 10 ms between probes.
- `message`: supplies the timeout error text as a string or `() => string`.
  The helper calls the function once, only when the wait times out.
  Use the function form to read the latest state for the error message.
  The helper does not call it when the probe succeeds.

The helper probes once before the first pause. It probes again after each
pause. A result at or after the deadline still succeeds. If that probe has no
result, the helper rejects with `Error`. The error uses `message` when supplied.
Its default text names `timeoutMs`.

The helper sets the deadline with `Date.now() + timeoutMs`. It compares the
current time with `<`. It pauses with the global `setTimeout` wrapped in a
promise. Its own tests use `t.mock.timers` to drive both APIs without waiting
in real time.

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
[Operation Counts](./ci-test-timing.md#operation-counts). Equal once-only counts pass. Growing
once-only counts fail. A total above 4.5 times fails. Any asserted count
that is zero at the smaller size fails.

Use `assertOperationScaling(smaller, larger, onceOnly, scaledTotals)`.
Pass the two counter results as `smaller` and `larger`.
List once-only counts as `{ operation, path? }` objects.
List scaled totals by operation name. Omit `path` for a total.
Failure text names the operation, the selected path, and both counts.

The combined `{ operation: "realpath", path }` selection adds the
`fs.realpathSync` and `fs.realpathSync.native` calls for one path. Use it for
every fixed-root once-only check, including PostCSS dependency collection.
The separate totals and path maps remain available.

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
