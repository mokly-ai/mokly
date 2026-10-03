# Root Discovery And Ownership

This complements [roots configuration](./mokly-configuration.md#roots).
It defines the filesystem boundary shared by Build, Check, Serve and export.

## Traversal And Races

Before any walk, discovery projects the repository identity and every distinct
root identity once for the pass, and `review.outDir` once with a lexical
fallback only for that Review boundary. A non-benign repository or root
projection error fails before per-root validation. Walks run in declared root
order and validate matched files during each walk. The first denial or
empty-root failure stops the pass. Accepted and vanished candidates are each
validated once per pass. Walks skip either Review identity and directories
that vanish or are replaced (`ENOENT` or `ENOTDIR`). Other read or projection
errors fail with `config-invalid`, naming the repository-relative path and
error code (`unknown` if absent). A matched file that is deleted or replaced by
something other than a regular file between listing and validation is dropped
and listed under `not searched` when its root is then empty.

## Source Membership And Output Ownership

Every root-glob match has one root owner, even when a folder exclusion prevents
it from becoming an entry. Every resolved file is classified before bundling. Discovery fails with
`config-invalid` naming the file and the matched rule when it lies inside
`review.outDir`, inside `.mokly-cache/`, below a denied directory relative to
its root, or resolves outside `repoRoot` through a symlink. A file below
`mockupsDir` is protected authored source under the
[source-protection contract](./mokly-source-protection.md), cannot be served
or exported as a public file, and remains protected through aliases.
Generated output is collision-checked against it.

Discovery runs when the configuration is resolved, so every resolved config
carries its sorted file set beside `roots`, and again at the start of each
compilation so watched Serve observes created, renamed, or deleted files as
defined by the [watch contract](./mokly-watch.md). The set is retained beside
`sourceFiles` across build, check, watched Serve, publication, and the
component runtime; later stages consume it and never repeat the walk within
one compilation. Generated output is trusted for replacement when its recorded
repository-relative owner is a resolved file, an inventoried source, or lies
below a configured root and matches one of its `files` globs with dotfile
matching enabled. The match rule keeps output owned after a matched file is
renamed, moved, or deleted, which the [move contract](./mokly-moves.md)
depends on. An ownership header that satisfies none of the three branches is
unclaimed: committed `check` reports it, while Build, Serve, and Export leave
the file untouched. Registry attribution remains narrower and accepts only a
resolved entry module or inventoried source.

A matched barrel that re-exports another matched module's definition object
fails with the entry-module `duplicate-export` diagnostic. Narrow the globs, rename
the barrel so no glob matches it, or stop re-exporting definitions.

## Moving Defining Helpers

An exporting module and its defining helper may move together. A previous valid
v8 manifest supplies one additional ownership proof: the candidate is an exact
artifact path derived from a recorded entry, its current encoded ownership header
names that entry's `sourcePath`, and the manifest's `sourceFiles` includes the
current configuration file. The prior manifest must be a regular file in this
`mockupsDir`. This proof is checked again when the manifest changes. Missing,
malformed, earlier, or foreign manifests grant no ownership. It never grants
blanket ownership to every file naming a former source. Source denials and output
confinement still apply before replacement or orphan cleanup.

## New Source Candidates

Current serving denies files matching a configured root even before discovery
accepts them, including excluded files and invalid modules. File creation and
removal still rebuild the source inventory after root-local traversal denials;
folder exclusions only prevent entry collection. This protection grants no entry
registration and adds no file to a historical manifest's source inventory.
