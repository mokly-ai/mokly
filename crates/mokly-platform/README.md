# mokly-platform

`mokly-platform` isolates operating-system primitives for the Mokly core.
Use its traits for output transactions, cache locks, and child-tree ownership.
`mokly-git`, `mokly-sidecar`, and `mokly-compare` own child processes through
it. `mokly-static` moves output with its exclusive rename. It depends on no
other workspace crate.

## Responsibilities

- Rename files and directories atomically without replacing a destination.
- Acquire nonblocking shared and exclusive file locks with handle-scoped release.
- Create Unix process groups and Windows kill-on-close job objects.
- Flush cache data with a filesystem barrier or plain file synchronization.
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
The Unix implementation starts a new session and sends signals to the whole
group. A missing group is already stopped. On macOS, a permission result
counts as stopped only after enumeration confirms no live member. An
unreadable process status keeps the original signal error.
The Windows
implementation starts the child suspended, attaches a kill-on-close job, and
resumes its primary thread. This keeps descendants inside the job from their
first instruction. It requests a console break for
graceful termination, and terminates the job for forceful cancellation.
The caller, such as the `mokly-git` runner, must kill and reap a child if
attachment fails. The caller owns shutdown deadlines and pipe draining.

`Flush` uses one Linux `syncfs` for a filesystem. Its per-file fallback uses
plain Unix `fsync`, which avoids a macOS drive-cache barrier for each data
file. Windows flushes individual files. The `mokly-compare` cache coordinator
publishes its completion receipt only after data synchronization.

The FFI is isolated in the Unix, Windows and flush modules. Each unsafe call documents
its pointer, handle, or process-identity requirements.

## Quick Start

```rust
use std::path::Path;

use mokly_platform::error::Result;
use mokly_platform::locks::{FileLock, Locks, SystemLocks};

fn hold_lock(path: &Path) -> Result<Box<dyn FileLock>> {
    let locks: &dyn Locks = &SystemLocks;
    locks.try_lock(path)
}
```

The lock stays held until the caller drops the returned guard.

## Development

```bash
cargo test -p mokly-platform
cargo clippy -p mokly-platform --all-targets -- -D warnings
```

Real OS tests live in `tests/` and use isolated temporary directories.
Consumers enable the `mock` feature to use every public trait with unimock.

### Key Code

- [`src/rename.rs`](./src/rename.rs) defines `Rename` and `SystemRename`,
  which move a file or directory only when the destination is absent.
- [`src/locks.rs`](./src/locks.rs) defines `Locks` and `SystemLocks`, which
  acquire nonblocking shared and exclusive `FileLock` guards.
- [`src/processes.rs`](./src/processes.rs) defines `ProcessGroups` and
  `SystemProcessGroups`, which configure a child before spawn and return a
  `ProcessGroup` guard that terminates or kills the whole tree.
- [`src/flush.rs`](./src/flush.rs) defines `Flush` and `SystemFlush`, which
  flush a filesystem, a file, or a directory before a cache entry is published.
- [`src/error.rs`](./src/error.rs) defines `Error`, the typed failure that
  every trait returns.
- [`src/unix.rs`](./src/unix.rs) and [`src/windows.rs`](./src/windows.rs) hold
  the Unix and Windows FFI calls behind these traits.

### Related Docs

- [Rust architecture](../../docs/architecture/rust-core.md).
- [Runtime shutdown](../../docs/protocol/mokly-runtime.md#shutdown).
- [Static output recovery](../../docs/protocol/mokly-export-recovery.md).
