# CSS Evidence In The Shell

## Delivery Status

Implemented for linked stylesheet and inline style evidence. This document owns
compact visual rules; [CSS evidence presentation](./mokly-css-evidence-presentation.md)
owns projection and exact copy. [Inline evidence](./mokly-inline-style-evidence.md)
owns its shape; [review validation](./mokly-component-review-validation.md)
owns evidence validation, and [inline ownership](./mokly-inline-styles.md) owns analysis.

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
  ends with the terminal status line "No changes to this screen." A component
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
- Inline evidence follows the same compact Details layout; its exact merge
  rules and copy belong to [CSS evidence presentation](./mokly-css-evidence-presentation.md#inline-evidence).
- Selector text, status names, and analysis vocabulary never appear in a
  heading or in the catalogue tree; they appear only inside the secondary
  details list, and only where the detail has review value.

### Shell Derivation

The [CSS evidence presentation contract](./mokly-css-evidence-presentation.md)
owns live/static evidence projection, merge rules, stage-heading derivation,
exact screen/component copy, selector grouping, and viewport-independent
Details behavior.
