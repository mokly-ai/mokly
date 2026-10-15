# Git Command Runtime

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

`mokly-git` runs Git through a trait-backed command runner, with an explicit
checkout directory and argument vector. It starts no shell. Standard output
and standard error are captured concurrently with independent bounds. Each
has a 64 MiB ceiling; stderr defaults to 1 MiB even for a small stdout read.
An output-limit failure terminates the owned process tree.
Requests can select smaller independent bounds. A request above 64 MiB fails with
`InvalidOutputLimit` before process configuration or command execution.

## Child Environment

Every Git command removes repository and history selection variables:

- `GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`, and `GIT_COMMON_DIR`;
- `GIT_OBJECT_DIRECTORY` and `GIT_ALTERNATE_OBJECT_DIRECTORIES`;
- `GIT_NAMESPACE` and `GIT_PREFIX`;
- `GIT_SHALLOW_FILE`, `GIT_GRAFT_FILE`, and `GIT_REPLACE_REF_BASE`;
- `GIT_NO_REPLACE_OBJECTS` and `GIT_IMPLICIT_WORK_TREE`.

A command therefore reads the requested checkout and its history even when
Mokly starts inside a Git hook. `GIT_CONFIG_*` variables stay inherited.
This preserves CI overrides such as `safe.directory`. Other environment
values stay inherited.

## Batches And Cancellation

Path requests use bounded batches. An empty path list starts no command.
Batches preserve the requested order and stop at the first failed invocation.
A path too large for one batch fails before command execution.

Tree and blob reads use bounded output and stdin input through the same
runner. Cancellation requests SIGTERM for the whole process group, then
SIGKILL after one second if it remains. Windows uses the owned job. A command
settles after the process and its pipes close. The
[runtime shutdown contract](./mokly-runtime.md#shutdown) owns shutdown order.

## Repository And History

Before other reads, compare the canonical configured repository directory
with the canonical result of `git rev-parse --show-toplevel`. A mismatch
keeps both paths in the typed root error. A symlink alias of the same root
is valid. No Git command refreshes the index through optional locks.

Resolve `review.base` with `rev-parse --verify --end-of-options` as a commit,
then run `merge-base` against `HEAD`. Pin that object id for the comparison.
Missing refs retain their Git failure. Unrelated or shallow histories that
cannot prove a common ancestor return the typed history failure. Do not use
a reflog fork point as a substitute.

Diff the pinned base against the working tree with NUL-delimited name/status
records and Git rename detection. This includes committed, indexed and
unindexed tracked edits. Add untracked paths from `ls-files --others
--exclude-standard`. Keep old and new paths and Git's similarity for a
rename. If only one rename path is UTF-8, retain it as `Added` for the
destination or `Deleted` for the source, and trace the other. Do not infer a rename from an untracked addition. Return unique
current paths in lexical POSIX order. Candidate paths retain nonportable
filename characters; they grant no source-read permission. Disable external diff and textconv.
An indexed deletion that is also an untracked working file is `Modified`,
because the working side retains it. Entry move pairing remains under the
[move contract](./mokly-moves.md).

## Tree, Blob, And Source Archive Reads

Repository paths preserve spelling and case. They are UTF-8 POSIX paths
without an absolute prefix, empty or dot segments, or NUL. Colons and literal
backslashes remain ordinary Git name characters; the catalogue validates
matched source names. Untracked directory records and non-UTF-8 candidates
are skipped with a trace diagnostic.
All tree pathspecs are literal. Tree output is NUL-delimited and bounded by
the command limit and independent regular-file and total-node bounds. Defaults
are 100,000 regular files and 1,000,000 metadata nodes. Composition selects both. The commit index retains
directories, links and submodule modes as well as regular leaves. An empty
root request starts no source query. A whole-tree query is explicit.
The comparison source index loads configured roots and requested paths only.
Exact path lookups use bounded nonrecursive batches and cache missing paths.

A blob read first proves exact regular-file mode and size from the pinned
commit's tree. A missing path and a nonregular path have distinct errors.
Symbolic links are not followed. Cat-file batches receive full object ids on
stdin. Each batch has at most 4,096 objects and 48 MiB of framed output.
Headers, object ids, sizes, delimiters and trailing bytes are checked.
An object that cannot fit one byte-read batch fails before a blob read starts.
Opaque public resources instead use a streamed SHA-256 digest: stdout feeds
the hash through a 64 KiB buffer, and stderr keeps its capture bound. The
stream keeps process-tree ownership, cancellation, and exit validation.
A comparison budget failure makes Changes unavailable with its limit and
requested path; it does not fail the current build.

A source archive contains regular blobs from the commit. Extraction checks
leaf count and total uncompressed bytes before file writes.
The aggregate is a disk bound; base extraction sets it from the source cache
capacity. Files are written one batch at a time, so a commit larger than one
batch does not require its full contents in memory. Blobs larger than one
batch stream directly to disk through a 64 KiB buffer. The stream checks the
proved blob size, exit status, and cancellation; stderr keeps its capture bound.
Extraction preserves executable files and omits links and submodules. It
never applies `export-ignore`, `export-subst`, textconv or checkout filters.
The destination must not exist. A partial extraction is removed on failure.
Git metadata directories are never extracted. A name unsupported by the host
is skipped with a trace: Windows cannot store colon or backslash names,
reserved device names, or names with trailing dots or spaces.

Stdin is binary and bounded to 64 MiB. The writer closes it after the given
bytes, including empty input. Output drains concurrently while stdin writes.
Cancellation before spawn starts no process. On completion the runner also
terminates remaining owned helpers. The
[base preparation contract](./mokly-base-preparation.md) owns source readers,
extraction leases and dependency installations.
