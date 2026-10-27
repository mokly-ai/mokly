# Git Command Runtime

Status: In progress under the [Batched Base Reads plan](../../plans/batched-base-reads.md).

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
working-directory context for filters. Converted output uses owned temporary
storage outside the repository. Git and LFS downloads retain their normal
object stores. An inherited attribute source cannot replace
the pinned commit's attributes.

## Cancellation And Fetch

Cancellation requests SIGTERM for the whole process group, then SIGKILL after
one second if it remains. Windows uses the owned job. A command settles after
the process and its pipes close. A Git helper process never outlives its
command. The
[runtime shutdown contract](./mokly-runtime.md#shutdown) owns shutdown order.
Base reads disable Git's lazy fetch while they check object presence. A
promisor remote fetches every missing base object in one bounded request before
the converted read starts. A failed fetch names a recovery `git fetch`
command. Missing objects without a promisor remote retain a typed fetch error.

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
conversion fails. Optional
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
