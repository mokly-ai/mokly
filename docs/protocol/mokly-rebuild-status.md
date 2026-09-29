# Watched Serve Rebuild Status

## Delivery Status

Approved target for Milestones 1, 3, and 5 of the
[Serve rebuild status plan](../../plans/serve-rebuild-status.md). This document
owns the private status model, ordering, transport, sanitizing, and shell
behavior. The [design contract](./mokly-rebuild-status-design.md) owns its
presentation. None of this target is implemented until those milestones land.

## Boundary And Model

Rebuild status exists only in watched `mokly serve`. It is independent of the
`interactive` setting. Unwatched Serve, Build, Check, export, publication,
static workspace evidence, generated files, public catalogue JSON, the public
shell bootstrap, and application-owned embedded viewers never contain it.

Every payload is a complete snapshot with exactly this shape:

```ts
interface RebuildStatus {
  failure: null | {
    detail: string;
    id: number;
  };
  sequence: number;
  updateVersion: number;
  updating: boolean;
}
```

`sequence`, `updateVersion`, and `failure.id` are positive safe integers.
Objects admit no extra keys. The watched parent starts `sequence` at 1 with
`{ updating: false, failure: null }` and increments it for every distinct
published snapshot; it never wraps. A duplicate snapshot is not published.
`failure.id` is the `sequence` that created that failure, remains unchanged
while progress changes around it, and is at most the enclosing `sequence`.
The two facts are independent: `updating: true` may accompany either value of
`failure`.

`updateVersion` is a minimum-adoption fence, not another status sequence. A
page may adopt the snapshot only after its private capability source has an
update version greater than or equal to that value. The parent owns both
counters. Exhausting either safe-integer range is a fatal watched-Serve fault;
counters never reset while that parent remains running.

## Watch Action Lifecycle

The status starts idle and successful on initial readiness. Initial catalogue
preparation happens before a browser can connect and does not show progress.
After the watch debouncer chooses an action, the serialized queue applies these
rules:

| Selected action | Shows progress | Failure sets `failure` | Success clears it |
| --------------- | -------------- | ---------------------- | ----------------- |
| `reconfigure`   | yes            | yes                    | yes               |
| `rebuild`       | yes            | yes                    | yes               |
| `restart`       | yes            | no                     | no                |
| `reload`        | yes            | no                     | no                |
| `evidence`      | no             | no                     | no                |
| `ignore`        | no             | no                     | no                |

Progress begins when a qualifying action enters the action queue, including a
manual rebuild or recovery restart, and covers all time queued and running. It
does not begin during the filesystem debounce interval, when no winning action
exists yet. If the debouncer subsumes several notifications, only its
highest-priority selected action applies. If the action queue subsumes pending
actions, progress begins with the first qualifying enqueue and stays true
without a false transition while any qualifying action remains queued or
running. A following evidence-only action does not extend it.

A rebuild that discovers changed watch targets and executes reconfiguration is
still one source-update action: either successful outcome clears a failure and
either thrown outcome replaces it. Shutdown cancellation creates no failure.
Failures from `reload`, `restart`, unexpected-child recovery, evidence refresh,
or background Changes/render completion retain the existing failure and keep
their current terminal or Changes reporting. A quick accepted source runtime
therefore counts as a successful rebuild even if later background Changes work
becomes unavailable.

Starting another action while a failure is shown retains the notice and its
id. After the progress delay, both are visible. A successful rebuild or
reconfigure clears the failure only with the successful content update. A
failed one atomically installs a newly sanitized detail and new id. Reload and
restart completion only ends progress. When another qualifying action is
already pending, the terminal snapshot retains `updating: true`.

## Sanitized Failure Detail

The raw input is the caught value's message (`Error.message`, otherwise its
string coercion), never a stack. The parent applies these steps in order:

1. Strip complete ANSI/ECMA-48 escape sequences, including CSI and OSC links.
2. Normalize CRLF and CR to LF, replace each tab with two spaces, replace
   unpaired UTF-16 surrogates with U+FFFD, and remove every remaining C0/C1
   control plus DEL except LF.
3. Rewrite absolute POSIX, Windows drive, UNC, and `file:` paths that resolve to
   `repoRoot` or a descendant as `.` or a repository-relative POSIX path.
   Preserve any trailing `:line[:column]` location. Replace every other
   absolute filesystem path with the literal `<absolute path>`. HTTP(S) URLs
   are not filesystem paths and remain unchanged.
4. Trim surrounding whitespace. If nothing remains, use
   `No additional details are available.`
5. Limit the result to 2,048 Unicode scalar values and 8,192 UTF-8 bytes. If
   either limit truncates it, trim trailing whitespace from the fitting prefix
   and append U+2026, with the ellipsis included in both limits. Never split a
   scalar value or UTF-8 sequence.

The post-sanitizing value must be nonempty and within both limits before it can
cross IPC. The disclosure renders it as a text node with preserved line breaks;
it never uses HTML injection, Markdown, linkification, or terminal styling.

## Parent-To-Child Transport

The exact private IPC command is:

```json
{
  "type": "rebuild-status",
  "status": {
    "failure": null,
    "sequence": 1,
    "updateVersion": 1,
    "updating": false
  }
}
```

The parser requires the exact envelope and status shapes, numeric bounds,
failure-id relationship, and sanitized-detail bounds. It does not attempt to
repair an invalid parent payload. A post-readiness invalid, conflicting, or
oversized command emits one bounded child diagnostic and retains the last
valid snapshot. A watched child must receive one valid snapshot during the
existing 10-second startup transfer window and install it before announcing
readiness; an absent or invalid initial snapshot fails startup. An unwatched
child receives no such command.

The supervisor retains the latest snapshot independently of the child and
sends it to every replacement. A child restart while failed therefore has the
same failure in its first served descriptor, including while the restart action
also has progress. Older sequences are ignored; an identical replay is a
no-op; the same sequence with different bytes is invalid.

A command fenced above the child's current update version is staged, not
visible. When that version becomes current, the child commits the staged
status, catalogue/runtime update, private descriptor, and event-stream version
as one state transition before notifying browsers. A successful source action
reserves its resulting update version, sends the clearing snapshot with that
fence, and only then publishes the update. A restarting child installs the
matching snapshot before `ready`. Thus old content cannot adopt a clear, and a
request cannot pair a new content version with the preceding failure.

## Descriptor, Events, And Adoption

The schema-1 private `ViewerCapabilityDescriptor` gains optional field
`rebuildStatus: RebuildStatus`. It is present on every watched shell response
and absent at every boundary listed above. The CLI host and viewer runtime both
use one strict value validator; descriptor validation also requires
`rebuildStatus.updateVersion <= source.updateVersion`. An invalid marked page
is the existing hard descriptor error.

`/__mokly/events` uses event name `rebuild`. Its `data` is canonical one-line
JSON containing exactly `RebuildStatus`. On stream open, the child atomically
captures one state and sends `ready`, then `rebuild`, then the optional
`interactive` replay. Every active stream receives a `rebuild` event after an
immediately active status transition. It sends no public or consumer data.

The CLI host validates each event before offering it to the viewer. Invalid
events are reported as browser warnings and ignored. The viewer keeps the
greatest validated sequence. A newer snapshot whose fence is above the
installed source is held pending; evidence adoption applies it atomically when
that source reaches the fence, while a content change obtains it from the
replacement page. Duplicate and older sequences cannot restore progress or a
failure. Route-evidence reads may advance status only under the same source,
route, and revision checks as their descriptor.

Each shell request captures its source and active rebuild status atomically.
Each new tab therefore renders the current notice immediately. A reconnecting
stream receives the complete current snapshot, not deltas. A failure between
HTML capture and stream connection wins by sequence on replay; a clear cannot
win until its content fence does. Every tab converges independently without
one tab acknowledging or clearing server state.

## Shell Behavior And Accessibility

The shell reads only `useViewerLiveState().rebuildStatus`. A failure notice is
shell chrome on every route, outside Static and Live frames. Its initial
descriptor value is visible during server rendering and hydration. A mounted
document announces the headline and explanation through the existing polite,
atomic `#mb-status` region once when it adopts a new `failure.id`; progress or
replay of that id does not announce it again. A failure already present at
first paint is the accessible document baseline, not a live change, so reloads
and newly opened tabs do not reannounce it. Focus never moves automatically.

Progress becomes visible exactly 1,000 ms after that client first observes one
uninterrupted `updating: true` interval. A transition to false before the timer
fires cancels it, so fast updates never flash. A newer true snapshot does not
restart the timer. Initial hydration starts the same timer. While hidden, the
progress area leaves no visible empty placeholder at either width: reserved
geometry must live inside already occupied, flexible shell chrome, or use a
non-obscuring overlay that covers no control or content. Reduced-motion styling
removes nonessential animation without removing the text.

The [design contract](./mokly-rebuild-status-design.md) fixes the notice,
disclosure, copy, responsive states, and prohibition on a left-edge accent
rail. Opening details is local shell state. It stays open while the same
failure id remains, closes when that failure is replaced or cleared, is not
part of reload recovery, and never changes the server status.

## Failure Handling And Verification

- EventSource loss leaves the descriptor state visible and reports the existing
  optional-transport warning; a later connection replays current state.
- If no child is ready, the parent still advances and retains status. The next
  child receives only the latest snapshot before readiness.
- A lazy Live bundle failure, including a missing generation capture, uses the
  existing Live-unavailable state and never becomes a rebuild failure.
- Status never changes the terminal diagnostic, last-good catalogue, Changes
  state, update recovery, or public catalogue revision semantics.

Milestone 3 must test the complete action matrix, debounce/queue coalescing,
continuous queued progress, retry-while-failed behavior, sanitizing and both
bounds, strict envelopes, staged success clears, child restart retention,
descriptor/event validation, stream replay, stale/duplicate ordering, and
absence from every excluded boundary. Milestone 4 must provide the pinned-source
tests in the [Serve delivery contract](./mokly-interactive-views-serve.md).
Milestone 5 must use a real watched Serve to test first paint, multiple tabs,
reconnection, once-per-id announcements, the 1,000 ms threshold, Static/Live and
every route at both widths. Milestone 6 must smoke source, config, and resource
success/failure/recovery and retain screenshots.

## Related Docs

- [Watched development](./mokly-watch.md)
- [Live viewer capabilities](./mokly-live-capabilities.md)
- [Interactive Serve delivery](./mokly-interactive-views-serve.md)
- [Viewer contract](./mokly-viewer.md)
- [Shell design](./mokly-shell-design.md)
