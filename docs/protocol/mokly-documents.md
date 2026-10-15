# Markdown Documents

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Discovery

A matched file whose name ends in `.md` is a document; `.markdown` and `.mdx`
are not recognised. The leaf is the file name up to its first `.`, so
`getting-started.md` gives `getting-started`, and `README.md` or `index.md`,
compared case-insensitively as complete file names, is the folder's index document.
`release.notes.md` gives `release`; `index.draft.md` is an ordinary `index` leaf. A directory with
both is a [duplicate index](./mokly-paths.md#diagnostics); index duplicates use
the exact directory spelling, and differently cased directories reach the
shared `case-collision` rule instead. A file name outside
the [segment grammar](./mokly-paths.md#segment-grammar) fails the build; Mokly
does not rename it. Documents have no variants and no `defineX` helper; the
file is the definition. The core parses and composes a document in Rust; no
sidecar starts for it.

## Front Matter

A document may start with a front matter block: a first line of exactly
`---`, one `key: value` line per field, and a closing line of exactly `---`.
Strip one leading U+FEFF (UTF-8 BOM) before testing that first line.
A value is a JSON string literal, a JSON array of string literals where a list
is allowed, or bare text that is trimmed. Keys and their meanings are:

| Key           | Value        | Meaning                                                          |
| ------------- | ------------ | ---------------------------------------------------------------- |
| `title`       | string       | Entry title; overrides the heading and file-name rules below     |
| `description` | string       | Entry description; defaults to the empty string                  |
| `tags`        | string array | Tags under the kebab-case tag grammar                            |
| `path`        | string       | Declared complete path, replacing the derived one                |
| `movedFrom`   | string       | Previous complete path for the [move contract](./mokly-moves.md) |

A key outside this table, a repeated key, a malformed line, or an unclosed
block fails the build with `<location>: front matter <reason>`, where the
reason is `unknown field <name>`, `repeated field <name>`, `line <n> is not
"key: value"`, `<name> must be a string`, `<name> must be an array of strings`,
or `block is not closed`. Line numbers count from the first delimiter as line 1.
Blank and indented field lines are malformed. CRLF and LF are accepted.
JSON-shaped values starting with `"`, `[` or `{` must parse as JSON and have
that field's type; other bare values, including `true` and `123`, stay strings.
Title and tag values then pass the shared nonempty-title and unique kebab-case
metadata rules. Description may be empty. The block is removed before rendering.

## Title And Description

The title is the front matter `title`, else the text of the first nonempty heading of
any level, else the file-name slug with hyphens and underscores replaced by
spaces and the first character uppercased. The description is the front
matter `description` or empty. The heading stays in the rendered body; the
shell shows the title in its heading and breadcrumbs as for every entry.

## Rendering

Mokly renders CommonMark with GitHub-style tables, strikethrough, task-list
items, and autolink literals. Raw HTML, inline or block, is rendered as literal
text. Each heading receives an `id` built GitHub-style from its text:
lowercase, spaces to hyphens, punctuation removed, and `-2`, `-3` suffixes for
repeats. Unicode letters, numbers and underscores stay. Suffix selection
skips ids already used by any earlier heading. A heading with no id characters
keeps its content and omits the id; empty headings never supply a title. Logical links accept these ids;
file-link fragments are percent-decoded once before logical validation.
An empty file-link fragment opens the document without an anchor. Fenced code keeps its language as a class and is not highlighted.
The output is one complete HTML document per effective colour scheme with a
Mokly-owned template: `<html lang="en">`, the title in `<head>`, a
package-owned stylesheet inlined with shell-consistent typography, and no
script. The stylesheet uses the shell's palette and the typography that the
document design `design/browse/pages/document` depicts: 14.5px body text on
a 720px measure, 26px and 17px headings, semibold underlined links, bordered
inline code, and full-width tables; below 600px the body is 14px and the
title 22px. Elements that the design does not show follow the same scale.
The light document's route is `static/mokly-generated/<path>/index.html`; when
the catalogue enables dark, `static/mokly-generated/<path>/index.dark.html`
applies the dark palette. Serve answers both routes from the render cache, and
`build` writes them under `--out`; nothing is written into the repository. A
document without a dark document keeps its light one under Dark. When the
catalogue has a dark axis, the shell names that fallback with the
`Light only` note: in a quiet band above a current document's pane, as the
`design/browse/appearance/states/light-only-current` design shows, and after
`Showing previous version` for a removed one, as the
`design/browse/appearance/states/light-only-document` design shows. The
shell opens the document for the current appearance exactly as it selects a
screen's scheme, and documents have no viewport axis. Documents pass the same
link rewriting and final validation as pages, then the independent element,
attribute and URL allowlist of
[Document Rendering Safety](./mokly-document-safety.md), which rejects active
markup, event and style attributes and unsupported URL schemes. The template
is script-free; a blanket script-blocking CSP meta is omitted because it also
blocks Mokly's frame instrumentation.

## Links And Resources

A Markdown link or image destination is resolved against the document's
repository location before the body renders. File links use the directory of
the source Markdown file, even when front matter declares another path or a
root removes transparent directories. Logical `mock:` links use the shared
entry base: an ordinary document uses its path's parent; an exact README/index
document uses its own path, including a declared path. Thus both rules select
siblings for an ordinary document and children for a folder README; only file
links keep repository spelling when catalogue placement differs:

- A relative destination that names a discovered document becomes a catalogue
  link to that document's path, with the fragment kept and validated against
  the target's heading ids. A `mock:<path>[#fragment]` destination names any
  entry, complete or relative to the document's folder, under the
  [navigation contract](./mokly-navigation.md).
- A relative destination that names a file with an extension in `png`, `jpg`,
  `jpeg`, `gif`, `svg`, `webp`, `avif`, or `pdf` is a resource. The file must
  exist inside the same root's directory, lexically and physically; a
  destination that escapes it fails with
  `<location>: resource <destination> is outside the root`. In-root symlink
  aliases are rejected too; a configured root alias is allowed. The resource
  joins the [public closure](./mokly-public-closure.md) with the document as
  the owner of the reference: the rendered `src` or `href` points at the
  resource's route under that policy, Serve reads its bytes from the working
  tree, `build` writes them under `--out`, and the base side of a comparison
  reads them from the base commit's blob. Nothing is copied into the
  repository, and the bytes are never decoded. Public names follow the
  closure's name policy: no dot-prefixed segment or `node_modules`, `target`,
  `dist`, `coverage`, `test-results`, `playwright-report` segment. Failure is
  `<location>: resource <destination> contains a hidden path segment` or
  `<location>: resource <destination> is inside a private build or dependency directory (<name>)`.
  The resource is a watched input for source protection, freshness and watch,
  and it enters the closure before imported CSS validation, so a nested source
  root can share an explicitly referenced asset with CSS. Unrelated public
  files keep the CSS pass's protection.
- A relative destination that names any other existing repository file, such
  as a source file or an authored HTML file, renders as plain text showing the
  link text; Mokly never serves sources through a document link. These
  source targets join the private source inventory; edits and removals
  re-render the document without importing or executing them. A target that
  the source policy classifies as a public file stays outside that inventory
  and still renders as plain text.
- A relative destination that names no file fails with
  `<location>: link target <destination> does not exist`.
  Unreadable components, overlong names and dangling symlinks use that same text;
  filesystem errors never expose absolute paths.
- An absolute `http:`, `https:`, or `mailto:` destination is kept unchanged.
  A fragment-only destination is validated against the document's own heading
  ids. A link's query is kept for resources; discovered-document links
  reject queries because logical catalogue links have no query field.

Decode CommonMark character references once in explicit link/image destinations and
titles before resolution or HTML escaping. Autolink URI text, bare ampersands and code spans stay literal.
The `mock:` prefix is case-sensitive; `MOCK:` is not a portable relative path.
Resource paths are percent-decoded once before filesystem resolution and encoded per
segment in HTML. Root-absolute paths, protocol-relative paths, backslashes,
control characters, malformed encoding and unsupported URL schemes fail with
`<location>: link target <destination> is not a portable relative path`.
Repository escapes fail with `<location>: link target <destination> is outside
the repository`. A resource that is not a plain file fails with
`<location>: resource <destination> must be a regular file without symlink
aliases`. Document queries fail with
`<location>: link target <destination> must not contain a query`.
An image destination that names a discovered document renders as a text link
using its alternative text; a non-served source renders only that text.

The rendered document then passes the shared logical-link rewriting that
screens and pages use, so served and built documents navigate the shell
identically.

## Catalogue Model And Read Model

The catalogue model records a document with `kind: "document"`, its
`colorSchemes`, and `resources`, the sorted unique list of
repository-relative resource files the document references; `relatedDocs` is
empty. The [read model](./mokly-catalogue.md) emits `CatalogueDocument` with
`kind: "document"` and `colorSchemes`, and the document's
[entry detail](./mokly-shell-delivery.md#entry-detail) has empty `views`.
Details show the description, tags, and source path. When another entry's
`relatedDocs` repository path names a current document, the index carries
`mock:<document path>` in that entry's `details.relatedDocs`. Other paths stay
display labels, and removed entries keep the base side's labels. Readers
validate the logical reference against current documents. The viewer derives
the URL: the Related docs row shows each such reference as a link to the
document's `/view/<path>/`, labelled with the document's title, and every
other value as its display label.

## Changes

A document participates in Changes like a page: its composed document per
scheme, its resources, and its reviewable metadata are compared with the base
side, rendered from the base commit's sources under the
[comparison contract](./mokly-comparison.md#sides), with the
[material rules](./mokly-changes.md), and a removed document shows its
[previous version](./mokly-removed-previews.md). Documents and pages are the
only kinds that the [move contract](./mokly-moves.md) pairs by similarity. A
change to a referenced resource marks the document changed, including a linked
attachment such as a PDF. The base side reads the document and its resources
from Git blobs, and a removed preview keeps the attachments the base document
links.

## Navigation

A document uses the document icon in both the tree and search, with the shared
[search rule](./mokly-folders.md#titles). The index document of a folder renders
under the [row rules](./mokly-folders.md#rows-and-clicks).

## Related Docs

- [Paths, roots, and identity](./mokly-paths.md)
- [Folders](./mokly-folders.md)
- [Pages in the catalogue](./mokly-pages.md)
- [Moves](./mokly-moves.md)
- [Changes and screen comparisons](./mokly-changes.md)
- [Document rendering safety](./mokly-document-safety.md)
