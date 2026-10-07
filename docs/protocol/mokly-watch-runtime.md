# Watch Runtime And Recovery

Continuation of [Watched Catalogue Development](./mokly-watch.md).

## Delivery Status

The warning-generation fence and failed-start supervisor cleanup are implemented
in [M29](../../plans/remove-source-path-evidence.md#milestone-29-fix-serve-warnings-and-startup-cleanup).

## Adoption And Recovery

Initial startup, successful rebuilds and configuration changes, and resource
reloads refresh the reachable resource watch set. A ready replacement is adopted
only with its matching output; failed writes discard it and retain the previous
resource watches. Independently, visited previews send generation-tagged document
closures to the parent, which attaches incremental resource watches immediately,
even when exhaustive rendering has not finished or fails elsewhere. Incremental
watches accumulate within a source generation and are replaced by the next
generation's visited closure. Discovery repeats after watcher readiness.
Missing or invalid paths and last-known descendants stay observable until
repaired or unreferenced. [Changes resource handling](./mokly-changes.md#changes-membership)
distinguishes invalid inputs from verified deletions; neither blocks reload or
comparison-cache invalidation.
Resource watches coalesce file and entry-replacement notifications and replace
their observers when validity changes, so repairing a dangling alias as a regular
file also restores subsequent edits. Unnamed raw events and unrelated generated
entries cannot broaden the resource watch set.
Generated-output ownership checks return false for unresolvable paths, so a
temporarily dangling resource remains observable and can recover after repair.

Rebuilds are debounced and accept metadata and the retained graph together. A failed
index candidate keeps the last-good server and output; a background failure keeps
the last-good disk output without claiming completeness. Errors are reported while
the watcher waits for another authored change. Warning scopes advance when an
attempt starts, separately from accepted output. A failed rebuild or
reconfiguration keeps the older output serving but never restores its warning
scope. Drop late background and preview-child warnings from that older
generation. Flush only the current attempt's warnings before its failure line;
successful adoption keeps that attempt's deduplication set. See
[build warning generations](./mokly-build-warnings.md#watched-serve-generations).
A successful rebuild or healthy restart publishes a new update version. Browsers
reload their current durable URL and restore search, changed-only selection,
current folder disclosure, the disclosure baseline captured before active
filtering, details disclosure, viewport and color-scheme selection, responsive
drawer, catalogue scroll, and per-region stage scroll once. Recovery is strictly
parsed. Both `filterBaselineDisclosures` and `changesStatus` are required;
missing or invalid values reject the complete stored snapshot. Browse applies durable preferences and initial active-route
selection before one-shot recovery. It then re-establishes active-route
visibility, promoting a recovered pre-filter baseline only when a closed
ancestor must be opened. A non-null baseline without active search or Changes
filtering is invalid. Recovery applies only when its durable URL exactly matches
the reloaded page and is removed before application; a later manual refresh
cannot resurrect stale state. Recovery retains its validated Changes
status. A selected Changes filter survives pending or
unavailable states and their completion rather than switching to All to reveal an
unchanged current preview. Explicit navigation still reveals its destination.

Navigation follows the [path contract](./mokly-paths.md); recovery uses the
[disclosure persistence contract](./mokly-disclosure-persistence.md)
for current keys, values, and incompatible snapshot handling.

When a successful rebuild leaves the manifest structure unchanged, or a
resource edit or explicit watch rule requests a reload, the parent keeps the
ready child. It first publishes a typed update that clears stale entry and
component evidence, making the successful content generation visible without
waiting on Git. The parent then computes one complete classification outside the
HTTP request path. A sequence token discards results superseded by a newer watch
action; the current successful result publishes a second typed update that
atomically replaces changed-entry membership, removed-entry baseline data, and
component evidence. Both tabs are present from startup: pending status shows a
spinner in the reserved count slot and, when selected, in the sidebar. An
available empty list shows zero; a failed or unavailable comparison ends loading
and shows a dash plus an unavailable sidebar. Every terminal status uses the
same sequence/version checks as
the result, including background build and write failures. Initial watched startup follows the
same asynchronous classification rule after listener readiness, as does non-watched
Serve. Watched Serve polls resolved HEAD/base commits once per second outside HTTP;
Git resolves symbolic refs, worktrees and packed refs. A changed or newly available
ref clears evidence and reclassifies existing completed output without rerendering
views. Replacement and shutdown cancel old ref reads and discard stale results.

Watch actions execute serially. Changes received during an active action are
coalesced by impact before the next action starts, so two rebuilds cannot race
to replace generated output or restart the same child. The parent assigns a
monotonic integer update version to each child and asset reload. Every served
catalogue shell carries the update version captured when its request began. The client
seeds its page baseline from that stamp: an equal event-stream `ready` version
is a no-op, while a higher `ready` version or `update` event requests the current
shell snapshot. Equal content versions adopt evidence without navigation recovery;
a newer content version triggers reload and one-shot state recovery. A controller with no valid supplied page stamp uses its first `ready` version
as its initial baseline; later higher events use the same refresh rules.

In rich mode, the [terminal reporter](./mokly-terminal-output.md) presents the
existing accepted-catalogue, baseline, Changes, reference-refresh, rebuild,
reload, restart, configuration, and failure boundaries as lifecycle or change
lines. The presentation does not introduce another watch action. Candidate
paths accumulate across each coalesced burst and the completed line names up to
three. The `r` shortcut enqueues the same `rebuild` action through this serialized
queue, so it cannot race a filesystem-triggered action.

A filesystem edit composed of multiple operations can publish intermediate
states: removing a tracked alias may identify a deletion before its replacement
restores the baseline. A higher version proves a completed watch action, not
completion of every filesystem operation a caller groups into one edit. Tests
for a specific result must wait for both a higher version and that semantic
state within the existing deadline, distinguishing unavailable Changes from an
available zero count. They must retain subsequent-edit and comparison
invalidation assertions rather than assuming exactly one publication per edit.

Publishing an update without restarting the child marks its cached comparison
stale before notifying browsers. Both content reloads and evidence adoption restore Current, so comparison work
waits for another explicit diff selection. Concurrent comparison requests reuse
one regeneration and snapshots remain pinned to their immutable generation.

Shutdown first stops queued work, aborts active Git classification, and waits
for any active configuration transaction, then closes all final adopted
watchers, timers, child processes, HTTP servers, event streams, and ports. A
candidate watcher is discarded if shutdown begins before adoption: shutdown
interrupts an outstanding candidate readiness wait and closes that watcher
before the action queue finishes draining. No later child restart is started.
Tests must prove no orphan process remains after normal shutdown, failed
startup, or interruption. The child also
runs the same idempotent server close when its parent IPC channel disconnects,
so an abruptly terminated parent cannot leave a listening orphan. Parent-driven
shutdown first requests graceful IPC closure, then sends SIGTERM and SIGKILL at
bounded intervals when necessary; the supervisor does not finish closing until
the child exit notification arrives.

Each spawned child owns one readiness result, a terminal result registered from
creation, and one shared cleanup operation. Readiness timeout (300 seconds),
pre-ready errors, post-ready errors, IPC disconnection, explicit close, and
restart all use that operation. Startup reports its original failure only after
cleanup confirms the child has stopped. A ready message followed by failure
before startup resolves cannot report successful startup. Close cancels pending
readiness; later ready messages and updates are ignored. Concurrent close/restart
calls share cleanup, and a separate start while the child is still owned fails
without spawning.

The native handle observes IPC disconnection from creation and retains that
event for late subscribers. Disconnection while waiting for readiness or while
serving starts the same cleanup immediately, without waiting for another update.
It reports one unexpected failure only after successful startup, so the watched
action queue can recover on the retained port. Transport loss never confirms
process exit: even a disconnected child stays owned through bounded escalation
and actual terminal confirmation. A disconnection during intentional shutdown
or after exit does not create a failure or duplicate recovery. An earlier startup
error retains precedence over a later disconnect. Tests include a real HTTP
child that disconnects itself, ignores SIGTERM, and is force-killed before its
replacement resumes receiving updates on the same port.

Terminal observation remains available after exit, including a failed native
spawn that emits `close` without `exit`. Cleanup for an already-terminal child
does not signal it or wait for another event. A failed IPC shutdown request or
signal cannot release ownership or skip the next escalation stage. All timers
are cancelled on terminal confirmation. Tests cover these event orders with
controlled children and prove real server termination and port reuse after an
injected transport failure.

See [the catalogue runtime](./mokly-runtime.md) and [Changes](./mokly-changes.md).
