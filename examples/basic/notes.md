# Basic Example Notes

These screens are synthetic fixtures for exercising Mokly. They are not
application product designs.

## Design Catalogue Notes

Navigation follows the
[design mockup links contract](../../docs/protocol/mokly-design-links.md).
The design artboards remain static documents, with native links between their
canonical states in both viewport variants.

The `Design` navigation group holds the approved mockups for Mokly's own
catalogue shell and Changes controls: the Canvas viewer family under
`specs/design/canvas/`, and the one older screen that it keeps under
`specs/design/browse/`. Implementation notes for those mockups live here and
in each entry's description and rationale, never inside the rendered
screens:

- The depicted catalogue content is this example's own Welcome, Details, and
  Example tour entries, so no product data appears in any shell design.
- The `Farewell` screen shown in the removed-entry mockups is sample
  comparison data that deliberately has no standalone entry: it depicts a
  screen that was removed on a branch.
- Supported controls are `MockLink` anchors: the brand and the catalogue home,
  catalogue rows, content and flow references, the panel tabs, the compare
  modes, the zoom controls, the selections, the sheets' close controls, and
  the tag states. Links navigate to design paths, independently of the example
  paths shown in the secondary metadata. The two actual example buttons use
  `MockLink asChild` with their original Firna styles.
- Viewport, copy, refresh, resize, and collapse-all remain depictions without
  keyboard stops. Unsupported subject/scheme/comparison combinations have no
  link; they cannot silently open a different comparison scenario. Existing
  native comparison-details disclosures still open locally.
- The kept older artboard draws one visible navigation split grip in its
  resting state. Pointer, keyboard, bounds, and persistence behavior are
  specified in the runtime protocol.
- A saved variant of a design screen, such as a tag search state of
  `design/canvas/search/tags`, has its own file-derived screen path and stays
  grouped below its parent screen in navigation.
- The catalogue depicts Welcome owning two variants, `Empty workspace` and
  `Save failed`. No artboard shows `Empty workspace`, so its rows are pictures.
  `design/canvas/outcomes/removed-variant` depicts the branch that removed
  `Save failed`. The variant rows come from the static navigation fixtures in
  `specs/design/parts/nav_data.ts` and `variant_nav_data.ts`, which the shared
  catalogue-navigation samples reuse, so the saved samples and the artboards
  stay aligned. The example Welcome screen authors the `Empty workspace` state
  as `example/screens/welcome/empty`; `Save failed` remains a design-only
  scenario.
- A variant's Inspect shows the metadata it inherits from its parent, because
  a variant inherits the parent's address, schemes, tags, and related docs. It
  supplies its own title, description, render, and any reciprocal flow
  membership; omitted `useCasePaths` defaults to an empty list. The removed
  variant has its own recorded details, like every removed screen. Color
  scheme and viewport stay view axes and never become variants.
- The `forms` and `onboarding` tags are synthetic fixture labels that carry no
  product meaning: the Welcome entry declares both, and the Details entry and
  the Action declare `forms` in their authored metadata, which is why the
  `tag:forms` catalogue keeps Welcome, Details and the Action.
- Inspect's tag chips and the search field's tag button link to the
  corresponding filtered or open-picker artboards. An inactive chip enters its
  tag and closes the picker; the active chip clears the query. Opening or
  closing the picker preserves the depicted query. Forms retains Welcome,
  Details and the Action; onboarding retains only Welcome. Other subjects and
  comparison states show tag controls without links until an equivalent
  destination is authored.
- The tag control remains visible in every search field. The unfiltered,
  forms, and onboarding picker states show the same catalogue-wide tag list,
  with selection, query, and filtered rows kept consistent. Search typing is
  still a depiction inside these screens; the outer shell provides real search.
- On a phone, a tag search state with the picker closed shows its query in the
  field, and an open picker drops as a sheet under the bar. No other sheet
  opens, so the depicted state stays readable.
- One Appearance selector sits in the top bar on both wide and narrow
  artboards. The screen head of the kept older artboard carries no separate
  scheme control.
- The Changes tab holds the five compare modes: Current, Side by side, Overlay,
  Difference, and Swipe. Viewport and scheme selections stay in the Frames
  filter and the top bar. Every entry starts in Current, and diff snapshots
  load only after a click. The compare modes are shell controls in both
  development and published catalogues, independent of the design pictures
  rendered inside frames.
- Overlay and Difference stack both versions in each frame, as the
  [comparison pane contract](../../docs/protocol/mokly-comparison-panes.md)
  presents them, while paired inner regions follow the
  [scrolling contract](../../docs/protocol/mokly-comparison-scrolling.md). Each
  version has its own opaque screen background, and the frame itself never
  blends. Swipe splits each frame at one divider, and Side by side shows the
  compared frame's two versions next to each other. The Welcome sketch inside
  any depicted comparison carries its link as inert text, because links inside
  a comparison do nothing.
- In a diff mode, the compare modes draw the Scroll together switch, on, and
  Refresh after the mode tiles. The switch is a native checkbox that toggles
  in place and opens no artboard.
- The approved tokens, consumer-tunable accent properties, and responsive
  breakpoints are recorded in `docs/protocol/mokly-shell-design.md`.

## Intentional Implementation Differences

These presentation differences between the mockups and the served shell are
intentional:

- The example's top-level order places Example before Design. Other siblings
  follow the folder ordering contract.
- Live Browse always shows All/Changes. It reports unavailable Changes when
  Git evidence cannot be prepared; artboards depict explicit fixture states.
- The kept older artboard draws a small-phone variant so a full 390×844 phone
  fits the depicted narrow shell; the served shell always uses the full-size
  phone frame and scales it below the responsive breakpoint.
- The served tag chips and tag control are buttons that announce their state —
  a pressed chip for the entered tag, an expanded control for the open panel —
  and the panel is hidden until it is opened. The artboards instead use native
  link semantics to open authored tag states; selected chips and picker
  visibility are part of the destination screen.
- There is no separate Review section or standalone comparison command. Design
  links use the current file-derived catalogue paths.
- Difference mockups use CSS blending, as does the served comparison; no pixel
  percentages or invented diff metrics appear. Classification and impact facts
  come from the comparison engine in the runtime and from synthetic fixture data
  in these design references.
