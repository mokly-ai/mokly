# Watched Serve Rebuild Status Transport

## Status And Scope

Implemented for watched Serve. This document owns private parent-to-child IPC,
descriptor and event-stream delivery, update-version staging, and browser
adoption. The [status model](./mokly-rebuild-status.md) owns action phases,
sanitization, and shell behavior.

## Parent-To-Child IPC

The exact private command is:

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

The parser requires exact envelope and status shapes, numeric bounds, the
failure-id relationship, and sanitized-detail limits. It never repairs an
invalid parent payload. After readiness, an invalid, conflicting, or oversized
command emits one bounded child diagnostic and retains the last valid snapshot.
A watched child must receive one valid snapshot during the existing 10-second
startup transfer window and install it before announcing readiness. An
unwatched child receives no command.

The supervisor retains the latest snapshot independently and sends it to every
replacement. A child restart while failed therefore serves the same failure in
its first descriptor, including while restart progress is visible. Older
sequences are ignored, an identical replay is a no-op, and the same sequence
with different bytes is invalid.

A command fenced above the child's current update version is staged, not
visible. When that version becomes current, the child commits status,
catalogue/runtime update, private descriptor, and event-stream version as one
transition before notifying browsers. A successful source action reserves its
update version, sends the clearing snapshot with that fence, then publishes the
update. A restarting child installs the matching snapshot before `ready`.
Old content therefore cannot adopt a clear, and new content cannot pair with
the preceding failure.

## Descriptor And Event Stream

The schema-1 private `ViewerCapabilityDescriptor` has optional
`rebuildStatus: RebuildStatus`. It is present on every watched shell response
and absent from unwatched Serve, public catalogue and bootstrap data, generated
output, export, publication, and embedded hosts. CLI and viewer use one strict
validator; descriptor validation also requires
`rebuildStatus.updateVersion <= source.updateVersion`.

`/__mokly/events` uses event name `rebuild`. Its data is canonical one-line
JSON containing exactly `RebuildStatus`. On stream open, the child atomically
captures one state and sends `ready`, then `rebuild`, then optional
`interactive`. Active streams receive `rebuild` after each immediately active
transition. No public or consumer data enters the event.

The CLI host validates each event before offering it to the viewer. Invalid
events are browser warnings and are ignored. The viewer keeps the greatest
validated sequence. A newer snapshot fenced above the installed source waits
pending; evidence adoption applies it atomically when the source reaches the
fence, while content replacement reads it from the new page. Duplicate and
older sequences cannot restore progress or failure. Route-evidence reads may
advance status only under the same source, route, and revision checks as their
descriptor.

Each shell request captures source and status atomically, so a new tab renders
the current notice immediately. A reconnect receives the complete snapshot,
not deltas. A failure between HTML capture and stream connection wins by
sequence on replay; a clear cannot win until its content fence does. Tabs
converge independently without acknowledging or clearing server state.

## Failure Handling And Verification

EventSource loss leaves descriptor state visible and reports the existing
optional-transport warning; reconnection replays current state. If no child is
ready, the parent still advances and retains status, and the next child gets
only the latest snapshot before readiness. Invalid commands or events never
replace the last valid state.

Tests cover strict envelopes, staged clears, child restart retention,
descriptor/event validation, stream replay, stale and duplicate ordering,
cross-source fences, multiple tabs, reconnection, and absence from every public
or static boundary.

## Related Docs

- [Watched Serve rebuild status](./mokly-rebuild-status.md)
- [Live viewer capabilities](./mokly-live-capabilities.md)
- [Watched development](./mokly-watch.md)
