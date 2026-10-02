# Markdown Documents

## Delivery Status

Approved contract. Current builds have no document kind; the
[path identity plan](../../plans/path-identity.md) delivers this contract.

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
compared case-insensitively, is the folder's index document. A directory with
both is a [duplicate index](./mokly-paths.md#diagnostics). A file name outside
the [segment grammar](./mokly-paths.md#segment-grammar) fails the build; Mokly
does not rename it. Documents have no variants and no `defineX` helper; the
file is the definition.

## Front Matter

A document may start with a front matter block: a first line of exactly
`---`, one `key: value` line per field, and a closing line of exactly `---`.
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
or `block is not closed`. The block is removed before rendering.

## Title And Description

The title is the front matter `title`, else the text of the first heading of
any level, else the file-name slug with hyphens and underscores replaced by
spaces and the first character uppercased. The description is the front
matter `description` or empty. The heading stays in the rendered body; the
shell shows the title in its heading and breadcrumbs as for every entry.

## Rendering

Mokly renders CommonMark with GitHub-style tables, strikethrough, task-list
items, and autolink literals. Raw HTML, inline or block, is rendered as literal
text. Each heading receives an `id` built GitHub-style from its text:
lowercase, spaces to hyphens, punctuation removed, and `-2`, `-3` suffixes for
repeats. Fenced code keeps its language as a class and is not highlighted.
The output is one complete HTML document per effective colour scheme with a
Mokly-owned template: `<html lang="en">`, the title in `<head>`, a
package-owned stylesheet inlined with shell-consistent typography, and no
script. The light document is `static/<path>/index.html`; when the catalogue
enables dark, `static/<path>/index.dark.html` applies the dark palette. The
shell opens the document for the current appearance exactly as it selects a
screen's scheme, and documents have no viewport axis. Documents pass the same
ownership header, final HTML validation, and transactional write as pages.

## Links And Resources

A Markdown link or image destination is resolved against the document's
repository location before the body renders:

- A relative destination that names a discovered document becomes a catalogue
  link to that document's path, with the fragment kept and validated against
  the target's heading ids. A `mock:<path>[#fragment]` destination names any
  entry, complete or relative to the document's folder, under the
  [navigation contract](./mokly-navigation.md).
- A relative destination that names a file with an extension in `png`, `jpg`,
  `jpeg`, `gif`, `svg`, `webp`, `avif`, or `pdf` is a resource. Mokly copies it
  to `static/<folder path>/<relative path>`, where the folder path is the
  document's folder and the relative path is the destination as written after
  normalisation; `../shared/a.png` from `account/billing` writes
  `static/account/shared/a.png`. The file must exist inside the same root's
  directory; a destination that escapes it fails with
  `<location>: resource <destination> is outside the root`. Resources join the
  public-file inventory and its collision rules.
- A relative destination that names any other existing repository file, such
  as a source file, renders as plain text showing the link text; Mokly never
  serves sources.
- A relative destination that names no file fails with
  `<location>: link target <destination> does not exist`.
- An absolute `http:`, `https:`, or `mailto:` destination is kept unchanged.
  A fragment-only destination is validated against the document's own heading
  ids.

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
the document references; `declaredDependencies` is empty and `relatedDocs` is
empty. The public read model emits `CatalogueDocument` with `kind:
"document"` and `colorSchemes` under the [catalogue contract](./mokly-catalogue.md).
Details show the description, tags, and source path.

## Changes

A document participates in Changes like a page: its rendered document per
scheme, its resources, and its reviewable metadata are compared with the
baseline under the [material rules](./mokly-changes.md), and a removed
document shows its [previous version](./mokly-removed-previews.md). Documents
and pages are the only kinds that the [move contract](./mokly-moves.md) pairs
by similarity. A change to a referenced resource marks the document changed.

## Navigation

A document uses the document icon in both the tree and search. Search matches
its title, path segments, and tags. The index document of a folder renders
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
