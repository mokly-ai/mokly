# Static Export Safety And Public Files

This document supplements the [consumer static export contract](./mokly-export.md)
with output confinement and ownership reservations.

## Output Ownership And Confinement

The output must be a strict descendant of `repoRoot`. Validate both lexical
and projected real paths before creating directories and again before replacing
anything. Reject symlink output entries and escapes through symlink ancestors.

An internal hosting adapter may declare a stricter output root. Require the
output to be a strict descendant of that root both lexically and after projecting
real paths, at preflight and again before installation. The repository preview
uses `.context` as this root. A symlink inside it cannot redirect output elsewhere
in the repo. A symlinked root is supported only when its resolved location still
satisfies all core repository/source protections; the transaction pins the real
output location so retargeting cannot redirect installation.

Output must neither contain nor be contained by `mockupsDir` or
`review.outDir`, and must not contain any resolved entry module or document,
or the directory holding one. It must not contain inventoried authoring inputs, the
config, renderer module, or a consumer package's `package.json`. Reject
repository root, Git metadata, dependency directories, and package runtime
directories as targets. These checks also apply when the requested directory
does not yet exist.

Every regular file path, whether produced by core export assembly, copied from
consumer public files, or added by an adapter, must satisfy the
[single portable-path rule](./mokly-export-ownership.md#file-contract) before it
can enter the inventory. No producer can defer that check to marker writing or
publication.

Accept a missing destination or an empty real directory. A nonempty directory
must have a regular `.mokly-export-artifact` ownership file using the
[public schema 2](./mokly-export-ownership.md) and its generated-file inventory.
Reject missing/malformed markers, unexpected files outside the inventory,
unsafe inventory paths, symlink entries, and unsupported versions, including
schema 1 markers written by earlier releases. That case uses this exact message,
where `<output>` is the resolved destination:

```text
[mokly/export-invalid] This folder holds an export from an earlier Mokly release. Move any files you added, then delete <output> and export again.
```

Treat the marker as public-safe metadata: no absolute checkout paths,
credentials, or timestamps. Never use its strings as unchecked deletion
targets. Export owns replacement of its recorded output files.

Serialize writers to the same resolved output with an exclusive reservation;
a competing process fails clearly. An abandoned reservation is never silently
stolen. An actionable error identifies it for explicit recovery. Transaction
paths are exact, operation-owned paths, never a broad glob or consumer directory.

Reservations use `.mokly-export-reservations/locks/<output-basename>` beside
the resolved output. Native real-path resolution and unmodified filename keys
give case/symlink aliases the filesystem's own lock equivalence, without
serializing genuinely distinct destinations. The internal namespace has a
regular `.owner` containing `mokly-export-reservations-v1` plus a newline and
remains after cleanup; never put authored files or export destinations inside it.
Unowned namespaces and symlinked namespace/lock directories are rejected.
The `.mokly-export-transaction` marker records `schemaVersion: 2` and the
output basename; `stage/` and `backup/` remain inside that reservation. Old
`.mokly-export-<20-hex>.lock` siblings block new exports until explicitly
recovered. Confirm no writer is active, inspect any retained backup, and recover
it before moving an abandoned reservation aside. Nothing is silently stolen.

Do not accept the old `.mokly-preview-artifact` marker through the public
command. The repository-only adapter may explicitly migrate a valid legacy
preview at its known output path with the same backup/rollback guarantees;
malformed markers and unrelated contents still fail.
