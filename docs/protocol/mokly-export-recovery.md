# Static Build Recovery

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

This page supplements the [static build contract](./mokly-export.md). The same
rules apply to `mokly build` and to the private build that `mokly publish`
runs. No CLI option or JavaScript API is introduced.

## Captured Ownership And Installation

1. Before rendering, record whether the output is absent or a real directory,
   with its exact device, inode, and birth-time identity. Validate ownership
   and verify that identity again before accepting the reservation. Revalidate
   both identity and ownership before capture; initial absence never
   authorizes a directory that appears later, even if empty or correctly
   marker-owned.
2. Validate the actual captured backup before the stage can be installed.
   This catches unowned files, empty directories, symlinks, special entries,
   or invalid inventories introduced after the first destination check.
   Verify that the captured directory still has the initial identity. A
   missing or substituted backup also fails. Capturing a path does not itself
   grant ownership of its contents.
3. On validation, cancellation, or installation failure, restore only a real
   backup directory and only if the destination is still observed as absent.
   Use an OS-enforced no-replace rename without deleting or clearing the
   destination first. Any destination appearing during the operation,
   including an empty directory, makes recovery fail without being
   overwritten.
4. If restoration is unsafe or fails, preserve the destination and the backup
   and name the recovery path. Never automatically restore a captured symlink
   or regular file over a destination. A successful restoration preserves all
   captured bytes, including unexpected unowned files, and the build still
   fails.
5. The stage-to-output rename is the commit point. Once started it is drained
   rather than interrupted. A successful rename is never undone solely because
   later backup or reservation cleanup fails.

Ownership is path-based: the existing inventory authorizes replacement of its
named files, not arbitrary new files. A failed operation that never moved the
earlier output must not claim that it restored an earlier build.

## Exclusive Rename Boundary

All three moves (output to backup, stage to output, backup to output) use the
same exclusive rename boundary. The filesystem decides absence and rename in
one operation; a non-following stat followed by a replacing rename is not
equivalent. Do not emulate this by copying entries into a visible directory,
by a shell `mv`, or by retrying a failed exclusive rename with an ordinary
rename.

The platform crate of the [Rust core](../architecture/rust-core.md#crates)
provides the primitive: Linux `renameat2(RENAME_NOREPLACE)`, macOS
`renamex_np(RENAME_EXCL)`, and Windows `MoveFileExW` without replacement or
copy flags. Paths must be absolute and NUL-free; Windows paths use the
wide-character, namespaced form. Capture uses the same primitive, so an
unsupported platform or filesystem fails before existing output is moved. No
JavaScript bridge and no consumer toolchain is involved: the binary of the
platform package makes the call itself. There is no cross-filesystem copy
fallback.

The rename and the immediate capture of the OS error are one synchronous call,
with no asynchronous hop between them. The build drains that commit operation
as described above. This guarantees no replacement of a competing destination,
not a filesystem compare-and-swap of source identity: validate source identity
before capture and again on the captured backup, restoring substitutions when
safe.

Primary references:
[Linux rename semantics](https://www.kernel.org/doc/html/latest/filesystems/vfs.html),
[Apple rename flags](https://github.com/apple-oss-distributions/xnu/blob/main/bsd/sys/stdio.h),
and [Windows MoveFileExW](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefileexw).

## Bounded Cleanup

After installation, validate the backup again and keep that exact validated
file and directory list for deletion. Unlink only those files, remove known
child directories deepest first with non-recursive removal, remove the marker
last, then remove the backup root non-recursively. Do not pass a captured
backup to a recursive removal operation. Unlisted additions during deletion
stop directory removal and survive for recovery.

Cleanup can partially remove owned files after the commit point. Its error
must say that the new site is installed and name the remaining backup; it must
not imply that the retained backup is necessarily a complete old site.

Final reservation cleanup uses a non-following stat to recognize every
existing backup entry, including dangling symlinks, and refuses to delete it.
Only the private stage may be removed recursively. The transaction marker is
unlinked individually and the reservation directory is removed
non-recursively, so a backup or other unowned entry appearing after the
initial check cannot be swept away. The owned parent namespace metadata stays
as the [safety contract](./mokly-export-safety.md) specifies. Retrying cleanup
after the reservation is already absent is a successful no-op.

Reservations coordinate Mokly writers, not unrelated editors. Consumers must
not mutate the private reservation namespace. These checks preserve detected
destination conflicts and late unlisted additions; they are not a claim of
atomic exclusion against hostile changes to arbitrary filesystem ancestors.

## Primary And Cleanup Failures

One cleanup policy covers partial transaction setup and the build itself; the
normal error categorization happens before this policy handles the failure.

- Run cleanup once and wait for it before returning or failing.
- If only the operation fails, report that same error unchanged.
- If only cleanup fails, report that failure and exit non-zero.
- If both fail, show the primary failure first, followed by the cleanup
  diagnostic and any recovery path. The combined error is `export-invalid`
  and carries both causes, the primary first, then the cleanup failure. Do not
  discard a cause chain, and do not treat an empty failure value as proof that
  no failure occurred.
- Cancellation, rollback, backup disposal, and reservation cleanup follow the
  same policy. The command's signal handlers still detach when the operation
  finishes.

The CLI prints actionable combined messages without requiring diagnostic mode
or printing stacks. It never prints the success message when cleanup fails.

## Cancellation And Recovery Precedence

The [publish exchange contract](./mokly-upload-exchange.md#accounting-and-output)
owns the shared cancellation classification. This page owns how the output
transaction applies it.

### Pre-installation Window

The pre-installation window ends immediately before installation begins. Its
boundary treats the command's signal as fired only after the process has
consumed every signal the operating system already delivered. If a covered
step fails while the signal is not yet observed, the boundary drains pending
signal notifications once more and checks again, without a wall-clock delay.
That extra check closes the race in which Ctrl+C stops a sidecar or a Git
process and its failure reaches the core before the signal handler runs.

Both `mokly build` and `mokly publish` install their signal handlers before
configuration loading. The window covers these operations:

1. Configuration loading, base resolution, and the base side's source extraction.
2. Catalogue validation and rendering.
3. Public-file capture and resource comparison.
4. Comparison generation, the Changes calculation, and removed preview
   capture.
5. Output assembly and publication-metadata validation.
6. Staging, including identity finalization and the marker.
7. The final input recheck and the output-location recheck.

`mokly publish` also includes repository inspection and identity in this window. Opening the
output transaction stays outside it, because its failures carry separate
reservation recovery guarantees.

If the signal is set after that check, the failure is a cancellation. Marking
an error as a cancellation keeps the original failure as its diagnostic cause.
`MOKLY_DIAGNOSTIC=1` shows that cause chain. `mokly build` prints `build cancelled` with `build-invalid`, while
`mokly publish` prints the publication-cancelled output. This window is the
only place where cancellation may be inferred from the command signal. It is
safe because installation has not begun: no backup or reservation holds the
earlier output, and the earlier output has not moved.

From the moment a command installs its signal handlers until its work and
cleanup finish, the process stays alive. Ctrl+C during sidecar or Git startup
therefore still settles through Mokly's reporter and exits with status 1
rather than ending the process with unsettled work.

Stage and reservation cleanup still run. If cleanup fails after a
pre-installation cancellation, the combined recovery error is not a
cancellation and keeps the cleanup diagnostic and the recovery path.

### Installation And Recovery

- Cancellation during installation is a cancellation when no earlier output
  was moved and all cleanup succeeds.
- Cancellation after capturing the earlier output is a cancellation when
  rollback restores that output and all remaining cleanup succeeds. The
  restored output stays installed even though the command fails.
- A failed restore, backup cleanup, or reservation cleanup is a recovery
  error, not a cancellation. If it accompanies cancellation, the combined
  `export-invalid` error keeps both failures and names every backup or
  reservation path the user needs.
- Outside the pre-installation window, cancellation comes only from the shared
  explicit classification. `mokly build` keeps its messages and exit
  behaviour. Publish may replace only a cancellation with its cancellation
  output; it must show every recovery error unchanged.

For example, if cancellation occurs during installation and restoring the
earlier output fails, `mokly publish` prints the rollback error naming the
retained backup. It does not print the publication-cancelled line. All of
these failed commands exit with status 1.

## Verification

Tests inject mutations immediately before capture, after capture, during
backup deletion, and during final reservation cleanup. Cover restoration
conflicts, dangling backup links, partial setup, and exact primary and
secondary cause identity. Exercise late empty and marker-owned destinations,
disappeared or substituted initial output, and empty conflicts exactly at both
install and restore calls. Platform primitive tests run on Linux, macOS, and
Windows and prove complete directory moves, Unicode paths, and no replacement
of every destination kind. Real subprocess CLI tests assert exit status and
standard error for rollback, backup-cleanup, cancellation-plus-cleanup, and
cleanup-only failures.
