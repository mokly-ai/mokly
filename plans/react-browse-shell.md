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

Retire (delete in Milestone 7, replaced by shell components, hooks, or the
store):

- Boot and navigation: `browse`, `browse_fetch`, `browse_links`,
  `browse_navigation`, `browse_navigation_state`, `browse_state`,
  `browse_recovery`, `browse_update_state`, `browse_controls`, `navigation`,
  `nav_resize`, `early_disclosures`, `static_delivery`, `preview_fragment`,
  `tag_filter`, `clipboard`.
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

Keep unchanged (transport, geometry, protocol; consumed through hooks):
`frame_adapter`, `frame_error`, `frame_mount`, `frame_usage`,
`message_transport`, `post_message_adapter`, `same_origin_adapter`,
`same_origin_access`, `same_origin_mount`, `same_origin_pointer`,
`same_origin_highlight`, `component_overlay`, `component_geometry`,
`component_occlusion`, `component_range_nodes`, `document_ranges`,
`catalogue_updates`.

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
Five viewer host modules that survive import deleted ones and must be
reworked in the same change: `ready.tsx` (layout, runtime), `server.tsx` (layout),
`public_stage.tsx` (frame_location), `highlight_request.ts` (frame_views),
and `inspection_scope.ts` (frame_session, frame_views). CLI composition
deleted in Milestone 7: `src/client/browse.ts`, `browser.ts`,
`live_updates.ts`, `browse_refresh.ts`, `control_transport.ts`,
`workspace_loading.ts`.

Unit tests that import any retired client, viewer host, or CLI composition
module are rewritten against the replacement components, hooks, or pure
helpers in Milestone 8. The set is produced by grepping `tests/` and
`packages/viewer/tests/` for imports of the retired module paths; the plan
records no count because the set changes as modules move.

## Milestone 1: Protocol and architecture documentation

Define the hydrated-shell contract completely before code, and withdraw every
statement that promises a React-free browser, except the inspector rule.

- [ ] Rewrite the viewer contract's React host and "SSR And Host Independence"
      sections in `docs/protocol/mokly-viewer.md`: one component tree rendered
      by `@mokly/viewer/server` and hydrated by the browser entry; slots are
      ordinary React children; the imperative handle and events are backed by
      shell state; source/adapter replacement remounts; no runtime-owned
      islands remain.
- [ ] Define the state model in the same contract: selection (screen, view,
      viewport, colour scheme, search, tags), disclosures, drawer, details,
      scroll restoration, and the reload-recovery snapshot, including what is
      URL-derived, what persists, and what survives a watched reload.
- [ ] Update `docs/protocol/mokly-runtime.md` Browse shell and progressive
      enhancement sections: SSR first paint with real anchors, hydration, the
      same route model, and the retained JavaScript-disabled behaviour (direct
      URLs, refresh, alias pages, native disclosure elements).
- [ ] Update `docs/protocol/mokly-navigation.md`, which owns progressive
      navigation, portable links, safe degradation, fragments, and the
      active-tree invariant: replace fetch-and-swap descriptions with
      read-model rendering while keeping every sandbox, link-marker, and
      outer-navigation rule.
- [ ] Update `docs/protocol/mokly-export-delivery.md` and
      `docs/protocol/mokly-export.md`: the browser inventory ships the hydrated
      shell bundle plus React; keep the inspector cap, comparison delivery,
      deployment identity, and static-page rules; state that module changes
      alter deployment identity as today.
- [ ] Update `docs/architecture/package-boundary.md` and
      `docs/architecture/build-pipeline.md`: remove "static SSR ships no React
      to browsers" and "no React, hydration or consumer runtime in exported
      browsers"; describe the new browser build (one hydration entry per
      delivery mode, React bundled for standalone delivery, host React for the
      React host) and keep the rule that consumer code never enters the
      browser.
- [ ] Confirm `docs/protocol/mokly-frame-adapter.md` stays unchanged: the
      inspector IIFE remains React-free and under its 9,216-byte budget. Record
      that exception explicitly in the viewer contract next to the withdrawn
      no-React rule.
- [ ] Grep `docs/`, `README.md`, and every crate/package README for statements
      about the vanilla runtime, framework-neutral enhancement, islands, or
      React-free browsers (known sites: the workspace `README.md`,
      `packages/viewer/README.md`, `src/client/README.md`,
      `packages/viewer/src/client/README.md`, and
      `packages/viewer/src/shell/README.md`); update each to describe the
      hydrated shell and the retained transport modules, and record any
      further sites the sweep finds.
- [ ] Record in `docs/protocol/mokly-shell-design.md` that the design is
      unchanged by this work and remains binding on the React implementation.
- [ ] Add this plan to `plans/README.md`; validate the changed Markdown.

## Milestone 2: Delivery, packaging, and the shell switch

Summary: make it possible to ship React and a hydration entry through Serve,
host mode, and export; replace the hard-coded module allowlist; and add the
development switch that selects the React shell. No shell component changes
yet; the vanilla runtime remains the default and keeps working.

- [ ] Replace the `loadBrowserClientModules` allowlist in
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
- [ ] Move `classifyFrameActivation` from `frame_navigation` into a kept
      transport module and repoint `same_origin_mount`. Delete the duplicate
      `HighlightFrame` interface in `component_highlight` and repoint every
      importer found by grepping `packages/viewer/src` and `src` (including
      retired modules that survive until Milestone 7) at the kept one in
      `same_origin_highlight`; no behaviour changes and typecheck stays green.
- [ ] Add `scripts/package/shell_partition.mjs` exporting the keep and retire
      arrays from the module inventory in this plan, and a partition check in
      `scripts/package/browser_graph.mjs` that fails when a keep module imports
      a retire module. Run it as part of the package check from Milestone 2
      onward; the plan's inventory references that file as the source of
      truth.
- [ ] Rewrite `scripts/package/browser_graph.mjs`: it currently forbids
      `react-dom`, `hydrateRoot`, `react.production`, and bare imports of
      `react` or `node:` in every delivered module, and requires each relative
      import to resolve inside the delivered inventory. Allow exactly the
      documented React runtime in the hydration bundle(s), keep the `node:`
      and bare-import bans for all other modules, and keep inventory-resolved
      relative imports.
- [ ] Extend `scripts/package-check.mjs`: it scans every built viewer file for
      `node:` and `@mokly/mokly` imports except three server files; add the
      hydration entry to that scan's expectations and keep the inspector
      budget check unchanged.
- [ ] Add the viewer browser entry that hydrates the shell (`hydrateRoot`)
      and its bundle with React for standalone Serve/export delivery; add a
      documented export subpath for it in `packages/viewer/package.json`
      alongside `.`, `./server`, `./runtime`, `./data`, and `./styles.css`;
      the React host path uses the host's React.
- [ ] Add the shell switch as a request-scoped, CLI-private selector: an
      optional field on `ShellContext` in `packages/viewer/src/shell/context.ts`,
      marked internal in its doc comment because that type is re-exported from
      `@mokly/viewer/server`. It is set from a private request header or
      cookie where `src/server/http_routes.ts` calls `shellContext` (it
      threads to `view_routes.ts` as a parameter), set from a CLI-private
      option where `src/export/site.ts` builds its context literal, and left
      unset by `viewerContext` in `packages/viewer/src/viewer/projection.ts`,
      the React host path. `src/server/pages.ts` consumes it. The field is
      removed with the switch in Milestone 7. One Serve process serves both shells, so the
      browser suite keeps a single web server and the shared review output
      directory under `examples/basic` has one owner. The switch is not
      documented for users and is deleted in Milestone 7.
- [ ] Add the switched browser run to `playwright.config.ts` as a second
      project against the same web server: its `use.extraHTTPHeaders` (or a
      storage-state cookie) sets the selector, and its `testMatch` names the
      spec files the hydrated shell must pass. Milestone 2 lists only a new
      hydrated-shell smoke spec; each later milestone adds its spec files to
      that list, and Milestone 7 replaces the list with the whole suite.
      `tests/browser/setup.ts` awaits the first project's base URL only; keep
      that, since both projects share it. Run the second project through the
      existing `npm run test:browser` invocation in `xtask/src/check.rs`, or
      add a project argument if isolation is needed.
- [ ] Add failing tests first: export inventory includes the hydration bundle
      when the switch is on and excludes it when off, served module paths
      resolve, the inspector bundle stays under its cap, and the
      packed-consumer smoke installs and serves both inventories.
- [ ] Run `cargo xtask check`; the default run and the switched run (only the
      smoke spec at this point) must both pass.

## Milestone 3: Shell state model and hydrated navigation

Tags: ui

Summary: build the live React tree for the core Browse surface behind the
switch. Route, selection, and preference state live in React; navigation
renders from the read model instead of fetching and swapping HTML. Nothing
vanilla is deleted.

- [ ] Introduce a shell store/context owning selection, disclosures, drawer,
      details, scroll positions, and the reload-recovery snapshot, with the
      URL as the source of route truth and history integration (push, replace,
      Back/Forward, scroll restoration). Move `search_query` and
      `entry_wording` beside it as pure helpers.
- [ ] Render top bar, navigation rail, filter, tag picker, breadcrumbs, stage
      head, viewport and colour-scheme controls, and the details inspector as
      stateful components; keep their markup, classes, roles, and ids so the
      shell CSS and the design contract apply unchanged.
- [ ] Implement route rendering from `CatalogueReadModel` for home, targets,
      missing routes, alias pages, and static delivery descriptors; keep real
      anchors and the `/id/<id>` redirect behaviour; port delivery adoption
      from `static_delivery` into the store.
- [ ] Hydrate in Serve and export with no hydration mismatches; add a test that
      renders every fixture route on the server and hydrates it under a DOM
      with React's mismatch warnings treated as failures.
- [ ] Preserve early native disclosure capture and preference persistence
      semantics (choices made before hydration win) and document the ordering.
- [ ] Preserve accessibility behaviour the specs assert: focus management on
      navigation, live-region announcements, keyboard handling in the tag
      picker and rail, reduced-motion, and the mobile drawer/bottom sheet.
- [ ] Add the Browse, history, navigation, security, tags, pages, static
      export, static deployment, phone chrome, and viewer selection/lifecycle
      spec files to the switched project's `testMatch`; fix regressions until
      they pass there. The default run stays green throughout.

## Milestone 4: Frames, comparisons, and stage in React

Tags: ui

Summary: bring the stage under React behind the switch while keeping frames
static. Frame mounting, expansion, labels, highlights, and in-place
comparisons become components and hooks over the unchanged frame adapters.

- [ ] Wrap the same-origin and postMessage adapters in hooks that own mount,
      dispose, usage updates, and event subscriptions with React lifecycle
      semantics (effect replay safe, strict-mode safe).
- [ ] Render screen, use-case step, and whole-document stages, device chrome,
      expand-to-overlay, frame readiness/error states, and frame labels as
      components; keep the script-disabled sandbox and byte-preserved frame
      documents.
- [ ] Reimplement in-place comparisons (side by side, overlay, difference,
      renewal/expiry, selected comparisons) as components over the existing
      comparison routes and immutable generation URLs.
- [ ] Keep in-frame logical link activation routing through the shell store;
      retain the sandbox and no top-navigation capability.
- [ ] Add the frame adapter, frame readiness/clipping/overlay, comparison,
      preview, review, and design-link spec files to the switched project's
      `testMatch`; fix regressions until they pass there. The default run
      stays green throughout.

## Milestone 5: Host capability context for live Serve

Summary: define and implement the CLI-to-shell capability boundary that
replaces DOM-injected services, before any workspace UI is ported. This is
host and CLI contract work, so it is untagged and contains no shell UI.

- [ ] Define a typed capability context in the viewer (update stream,
      reload-recovery snapshot, evidence revisions, temporary control
      previews, on-demand rendering), documented in the viewer contract;
      export supplies no capabilities.
- [ ] Implement the CLI's hydrated composition that provides that context
      alongside the existing `installViewerServices` path, reusing the
      unchanged private transports (`control_transport`, `live_updates`
      protocol, `browse_refresh` validation) without modifying them.
- [ ] Add unit tests for context provision, cancellation on source change,
      evidence-revision fencing, and export supplying nothing.

## Milestone 6: Component workspaces and inspection in React

Tags: ui

Summary: port the component explorer, evidence, controls, and inspection UI to
the React tree behind the switch, consuming the Milestone 5 context.

- [ ] Render component workspaces (variants, props, controls, evidence,
      usage links, inspector panels/tabs/resize) as components over the
      existing workspace data and control transport contracts.
- [ ] Reimplement inspection ownership, picking, highlight, scroll-to-instance,
      and geometry presentation as hooks over the unchanged inspector protocol;
      keep the `MoklyViewerHandle` and every documented event.
- [ ] Reimplement watched reload recovery and evidence refresh on the shell
      store through the capability context.
- [ ] Add the component, evidence, controls, inspector, workspace, viewer
      inspection/readiness/replacement/teardown, watch, and changes spec files
      to the switched project's `testMatch`; fix regressions until they pass
      there. The default run stays green throughout.

## Milestone 7: Flip and delete

Summary: make the React shell the only shell. Flip the default, delete the
vanilla runtime, the islands, the switch, and the old CLI composition in one
change. This is delivery, packaging, and CLI work, so it is untagged; the
public host component is rewritten in the next milestone.

- [ ] Flip Serve and export to the hydrated document; collapse the Playwright
      configuration back to one project running the whole suite; delete the
      switch and the selector header.
- [ ] Delete every module in the retire list, the viewer host island modules,
      the CLI composition modules, the `installViewerServices` seam, the
      `#markup-renderer` import map, and the client-side
      `react-dom/server.browser` dependency; the enumerated module delivery
      and export inventory update themselves, and the partition check is
      retired with the inventory it guarded.
- [ ] Keep `navigation-resize.js` delivered unchanged as the pre-hydration
      disclosure-capture script; Milestone 8 decides whether it folds into the
      shell.
- [ ] Add a temporary host adapter: `MoklyViewer` renders the hydrated shell
      tree through a minimal adapter that preserves its props, slots, handle,
      and events, and rework the five surviving viewer host modules named in
      the inventory so the package compiles without the deleted modules. Those
      reworks repoint imports only and change no rendered markup; the adapter
      is compatibility plumbing, not UI. The full rewrite is Milestone 8.
- [ ] Rerun the packed-consumer smoke and the published-package layout checks
      for both tarballs.
- [ ] Run `cargo xtask check` with the adapter in place, so the tree is green
      before the host rewrite starts.

## Milestone 8: React host rewrite and documentation sync

Tags: ui

Summary: finish the public React host on the new tree and bring
code-adjacent docs and tests into line with the implementation.

- [ ] Reimplement `MoklyViewer` on the shell tree: slots as ordinary children,
      controlled/uncontrolled selection, source/adapter replacement remount,
      handle methods, events, theming variables, and the scoped embedded
      stylesheet; remove the Milestone 7 adapter.
- [ ] Fold `navigation-resize.js` behaviour into the hydrated shell or keep it
      as a documented pre-hydration script; delete the standalone module if it
      is no longer needed.
- [ ] Rewrite every unit test that imports a retired module against the
      replacement components, hooks, or pure helpers; keep a 100% pass rate
      with no skipped tests.
- [ ] Re-run the design catalogue and shell design comparisons: the served
      shell must match the design mockups; record any intentional pixel
      differences and their reasons.
- [ ] Update the viewer package README, CLI READMEs, and protocol docs for any
      contract clarifications discovered during implementation; remove every
      remaining reference to the switch and the vanilla runtime.

## Milestone 9: Verification and delivery

Summary: complete branch work before review; the PR merge is the completion
boundary.

- [ ] Run the full unit, browser, example, package, and format/lint/type
      gates; run `cargo xtask check` and resolve every failure.
- [ ] Smoke-test manually: `npm run dev`, navigate, filter, pick tags, switch
      viewport and scheme, expand a frame, open a comparison, inspect a
      component instance, edit a control, trigger a watched reload; then
      export the example catalogue and repeat the same smoke on the exported
      site served statically.
- [ ] Inspect deletions against `origin/main` and record every removed module
      and its replacement in the commit and PR description.
- [ ] After checks pass, `git add -A`, commit with Conventional Commits and
      push the branch.
- [ ] After the push, use
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
