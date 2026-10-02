# Paths, Roots, And Identity

## Delivery Status

Approved contract. Current builds still derive routes from kind and id and
store `navPath` labels; the
[path identity plan](../../plans/path-identity.md) delivers this contract.

This is the single contract for an entry's path: how it derives from the
file that defines the entry, which strings are valid segments, how `index`
collapses onto a directory, how a path becomes a URL, and which collisions
fail the build. [Folders](./mokly-folders.md) owns titles and order,
[entry modules](./mokly-entry-modules.md) owns export collection and slugs,
[documents](./mokly-documents.md) owns Markdown entries, and
[moves](./mokly-moves.md) owns baseline pairing.

## Identity

Every entry has exactly one path. A path is one or more segments joined with
`/`, such as `account/billing/invoice`. The last segment is the entry's slug;
every earlier segment names a folder. The path is unique across the whole
catalogue, regardless of kind. It is the entry's identity in the manifest,
the public read model, the review result, links, flow steps, and comment
anchors, and it is the entry's URL under [URLs](#urls). Nothing else
identifies an entry: there is no authored id and no label list.

A variant's path is its parent's path plus the variant's slug. The parent
declares the variant, so the relationship is derived and recorded; it is never
authored as a reference. The [variant contract](./mokly-variants.md) owns
inheritance and validation.

## Roots

`roots` in the [configuration](./mokly-configuration.md#roots) lists the
directories Mokly scans. Each root has:

| Field         | Meaning                                                     | Default                              |
| ------------- | ----------------------------------------------------------- | ------------------------------------ |
| `dir`         | Config-relative directory inside `repoRoot`                 | required                             |
| `files`       | Globs relative to `dir` selecting the files to read         | `**/*.mockup.{ts,tsx}` and `**/*.md` |
| `path`        | Path prefix placed before every derived path from this root | none                                 |
| `transparent` | Directory names removed from derived paths                  | `[]`                                 |

A matched `.md` file is a document. Every other matched file is an entry
module. A root that does not exist, or whose globs match no file, fails with
`config-invalid`. Several roots merge into one catalogue; the same path from
two roots is a [duplicate path](#diagnostics). A root `path` is validated as a
path; each `transparent` name is validated as a segment.

## Derivation

An entry's path is derived in three steps and no others:

1. the root's `path` prefix, if any;
2. the directories between the root and the file, in order, with every
   directory named in `transparent` removed;
3. the leaf: a document's file name without `.md`, or an entry's slug under
   the [slug rule](./mokly-entry-modules.md#slugs).

The leaf `index` collapses: it adds no segment, so the entry's path is the
directory path and the entry is that folder's own page. A document named
`README.md` or `index.md`, compared case-insensitively, is an index document.
An entry whose slug is `index`, from its file name or its `slug` field, is an
index entry. An index at a root without a prefix would have an empty path and
is a build error; give the file a `path`.

A declared `path`, on an entry or in document front matter, replaces the
derived path completely. It is validated as a path and participates in every
collision rule. A declared path is always complete.

No other input changes a path. Mokly never compares a file name with its
directory name, never counts the entries in a file, never changes the
spelling or case of a name, and never derives a path from a title, an export
name, or a kind. The same files produce the same paths on every platform.

## Segment Grammar

A segment matches `^[A-Za-z0-9_-]+$`: ASCII letters, digits, hyphens, and
underscores, with case preserved. It contains no dot, space, or other
character, and its lowercase form is not a Windows device name (`aux`, `con`,
`nul`, `prn`, `com1`–`com9`, `lpt1`–`lpt9`). A path is one or more segments
joined with `/`, with no empty, leading, or trailing segment. Two paths whose
lowercase forms are equal name the same path for every collision rule, because
generated files share case-insensitive hosts and filesystems. Links, URLs, and
stored paths use the authored case.

A file name, slug, declared path, root prefix, or transparent name outside
this grammar fails the build under [diagnostics](#diagnostics). Mokly does not
rewrite names, so `Getting Started.md` is rejected rather than normalised, and
no segment is percent-encoded when written. `@mokly/viewer/data` exports
`isPathSegment`, `isEntryPath`, and `isWindowsDeviceName` as the shared
implementation of this grammar; the former `isEntryId` and `isCatalogueId`
helpers do not exist.

## Folders And Leaves

A path is either a folder path or a leaf path. A folder exists when at least
one entry's path lies below it; it has no independent definition and no
status. A leaf is an entry. The same path may not be both a leaf and a folder
with these exceptions, which are the only ways a path has children:

- a screen or component with variants is a leaf whose children are exactly its
  variants;
- an index entry or index document is the page of its folder, and the folder's
  other members are its siblings in that folder.

A directory and a file that derive one path, such as `billing/invoice/` and
`billing/invoice.mockup.tsx`, are a [duplicate path](#diagnostics), because the
file's children could only be variants and the directory's members could not
be. Nesting is otherwise unlimited: a directory below an index screen's folder
is an ordinary folder.

## URLs

The catalogue URL of an entry is `/view/<path>/`. Static hosts serve the shell
document written at `view/<path>/index.html` for that URL without rewrites.
Serve and the exported shell also accept `/view/<path>` and
`/view/<path>/index.html` and normalise them to the canonical form in
history. A folder's own page shares the folder's path, so `/view/<folder>/`
opens its index entry. A path that names no current or removed entry opens the
missing view and never guesses. The
[artifact path contract](./mokly-artifact-paths.md) owns every generated file
name beneath `view/`, `static/`, and comparison generations, and the
[navigation contract](./mokly-navigation.md) owns in-shell routing.

## Diagnostics

Every message below is a build failure attributed to the files it names. A
location is a repository-relative POSIX path, followed by ` export <name>` for
an entry module export and `[<index>]` for a member of an exported array.

| Code                  | Exact text                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| `invalid-segment`     | `<location>: <field> <json> is not a valid path segment; use letters, digits, hyphens and underscores` |
| `invalid-path`        | `<location>: <field> <json> is not a valid path`                                                       |
| `duplicate-path`      | `path <path> is defined twice:` then one `  <location>` line per definition                            |
| `case-collision`      | `paths <path> and <path> differ only by letter case:` then one `  <location>` line per definition      |
| `root-index`          | `<location> has no folder to be the index of; give it a path`                                          |
| `duplicate-index`     | `directory <dir> has two index documents: <name> and <name>`                                           |
| `unknown-link-target` | `<location>: link target <path> does not exist`                                                        |
| `moved-link-target`   | `<location>: link target <path> does not exist; it moved to <path>`                                    |

`<field>` is `file name`, `slug`, `path`, `movedFrom`, `root path`, or
`transparent`. `duplicate-path` lists locations in UTF-16 order. The
duplicate check runs after collapse and declared paths, so two slug-less
entries in one module, a file beside a same-named directory, and two roots
mapping onto one place all report it. `moved-link-target` is emitted instead
of `unknown-link-target` when the [move pairing](./mokly-moves.md) knows the
new path. Folder record diagnostics live in the
[folder contract](./mokly-folders.md#diagnostics); export collection
diagnostics live in the [entry module contract](./mokly-entry-modules.md).

## Verification

Coverage must prove derivation from each root field, transparent removal,
`index` collapse for documents and entries, declared-path replacement, every
grammar rejection including device names and case-only collisions, the
leaf-versus-folder rule with variants and index pages, URL normalisation of
the three accepted forms, and the exact text of every diagnostic.

## Related Docs

- [Folders](./mokly-folders.md)
- [Entry modules](./mokly-entry-modules.md)
- [Markdown documents](./mokly-documents.md)
- [Moves](./mokly-moves.md)
- [Public authoring API](./mokly-authoring.md)
- [Artifact paths](./mokly-artifact-paths.md)
- [Configuration](./mokly-configuration.md)
