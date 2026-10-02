# Folders

## Delivery Status

Approved contract. Current builds derive folders from `navPath` labels; the
[path identity plan](../../plans/path-identity.md) delivers this contract.

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
| `hidden`  | `boolean`           | Removes the folder and its descendants from navigation and search.  |
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
use the safe relative glob grammar of `publicExclude` and match repository
files relative to the directory; a matched file is neither an entry nor a
document, though it stays an ordinary source file if a module imports it. A
`_folder.json` directly inside a root with no prefix describes the catalogue
top level and may contain only `order` and `exclude`. The file is never an
entry and never a public file.

## Titles

Mokly selects a folder's title with the first rule that applies:

1. the record's `title`;
2. the title of the folder's own page, when the folder has an index entry or
   index document under the [index rule](./mokly-paths.md#derivation);
3. the slug, with hyphens and underscores replaced by spaces and the first
   character uppercased; `account-billing` becomes `Account billing` and `API`
   stays `API`.

Titles are free text and may repeat across folders. Breadcrumbs, the tree,
search, and details use the resolved title; nothing uses a title as a key.
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
the same way; each section applies the order to the children it shows.

## Hidden Folders

`hidden: true` removes the folder, its entries, and every descendant from the
navigation tree and from search results in both sections. Their URLs, links to
them, their generated files, and their Changes rows are unaffected. A hidden
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

A breadcrumb segment for a folder opens the folder's own page when one exists
and otherwise expands that folder in the tree. The public read model emits
these shapes directly under the [catalogue contract](./mokly-catalogue.md#tree)
so the viewer applies no further rule.

## Diagnostics

Every message is a build failure attributed to its location, using the
location grammar of the [path contract](./mokly-paths.md#diagnostics).

| Code                   | Exact text                                                                |
| ---------------------- | ------------------------------------------------------------------------- |
| `duplicate-folder`     | `folder <path> is defined twice:` then one `  <location>` line per record |
| `unused-folder`        | `<location> describes folder <path>, but no entry is below it`            |
| `unknown-folder-child` | `<location>: order names <slug>, which is not a child of <path>`          |
| `invalid-folder`       | `<location>: <reason>`                                                    |

`invalid-folder` reasons are exactly: `invalid JSON: <parser message>`,
`unknown field <name>`, `title must be a nonempty string without leading or
trailing whitespace`, `order must be an array of segments with at most one
"..." and no duplicates`, `order cannot name index`, `hidden must be a boolean`,
`exclude must be an array of safe relative globs`, and `<field> is not allowed
at the top level`.

## Verification

Coverage must prove both carriers produce one record, every title rule, the
default comparator and `order` with and without `...`, hidden folders in tree
and search but not in URLs or Changes, `exclude` before derivation, each row
rule including the `Overview` label and the identical rows for the two variant
layouts, breadcrumb behaviour, and the exact text of every diagnostic.

## Related Docs

- [Paths, roots, and identity](./mokly-paths.md)
- [Entry modules](./mokly-entry-modules.md)
- [Markdown documents](./mokly-documents.md)
- [Variant navigation](./mokly-variant-navigation.md)
- [Public catalogue read model](./mokly-catalogue.md)
- [Catalogue navigation](./mokly-navigation.md)
