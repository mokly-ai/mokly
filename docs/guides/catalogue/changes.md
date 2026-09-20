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

## Added and removed

An added entry shows its current preview and an Added status, with no
comparison controls, because there is no earlier version.

A removed page or screen keeps its Removed status and opens the version from
the branch point instead, labelled "Showing previous version". A page opens in
its document pane and a screen in its mobile and desktop frames, with the
themes it was captured in. That version is read only: you can scroll it, select
text and follow anchors inside it, but its links and forms do nothing, so an
old link can never take you to current content. While it is being retrieved the
stage says so, and if it cannot be shown you get "Previous version unavailable"
with a Retry, while the rest of the catalogue stays usable.

A removed saved component variant keeps its earlier version, so it can still be
compared.

## When the evidence is incomplete

If a referenced public file is invalid, Changes is unavailable until it is
repaired, while All stays open. A verified deletion still identifies the
screens it affects. Where history is unavailable, current previews stay
available without change evidence.
