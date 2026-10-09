# CSS Evidence In The Shell

## Delivery Status

Existing compact evidence is implemented. The [M18](../../plans/remove-source-path-evidence.md#milestone-18-depict-the-outside-component-evidence)
mockups of the [source-path removal plan](../../plans/remove-source-path-evidence.md)
depict the outside-component evidence and the per-file layout below; the shell
implements them for screens and component saved views in [M20](../../plans/remove-source-path-evidence.md#milestone-20-show-the-outside-component-evidence).
The [M20A](../../plans/remove-source-path-evidence.md#milestone-20a-depict-whole-document-page-evidence)
mockup depicts the whole-document page rule below; the shell implements it in
[M20B](../../plans/remove-source-path-evidence.md#milestone-20b-show-whole-document-page-evidence).
Omitting the branch-point sentence when its name is unknown is implemented in
[M24](../../plans/remove-source-path-evidence.md#milestone-24-hide-the-branch-point-sentence-when-the-name-is-unknown).
The known-name rule needs no new mockup; existing mockups already show a name.

Keeping the export's known branch name during navigation is implemented in
[M31](../../plans/remove-source-path-evidence.md#milestone-31-keep-the-branch-name-in-exported-navigation).
The excluded-only screen depiction, the linked child pages and the shared
Excluded/Matched Details card are implemented in
[M27](../../plans/remove-source-path-evidence.md#milestone-27-depict-the-excluded-only-stylesheet-state).
M31 checked the viewer's excluded-only state against that depiction at both
widths. The viewer already matched it, and a browser test now keeps them
aligned.

This document owns visual rules for evidence defined by
[CSS change attribution](./mokly-css-attribution.md); the
[presentation contract](./mokly-css-evidence-presentation.md) owns derivation
and exact copy.

The [scalable plan](../../plans/scalable-inline-style-analysis.md#milestone-16-inline-style-evidence-mockup)
schedules an inline-excluded mockup and a separate inline-style block before
that block's UI implementation. Inline data is retained by its [evidence contract](./mokly-inline-style-evidence.md).

## Shell Presentation

The inspector groups kept selectors by stylesheet and rule outcome, including
separate outside-component page evidence, and lists
excluded resources in a secondary details section. Headline copy is product
language, for example "This stylesheet changed, but none of the changed styles
apply to this screen"; selector text appears only in the details list. Excluded
resources never produce Changes rows.

In Details for screens, component saved views and whole-document pages, show
“Compared with the branch point on \<name\>.” only when the name is known.
An embedded catalogue supplied through the `@mokly/viewer` public catalogue
has no name, so omit that sentence. Keep the “Comparison details” heading
and the rest of Details. A served catalogue with a known name retains the
sentence. Use the same shared heading for all three entry kinds, as the
[presentation contract](./mokly-css-evidence-presentation.md#details-copy) defines.

During exported navigation, the temporary view uses the branch name already
known to the export while the selected screen's full data loads. The sentence
must not disappear and return when that data arrives. A nameless embedded
catalogue still omits it.

The approved design is the stylesheet-evidence group of the design catalogue,
recorded in the
[shell design inventory](./mokly-shell-design.md#design-mockups) as
`design/changes/impact/styles/page`, `design/changes/impact/styles/matched-excluded/matched`,
`design/changes/impact/styles/matched-excluded/excluded`, `design/changes/impact/styles/matched-excluded/excluded-only`,
`design/changes/impact/styles/unresolved-unnamed/unresolved` and `design/changes/impact/styles/unresolved-unnamed/unnamed`, and the
component explorer's Stylesheet evidence gallery, recorded in the
[component design inventory](./mokly-component-design.md#owning-catalogue) as
`design/components/states/shared-impact/style-changed`, `design/components/states/shared-impact/style-outside`, and
`design/components/states/shared-impact/shared-impact`. These screens follow these presentation
rules:

- The files lead names each retained file once, as one list item. That item
  holds the file's outcome sentences, each followed by its selector list, so
  no list mixes two stylesheets. A file without analysed outcomes, such as a
  font or image, is its path alone. Excluded stylesheets keep their separate
  "Examined and excluded" list after the files list. The shell renders the
  approved card's structure: one files list whose items hold the path text,
  then each sentence paragraph and its list of selector code chips.
- A screen whose page selectors come from rules that also changed a component
  reads "These changed styles also apply outside the changed components on
  this screen:" under that stylesheet, and its Details link those changed
  components. Their own pages keep the matched-component sentence. A consumer
  whose matches all lie inside them stays under Affected screens, without a
  row of its own.
- A `matched` or `unresolved` reason reads as one outcome in the comparison
  stage heading, "Styles this screen uses changed". That heading is rendered
  only inside a loaded comparison; the plain current preview has no stage
  heading. The two statuses differ only in the secondary details: `matched`
  lists the changed styles that apply to the screen, while `unresolved` says
  the change can apply anywhere on the screen. With serialized selectors the
  unresolved sentence ends with a colon and a list; without them it ends with
  a full stop and no list. When a stylesheet also has proven outside-component
  matches, retain their separate paragraph and selector list under that same
  stylesheet. Unresolved evidence never hides that proof.
- An excluded resource leads with the outcome, "This stylesheet changed, but
  none of the changed styles apply to this screen", and lists the stylesheet
  under an "Examined and excluded" heading. An excluded-only screen is not in
  Changes, offers no comparison, and shows no stage heading; its evidence panel
  ends with the terminal status line "No changes to this screen." A component
  variant's terminal line reads "No changes to this saved view." The wording
  follows the entry kind through one shared helper.
- Linked Excluded and Matched screens show the same changed Welcome in All
  and Changes. They use one shared Details card with the retained file, its
  matched selectors and the excluded file. They add no explanatory sentence
  that the viewer does not show. `design/changes/impact/styles/matched-excluded/excluded-only` depicts
  the excluded-only state for Details in the same branch: it opens from All,
  including from the Excluded screen's Details row. The gallery is split into
  linked child pages of at most five screens, each with mobile and desktop
  components; its parent shows the canonical `design/changes/impact/styles/page`.
- The evidence container and the approved mockup card both render eight
  pixels above each paragraph or list and fourteen pixels between a list and
  the paragraph that follows it, including the sentences and lists nested in a
  file's item. The mockup card must render that spacing as authored, whatever
  other inspector stylesheets the design page loads. The shell keeps its
  separator treatment rather than the mockup's bordered card.
- A whole-document page in Changes keeps its plain document pane, with no
  comparison toolbar and no stage heading. Its Details hold the same
  comparison details and files list, led by "Changes to these files may affect
  this page:", with the page sentences of the presentation contract under each
  file. A page consumes no components, so its Details link no changed component.
  Its status sits beside its title, as a screen's does. The open Details panel
  takes at most 60% of the main region and scrolls, with its bar kept in view,
  so long evidence stays reachable and the document stays visible. On narrow
  screens every title row wraps its chips below the title before the title
  itself wraps.
- No design screen without a comparison toolbar renders a comparison stage
  heading. A screen depicted in Current mode, whether unchanged, excluded-only,
  or ignored-only, shows the plain preview with no heading.
- Inline evidence follows the same compact Details layout; its exact merge
  rules and copy belong to [CSS evidence presentation](./mokly-inline-style-evidence.md).
- Selector text, status names, and analysis vocabulary never appear in a
  heading or in the catalogue tree; they appear only inside the secondary
  details list, and only where the detail has review value.

### Shell Derivation

The [CSS evidence presentation contract](./mokly-css-evidence-presentation.md)
owns live/static evidence projection, merge rules, stage-heading derivation,
exact screen/component copy, selector grouping, and viewport-independent
Details behavior.
