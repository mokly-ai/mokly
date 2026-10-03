# Baseline Storage And Execution

This is the storage and command contract for [per-commit baseline selection](./mokly-derived-baselines.md).
Historical commands execute trusted repository code; preparation is never an HTTP operation.
This contract defines the v8 storage and compatibility boundary.
The [v8 manifest gate](./mokly-generated-manifest.md#selection-cache-and-resource-addressing)
permits only v8 content readers and retains `main`'s earlier-version outcome.
Process, lock, confinement and retention rules remain unchanged.

## Rebuild Procedure

The builder runs the following steps for one merge-base commit.

The [package `repoRoot` rule](./mokly-package.md#configuration-discovery) applies at
every Git boundary. A root mismatch remains `config-invalid`
and is not converted to a baseline history error.

1. Resolve the merge base of `HEAD` and the configured base ref with Git. A
   missing ref, shallow history, or unrelated histories fail as
   `baseline-history-unavailable`.
2. If the committed-manifest probe already found earlier output, return
   `baseline-incompatible-earlier` without commands or cache adoption. Otherwise
   acquire the entry lock, including on cache hits. Sweep safe crash leftovers
   under that lock as a best-effort maintenance step.
3. Reuse a valid v8 completion marker without commands. A matching completed
   older cache returns the earlier-version outcome under the probe below.
   On a cache miss,
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
6. If the selected output is earlier than v8, apply existing pre-adoption
   cleanup and maintenance-error handling under the lock, then return
   `baseline-incompatible-earlier`. Do not harvest old documents, write a
   completion marker or upgrade the build's toolchain. The caller retains this
   outcome for the pinned base and recipe; a later command invocation may
   rebuild again when no committed manifest or completed cache proves it.
7. For valid, inventory-verified v8, move
   `<source>/<historical mockupsDir>/mokly-generated/` into
   `output/<historical mockupsDir>/mokly-generated/`, then copy exactly the
   manifest's `assetClosure` beside it under the historical catalogue root.
   Validate every file as a confined regular file; missing, symlinked or
   protected sources fail `baseline-output-invalid`. Never harvest a flat
   legacy tree. Readers map repository-relative paths directly into this v8
   cache using the historical root. Delete the remaining extraction, including
   installed dependencies, and write the completion marker. Successful
   completion of that write is the commit point:
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

The cache lives at `<repoRoot>/.mokly-cache/baselines/`; the sibling
`locks/` directory holds only the transient
[generated-output writer lock](./mokly-rendering-generated.md#concurrent-writers),
whose release removes an empty `.mokly-cache/`. Creating a cache entry
therefore restarts its ancestor walk, at most five times, when a parent
disappears. The cache is package owned: never served, never watched, never a comparison resource, excluded from
changed-path evidence and shared-impact globs before those globs are evaluated,
and never a valid `mockupsDir`, entry glob root, resolved entry module,
`review.outDir`, or export destination. Consumers add `.mokly-cache/` to their
ignore file; only `check` runs the index guard, failing if Git tracks anything under it.

```text
.mokly-cache/baselines/<commit>/
  lock            # holder pid and start time, created exclusively
  source/         # extraction, removed after adoption
  output/         # v8: repo-relative mokly-generated plus authored closure
  complete.json   # completion marker
  inputs.json     # JSON string containing requested/current repo-relative mockupsDir ("." at repo root)
```

New `complete.json` markers are `{ schemaVersion: 1, commit, finishedAt,
commands, manifestVersion: 8, historicalCatalogueRoot, layout: "generated-v8" }`.
The root identifies the harvest; it never replaces the requested path in
`inputs.json`. Reuse requires the matching commit, request and recipe, a valid
v8 manifest and its verified inventory/closure. Keep the
[reader mapping](./mokly-baseline-addressing.md#cache-identity-and-readers).

For existing schema-1 completed entries with `manifestVersion` 2–7, keep
only a bounded compatibility probe. Validate the envelope, commit, requested
path and command list before inspecting its manifest. A `generated-v6` marker
with a safe historical root probes `output/<root>/mokly-generated/mokly-manifest.json`.
An older flat marker (`legacy` or no descriptor) probes canonical, former and
legacy names directly under `output/`; absent descriptor fields do not create
a resource reader. These are fixed manifest lookup locations only.

A regular canonical envelope whose older version agrees with the marker, or
a regular former-name sentinel for that older marker, proves
`baseline-incompatible-earlier` without another build. Leave the completed
entry intact for that result and normal retention; never serve, harvest,
translate or relabel its contents as v8. The committed-tree gate has priority:
a complete committed v8 baseline uses blobs regardless of an obsolete cache.

Missing completion data or a missing manifest is a partial entry and follows
existing locked cleanup/rebuild rules. A selected malformed/nonregular manifest,
version disagreement, unknown newer marker or unsafe location is not earlier
output: fail `baseline-output-invalid` and retain diagnostic evidence. A
completed entry with different requested inputs or commands also fails intact
with the existing remove-entry guidance, rather than bypassing the identity
check because its format is old. No fresh pre-v8 completion marker is written.
The commit-only cache still holds one catalogue/build configuration.

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
