# CSS Evidence In The Shell

## Shell Presentation

The inspector groups kept selectors by stylesheet and rule outcome, including
separate outside-component page evidence, and lists
excluded resources in a secondary details section. The
[component inspector design](./mokly-component-inspector-design.md#changes-and-evidence)
places this evidence. Headline copy is product language, for example "This
stylesheet changed, but none of the changed styles apply to this screen";
selector text appears only in the details list. Excluded resources never
produce Changes rows.

The comparison details of screens, component variants and whole-document
pages show the shared heading and the branch-point sentence of the
[presentation contract](./mokly-css-evidence-presentation.md#details-copy),
also while the selected entry's detail loads.

The approved design is the Comparison evidence folder of the Canvas family,
recorded in the
[loading, search and evidence inventory](./mokly-shell-canvas-inventory-states.md):
`design/canvas/evidence/styles` with its `excluded`, `unresolved` and
`unnamed` variants, `design/canvas/evidence/unchanged` with its `action`
variant, `design/canvas/evidence/page` with its `inspect` variant, and
`design/canvas/evidence/ignored`. The affected screen of the component
explorer, `design/canvas/components/affected`, recorded in the
[component design inventory](./mokly-component-design-inventory.md),
completes it. These designs draw the comparison details and the Inspect
evidence that these presentation rules fix:

- The files lead names each retained file once, as one list item. That item
  holds the file's outcome sentences, each followed by its selector list, so
  no list mixes two stylesheets. A file without analysed outcomes, such as a
  font or image, is its path alone. Excluded stylesheets keep their separate
  "Examined and excluded" list after the files list. The shell renders the
  structure of the approved designs: one files list whose items hold the path
  text, then each sentence paragraph and its list of selector code chips.
- A screen whose page selectors come from rules that also changed a component
  reads "These changed styles also apply outside the changed components on
  this screen:" under that stylesheet, and its comparison details link those
  changed components. Their own pages keep the matched-component sentence. A
  consumer whose matches all lie inside them stays under Affected screens,
  without a row of its own.
- A `matched` or `unresolved` reason reads as one outcome in the
  [view heading](./mokly-css-evidence-presentation.md#shell-derivation),
  "Styles this screen uses changed". That heading is rendered only inside a
  loaded comparison; the plain current preview has no view heading. The two
  statuses differ only in the secondary details: `matched` lists the changed
  styles that apply to the screen, while `unresolved` says the change can
  apply anywhere on the screen. With serialized selectors the unresolved
  sentence ends with a colon and a list; without them it ends with a full
  stop and no list. When a stylesheet also has proven outside-component
  matches, retain their separate paragraph and selector list under that same
  stylesheet. Unresolved evidence never hides that proof.
- An excluded resource leads with the outcome, "This stylesheet changed, but
  none of the changed styles apply to this screen", and lists the stylesheet
  under an "Examined and excluded" heading. An excluded-only screen is not in
  Changes, offers no comparison, and shows no view heading; its evidence ends
  with the terminal status line "No changes to this screen." A component
  variant's terminal line reads "No changes to this variant." The wording
  follows the entry kind.
- The linked Excluded and Matched styles,
  `design/canvas/evidence/styles/excluded` and `design/canvas/evidence/styles`,
  show the same changed Welcome in All and in Changes. They show the same
  comparison details: the retained file with its matched selectors, then the
  excluded file. They add no explanatory sentence that the viewer does not
  show. `design/canvas/evidence/unchanged` depicts the excluded-only state for
  Details in the same branch: the Details row of the catalogue in the Excluded
  styles opens it, and its evidence stays in Inspect after the head.
- The evidence container and the approved designs both render eight pixels
  above each paragraph or list and fourteen pixels between a list and the
  paragraph that follows it, including the sentences and lists nested in a
  file's item. The designs render that spacing as authored, in the Changes
  tab and in Inspect, whatever other stylesheets the design page loads.
- A screen or component that only changed components affect stays
  Unmodified with no Changes row, and its compare modes stay available. Its
  comparison details keep the full matched styles of each file, link each
  changed component, and end with the shared-component sentence in place of
  the terminal line: “Changed components that this screen uses affect its
  preview.” for a screen, as `design/canvas/components/affected` depicts, and
  “Changed components that this variant uses affect its preview.” for a
  component. In a loaded comparison, each of its affected views reads the
  view heading "Components this screen uses changed", or "Components this
  variant uses changed" for a component.
- A whole-document page in Changes shows its current document, with no
  compare modes and no view heading. It shows the same comparison details and
  files list, led by "Changes to these files may affect this page:", with the
  page sentences of the presentation contract under each file. A page may use
  component elements, but it has no usage records, so its comparison details
  link no changed component.
  Its status sits beside its title, as a screen's does. Long evidence scrolls
  inside the [inspector](./mokly-component-inspector-design.md#right-panel),
  so it stays reachable and the document stays visible. On narrow screens
  every title row wraps its chips below the title before the title itself
  wraps.
- Selector text, status names, and analysis vocabulary never appear in a
  heading or in the catalogue tree; they appear only inside the secondary
  details list, and only where the detail has review value.

### Shell Derivation

The [CSS evidence presentation contract](./mokly-css-evidence-presentation.md)
owns live/static evidence projection, merge rules, view-heading derivation,
exact screen/component copy, selector grouping, and comparison details that do
not change with the view.
