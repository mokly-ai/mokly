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
- The frame adapters, the inspector script and its byte cap, scoped instance
  keys, catalogue JSON, ownership/upload inventories, and the CLI's private
  Serve transports (update stream, controls, on-demand rendering) keep their
  contracts; they are consumed through hooks and context instead of injected
  DOM services.
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
   suite (about 1,000 behavioural assertions across 81 specs), not by byte or
   pixel identity of shell modules.
4. The `@firna/ui` question is out of scope. Nothing here adds a design-system
   dependency to the viewer; it only removes the architectural reason one could
   not be used later.

## Milestone 1: Protocol and architecture documentation

Define the hydrated-shell contract completely before code, and withdraw every
statement that promises a React-free browser.

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
- [ ] Update `docs/protocol/mokly-export-delivery.md` and
      `docs/protocol/mokly-export.md`: the browser inventory ships the hydrated
      shell bundle plus React; keep the inspector cap, comparison delivery,
      deployment identity, and static-page rules; state that module changes
      alter deployment identity as today.
- [ ] Update `docs/architecture/package-boundary.md` and
      `docs/architecture/build-pipeline.md`: remove "static SSR ships no React
      to browsers" and "no React, hydration or consumer runtime in exported
      browsers"; describe the new browser build (one hydration entry per
      delivery mode, React bundled or shared) and keep the rule that consumer
      code never enters the browser.
- [ ] Update `docs/protocol/mokly-frame-adapter.md` only where it names the
      vanilla runtime as the caller; adapter behaviour is unchanged.
- [ ] Update the workspace `README.md`, `packages/viewer/README.md`,
      `src/client/README.md`, `packages/viewer/src/client/README.md`, and
      `packages/viewer/src/shell/README.md` to describe the hydrated shell and
      the retained transport modules.
- [ ] Record in `docs/protocol/mokly-shell-design.md` that the design is
      unchanged by this work and remains binding on the React implementation.
- [ ] Add this plan to `plans/README.md`; validate the changed Markdown.

## Milestone 2: Browser build and delivery for a hydrated shell

Summary: make it possible to ship React and a hydration entry through Serve,
host mode, and export, with package checks that enforce the new rules, before
any shell component changes. The vanilla runtime keeps working throughout.

- [ ] Replace the package browser-graph check that forbids `react`,
      `react-dom`, and `hydrateRoot` in browser modules with rules that allow
      exactly the documented React runtime and still forbid Node built-ins,
      bare imports outside the allowlist, and consumer code.
- [ ] Add a viewer browser entry that hydrates the shell (`hydrateRoot`) and
      bundle it with React for standalone Serve/export delivery; keep the React
      host path using the host's React.
- [ ] Extend the CLI's served client-module allowlist and the export browser
      inventory with the new bundle(s); remove nothing yet.
- [ ] Add failing tests first: export inventory includes the hydration bundle,
      served module paths resolve, the inspector bundle stays under its cap,
      and the packed-consumer smoke installs and serves the new inventory.
- [ ] Verify the standalone document can load the hydration bundle alongside
      the current vanilla modules without either throwing; no behaviour change
      yet.

## Milestone 3: Shell state model and hydrated navigation

Tags: ui

Summary: turn the shell into a live React tree for the core Browse surface.
Route, selection, and preference state move into React; navigation renders
from the read model instead of fetching and swapping HTML. The vanilla
navigation, state, recovery, and preference modules are retired once the
browser specs they cover pass against the React shell.

- [ ] Introduce a shell store/context owning selection, disclosures, drawer,
      details, scroll positions, and the reload-recovery snapshot, with the
      URL as the source of route truth and history integration (push, replace,
      Back/Forward, scroll restoration).
- [ ] Render top bar, navigation rail, filter, tag picker, breadcrumbs, stage
      head, viewport and colour-scheme controls, and the details inspector as
      stateful components; keep their markup, classes, roles, and ids so the
      shell CSS and the design contract apply unchanged.
- [ ] Implement route rendering from `CatalogueReadModel` for home, targets,
      missing routes, alias pages, and static delivery descriptors; keep real
      anchors and the `/id/<id>` redirect behaviour.
- [ ] Hydrate in Serve and export with no hydration mismatches; add a test that
      renders every fixture route on the server and hydrates it under a DOM
      with React's mismatch warnings treated as failures.
- [ ] Preserve early native disclosure capture and preference persistence
      semantics (choices made before hydration win) and document the ordering.
- [ ] Preserve accessibility behaviour the specs assert: focus management on
      navigation, live-region announcements, keyboard handling in the tag
      picker and rail, reduced-motion, and the mobile drawer/bottom sheet.
- [ ] Retire `browse.ts`, `browse_navigation*.ts`, `browse_state.ts`,
      `browse_recovery.ts`, `browse_controls.ts`, `browse_links.ts`,
      `browse_details.ts`, `browse_fetch.ts`, `navigation.ts`,
      `nav_resize.ts`, `tag_filter.ts`, and `early_disclosures.ts` from the
      viewer client, and their CLI composition in `src/client/browse.ts`; move
      any pure helpers they contain (search query parsing, entry wording,
      static delivery adoption) beside their new callers.
- [ ] Run the Browse, history, navigation, security, tags, pages, static
      export, static deployment, phone chrome, and viewer selection/lifecycle
      browser specs; fix regressions until they pass unchanged.

## Milestone 4: Frames, comparisons, and stage in React

Tags: ui

Summary: bring the stage under React while keeping frames static. Frame
mounting, expansion, labels, highlights, and in-place comparisons become
components and hooks over the unchanged frame adapters.

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
- [ ] Retire `browse_frames.ts`, `frame_navigation.ts`, `diffs.ts`,
      `diff_views.ts`, and `preview_fragment.ts` from the viewer client and
      the corresponding viewer host modules (`frames.ts`, `frame_views.ts`,
      `frame_session.ts`, `frame_highlights.ts`, `frame_labels.ts`,
      `frame_location.ts`) once their behaviour lives in components.
- [ ] Run the frame adapter, frame readiness/clipping/overlay, comparison,
      preview, review, and design-link browser specs; fix regressions until
      they pass unchanged.

## Milestone 5: Component workspaces, inspection, and live Serve in React

Tags: ui

Summary: move the component explorer, evidence, controls, inspection, and the
CLI's private live capabilities into the React tree. The CLI supplies its
private transports through context instead of DOM-injected services.

- [ ] Render component workspaces (variants, props, controls, evidence,
      usage links, inspector panels/tabs/resize) as components over the
      existing workspace data and control transport contracts.
- [ ] Reimplement inspection ownership, picking, highlight, scroll-to-instance,
      and geometry presentation as hooks over the unchanged inspector protocol;
      keep the `MoklyViewerHandle` and every documented event.
- [ ] Replace `installViewerServices` with a typed React context the CLI host
      provides for the update stream, reload recovery, evidence revisions,
      temporary control previews, and on-demand rendering; export supplies no
      capabilities.
- [ ] Reimplement watched reload recovery and evidence refresh in the CLI's
      client composition on top of the shell store, replacing
      `browser.ts`, `live_updates.ts`, `browse_refresh.ts`,
      `control_transport.ts`, and `workspace_loading.ts` with hydrated
      equivalents.
- [ ] Retire the remaining vanilla UI modules (`workspace*.ts`,
      `component_controls.ts`, `component_overlay.ts`,
      `component_highlight.ts`, `control_surface.ts`, `control_fields.ts`,
      `inspector_panels.ts`, `inspector_tabs.ts`, `inspector_resize.ts`,
      `same_origin_highlight.ts` presentation parts) while keeping the
      transport/geometry modules (`frame_adapter.ts`,
      `message_transport.ts`, `post_message_adapter.ts`,
      `same_origin_*` transport, `component_geometry.ts`,
      `component_occlusion.ts`, `component_range_nodes.ts`,
      `document_ranges.ts`, `catalogue_updates.ts`, `frame_usage.ts`).
- [ ] Run the component, evidence, controls, inspector, workspace, viewer
      inspection/readiness/replacement/teardown, watch, and changes browser
      specs; fix regressions until they pass unchanged.

## Milestone 6: Host API alignment, cleanup, and documentation sync

Summary: finish the public React host on the new tree, delete the old
island/runtime machinery, and bring code-adjacent docs into line with the
implementation.

- [ ] Reimplement `MoklyViewer` on the shell tree: slots as ordinary children,
      controlled/uncontrolled selection, source/adapter replacement remount,
      handle methods, events, theming variables, and the scoped embedded
      stylesheet; delete `layout.tsx` islands, `markup.tsx`,
      `route_markup.tsx`, `runtime.tsx`, `scope.ts`, and `slot_layout.ts`.
- [ ] Remove the `#markup-renderer` import map and the client-side
      `react-dom/server.browser` dependency from the browser graph.
- [ ] Rebuild the standalone `navigation-resize.js` behaviour as part of the
      hydrated shell or as a documented pre-hydration script; remove the
      standalone module if it is no longer needed.
- [ ] Update every unit test that imported retired client modules (about 30
      files) to test the replacement components, hooks, or pure helpers; keep
      100% pass rate with no skipped tests.
- [ ] Re-run the design catalogue and shell design comparisons: the served
      shell must match the design mockups; record any intentional pixel
      differences and their reasons.
- [ ] Update the viewer package README, CLI READMEs, and protocol docs for any
      contract clarifications discovered during implementation.
- [ ] Rerun the packed-consumer smoke and the published-package layout checks
      for both tarballs.

## Milestone 7: Verification and delivery

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
