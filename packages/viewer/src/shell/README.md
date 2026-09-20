# Shared Browse shell

These React components render the existing catalogue, stages, navigation and
inspector. `document.tsx` supplies the standalone document envelope used through
`@mokly/viewer/server`; React hosts render the same components into stable runtime
islands with separate host-owned slots.

`nav.tsx` renders the catalogue column and `nav_rows.tsx` its rows: collection
groups as native `<details>`, leaves as links, and a screen's variants as a
container the row's chevron button discloses, because a row cannot be both a
link and a `<summary>`. `details_rows.tsx` owns the inspector's metadata rows,
including the links between a screen and its variants.

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
