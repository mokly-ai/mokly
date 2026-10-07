# Basic Example Notes

These screens are synthetic fixtures for exercising Mokly. They are not
application product designs.

## Design Catalogue Notes

Navigation follows the
[design mockup links contract](../../docs/protocol/mokly-design-links.md).
The Browse and Changes artboards remain static documents, with native links
between their canonical states in both viewport variants.

The `Design` navigation group holds the approved mockups for Mokly's own
catalogue shell and Changes controls. Implementation notes for those mockups live here and
in each entry's description and rationale, never inside the rendered screens:

- The depicted catalogue content is this example's own Welcome, Details, and
  Example tour entries, so no product data appears in any shell design.
- The `Farewell` screen shown in comparison mockups is sample comparison data that
  deliberately has no standalone entry: it depicts a screen that was removed
  on a branch.
- Supported controls are `MockLink` anchors: brand/home, catalogue leaves,
  content and flow references, Welcome inspector, comparison modes, and
  Welcome tag states. Links navigate to design paths, independently of
  the example paths shown in the secondary metadata. The two actual example
  buttons use `MockLink asChild` with their original Firna styles.
- Viewport, copy, refresh, resize, and collapse-all remain depictions without
  keyboard stops. Unsupported subject/scheme/comparison combinations have no
  link; they cannot silently open a different comparison scenario. Existing
  native comparison-details disclosures still open locally.
- Desktop Current and comparison views share one visible navigation split grip.
  The static mockups record its resting state; pointer, keyboard, bounds, and
  persistence behavior are specified in the runtime protocol.
- The completed [in-frame catalogue navigation work](../../plans/in-frame-catalogue-link-navigation.md)
  reused the approved active-row, disclosure, and frame visuals, adding runtime
  behavior and inert generated metadata without new design screens. The
  [design mockup adoption](../../docs/protocol/mokly-design-links.md#canonical-destination-inventory)
  adds normal light Details and four tag states; that contract owns their
  destinations. The original inspector and forms-open routes stay available.
- The two established scheme examples and four tag-state artboards remain
  variants of the canonical Welcome design. Each has its own file-derived screen
  path and stays grouped below Welcome in navigation.
- The two retained scheme variants now render both Light and Dark artboards
  through the shared Appearance selector. Welcome's device screen follows the
  catalogue scheme; Details keeps its light frames under Dark and names the
  fallback. The former separate dark comparison artboard is replaced by the
  dual-scheme canonical changed screen.
- The screen variant artboards depict `Welcome` owning two variants, `Empty
workspace` and `Save failed`. Only `Empty workspace` has a design destination;
  `Save failed` is selected by the Changes artboards that own it. The variant
  rows come from the static navigation fixture in `parts/nav_data.ts`, which the
  shared catalogue-navigation samples reuse, so the saved samples and the
  in-screen trees stay aligned. The example Welcome screen now authors the
  `Empty workspace` state as `example/screens/welcome/empty`; `Save failed` remains a
  design-only comparison scenario until its Changes milestone lands.
- A variant's inspector shows the metadata it inherits from its parent, because
  a variant inherits the parent's address, schemes, dependencies, tags, and
  related docs. It supplies its own title, description, render, and any
  reciprocal flow membership; omitted `useCasePaths` defaults to an empty list.
  The removed variant has its own recorded details, like every removed screen.
- The changed-views artboard records a direct or All-filter arrival at `Welcome`
  while its shown light view is unmodified: the change is confined to the dark
  views, so top-bar Appearance and the viewport dropdown carry a mark and the
  details list them. Color scheme and viewport stay view axes and never become
  variants.
- The reparented-variant artboard records the one-level fallback: `Welcome` is
  now another screen's variant, so its removed `Save failed` child remains a
  flat Changes row exactly once instead of becoming a nested variant or
  disappearing.
- The `forms` and `onboarding` tags are synthetic fixture labels that carry no
  product meaning: the Welcome entry declares both and the Details entry
  declares `forms` in their authored metadata, which is why the `tag:forms`
  tree keeps both screen rows.
- Welcome's light tag chips and search control link to the corresponding
  filtered or open-picker artboards. An inactive chip selects its tag and closes
  the picker; the active chip clears the query. Opening or closing the picker
  preserves the depicted query. Forms retains Welcome and Details; onboarding
  retains only Welcome. Other subjects and comparison states show tag controls
  without links until an equivalent destination is authored.
- The tag control remains visible in every search field. The unfiltered,
  forms, and onboarding picker screens show the same catalogue-wide tag list,
  with selection, query, and filtered rows kept consistent. Search typing is
  still a depiction inside these screens; the outer shell provides real search.
- The tag-filter artboards draw the top-bar search field because the entered
  query is the depicted state. The narrow one draws it too: the shell keeps the
  search field in the top bar below the breakpoint, and the artboard reduces the
  brand to its mark so the field has room, which is how the served narrow Browse
  bar renders. All narrow artboards now retain the same search field.
- The narrow tag-filter artboard draws no navigation drawer: one overlay at a
  time keeps the depicted state readable, and the open picker is the state this
  screen records. The tree the query filters is left to the wide artboard,
  which has the room to show it beside the panel.
- The narrow navigation drawer opens under the top bar, and the bar stays above
  the drawer's scrim: the menu button that opened it, the brand, and the query
  beside them keep their full-strength surface while only the shell below the
  bar dims. The served shell stacks its bar above the scrim the same way, so
  the artboard and the shipped drawer agree.
- One Appearance selector sits in the top bar on both wide and narrow
  artboards. The screen head carries no separate scheme control.
- The comparison band contains Current, Side by side, Overlay, and Difference.
  Viewport and scheme selections remain in the normal screen header and top bar.
  Every screen starts in Current, and diff snapshots load only after a click.
  The same band belongs to the actual shell in both development and published
  catalogues; it is independent of the design pictures rendered inside frames.
- Overlay and Difference draw one device chrome holding both versions, as the
  [comparison pane contract](../../docs/protocol/mokly-comparison-panes.md)
  presents them: both layers fill the chrome's viewport at device size and
  share one page offset, while paired inner regions follow the
  [scrolling contract](../../docs/protocol/mokly-comparison-scrolling.md). Each
  layer has its own opaque screen background, and the chrome itself never
  blends. Side by side keeps one chrome per version. The Welcome sketch
  inside any depicted comparison carries its link as inert text, because links
  inside a comparison do nothing.
- The long-overlay artboard shows Welcome continuing well below its first
  screenful, part-way down, with one section reworded in place so every other
  section stays aligned. A static artboard cannot scroll, so its offset and
  scrollbar are drawn.
- The stage's heading style applies only to its own heading, so the section
  headings of a depicted Welcome keep the screen's ink in either scheme.
- Every diff-mode band draws the Scroll together switch, on, after its modes
  and before Refresh. It is a native checkbox that toggles in place and opens
  no artboard; below the breakpoint the modes take the first row and the
  switch starts the second.
- The panel-overlay artboard shows Welcome built as an app shell: its top bar
  and navigation, a tab bar on the phone, stay in place while both versions'
  main panels are drawn part-way down at one position with the panel's own
  scrollbar and one section reworded. The chrome's viewport has nothing to
  scroll, so it draws no scrollbar.
- The scrolled-apart artboard shows Side by side with Scroll together off:
  each version is drawn at its own place down a long Welcome with its own
  scrollbar, and both land in the sections rather than the introduction's
  reserved space.
- Those two artboards draw every row at a fixed height. Each drawn region
  states its visible height, content height and offset once in
  `design-review-scroll.css`, and both the content's offset and its
  scrollbar thumb follow those numbers, so they always agree and never depend
  on text wrapping.
- Component Overlay and Difference draw one bordered component frame holding
  both versions of a saved variant, at the height of each Side by side canvas,
  with its caption above the viewport both versions share. Each version paints
  the canvas surface, and the frame and caption never blend. Action's mode
  control links its four modes to their own artboards.
- The tall-component artboard shows a synthetic Checklist taller than its
  frame, part-way down, with one step reworded. Its rows keep fixed heights and
  never wrap, so the drawn offset and scrollbar never depend on text layout.
- The approved tokens, consumer-tunable accent properties, and responsive
  breakpoints are recorded in `docs/protocol/mokly-shell-design.md`.

## Intentional Implementation Differences

The shipped shell was visually smoke-tested against these mockups. The
following presentation differences are intentional:

- The runtime and artboards use the shared icon footer for the inspector.
- The example's top-level order places Example before Design. Other siblings
  follow the folder ordering contract.
- Live Browse always shows All/Changes. It reports unavailable Changes when
  Git evidence cannot be prepared; artboards depict explicit fixture states.
- The mockups draw a small-phone artboard variant so a full 390×844 phone fits
  the depicted narrow shells; the served shell always uses the full-size
  phone frame and scales it below the responsive breakpoint.
- The served tag chips and tag control are buttons that announce their state —
  a pressed chip for the entered tag, an expanded control for the open panel —
  and the panel is hidden until it is opened. The artboards instead use native
  link semantics to open authored tag states; selected chips and picker
  visibility are part of the destination screen.
- There is no separate Review section or standalone comparison command. Design
  links use the current file-derived catalogue paths.
- Comparison artboards draw shorter browser frames than the served shell so two
  versions fit side by side, and every comparison mode keeps that one frame
  size. Component comparison artboards likewise draw a shorter bordered frame
  than the served one, the same in every mode.
- Difference mockups use CSS blending, as does the served comparison; no pixel
  percentages or invented diff metrics appear. Classification and impact facts
  come from the comparison engine in the runtime and from synthetic fixture data
  in these design references.
