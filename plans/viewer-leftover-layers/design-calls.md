# Design calls of the viewer leftover-layer change

This file holds the design calls of [the plan](../viewer-leftover-layers.md).
The plan's pull request deletes this file with the plan.

My calls, on 2026-11-01:

1. The behaviour stays. Where the standalone and embedded paths differ, the
   merged path follows the protocol when it states the behaviour. An example
   is the outside click that closes the tag picker, in
   `docs/protocol/mokly-shell-design.md`: in both roots it closes the panel
   on a click anywhere outside it. Where the protocol is silent, the merged
   path keeps each root's current behaviour, and each such difference becomes
   a follow-up item.
2. The viewer keeps all its read-model checks, also the props-key hash check,
   because `mokly-viewer.md` requires them and the follow-up replaces them.
3. The split of the tree into the Specs and Components sections stays in the
   viewer, because `mokly-catalogue-tree.md` gives that job to the viewer.
   The old tree builder goes, because the index `tree` replaces its result.
4. `@mokly/viewer/data` keeps every export, because it is a public entry of a
   published package.
5. The shell README changes only where this change makes it stale. Its
   structure waits for the open decision in
   `plans/follow-ups/shell-readme-length.md`.
6. State that the viewer now writes into `@mokly/ui` markup becomes props and
   refs of the package components, in their own `ui` milestone, with no
   visual change.
7. Flat removed rows keep the order of `removedEntries`. The sort by kind
   and path in `shell/nav_tree.ts:138-150` breaks the sibling order of
   `docs/protocol/mokly-catalogue-serialization.md:8-12`, which puts a
   parent's variants directly after the parent. Removed pages and documents
   keep their order, which `plans/follow-ups/removed-page-row-order.md` holds.
8. The renewal `HEAD` request of a removed preview,
   `previews/request.ts:189`, also omits credentials and rejects another
   origin, so that every read-model request follows one rule.
9. Each public export of `packages/viewer/src/index.ts` keeps its name and
   its shape. `docs/guides/start/upgrade.md:123-129` tells hosts to import
   `ColorScheme`, `Viewport`, and `InsertedComponentStylesheet`. When a
   generated type has the same shape, the public name exports that type.
