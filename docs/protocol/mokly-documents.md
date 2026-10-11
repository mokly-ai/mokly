# Markdown Documents

## Delivery Status

Build, Check, Serve and export render documents. The shell presents them in
the page view with their rows, breadcrumbs, path chip, Details, Related docs
links, and `Light only` note. A moved document keeps one `Moved` row and names
its previous path in Details.

A document is a Markdown file that a [root](./mokly-paths.md#roots) matches.
It becomes an entry of kind `document` with a path derived like every other
entry, so a `specs/` directory that mixes written specs and rendered mockups is
the catalogue. Mokly owns the rendering. This contract owns discovery, front
matter, titles, rendering, links and resources, generated output, and Changes
for documents.

## Discovery

A matched file whose name ends in `.md` is a document; `.markdown` and `.mdx`
are not recognised. The leaf is the file name up to its first `.`, so
`getting-started.md` gives `getting-started`, and `README.md` or `index.md`,
compared case-insensitively as complete file names, is the folder's index document.
`release.notes.md` gives `release`; `index.draft.md` is an ordinary `index` leaf. A directory with
both is a [duplicate index](./mokly-paths.md#diagnostics). A file name outside
the [segment grammar](./mokly-paths.md#segment-grammar) fails the build; Mokly
does not rename it. Documents have no variants and no `defineX` helper; the
file is the definition.
Index duplicates use the exact directory spelling; differently cased directories
reach the shared `case-collision` rule instead.

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
| `tags`        | string array | Tags under the existing kebab-case tag grammar                   |
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
repeats. Unicode letters, numbers and underscores remain. Suffix selection
skips ids already used by any earlier heading. A heading with no id characters
retains its content and omits the id; empty headings never supply a title. Logical links accept these ids;
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
The light document is `static/mokly-generated/<path>/index.html`; when the catalogue
enables dark, `static/mokly-generated/<path>/index.dark.html` applies the dark palette. A
document without a dark document keeps its light one under Dark. When the
catalogue has a dark axis, the shell names that fallback with the existing
`Light only` note: in a quiet band above a current document's pane, as the
`design/browse/appearance/states/light-only-current` design shows, and after
`Showing previous version` for a removed one, as the
`design/browse/appearance/states/light-only-document` design shows. The
shell opens the document for the current appearance exactly as it selects a
screen's scheme, and documents have no viewport axis. Documents pass the same
plain generated notice, final HTML validation and whole-tree write as pages.
Final documents also pass the independent parse5 element, attribute and URL
allowlist in [Document Rendering Safety](./mokly-document-safety.md), after logical-link rewriting. It rejects active markup, event/style attributes and
unsupported URL schemes. The template remains script-free; a blanket script-blocking
CSP meta is omitted because it also blocks Mokly's frame instrumentation.

## Links And Resources

A Markdown link or image destination is resolved against the document's
repository location before the body renders. File links use the directory of
the source Markdown file, even when front matter declares another path or a
root removes transparent directories. Logical `mock:` links use the shared
entry base: an ordinary document uses its path's parent; an exact README/index
document uses its own path, including a declared path. Thus both rules select
siblings for an ordinary document and children for a folder README; only file
links retain repository spelling when catalogue placement differs:

- A relative destination that names a discovered document becomes a catalogue
  link to that document's path, with the fragment kept and validated against
  the target's heading ids. A `mock:<path>[#fragment]` destination names any
  entry, complete or relative to the document's folder, under the
  [navigation contract](./mokly-navigation.md).
- A relative destination that names a file with an extension in `png`, `jpg`,
  `jpeg`, `gif`, `svg`, `webp`, `avif`, or `pdf` is a resource. Mokly copies it
  to `static/mokly-generated/<folder path>/<relative path>`, where the folder path is the
  document's logical-link base folder and the relative path is the destination as written after
  normalisation; `../shared/a.png` from a folder README at `account/billing` writes
  `static/mokly-generated/account/shared/a.png`. The file must exist inside the same root's
  directory; a destination that escapes it fails with
  `<location>: resource <destination> is outside the root`. Resources join the
  public-file inventory and its collision rules. Both lexical and physical paths
  must stay in the root. In-root symlink aliases are rejected too; a configured
  root alias is allowed. Resources may not escape the output or enter
  `mokly-generated/`. Their original bytes are retained, without decoding.
  Output names use export's shared public-name policy: no dot-prefixed segment or
  `node_modules`, `target`, `dist`, `coverage`, `test-results`, `playwright-report`
  segment. Failure is `<location>: resource <destination> contains a hidden path segment`
  or `<location>: resource <destination> is inside a private build or dependency directory (<name>)`.
  Inputs join `sourceFiles` for source protection, freshness and watch. They
  enter the graph before imported CSS validation, so a nested source root can
  share an explicitly referenced asset with CSS. Unrelated public files keep
  the CSS pass's existing protection. Exact
  resource routes derive from the document source, path and `resources`. Copies
  join the accepted generated inventory with exact byte hashes. Whole-tree
  replacement installs the copies and removes obsolete generated files; authored
  files outside `mokly-generated/` remain untouched.
- Classify existing targets under `mockupsDir`, including physical aliases,
  before collecting inputs. A target proven to be Mokly-owned output or internal
  metadata fails with `<location>: link target <destination> targets Mokly-owned output or metadata`.
  A file eligible for the shared public-resource policy stays public and renders
  only the link text or image alt text. It never joins `sourceFiles` or gets copied.
- A relative destination that names any other existing repository file, such
  as a source file, renders as plain text showing the link text; Mokly never
  serves sources. These referenced files join the private source inventory,
  including when they sit below `mockupsDir`; edits and removals rebuild the
  document without importing or executing those files.
- A relative destination that names no file fails with
  `<location>: link target <destination> does not exist`.
  Unreadable components, overlong names and dangling symlinks use that same text;
  filesystem errors never expose absolute paths.
- An absolute `http:`, `https:`, or `mailto:` destination is kept unchanged.
  A fragment-only destination is validated against the document's own heading
  ids. A link's query is retained for resources; discovered-document links
  reject queries because logical catalogue links have no query field.

Decode CommonMark character references once in explicit link/image destinations and
titles before resolution or HTML escaping. Autolink URI text, bare ampersands and code spans remain literal.
The `mock:` prefix is case-sensitive; `MOCK:` is not a portable relative path.
Resource paths are percent-decoded once before filesystem resolution and encoded per
segment in HTML. Root-absolute paths, protocol-relative paths, backslashes,
control characters, malformed encoding and unsupported URL schemes fail with
`<location>: link target <destination> is not a portable relative path`.
Repository escapes fail with `<location>: link target <destination> is outside
the repository`. Other resource errors use `resource <destination> is outside
the output`, `resource <destination> must be a regular file without symlink
aliases`, or `resource <destination> collides with another generated resource
at <route>`, each prefixed with `<location>: `. Document queries fail with
`<location>: link target <destination> must not contain a query`.
An image destination that names a discovered document renders as a text link
using its alternative text; a non-served source renders only that text.

The rendered document then passes the shared logical-link rewriting that
screens and pages use, so served and exported documents navigate the shell
identically.

## Manifest And Read Model

The manifest records a document as:

```ts
interface ManifestDocument extends ManifestEntryBase {
  kind: "document";
  colorSchemes: readonly ColorScheme[];
  resources: readonly string[];
}
```

`resources` is the sorted unique list of repository-relative resource files
the document references; `relatedDocs` is empty. The public read model emits `CatalogueDocument` with `kind:
"document"` and `colorSchemes` under the [catalogue contract](./mokly-catalogue.md).
Details show the description, tags, and source path. When another entry's
`relatedDocs` repository path names a current document, projection emits
`mock:<document path>` in `details.relatedDocs`. Other paths stay display labels;
removed entries retain baseline repository labels. Public readers validate the
logical reference against current documents. The viewer derives its URL: the
Related docs row shows each such reference as a link to the document's
`/view/<path>/`, labelled with the document's title, and every other value as
its display label. Serve and export read the manifest instead, so their row
links each repository path that names a current document's source in the same
way, and a removed entry's row keeps every value as a label.

## Changes

A document participates in Changes like a page: its rendered document per
scheme, its resources, and its reviewable metadata are compared with the
baseline under the [material rules](./mokly-changes.md), and a removed
document shows its [previous version](./mokly-removed-previews.md). Documents
and pages are the only kinds that the [move contract](./mokly-moves.md) pairs
by similarity. A change to a referenced resource marks the document changed. This includes
linked attachments such as PDFs. Changes follows declared attachment links
that remain in the normalized document, so paired ignored regions still apply.
Removed previews retain attachments linked from the original historical HTML.

## Navigation

A document uses the document icon in both the tree and search, with the shared
[search rule](./mokly-folders.md#titles). The index document of a folder renders
under the [row rules](./mokly-folders.md#rows-and-clicks).

## Verification

Coverage must prove discovery and index detection, every front matter
acceptance and failure, the title fallback chain, rendering of each supported
construct with raw HTML as text, heading ids, light and dark output, every
link and resource rule including root escape and missing targets, manifest and
read model emission, Changes classification, and removed previews.

## Related Docs

- [Paths, roots, and identity](./mokly-paths.md)
- [Folders](./mokly-folders.md)
- [Pages in the catalogue](./mokly-pages.md)
- [Moves](./mokly-moves.md)
- [Changes and screen comparisons](./mokly-changes.md)
