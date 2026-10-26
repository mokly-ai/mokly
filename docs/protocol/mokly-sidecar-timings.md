# Sidecar Timing Records

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

These records use the schema and privacy rules in
[startup diagnostics](./mokly-timings.md#opt-in-timings).

The core selects sidecar timing through the optional `hello.params.timings`
boolean. It defaults to `false`. No environment variable carries this choice.
An enabled sidecar writes its timing records to stderr. If the preceding
Node stderr write is a partial line, the sidecar inserts a newline before
the timing record. The core passes forwarded lines through token redaction
and terminal-control escaping. Real records contain no secrets or controls
and retain their exact bytes; other stderr lines remain diagnostics. Timing
records use the original stderr writer captured at startup, even if consumer
code replaces `process.stderr.write`.

A sidecar emits records with `role: "sidecar"` and its own `pid` and session
for `sidecar.bundle`, `sidecar.describe`, `sidecar.render` (with `kind`:
`screen`, `component`, `story`, or `page`), and `sidecar.process-css`, measured
from request receipt to response write. The difference from the matching core
`render.fragment` span includes transport and queue time.

Within `sidecar.bundle`, the child spans `sidecar.bundle.compile`,
`sidecar.bundle.graph`, `sidecar.bundle.inputs`, and
`sidecar.bundle.resolution` measure compilation, module-graph construction,
consumed input hashing, and resolution metadata. The `parentId` of each child
is the id of its enclosing `sidecar.bundle` span.

The core emits `sidecar.spawn` for process start through hello. Every later
spawn in a pool slot is enclosed by `sidecar.recycle`. These spans measure the
new process through hello, excluding the old stop and time between requests.
They start with error status and record `ok` only after hello succeeds.

`sidecar.stop` measures the old process's retirement. It includes the lifecycle
operations that its cause requires: shutdown, grace, kill, reaping, and bounded
stderr drainage where those operations apply. It adds no lifecycle operation,
retry, deadline, or wait for the next request. A stop starts with error status;
it records `ok` only if every attempted lifecycle operation succeeds. A failed
operation keeps error status even if a later fallback kill succeeds.

`sidecar.stop` and `sidecar.recycle` carry a `reason` string on start and end:

| Reason        | Cause                                                              |
| ------------- | ------------------------------------------------------------------ |
| `recycle`     | The render-count or memory-pressure policy retires the worker.     |
| `replacement` | A request or cleanup failure makes the worker unusable.            |
| `retry`       | Process startup or hello fails before a usable worker is returned. |
| `root-switch` | A request needs a different source root from a live worker.        |

The stop belongs to the span that performs retirement. A failed hello's stop
is a child of `sidecar.spawn`. Other stops use the active caller; without one,
`parentId` is absent. A later replacement belongs to the later caller. No span
or parent reference stays open between requests. The slot retains only its
replacement reason; that reason describes retirement, not a promised retry.
No stop is emitted when startup created no process. Command shutdown and
cancellation are outside these replacement stages. The added stage and reason
are diagnostic details within timing schema version 1.
