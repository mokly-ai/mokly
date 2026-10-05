# Navigation Disclosure Persistence

This contract owns navigation disclosure keys, storage, defaults, restoration,
and reconciliation. Tree structure, folder rows, and sibling order come from
the [folder contract](./mokly-folders.md#order). The
[runtime](./mokly-runtime.md) owns Browse interaction; the
[watch contract](./mokly-watch.md) owns the reload lifecycle.

## Delivery Status

The v4 storage format, the Specs and Components keys, early activation capture,
active-route reveal, breadcrumb folder reveal, filtered-recovery fallback, and
in-place reconciliation are implemented. A list that keeps its value under a
filter, `Collapse all` for lists under a filter, and a folder reveal that
changes nothing when it cannot show its folder are the approved contract that
the [path identity follow-up plan](../../plans/path-identity-follow-up.md)
delivers.

## Keys

Every disclosure in the current navigation has exactly one key:

| Disclosure                | Key                       |
| ------------------------- | ------------------------- |
| The Specs section         | `section:specs`           |
| The Components section    | `section:components`      |
| A folder row in a section | `folder:<section>:<path>` |
| An entry's variant list   | `variants:<path>`         |

`<section>` is `specs` or `components`. A folder that holds both kinds appears
in both sections with its own children in each, so its two rows have distinct
keys and independent state. An entry belongs to exactly one section, so its
variant list key carries none. `<path>` is the folder's or entry's path under
the [path contract](./mokly-paths.md); it may contain `_`, uppercase letters,
and digits but never `:`, so a key is parsed by its fixed prefix and the rest
is the path. A folder whose own page is a screen or component renders as that
entry's row under the [folder row rules](./mokly-folders.md#rows-and-clicks),
so its only disclosure is that entry's `variants:<path>` list, which holds the
variants and then the folder's other members.

## Storage And Defaults

Store a JSON object at the `localStorage` key `mokly:nav-disclosure:v4`, mapping
each current disclosure key to `true` (open) or `false` (closed). Earlier
storage keys are never read, translated, or removed. Save **every**
disclosure in the current navigation, not only user-toggled ones, so a removed
or renamed folder disappears from the next saved map. Do not write while
search or the Changes filter constrains the tree. A failed or unavailable
storage write does not discard the current in-memory choice.

The server default opens each present section and each top-level folder. A
deeper folder is open only if it contains the active route. A parent entry's
variant list is open when the active route is that parent, one of its
variants, or within a folder member the list holds; other variant lists are
closed. The active-route reveal opens the destination's section, folder
ancestors, and every variant list on its path on every navigation, overriding
any stored closed values for those keys. Unrelated stored values are
preserved. A breadcrumb folder reveal that can show its folder opens the
folder's section, ancestors, enclosing variant lists, and the folder itself,
and saves the result like a user toggle when no filter is active; a reveal
that cannot show it changes nothing, under the
[folder contract](./mokly-folders.md#rows-and-clicks).

`Collapse all` sets every current key to closed: both sections, every folder
row, and every `variants:` list, in every filter state. Without active
filtering it saves the map like a user toggle. Under a filter it changes only
the current map, so clearing the filter restores the pre-filter baseline.

## Restore And Reconcile

Restore by enumerating the current navigation's disclosure keys. For each key,
keep its valid stored boolean value when present; otherwise use the fallback
below. Ignore stored keys that are absent from the current navigation, without
migration; there is no list of former key forms. Ignore a stored value that
is not a JSON object as a whole; ignore invalid keys and non-boolean values
individually.

| Source of values                                                         | Fallback for a current key missing from the map |
| ------------------------------------------------------------------------ | ----------------------------------------------- |
| Browser storage                                                          | Server default                                  |
| Unfiltered watched-reload `disclosures`                                  | Server default                                  |
| Watched-reload `filterBaselineDisclosures`                               | Server default                                  |
| Watched-reload `disclosures` while search or Changes filtering is active | Open                                            |

Each user filter edit opens every disclosure, `variants:` lists included, to
reveal matches. During a filtered watched reload, a newly introduced folder or
list has not been collapsed by the user, so it must open; a key explicitly
saved as closed remains closed. Every section, folder row, and list shows its
value from the current map in every filter state, so a list closed under a
filter stays closed as a folder row does. A list also needs a visible row to
open, under the [list state rule](./mokly-variant-navigation.md#list-state).
The pre-filter baseline always uses server defaults for missing keys so
clearing the filter restores ordinary navigation state. Apply active-route
reveal after restoration, including to the baseline when it exists.

Whenever navigation changes in place without a page load, reconcile the
current disclosure map **and** any pre-filter baseline to exactly the current
keys. Retain values of surviving keys and drop keys that disappeared. Give
new keys the same fallback: open for the current map while filtering, server
default for the current map otherwise, and server default for the baseline.
Accepted comparison evidence adding or removing a Removed variant row and
its `variants:` key is one such change. In-place reconciliation preserves every
surviving value and does not re-run active-route reveal; background evidence
cannot reopen a folder or list the user collapsed.

## Recovery And Versioning

Watched-reload recovery stores `disclosures` and
`filterBaselineDisclosures` as explicit maps or `null`. A missing
`filterBaselineDisclosures` on an otherwise current snapshot means no filter
baseline. Reject a snapshot containing `closedFolderKeys`,
`closedCollectionIds`, or `filterBaselineClosedFolderKeys` in full. A non-null
baseline without active filtering is invalid. The recovery parser remains
strict for its other fields as defined by the [watch contract](./mokly-watch.md).

Any change to the persisted value shape or storage key requires a new storage
version; a disclosure key form that no longer occurs
in the current navigation is ignored on restore as above and needs none. Ignore
older versions rather than partially interpreting them.
