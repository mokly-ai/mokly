# Viewer modules

The [package README](./README.md) describes the public entry points and usage.

- [`src/shell/root_context.tsx`](./src/shell/root_context.tsx) — the root ref,
  named scroll regions, focus targets, host slots, and resizing state
- [`src/standalone/startup.ts`](./src/standalone/startup.ts) and
  [`src/standalone/use_appearance.ts`](./src/standalone/use_appearance.ts) —
  the appearance resolved before the first render and its React state owner
- [`src/shell/top_bar.tsx`](./src/shell/top_bar.tsx),
  [`src/shell/nav.tsx`](./src/shell/nav.tsx), and
  [`src/shell/head.tsx`](./src/shell/head.tsx) — the containers of the top
  bar and the catalogue navigation, and the title and the folder crumbs of a
  view; `nav_rows.ts` and `nav_leaf_rows.ts` build the navigation's records
  from the shell state
- [`src/shell/tags.tsx`](./src/shell/tags.tsx) — the container of the tag
  picker and the tag chips of Inspect's Details rows; `tag_selection.ts`
  returns focus to the picker's button after a tag of the rows, and
  `view_marks.ts` names the ids and the wording of the change marks
- [`src/shell/right_panel.tsx`](./src/shell/right_panel.tsx) — the right
  panel: the strip of its tabs, Inspect and Changes, the tab that the store
  holds, and the bodies of the tabs; `sheets.tsx` holds the panel's sheet and
  the dock
- [`src/shell/workspace_panel.tsx`](./src/shell/workspace_panel.tsx) and
  [`src/shell/workspace_inspect.tsx`](./src/shell/workspace_inspect.tsx) — the
  right panel of a screen or a component, and its Inspect in the order of the
  sections; `target_panel.tsx` holds the right panel of a page, a document, a
  use case, or a removed page
- [`src/shell/inspect_head.tsx`](./src/shell/inspect_head.tsx) — Inspect's
  head and its Details rows, whose catalogue lookups live in
  `details_rows.tsx`; `inspect_variants.ts` builds the rows of Variants
- [`src/shell/inspect_frames.tsx`](./src/shell/inspect_frames.tsx) and
  [`src/shell/frames_filter.ts`](./src/shell/frames_filter.ts) — the Frames
  section, and the one Frames choice of the screens, which decides the shown
  frames, the status, and the change marks: its viewport toggles show and set
  the selection's viewport, and the shell keeps its scheme toggles;
  `use_case_choice.ts` holds the own choice of a use case
- [`src/shell/use_canvas_selection.ts`](./src/shell/use_canvas_selection.ts)
  and [`src/shell/canvas_selection.ts`](./src/shell/canvas_selection.ts) —
  the canvas selection: the clicks, Escape, the selection that a route names,
  and the reducer that follows the session of each frame;
  `canvas_selection_frames.ts` reads the sessions, `workspace_picks.ts` joins
  the selection to the canvas, and `workspace_selection_view.tsx`,
  `selection_details.ts`, and `selection_overlay.tsx` show the selection on
  its frame, in Inspect, and in the compact layout's pill
- [`src/shell/component_controls_panel.tsx`](./src/shell/component_controls_panel.tsx),
  [`src/shell/workspace_props.tsx`](./src/shell/workspace_props.tsx),
  [`src/shell/workspace_usage.tsx`](./src/shell/workspace_usage.tsx),
  [`src/shell/workspace_instances.tsx`](./src/shell/workspace_instances.tsx),
  and [`src/shell/workspace_evidence.tsx`](./src/shell/workspace_evidence.tsx)
  — the containers of Inspect's Props, Usage, and Components and of the
  comparison details, which turn the controls state, the usage links, the
  instance records, and the comparison evidence into the records and the
  wording of the package components
- [`src/shell/control_values.ts`](./src/shell/control_values.ts) — the control
  targets, drafts, and validation shared by the controls and their fields
- [`src/shell/stage_frame.tsx`](./src/shell/stage_frame.tsx),
  [`src/shell/document_stage_frame.tsx`](./src/shell/document_stage_frame.tsx),
  and [`src/shell/previews.tsx`](./src/shell/previews.tsx) — the mounts of the
  canvas frames and the container of a removed entry's previous version: they
  mount each frame, derive its sources, and pass its `ref` and attributes to
  the package's `<iframe>`; `frames.tsx` draws the browser window of a
  comparison's desktop pane, whose address the store copies
- [`src/shell/views.tsx`](./src/shell/views.tsx),
  [`src/shell/workspace.tsx`](./src/shell/workspace.tsx),
  [`src/shell/embedded_viewer.tsx`](./src/shell/embedded_viewer.tsx), and
  [`src/standalone/shell.tsx`](./src/standalone/shell.tsx) — the containers of
  the shell layout: the main region, the workspace, an embedded root with its
  host slots, and the standalone root, which carries the appearance and the
  preview scheme; `src/viewer/component.tsx`
  shows an
  embedded root's loading and failure states, and
  `src/shell/marker_layer.tsx` and `src/viewer/inspection_layer.tsx` place
  the host's markers and inspection labels
- [`src/shell/catalogue_boundary.tsx`](./src/shell/catalogue_boundary.tsx) —
  `CatalogueBoundary`, the catcher around the ready shell of the embedded and
  the standalone root: a document of the supported version that the shell
  cannot render, an entry detail included, becomes the root's failure state
  with Try again, and a value that host code throws passes on to the host;
  `hostErrors` records those values for one viewer
- [`src/shell/comparison_canvas.tsx`](./src/shell/comparison_canvas.tsx) and
  [`src/shell/comparison_viewport.tsx`](./src/shell/comparison_viewport.tsx) —
  the containers of the compare on the canvas's frames, which own each
  compared frame's scroll controller and attach the viewport, its spacer, and
  each surface to it through refs
- [`scripts/styles.mjs`](./scripts/styles.mjs) — writes the standalone
  `shell.css` and the embedded `styles.css` from the `@font-face` rules of
  [`src/shell/assets/fonts/geist.css`](./src/shell/assets/fonts/geist.css) and
  the UI package's `styles.css`: each face's address in each delivery and the
  embedded font families
- [`src/catalogue`](./src/catalogue) — the version gates for the catalogue
  index, entry detail, and live descriptor. The public readers return typed
  copies. The index and detail transports adopt the JSON they fetch directly.
  This directory also holds the optional deployment reader, detail fences,
  and public catalogue types.
- [`src/catalogue/sources.ts`](./src/catalogue/sources.ts) — the shared object
  and URL source validation and the index, detail, and deployment transports
- [`src/data.ts`](./src/data.ts) — the `./data` entry: path functions,
  directory names, the path and link grammar, and the prop checks
  `validatePropSchema`, `validateProps`, and `validatePropValues`; it
  re-exports the directory names, the current document paths, and the
  grammar from `@mokly/model`
- [`src/navigation/routes.ts`](./src/navigation/routes.ts) — entry, view,
  snapshot, preview, and shell URL derivation
- [`src/shell/catalogue.ts`](./src/shell/catalogue.ts) — the shell's lookups of
  generated current and removed records, tags, schemes, and accepted moves
- [`src/registry/catalogue_hierarchy.ts`](./src/registry/catalogue_hierarchy.ts)
  and [`src/registry/hierarchy.ts`](./src/registry/hierarchy.ts) — the index
  tree's navigation records and the Specs and Components sections
- [`src/registry/nav_paths.ts`](./src/registry/nav_paths.ts) — the shared
  comparator for each section's sibling order
- [`src/shell/component_geometry.ts`](./src/shell/component_geometry.ts) —
  `visibleFrameBox`, which clips a frame to the host viewport and its
  ancestors
- [`src/previews`](./src/previews) — the removed-entry previews
- [`src/previews/descriptor.ts`](./src/previews/descriptor.ts) — the identity
  key of a route-owned previous-version request
- [`src/shell/use_comparison.ts`](./src/shell/use_comparison.ts),
  [`src/shell/comparison_mode.tsx`](./src/shell/comparison_mode.tsx), and
  [`src/shell/comparison_presentation.ts`](./src/shell/comparison_presentation.ts)
  — the comparison-mode owner, the mode that the canvas shows, request
  identity, and current and comparison presentation
- [`src/shell/changes_tab.tsx`](./src/shell/changes_tab.tsx) and
  [`src/shell/compare_modes.tsx`](./src/shell/compare_modes.tsx) — the right
  panel's Changes tab: the change stepper, the host's `changesStart` slot,
  the Compared rail, the compare modes with their keys, and the comparison
  details
- [`src/shell/view_status.ts`](./src/shell/view_status.ts) — the combined
  status and eligibility of the displayed views from their index comparisons
- [`src/shell/frame_instances.ts`](./src/shell/frame_instances.ts) — exact
  `InstanceRef` matching against mounted preview frames
- [`src/shell/store_host.ts`](./src/shell/store_host.ts) and
  [`src/shell/store_host_routes.ts`](./src/shell/store_host_routes.ts) —
  controlled and uncontrolled selection commits, frame-link misses, and
  navigation events
- [`src/shell/store_routes.ts`](./src/shell/store_routes.ts) and
  [`src/shell/store_interactions.ts`](./src/shell/store_interactions.ts) — the
  shared route installation, Escape priority, outside-click dismissal, and
  input listeners of both roots
- [`src/shell/selection.ts`](./src/shell/selection.ts) and
  [`src/shell/projection.ts`](./src/shell/projection.ts) — selection changes,
  query equality, and the catalogue context; root options alone set `embedded`
- [`src/shell/workspace_data.ts`](./src/shell/workspace_data.ts) and
  [`src/shell/public_workspace.ts`](./src/shell/public_workspace.ts) — the
  routed workspace data and its projection from the index, entry detail, and
  parent detail for current component variant lists
- [`src/shell/comparison_request.ts`](./src/shell/comparison_request.ts) — the
  generation root of a comparison: the pinned root a static catalogue names,
  or the root that Serve's selection redirects to and its renewal
- [`src/shell/public_compared.ts`](./src/shell/public_compared.ts) — the
  routed entry's comparison facts that the panes and the comparison details
  read from the detail's view states, ignore ids, and base side
- [`src/catalogue/detail_reader.ts`](./src/catalogue/detail_reader.ts) — the
  entry detail reader; its typed copy keeps the detail's `reasons` in the
  review v8 order of the core's
  [`review_order.rs`](../../crates/mokly-model/src/review_order.rs)
- [`src/shell/public_reasons.ts`](./src/shell/public_reasons.ts) — the
  detail reasons that the comparison details show, for a record that
  Changes lists
- [`tests`](./tests) — package-level conformance tests
