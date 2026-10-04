# Export Recovery

This supplements the [consumer export contract](./mokly-export.md). The same
rules apply to consumer export and repository preview publication.
No new CLI options or supported JavaScript API are introduced.

## Captured Ownership And Installation

1. Before generation, record whether output is absent or a real directory, with
   exact bigint device, inode, and birth-time identity. Validate ownership and
   verify that identity again before accepting the reservation. Revalidate both
   identity and ownership before capture; initial absence never authorizes a
   directory that appears later, even if empty or correctly marker-owned.
2. Validate the actual captured backup before the stage can be installed. This
   catches unowned files, empty directories, symlinks, special entries, or invalid
   inventories introduced after the first destination check. Verify the captured
   directory still has the initial identity. Missing or substituted backups
   also fail. Capturing a path does not itself grant ownership of its contents.
3. On validation, cancellation, or installation failure, restore only a real
   backup directory and only if the destination is still observed as absent.
   Use an OS-enforced no-replace rename without deleting or clearing the
   destination first. Any destination appearing during the operation, including
   an empty directory, must make recovery fail without being overwritten.
4. If restoration is unsafe or fails, preserve the destination and backup and
   identify the recovery path. Never automatically restore a captured symlink
   or regular file over a destination. A successful restoration preserves all
   captured bytes, including unexpected unowned files, and export still fails.
5. Stage-to-output rename is the commit point. Once started it is drained rather
   than interrupted. A successful rename is never undone solely because later
   backup or reservation cleanup fails.

Ownership remains path-based: the existing inventory authorizes replacement of
its named generated files, not arbitrary new files. A failed operation that never
moved previous output must not claim that it restored a previous export.

## Exclusive Rename Boundary

All three moves (output to backup, stage to output, backup to output) use the
same exclusive rename boundary. The filesystem decides absence and rename in
one operation; `lstat` followed by Node's replacing rename is not equivalent.
Do not emulate this by copying entries into a visible directory, by a shell
`mv`, or by retrying a failed exclusive rename with ordinary rename.

The package uses a lazily loaded Koffi native bridge: Linux
`renameat2(RENAME_NOREPLACE)`, macOS `renamex_np(RENAME_EXCL)`, and Windows
`MoveFileExW` without replacement/copy flags. Paths must be absolute and NUL-free;
Windows paths use the wide-character, namespaced form. Capture uses the same
primitive so an unsupported platform, filesystem, or unavailable bridge fails
before existing output is moved. Keep optional platform binaries installed;
ordinary build/check/serve and help do not load the export bridge. There is no
cross-filesystem copy fallback and no new consumer toolchain requirement on
platforms with packaged binaries.

The short native rename and immediate OS error capture are synchronous, with
no callback or asynchronous hop between them. Export drains that commit operation
as before. This guarantees no replacement of a competing destination, not a
filesystem compare-and-swap of source identity: validate source identity before
capture and again on the captured backup, restoring substitutions when safe.

Primary references: [Node rename](https://nodejs.org/api/fs.html#fspromisesrenameoldpath-newpath),
[Koffi calls and libraries](https://koffi.dev/load),
[Linux rename semantics](https://www.kernel.org/doc/html/latest/filesystems/vfs.html),
[Apple rename flags](https://github.com/apple-oss-distributions/xnu/blob/main/bsd/sys/stdio.h),
and [Windows MoveFileExW](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefileexw).

## Bounded Cleanup

After installation, validate the backup again and retain that exact validated
file/directory list for deletion. Unlink only those files, remove known child
directories deepest first with non-recursive removal, remove the marker last,
then remove the backup root non-recursively. Do not pass a captured backup to a
recursive removal operation. Unlisted additions during deletion must stop
directory removal and survive for recovery.

Cleanup can partially remove owned files after the commit point. Its error must
say that the new site is installed and identify the remaining backup; it must
not imply that the retained backup is necessarily a complete old site.

Final reservation cleanup uses `lstat` to recognize every existing backup entry,
including dangling symlinks, and refuses to delete it. Only the private generated
stage may be removed recursively. The transaction marker is unlinked individually
and the reservation directory is removed non-recursively, so a backup or other
unowned entry appearing after the initial check cannot be swept away. The owned
parent namespace metadata remains as specified by the export contract.
Retrying cleanup after the reservation is already absent is a successful no-op.

Reservations coordinate Mokly writers, not unrelated editors. Consumers must
not mutate the private reservation namespace. These checks preserve detected
destination conflicts and late unlisted additions; they are not a claim of
atomic exclusion against hostile changes to arbitrary filesystem ancestors.

## Primary And Cleanup Failures

Use one cleanup policy for partial transaction setup and the export orchestrator:
normal export error categorization occurs before this policy handles that failure.

- Run cleanup once and await it before returning or throwing.
- If only the operation fails, propagate that same error object unchanged.
- If only cleanup fails, propagate that failure and return a nonzero CLI exit.
- If both fail, show the primary failure first, followed by the cleanup
  diagnostic and any recovery path. Use an `export-invalid` error with an
  `AggregateError` cause containing the original primary and cleanup objects,
  in that order. Do not discard a cause chain or treat a thrown `undefined` as
  proof that no failure occurred.
- Cancellation, rollback, backup disposal, and reservation cleanup follow the
  same policy. CLI signal handlers still detach when the operation finishes.

The normal CLI prints actionable combined messages without requiring diagnostic
mode or printing stacks. It never prints the success message when cleanup fails.

## Cancellation And Recovery Precedence

The [publish exchange contract](./mokly-upload-exchange.md#accounting-and-output)
owns the shared cancellation classification. This document owns how export
transactions apply it:

### Pre-installation Window

The pre-installation window ends immediately before installation begins. Its
boundary treats the command's signal as fired only after the event loop has
processed all signals the operating system already delivered. If a covered step
fails while the signal is not set, the boundary lets the event loop complete
one full turn that includes an I/O poll, then checks once more. This uses no
wall-clock delay; two consecutive `setImmediate` continuations provide the
turn. The extra check closes the terminal race where Ctrl+C stops esbuild and
its failure reaches Mokly before Node invokes the SIGINT listener.

For `mokly export`, the signal listener is installed after configuration is
loaded. The window covers these operations:

1. Comparison preparation and the base-manifest read.
2. Catalogue compilation.
3. Public-file capture and changed-path evidence collection.
4. Comparison generation, Changes calculation and removed-page preview
   capture.
5. Site assembly, adapter transformation and publication-metadata validation.
6. Staging, including the finalized export capture callback.
7. The final input recheck, prepared-baseline recheck and output-location
   recheck.

`mokly publish` installs its listener earlier, so the same window additionally
covers publish configuration loading and repository identity. Two operations
remain outside it because their failures carry separate recovery guarantees:
opening the export transaction keeps its reservation error, and writing the
generated build output keeps the build transaction's rollback error.

If the signal is set after the event-loop check, the failure is a cancellation.
Marking a `MoklyError` as cancellation keeps the original error object, class,
fields, message and stack; `MOKLY_DIAGNOSTIC=1` therefore shows the stack from
the failing operation. A non-`MoklyError` keeps the existing marked
`Could not export catalogue` wrapper. `mokly export` prints the original code
and message, while `mokly publish` prints the publication-cancelled output.
This window is the only place cancellation may be inferred from the command
signal. It is safe because installation has not begun: no backup or reservation
holds the previous export, and the previous output has not moved.

From the moment each command installs its signal listeners until its work and
cleanup finish, `mokly export` and `mokly publish` hold a referenced Node
handle. Ctrl+C during unreferenced helper startup, including esbuild startup,
therefore still settles through Mokly's reporter and exits with status 1 rather
than letting Node end early with unsettled work.

Stage and reservation cleanup still run. If cleanup fails after a
pre-installation cancellation, the combined recovery error is not a
cancellation and retains the cleanup diagnostic and recovery path.

### Installation And Recovery

- Cancellation during installation is a cancellation when no previous output
  was moved and all cleanup succeeds.
- Cancellation after capturing the previous export is a cancellation when
  rollback restores that export and all remaining cleanup succeeds. The
  restored export remains installed even though the command fails.
- A failed restore, backup cleanup or reservation cleanup is a recovery error,
  not a cancellation. If it accompanies cancellation, the combined
  `export-invalid` error retains both failures and names every backup or
  reservation path the user needs.
- Outside the pre-installation window, cancellation comes only from the shared
  explicit classification. `mokly export` keeps its existing messages and exit
  behavior. Publish may replace only a cancellation with its cancellation
  output; it must show every recovery error unchanged.

For example, if cancellation occurs during installation and restoring the
previous export fails, `mokly publish` prints the export rollback error naming
the retained backup. It does not print the publication-cancelled line. All of
these failed commands exit with status 1.

## Verification

Tests inject mutations immediately before capture, after capture, during backup
deletion, and during final reservation cleanup. Cover restoration conflicts,
dangling backup links, partial setup, and exact primary/secondary cause identity.
Exercise late empty and marker-owned destinations, disappeared/substituted
initial output, and empty conflicts exactly at both install and restore calls.
Native primitive tests must run on Linux, macOS, and Windows and prove complete
directory moves, Unicode paths, and no replacement of every destination kind.
Real subprocess CLI tests must assert exit status and stderr for rollback,
backup-cleanup, cancellation-plus-cleanup, and cleanup-only failures.
