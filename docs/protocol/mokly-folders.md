# Folders

## Delivery Status

Folder records, title resolution, order, exclusions, path trees, the Specs
and Components rows, the `Overview` row, entry rows for a folder's own screen
or component, and breadcrumb links and folder reveals are implemented.

A folder is a path with entries below it. It has no definition of its own, no
status, and no Changes row. This contract owns the optional folder record that
gives a folder a readable title, a display order, a hidden flag, and file
exclusions, and it owns how a folder and its own page render in the navigation
tree. Path derivation lives in the [path contract](./mokly-paths.md).

## Folder Record

A folder record describes exactly one folder, keyed by its path:

| Field     | Type                | Meaning                                                             |
| --------- | ------------------- | ------------------------------------------------------------------- |
| `path`    | `string`            | The folder's path. Required in code; implied by the directory file. |
| `title`   | `string`            | Navigation title. Nonempty, no leading or trailing whitespace.      |
| `order`   | `readonly string[]` | Child slugs in display order; `...` stands for the unnamed rest.    |
| `hidden`  | `boolean`           | Hides the folder and descendants in All/search; Changes keeps them. |
| `exclude` | `readonly string[]` | Directory files only: safe relative globs of files to skip.         |

Every field except `path` is optional. Unknown fields are rejected. A record
whose folder has no entry below it is an error, because it is almost always a
typo. A folder may have at most one record from either carrier. A record
never changes a path: titles, order, and hidden state are presentation only,
and `exclude` removes files before derivation runs.

## Carriers

A record has two carriers that produce the same record.

**In code.** Any entry module may export `defineFolder`:

```ts
import { defineFolder } from "@mokly/mokly";

export const billing = defineFolder({
  path: "account/billing",
  title: "Billing & Payments",
  order: ["invoice", "..."],
});
```

`FolderInput` accepts `path`, `title`, `order`, and `hidden`; `exclude` is not
a code field. The returned `FolderDefinition` carries the shared private
definition brand and module attribution, and the
[entry module contract](./mokly-entry-modules.md) collects it like any other
definition. Use this carrier for a folder that has no directory, such as one
created only by declared paths, or when the folder's entries are authored in
code.

**In the directory.** A file named `_folder.json` inside a directory below a
root describes the folder that directory derives to, after the root prefix
and transparent directories apply:

```json
{
  "title": "Billing & Payments",
  "order": ["invoice", "..."],
  "exclude": ["drafts/**"]
}
```

The file is strict JSON with the fields above and no `path`. `exclude` globs
use the [safe relative glob grammar](./mokly-root-discovery.md#glob-validation) and match repository
files relative to the directory; a matched file is neither an entry nor a
document. A file matched by a root's `files` globs stays a protected, watched
source input even when excluded and never imported. Exclusions match whole file
paths only: `drafts/**` excludes files below `drafts`, while `drafts` does not
exclude that directory. A
`_folder.json` directly inside a root with no prefix describes the catalogue
top level and may contain only `order` and `exclude`. The file is never an
entry and never a public file.

A directory record must belong to exactly one root. A `_folder.json` found
inside two root directories fails with the same `config-invalid` overlap
message as other files, even when their entry globs are disjoint; see
[roots validation](./mokly-configuration.md#roots). No root is selected silently.
A vanished record does not discard its directory's entries. Other filesystem
failures follow [root discovery](./mokly-root-discovery.md#traversal-and-races).

## Titles

Mokly selects a folder's title with the first rule that applies:

For a folder whose own page is a screen or component, the title is always that
entry's title. Its record cannot set `title`; `order` and `hidden` remain valid.
The entry row and every breadcrumb for this folder use that same title, including
breadcrumbs for variants and ordinary descendants. For all other folders:

1. the record's `title`;
2. the title of the folder's own page, when the folder has an index entry or
   index document under the [index rule](./mokly-paths.md#derivation);
3. the slug, with hyphens and underscores replaced by spaces and the first
   character uppercased; `account-billing` becomes `Account billing` and `API`
   stays `API`. If this conversion is blank (for example `_` or `---`), use
   the unchanged slug so every valid folder has a nonempty title.

Titles are free text and may repeat across folders. Breadcrumbs, the tree,
search, and details use the resolved title; nothing uses a title as a key.
This section owns search matching for every row kind. Split the query on
whitespace. Nonempty `tag:<tag>` terms are case-insensitive exact matches to
the entry's own tags; deduplicate them. Rejoin other terms with one space.
That complete free-text phrase must be a case-insensitive substring of at least
one field: the entry path, its authored title, an entry tag, or a resolved title
of any folder at or above its path. Empty free text matches every row; every
tag term and the phrase must match. Display labels such as `Overview` and
`· Removed` never supply search text. A matching folder title therefore retains
its entries, variants and own page. A hidden folder still hides its rows in
All and search. Search composes with Changes without changing its membership.
Removed entries carry the baseline titles of their folders as display text.

## Order

Children of one folder render in this default order: nodes that render as
folder rows, then nodes that render as entry rows, each group sorted by
`title.localeCompare(other.title, "en")` with ties broken by UTF-16 path
comparison. A folder's index page, when it renders as its own row, is always
first and is never named in `order`. An entry's variants render under that
entry in authored order and are not folder children.

An `order` list places the named children first, in the listed sequence, then
the unnamed children in default order. The item `...` marks where the unnamed
children go; when it is omitted they follow the named ones. A list never hides
a child. Each name is a child's slug, listed at most once, with at most one
`...`. The top-level `_folder.json` orders the top-level folders and entries in
the same way; each section applies the order to the children it shows. A
screen or component that is its folder's own page renders as an entry row in
its own section and as a folder row in the other, so each section sorts it by
the row it shows there; the [catalogue tree](./mokly-catalogue-tree.md#order)
carries every `order` so the viewer can.

## Hidden Folders

`hidden: true` stays on the folder node in the public tree, with all its children.
A screen/component index represented as an entry node carries the same flag.
The viewer hides that node and its descendants in All and search, pruning any
ancestor left without visible children. Changes keeps hidden ancestry so changed
entries still have rows inside their folders. URLs, links, generated files and
breadcrumbs remain available. A hidden
folder is still a folder: its entries keep their paths and its records keep
applying below it.

## Rows And Clicks

The navigation tree distinguishes browsing from navigating:

- **A folder row only browses.** Clicking it expands or collapses the folder
  and never changes the content area.
- **An entry row navigates.** Clicking it opens the entry. An entry with
  variants keeps its link beside a separate disclosure button, as the
  [variant navigation contract](./mokly-variant-navigation.md) defines.

A folder's own page renders by the kind of its index:

- A **document, page, or use case** index keeps the folder as a folder row.
  The index renders as the folder's first child row, labelled with the page's
  title, or `Overview` when that title equals the folder's resolved title.
- A **screen or component** index renders the folder as that entry's row: a
  link beside a disclosure button. Its children are the entry's variants in
  authored order, then the folder's other members in [order](#order). This
  is the same row an entry with variants renders, so `invoice.mockup.tsx`
  with variants and `invoice/index.mockup.tsx` with the same variants produce
  identical rows.

A breadcrumb segment for a folder opens the folder's own page when one exists;
for a screen or component index that page is the entry, so the segment shows
and links to it. Otherwise the segment is a button that reveals the folder in
the viewed entry's section without changing the content area. The reveal opens
the section, every ancestor folder, any entry list the folder is listed in,
and the folder itself, then moves focus to the folder row and scrolls it into
the nearest visible part of the tree. It clears a search query, free text and
tag terms together, that would hide the folder and switches Changes to All
when no changed row lies inside; filters that leave the folder visible stay.
When the query and Changes hide the folder only together, it clears the query
and keeps Changes, then switches to All only if the folder is still hidden. An
application-owned viewer proposes those filters to its host and moves focus
once a committed selection shows the folder row; a commit that leaves the row
hidden ends the reveal without moving focus. Below the responsive breakpoint
it also opens the navigation drawer. Without active filtering the opened disclosures
are saved like a user toggle under the
[persistence contract](./mokly-disclosure-persistence.md#storage-and-defaults).
A hidden folder without its own page has no row in All, so its segment is
plain text, as are the baseline folder titles of a removed entry. The public
read model emits these shapes directly under the
[catalogue contract](./mokly-catalogue.md#tree) so the viewer applies no
further rule. A variant's parent crumb uses the
[branch-point lookup](./mokly-branch-point-lookup.md#variant-parents).

## Diagnostics

Every message is a build failure attributed to its location, using the
location grammar of the [path contract](./mokly-paths.md#diagnostics).

| Code                   | Exact text                                                                |
| ---------------------- | ------------------------------------------------------------------------- |
| `duplicate-folder`     | `folder <path> is defined twice:` then one `  <location>` line per record |
| `unused-folder`        | `<location> describes folder <path>, but no entry is below it`            |
| `unknown-folder-child` | `<location>: order names <slug>, which is not a child of <path>`          |
| `invalid-folder`       | `<location>: <reason>`                                                    |

`invalid-folder` reasons are exactly: `must be a JSON object`, `invalid JSON: <parser message>`,
`unknown field <name>`, `title must be a nonempty string without leading or
trailing whitespace`, `order must be an array of segments with at most one
"..." and no duplicates`, `order cannot name index`, `hidden must be a boolean`,
`exclude must be an array of safe relative globs`, and `<field> is not allowed
at the top level`, and `title cannot be set for a folder whose own page is a
screen or component; set the entry's title`.

## Verification

Coverage must prove both carriers produce one record, every title rule, the
default comparator and `order` with and without `...` in each section, search
through folder titles, hidden folders in tree and search but not in URLs or
Changes, `exclude` before derivation, each row rule including the `Overview`
label and the identical rows for the two variant layouts, breadcrumb
behaviour, and the exact text of every diagnostic.

## Related Docs

- [Paths, roots, and identity](./mokly-paths.md)
- [Entry modules](./mokly-entry-modules.md)
- [Markdown documents](./mokly-documents.md)
- [Variant navigation](./mokly-variant-navigation.md)
- [Public catalogue read model](./mokly-catalogue.md)
- [Catalogue navigation](./mokly-navigation.md)
