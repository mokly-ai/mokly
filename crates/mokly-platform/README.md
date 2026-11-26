# mokly-platform

`mokly-platform` isolates operating-system primitives for the Mokly core.
Use its traits for output transactions, cache locks, child-tree ownership, and
local volume enumeration.
`mokly-git`, `mokly-sidecar`, and `mokly-compare` own child processes through
it. `mokly-static` moves output with its exclusive rename. `mokly-sidecar`
lists the local volumes for its capture hint through it. It depends on no
other workspace crate.

## Responsibilities

- Rename files and directories atomically without replacing a destination.
- Acquire nonblocking shared and exclusive file locks with handle-scoped release.
- Own child process trees or plain groups for helper-free commands. On Unix,
  reach descendants through parent links, also in a new session. On Windows,
  own a kill-on-close job object in both modes.
- Flush cache data with a filesystem barrier or plain file synchronization.
- List the local APFS and HFS+ volumes of macOS and the fixed NTFS and ReFS
  volumes of Windows, at most 64, without a write.
- Expose typed errors that callers can handle without string matching.

## What This Crate Does

`Rename` uses Linux `renameat2(RENAME_NOREPLACE)`, macOS
`renamex_np(RENAME_EXCL)`, or Windows `MoveFileExW` without replacement flags.
`Locks` uses the standard library's OS-backed shared and exclusive locks.
Shared leases coexist. Exclusive mutation and eviction fail while a lease
is held. Dropping its
guard releases the lock and leaves the lock file intact. The guard unlocks
before it closes the file, so a child process that another thread starts at
that moment cannot keep the lock until its exec.

`ProcessGroups` configures a child before spawn. Immediately after spawn,
`attach` takes the child, creates its ownership guard, and returns a
`ProcessTree` that owns both. The caller takes the pipes before `attach`. A
failed attachment returns an `AttachFailure`, which holds the child and the
cause. No guard exists then. The only way to the child is
`AttachFailure::stop`: it first stops the whole tree with `kill_unattached`,
and then returns an `Unattached` value with the child, the cause, and the
result of the stop. The caller then kills and reaps the child. So no caller
can reap the child of a failed attachment while its descendants still run.
`configure` starts a new Unix session, so the child leads its own group.
On Linux, it also becomes a subreaper, so an orphan inside the owned tree
keeps a parent link to it while it runs. `configure_plain` uses
`Command::process_group(0)` without a `pre_exec` hook for helper-free commands.
The child keeps the parent's session. This permits the standard library's
`posix_spawn` path on macOS and Linux with glibc 2.29 or newer, including a
checkout directory. Both modes use the same `attach` guard.

The guard records the child's identity, its PID and start time, before the
child can be reaped. A reused PID therefore never receives a signal. The
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

`attach` is the only way to get a host guard, and it never gives the child
back with one. So no caller can reap the root while its guard can still
signal. Callers keep the `ProcessTree` until their last signal. Its `wait` blocks until the child exits and leaves the child
unreaped; on Unix it uses `waitid` with `WNOWAIT`. macOS also reports a
stopped child to that wait, so a stop report leads to a short pause and a new
wait. The unreaped child keeps
its PID, so no new process can take that PID or the group number while the
guard can still signal. The tree reaps the child only when it drops, after
the guard. A child that still runs at that point is reaped on its own thread
when it exits. `kill_root` and `kill_unattached` reach the owned child
directly.

A stop of a reaped child with no kept descendants signals only the group. A
tree that keeps changing ends the search after 64 complete passes, and the
stop then returns an error after it signals what it found. When the process
table cannot be read, the stop still signals the group, and then returns the
error. A missing group or process is already stopped. On macOS, a permission
result counts as stopped only after enumeration confirms no live member. An
unreadable member status keeps the original signal error.

The Windows
implementation starts the child suspended in both modes, attaches a kill-on-close job, and
resumes its primary thread. This keeps descendants inside the job from their
first instruction. It requests a console break for
graceful termination, and terminates the job for forceful cancellation.
`kill_unattached` stops a configured child's tree before its first reap when
attachment fails. On Unix, the unreaped child reserves its PID, so cleanup can
follow its descendants without reading the root identity. On Windows, the
unattached child is suspended and cannot have descendants. The caller owns
shutdown deadlines and pipe draining, and the tree owns the reap.

`Flush` uses one Linux `syncfs` for a filesystem. Its per-file fallback uses
plain Unix `fsync`, which avoids a macOS drive-cache barrier for each data
file. Windows flushes individual files. The `mokly-compare` cache coordinator
publishes its completion receipt only after data synchronization.

`CaptureVolumes::local` lists the volumes whose directory change stamps can
verify a sidecar capture. On macOS, it reads at most 64 mounts with
`getfsstat` and `MNT_NOWAIT`. It keeps each `MNT_LOCAL` mount of type `apfs` or
`hfs`, with the device number of its mount point and its file system type
number. On Windows, it reads at most 64 volumes with `FindFirstVolumeW`. It
keeps each `DRIVE_FIXED` NTFS or ReFS volume, with its serial number and its
mount roots. On Linux, the list is empty, because the sidecar classifies Linux
volumes itself. A failed call leaves a volume out and never fails a compile.

The FFI is isolated in the Unix modules, the Windows module, the flush module,
and the volume modules. Each unsafe call documents its pointer, handle, or
process-identity requirements.

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
attaches to the unreaped child and stops it. The `ProcessTree` tests check that
the root stays unreaped through `wait` and `kill`, and that the drop reaps it.
The `AttachFailure` tests check that `stop` calls `kill_unattached` once and
nothing else, and that the host stop ends a running child before `stop` gives
it back.
Consumers enable the `mock` feature to use every public trait with unimock.
The feature also adds `ProcessTree::into_parts`, which gives back the child and
the guard. Test doubles use it to wrap the host guard, and the guard tests use
it to control the child. Production builds do not enable the feature, so they
cannot call it. The integration tests of this crate enable it through a
dev-dependency on the crate itself.

### Key Code

- [`src/rename.rs`](./src/rename.rs) defines `Rename` and `SystemRename`,
  which move a file or directory only when the destination is absent.
- [`src/locks.rs`](./src/locks.rs) defines `Locks` and `SystemLocks`, which
  acquire nonblocking shared and exclusive `FileLock` guards.
- [`src/processes.rs`](./src/processes.rs) defines `ProcessGroups` and
  `SystemProcessGroups`. They configure a child before spawn and attach it to
  a `ProcessTree` whose `ProcessGroup` guard terminates or kills the whole
  tree.
- [`src/processes/failure.rs`](./src/processes/failure.rs) defines
  `AttachFailure` and `Unattached`. A failed attachment gives back its child
  only through `stop`, after `kill_unattached`.
- [`src/processes/tree.rs`](./src/processes/tree.rs) defines `ProcessTree`,
  which owns a child and its guard, waits for the exit without a reap, and
  reaps the child after the guard drops.
- [`src/flush.rs`](./src/flush.rs) defines `Flush` and `SystemFlush`, which
  flush a filesystem, a file, or a directory before a cache entry is published.
- [`src/volumes/mod.rs`](./src/volumes/mod.rs) defines `CaptureVolumes`,
  `SystemCaptureVolumes`, and `LocalVolume`, the bounded list of local volumes
  for the sidecar capture hint. [`macos.rs`](./src/volumes/macos.rs) calls
  `getfsstat`, and [`windows.rs`](./src/volumes/windows.rs) enumerates the
  fixed volumes.
- [`src/error.rs`](./src/error.rs) defines `Error`, the typed failure that
  every trait returns.
- [`src/unix.rs`](./src/unix.rs) starts a Unix session and Linux subreaper in
  `configure`, selects a plain group in `configure_plain`, and records the
  child identity in `attach`.
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
- [`src/unix_group_members.rs`](./src/unix_group_members.rs) reads the members
  of a macOS group after a group signal fails with a permission result. With no
  member left, the group counts as stopped. Members that are only exiting need
  no signal. Each other live member is reported with the identity from the
  same process-table read that showed its membership. `classify` turns a failed
  group signal into a `GroupOutcome` from that read.
- [`src/unix_process_tree/outcome.rs`](./src/unix_process_tree/outcome.rs)
  defines `GroupOutcome` and `send`, which every group signal goes through.
  macOS refuses a group signal while each member is exiting or still in a
  fork, so `send` signals each reported member by that identity, and a process
  that later reuses the ID gets nothing. `send` skips the members when another
  process now holds the root ID, because the group number may then name a new
  group. A `ProcessTree` keeps the root unreaped, so for its guard no other
  process can hold the root ID. A member that refuses its own signal
  keeps the error, and the other members still get the signal.
- [`tests/process_tree/fixture.rs`](./tests/process_tree/fixture.rs) defines
  `Tree`, which starts a helper process tree for a test and cleans it up.
  [`unix_helpers.rs`](./tests/process_tree/unix_helpers.rs) holds the helper
  roles, and [`unix_status.rs`](./tests/process_tree/unix_status.rs) reads
  process state and treats a zombie as gone.

### Related Docs

- [Rust architecture](../../docs/architecture/rust-core.md).
- [Runtime shutdown](../../docs/protocol/mokly-runtime.md#shutdown).
- [Base install bounds and stops](../../docs/protocol/mokly-base-install-processes.md#bounds-and-stops).
- [Stable capture of the bundle cache](../../docs/protocol/mokly-base-cache.md#stable-capture).
- [Static output recovery](../../docs/protocol/mokly-export-recovery.md).
