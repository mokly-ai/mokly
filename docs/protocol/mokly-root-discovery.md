# Root Discovery And Source Membership

Status: Roots without `dir` are not available yet. The [roots from `main.*` milestone](../../plans/storybook-support.md#milestone-20-roots-from-the-stories-field-of-main) adds them.

This page complements [roots configuration](./mokly-configuration.md#roots).
It defines the filesystem boundary that Serve, `build`, `publish`, and
Changes share. Discovery walks a source tree: the working tree for Serve,
`build`, `publish`, and the head side of a comparison, and the base commit's
Git tree for the base side under the
[comparison contract](./mokly-comparison.md#sides). The same roots, globs,
and diagnostics apply to both trees. In a Git tree a symbolic link entry is
not a file and never matches. The base Git tree does not resolve symbolic links.
After [lexical normalization](./mokly-configuration.md#shape), a
root or package root that is a link in the base commit, or lies below one,
fails base validation with `config-invalid`. The message names the link. The
working tree resolves the same path to its target. Resolving links in the base
Git tree was rejected: the
[base extraction](./mokly-base-preparation.md#sources) holds regular files
only, so JavaScript below a linked root would still fail. The race rules below
concern the working tree.

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
directory inside `repoRoot`, config-relative. A root needs `dir` unless it
names a Storybook folder. A root without `dir` takes its directories from
`main.*` under the [roots from `main.*` rules](#roots-from-main). `storybook`
names the root's [Storybook folder](./mokly-storybook.md#storybook-folders).
`files` is a non-empty list of safe relative POSIX globs matched against
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

## Roots From `main.*`

The objects of `roots` are the configured roots. A configured root that names
a Storybook folder and has no `dir` takes its directories from the `stories`
field of that folder's `main.*`. Before discovery, Mokly runs that `main.*` in
Node with Storybook's loader. Mokly starts Node before discovery only for such
a root. A root with `dir`, and every catalogue without such a root, keep
configuration and discovery free of Node. Decision: Mokly runs `main.*` before discovery only
for a root that opts in. Mokly then reads every form of `stories`, and only the
projects that ask for it pay for Node and an early base install. Keeping `dir`
required, parsing `main.*` without running it, and `mokly init --storybook`
were rejected.

Each `stories` entry becomes one root of the configured root. These roots take
the place of the configured root in the declared root order, in the order of
the entries. A string entry is a glob relative to the Storybook folder. Its
directory is the part before the first segment with a glob character, and the
rest is its files glob. A string entry without a glob character reads as in
Storybook. A directory gets Storybook's default files glob, and a file splits
into its directory and its file name. An object entry gives `directory`, relative to the
folder, and `files`, which defaults to Storybook's default,
`**/*.@(mdx|stories.@(js|jsx|mjs|ts|tsx))`. Storybook's `titlePrefix` changes
no path, because paths stay derived from the file.

Mokly converts Storybook's pattern syntax to its own globs. `@(a|b)` matches
one of the alternatives, and `?(a|b)` matches nothing or one of them. A pattern
with any other extglob form, such as `*(...)`, `+(...)`, or `!(...)`, fails
discovery with the `main.*` error below. That error also names the `stories`
entry.

A root from `main.*` selects only stories files, the
`*.stories.{ts,tsx,js,jsx}` files. Other files that a `stories` entry matches,
such as `.mdx` files, stay out without a warning. Decision: such files stay out
silently, because Mokly reads no MDX. A warning was rejected, because it would
fail `--strict` for Storybook's default pattern.

The `path` and `transparent` fields of the configured root apply to each of its
roots from `main.*`. Paths derive relative to the directory of the `stories`
entry that selects the file. A configured root without `dir` that sets `files`
fails with `config-invalid` naming `roots[<index>].files`, because `files`
needs a directory.

A file that two `stories` entries of one configured root match belongs to the
first of them, without an error. A folder record that two `stories` entries of
one configured root reach also belongs to the first of them. Two entries of
one configured root can name the same directory. A file that the roots of two configured roots
match fails with the [root overlap error](#glob-validation), which names the
two configured roots. A `stories` entry whose directory does not exist matches
no file. A `stories` entry whose directory resolves outside the repository root
fails discovery with the `main.*` error below. A root from `main.*` can match
no file, but the configured root as a whole must keep at least one file, under
the [empty root rule](#traversal-and-ownership). Its message names the
Storybook folder in place of `dir`.

Discovery fails with `config-invalid` when `main.*` is missing, fails to load,
or has no `stories` array. It fails in the same way when a rule of this section
rejects a `stories` entry. The message names the `main.*` file,
repository-relative, and the reason.

On the base side, Mokly runs the base commit's own `main.*` from the
[extracted base sources](./mokly-base-preparation.md#sources). It uses the
dependencies that the
[dependency tiers](./mokly-comparison-packages.md#javascript-package-selection)
select for the base, and it runs before base discovery. So for such a root, the
base extraction and any base install run before base discovery.

In Serve, `main.*` and each local file that it imports are configuration
inputs. An edit of one of them runs discovery again, as an edit of the
configuration file does under the
[configuration change rules](./mokly-watch-runtime.md#configuration-changes).
