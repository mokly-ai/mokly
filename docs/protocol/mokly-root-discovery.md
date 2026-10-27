# Root Discovery And Source Membership

This page complements [roots configuration](./mokly-configuration.md#roots).
It defines the filesystem boundary that Serve, `build`, `publish`, and
Changes share. Discovery walks a source tree: the working tree for Serve,
`build`, `publish`, and the head side of a comparison, and the base commit's
Git tree for the base side under the
[comparison contract](./mokly-comparison.md#sides). The same roots, globs,
and diagnostics apply to both trees. In a Git tree a symbolic link entry is
not a file and never matches; the race rules below concern the working tree.

## Traversal And Races

A repository or root identity error that is not benign fails before any
per-root validation. Walks run in declared root order and validate matched
files during each walk. The first denial or empty-root failure stops the pass.
Walks skip directories that vanish or are replaced
(`ENOENT` or `ENOTDIR`). Other read or projection errors fail with
`config-invalid`, naming the repository-relative path and error code
(`unknown` if absent). A matched file that is deleted or replaced by
something other than a regular file between listing and validation is
dropped and listed under `not searched` when its root is then empty.

## Traversal And Ownership

Discovery walks each root without following symlinks and keeps every regular
file that matches a `files` glob. Below the root, walks skip directories named
`.git`, `node_modules`, `dist`, `coverage`, `target`, `test-results`,
`playwright-report`, or `.context`, and the output directory that `--out`
names; an explicit root inside such a directory is still scanned, because the
rule applies below the root only. Regular file basenames are not denied.
`_folder.json` files are read as [folder records](./mokly-folders.md) and
never as entries, and a folder record's `exclude` globs remove matched files
from that directory before derivation.

A matched file's suffix gives its kind. A file ending in `.md` is a
[document](./mokly-documents.md). A file ending in `.screen.html`,
`.component.html`, `.page.html`, or `.use-case.yaml` is an HTML or YAML entry
of the [HTML screens contract](./mokly-html-screens.md), parsed without
JavaScript. A
file ending in `.stories.ts`, `.stories.tsx`, `.stories.js`, or `.stories.jsx`
is a Storybook stories file. Every other matched file is an entry module under
the [entry module contract](./mokly-entry-modules.md). The glob alone defines
the shape, so `files: ["**/*.ts"]` evaluates every matched TypeScript file as
a module. Entry modules and stories files are bundled and described by the
[sidecar](./mokly-sidecar.md); HTML, YAML, and Markdown files never are.

Every `_folder.json` inside a walked root is also owned by exactly one root,
independently of `files`. Overlapping roots that encounter that record fail
with the [root overlap error](#glob-validation) of a matched file.

Every root must keep at least one file; otherwise `root matches no file: <dir>`
lists denied and vanished paths, including dropped files, sorted under
`; not searched: <repository-relative paths>`. The union across roots is
sorted by repository-relative path. Discovery records that ownership, so a
file derives from the root that selected it rather than from the deepest
directory that happens to contain it.

## Source Membership

Every root-glob match has one root owner, even when a folder exclusion
prevents it from becoming an entry. Every matched file is classified before
any JavaScript file reaches the [sidecar](./mokly-sidecar.md) for bundling.
Discovery fails with `config-invalid` naming the file and the matched rule
when the file lies below a denied directory relative to its root or resolves
outside `repoRoot` through a symbolic link. A matched file is protected
authored source under the
[source-protection contract](./mokly-source-protection.md): it is never
served or written as a public file, and it stays protected through aliases.

Discovery runs when the configuration is resolved and again at the start of
each rebuild, so watched Serve observes created, renamed, or deleted files
under the [watch contract](./mokly-watch.md). Every stage of one render pass
uses the same sorted file set. The
catalogue model attributes a definition only to a resolved entry module or
an inventoried source.

A matched barrel that re-exports another matched module's definition fails
with the entry-module `duplicate-export` diagnostic. Narrow the globs, rename
the barrel so no glob matches it, or stop re-exporting definitions.

An exporting module and its defining helper may move together. The entry's
path follows the exporting module under the
[entry module contract](./mokly-entry-modules.md), and
[move pairing](./mokly-moves.md) reads each side's catalogue model from its
source tree; it needs no marker in the sources.

## New Source Candidates

Serve denies a file that matches a configured root before discovery accepts
it, including excluded files and invalid modules. File creation and removal
rebuild the source inventory after root-local traversal denials; folder
exclusions only prevent entry collection. This protection grants no entry
registration and adds no file to the base side's inventory, which comes from
the base commit's tree alone.

## Glob Validation

Root `files` and directory-carried folder `exclude` use relative POSIX globs.
Validate both the original string and every brace-expanded alternative.
Reject non-strings, whitespace-only strings, leading `!` or `#`,
absolute/drive/UNC paths, backslashes, colons, control characters, and
empty, `.` or `..` segments. Validation adds no public-file defaults. Root
diagnostics name `roots[<index>].files`; folder diagnostics name the owning
folder record.

When a file matches two roots before exclusions, fail `config-invalid` with
`file <path> is matched by roots[<n>] and roots[<m>]`. The path is
repository-relative and the root indices are zero-based. Physical aliases
participate in this check.

## Root Fields

`roots` is a non-empty list of root objects. `dir` names an existing
directory inside `repoRoot`, config-relative. `files` is a non-empty list of safe relative POSIX globs matched against
paths relative to `dir` with the same glob syntax and path rules as
`watch.rules[].paths`; it defaults to `**/*.mockup.{ts,tsx}`,
`**/*.stories.{ts,tsx,js,jsx}`, `**/*.screen.html`, `**/*.component.html`,
`**/*.page.html`, `**/*.use-case.yaml`, and `**/*.md`: entry modules,
stories files, the kinds of the
[HTML screens contract](./mokly-html-screens.md#file-kinds-without-javascript),
and Markdown documents. `path` is a path under the
[segment grammar](./mokly-paths.md#segment-grammar) and prefixes every path
derived from the root. `transparent` lists directory names, each a valid
segment, that derivation removes. Omitting `roots` means `[{ dir: "specs" }]`.
A missing directory, an empty or duplicate glob, two roots with the same
`dir`, or an invalid `path` or `transparent` value fails with
`config-invalid` naming `roots[<index>].<field>`.
