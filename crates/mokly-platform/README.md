# mokly-platform

`mokly-platform` isolates operating-system primitives for the Mokly core.
Use its traits for output transactions, cache locks, and child-tree ownership.
It depends on no other workspace crate.

## Responsibilities

- Rename files and directories atomically without replacing a destination.
- Acquire nonblocking shared and exclusive file locks with handle-scoped release.
- Create Unix process groups and Windows kill-on-close job objects.
- Expose typed errors that callers can handle without string matching.

## What This Crate Does

`Rename` uses Linux `renameat2(RENAME_NOREPLACE)`, macOS
`renamex_np(RENAME_EXCL)`, or Windows `MoveFileExW` without replacement flags.
`Locks` uses the standard library's OS-backed shared and exclusive locks.
Shared leases coexist. Exclusive mutation and eviction fail while a lease
is held. Dropping its
guard releases the lock and leaves the lock file intact.

`ProcessGroups` configures a child before spawn, then attaches an ownership
guard immediately after spawn. The caller retains the child and its pipes.
The Unix implementation sends signals to the whole group. The Windows
implementation starts the child suspended, attaches a kill-on-close job, and
resumes its primary thread. This keeps descendants inside the job from their
first instruction. It requests a console break for
graceful termination, and terminates the job for forceful cancellation.
The runner must kill and reap a child if attachment fails. The runner owns
shutdown deadlines and pipe draining.

The FFI is isolated in the Unix and Windows modules. Each unsafe call documents
its pointer, handle, or process-identity requirements.

## Quick Start

```rust
use mokly_platform::locks::{Locks, SystemLocks};
use std::path::Path;

let locks: &dyn Locks = &SystemLocks;
let held = locks.try_lock(Path::new("/tmp/mokly-example.lock"))?;
# Ok::<(), mokly_platform::error::Error>(())
```

## Development

```bash
cargo test -p mokly-platform
cargo clippy -p mokly-platform --all-targets -- -D warnings
```

Real OS tests live in `tests/` and use isolated temporary directories.

### Key Code

- [Rename](./src/rename.rs), [locks](./src/locks.rs), and
  [process groups](./src/processes.rs).
- [Unix adapter](./src/unix.rs) and [Windows adapter](./src/windows.rs).

### Related Docs

- [Rust architecture](../../docs/architecture/rust-core.md).
- [Runtime shutdown](../../docs/protocol/mokly-runtime.md#shutdown).
- [Static output recovery](../../docs/protocol/mokly-export-recovery.md).

Consumers enable the `mock` feature to use every public trait with unimock.
