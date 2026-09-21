# Shared Browse shell

These React components render the existing catalogue, stages, navigation and
inspector. `document.tsx` supplies the standalone document envelope used through
`@mokly/viewer/server`; React hosts render the same components into stable runtime
islands with separate host-owned slots.

`nav.tsx` renders the catalogue column, `nav_rows.tsx` its collection groups as
native `<details>`, and `nav_leaf_rows.tsx` its leaves: links carrying their
entry-kind glyph, and a screen's variants as a container the row's chevron
button discloses, because a row cannot be both a link and a `<summary>`. A
deleted variant whose parent survives joins that container as a Removed row,
which `nav_tree.ts` attaches to the parent instead of the section root.
`nav_changed.ts` names the changed mark's class, attribute and wording, so the
row markup here and the Browse client's search and evidence passes agree on
it; `css_nav_changed.ts` draws the mark from `data-changed` and
`data-changed-variants` alone. `details_rows.tsx` owns the inspector's
metadata rows, including the links between a screen and its variants and the
`Changed views` row.

`view_marks.ts` is the shared vocabulary for per-view change evidence: the two
axes that name a view, their canonical order and reader label, and the rule
that decides whether the theme and viewport controls carry a mark.
`workspace_controls.tsx` renders from that rule and the Browse client
recomputes from it, so a mark can never disagree between the two.
`workspace_views_data.ts` derives the changed views themselves, preferring a
ready comparison result and falling back to the lightweight screen-view
evidence a screen-only catalogue records. Workspace data keys those lists by
saved-variant id for components and entry id for screens, so every reader must
select the evidence that belongs to the preview; `css_workspace_marks.ts` draws
the dot and clips its wording.
The parallel `viewStates` map stores `{ viewport, colorScheme, state }` for each
ready view under the same key, while a missing key means per-view status is
unknown and the workspace must retain its route-level status and eligibility.
`workspace.tsx` resolves the initial Both/light status from that map, and the
client's shared shown-status path recomputes the badge and comparison band after
every viewport, scheme, saved-variant or evidence change.

`css.ts` concatenates the standalone stylesheet. Split string modules preserve
its exact bytes. The package build scopes an embedded stylesheet separately and
uses packaged relative font URLs; standalone Serve/export retain their original
CSS and font delivery paths.

`catalogue.ts` owns pure display indexing. Historical repository access remains
in the CLI's `src/server/baseline_catalogue.ts`. `workspace_data.ts` describes
shell data; the public viewer projects it only from validated catalogue records.
The CLI supplies its private live capabilities through typed server context.

See [the package README](../../README.md), the
[viewer contract](../../../../docs/protocol/mokly-viewer.md), and the
[shell design](../../../../docs/protocol/mokly-shell-design.md).
