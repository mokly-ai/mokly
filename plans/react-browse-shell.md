# React Browse Shell

Make Browse one hydrated React application. Today the shell TSX under
`packages/viewer/src/shell` is rendered to strings on the server, and a
separate vanilla runtime under `packages/viewer/src/client` owns every
interaction by mutating that markup: it fetches the next route's HTML, parses
it, swaps `innerHTML`, and flips attributes by hand. The React host
(`MoklyViewer`) wraps the same design: it stringifies islands with
`dangerouslySetInnerHTML`, never reconciles them, and boots the vanilla runtime
in an effect. No delivery mode runs React against the shell DOM.

After this change the shell components are the live tree. Serve, the React
host, and static export all render the same tree on the server for first paint
and hydrate it in the browser. Navigation, selection, viewport, colour scheme,
search, tags, disclosures, the details inspector, comparisons, and component
workspaces become React state driven by the catalogue read model that already
exists as public catalogue JSON. Exported catalogues ship React and hydrate;
the "no React in exported browsers" rule is withdrawn deliberately, so that
there is exactly one Browse implementation rather than a static shell and a
hydrated shell drifting apart.

What stays exactly as it is:

- Consumer mockups, committed fragments, comparison panes, and the review
  artifacts remain static HTML documents in script-disabled sandboxed iframes.
  Consumer code never runs in the browser.
- The frame adapters, the inspector script and its 9,216-byte cap, scoped
  instance keys, catalogue JSON, ownership/upload inventories, and the CLI's
  private Serve transports (update stream, controls, on-demand rendering) keep
  their contracts; they are consumed through hooks and context instead of
  injected DOM services.
- The visual design. No mockup changes: the shell design contract and the
  design catalogue under the basic example's `design/` routes stay the visual
  source of truth, and the rewrite must match them.

Decisions taken with the user before planning:

1. One shell, always hydrated: Serve, host mode, and export. An unhydrated
   SSR-only export stays possible later because first paint is still SSR, but
   it is not built now.
2. SSR stays real. First paint is the complete shell with real anchors so
   direct URLs, refresh, and JavaScript-disabled navigation keep working as the
   runtime contract requires.
3. Behavioural parity is the acceptance bar, proven by the existing browser
   suite under `tests/browser` (81 spec files), not by byte or pixel identity
   of shell modules.
4. The `@firna/ui` question is out of scope. Nothing here adds a design-system
   dependency to the viewer; it only removes the architectural reason one could
   not be used later.
5. Build alongside, then flip. The React shell is built behind a development
   switch while the vanilla shell stays the default, so every milestone leaves
   Serve, export, the React host, and the full check gate working. The switch
   and the vanilla runtime are removed together in one atomic milestone.

Mainline integration on 2026-09-18 preserves the work added between this
branch's source tip `1d0f0ab` and `origin/main` at `9bd6f20`: public saved-variant
selection, multi-instance highlights and host-owned markers, the updated
inspector divider, CLI reporting and packaged authoring guides. The
[marker contract](../docs/protocol/mokly-viewer-markers.md) remains binding on
the rewritten host. These features are not part of the retirement scope.

## Retirement rules

These rules govern Milestones 2 to 7 and were added after review.

- A vanilla module is deleted only in Milestone 7, after the switch flips.
  Milestones 3 to 6 add React capability; they never delete or modify a
  vanilla module or the served allowlist.
- The React shell is exercised by running the browser suite with the switch on
  in addition to the default run. A milestone is complete when the specs it
  names pass in both runs.
- `loadBrowserClientModules` in `src/server/client_modules.ts` is a
  hard-coded allowlist of delivered filenames, including `browse_runtime.js`
  (the built name of `browse.ts`), and Serve throws before binding if any
  file is missing. The package graph check reads the same list. The allowlist
  is replaced by build-output enumeration in Milestone 2 so a later deletion
  cannot strand a stale entry.
- Every module under `packages/viewer/src/client` is classified in the
  inventory below. A module not listed there may not be deleted.
- A kept module must never import a retired module. Milestone 2 adds a check
  that derives the partition from the real import graph and fails when it is
  crossed, so the inventory cannot drift silently.
- Counts in this plan are illustrative. Where a number matters, the plan
  names the symbol, file, or command that produces it.

## Module inventory

During the parallel implementation, the machine-readable keep, retire, and
move sets lived in `scripts/package/shell_partition.mjs`. Milestone 7 removes
that temporary inventory with the retired implementation. The final browser
graph check validates the delivered inventory and every relative import;
the lists below remain the record of the approved ownership changes.

Retire (delete in Milestone 7, replaced by shell components, hooks, or the
store):

- Boot and navigation: `browse`, `browse_fetch`, `browse_links`,
  `browse_navigation`, `browse_navigation_state`, `browse_state`,
  `browse_recovery`, `browse_update_state`, `browse_controls`, `navigation`,
  `static_delivery`, `preview_fragment`, `tag_filter`, `clipboard`.
- Stage and comparisons: `browse_frames`, `browse_details`, `browse_evidence`,
  `frame_navigation` (except `classifyFrameActivation`, which moves),
  `same_origin_navigation`, `diffs`, `diff_views`.
- Workspace and inspection UI: `workspace`, `workspace_events`,
  `workspace_evidence`, `workspace_evidence_data`, `workspace_inspection`,
  `workspace_preview`, `workspace_props`, `workspace_updates`,
  `workspace_variants`, `component_controls`, `control_fields`,
  `control_surface`, `control_view_key`, `inspector_panels`,
  `inspector_tabs`, `inspector_resize`, `component_highlight` (its duplicate
  `HighlightFrame` interface is deleted in Milestone 2), `style_evidence`,
  `prop_display`, `services`.

Keep (transport, geometry, protocol; consumed through hooks):
`frame_adapter`, `frame_error`, `frame_mount`, `frame_usage`,
`host_capability_descriptor`, `host_capabilities`,
`message_transport`, `post_message_adapter`, `same_origin_adapter`,
`same_origin_access`, `same_origin_mount`, `same_origin_pointer`,
`same_origin_highlight`, `component_overlay`, `component_geometry`,
`component_occlusion`, `component_range_nodes`, `document_ranges`,
`catalogue_updates`.

The public frame and inspector contracts remain unchanged. The retained
`frame_mount` and `same_origin_adapter` modules also provide a private adapter
for authenticated temporary control previews. Its URL validation confines the
mount to one live render bundle, and its range authentication retains the full
temporary path; the public same-origin adapter still accepts only static views.

Retained standalone pre-hydration ownership:
`standalone/early_disclosures`, `standalone/nav_resize`, and
`standalone/navigation_resize`. The latter is the delivered
`navigation-resize.js` entry. The former compatibility modules named
`client/early_disclosures` and `client/nav_resize` are deleted; their remaining
callers import the standalone owners directly. `client/browse_navigation`
remains in the retire set for the vanilla shell, but the retained entry imports
none of it. The package check reads source imports, including type-only,
import-type, and side-effect imports, for both the client partition and these
retained modules.

`same_origin_highlight` is kept whole. It exports `installLocalHighlight`,
which owns the overlay mask, labels, observers, and teardown in one closure,
so there is no seam to split, and its own `HighlightFrame` interface. It stays
the imperative same-origin mask driven by a hook; `component_overlay` is its
SVG factory and is kept with it. Two kept modules currently import retired
ones: `same_origin_mount` imports the pure `classifyFrameActivation` from
`frame_navigation`, and `same_origin_adapter` imports a duplicate
`HighlightFrame` from `component_highlight` that is structurally identical to
the kept one. Milestone 2 moves the function into a kept transport module,
deletes the duplicate interface, and repoints every importer of it (found by
grep, not by list; today that includes `workspace_preview` and
`component_highlight`'s own signature) at the kept one, before the partition
check lands.

Move (pure helpers that become shell, store, or kept transport modules):
`search_query`, `entry_wording`, the delivery-adoption logic inside
`static_delivery`, and `classifyFrameActivation` from `frame_navigation`.

Viewer host modules deleted in Milestone 7 with the islands: `layout.tsx`,
`markup.tsx`, `route_markup.tsx`, `runtime.tsx`, `scope.ts`, `slot_layout.ts`,
`input.ts`, `selection_dom.ts`, `frames.ts`, `frame_views.ts`,
`frame_session.ts`, `frame_highlights.ts`, `frame_labels.ts`,
and `frame_location.ts`. `packages/viewer/src/standalone/navigation_resize.ts`
is not deleted in Milestone 7; it stays the pre-hydration disclosure-capture
script emitted by `shell/document.tsx`, and Milestone 8 decides its future.
Viewer host entrypoints `ready.tsx`, `server.tsx`, and `public_stage.tsx` are
reworked to use the shared shell. Four supporting modules also move into its
ownership rather than retaining wrappers around removed sessions:

| Removed viewer module  | Replacement owner                                                     |
| ---------------------- | --------------------------------------------------------------------- |
| `geometry_refresh.ts`  | `shell/frame_geometry.ts` and `shell/frame_geometry_controller.ts`    |
| `highlight_request.ts` | `shell/frame_instances.ts` and `shell/frame_inspection_controller.ts` |
| `inspection_scope.ts`  | Inspection claims and captured sessions in those same shell modules   |
| `markers.ts`           | `shell/frame_markers.ts` and `shell/frame_marker_layer.tsx`           |

Their public behaviors remain required, including geometry coalescing, trailing
refresh, cancellation, exact instance scope, and marker status. The removed
`packages/viewer/tests/frame_session.test.ts` is replaced by React lifecycle
coverage in `tests/browser/frame_hook_lifecycle.spec.ts` and the frame registry
and readiness tests. CLI composition
deleted in Milestone 7: `src/client/browse.ts`, `browser.ts`,
`live_updates.ts`, `browse_refresh.ts`, `control_transport.ts`,
`workspace_loading.ts`.

Unit tests that import any retired client, viewer host, or CLI composition
module are rewritten against the replacement components, hooks, or pure
helpers in Milestone 7, alongside retirement. The set is produced by grepping `tests/` and
`packages/viewer/tests/` for imports of the retired module paths; the plan
records no count because the set changes as modules move.

## Milestone 1: Protocol and architecture documentation — completed

Define the hydrated-shell contract completely before code, and withdraw every
statement that promises a React-free browser, except the inspector rule.

- [x] Rewrite the viewer contract's React host and "SSR And Host Independence"
      sections in `docs/protocol/mokly-viewer.md`: one component tree rendered
      by `@mokly/viewer/server` and hydrated by the browser entry; slots are
      ordinary React children; the imperative handle and events are backed by
      shell state; source/adapter replacement remounts; no runtime-owned
      islands remain.
- [x] Define the state model in the same contract: selection (screen, view,
      viewport, colour scheme, search, tags), disclosures, drawer, details,
      scroll restoration, and the reload-recovery snapshot, including what is
      URL-derived, what persists, and what survives a watched reload.
- [x] Update `docs/protocol/mokly-runtime.md` Browse shell and progressive
      enhancement sections: SSR first paint with real anchors, hydration, the
      same route model, and the retained JavaScript-disabled behaviour (direct
      URLs, refresh, alias pages, native disclosure elements).
- [x] Update `docs/protocol/mokly-navigation.md`, which owns progressive
      navigation, portable links, safe degradation, fragments, and the
      active-tree invariant: replace fetch-and-swap descriptions with
      read-model rendering while keeping every sandbox, link-marker, and
      outer-navigation rule.
- [x] Update `docs/protocol/mokly-export-delivery.md` and
      `docs/protocol/mokly-export.md`: the browser inventory ships the hydrated
      shell bundle plus React; keep the inspector cap, comparison delivery,
      deployment identity, and static-page rules; state that module changes
      alter deployment identity as today.
- [x] Update `docs/architecture/package-boundary.md` and
      `docs/architecture/build-pipeline.md`: remove "static SSR ships no React
      to browsers" and "no React, hydration or consumer runtime in exported
      browsers"; describe the new browser build (one hydration entry per
      delivery mode, React bundled for standalone delivery, host React for the
      React host) and keep the rule that consumer code never enters the
      browser.
- [x] Confirm `docs/protocol/mokly-frame-adapter.md` stays unchanged: the
      inspector IIFE remains React-free and under its 9,216-byte budget. Record
      that exception explicitly in the viewer contract next to the withdrawn
      no-React rule.
- [x] Grep `docs/`, `README.md`, and every crate/package README for statements
      about the vanilla runtime, framework-neutral enhancement, islands, or
      React-free browsers (known sites: the workspace `README.md`,
      `packages/viewer/README.md`, `src/client/README.md`,
      `packages/viewer/src/client/README.md`, and
      `packages/viewer/src/shell/README.md`); update each to describe the
      hydrated shell and the retained transport modules, and record any
      further sites the sweep finds. The sweep also found and updated
      `docs/protocol/mokly-live-evidence.md` (navigation wording); the
      `mokly-component-manifest.md` "no React values" sentence and the
      `mokly-package.md` non-goal about hydrating product fragments concern
      consumer data and frames, not the shell, and are unchanged.
- [x] Exit criterion: grep `docs/protocol`, `docs/architecture`, `README.md`
      and every package/crate README for `progressive`, `vanilla`,
      `islands`, `no React` and `enhancement runtime`; every remaining hit
      must be either the inspector exception, a consumer-data statement, a
      frame-link "parent enhancement" rule, or an explicit "until the flip"
      status note. Added after the Milestone 1 review found one missed hunk.
- [x] Record in `docs/protocol/mokly-shell-design.md` that the design is
      unchanged by this work and remains binding on the React implementation.
- [x] Add this plan to `plans/README.md`; validate the changed Markdown.

## Milestone 2: Delivery, packaging, and the shell switch

Summary: make it possible to ship React and a hydration entry through Serve,
host mode, and export; replace the hard-coded module allowlist; and add the
development switch that selects the React shell. No shell component changes
yet; the vanilla runtime remains the default and keeps working.

- [x] Replace the `loadBrowserClientModules` allowlist in
      `src/server/client_modules.ts` with directory enumeration of the two
      browser build outputs, `packages/viewer/dist/browser` and the CLI's
      `dist/browser`, which contain exactly the delivered `.js` files today;
      keep the existing delivery names (including `browse_runtime.js`) and the
      export exclusions in `src/export/site.ts` (`browser.js`,
      `live_updates.js`). Leave `loadBrowserNavigationModules` as a list: it
      reads `packages/viewer/dist/navigation`, which is TypeScript output
      holding declarations, source maps, and the server-only
      `reserved_attributes.js`, and every navigation module is in the keep set
      so it carries no retirement risk. Add failing tests first for a missing
      file, an unexpected file, and unchanged delivery names.
- [x] Move `classifyFrameActivation` from `frame_navigation` into a kept
      transport module and repoint `same_origin_mount`. Delete the duplicate
      `HighlightFrame` interface in `component_highlight` and repoint every
      importer found by grepping `packages/viewer/src` and `src` (including
      retired modules that survive until Milestone 7) at the kept one in
      `same_origin_highlight`; no behaviour changes and typecheck stays green.
- [x] Add `scripts/package/shell_partition.mjs` exporting the keep and retire
      arrays from the module inventory in this plan, and a partition check in
      `scripts/package/browser_graph.mjs` that fails when a keep module imports
      a retire module. Run it as part of the package check from Milestone 2
      onward; the plan's inventory references that file as the source of
      truth.
- [x] Rewrite `scripts/package/browser_graph.mjs`: it currently forbids
      `react-dom`, `hydrateRoot`, `react.production`, and bare imports of
      `react` or `node:` in every delivered module, and requires each relative
      import to resolve inside the delivered inventory. Allow exactly the
      documented React runtime in the hydration bundle(s), keep the `node:`
      and bare-import bans for all other modules, and keep inventory-resolved
      relative imports.
- [x] Extend `scripts/package-check.mjs`: it scans every built viewer file for
      `node:` and `@mokly/mokly` imports except three server files; add the
      hydration entry to that scan's expectations and keep the inspector
      budget check unchanged.
- [x] Add the viewer browser entry that hydrates the shell (`hydrateRoot`)
      and its bundle with React for standalone Serve/export delivery; add a
      documented export subpath for it in `packages/viewer/package.json`
      alongside `.`, `./server`, `./runtime`, `./data`, and `./styles.css`;
      the React host path uses the host's React.
- [x] Keep static hydration on the finalized deployment identity by adopting
      the authenticated root delivery descriptor over the staged inline
      bootstrap identity, without mutating the hashed bootstrap snapshot.
- [x] Keep the switched standalone document console-clean by declaring an
      embedded inert favicon instead of allowing the browser to request an
      unavailable `/favicon.ico` resource.
- [x] Add the shell switch as a request-scoped, CLI-private selector: an
      optional field on `ShellContext` in
      `packages/viewer/src/shell/context.ts`, marked internal in its doc
      comment because that type is re-exported from
      `@mokly/viewer/server`. It is set from a private request header or
      cookie where `src/server/http_routes.ts` calls `shellContext` (it
      threads to `view_routes.ts` as a parameter), set from a CLI-private
      option where `src/export/site.ts` builds its context literal, and left
      unset by `viewerContext` in `packages/viewer/src/viewer/projection.ts`,
      the React host path. `src/server/pages.ts` consumes it. The field is
      removed with the switch in Milestone 7. One Serve process serves both
      shells, so the browser suite keeps a single web server and the shared
      review output directory under `examples/basic` has one owner. The
      switch is not
      documented for users and is deleted in Milestone 7.
- [x] Add the switched browser run to `playwright.config.ts` as a second
      project against the same web server: its `use.extraHTTPHeaders` (or a
      storage-state cookie) sets the selector, and its `testMatch` names the
      spec files the hydrated shell must pass. Milestone 2 lists only a new
      hydrated-shell smoke spec; each later milestone adds its spec files to
      that list, and Milestone 7 replaces the list with the whole suite.
      `tests/browser/setup.ts` awaits the first project's base URL only; keep
      that, since both projects share it. Run the second project through the
      existing `npm run test:browser` invocation in `xtask/src/check.rs`, or
      add a project argument if isolation is needed.
- [x] Add failing tests first: export inventory includes the hydration bundle
      when the switch is on and excludes it when off, served module paths
      resolve, the inspector bundle stays under its cap, and the
      packed-consumer smoke installs and serves both inventories.
- [x] Run `cargo xtask check`; the default run and the switched run (only the
      smoke spec at this point) must both pass.
- [x] Resolve current and removed catalogue routes through one shared helper
      with current-entry precedence, and cover removed and renamed entries in
      switched Serve and switched export regressions.
- [x] Make pre-hydration disclosure and resize handoff hydration-safe, encode
      bootstrap JSON canonically with byte-identical validation round trips,
      and cover desktop, persisted width, mobile, early disclosure, and
      finalized-export hydration with development React warnings enabled.
- [x] Keep finalized comparison and workspace markup hydratable by cloning
      current React-owned frame chrome on demand instead of hydrating
      parser-owned template contents or exposing duplicate hidden controls, and
      use canonical JSON for embedded workspace data.
- [x] Generate browser delivery manifests from the completed viewer and CLI
      build outputs, validate manifest/directory equality before Serve binds
      and during package checks, and cover a missing listed file.
- [x] Move retained disclosure capture and navigation resizing into standalone
      ownership, record that ownership in the partition inventory, and check
      source imports (including type-only and side-effect imports) as well as
      delivered JavaScript edges.
- [x] Thread the Playwright project shell selection through every browser
      export fixture and assert each served fixture's shell marker.
- [x] Preserve the automatic `@mokly/viewer/browser` side effect in package
      metadata and prove a packed consumer's side-effect-only esbuild bundle
      retains `hydrateRoot`.
- [x] Hash historical route baselines from canonical JSON and hydrate removed
      and renamed routes from a finalized export under development React.
- [x] Make the source partition check inspect TypeScript import-type nodes and
      reject real keep-to-retire crossings in every supported import form.
- [x] Delete the standalone compatibility re-export shims, repoint their
      remaining importers to the standalone owners, and update partition and
      browser-delivery inventories without renaming `navigation-resize.js`.
- [x] Commit the fix round without rewriting history, using real paragraph
      breaks, a title no longer than 50 characters, and the required
      `Co-Authored-By` trailer, then push the branch.

## Milestone 3: Shell state model and hydrated navigation

Tags: ui

Summary: build the live React tree for the core Browse surface behind the
switch. Route, selection, and preference state live in React; navigation
renders from the read model instead of fetching and swapping HTML. Nothing
vanilla is deleted.

- [x] Introduce a shell store/context owning selection, disclosures, drawer,
      details, scroll positions, and the reload-recovery snapshot, with the
      URL as the source of route truth and history integration (push, replace,
      Back/Forward, scroll restoration). Move `search_query` and
      `entry_wording` beside it as pure helpers.
- [x] Render top bar, navigation rail, filter, tag picker, breadcrumbs, stage
      head, viewport and colour-scheme controls, and the details inspector as
      stateful components; keep their markup, classes, roles, and ids so the
      shell CSS and the design contract apply unchanged.
- [x] Implement route rendering from `CatalogueReadModel` for home, targets,
      missing routes, alias pages, and static delivery descriptors; keep real
      anchors and the `/id/<id>` redirect behaviour; port delivery adoption
      from `static_delivery` into the store.
- [x] Hydrate in Serve and export with no hydration mismatches; add a test that
      renders every fixture route on the server and hydrates it under a DOM
      with React's mismatch warnings treated as failures.
- [x] Preserve early native disclosure capture and preference persistence
      semantics (choices made before hydration win) and document the ordering.
- [x] Preserve accessibility behaviour the specs assert: focus management on
      navigation, live-region announcements, keyboard handling in the tag
      picker and rail, reduced-motion, and the mobile drawer/bottom sheet.
- [x] Add the Browse, history, navigation, security, tags, pages, static
      export, static deployment, phone chrome, and viewer selection/lifecycle
      spec files to the switched project's `testMatch`; fix regressions until
      they pass there. The default run stays green throughout.

## Milestone 3A: Hydrated state and history corrections

Tags: ui

Summary: correct the verified state-adoption and async navigation defects found
after Milestone 3 without reopening its completed implementation milestone.

- [x] Keep sequential search input lossless while deriving typed tag filters.
- [x] Adopt direct and alias URL variants/fragments on the first hydrated
      render and scroll query-only route changes back to the active catalogue
      row.
- [x] Apply state precedence in chronological order: stored preferences,
      reload recovery, then native interactions captured before hydration;
      promote the active route ancestry in disclosures and the filter baseline.
- [x] Put clicks, Back, Forward, and variant changes through one cancellable
      static-deployment validation gate so an obsolete result cannot install
      history or replace the current document.
- [x] Keep early native Details and navigation disclosure choices
      hydration-safe both with and without stored preferences.
- [x] Replace the vanilla-only expectation that a persisted collapse may hide
      the active route after reload: the native choice wins the pending
      hydration, then reload re-establishes the active-ancestor invariant.
- [x] Preserve a component frame's selected colour scheme when a viewport
      change recreates the visible frame set.
- [x] Keep the same-document Back branch proving that it cancels a pending
      navigation rather than only asserting the resulting URL.
- [x] Split `react_shell_hydration.spec.ts` below the 300-line hard limit
      without weakening its development-React warning assertions.
- [x] Run the focused pure-state, development-hydration, Serve-state, and
      finalized-static regression suites with every assertion passing.

## Milestone 4: Frames, comparisons, and stage in React

Tags: ui

Summary: bring the stage under React behind the switch while keeping frames
static. Frame mounting, expansion, labels, highlights, and in-place
comparisons become components and hooks over the unchanged frame adapters.

- [x] Wrap the same-origin and postMessage adapters in hooks that own mount,
      dispose, usage updates, and event subscriptions with React lifecycle
      semantics (effect replay safe, strict-mode safe).
- [x] Preserve cancellation through pending usage updates and geometry reads:
      unmount rejects readiness, newer evidence supersedes unresolved reads,
      and late success or failure cannot change replacement inspection.
- [x] Render screen, use-case step, and whole-document stages, device chrome,
      expand-to-overlay, frame readiness/error states, and frame labels as
      components; keep the script-disabled sandbox and byte-preserved frame
      documents.
- [x] Reimplement in-place comparisons (side by side, overlay, difference,
      renewal/expiry, selected comparisons) as components over the existing
      comparison routes and immutable generation URLs.
- [x] Keep in-frame logical link activation routing through the shell store;
      retain the sandbox and no top-navigation capability.
- [x] Authenticate same-origin frame resources across the exported host's
      `.html`-to-extensionless normalization, apply validated fragments only
      after resource authentication, and renew document-scoped ownership on
      reload.
- [x] During build-alongside, add the frame adapter, frame
      readiness/clipping/overlay, comparison, preview, review, and design-link
      spec files to the switched project's `testMatch`; after the flip, keep
      them passing in the single project. The dual-project `testMatch` was
      vanilla-only scaffolding and is removed with the switch in Milestone 7.

## Milestone 5: Host capability context for live Serve

Summary: define and implement the CLI-to-shell capability boundary that
replaces DOM-injected services, before any workspace UI is ported. This is
host and CLI contract work, so it is untagged and contains no shell UI.

- [x] Define a typed capability context in the viewer (update stream,
      reload-recovery snapshot, evidence revisions, temporary control
      previews, on-demand rendering), documented in the viewer contract;
      export supplies no capabilities.
- [x] Implement the CLI's hydrated composition that provides that context
      alongside the existing `installViewerServices` path, reusing the
      unchanged private transports (`control_transport`, `live_updates`
      protocol, `browse_refresh` validation) without modifying them.
- [x] Add unit tests for context provision, cancellation on source change,
      evidence-revision fencing, and export supplying nothing.
- [x] Load route evidence after same-shell navigation as an atomic public
      bootstrap/private workspace pair, fenced by route, monotonic source
      revisions, render capability and cancellation; accept newer evidence
      when the update version is unchanged.

## Milestone 6: Component workspaces and inspection in React

Tags: ui

Summary: keep the completed hydration correction isolated from the backend
capability gap discovered while porting component workspaces.

- [x] Keep stored disclosure handoff hydration-safe when a preference closes
      the active route ancestry: promote the active path in both the DOM and
      first React state, preserve newer native choices, and pass the
      development-hydration and watched reload/reparenting regressions.

## Milestone 6A: Independent render and on-demand generations

Summary: separate the temporary renderer identity from on-demand document
availability so a compiled v5 catalogue can expose controls while retaining
its complete eager Usage evidence.

- [x] Give the private live capability source independent render and on-demand
      generation identities, validate both at the host boundary, and preserve
      eager workspace Usage whenever no on-demand document service exists.
- [x] Add a server regression for a compiled v5 component runtime without a
      document service: the React route returns successfully, binds the
      renderer generation, retains eager Usage, and invents no preview
      generation.

## Milestone 6B: Component workspace continuation

Tags: ui

Summary: resume the component explorer, evidence, controls, and inspection UI
on the React tree after Milestone 6A supplies the corrected host contract.

- [x] Render component workspaces (variants, props, controls, evidence,
      usage links, inspector panels/tabs/resize) as components over the
      existing workspace data and control transport contracts.
- [x] Reimplement inspection ownership, picking, highlight, scroll-to-instance,
      and geometry presentation as hooks over the unchanged inspector protocol;
      keep the `MoklyViewerHandle`, including atomic `highlightInstances`, and
      every documented event. Preserve the mainline marker/label geometry
      scheduler's coalescing, trailing refresh and cancellation guarantees.
- [x] Reimplement watched reload recovery and evidence refresh on the shell
      store through the capability context.
- [x] Reject an empty required or newly supplied optional select control
      instead of silently rendering its first option; keep both cases under a
      focused regression and the live controls check.
- [x] Open Props when an instance selection first resolves, then preserve that
      selection without overriding a later Details tab choice or explicit
      inspector close.
- [x] Bound component workspace state and pending temporary renders to the
      routed entry so navigation between components with identical variants
      cannot carry drafts or obsolete results into the destination.
- [x] Give each visible viewport and colour-scheme context its own temporary
      render queue identity so rendering both previews cannot cancel one of
      the pair.
- [x] Hydrate a live component route with development React without a markup
      mismatch, keeping controls read-only through the hydration render before
      enabling the host-backed editor.
- [x] During build-alongside, add the component, evidence, controls, inspector,
      workspace, viewer inspection/readiness/replacement/teardown, watch, and
      changes spec files to the switched project's `testMatch`; after the flip,
      keep them passing in the single project. The dual-project `testMatch` was
      vanilla-only scaffolding and is removed with the switch in Milestone 7.

## Milestone 7: Flip and delete

Summary: make the React shell the only shell. Flip the default, delete the
vanilla runtime, the islands, the switch, and the old CLI composition in one
change. This is delivery, packaging, and CLI work, so it is untagged; the
public host component is rewritten in the next milestone.

- [x] Adopt a routed page's public catalogue, private workspace and source
      revision atomically, including newer evidence with an unchanged watch
      version; reject mismatched pairs and preserve live comparison availability.
- [x] Flip Serve and export to the hydrated document; collapse the Playwright
      configuration back to one project running the whole suite; delete the
      switch and the selector header.
- [x] Preserve supplied Changes evidence in the public projection when live
      Changes updates are disabled, while continuing to omit unknown live
      states from static capture.
- [x] Keep Serve self-contained, but replace the repeated catalogue embedded in
      every exported page with one deployment-fenced `__mokly/catalogue.json`;
      retain complete SSR when that shared read model cannot be validated.
- [x] Load matching route evidence during static in-shell navigation so
      Affected, related components, input changes and stylesheet evidence
      remain consistent with direct loads; reject obsolete or mismatched
      destination data without replacing the React tree.
- [x] Profile and correct the full design-catalogue export timeout, retaining
      its SSR/hydration contract and the existing export acceptance limit;
      share the identical ordinary publication build between the design-link
      and navigation browser specs instead of rebuilding it inside the second
      setup deadline.
- [x] Delete every module in the retire list, the viewer host island modules,
      the CLI composition modules, the `installViewerServices` seam, the
      `#markup-renderer` import map, and the client-side
      `react-dom/server.browser` dependency; the enumerated module delivery
      and export inventory update themselves, and the partition check is
      retired with the inventory it guarded.
- [x] Rewrite every unit test and test helper that imports a retired module
      against its replacement component, hook, or pure helper as part of that
      module's retirement; preserve every behavior assertion, add no skips,
      and keep a 100% pass rate so `cargo xtask check` can pass in this
      milestone.
- [x] Retain the complete native shell-link eligibility matrix and denied
      browser-storage behavior through tests of the production decision helper
      and hydrated Details interactions.
- [x] Keep `navigation-resize.js` delivered unchanged as the pre-hydration
      disclosure-capture script; Milestone 8 decides whether it folds into the
      shell.
- [x] Add a temporary host adapter: `MoklyViewer` renders the hydrated shell
      tree through a minimal adapter that preserves its props, slots, markers,
      handle and events, and rework the surviving viewer host modules named in
      the inventory so the package compiles without the deleted modules. Those
      reworks repoint imports only and change no rendered markup; the adapter
      is compatibility plumbing, not UI. The full rewrite is Milestone 8.
- [x] Rerun the packed-consumer smoke and the published-package layout checks
      for both tarballs.
- [x] Run `cargo xtask check` on the integrated delivery and completed host
      rewrite. Mainline integration and the final host replace the temporary
      adapter on this branch before that complete gate is recorded.

## Milestone 8: React host rewrite and documentation sync

Tags: ui

Summary: finish the public React host on the new tree and bring
code-adjacent docs and tests into line with the implementation.

- [x] Reimplement `MoklyViewer` on the shell tree: slots as ordinary children,
      controlled/uncontrolled selection, source/adapter replacement remount,
      saved-variant selection, handle methods including multi-instance
      highlighting, host-owned marker content and status events, theming
      variables, and the scoped embedded stylesheet; remove the Milestone 7
      adapter. Keep the mainline variant, multi-highlight and marker browser
      regressions passing for independent mounts and lifecycle changes.
- [x] Restore embedded root sizing and containment, preview-only host overlay
      bounds and independent inspector resizing under the shared shell layout.
- [x] Preserve public selection and comparison error reporting, Escape pick
      cancellation, viewport/scheme replacement cancellation, and complete
      frame cleanup even when a host callback throws.
- [x] Keep standalone and embedded search lossless through the shared action
      boundary, with sequential input tests for spaces and typed tag terms.
- [x] Preserve exact saved-variant and repeated-flow inspection scope, atomic
      multi-highlight labels, and marker errors across geometry refreshes; keep
      the existing adapter and lifecycle assertions intact.
- [x] Preserve replacement inspection requests and current picks when obsolete
      geometry or label work settles, exclude unavailable sibling views from
      scoped requests, and drain every mounted frame after callback failures.
- [x] Exercise retained-evidence restoration through the production host bridge,
      removing test-only restoration logic; preserve valid picks and scoped
      highlights across ready revisions and invalidate only affected work.
- [x] Keep a valid existing highlight when a replacement request fails input
      validation, while clearing a current presentation that fails after its
      activation has begun.
- [x] Preserve active inspection through slot, marker and callback updates that
      retain the same source and adapter; keep automatic ready-frame events
      independent of explicit highlight scope and preserve idle highlights
      when another ready instance is clicked.
- [x] Mark only the first flow step as the logical fragment target, with
      separate assertions for rendered iframe attributes and bootstrap data.
- [x] Keep nested-instance disclosure on the Components panel while explicit
      instance selection opens Props; preserve highlighting and library
      navigation through both actions.
- [x] Fold `navigation-resize.js` behaviour into the hydrated shell or keep it
      as a documented pre-hydration script; delete the standalone module if it
      is no longer needed.
- [x] Re-run the design catalogue and shell design comparisons: the served
      shell must match the design mockups; record any intentional pixel
      differences and their reasons.
- [x] Update the viewer package README, CLI READMEs, and protocol docs for any
      contract clarifications discovered during implementation; remove every
      remaining reference to the switch and the vanilla runtime.

## Milestone 9: Verification and delivery

Summary: complete branch work before review; the PR merge is the completion
boundary.

- [x] Run the full unit, browser, example, package, and format/lint/type
      gates; run `cargo xtask check` and resolve every failure.
- [x] Assert marker measurement failures through their complete ordered state
      event so a permitted later geometry refresh cannot hide the failed
      generation; repeat the same-origin and postMessage cases 20 times each.
- [ ] Smoke-test manually: `npm run dev`, navigate, filter, pick tags, switch
      viewport and scheme, expand a frame, open a comparison, inspect a
      component instance, edit a control, trigger a watched reload; then
      export the example catalogue and repeat the same smoke on the exported
      site served statically.
- [x] Inspect deletions against `origin/main` and record every removed module
      and its replacement in the commit and PR description.
- [x] After checks pass, `git add -A`, commit with Conventional Commits and
      push the branch.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

## Milestone 10: Embedded hydration correction

Tags: ui

Summary: resolve the post-push review finding so application-owned React hosts
hydrate public viewer SSR in place before enabling browser-only behavior.

- [x] Add a browser regression that renders `renderViewer()`, hydrates the
      result with `MoklyViewer`, captures recoverable/page/console errors, and
      proves the existing shell and preview frame nodes remain mounted.
- [x] Give embedded SSR and the first browser hydration render the same
      noninteractive snapshot, then enable the existing host bridge and frame
      lifecycle without delaying ordinary client-only mounts.
- [x] Fence superseded same-origin loads during redirected published scheme
      swaps without losing canonical `src` attributes or the mounted session.
- [x] Run the focused viewer unit and browser coverage, then the complete
      `cargo xtask check` gate with no failures or skips.
- [x] After checks pass, `git add -A`, commit with Conventional Commits, and
      push the branch.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

## Milestone 11: Independent SSR viewer identifiers

Tags: ui

Summary: resolve the post-push accessibility finding where separate server
renders restart React's local ID sequence and can collide when composed into
one host document.

- [x] Define the required stable `viewerId` contract in the viewer protocol,
      package README and workspace README: IDs are validated, unique within a
      document and identical across a server render and its hydration render.
- [x] Add a failing server regression for two independent `renderViewer()`
      calls and a browser regression that hydrates both roots in place, proving
      package-owned IDs and their fragment/ARIA references remain root-local
      without hydration errors.
- [x] Replace the implicit root-local React ID prefix with the validated
      host-supplied viewer ID in both `renderViewer()` and `MoklyViewer`; update
      package consumers, fixtures and smoke checks to supply stable IDs.
- [x] Run the viewer build, typecheck and focused server/hydration tests, then
      run the complete `cargo xtask check` gate with no failures or skips.
- [x] After checks pass, `git add -A`, commit with Conventional Commits, and
      push the branch.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

## Milestone 12: Prefix-free viewer namespaces

Tags: ui

Summary: resolve the Milestone 11 review finding so distinct valid viewer IDs
cannot concatenate with dynamic package-owned IDs into the same DOM identifier.

- [x] Clarify in the viewer protocol and package README that namespace encoding
      preserves the boundary between the host viewer ID and every package-owned
      local ID; generated DOM ID bytes remain internal.
- [x] Add a failing server regression using two distinct allowed viewer IDs and
      an aligned component prop key; cover the same adversarial roots through
      browser hydration without weakening the existing ID/reference checks.
- [x] Make the centralized viewer prefix structurally unambiguous while keeping
      server and client rendering deterministic from the same `viewerId`.
- [x] Run the viewer build, typecheck and focused server/hydration tests, then
      run the complete `cargo xtask check` gate with no failures or skips.
- [x] After checks pass, `git add -A`, commit with Conventional Commits, and
      push the branch.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

## Milestone 13: Atomic frame navigation handoff

Tags: ui

Summary: keep hydrated Browse ownership of logical links continuous while a
same-origin frame is mounting or replacing its document.

- [x] Add a deterministic browser regression that holds a replacement frame
      request open, activates a valid native logical link in the still-visible
      document, and proves the parent shell navigates exactly once.
- [x] Give the React frame session an event sink before adapter navigation
      starts, and let the same-origin adapter intercept authenticated logical
      activations in the visible document throughout the mount handoff without
      changing native behavior after unsubscribe.
- [x] Clarify the adapter lifecycle in the navigation protocol and viewer
      package README, including the distinction between enhanced ownership and
      the portable unhydrated fallback.
- [x] Run the focused viewer build, typecheck and browser regressions, then run
      the complete `cargo xtask check` gate with no failures or skips.
- [x] After checks pass, `git add -A`, commit with Conventional Commits, and
      push the branch.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

## Milestone 14: Deterministic frame navigation CI

Tags: ui

Summary: separate the ready-frame link-shape matrix from the initial hydration
handoff contract so CI exercises each lifecycle state deterministically.

- [x] Add a deterministic browser regression that delays a replacement
      document's subresource after commit and proves a logical activation in
      that pre-`load` document reaches the parent shell exactly once.
- [x] Make the broad desktop, area, SVG, flow and legacy link-shape matrix wait
      for each target frame's owned ready state; keep loading-state ownership
      asserted independently by the held-response regressions.
- [x] Move the mount-time receiver onto an exact authenticated replacement
      document before delayed subresources allow interaction ahead of the
      iframe `load` event.
- [x] Clarify the pre-load document adoption contract in the frame-adapter and
      navigation protocols and the viewer package README.
- [x] Run the focused viewer build, typecheck and repeated browser regressions,
      then run the complete `cargo xtask check` gate with no failures or skips.
- [x] After checks pass, `git add -A`, commit with Conventional Commits, and
      push the branch.
- [x] After the push, use
      [the implementation review prompt](../docs/implementation-review-prompt.md)
      to review the complete local diff against `origin/main`; report
      numbered, severity-rated findings with options and recommendations
      without changing the implementation.

## Post-merge follow-up (non-blocking)

- Publish the viewer and CLI versions containing the hydrated shell; consumers
  redeploy exports to pick up the new browser inventory.
- Decide whether an SSR-only, unhydrated export mode is wanted; the first-paint
  SSR path makes it a delivery option rather than an architecture change.
- Revisit shared UI primitives for the shell (for example `@firna/ui`
  subpath imports) now that the shell is a live React tree; that is a separate
  plan and a separate dependency decision.

## Review record

The plan-only commit `a3c9ef6` was reviewed with the implementation review
prompt against `origin/main`. Seven findings were verified and applied in this
revision: cross-milestone module retirement (now build-alongside with a single
atomic deletion), the hard-coded served allowlist (now enumerated in
Milestone 2), the omitted navigation protocol, the targetless frame-adapter
TODO (now an explicit inspector exception), milestone tagging (host capability
work split into an untagged milestone; the flip milestone tagged), the missing
export subpath and package-check scan, and the unclassified modules (now a
complete inventory).

The revised plan (`7717577`) was reviewed again. Eight findings were verified
and applied: kept modules importing retired symbols (two symbols now move in
Milestone 4 and a partition check guards the boundary), the incoherent
`same_origin_highlight` split (now kept whole with `component_overlay`), the
stale allowlist count and unreproducible test count (replaced by symbol and
command references), the unspecified switched browser run (now a second
Playwright web server and project with a per-milestone `testMatch` list and a
check-gate step), the UI-tagged flip milestone (split into an untagged flip
and a tagged host rewrite), the doc sweep list (left open-ended), and the
retirement-rule scope line.

The second revision (`75188d7`) was reviewed a third time. Six findings and
one residual note were verified and applied: the `HighlightFrame` move was
wrong because the kept module already exports an identical interface (the
duplicate is now deleted and the adapter repointed), the symbol moves left a
UI-tagged milestone for the untagged Milestone 2, the host adapter and the
navigation-resize fold gained explicit TODOs in the right milestones, the
switched run now shares one Serve through a request-scoped selector because
a second server would leave setup unawaited and contend on the review output
directory, the partition check gained a machine-readable source file, the
`expect` tally was dropped, and the five surviving viewer host modules that
import deleted ones are named.

The third revision (`aff5872`) was reviewed a fourth time. Five findings were
verified and applied: the duplicate `HighlightFrame` delete had a third
importer (every importer is now found by grep), the standalone
navigation-resize script was both kept and listed for deletion with a wrong
path, the navigation-module loader was described as enumerating when it is a
second hard-coded list (both are now enumerated), the selector was pointed at
a context construction site that does not exist (it is now a `ShellContext`
field set once), and the Milestone 7 host-module reworks are constrained to
import repoints with no markup change.

The fourth revision (`b389e93`) was reviewed a fifth time. Two findings were
verified and applied: enumerating the navigation loader would have shipped
TypeScript output and a server-only module to browsers (that list is now
kept, with the reason), and the selector field on the publicly re-exported
`ShellContext` is now optional, marked internal, and named at all three
construction sites. This closes the pre-implementation review rounds; the
implementation review in Milestone 9 runs against the complete branch.

Milestone 1 (`c596278`) was reviewed with the implementation review prompt.
Five findings were reported; the four wording findings were applied: a stale
"progressive navigation" sentence in export delivery (the term sweep above
was added as an exit criterion and also caught two more in the runtime
contract and the workspace README), a preserved navigation rule that had
changed meaning under React (now stated as "must not change the rendered
route"), the `./runtime` entry described as already shipping hydration (now
"after the flip"), and the reload snapshot omitting the optional Changes
status. The fifth, the viewer contract growing to 381 lines, is noted for a
later split once the store exists in code.

Milestone 11 (`960ee22`) was reviewed with the implementation review prompt
after the full gate and push. One medium finding remains for user decision:
plain delimiter concatenation does not make valid `viewerId` prefixes
structurally disjoint from dynamic package-owned control IDs. Distinct allowed
viewer IDs can therefore still produce one duplicate DOM ID for a deliberately
aligned component prop key. The recommended follow-up is a length-prefixed or
otherwise unambiguous namespace encoding plus an adversarial two-root
regression; no review finding was applied automatically.

Milestone 12 (`7730ea8`) was reviewed with the implementation review prompt
after the full gate and push. No findings remain. The residual compatibility
risk is limited to host code that depended on the exact bytes of undocumented
package-owned DOM IDs; the supported SSR, hydration, accessibility-reference,
and multi-root contracts are covered by the adversarial regressions.

Milestone 13 (`ca66e2a`) was reviewed with the implementation review prompt
after the full gate and push. One medium finding remains for user decision: the
same-origin adapter installs its provisional navigation receiver on any
accessible current iframe document before that document passes the expected
resource check. An unowned same-origin document can therefore emit a valid
logical marker during the replacement window, despite the protocol promising
that unsupported and unowned documents gain no privilege. The recommended
follow-up is to transfer only an authenticated document identity from the prior
mount (while accepting an initial document only when it matches the requested
resource), plus an adversarial browser regression; no review finding was
applied automatically.

Milestone 14 (`1f64ff7`) was reviewed with the implementation review prompt
after the full gate and push. The CI-specific changes introduced no new
findings. The complete-diff review reconfirmed the unresolved medium finding
from Milestone 13: authentication now protects the newly committed replacement
document, but the provisional receiver still accepts an arbitrary accessible
current same-origin document. The authenticated prior-document identity and
adversarial regression remain the recommended follow-up; no review finding was
applied automatically.
