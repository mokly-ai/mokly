---
title: "Changes"
description: "See what moved between your branch and its base, screen by screen."
section: "catalogue"
order: 3
---

## What Changes compares

Changes compares your working tree with the branch point shared by `HEAD` and
the Git base your configuration names, which is `origin/main` unless you say
otherwise. It compares the generated documents, the local resources they
render, route-level catalogue metadata and the collection ancestry an entry
sits in.

Commits added to the base branch after you diverged do not appear as your
changes. Staged, unstaged and untracked edits in your working tree do.

## What does not count as a change

A source edit that leaves a screen's output and reviewable metadata identical
does not add the screen. Source locations and dependency declarations are
evidence rather than content, so moving files around does not fill Changes.
Regions marked with Review-ignore are classified as ignored, and a stylesheet
edit marks a screen only when a changed rule could apply to it or cannot be
resolved; rules that reach nothing on the screen are recorded as examined and
excluded.

## Compare a screen

A changed screen offers Current, Side by side, Overlay and Difference beneath
its heading, from All as well as from Changes, and starts in Current. A screen
that is known to be unchanged shows Unmodified with no comparison.

Comparison snapshots are generated when you select one of those options, not
while you browse, and they capture the selected screen and its resources
rather than rebuilding the catalogue. Changing the viewport, the scheme or the
comparison mode renews the snapshots before using them, and an expired
comparison is reacquired for you.

## Variants and views

A variant of a screen is its own row in Changes and counts on its own. When
only a variant changed, the parent screen still shows a changed mark on its
row so the group stays visible, and opening the parent from Changes takes you
to the first changed variant. A deleted variant keeps a Removed row under the
screen it belonged to, shown in Changes and hidden in All; if the screen went
too, the row joins the others at the top level. A change confined to one
viewport or scheme, such as a dark-only edit, puts a dot on the control that
would take you to it: the theme control when the change is in the other theme,
the viewport control when it is in the other viewport. Details names those
views under Changed views, and opening the screen from Changes takes you
straight to the first of them. Opening it from All, following a link with a
viewport or scheme in it, or reloading keeps the view you were on.

## Added and removed

An added entry shows its current preview and an Added status, with no
comparison controls, because there is no earlier version. A removed screen
shows a Removed status and an explicit empty current state. A removed saved
component variant keeps its earlier version, so it can still be compared.

## When the evidence is incomplete

If a referenced public file is invalid, Changes is unavailable until it is
repaired, while All stays open. A verified deletion still identifies the
screens it affects. Where history is unavailable, current previews stay
available without change evidence.
