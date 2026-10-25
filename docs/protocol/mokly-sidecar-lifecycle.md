# Sidecar Cancellation And Timeouts

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

The [sidecar protocol](./mokly-sidecar.md) owns process and transport lifetimes.

## Cancellation And Timeouts

Deadlines are 120 seconds for `bundle` and `describe`, 60 seconds for
`processCss`, and 30 seconds for every other request.
`MOKLY_SIDECAR_TIMEOUT_MS` replaces every deadline. The CLI reads it once and validates a positive
64-bit integer before command work. An invalid value fails `cli-invalid`
with the accepted range. When a deadline passes, the binary kills that
sidecar, retries the request once on a fresh sidecar, and then fails with
`render-timeout`. A cancelled command sends `shutdown` to every sidecar and
kills any that survives the grace period. Build follows the
[terminal cancellation rule](./mokly-terminal-errors.md#plain-compatibility).
Render labels split the last `#` as `{module} export {name}`.

Forced termination waits for the owned process reaper before lifecycle release.
This wait adds no graceful period for consumer code.
Once the child has exited, completion drains stderr until the shared deadline,
also for a worker that cancellation already killed. If the child is still
running at the deadline, the core kills the tree and then waits only for the
child reaper. A drain that reaches the deadline causes a tree kill with no
further drain wait. Diagnostics are forwarded
in pieces of at most 64 KiB of input, split at UTF-8 boundaries. A terminating
newline does not bypass this bound.

A closed parent output pipe or IPC channel ends the sidecar or PostCSS child
with exit code 0. Late response, operation-count, and diagnostic writes emit
no crash stack or extra diagnostic. Other output errors remain failures.
