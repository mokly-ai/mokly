# Sidecar Timing Records

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

The core emits `sidecar.spawn` for process start through hello. Every later
spawn in a pool slot is enclosed by `sidecar.recycle`. These spans measure the
new process through hello, excluding the old stop and time between requests.
They start with error status and record `ok` only after hello succeeds.

The core emits `sidecar.restore-generation` for each restore request of a
generation or a recipe that the pool keeps in memory, through its response.
It starts with error status and records `ok` only when the request succeeds.
A restore from the [bundle cache](./mokly-base-cache.md#bundle-entries) is
part of `catalogue.bundle` and emits no `sidecar.restore-generation` span.

In Serve, the core emits `review.base-gate-wait` before each sidecar call of an
[early base lease](./mokly-base-early-preparation.md#early-base-lease). It
measures the admission wait of that call: the wait for the slot of the lease
before its first call, and the wait for HTTP renders before each call.

`sidecar.stop` measures the old process's retirement. It includes the lifecycle
operations that its cause requires: shutdown, grace, kill, reaping, and bounded
stderr drainage where those operations apply. It adds no lifecycle operation,
retry, deadline, or wait for the next request. A stop starts with error status;
it records `ok` only if every attempted lifecycle operation succeeds. A failed
operation keeps error status even if a later fallback kill succeeds.

`sidecar.stop` and `sidecar.recycle` carry a `reason` string on start and end:

| Reason              | Cause                                                                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `early-preparation` | An early base lease replaces a worker of another root, or stops its base worker at its end.                                            |
| `recycle`           | The render-count or memory-pressure policy retires the worker.                                                                         |
| `replacement`       | A request or cleanup failure makes the worker unusable.                                                                                |
| `retry`             | Process startup or hello fails before a usable worker is returned.                                                                     |
| `root-switch`       | A request outside an early base lease needs a different source root from a live worker, or a return pass replaces an idle base worker. |

A [return pass](./mokly-sidecar-root-scheduling.md#background-return) uses the
`root-switch` reason for each stop and replacement that it performs. These
spans follow the Changes publication that starts the pass. Each such stop
includes the kill and the reaping of the old process.

An [early base lease](./mokly-base-early-preparation.md#early-base-lease) uses
the `early-preparation` reason for each stop and replacement that it performs.
Each such stop includes the reaping of the process that it ends.

The stop belongs to the span that performs retirement. A failed hello's stop
is a child of `sidecar.spawn`. Other stops use the active caller; without one,
`parentId` is absent. A later replacement belongs to the later caller. No span
or parent reference stays open between requests. The slot retains only its
replacement reason; that reason describes retirement, not a promised retry.
No stop is emitted when startup created no process. Command shutdown and
cancellation are outside these replacement stages. The stages and reasons are
diagnostic details within the timing record version of the
[format inventory](./mokly-format-versions.md#version-inventory).
