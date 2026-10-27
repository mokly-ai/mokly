# mokly-watch

`mokly-watch` observes catalogue inputs for watched Serve. The CLI combines
its events with manual rebuild requests. `mokly-graph` owns render keys and
`mokly-server` owns atomic publication. Build and publish create no observer.

## Responsibilities

- Compile source, stylesheet, PostCSS, resource, and user-rule inputs.
- Preserve exact required files below denied directory names.
- Prune broad traversal without following directory symlinks.
- Keep the latest event for each path and the strongest action for a burst.
- Attach native watches before consumer modules run.
- Close every watch at shutdown.

## What This Crate Does

`Plan` classifies events and exposes effective targets. Source roots and
PostCSS directory recipes observe additions and removals. Required file
ancestors keep atomic saves and missing resources observable. The deepest
explicit root defines the denial boundary.
An ancestor move schedules the strongest action of its required descendants.
The native observer watches each confined ancestor so repaired directories
remain observable.

`NativeObserver` implements `dyn Observer` over the platform `notify`
backend. It attaches nonrecursive directory watches after a confined walk.
It replaces the native observer only when effective roots change. Exact
inputs extend registrations without repeating the root walk. `dyn WatchFactory`
and `dyn DirectoryWatch` own native handle creation and batched updates.
Existing paths remain attached. Linux and Windows renew replaced directories. Failed attachments recheck
source projection to detect vanished paths. Unspecified directory writes are
discarded before classification. Unknown
platform create and remove kinds use node lookup. Overflow and pathless
events request a rescan and report one warning per observer. `close` prevents later attachment.
The observer inbox keeps one latest descriptor per path. Access notifications
never schedule work. `Batch` retains every accepted candidate and selects
`reload`, `rebuild`, or `config` in increasing impact order.

The CLI owns debounce, serialized preparation, last-good recovery, and
publication. Changes can observe generation replacement through the shared
server publication boundary. No event grants permission to serve its file.

## Quick Start

Build the packages first, because the `mokly` shim loads the built runtime.
Then run the tests and a watched Serve of the example catalogue:

```bash
npm run build
cargo test -p mokly-watch
npm run dev -- --port 0
```

Construct `NativeObserver` with the initial resolved `Plan` before catalogue
preparation. Call `replace` with validated source and stylesheet inventories.
Call `rescan` after a directory event. Drain events with `take` after `changed`
settles. Stop the action queue before calling `close`.

## Development

```bash
cargo clippy -p mokly-watch --all-targets -- -D warnings
```

Tests use pure plans and captured events. Integration tests use an isolated
directory and assert file changes without elapsed-time assertions.

### Key Code

- [`src/plan.rs`](./src/plan.rs) defines `Plan`, which compiles the watch
  inputs, applies the denial rules, and classifies each event into an action.
- [`src/observer.rs`](./src/observer.rs) defines `Observer`, the boundary that
  callers use to replace plans, rescan, wait, drain events, and close.
- [`src/native.rs`](./src/native.rs) defines `NativeObserver`, the `Observer`
  implementation over the platform `notify` backend.
- [`src/backend.rs`](./src/backend.rs) defines `WatchFactory` and
  `DirectoryWatch`, which own native handle creation and batched updates.
- [`src/event.rs`](./src/event.rs) defines `Event`, `Action`, and `Batch`,
  which keep the latest event per path and the strongest queued action.

### Related Docs

- [Watch inputs](../../docs/protocol/mokly-watch.md).
- [Watch runtime](../../docs/protocol/mokly-watch-runtime.md).
- [Render graph](../../docs/architecture/rust-core.md#render-graph).
