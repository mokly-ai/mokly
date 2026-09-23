# Baseline Storage And Execution

This is the storage and command contract for [derived baselines](./mokly-derived-baselines.md).
Historical commands execute trusted repository code; preparation is never an HTTP operation.

## Delivery Status

Removal of fallback path evidence from cached-baseline classification is
planned by [remove-source-path-evidence](../../plans/remove-source-path-evidence.md)
and implemented in Milestone 4. The current code still checks shared-impact
paths until then; the cache confinement target below does not.

## Rebuild Procedure

The builder runs the following steps for one merge-base commit.

The [package `repoRoot` rule](./mokly-package.md#configuration-discovery) applies at
every Git boundary in both output modes. A root mismatch remains `config-invalid`
and is not converted to a baseline history error.

1. Resolve the merge base of `HEAD` and the configured base ref with Git. A
   missing ref, shallow history, or unrelated histories fail as
   `baseline-history-unavailable`.
2. Acquire the entry lock, including on cache hits. Sweep safe crash leftovers
   under that lock as a best-effort maintenance step.
3. Reuse a valid completion marker without executing any command. On a miss,
   extract the commit with Git's archive format into
   the entry's `source` directory. Entries that escape the directory, symlinks
   that resolve outside it, hard links, and special files fail
   as `baseline-extraction-failed`. Archive input is uncompressed and bounded
   to 64 MiB and 65,536 entries; malformed archives or exceeded limits fail
   explicitly. Parsing reuses the input buffer and single-chunk file bodies
   without making full-sized copies. All entry
   paths and symlink chains are validated before extraction writes begin.
   Confined source symlinks are preserved; output symlinks are rejected.
4. Run each `baselineBuild` command in the `source` directory without a shell.
   The environment and Windows command rules below apply. Standard output and error are captured
   and bounded to a combined 64 KiB tail. A non-zero exit fails as
   `baseline-command-failed` with the
   zero-based command index, argv, exit code or signal, and the last 40 output
   lines.
5. Locate `<source>/<mockupsDir>` using the current config's repository-relative
   `mockupsDir`. Parse its manifest with the historical-manifest reader; the
   same version rules apply as for committed baselines. A missing directory,
   missing manifest, or invalid manifest fails as
   `baseline-output-invalid`. Moving `mockupsDir` between the base and head
   commits is therefore unsupported in derived mode until the move is merged.
6. Move `<source>/<mockupsDir>` to the entry's `output` directory, delete the
   remaining `source` extraction including installed dependencies, write the
   completion marker. Successful completion of that write is the commit point:
   the result is adopted immediately and cannot be removed by this build's
   failure path. Retention cleanup and lock release are separate best-effort
   post-steps; their failures are reported on stderr and do not fail the build.

Before the marker commit point, cancellation terminates the running command's
owned process tree, waits for exit and output closure, removes the partial entry, and reports
`baseline-interrupted`. Cancellation after the marker write returns the completed
cached result, skips remaining retention cleanup and still attempts lock release.
If partial-entry removal or lock release fails while a build is already failing,
report that maintenance failure separately and retain the original typed build
error and its diagnostics. A partial entry can be retried under the next lock.
Serve's shutdown drain includes rebuild processes using the same rules as its
Git processes.

## Cache Layout

The cache lives at `<repoRoot>/.mokly-cache/baselines/`. It is package
owned: never served, never watched, never a comparison resource, excluded from
changed-path evidence and rendered-resource classification,
and never a valid `mockupsDir`, entry glob root, resolved entry module,
`review.outDir`, or export destination. Consumers add `.mokly-cache/` to their ignore file; derived
`check` also fails when Git tracks anything under it.

```text
.mokly-cache/baselines/<commit>/
  lock            # holder pid and start time, created exclusively
  source/         # extraction, removed after adoption
  output/         # the rebuilt mockupsDir tree
  complete.json   # completion marker
  inputs.json     # JSON string containing repository-relative mockupsDir
```

`complete.json` is `{ schemaVersion: 1, commit, finishedAt, commands,
manifestVersion }`. An entry is complete only when the marker parses, its
`commit` matches the directory name, and `output/<manifest>` exists. Anything
else is a partial entry and is removed under the lock before the next attempt.
The historical manifest is validated again on reuse. A complete entry with a
different `inputs.json` output path or command list fails as
`baseline-output-invalid` and remains intact. The commit-only cache holds one
catalogue/build configuration; remove that entry before changing those settings.

Lock contents are published atomically using an exclusively linked temporary
file. Its identity is captured before publication and returned with ownership;
no subsequent metadata operation is required before the caller receives its
release handle. Failure to remove the temporary name is reported separately and
must not change ownership, contention, or the original publication error.
Dead-holder reclamation retains an
identity-specific tombstone until entry cleanup, preventing stale concurrent
observers from unlinking a replacement lock. Lock holders whose process no
longer exists are reclaimed. Other waiters poll every 100 ms
until the holder finishes, then reuse the completed entry. Waiting longer than
the default two-minute lock timeout fails as `baseline-lock-timeout`.

After a successful rebuild the builder removes complete entries beyond the
retained count, newest markers first, defaulting to three. It never removes the
entry it just built, an entry another process holds locked, or partial entries
belonging to a live lock holder. Cleanup records each entry's stat, lock,
rename, remove and release failures, continues with other eligible entries,
and reports those failures on stderr. A concurrent entry removal is tolerated.
Root listing failures skip cleanup. Failure or cancellation of these post-steps
never removes the active completion marker or output and never rejects a
successful rebuild; a failed retirement may leave files for later maintenance.

## Command Environment And Windows Launching

Commands receive an explicit, case-insensitive allowlist: `PATH`, `PATHEXT`,
`HOME`, `USERPROFILE`, `HOMEDRIVE`, `HOMEPATH`, `APPDATA`, `LOCALAPPDATA`,
`SYSTEMROOT`, `WINDIR`, `COMSPEC`, locale and temporary-directory variables;
`HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`, `NO_PROXY`, `NODE_EXTRA_CA_CERTS`,
`SSL_CERT_FILE`, `SSL_CERT_DIR`; and npm's `proxy`, `https_proxy`, `noproxy`,
`cafile` and `registry` configuration variables. Names retain their original
case. The builder forces `CI=1` and `MOKLY_BASELINE_COMMIT=<commit>`.
Execution hooks such as `NODE_OPTIONS`, Git overrides, token variables, and
unrelated secrets are excluded. Historical dependency installation still uses
project/user npm configuration files; this allowlist is not a sandbox.

On Windows, bare `npm` and `npx` search the working directory, then PATH directories
in order, trying each directory's extensions in PATHEXT order (default
`.COM;.EXE;.BAT;.CMD`). Native `.exe` and `.com` launchers run directly.
Only the selected `.cmd` launcher resolves its installation's JavaScript entry
point and invokes it with Node. Explicit `.cmd` names or paths select only that
extension, regardless of PATHEXT. Extensionless explicit paths search only their
named directory. Unsupported selected launchers and unresolved custom shims fail
instead of silently selecting another installation. Arguments remain literal,
including spaces, quotes, percent signs and shell metacharacters. Other Windows
recipes must name native executables or run JavaScript explicitly with Node;
Mokly does not enable a shell to interpret arbitrary batch scripts.

POSIX commands run beneath a Node gate worker in an owned process group;
cancellation sends TERM then KILL after one second. When verification ownership
is inherited, the group registers atomically before the gate releases the
command. Windows commands belong to a non-inheritable, kill-on-close Job Object
created through the package's existing native bridge. The same gate worker is
assigned before it receives the command. Registration, assignment or
native-bridge failures fail closed before historical code starts. Windows
cancellation terminates the entire job even if the immediate launcher has
exited; disposal waits until the job has no active processes and all captured
pipes close. Successful commands also dispose their scope, terminating any
silent background descendants. If the owning Mokly process exits abruptly,
Windows closes its job handle and terminates the owned tree.

## Crash Leftovers

Before reading or rebuilding an entry under its lock, remove its owned
`discard-<commit>` directories and regular `.lock-<pid>-<uuid>` temporary files
whose process no longer exists. Skip live owners, unrecognized names, symlinks
and special files. Per-file failures are reported and do not invalidate a
completed baseline. This sweep also runs on warm cache reuse.

Identity-specific `lock.retired-<hash>` tombstones deliberately survive until
the whole entry is retired: removing them independently would allow a delayed
reclaimer to unlink a successor's lock. Legacy temporaries without a PID are
also retained until entry retirement because their owner cannot be checked.
