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
render and entry metadata, pairing each entry with the baseline entry of the
same kind at the same path.

Commits added to the base branch after you diverged do not appear as your
changes. Staged, unstaged and untracked edits in your working tree do.

## What does not count as a change

A source edit that leaves a screen's output and reviewable metadata identical
usually leaves it out of Changes. A file matched only by `review.sharedImpact`
or inside a declared dependency folder can appear in Details without adding
the screen to Changes. The entry's source file alone does not add it either;
it appears in Details when it also matches one of those file groups. A
registered component's own file or a dependency named by its exact path can
still add its entry. A source move that leaves the entry's path fixed adds no
output change; an entry whose path changes appears as Moved. Giving a folder
a new title changes no entry.
Regions marked with Review-ignore are classified as ignored, and a stylesheet
edit marks a screen only when a changed rule could apply to it or cannot be
resolved; rules that reach nothing on the screen are recorded as examined and
excluded. Evidence remains available in Details even when no Changes row exists.

## Moved entries

Because an entry's path is its identity, moving a file to another directory
or renaming it gives the entry a new path. Changes pairs the entry at the new
path with the baseline entry it came from instead of reporting a removal and
an addition, and labels the row Moved; the details show the previous path. A
pure move stays in Changes so that you can see it, without counting as an
output change, and a move with edits offers the usual comparison against the
version at the old path.

Mokly pairs a moved entry when exactly one baseline entry of the same kind
matches it: first by a `movedFrom` you declared, then by identical content,
then, for entries defined in modules, by the same source module and title, and, for pages and Markdown
documents only, by content that is at least half alike. The identical-content
pass repeats after each round of new pairs, so entries that link to each other
and move together still compare equal. A resource compares by the route it
resolves to and by its bytes, not by how its link is spelled, so an unchanged
image or stylesheet that moves with its entry adds no change. Similarity counts
only what you wrote: a Markdown document's body without its front matter, and
the text in a page's rendered body, never the shared template around them.
When more than one candidate matches, nothing is paired, and Serve and export
print the ambiguity in the terminal, suggesting `movedFrom`. Declare it on the
entry, or in a document's front matter, with the complete previous path:

```tsx
// specs/account/home.mockup.tsx
import { defineScreen } from "@mokly/mokly";

export default defineScreen({
  title: "Account home",
  description: "The account landing screen.",
  mobile: <main>Account</main>,
  desktop: <main>Account</main>,
  dependencies: [],
  relatedDocs: [],
  movedFrom: "account/overview",
});
```

A `movedFrom` that names nothing in the baseline leaves the entry Added, and
the terminal reports it. Once the base branch contains the move, the declaration names no
removed entry and can be deleted; keeping it is harmless. A moved screen with
variants carries its variants with it, pairing each by slug. A variant you
delete during the move stays listed under the screen at its new place,
labelled Removed.

## Compare a screen

A shown view with Changed status offers Current, Side by side, Overlay and
Difference beneath its heading, from All as well as from Changes, and starts in
Current. A shown view known to be unchanged reads Unmodified with no comparison.

Comparison snapshots are generated when you select one of those options, not
while you browse, and they capture the selected screen and its resources
rather than rebuilding the catalogue. Changing the viewport, the scheme or the
comparison mode renews the snapshots before using them, and an expired
comparison is reacquired for you.

Overlay and Difference show both versions inside one frame, and Side by side
shows one frame per version. Pages and scrolling panels move together by
default. Each version keeps the size of the device, so full-height sections,
fixed bars, and sticky headers look just as they do in Current. The wheel,
touch, scroll keys, and anchors use the panel you are working in before moving
the whole page.

Use **Scroll together** after the comparison modes to unlink or relink the
versions. Turning it off leaves every page and panel where it is. In Side by
side, each version then scrolls independently. Overlay and Difference still
have one page scrollbar because their versions share one frame, but their
panels can move apart. Turning it on again aligns the other version with the
one you scrolled last.

Mokly pairs the same panel across versions automatically. If an edit moves the
panel or changes most of its wording, keep the same `id` on it in both versions
or give it the same `data-mokly-scroll` name. When one version's page or panel
is shorter, it stops at its own end while the other can continue; Mokly never
stretches or moves content inside the screen to hide that difference.

Links and forms inside a comparison do nothing. An anchor reveals its target in
that pane, and the other version follows while Scroll together is on. Compare a
linked screen through the catalogue, where it has its own comparison.

## Variants and views

A screen or component variant is its own row in Changes and counts on its own.
When only a variant changed, the parent still shows a changed mark on its row
so the group stays visible, and opening the parent from Changes takes you to
the first changed variant. A deleted variant keeps a Removed row under the
parent it belonged to, shown in Changes and hidden in All; if the parent went
too, the row joins the others at the top level. A change confined to one
viewport or scheme, such as a dark-only edit, puts a dot on the control that
would take you to it: the theme control when the change is in the other theme,
the viewport control when it is in the other viewport. Details names those
views under Changed views, and opening the entry from Changes takes you
straight to the first of them. Opening it from All, following a link with a
viewport or scheme in it, or reloading keeps the view you were on.
The status and comparison options describe the view in front of you; with Both
selected, Changed wins over Added, then Removed, then Unmodified, while control
dots and Changed views point to changes elsewhere.

## Added and removed

An added entry shows its current preview and an Added status, with no
comparison controls, because there is no earlier version.

A removed page, document or screen keeps its Removed status and opens the
version from the branch point instead, labelled "Showing previous version". A
page or document opens in its document pane and a screen in its mobile and
desktop frames, with the themes it was captured in. A viewport that was never
captured says so on the stage and names the one that still opens. That version
is read only: you can scroll it, select text and follow anchors inside it, but
its links and forms do nothing, so an old link can never take you to current
content. While it is being retrieved the stage says so, and if it cannot be
shown you get "Previous version unavailable" with a Retry, while the rest of
the catalogue stays usable. An entry that Changes paired as moved is never
shown as removed.

A removed component variant keeps its earlier version, so it can still be
compared.

## When the evidence is incomplete

If a referenced public file is invalid, Changes is unavailable until it is
repaired, while All stays open. A verified deletion still identifies the
screens it affects. Where history is unavailable, current previews stay
available without change evidence. A comparison base built by an earlier
Mokly release makes Changes unavailable until the base includes this version.
