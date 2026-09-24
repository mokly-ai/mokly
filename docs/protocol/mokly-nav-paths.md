# Navigation Path And Folder Contract

This is the single contract for navigation paths, folder identities, sibling
ordering, and path diagnostics. [Authoring](./mokly-authoring.md) defines the
helper inputs and authoring-time errors; the [private manifest](./mokly-component-manifest.md)
and [public catalogue](./mokly-catalogue.md) define their wire shapes. The
[runtime](./mokly-runtime.md) owns disclosure persistence and restore behavior.

## Sections And Path Derivation

Every routed screen, page, use case, and component has a `navPath` string array:
the ordered folder labels from its section root to its parent. Pages
holds screens, pages, and use cases; Components holds components. Each section
builds an independent tree from shared path prefixes. Byte-identical labels
under the same parent merge across source modules; the same path in both
sections creates two independent folders. Flat entries may omit `navPath` or
pass `undefined`, which defaults to `[]` and places the entry at the section
root. Explicit `null` or any other non-array value is not an omission.

A nested leaf derives its path as `[...(root.navPath ?? []), ...ancestor folder
titles]`; its own title is not included. Root `navPath` is the navigation
prefix above the root's direct children. Root `path`, folder `segment`s, and
leaf `slug` build routes independently; changing labels does not move routes.
The rendered navigation omits a section with no matching current or retained
removed entries; the public tree emits both required section arrays, using
`[]` when a section has no current entries. A folder with no routed descendants
is not emitted. Breadcrumbs follow `navPath`; variants additionally include
their parent screen title.

## Labels And Diagnostics

Every segment of `navPath`, including root path labels and derived folder
titles, must be a nonempty string with no `/` and no leading or trailing
ECMAScript whitespace (`/^\s|\s$/u`). Current hierarchy analysis emits one
`invalid-nav-path` violation per invalid label, attributed to the entry and
source module, with a zero-based index. The exact text is
`entry <id> navPath index <index> has invalid label <value>`: for an array
segment `<value>` is `JSON.stringify(label)` (or `String(label)` if that returns
`undefined`); for an explicit non-array path the index is `-1` and `<value>`
is `String(path)`. The invalid parent path is not reported again on its
variants. Empty authored folders are rejected before per-entry validation.

The sibling conflict key is exactly
`label.normalize("NFKC").replace(/\s/gu, "").toUpperCase().toLowerCase()`.
Two folder labels under the same parent and in the same section with an equal
key but different bytes yield `nav-path-conflict`; byte-identical spellings
merge. For each conflicting spelling, report one issue **per source module**
on that module's lowest-id entry using the spelling, independent of input
order. Every such issue names every spelling in UTF-16 code-unit order, each
JSON-quoted. The exact text is
`labels <quoted spellings> conflict <location>`, joining spellings with `and`.
The root location is `at the top of Pages` or `at the top of Components`;
below a folder it is `under Pages › A › B` (or Components).

A leaf's label is its title. If it shares a conflict key with a sibling folder
in its section, report `nav-path-conflict` **on the leaf entry**, whether the
folder or leaf was encountered first. Its exact text is
`leaf <id> label <quoted title> conflicts with folder label <quoted folder> <location>; append the folder label <quoted folder> to the leaf's navPath`.
Titles otherwise remain free text; duplicate leaf titles are allowed. No
folder-level change status exists.

## Order And Keys

The hierarchy, shell navigation, and public tree use the same total sibling
comparator: folders before leaves; then
`left.label.localeCompare(right.label, "en")`; then UTF-16 code-unit
comparison of the folder path key (folders) or entry id (leaves). Variants
stay under their parent in authored order and are never separate folder
members. This intentionally replaces v1's authored `childIds` tree order in
public read model v2.

The path key joins validated root-to-folder labels with `/` (labels cannot
contain `/`). A folder's nav group key is `folder:<path key>`; its disclosure
key is `folder:<section>:<path key>`, with `<section>` exactly `pages` or
`components`. The same path in different sections has independent disclosure
state. Labels may contain `:`, so key parsers match fixed prefixes rather
than using `split(":")`. A `folder:` key with an empty path or an empty
segment is invalid. `section:` and `variants:` keys and the handling of
obsolete keys are governed by the [runtime](./mokly-runtime.md).

## Variants And Historical Paths

A flattened variant copies its parent's `navPath`; authored `navPath` on a
variant is forbidden even when `undefined`, like `route`. Registry validation requires the paths to
match. A variant's breadcrumbs follow the parent's path followed by the
parent title; variants are not independent folder members.

Current v6 manifests use the full label and conflict rules above. At the
explicit historical-read boundary, v3, both v4 envelopes, v5, and v6
`navPath` values are checked only as arrays of non-empty strings, without current
label or conflict rules. Removed entries in the public read model follow this
historical-label rule as well. Historical v3–v5 collection records undergo their
original strict shape and relationship validation, then are dropped. Baseline
paths are used for removed-entry labels and [Changes classification](./mokly-changes.md#changes-membership), never to build a
current folder tree. A difference in `navPath`, including a renamed ancestor
folder that changes every descendant entry's path, marks each affected routed
entry changed; there is no separate moved state. Removed entries retain the
baseline entry's path, with no separate ancestor field.
