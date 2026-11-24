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

A source edit that leaves a screen's output, rendered-resource references and
reviewable metadata identical does not add the screen or comparison evidence,
with or without registered components. A source move that keeps the entry path fixed adds no output change. A changed
entry path appears as Moved. A folder title change changes no entry.
Review-ignore can omit changes inside a marked region. Changed styles that
reach nothing on a view are examined and excluded. Evidence remains available
in the right panel even when no Changes row exists.

## How stylesheet changes are listed

The same rule applies to configured stylesheets, component declarations,
imports from another stylesheet and CSS imported by JavaScript. Mokly checks
the elements that each changed rule matches before or after the change.

Mokly first finds each component's matches on its own saved pages, across
variants, viewports and color schemes. A component then keeps only matches
outside a different nested component that has its own-page matches for the
same rule. The nested component need not be changed itself. These tests use
all own-page matches before any are removed, so their order does not matter.
A nested use of the same component never takes a match from itself. Recursive
and mutually nested components use this same test.

A component changes only if it keeps a match. Only matches that it keeps on a
saved variant's own page give that variant a component reason. A page reason
can still give that variant its own row. A match at an invocation on a consumer
screen alone never changes the invoked component.

A screen gets its own Changes row when a rule matches outside components
changed by that rule. This page test includes all nested output inside each
changed component's occurrence. It also gets a row when Mokly cannot resolve the rule,
such as a global style or a custom property change. Otherwise the screen is
under the changed components' Affected screens. Those links show usage, not
proof that every use looks different. In Serve and in a static build, each one
opens that screen's comparison in Side by side when the linked view has a base
side, also when Changes lists the screen for another reason, such as a move.
An Added consumer opens Current because its view has no base side. A saved
variant that uses the changed component has its own link. An embedded viewer
opens the screen in Current, where its Changes tab offers the same comparison
when the destination view is eligible.

For example, a configured button rule can change the button component and
leave a screen affected-only. A component's declared stylesheet can instead
change a screen heading and give that screen its own row. A rule imported by
that file follows the same test. Equal changed rules copied into generated
stylesheets are checked together across component and screen pages.

If screen-only CSS styles the inside of a button, that screen changes. The
button stays unchanged when the rule does not match its own saved pages.
On a component page, a changed renderer wrapper gives the variant its own
row. That page change alone adds no Affected screens.

For example, `.action` changes Action and leaves Toolbar, which contains it,
under Action's Affected screens. If `.toolbar .action` matches only Toolbar's
own pages, Toolbar changes and Action stays unchanged. With Icon inside Action
inside Toolbar, `.icon` changes Icon only when it matches Icon's own pages
and the other own-page matches are inside Icon.

A component can also lose a match to a nested component that is not changed.
For example, Y's own-page matches are all inside a changed Z. On the page of a
saved X variant, a match inside Y but outside Z is still taken from X by Y's
own-page matches. If X keeps no other match, X is not changed as a component.
That variant gets a page row because the match is outside Z. The change stays
visible there.

## Moved entries

Because an entry's path is its identity, moving a file to another directory
or renaming it gives the entry a new path. Changes pairs the entry at the new
path with the baseline entry it came from instead of reporting a removal and
an addition, and labels the row Moved; Inspect shows the previous path. A
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
When more than one candidate matches, nothing is paired, and `build` and
`publish` print the ambiguity in the terminal, suggesting `movedFrom`. Declare
it on the entry, or in a document's front matter, with the complete previous
path:

```tsx
// specs/account/home.mockup.tsx
import { defineScreen } from "@mokly/mokly";

export default defineScreen({
  title: "Account home",
  description: "The account landing screen.",
  relatedDocs: [],
  movedFrom: "account/overview",
  render: () => <main>Account</main>,
});
```

A `movedFrom` that names nothing in the baseline leaves the entry Added, and
`build` and `publish` report it in the terminal. Once the base branch contains
the move, the declaration names no removed entry and can be deleted; keeping
it is harmless. A moved screen with variants carries its variants with it,
pairing each by slug. A variant you delete during the move stays listed under
the screen at its new place, labelled Removed.

## Compare a screen

A changed screen or component has a Changes tab in the right panel, from All
as well as from Changes. The tab holds Change N of M with Previous change and
Next change, then Compared, which names the versions: the branch point on your
base, such as `origin/main`, and This branch. The compare modes and the
comparison details follow. The modes are Current (1), Side by side (2),
Overlay (3), Difference (4) and Swipe (5), and while the tab is selected a
mode's number key chooses it.

A screen offers all five modes when a shown view can compare. You can compare
a Changed view. An unchanged view reads Unmodified. You can compare it when
it uses a changed component named in its entry's details. A screen's
comparison then reads "Components this screen uses changed".

You can compare that view from All, even for an entry outside Changes. A
screen that only changed components affect stays out of Changes, so its tab
has no Change N of M. A flow or a page has no compare mode. Compare a flow's
steps on their screens.

A component's variant set shows a row for its own example and one for each
saved variant. Each row is its own entry. Its shown views and entry details
decide whether it can compare. The set offers the Changes tab and all five
modes when any shown row can compare, whichever entry you open. A row that
cannot compare keeps its current frames in the chosen mode. A removed
component or component variant compares its own shown frames alone.

The canvas shows the chosen mode only while the Changes tab is selected.
Inspect shows the current frames. Return to Changes to see the chosen mode
again without a new load. Current is the default mode. When you move between
entries in one variant set, you keep the chosen mode and every row's
comparison. When you open another screen or component, you return to Current.

In Serve, you get comparison snapshots on demand when you choose a mode
other than Current. Each compared row gets snapshots of its own views and
resources. When you change the shown frames, the compared frame or the mode,
Mokly renews each row's snapshots as needed before using them. Mokly reloads
an expired comparison for you. In a static build, each compared row uses the
snapshots that the build includes.

If a row's comparison fails, its frames show the error while the other rows
still compare. Choose Try again on that row to load its comparison again.

Each shown frame of a compared row compares its own view. Overlay, Difference
and Swipe show both versions inside each compared frame. Overlay shows the
current version at half opacity. Difference blends the two versions. Swipe
shows the version before on the left and the current version on the right.
Its divider stays at the same position in every compared frame. Drag any
grip to move every divider. You can also focus a grip and use the arrow keys,
Home and End.

In Side by side, the Changes tab has a chip for each shown frame of a compared
row. Choose a chip to see that frame's two versions next to each other, tagged
Before and Current. Pages and scrolling panels move
together by default. Each version keeps the size of its frame, so full-height
sections, fixed bars, and sticky headers look just as they do in Current; a
component's frame takes the larger width and height of its two versions. The
wheel, touch, scroll keys, and anchors use the panel you are working in before
moving the whole page.

Every mode other than Current adds **Scroll together** and Refresh to the
Changes tab. Refresh loads the comparison again, and Scroll together unlinks
or relinks the versions. Turning it off leaves every page and panel where it
is. In Side by side, each version then scrolls independently. Overlay,
Difference and Swipe still have one page scrollbar in each frame because their
versions share it, but their panels can move apart. Turning it on again aligns
the other version with the one you scrolled last.

Mokly pairs the same panel across versions automatically. If an edit moves the
panel or changes most of its wording, keep the same `id` on it in both versions
or give it the same `data-mokly-scroll` name. When one version's page or panel
is shorter, it stops at its own end while the other can continue; Mokly never
stretches or moves content inside the screen to hide that difference.

Links and forms inside a comparison do nothing, and a click on a frame selects
nothing while the Changes tab is selected. An anchor reveals its target in that
pane, and the other version follows while Scroll together is on. Compare a
linked screen through the catalogue, where it has its own comparison.

## Variants and views

A screen or component variant is its own row in Changes and counts on its own.
When only a variant changed, the parent still shows a changed mark on its row
so the group stays visible, and opening the parent from Changes takes you to
the first changed variant. A deleted variant keeps a Removed row under the
parent it belonged to, shown in Changes and hidden in All; if the parent went
too, the row joins the others at the top level.

A change confined to one viewport or scheme, such as a dark-only edit, shows
on that view's frame. When a toggle under Frames in Inspect hides a frame
whose view changed, that toggle carries a dot. Inspect names those views under
Changed views. On a narrow screen, where one frame shows at a time, opening
the entry from Changes takes you straight to the first of them. Opening it
from All, following a link with a viewport or scheme in it, or reloading
keeps the view you were on. The status beside the title describes the shown
frames of the entry you opened. If their statuses differ, Changed wins over
Added, then Removed, then Unmodified,
while the toggle dots and Changed views point to changes in hidden frames.

## Added and removed

An added entry shows its current frames and an Added status. If no other
shown row can compare, its Changes tab offers Current alone because the entry
has no earlier version. In this case, Compared names This branch alone.
You can choose all five modes on an added variant while another shown row in
its set can compare. Compared then names both versions, the branch point and
This branch, and the added variant's own frames show its current version.

A removed entry appears only in Changes. All shows the catalogue as it is now,
so it lists no Removed row.

A removed page, document or screen keeps its Removed status and opens the
version from the branch point instead, labelled "Showing previous version". A
screen opens as the frames of the views it had, Desktop beside Mobile and
Light above Dark, and a page or document as one reading frame. A viewport that
was never captured shows a note where its frame would stand. That version is
read only: you can scroll it, select text and follow anchors inside it, but
its links and forms do nothing, so an old link can never take you to current
content. It offers no compare mode, and Inspect keeps its record from the
branch point. While it is being retrieved the canvas says so, and if it cannot
be shown you get "Previous version unavailable" with a Retry, while the rest
of the catalogue stays usable. An entry that Changes paired as moved is never
shown as removed.

A removed component variant keeps its earlier version, so it can still be
compared.

## When the evidence is incomplete

If a referenced public file is invalid, Changes is unavailable until it is
repaired, while All stays open. A verified deletion still identifies the
screens it affects. Where history is unavailable, current previews stay
available without change evidence. Both sides render with your installed
Mokly version, so a Mokly upgrade alone lists no change.
