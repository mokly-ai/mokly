# Navigation Disclosure Persistence

This contract owns navigation disclosure storage, defaults, restoration, and
reconciliation. The [navigation path contract](./mokly-nav-paths.md#order-and-keys)
owns disclosure key formats and prefix-only parsing. The [runtime](./mokly-runtime.md)
owns Browse interaction; the [watch contract](./mokly-watch.md) owns the reload
lifecycle.

## Delivery Status

The v3 storage format, early activation capture, active-route reveal,
filtered-recovery fallback, and in-place reconciliation are implemented.

## Storage And Defaults

Store a JSON object at the `localStorage` key `mokly:nav-disclosure:v3`, mapping
each current disclosure key to `true` (open) or `false` (closed). Save **every**
disclosure in the current navigation, not only user-toggled ones, so a removed
or renamed folder disappears from the next saved map. Do not write while
search or the Changes filter constrains the tree. A failed or unavailable
storage write does not discard the current in-memory choice.

The server default opens each present section and each top-level folder. A
deeper folder is open only if it contains the active route. A screen's variant
list is open when the active route is that parent screen **or** one of its
variants; other variant lists are closed. The active-route reveal opens the
destination's section, folder ancestors, and parent variant list on every
navigation, overriding any stored closed values for those keys. Unrelated
stored values are preserved.

## Restore And Reconcile

Restore by enumerating the current navigation's disclosure keys. For each key,
keep its valid stored boolean value when present; otherwise use the fallback
below. Ignore stored keys that are absent from the current navigation, including
obsolete `collection:` (sectioned and pre-section forms) and `legacy:` keys,
without migration. Ignore a stored value that is not a JSON object as a whole;
ignore invalid keys and non-boolean values individually.

| Source of values                                                         | Fallback for a current key missing from the map |
| ------------------------------------------------------------------------ | ----------------------------------------------- |
| Browser storage                                                          | Server default                                  |
| Unfiltered watched-reload `disclosures`                                  | Server default                                  |
| Watched-reload `filterBaselineDisclosures`                               | Server default                                  |
| Watched-reload `disclosures` while search or Changes filtering is active | Open                                            |

Each user filter edit opens every disclosure to reveal matches. During a
filtered watched reload, a newly introduced folder has not been collapsed by
the user, so it must open; a key explicitly saved as closed remains closed.
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
cannot reopen a folder the user collapsed.

## Recovery And Versioning

Watched-reload recovery stores `disclosures` and
`filterBaselineDisclosures` as explicit maps or `null`. A missing
`filterBaselineDisclosures` on an otherwise current snapshot means no filter
baseline. Reject a snapshot containing `closedFolderKeys`,
`closedCollectionIds`, or `filterBaselineClosedFolderKeys` in full. A non-null
baseline without active filtering is invalid. The recovery parser remains
strict for its other fields as defined by the [watch contract](./mokly-watch.md).

Never read or migrate the v2 closed-list key `mokly:nav-disclosure:v2`; delete
it on the first v3 write. Any change to the persisted disclosure key format or
value shape requires a new storage version. Ignore older versions rather than
partially interpreting them.
