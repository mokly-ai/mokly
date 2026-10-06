# Baseline Storage And Execution

This is the storage and command contract for [per-commit baseline selection](./mokly-derived-baselines.md).
Historical commands execute trusted repository code; preparation is never an HTTP operation.
This contract defines the v9 storage and compatibility boundary.
The [v9 manifest gate](./mokly-generated-manifest.md#selection-cache-and-resource-addressing)
permits only v9 content readers and retains earlier-version outcome.
Process ownership, locking, confinement and metadata-only retention follow the rules below.

## Rebuild Procedure

The builder runs the following steps for one merge-base commit.

The [package `repoRoot` rule](./mokly-package.md#configuration-discovery) applies at
every Git boundary. A root mismatch remains `config-invalid`
and is not converted to a baseline history error.

1. Resolve the merge base of `HEAD` and the configured base ref with Git. A
   missing ref, shallow history, or unrelated histories fail as
   `baseline-history-unavailable`.
2. Probe only the canonical manifest in the requested generated subtree.
   Complete v9 output uses blobs. A version below v9 at that current location
   returns `baseline-incompatible-earlier`. A committed root-level manifest
   is ignored. A missing manifest or incomplete inventory needs the builder;
   acquire its entry lock, including on cache hits. Sweep safe crash leftovers
   under that lock as a best-effort maintenance step.
3. Reuse only complete valid v9 output with the matching commit, requested
   catalogue and recipe. Invalid, incomplete or unreadable data is partial; remove its owned
   contents under the lock, then
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
5. Locate the historical catalogue using the ordered current-root lookup,
   then bounded extraction scan in
   [baseline addressing](./mokly-baseline-addressing.md#discovery-after-a-rebuild).
   Zero or several eligible candidates fail `baseline-output-invalid` with
   sorted candidates. The base and head may use different `mockupsDir` paths.
6. If the selected output is earlier than v9, apply existing pre-adoption
   cleanup and maintenance-error handling under the lock, then return
   `baseline-incompatible-earlier`. Do not harvest old documents, write a
   completion marker or upgrade the build's toolchain. The caller retains this
   outcome for the pinned base and recipe in memory; no cache entry records it.
   A later command invocation rebuilds again when current-location blobs cannot
   establish the version.
7. For valid, inventory-verified v9, move
   `<source>/<historical mockupsDir>/mokly-generated/` into
   `output/<historical mockupsDir>/mokly-generated/`, then copy exactly the
   manifest's `assetClosure` beside it under the historical catalogue root.
   Validate every file as a confined regular file; missing, symlinked or
   protected sources fail `baseline-output-invalid`. Never harvest a flat tree. Readers map repository-relative paths directly into this v9
   cache using the historical root. Delete the remaining extraction, including
   installed dependencies. Write `inputs.json`, then write the completion
   marker to a unique `complete-<uuid>.tmp` beside `complete.json`. Rename that
   temporary file atomically to `complete.json`. Successful rename is the commit point:
   the result is adopted immediately and cannot be removed by this build's
   failure path. Retention cleanup and lock release are separate best-effort
   post-steps; their failures are reported on stderr and do not fail the build.

Before the marker commit point, cancellation terminates the running command's
owned process tree, waits for exit and output closure, removes the partial entry, and reports
`baseline-interrupted`. Cancellation after the marker rename returns the completed
cached result, skips remaining retention cleanup and still attempts lock release.
If partial-entry removal or lock release fails while a build is already failing,
report that maintenance failure separately and retain the original typed build
error and its diagnostics. A partial entry can be retried under the next lock.
Serve's shutdown drain includes rebuild processes using the same rules as its
Git processes.

## Cache Layout

The cache lives at `<repoRoot>/.mokly-cache/baselines/`; the sibling
`locks/` directory holds only the transient
[generated-output writer lock](./mokly-rendering-generated.md#concurrent-writers).
Its release removes only the lock file, never a directory, so creating a cache
entry never races a directory removal. The cache is package owned: never served, never watched, never a comparison resource, excluded from
changed-path evidence and shared-impact globs before those globs are evaluated,
and never a valid `mockupsDir`, root, resolved entry module or document,
`review.outDir`, or export destination. Consumers add `.mokly-cache/` to their
ignore file; only `check` runs the index guard, failing if Git tracks anything under it.

```text
.mokly-cache/baselines/<commit>/
  lock            # holder pid and start time, created exclusively
  source/         # extraction, removed after adoption
  output/         # v9: repo-relative mokly-generated plus authored closure
  complete.json   # completion marker
  inputs.json     # JSON string containing requested/current repo-relative mockupsDir ("." at repo root)
```

New `complete.json` markers are `{ schemaVersion: 2, commit, finishedAt,
commands, manifestVersion: 9, historicalCatalogueRoot, layout: "generated-v9" }`.
The root identifies the harvest; it never replaces the requested path in
`inputs.json`. Reuse requires the matching commit, request and recipe, a valid
v9 manifest and its verified inventory/closure. Keep the
[reader mapping](./mokly-baseline-addressing.md#cache-identity-and-readers).

A reusable entry requires regular bounded JSON files for `complete.json` and
`inputs.json`, the exact schema-1 marker with `manifestVersion: 8` and
`layout: "generated-v9"`, a safe historical root, matching commit, requested
path and argv arrays, and complete valid v9 output. Verify generated membership,
blob hashes and every authored closure file with the same confinement rules.
Keep the completion-marker and manifest version checks; no earlier layout is
parsed or adapted. Validate the marker first, then the stored catalogue path and
command list, then the output. A valid v9 marker with settings different from
the request fails intact with `Cached baseline uses different build settings; remove <entry> before changing catalogues or commands`.
Invalid or earlier markers are partial before this comparison. Never replace a
settings-mismatch error with a rebuild.

Invalid or incomplete entry data is partial: missing files, invalid or empty JSON,
truncation, unreadable data, earlier/newer marker versions, unsafe paths,
invalid v9 data, stale bytes or incomplete closure. Return a miss,
not a content reader or an earlier-version outcome. Cancellation still aborts
instead of rebuilding. Under the held lock, remove only owned partial content
without following symlinks; cleanup failure cannot permit reuse of bad bytes.

The builder writes the temporary completion file only after adoption, source
removal and input-record completion. Before the rename, failure or cancellation
removes the partial entry and temporary marker. After the rename, the result is
committed: cancellation and maintenance failure cannot remove it. A crash with
only a temporary file leaves a partial entry for locked cleanup. Never expose
partially written `complete.json`.

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
entry it just built or an entry another process holds locked. Invalid and
partial entries do not consume retention slots: acquire each candidate's own
lock and remove it safely, regardless of the retained count. Retention classifies
only the completion marker and `inputs.json`. It never reads or hashes output.
Full inventory and closure validation runs only on reuse. Cleanup records each entry's stat, lock,
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
`discard-<commit>` directories, regular `complete-<uuid>.tmp` files and regular
`.lock-<pid>-<uuid>` temporary files whose process no longer exists. Skip live owners, unrecognized names, symlinks
and special files. Per-file failures are reported and do not invalidate a
completed baseline. This sweep also runs on warm cache reuse.

Identity-specific `lock.retired-<hash>` tombstones deliberately survive until
the whole entry is retired: removing them independently would allow a delayed
reclaimer to unlink a successor's lock. Unrecognized temporaries without a PID are
also retained until entry retirement because their owner cannot be checked.

The approved [cache acquisition rule](./mokly-comparison-inventory.md#cache-acquisition-and-discovery)
recreates an entry directory removed by retention and retries only ENOENT, at
most three attempts. Existing lock deadlines, cancellation and ownership stay.
