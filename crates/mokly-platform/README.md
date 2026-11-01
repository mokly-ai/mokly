# mokly-platform

`mokly-platform` isolates operating-system primitives for the Mokly core.
Use its traits for output transactions, cache locks, and child-tree ownership.
`mokly-git`, `mokly-sidecar`, and `mokly-compare` own child processes through
it. `mokly-static` moves output with its exclusive rename. It depends on no
other workspace crate.

## Responsibilities

- Rename files and directories atomically without replacing a destination.
- Acquire nonblocking shared and exclusive file locks with handle-scoped release.
- Own child process trees. On Unix, own a process group and each descendant
  that its parent links reach, also in a new session. On Windows, own a
  kill-on-close job object.
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
On Unix, the child starts a new session, so it leads its own process group.
On Linux, it also becomes a subreaper, so an orphan inside the owned tree
keeps a parent link to it while it runs.

The guard records the child's identity, its PID and start time, before the
caller can reap the child. A reused PID therefore never receives a signal. The
guard records this identity also when the child has already exited. The Linux
and macOS readers of the process table keep an exited process readable until
its parent reaps it.

A Unix stop first sends `SIGSTOP` to the group. It then follows parent links
from the child and from the descendants that an earlier stop found, and stops
each new descendant at once. It sends the requested signal to the group and
to each found descendant, also one in a new session. After `SIGTERM`, it sends
`SIGCONT`, so that their handlers run. The guard keeps the found identities,
so a later `SIGKILL` reaches a descendant whose parent died after the
`SIGTERM`.

A stop of a reaped child with no kept descendants signals only the group. A
tree that keeps changing ends the search after 64 complete passes, and the
stop then returns an error after it signals what it found. When the process
table cannot be read, the stop still signals the group, and then returns the
error. A missing group or process is already stopped. On macOS, a permission
result counts as stopped only after enumeration confirms no live member. An
unreadable member status keeps the original signal error.

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

The FFI is isolated in the Unix modules, the Windows module, and the flush
module. Each unsafe call documents its pointer, handle, or process-identity
requirements.

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

Real OS tests live in `tests/` and use isolated temporary directories. The
process-tree tests start real helper processes. They treat a zombie process as
gone. The tests of escaped sessions re-run the test binary as a helper that
calls `setsid()`, because macOS has no `setsid` command. The attachment test
observes the exit of `sh -c 'exit 23'` with `waitid` and `WNOWAIT`, then
attaches to the unreaped child and stops it.
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
- [`src/unix.rs`](./src/unix.rs) starts a Unix child in a new session, makes
  it a Linux subreaper in `configure`, and records its identity in `attach`.
  [`src/windows.rs`](./src/windows.rs) holds the Windows FFI calls.
- [`src/unix_process_tree/group.rs`](./src/unix_process_tree/group.rs)
  defines `UnixGroup`, the Unix `ProcessGroup`. It stops the group, finds the
  descendants, signals them, and keeps their identities for the next stop.
- [`src/unix_process_tree/walk.rs`](./src/unix_process_tree/walk.rs) defines
  `descendants`, the queue walk. Each pass scans every new descendant in the
  same pass, and `MAX_PASSES` bounds the complete passes at 64.
- [`src/unix_process_table/mod.rs`](./src/unix_process_table/mod.rs) defines
  `ProcessTable`, the boundary that reads a `ProcessIdentity` of PID and start
  time, lists direct children, and signals a confirmed identity.
  [`linux.rs`](./src/unix_process_table/linux.rs) reads
  `/proc/{pid}/task/{tid}/children`, scans `/proc/*/stat` when those files are
  absent, and signals through a pidfd with a `kill` fallback.
  [`macos.rs`](./src/unix_process_table/macos.rs) uses libproc.
- [`src/unix_group_members.rs`](./src/unix_group_members.rs) confirms that a
  macOS group has no live member before a permission result counts as stopped.
- [`tests/process_tree/fixture.rs`](./tests/process_tree/fixture.rs) defines
  `Tree`, which starts a helper process tree for a test and cleans it up.
  [`unix_helpers.rs`](./tests/process_tree/unix_helpers.rs) holds the helper
  roles, and [`unix_status.rs`](./tests/process_tree/unix_status.rs) reads
  process state and treats a zombie as gone.

### Related Docs

- [Rust architecture](../../docs/architecture/rust-core.md).
- [Runtime shutdown](../../docs/protocol/mokly-runtime.md#shutdown).
- [Base install bounds and stops](../../docs/protocol/mokly-base-install-processes.md#bounds-and-stops).
- [Static output recovery](../../docs/protocol/mokly-export-recovery.md).
