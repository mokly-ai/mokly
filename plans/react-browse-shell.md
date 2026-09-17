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
   suite (81 specs, 1,641 `expect` calls), not by byte or pixel identity of
   shell modules.
4. The `@firna/ui` question is out of scope. Nothing here adds a design-system
   dependency to the viewer; it only removes the architectural reason one could
   not be used later.
5. Build alongside, then flip. The React shell is built behind a development
   switch while the vanilla shell stays the default, so every milestone leaves
   Serve, export, the React host, and the full check gate working. The switch
   and the vanilla runtime are removed together in one atomic milestone.

## Retirement rules

These rules govern Milestones 3 to 7 and were added after review.

- A vanilla module is deleted only in Milestone 7, after the switch flips.
  Milestones 3 to 6 add React capability; they never delete or modify a
  vanilla module or the served allowlist.
- The React shell is exercised by running the browser suite with the switch on
  in addition to the default run. A milestone is complete when the specs it
  names pass in both runs.
- `src/server/client_modules.ts` is a hard-coded allowlist of 79 delivered
  filenames, including `browse_runtime.js` (the built name of `browse.ts`),
  and Serve throws before binding if any file is missing. The package graph
  check reads the same list. The allowlist is replaced by build-output
  enumeration in Milestone 2 so a later deletion cannot strand a stale entry.
- Every module under `packages/viewer/src/client` is classified in the
  inventory below. A module not listed there may not be deleted.

## Module inventory

Retire (delete in Milestone 7, replaced by shell components, hooks, or the
store):

- Boot and navigation: `browse`, `browse_fetch`, `browse_links`,
  `browse_navigation`, `browse_navigation_state`, `browse_state`,
  `browse_recovery`, `browse_update_state`, `browse_controls`, `navigation`,
  `nav_resize`, `early_disclosures`, `static_delivery`, `preview_fragment`,
  `tag_filter`, `clipboard`.
- Stage and comparisons: `browse_frames`, `browse_details`, `browse_evidence`,
  `frame_navigation`, `same_origin_navigation`, `diffs`, `diff_views`.
- Workspace and inspection UI: `workspace`, `workspace_events`,
  `workspace_evidence`, `workspace_evidence_data`, `workspace_inspection`,
  `workspace_preview`, `workspace_props`, `workspace_updates`,
  `workspace_variants`, `component_controls`, `control_fields`,
  `control_surface`, `control_view_key`, `inspector_panels`,
  `inspector_tabs`, `inspector_resize`, `component_highlight`,
  `component_overlay`, the presentation half of `same_origin_highlight`,
  `style_evidence`, `prop_display`, `services`.

Keep unchanged (transport, geometry, protocol; consumed through hooks):
`frame_adapter`, `frame_error`, `frame_mount`, `frame_usage`,
`message_transport`, `post_message_adapter`, `same_origin_adapter`,
`same_origin_access`, `same_origin_mount`, `same_origin_pointer`,
`same_origin_highlight` mask/observer lifecycle, `component_geometry`,
`component_occlusion`, `component_range_nodes`, `document_ranges`,
`catalogue_updates`.

Move (pure helpers that become shell or store modules): `search_query`,
`entry_wording`, and the delivery-adoption logic inside `static_delivery`.

Viewer host modules deleted in Milestone 7 with the islands: `layout.tsx`,
`markup.tsx`, `route_markup.tsx`, `runtime.tsx`, `scope.ts`, `slot_layout.ts`,
`input.ts`, `selection_dom.ts`, `frames.ts`, `frame_views.ts`,
`frame_session.ts`, `frame_highlights.ts`, `frame_labels.ts`,
`frame_location.ts`, and `standalone/navigation_resize.ts`. CLI composition
deleted in Milestone 7: `src/client/browse.ts`, `browser.ts`,
`live_updates.ts`, `browse_refresh.ts`, `control_transport.ts`,
`workspace_loading.ts`.

The 22 unit test files that import retired modules are rewritten against the
replacement components, hooks, or pure helpers in Milestone 7.

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

- [ ] Replace the served-module allowlist in `src/server/client_modules.ts`
      with enumeration of the viewer and CLI browser build outputs, keeping the
      existing delivery names (including `browse_runtime.js`), the
      export-excluded private modules (`browser.js`, `live_updates.js`), and
      the navigation-module set; add failing tests first for a missing file,
      an unexpected file, and unchanged delivery names.
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
- [ ] Add the shell switch: a CLI-private option read by `src/server/pages.ts`
      and `src/export/site.ts` that renders the hydrated document instead of
      the current one, plus a Playwright project or environment variable that
      runs the browser suite against it. Serve and export ignore the switch
      unless set; it is not documented for users and is deleted in
      Milestone 7.
- [ ] Add failing tests first: export inventory includes the hydration bundle
      when the switch is on and excludes it when off, served module paths
      resolve, the inspector bundle stays under its cap, and the
      packed-consumer smoke installs and serves both inventories.
- [ ] Run `cargo xtask check`; both the default and the switched browser runs
      must pass (the switched run renders an empty hydrated shell that only
      the smoke specs exercise at this point).

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
- [ ] Run the Browse, history, navigation, security, tags, pages, static
      export, static deployment, phone chrome, and viewer selection/lifecycle
      browser specs with the switch on; fix regressions until they pass. The
      default run stays green throughout.

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
- [ ] Run the frame adapter, frame readiness/clipping/overlay, comparison,
      preview, review, and design-link browser specs with the switch on; fix
      regressions until they pass. The default run stays green throughout.

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
- [ ] Run the component, evidence, controls, inspector, workspace, viewer
      inspection/readiness/replacement/teardown, watch, and changes browser
      specs with the switch on; fix regressions until they pass. The default
      run stays green throughout.

## Milestone 7: Flip, delete, and align the host API

Tags: ui

Summary: make the React shell the only shell. Flip the default, delete the
vanilla runtime, the islands, the switch, and the old CLI composition in one
change, and finish the public React host on the new tree.

- [ ] Reimplement `MoklyViewer` on the shell tree: slots as ordinary children,
      controlled/uncontrolled selection, source/adapter replacement remount,
      handle methods, events, theming variables, and the scoped embedded
      stylesheet.
- [ ] Flip Serve, export, and the Playwright configuration to the hydrated
      document and delete the switch.
- [ ] Delete every module in the retire list, the viewer host island modules,
      the CLI composition modules, the `installViewerServices` seam, the
      `#markup-renderer` import map, and the client-side
      `react-dom/server.browser` dependency; the enumerated module delivery
      and export inventory update themselves.
- [ ] Fold `navigation-resize.js` behaviour into the hydrated shell or keep it
      as a documented pre-hydration script; delete the standalone module if it
      is no longer needed.
- [ ] Rewrite the 22 unit test files that import retired modules against the
      replacement components, hooks, or pure helpers; keep a 100% pass rate
      with no skipped tests.
- [ ] Re-run the design catalogue and shell design comparisons: the served
      shell must match the design mockups; record any intentional pixel
      differences and their reasons.
- [ ] Update the viewer package README, CLI READMEs, and protocol docs for any
      contract clarifications discovered during implementation; remove every
      remaining reference to the switch and the vanilla runtime.
- [ ] Rerun the packed-consumer smoke and the published-package layout checks
      for both tarballs.

## Milestone 8: Verification and delivery

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
