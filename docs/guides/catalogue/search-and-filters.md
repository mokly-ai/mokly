---
title: "Search and filters"
description: "Narrow the catalogue to the screens you mean."
section: "catalogue"
order: 2
---

## Search the tree

Type in the search field to narrow the navigation tree. Mokly reads the words
you type, apart from any `tag:` terms, as one phrase. It ignores letter case
and extra spaces between words. An entry stays in the tree when the phrase
appears in any of these:

- the entry's path, such as `account/billing/invoice`;
- the entry's title;
- one of the entry's tags;
- the title of a folder that holds the entry.

A folder whose title matches therefore keeps every entry below it in view.
Labels that the tree adds to a row, such as Overview or Removed, are not
searched. Search also narrows Changes, and the Changes count stays the same.

Under All, a folder hidden by its
[folder record](/docs/authoring/collections-and-tags/) stays out of the tree
and out of the search results. Changes still lists the changed entries inside
it. The [navigation reference](/docs/reference/navigation/) links to the exact
matching rule.

## Search by tag

A `tag:` term narrows the tree to the entries carrying that tag:

```text
tag:forms
```

The tag must equal one of the entry's own tags, ignoring letter case. With
several `tag:` terms, an entry needs every one of the tags, and any other words
must still match as described above.

You rarely type it: the field has a tag picker that enters the term for you,
and the tags listed in an entry's details are chips that do the same.

## All and Changes

Two filters sit above the tree. All is the whole catalogue. Changes is the
entries that changed or moved since the branch point your configuration names.

Changes is calculated in the background. Until it is ready, the filter shows a
spinner rather than a count, and selecting it shows a loading tree without
moving the tabs. When the calculation cannot complete, the filter says so
explicitly instead of showing a zero, and a completed empty result shows zero.

## What survives a reload

Editing the search or the filter reveals the matches you are looking for.
While Changes is active, moving to another entry keeps the folders you
collapsed and opens only the path to where you arrived. Clearing the search
and the filter restores the disclosures you had before, except for the path to
the entry you navigated to. A breadcrumb that opens a folder in the tree
clears a search or Changes filter only when it would hide that folder.
