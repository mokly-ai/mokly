# Shared Browse shell

These React components are the Browse shell tree: catalogue, stages,
navigation and inspector. `document.tsx` supplies the standalone document
envelope used through `@mokly/viewer/server`, and the same tree is hydrated in
the browser by Serve, export and React hosts, with host-owned slots as ordinary
children. The [viewer contract](../../../../docs/protocol/mokly-viewer.md#shell-tree-and-state)
defines the tree and its state model; the
[React Browse shell plan](../../../../plans/react-browse-shell.md) tracks the
move from string-rendered islands to that hydrated tree.

`css.ts` concatenates the standalone stylesheet. Split string modules preserve
its exact bytes. The package build scopes an embedded stylesheet separately and
uses packaged relative font URLs; standalone Serve/export retain their original
CSS and font delivery paths.

`catalogue.ts` owns pure display indexing. Historical repository access remains
in the CLI's `src/server/baseline_catalogue.ts`. `workspace_data.ts` describes
shell data; the public viewer projects it only from validated catalogue records.
The CLI supplies its private live capabilities through typed server context.
Standalone full-document composition lives in `src/standalone`: its bootstrap
contains only the validated public catalogue and shell delivery state, and
`src/browser.tsx` hydrates that exact server tree.

See [the package README](../../README.md), the
[viewer contract](../../../../docs/protocol/mokly-viewer.md), and the
[shell design](../../../../docs/protocol/mokly-shell-design.md).
