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

`catalogue.ts` owns pure display indexing, including the shared route resolver
that gives current entries precedence over removed history. Historical
repository access remains in the CLI's `src/server/baseline_catalogue.ts`.
`store.tsx` and the focused `store_*` modules own standalone route/history,
selection, disclosure, drawer, details, recovery and scroll state. `routes.ts`,
`nav_model.ts`, `search_query.ts` and `entry_wording.ts` are deterministic
helpers shared by SSR and the live tree; `delivery.ts` validates static
deployment continuity before a read-model route transition. Frame documents
remain static while `frame_navigation.tsx` subscribes their immediate logical
links with effect-scoped listeners.

`workspace_data.ts` describes shell data; the public viewer projects it only
from validated catalogue records. Embedded bootstrap and workspace JSON use
canonical key ordering so their validated client projections retain the exact
server bytes during hydration. Comparison panes clone the current React-owned
frame chrome on demand, keeping parser-owned template contents and duplicate
hidden controls out of the hydrated document. The CLI supplies its private live
capabilities through typed server context. Standalone full-document composition
lives in `src/standalone`: its bootstrap contains only the validated public
catalogue and shell delivery state, and `src/browser.tsx` hydrates that exact
server tree.

Before standalone hydration, stored disclosure and split-width preferences are
applied to the server DOM. A newer native disclosure activation then wins over
that stored value. The browser entry reads the resulting DOM into the store's
initial state and persists the adopted disclosure state; load or page exit
removes the temporary capture. React therefore adopts the same attributes on
its first render instead of replaying preferences after hydration.

See [the package README](../../README.md), the
[viewer contract](../../../../docs/protocol/mokly-viewer.md), and the
[shell design](../../../../docs/protocol/mokly-shell-design.md).
