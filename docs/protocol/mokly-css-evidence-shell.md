# CSS Evidence In The Shell

## Delivery Status

Implemented. This document owns how the inspector and the comparison stage
present the evidence defined by
[CSS change attribution](./mokly-css-attribution.md); that contract owns the
analysis, membership rule, evidence schema, and validation.

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
`design-review-style-unnamed`, and `design-review-style-excluded`. It fixes
these presentation rules:

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
- Selector text, status names, and analysis vocabulary never appear in a
  heading or in the catalogue tree; they appear only inside the secondary
  details list, and only where the detail has review value.

### Shell Derivation

The live classification snapshot retains screen-only `screenEvidence` records
keyed by entry id with per-view `viewport`, `colorScheme`, optional `reasons`,
and optional `excludedResources`. Paths remain repository-relative. The
workspace projects the selected screen's views as optional `resourceEvidence`;
it does not invent component entry reasons, component results, or comparison
states. Static exports project this same slice from the packaged v4
comparison. Absent evidence remains valid. New classification generations
replace the slice, clearing stale evidence while Changes is pending/unavailable.

One inspector renderer merges classification evidence with the loaded selected
comparison. Dependency reasons merge by path with sorted selector unions and
unresolved precedence. Retained paths suppress exclusions across all selected
views; loaded shared-impact and ignored-content details remain available.
Loaded evidence is selection-scoped and cleared on classification invalidation.
Component ownership facts continue to come from entry reasons and the complete
classification; a screen-only resource change never implies a changed shared
component.

`ReviewState` has no resource-only variant, so the browser derives the style
heading from the view's own evidence. A view reads "Styles this screen uses
changed" when its state is `changed`, `material` is absent, it retains at
least one reason, and every retained reason is a stylesheet dependency carrying
an `analysis` record; a component variant reads "Styles this variant uses
changed". Any other retained reason, such as a changed font or image, or a
present `material` flag, keeps the existing "Screen changed" label. A view with
no `analysis`-bearing reason never selects the style label, whatever its
`material` flag.

### Component Details Copy

The shared entry wording helper selects these exact component sentences;
screen copy stays as written below. File paths and analysed outcomes come from
entry-level `sharedImpact` and retained dependency reasons, so they name the
component. Exclusions come from the selected variant entry's compared views,
so they name that variant; a component variant is its own Changes row under
the [variant contract](./mokly-variants.md).

| Evidence                            | Component Details sentence                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------- |
| File list                           | "Changes to these files may affect this component:"                                   |
| Matched styles                      | "Changed styles that apply to this component:"                                        |
| Unresolved styles with selectors    | "This change can apply anywhere on the component, so the component stays in Changes:" |
| Unresolved styles without selectors | "This change can apply anywhere on the component, so the component stays in Changes." |
| One excluded stylesheet             | "This stylesheet changed, but none of the changed styles apply to this variant."      |
| Several excluded stylesheets        | "These stylesheets changed, but none of the changed styles apply to this variant."    |

The Details inspector lists the sorted union of retained dependency reason
paths (entry reasons where the result carries them, view reasons otherwise)
and entry `sharedImpact` under
"Changes to these files may affect this screen:". This includes path-only
evidence for unchanged screens opened from All, without adding a Changes row;
the [membership rule](./mokly-component-changes.md#dependencies-and-styles)
defines when a path is a reason. The inspector then groups analysed
selectors by outcome, so one screen shows at most one matched list and one
unresolved list however many stylesheets changed. Selectors are unioned,
deduplicated, and sorted; an `unresolved` outcome with no serialized selector
renders its sentence with a full stop and no list. Excluded stylesheets come from the
compared views of the selected entry, unioned and sorted, and
never include a path any of those views retains. Their lead sentence
pluralizes when it lists more than one stylesheet. Viewport and color-scheme
controls never change this evidence, and the mobile inspector sheet and the
desktop inspector dock render it identically.
