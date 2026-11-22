# Design Mockup Scheme, Comparison, And Tag Links

This page is part of the [design mockup links
contract](./mokly-design-links.md). That page owns the scope, the link
behavior, and the canonical destinations of every design link.
This page lists the destinations of the scheme, comparison, stylesheet evidence,
and tag states.

## Scheme, Comparison, And Tag States

Standalone Browse owns one Appearance selector in the top bar, and no design
screen depicts a second scheme control. The Canvas screens and the appearance
entries render in Light and in Dark instead. The outer viewer shows both
rendered views of such an entry as the [design mockup links
contract](./mokly-design-links.md#scope-and-ownership) says. A link out of a
dark fragment resolves to the target's dark fragment wherever one exists, and
every Canvas screen publishes both schemes, so no compare mode, tab or stepper
strands a reader in a light document.

The compare modes of a Changes tab open the artboard of the same entry in
each mode that an artboard shows, and a mode without one is a depiction.
Welcome's modes open `design/canvas/changes/current`,
`design/canvas/changes/side-by-side`, `design/canvas/changes/overlay`,
`design/canvas/changes/difference` and `design/canvas/changes/swipe`. The
Action's Default variant opens `design/canvas/components/compare/current`,
`design/canvas/components/compare/side-by-side`,
`design/canvas/components/compare` for Overlay, and
`design/canvas/components/compare/difference`. In Side by side, the chip of the
compared frame opens its own artboard, and the other chips are depictions.
The Inspect tab of a Changes artboard opens the same entry on Inspect:
Welcome's opens `design/canvas/overview`, and the Default variant's in Overlay
opens `design/canvas/components/compare/props`, where Props stays read-only
and Switch to Current opens `design/canvas/components/usage`. The stepper's
Previous change and Next change open the Changes artboard of the neighbouring
change in the order of the Changes filter, and a change without one is a
depiction.

Added Details shows its current version with Current alone. Removed Farewell,
Survey, Invite, Archive, and Timeline show their previous version, its loading
wait, its unavailable state with Retry, or the note naming the viewport that
still opens, without comparison modes and with no live product destination;
links inside a previous version do nothing. The ignored-only Welcome, in All,
and the empty Changes filter show the current version without compare modes.
The ignored-only Welcome keeps its evidence in Inspect, and the All filter of
the empty Changes filter opens `design/canvas/overview`.

Each comparison evidence design depicts a branch of its own. On the branch
whose changed stylesheet applies to Welcome, Matched styles and Excluded
styles open each other through the catalogue's filter, and each shows its own
compare mode: Matched in Side by side and Excluded in Current. Unresolved,
Unnamed, Excluded content only and Component with excluded styles open from
the catalogue tree. The changed page's two tabs open each other. Every other
row, tab and mode of these branches is a depiction.

| Control/context                     | Destination                                               |
| ----------------------------------- | --------------------------------------------------------- |
| Matched styles: All filter          | Excluded styles, `design/canvas/evidence/styles/excluded` |
| Excluded styles: Changes filter     | Matched styles, `design/canvas/evidence/styles`           |
| Excluded styles: Details row        | Evidence in Inspect, `design/canvas/evidence/unchanged`   |
| Changed page: Inspect tab           | The page's Inspect, `design/canvas/evidence/page/inspect` |
| Changed page's Inspect: Changes tab | The changed page, `design/canvas/evidence/page`           |

Matched, Unresolved and Unnamed show only their changed screen in Changes. The
linked Excluded and Matched states show the same comparison details, with both
the matched and the excluded evidence, as the
[shell contract](./mokly-css-evidence-shell.md) defines. Mode destinations
without an owning mockup remain depictions, and these states add no tag
transitions. The Action branch of the [component
designs](./mokly-component-design.md#component-pages) is a branch of its own.
The Affected screens of `design/canvas/components/usage` open Welcome,
`design/canvas/components/affected`, and Details,
`design/canvas/components/affected/details`, in Side by side. Their comparison
details link the changed Action to `design/canvas/components/compare/current`,
as the comparison details of `design/canvas/components/affected/direct` do.

Tag interactions are restricted to Welcome's search states:
`design/canvas/overview`, which enters no tag, and `design/canvas/search/tags`
with its saved variants.

| Action                               | Destination                                                                                                                   |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Open picker with no query            | `design/canvas/search/tags`                                                                                                   |
| Open picker with forms selected      | `design/canvas/search/tags/forms-picker`                                                                                      |
| Open picker with onboarding selected | `design/canvas/search/tags/onboarding-picker`                                                                                 |
| Close picker                         | Matching closed state: `design/canvas/overview`, `design/canvas/search/tags/forms`, or `design/canvas/search/tags/onboarding` |
| Select an inactive forms chip        | `design/canvas/search/tags/forms`                                                                                             |
| Select an inactive onboarding chip   | `design/canvas/search/tags/onboarding`                                                                                        |
| Select the active chip again         | `design/canvas/overview` with its empty query                                                                                 |

The query, chips, filtered rows, and picker visibility must agree. Selection
closes the picker; opening it must not invent a query. Use the same mapping for
Inspect's Tags chips in Welcome's search states, and for the picker button and
chips of `design/browse/views/screen/tag-picker`. A filtered state keeps its
query: its Fit opens the same filter with the picker closed, and its Changes
filter, Changes tab and Zoom in are depictions, because no artboard shows the
query with them. Other subjects, other branches, and comparison states keep
non-link tag depictions. Search typing stays a depicted input, not a form that
submits or a link that pretends to implement search.

## Related Docs

- [Design mockup links](./mokly-design-links.md)
- [Design mockup navigation links](./mokly-design-links-navigation.md)
