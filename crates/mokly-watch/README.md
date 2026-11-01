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
It replaces the native observer only when effective roots change.
`covers` reports whether its registrations already hold every directory that
the roots of a plan need. Serve uses it to decide whether a candidate with
changed roots must prepare again. `observes` reports whether one directory is
registered, so Serve checks the modification times of exact files only where
no event could arrive. Exact inputs extend registrations without repeating
the root walk.

`dyn WatchFactory` and `dyn DirectoryWatch` own native handle creation and
batched updates. Existing paths remain attached. Linux and Windows renew
replaced directories: one batch removes the watch and then adds it again.
`NotifyFactory` is the platform `notify` adapter. Its handles send each
batch to `update_paths` in one call. When an operation fails, `notify`
returns that operation and the operations that it did not try. The handle
then sends the untried operations in a new call. A failed removal whose
watch or path is gone counts as removed. A failed addition is skipped when
its directory vanished. The error kind or a recheck of source projection
shows that the directory vanished. For any other failure, the handle keeps
the first error and returns it after the rest of the batch. When `notify`
names no failed operation, the handle cannot tell which operations of that
call succeeded. It then stops and keeps its attachment state from before
that call. It returns the first error, and a later update can try those
operations again.

Unspecified directory writes are discarded before classification. Unknown
platform create and remove kinds use node lookup. An event with the rescan
flag, or with no path, queues a repository-root change and reports one
warning per observer. `close` prevents later attachment. The observer inbox
keeps one latest descriptor per path. Access notifications never schedule
work. `Batch` retains every accepted candidate and selects `reload`,
`rebuild`, or `config` in increasing impact order.

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

The [manifest](./Cargo.toml) pins `notify = "=9.0.0-rc.7"`, a release
candidate. `notify` 8.2 did not report two kinds of event loss. On macOS, it
dropped a "must scan subdirectories" event whose path was neither a watched
directory nor its child. FSEvents can report that event at an ancestor of
the watched directories. On Windows, it ignored an overflowed read, which
reports zero bytes. On `ERROR_NOTIFY_ENUM_DIR`, it unwatched the directory
and only logged the error. The release candidate reports both losses as
events with the rescan flag. The observer turns each such event into a
repository-root change. The pin is exact, because SemVer gives no
compatibility promise between release candidates.

Exit: when `notify` 9.0.0 is released, move the pin to 9.0.0. Then check
again that the macOS and Windows backends of 9.0.0 report both losses as
events with the rescan flag. This check proves the behaviour of a
third-party watcher, so it runs once, outside the test suite.

### Key Code

- [`src/plan.rs`](./src/plan.rs) defines `Plan`, which compiles the watch
  inputs, applies the denial rules, and classifies each event into an action.
- [`src/observer.rs`](./src/observer.rs) defines `Observer`, the boundary that
  callers use to replace plans, rescan, wait, drain events, and close.
- [`src/native.rs`](./src/native.rs) defines `NativeObserver`, the `Observer`
  implementation over the platform `notify` backend.
- [`src/backend.rs`](./src/backend.rs) defines `WatchFactory` and
  `DirectoryWatch`, which own native handle creation and batched updates,
  and their platform `notify` adapter `NotifyFactory`.
- [`src/event.rs`](./src/event.rs) defines `Event`, `Action`, and `Batch`,
  which keep the latest event per path and the strongest queued action.

### Related Docs

- [Watch inputs](../../docs/protocol/mokly-watch.md).
- [Watch runtime](../../docs/protocol/mokly-watch-runtime.md).
- [Render graph](../../docs/architecture/rust-core.md#render-graph).
