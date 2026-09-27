# CSS Evidence In The Shell

## Delivery Status

Implemented for stylesheet evidence. This document owns how the inspector and
the comparison stage present the evidence defined by
[CSS change attribution](./mokly-css-attribution.md) and
[inline style ownership](./mokly-inline-styles.md); those contracts own the
analysis, membership rules, evidence schemas, and validation. The inline
style presentation is the approved target of the
[inferred inline style ownership plan](../../plans/inferred-inline-style-ownership.md)
and lands with its shell milestone.

## Shell Presentation

The inspector shows kept selectors under a dependency reason and lists
excluded resources in a secondary details section. Headline copy is product
language, for example "This stylesheet changed, but none of the changed styles
apply to this screen"; selector text appears only in the details list. Excluded
resources never produce Changes rows.

The approved design is the stylesheet-evidence group of the design catalogue,
recorded in the
[shell design inventory](./mokly-shell-design.md#design-mockups) as
`design-review-style-matched`, `design-review-style-unresolved`,
`design-review-style-unnamed`, `design-review-style-excluded`, and
`design-review-style-page-excluded`.
It fixes these presentation rules:

- A `matched` or `unresolved` reason reads as one outcome in the comparison
  stage heading, "Styles this screen uses changed". That heading is rendered
  only inside a loaded comparison; the plain current preview has no stage
  heading. The two statuses differ only in the secondary details: `matched`
  lists the changed styles that apply to the screen, while `unresolved` says
  the change can apply anywhere on the screen. With serialized selectors the
  unresolved sentence ends with a colon and a list; without them it ends with
  a full stop and no list.
- An excluded resource leads with the outcome, "This stylesheet changed, but
  none of the changed styles apply to this screen", and lists the stylesheet
  under an "Examined and excluded" heading. An excluded-only screen is not in
  Changes, offers no comparison, and shows no stage heading; its evidence panel
  ends with the terminal status line "No changes to this screen." A saved
  variant's terminal line reads "No changes to this saved view." The wording
  follows the entry kind through one shared helper.
- The evidence container and the approved mockup card both render eight
  pixels above each paragraph or list and fourteen pixels between a list and
  the paragraph that follows it. The mockup card must render that spacing as
  authored, whatever other inspector stylesheets the design page loads. The
  shell keeps its separator treatment rather than the mockup's bordered card.
- No design screen without a comparison toolbar renders a comparison stage
  heading. A screen depicted in Current mode, whether unchanged, excluded-only,
  or ignored-only, shows the plain preview with no heading.
- Inline style evidence joins the same presentation. `matched` and
  `unresolved` inline selectors are unioned into the existing outcome lists,
  so one screen still shows at most one matched list and one unresolved list.
  A view whose inline evidence is `excluded` leads with "Styles on this page
  changed, but none of the changed styles apply to this screen." followed
  directly by the entry's terminal no-changes line; it lists nothing under
  "Examined and excluded", is not in Changes, offers no comparison, and shows
  no stage heading. The approved design is
  `design-review-style-page-excluded`.
- The note "Shared component changes affect this preview. This page has no
  independent entry in Changes." appears only when a changed component
  affects the entry, never for a view whose only evidence is excluded inline
  styles.
- Selector text, status names, and analysis vocabulary never appear in a
  heading or in the catalogue tree; they appear only inside the secondary
  details list, and only where the detail has review value.

### Shell Derivation

The live classification snapshot retains screen-only `screenEvidence` records
with a route and per-view `viewport`, `colorScheme`, optional `reasons`,
optional `excludedResources`, and optional `inlineStyles`. Paths remain
repository-relative. The workspace
projects the selected screen's views as optional `resourceEvidence`; it does not
invent v3 entry reasons, component results, or comparison states. Static exports
project this same slice from the existing v2 comparison. Schema versions remain
unchanged, and absent evidence remains valid. New classification generations
replace the slice, clearing stale evidence while Changes is pending/unavailable.

One inspector renderer merges classification evidence with the loaded selected
comparison. Dependency reasons merge by path with sorted selector unions and
unresolved precedence; inline selectors merge into the same outcome groups.
Retained paths suppress exclusions across all selected views; loaded v2
shared-impact and ignored-content details remain available.
Loaded evidence is selection-scoped and cleared on classification invalidation.
Component ownership facts continue to come from entry reasons and the complete
classification; a v2 resource change never implies a changed shared component.

`ReviewState` has no resource-only variant, so the browser derives the style
heading from the view's own evidence. A view reads "Styles this screen uses
changed" when its state is `changed`, `material` is absent, it retains at
least one reason, and every retained reason is a stylesheet dependency carrying
an `analysis` record; a saved variant reads "Styles this variant uses changed".
Any other retained reason, such as a changed font or image, or a present
`material` flag, keeps the existing "Screen changed" label. Historical results
never emit `analysis`-bearing reasons, so their absent `material` flag cannot
select the style label.

The Details inspector lists the entry's retained dependency paths under
"Changes to these files may affect this screen:", then groups analysed
selectors by outcome, so one screen shows at most one matched list and one
unresolved list however many stylesheets changed. Selectors are unioned,
deduplicated, and sorted; an `unresolved` outcome with no serialized selector
renders its sentence with a full stop and no list. Excluded stylesheets come from the
compared views of the selected entry or saved variant, unioned and sorted, and
never include a path any of those views retains. Their lead sentence
pluralizes when it lists more than one stylesheet. Viewport and color-scheme
controls never change this evidence, and the mobile inspector sheet and the
desktop inspector dock render it identically.
