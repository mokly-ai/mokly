# Git Command Runtime

Mokly runs Git with an explicit checkout directory and argument vector. It
starts no shell. Standard output and standard error have independent capture
bounds of at most 64 MiB each. Standard error has a 1 MiB bound by default,
even for a small standard output read. An output-limit failure terminates the
owned process tree.

## Child Environment

Ordinary Git commands remove repository and history selection variables:

- `GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`, and `GIT_COMMON_DIR`;
- `GIT_OBJECT_DIRECTORY` and `GIT_ALTERNATE_OBJECT_DIRECTORIES`;
- `GIT_NAMESPACE` and `GIT_PREFIX`;
- `GIT_SHALLOW_FILE`, `GIT_GRAFT_FILE`, and `GIT_REPLACE_REF_BASE`;
- `GIT_NO_REPLACE_OBJECTS` and `GIT_IMPLICIT_WORK_TREE`.

A command therefore reads the requested checkout and its history even when
Mokly starts inside a Git hook. `GIT_CONFIG_*` variables stay inherited.
This preserves CI overrides such as `safe.directory`. Other environment
values stay inherited. Checkout conversion preserves the user's repository
working-directory context for filters. Converted output stays in memory or in
owned temporary storage outside the repository. Git and LFS downloads retain their normal
object stores. An inherited attribute source cannot replace
the pinned commit's attributes.

## Cancellation And Fetch

Helper-free Git commands own a separate process group. Each request selects
this mode explicitly. Every other command owns the full process tree,
including helpers that start another session. Windows uses an owned job for
both modes. Decision: only helper-free commands use a plain group. Rejected:
one plain group for every command, because a helper can leave its group.

Cancellation requests SIGTERM for the owned process tree, then SIGKILL after
one second if it remains. A command settles after
the process and its pipes close. A Git helper process never outlives its
command. The
[runtime shutdown contract](./mokly-runtime.md#shutdown) owns shutdown order.
Base reads disable Git's lazy fetch while they check object presence. A
promisor remote fetches every missing base object in one bounded request before
the converted read starts. A failed fetch names a recovery `git fetch`
command. Missing objects without a promisor remote retain a typed fetch error.

## File Listings

Mokly lists working-tree files with `git ls-files` for the
[working dependency inputs](./mokly-base-dependencies.md#dependency-identity)
and for the untracked [changed paths](#repository-and-history). It also uses
these listings to check the Git status of working files for
[ignored modules](./mokly-comparison-packages.md#ignored-modules). The listings
run with `core.fsmonitor=false`, so Git starts no file system monitor hook
or daemon for them. Other Git commands keep their monitor setting.

With the monitor disabled and without a promisor remote, a listing starts no
helper and owns a plain group. With a promisor remote, a listing keeps the full
process tree. A listing can read the trees of a sparse index. Mokly disables
lazy fetch for a listing. A Git build that ignores that setting can still fetch
a missing tree.

The monitor saves these listings no work. Disabling it also makes the plain
group available without a promisor remote, which avoids a fork on Unix.
Commands that attach the untracked cache, such as `git status`, use the
monitor to skip directory reads.

Evidence from the Git 2.49.0 source:

- `ls-files` [starts its directory walk from `DIR_INIT`](https://github.com/git/git/blob/v2.49.0/builtin/ls-files.c#L574).
  [`DIR_INIT` is all zeros](https://github.com/git/git/blob/v2.49.0/dir.h#L360),
  so the walk has no untracked cache.
- `ls-files` [calls `fill_directory`](https://github.com/git/git/blob/v2.49.0/builtin/ls-files.c#L405)
  and never attaches the untracked cache of the index to the walk.
- [`validate_untracked_cache` returns no cache](https://github.com/git/git/blob/v2.49.0/dir.c#L2930-L2931)
  for such a walk. The walk then reads every directory, with or without the
  monitor.
- [`git status` attaches the cache](https://github.com/git/git/blob/v2.49.0/wt-status.c#L801).
  With the cache, the monitor lets Git skip reads of unchanged directories.

A one-time Linux check with Git 2.49.0 used 100,000 untracked files in 1,000
directories, a warmed untracked cache, and a monitor hook. With and without the
monitor, the listing read the same 1,002 directories with 2,004 `getdents64`
calls. Both returned the same 2,700,012 bytes. Over six pairs, the mean time
was 77.84 ms with the monitor and 73.77 ms without it, with a broad spread.
`git status` with the same cache and hook read no directory.

## Repository And History

Before other reads, the configured repository directory must be the Git
checkout root. Both paths are compared in canonical form, so a symlink alias of
the same root is valid. A mismatch keeps both paths in the root error. No Git
command refreshes the index through optional locks.

The comparison base is the merge base of `HEAD` and the commit that
`review.base` names. Mokly pins that object id for the comparison. A
`review.base` value is never read as a Git option. Missing refs retain their
Git failure. Unrelated or shallow histories that cannot prove a common
ancestor return the history failure. Do not use a reflog fork point as a
substitute.

Changed paths compare the pinned base with the working tree, with Git rename
detection. They include committed, indexed and unindexed tracked edits, and
untracked paths that the standard Git ignore rules do not exclude. A rename
keeps its old and new paths and Git's similarity. If only one rename path is
UTF-8, Mokly keeps it as an addition for the destination or a deletion for the
source, and traces the other. An untracked addition never forms a rename.
Changed paths are unique and in lexical POSIX order. Candidate paths retain
nonportable filename characters; they grant no source-read permission.
External diff drivers and textconv filters never run. An indexed deletion
that is also an untracked working file is a modification, because the working
side retains it. Entry move pairing remains under the
[move contract](./mokly-moves.md).

## Tree, Blob, And Source Archive Reads

Repository paths preserve spelling and case. They are UTF-8 POSIX paths
without an absolute prefix, empty or dot segments, or NUL. Colons and literal
backslashes remain ordinary Git name characters; the catalogue validates
matched source names. Untracked directory records and non-UTF-8 candidates
are skipped with a trace diagnostic.
All tree pathspecs are literal. Tree reads are bounded by the command limit
and by independent bounds of 100,000 regular files and 1,000,000 metadata
nodes.

A base file read requires exact regular-file mode in the pinned commit's
tree. A missing path and a nonregular path have distinct errors. Symbolic
links are not followed. Git checkout conversion applies the pinned commit's
attributes with the user's Git configuration, including line endings, built-in
encodings, custom smudge filters, and Git LFS downloads. Conversion may use
the network within its time and byte bounds. The working file
is never compared with the raw pointer blob. Converted bytes stay within the
selected file and batch bounds. Raw source admission also keeps those bounds.
Opaque public resources instead use a streamed SHA-256 digest of their
converted bytes, so the file bound does not apply to them. Standard error
keeps its capture bound. The digest keeps process-tree ownership,
cancellation, and exit validation.
A comparison budget failure makes Changes unavailable with its limit and
requested path; it does not fail the current build.

One Git process converts each bounded batch of base files. A batch returns
the same bytes as the conversion of each file alone. A file larger than the
batch byte bound converts alone. Decision: one process converts a whole batch.
Rejected: one process for each converted file, because process start-up
dominated base preparation.

A source archive contains checkout-converted regular files from the commit.
Extraction checks leaf count and total converted bytes before file writes.
The total converted bytes are a disk bound, which base extraction sets from
the source cache capacity. Extraction preserves executable files and omits links and
submodules. It does not apply archive-only substitutions. If a conversion
filter fails, reaches its time limit, or exceeds a byte bound, that resource is
unavailable with a `base-conversion` warning and independent resources continue.
Each conversion process has a 120-second time limit. When a batch
conversion fails, reaches that limit, or exceeds a byte bound, each of its
files converts again alone, so a file is unavailable only when its own
conversion fails. A file whose own conversion reached the time limit stays
unavailable for the rest of that base preparation, without another attempt. Optional
filter failures also make the resource unavailable; raw fallback bytes are not
valid comparison evidence. Partial archives retain these warnings and do not
become reusable cache entries.
The destination must not exist. A partial extraction is removed on failure.
Git metadata directories are never extracted. A name unsupported by the host
is skipped with a trace: Windows cannot store colon or backslash names,
reserved device names, or names with trailing dots or spaces.

The [base preparation contract](./mokly-base-preparation.md) owns base source
reads and extraction. The [base cache](./mokly-base-cache.md) owns leases, and
the [dependency contract](./mokly-base-dependencies.md) owns installations.
