---
title: "Search and filters"
description: "Narrow the catalogue to the screens you mean."
section: "catalogue"
order: 2
---

## Search the tree

Type in the search field to narrow the navigation tree. An entry matches when
the text you type appears, ignoring letter case, in its path, its title, one of
its tags, or the title of a folder that contains it. A folder hidden by its
folder record stays out of the results. The
[navigation reference](/docs/reference/navigation/) links to the complete rule.

## Search by tag

A `tag:` term narrows the tree to the entries carrying that tag:

```text
tag:forms
```

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
