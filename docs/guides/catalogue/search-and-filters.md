---
title: "Search and filters"
description: "Narrow the catalogue to the screens you mean."
section: "catalogue"
order: 2
---

## Search the tree

The search field narrows the navigation tree as you type. It matches an
entry's id, its title and its route, so any of the three finds a screen.

## Search by tag

A `tag:` term narrows the tree to the entries carrying that tag:

```text
tag:forms
```

You rarely type it: the field has a tag picker that enters the term for you,
and the tags listed in a screen's details are chips that do the same.

## All and Changes

Two filters sit above the tree. All is the whole catalogue. Changes is the
entries that differ from the branch point your configuration names.

Changes is calculated in the background. Until it is ready, the filter shows a
spinner rather than a count, and selecting it shows a loading tree without
moving the tabs. When the calculation cannot complete, the filter says so
explicitly instead of showing a zero, and a completed empty result shows zero.

## What survives a reload

Editing the search or the filter reveals the matches you are looking for.
While Changes is active, moving to another screen keeps the folders you
collapsed and opens only the path to where you arrived. Clearing the search
and the filter restores the disclosures you had before, except for the path to
the screen you navigated to.
