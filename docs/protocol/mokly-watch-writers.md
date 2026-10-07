# Shared Watch Setup And Output Writers

## Delivery Status

Implemented under
[Generated Output Review Fixes](../../plans/generated-output-review-fixes.md).
It extends [Watch](./mokly-watch.md) and the
[output transaction](./mokly-generated-output.md#tracked-state-and-commands).

## Shared Setup

Serve and `build --watch` use one watch-setup module for source inventory,
PostCSS scan directories, configured and referenced authored assets, target
replacement and event classification. Command-specific serving and writing
remain with their callers. Reuse the same notification gate, debounce and
serialized action queue; do not maintain a second input-classification list.

Resolve the configuration and graph inventory, including PostCSS directory
reports, before declaring the source watcher ready. Buffer events from watcher
creation through readiness, initial rendering and resource-watcher attachment.
Retain buffered events even when the first compilation changes the watch set.
After the first candidate, process every buffered change through the normal
queue. A saved edit during the first build must cause a fresh accepted result.

Resource discovery uses the [shared closure builder](./mokly-public-closure.md).
Attach resource targets before publication and repeat discovery after readiness
to detect references introduced during attachment. Reconfiguration keeps the
old watcher and accepted output until the replacement is ready and validated.
Failed candidates retain last-good output and recovery targets. Keep existing
source, generated-directory, alias and directory-event classification rules.

Every reload, rebuild or reconfiguration in `build --watch` compiles and writes
a complete valid candidate. `serve --build` also refreshes and writes the
manifest after an authored stylesheet reload changes the resource closure.
Plain Serve updates its checked in-memory closure without writing output.
Evidence-only events never write. Only the parent writes in Serve.

Preserve [cache ignore publication](./mokly-baseline-storage.md#cache-layout)
before each output-lock acquisition. Keep the persistent lock directories and
the cache ignore file. Nonwriting commands create no cache themselves; a
requested baseline rebuild retains its separate cache-publication boundary.

## Cancellation

Install SIGINT/SIGTERM handling before the initial build or lock wait. The
handler marks shutdown immediately and aborts the current compile/write signal.
Pass that signal through compilation, output-store and output-lock operations.
After cancellation, discard any later completed candidate before writing.
No queued action may start after shutdown. Drain the active work, close source
and resource watchers, and release only this process's own lock.

Ctrl+C during the first build writes nothing. Ctrl+C while another process
holds the output lock stops the wait promptly, preserves that other lock and
the previous output tree, and shuts down without publishing a candidate.
Atomic replacement and rollback retain their existing boundaries if shutdown
arrives after a write has started. Do not weaken the output lock or skip cleanup.

## Summaries And Plain Notices

One helper supplies the file count, plain line and rich destination for `build`,
`build --watch` and `serve --build`. Use the catalogue path relative to the
invocation directory, with `.` when it is empty. A successful write emits:

```text
Generated <n> Mokly files.
```

The rich form remains `Generated <n> files in <path>`, with the existing duration
and terminal formatting. Report only completed writes. `serve --build` retains
its Serve readiness and Watch messages as well. Plain Serve emits no generated
summary because it performs no write.

In plain mode, successful baseline preparation notes and the exact
[earlier-version line](./mokly-baseline-compatibility.md#incompatible-earlier-baseline) use
stdout. Warning-free successful commands produce no stderr except requested
timing JSON. Build warnings and errors remain on stderr. Preserve the
[build warning contract](./mokly-build-warnings.md), including strict rejection
before writes and once-per-generation Serve reporting. Keep existing progress wording.
Serve prints an earlier-version notice once for its accepted base; moving to
a different base clears the notice state so a later incompatible base can
report once again. Rich mode keeps its existing reporter surfaces.

## Acceptance

Follow [CI Test Timing](./ci-test-timing.md). Prove lifecycle ordering with
explicit synchronization, not elapsed-time bounds. Expected-state polling
allows at least 10,000 ms; report measured durations only as evidence.

Run the same watch fixtures through Serve and `build --watch`. Cover imported
helpers, Tailwind-style PostCSS content scans, new scan files/directories,
referenced HTML/PDF/CSS resources, configuration changes and failed recovery.
Save an edit while initial rendering is paused; require the final generation
to contain that edit. Test a stylesheet that adds/removes an authored resource;
`serve --build` must write the corresponding manifest closure.

Test Ctrl+C during the first build and under a held writer lock with explicit
synchronization. Require prompt settlement, no new output, no foreign-lock
deletion and no leaked process/watcher. Smoke-test both writing watch commands
with Tailwind-style scanning and these lifecycle cases. Assert exact stdout,
empty successful stderr when warning-free, root-directory summaries, and one
earlier-version notice per accepted base in real Serve. Also combine a build
warning with a successful baseline notice: only the warning stays on stderr.
