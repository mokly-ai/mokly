# Basic Example Notes

These screens are synthetic fixtures for exercising Mokly. They are not
application product designs.

## Design Catalogue Notes

Navigation follows the
[design mockup links contract](../../docs/protocol/mokly-design-links.md).
The 40 Browse and Changes artboards remain static documents, with native links
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
  content and flow references, Welcome inspector, paired schemes, comparison
  modes, and Welcome tag states. Links navigate to design ids, independently of
  the example ids shown in the secondary metadata. The two actual example
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
- The dark-scheme, light-only, and dark view compare screens are light
  documents that draw a shell with dark selected, so they opt out of dark
  generation like every other design screen. Only the depicted device screens
  change; the shell chrome around them stays light in both schemes.
- The dark view compare screen shows the same `Welcome` comparison as the
  changed screen, in its dark view. The normal scheme control changes the
  comparison in place, while the catalogue shell remains light.
- The screen variant artboards depict `Welcome` owning two variants, `Empty
workspace` and `Save failed`. Only `Empty workspace` has a design destination;
  `Save failed` is selected by the Changes artboards that own it. The variant
  rows come from the static navigation fixture in `parts/nav_data.ts`, which the
  shared catalogue-navigation samples reuse, so the saved samples and the
  in-screen trees stay aligned. The example Welcome screen now authors the
  `Empty workspace` state as `example-welcome-empty`; `Save failed` remains a
  design-only comparison scenario until its Changes milestone lands.
- A variant's inspector shows the metadata it inherits from its parent, because
  a variant inherits the parent's address, schemes, dependencies, tags, and
  related docs. It supplies its own title, description, render, and any
  reciprocal flow membership; omitted `useCaseIds` defaults to an empty list.
  The removed variant has its own recorded details, like every removed screen.
- The changed-views artboard keeps `Welcome` in Changes while its shown light
  view is unmodified: the change is confined to the dark views, so the theme
  control and the viewport dropdown carry a mark and the details list them.
  Color scheme and viewport stay view axes and never become variants.
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
- The `Light | Dark` control sits in the top bar on the wide artboards and in
  the screen head band, under the viewport control, on the narrow ones: a 390px
  top bar has no room for a third control.
- The comparison band contains Current, Side by side, Overlay, and Difference.
  Viewport and scheme selections remain in the normal screen header and top bar.
  Every screen starts in Current, and diff snapshots load only after a click.
  The same band belongs to the actual shell in both development and published
  catalogues; it is independent of the design pictures rendered inside frames.
- The approved tokens, consumer-tunable accent properties, and responsive
  breakpoints are recorded in `docs/protocol/mokly-shell-design.md`.

## Intentional Implementation Differences

The shipped shell was visually smoke-tested against these mockups. The
following presentation differences are intentional:

- The details inspector's collapsed bar shows one fixed hint
  ("Description, rationale, source, related docs, and use cases") rather than
  the state-specific hint copy some mockups draw.
- Navigation groups render in deterministic alphabetical order, so the
  `Design` group precedes `Example` when this example is served.
- The Browse changed/all filter appears only when the serve base ref resolves
  in Git; the mockups always show it with a sample count.
- The mockups draw a small-phone artboard variant so a full 390×844 phone fits
  the depicted narrow shells; the served shell always uses the full-size
  phone frame and scales it below the responsive breakpoint.
- The served tag chips and tag control are buttons that announce their state —
  a pressed chip for the entered tag, an expanded control for the open panel —
  and the panel is hidden until it is opened. The artboards instead use native
  link semantics to open authored tag states; selected chips and picker
  visibility are part of the destination screen.
- There is no separate Review section or standalone comparison command. Stable
  design routes retain their old identifiers to preserve catalogue links.
- Difference mockups use CSS blending, as does the served comparison; no pixel
  percentages or invented diff metrics appear. Classification and impact facts
  come from the comparison engine in the runtime and from synthetic fixture data
  in these design references.
