# CI Test Timing

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

Required tests check correctness without depending on machine speed. This
contract applies to every Node test file that the viewer suite discovers under
`tests/`, `packages/viewer/tests/`, and `packages/ui/tests/`, and to the
browser specs under
`tests/browser/`. Rust tests under `crates/` and `xtask/` follow the same
assertion rule; the job timeout of the
[CI workflow contract](./ci-workflow.md#job-execution) is their hang guard. It
supplements [CI suite evidence](./ci-suite-evidence.md).

## Assertion Rule

Tests must not assert elapsed wall-clock time as an upper or lower bound. The
shared `deterministic-tests` skill gives the evidence methods that replace such
assertions and the allowed clock uses. This page holds the repository's values.

Waiting for the `Mokly listening at` line of `mokly serve`, or for a frame's
`ready` reply, is an expected-state wait. Its test-supplied allowance must
allow at least 10 seconds.

## Hang Guards And Budgets

A test-runner timeout is a hang guard for the whole test. It allows at least
three times the test's typical duration. CI job timeouts follow the same rule
for the whole job, including setup and builds. The
[CI workflow graph](./ci-workflow.md#job-execution) sets them.

The combined React large-fixture watch journey is the one accepted exception
to the three-times rule. It keeps a 300,000 ms runner timeout. On a small
runner, CPU contention can push the journey past that guard, so its rare
timeouts are accepted. One test per edit kind was rejected, because the
combined journey proves that one Serve process handles the three React edits
in order.

Full catalogue setup uses a 600,000 ms budget. Isolated catalogue setup uses a
180,000 ms budget. Their test bodies keep the normal 60,000 ms timeout.
Fixture phase reporting follows [CI suite evidence](./ci-suite-evidence.md).

## Duration Reporting

Required tests report durations only as text, through
`tests/helpers/durations.ts`, in `context.diagnostic` or a Playwright
annotation. A reported duration must never be a failure condition. That helper
is the only test module that subtracts clock reads.

## Benchmark Boundary

Opt-in benchmarks outside the test directories are outside the assertion rule.
They can enforce millisecond thresholds. The
[diagnostics contract](./mokly-timings.md#budgets) owns the large-catalogue
budgets and their thresholds.

## ESLint Guard

ESLint rejects two elapsed-time patterns in every JavaScript and TypeScript
file under `tests/`, `packages/viewer/tests/`, and `packages/ui/tests/`,
including browser specs and
`page.evaluate` callbacks:

- A subtraction with a clock call on the left and a nonliteral operand on the
  right. The clock calls are `performance.now()`, `Date.now()`, and
  `process.hrtime.bigint()`.
- `performance.now()` or `Date.now()` plus a number literal below 10,000.

`tests/helpers/durations.ts` is the only exempt file. Each lint message names
this page.
