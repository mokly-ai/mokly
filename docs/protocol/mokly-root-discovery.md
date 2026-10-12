# Root Discovery And Source Membership

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
Authored input cannot be inside the generated tree, including through aliases.

Discovery runs when the configuration is resolved, so every resolved config
carries its sorted file set beside `roots`, and again at the start of each
compilation so watched Serve observes created, renamed, or deleted files as
defined by the [watch contract](./mokly-watch.md). The set is retained beside
`sourceFiles` across build, check, watched Serve, publication, and the
component runtime; later stages consume it and never repeat the walk within
one compilation. Registry attribution accepts only a resolved entry module or
an inventoried source. The generated tree contains output only and is replaced
as a whole. Accepted generations retain the immutable
[route set](./mokly-generation-routes.md); source-path headers do not grant
replacement authority or affect discovery.

A matched barrel that re-exports another matched module's definition object
fails with the entry-module `duplicate-export` diagnostic. Narrow the globs, rename
the barrel so no glob matches it, or stop re-exporting definitions.

## Moving Defining Helpers

An exporting module and its defining helper may move together. The accepted
generation derives their new output paths. Whole-tree replacement removes the
previous paths. [Move pairing](./mokly-moves.md) uses each side's valid manifest
and confined sources; it does not require an ownership header or local output.

## New Source Candidates

Current serving denies files matching a configured root even before discovery
accepts them, including excluded files and invalid modules. File creation and
removal still rebuild the source inventory after root-local traversal denials;
folder exclusions only prevent entry collection. This protection grants no entry
registration and adds no file to a historical manifest's source inventory.

## Glob Validation

Root `files` and directory-carried folder `exclude` use relative POSIX globs.
Validate both the original string and every brace-expanded alternative. Reject
non-strings, whitespace-only strings, leading `!` or `#`, absolute/drive/UNC
paths, backslashes, colons, control characters, and empty, `.` or `..` segments.
Return a frozen copy without adding public-file defaults. Root diagnostics name
`roots[<index>].files`; folder diagnostics name the owning folder record.
Folder exclusions cannot select a literal first `mokly-generated` segment.
The root reserved-output checks independently reject physical aliases and
static prefixes inside the generated tree.

When a file matches two roots after exclusions, fail `config-invalid` with
`file <path> is matched by roots[<n>] and roots[<m>]`. The path is repository-relative
and the root indices are zero-based. Physical aliases participate in this check.

## Root Fields

`roots` is a non-empty list of root objects. `dir` names an existing
directory inside `repoRoot`, config-relative, outside `.mokly-cache/`, Review
output, and package-owned private roots, and not equal to `mockupsDir`.
`files` is a non-empty list of safe relative POSIX globs matched against paths
relative to `dir` with the same minimatch syntax and path rules as
`watch.rules[].paths`; it defaults to `**/*.mockup.{ts,tsx}` and `**/*.md`.
`path` is a path under the [segment grammar](./mokly-paths.md#segment-grammar)
and prefixes every path derived from the root. `transparent` lists directory
names, each a valid segment, that derivation removes. Omitting `roots` means
`[{ dir: "specs" }]`. A missing directory, an empty or duplicate glob, two
roots with the same `dir`, or an invalid `path` or `transparent` value fails
with `config-invalid` naming `roots[<index>].<field>`.
