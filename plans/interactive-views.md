# Interactive Views

Status: Active. Implementation is complete, including the reference example,
Static/Live parity and static-output regression coverage. Serve Rebuild Status
Milestone 4 closes final review finding 1. Milestone 11 fixes finding 3
(forwarded catalogue origins, option A). Milestone 12 integrates main's path
identity and Markdown contracts. Its post-push review records five open
findings below, including the four earlier findings from this plan and Serve
Rebuild Status. No review fixes are applied. Close this plan when its PR merges.

## Summary

Let a Serve user switch the current screen or component preview between
Static and Live. Static is today's script-free HTML frame. Live runs the same
React tree in the browser so buttons respond, menus open and local state works.
Comparisons, Changes, `check`, export and publication keep using static HTML
bytes exactly as today; the browser bundle is never material.

Motivation recorded by the user: registered components are the app's real
components, so previews should be able to behave like the app. A catalogue
that wants to stay purely static must be able to turn the JavaScript bundling
off entirely.

Decisions:

- The feature is a typed config choice, `interactive: "off" | "serve"`.
  `off` is the default: no browser bundle is built, no second origin opens,
  and no toggle appears. `serve` enables Live in local Serve only. Export and
  publication never bundle consumer JavaScript in this plan; a later plan may
  add an `export` value.
- Live documents run on a separate loopback origin (a second Serve listener)
  and are mounted through the existing cross-origin frame adapter in
  `packages/viewer/src/client/post_message_adapter.ts`. Opaque-origin frames
  stay rejected; the frame adapter's origin checks are reused, not relaxed.
- Live documents paint the static document produced by the ordinary build path,
  then mount a fresh React root on `document.body` inside `flushSync`. The mount
  replaces static children and sentinels while retaining body attributes. An
  uncaught error unmounts and restores the original static child nodes; a
  pre-mount failure leaves them untouched. Each reports one Serve diagnostic.
- Live links resolve portable hrefs from an unbounded id-to-href route table.
  Unmodified primary activation emits a validated logical-identity DOM event;
  the inspector keeps its existing wire protocol and the host remains the
  catalogue-navigation authority. Modified and middle activation stays native.
- Component inspection (highlight, pick, boundary geometry) and editable
  controls stay on the Static frame in this plan. Live frames subscribe to
  navigation only, which the frame adapter already supports for pending or
  unavailable usage. Live inspection and live controls are follow-up plans.
- Naming: product copy says Static and Live. Code, config and docs say
  `interactive` because `live` already names the last-good routing runtime in
  `src/build/live_runtime.ts` and live evidence in Changes.

Protocol entry point: [interactive views](../docs/protocol/mokly-interactive-views.md),
with focused contracts for the
[Live runtime](../docs/protocol/mokly-interactive-views-runtime.md),
[Serve delivery](../docs/protocol/mokly-interactive-views-serve.md), and
[shell](../docs/protocol/mokly-interactive-views-shell.md). Related contracts:
[runtime](../docs/protocol/mokly-runtime.md),
[rendering](../docs/protocol/mokly-rendering.md),
[frame adapter](../docs/protocol/mokly-frame-adapter.md),
[configuration](../docs/protocol/mokly-configuration.md),
[authoring](../docs/protocol/mokly-authoring.md),
[component controls](../docs/protocol/mokly-component-controls.md),
[export](../docs/protocol/mokly-export.md).

## Milestone 1: Define the interactive-view contract — completed

Documentation only. Every later milestone implements this contract.

- [x] Create `docs/protocol/mokly-interactive-views.md` (about 250 lines)
      covering: the `interactive` option and its `off` default; the optional
      per-entry `interactive: false` opt-out on `defineScreen`,
      `defineComponent` and nested `screen` markers; which views offer Live
      (screen fragments and component saved variants) and which never do
      (pages, use-case steps, comparison panes, transient control previews);
      the Live document composition (the ordinary static document for the
      view plus one module script and the inspector script in `<head>`, and
      one JSON bootstrap element naming entry, variant, viewport, scheme and
      the resolved route table); the mount contract (static bytes paint first,
      then sentinels and static children are replaced by one synchronous fresh
      mount with render-error diagnostics); the browser runtime's `MockLink`
      behaviour (resolved relative href from the route table, `asChild`
      children keep their element and emit navigation through the inspector
      transport); the material rule (the bundle, its bootstrap and the second
      origin never enter `mockupsDir`, the manifest, Changes, `check`,
      derived baselines, export or publication); and explicit failure states
      (bundle failed, Node-only import in the graph, live origin unavailable,
      Live render failure, entry opted out).
- [x] Define the interactive origin: a second HTTP listener bound to loopback,
      default port `serve port + 1` advancing past occupied ports unless
      `--strict-port`, overridable with `--interactive-port <port>`; the
      routes it serves (`/static/**.html` as Live documents, `/static/**`
      public assets through the confined reader, the generation-scoped
      bundle path under `/__mokly/interactive/`, the inspector script) and
      the routes it refuses (shell, controls, review, upload); loopback Host
      validation matching the controls rule; a `frame-ancestors` policy
      naming the app origin; `no-store` on documents and bundles; and the
      `--interactive-origin <origin>` override for forwarded environments
      where the browser reaches the second listener through a different
      host name, with the shell otherwise deriving the origin from its own
      host name and the announced port.
- [x] Define the browser bundle: the same consumer graph and module
      resolution as `src/build/load_graph.ts` built with esbuild
      `platform: "browser"`, `format: "esm"`, React and React DOM resolved
      from the consumer, built lazily per catalogue generation on the first
      Live request, cached in memory, retained for the previous generation
      while frames unload, and rebuilt after watched source changes. Node
      built-ins or Node-only consumer modules fail the bundle with a typed
      diagnostic that names the importing module; Static stays available.
- [x] Define the optional renderer export `interactive(input): ReactNode` in
      `mokly-rendering.md`, with `InteractiveRenderInput` as the pure subset
      of `RenderInput` (`entry`, `variantId`, `componentProps`, `node`,
      `viewport`, `colorScheme`). When absent, the runtime mounts `node`
      directly, which matches the default renderer. Document that the
      consumer keeps `render` and `interactive` structurally equivalent and
      that head-injected server styles (for example collected React Native
      Web styles) remain in the static head without a duplicate Live injection.
- [x] Update `mokly-runtime.md` so "Browse frames are sandboxed without
      script permission" becomes "Static frames are sandboxed without script
      permission; Live frames use the cross-origin frame-adapter policy on the
      interactive origin". Update `mokly-frame-adapter.md` so local Serve may
      adopt the cross-origin policy for Live frames only, and record that Live
      mounts supply pending usage and therefore subscribe to navigation only.
- [x] Keep the packaged guides under `docs/guides` unchanged until the
      implementing milestones, because they describe shipped behavior only.
- [x] Update `mokly-configuration.md` (option, default, CLI flags, rejection
      of unknown values and of `interactive` under export), `mokly-authoring.md`
      (per-entry opt-out grammar), `mokly-component-controls.md` (controls and
      inspection remain Static-only; the Live toggle is disabled while edits
      exist, or edits are discarded on switch; pick one and state it),
      `mokly-export.md` and `mokly-package.md` (exports still contain no
      React; `interactive` is ignored by export and check), `mokly-watch.md`
      (bundle invalidation on rebuild), and `mokly-timings.md` (bundle timing).
- [x] Create `docs/protocol/mokly-interactive-views-design.md` describing the
      approved mockup scope for Milestone 2: the Static/Live segmented control
      in the view toolbar after viewport, the preparing state, the
      unavailable state, the inspector's Static-only notice, and the hidden
      toggle when the catalogue or entry is not interactive.
- [x] Add both docs to `docs/protocol/README.md`; update the README's
      components and Serve sections; link this plan from `plans/README.md`
      under Active.
- [x] Validate Markdown with `npm run format:check`, check local link targets,
      review the diff, commit and push.

## Milestone 2: Design the Static/Live views — completed

Tags: mockup

Add the approved states to the design catalogue under
`examples/basic/entries/design`, reusing the existing shell, view toolbar,
artboard and inspector parts. Both mobile and desktop variants for each screen;
at most five screens per page, split into nested pages if needed.

- [x] Add a screen-spec page for interactive views with: the view toolbar
      showing Static selected; Live selected with the same artboard; the
      preparing state while the bundle builds; the unavailable state with
      Static still selectable; and the component workspace in Live with the
      Props/Controls tab showing its Static-only notice.
- [x] Extend the existing browse and component workspace mockups so the
      toggle appears in their toolbars, and add the no-toggle variant for a
      static-only catalogue, keeping all copy free of implementation detail.
- [x] Reach the new page from the design navigation and from the component
      workspace page; keep screens as standalone components so flows can
      reuse them.
- [x] Add the control to the registered `design-ui-view-controls` component
      rather than a new control family: optional `previewMode`,
      `previewModeDisabled` and `previewModeDestinations` props, a `live`
      highlight reason, a saved `live` example, and exclusive sizing and
      disabled-segment rules in its owned stylesheet.
- [x] Record the preview mode per artboard in `navigation_states.ts` so a
      screen that has not been designed for Live cannot acquire the control
      implicitly, and document the transition table in the design contract.
- [x] Extend the design suites for the six screens: ids and routes in both
      viewports, segment labels and selected states, the disabled Live segment
      and its description, the preparing copy inside both device frames, the
      inspector notice and disabled highlighting, the absent control on the
      static-only screen, and the control's absence everywhere else.
- [x] Run `npm run build`, `npm run example:build`, `npm run example:check`,
      smoke the pages through `npm run dev`, commit and push.

## Milestone 3: Browser bundle and mount runtime — completed

Backend. After this milestone a Live document can be built and mounted in a
test browser, with no server or UI changes yet.

- [x] Add `interactive` to `src/config/types.ts`, `validate.ts` and
      `define.ts` as a typed value with `off` default; reject unknown strings;
      add `--interactive-port` and `--interactive-origin` to
      `src/cli/arguments.ts` and `help.ts`, valid only for `serve`.
- [x] Update the packaged guide `docs/guides/authoring/config.md` with the
      `interactive` row and the renderer's optional `interactive` export.
- [x] Add per-entry `interactive?: false` to screen and component
      definitions in `src/authoring`, validated like `tags`, and carry it into
      the catalogue index so the shell can hide the toggle.
- [x] Add `src/interactive/bundle.ts` behind an `InteractiveBundler` trait:
      esbuild browser build of the consumer graph plus a package-owned entry,
      reusing `consumer_resolution.ts`, keyed by generation, with a typed
      diagnostic for Node-only imports.
- [x] Add the browser runtime under `src/interactive/runtime/`: read the
      bootstrap element, look up the entry and variant in the bundled
      registry, build the node for the view (component views call the
      registered render adapter with the saved variant props), wrap it with
      the renderer's `interactive` export when present, and mount fresh on
      `document.body` inside `flushSync`, with caught/uncaught render errors
      reported through an injectable reporter and to Serve's documented path;
      leave static bytes untouched on pre-mount failure and restore the retained
      static child nodes after an uncaught root error.
- [x] Add an interactive component scope in `src/components/render_context.ts`
      so `renderInstance` in `wrapper.tsx` validates props but records nothing
      and renders no sentinels; make the Review-ignore sentinels in
      `src/authoring/review_ignore.tsx` render nothing in that scope.
- [x] Add the browser `MockLink` behaviour: resolved href from the bootstrap
      route table, `asChild` children unchanged with a click handler that
      emits a validated logical-identity event through the inspector transport;
      cover native, child-control and delegated raw `mock:` activation without
      the static metadata map's 1,024-link cap.
- [x] Add `src/interactive/document.ts`: compose the Live document from the
      ordinary compiled static document by inserting the bootstrap element and
      the two head scripts, without touching the body bytes.
- [x] Export `InteractiveRenderInput` from the package; add the `interactive`
      export to the default renderer's types.
- [x] Tests: bundle succeeds for the example graph and fails with the typed
      diagnostic for a fixture importing `node:fs`; document composition keeps
      body bytes identical; a Playwright test loads a Live document from a
      temporary static server and verifies a stateful control responds after
      mount and that no render error was reported; render-error and pre-mount
      fixtures retain or restore static content and report once; cover every
      eligibility reason, more than 1,024 routes, and compacted opt-outs.
- [x] Add `src/interactive/README.md`; update `src/components/README.md` and
      `src/renderer/README.md` if present.
- [x] Run `npm run format:check`, `npm run lint`, `npm run typecheck`,
      `npm test`, `npm run test:browser`, `npm run example:check` and the
      workspace `cargo xtask check` command; commit and push.

## Milestone 4: Interactive origin in Serve — completed

Backend. After this milestone Serve announces the interactive origin and serves
Live documents, but the shell still shows Static only.

- [x] Add `src/interactive/server.ts` behind an `InteractiveServer` trait:
      bind the second loopback listener through `src/server/ports.ts`, serve
      the routes defined in Milestone 1 using the confined public file reader,
      apply the loopback Host rule from `src/server/controls/http.ts`, set
      `frame-ancestors`, `no-store` and `nosniff`, and refuse every other
      path with 404.
- [x] Wire it into `src/server/serve.ts`, `http.ts` and the watched child
      lifecycle: open only when `interactive` is `serve`, announce the origin
      and port in the catalogue bootstrap and Serve's startup line, close it
      with the main server, and invalidate the bundle cache on each catalogue
      generation.
- [x] Build the bundle lazily on the first Live document request per
      generation, coalescing concurrent requests, and return a typed 503 body
      the shell can present as the unavailable state while a build is in
      progress or after it failed; log the diagnostic to stderr.
- [x] Add the private interactive descriptor with the resolved port, optional
      explicit origin, exact generation, and `idle | building | ready | failed`
      state; add its validated SSE updates and the app-origin preparation POST
      so the shell can learn readiness without reading a cross-origin response.
- [x] Record bundle build time in `src/diagnostics/timings.ts` output.
- [x] Update the packaged CLI guides `docs/guides/cli/serve.md` and
      `docs/guides/cli/options-and-exit-status.md` with `--interactive-port`
      and `--interactive-origin` once they exist.
- [x] Tests: origin opens only when configured; forwarded and non-loopback
      hosts are refused; shell, controls and review paths are 404 on the
      interactive origin; bundle rebuild after a watched change; 503 during
      build then 200; the Playwright test from Milestone 3 now runs against
      real Serve.
- [x] Update `src/server/README.md`; run the full check set and
      `cargo xtask check`; commit and push.

## Milestone 5: Static/Live toggle in the shell — completed

Tags: ui

Implementation decisions recorded in the contracts: the control follows the
Dark preview toggle (or the viewport control) and precedes Highlight
components, and is hidden while a comparison is shown; the preview mode rides
in the watched-reload recovery snapshot so a replaced generation remounts
Live, while an ordinary load starts Static; a failed bundle or preparation
disables Live for the generation and a mount failure for that view only; the
Components tab shows the same Static-only notice as Props and Usage; and the
narrow toolbar takes its own row as the mobile artboards show. Hiding the
control for opted-out entries was blocked by missing backend data and moved to
Milestones 6 and 7.

- [x] Add the segmented Static/Live control to the view toolbar in the React
      shell (`packages/viewer/src/shell/workspace_controls.tsx`, after the
      Dark preview toggle or viewport control and before Highlight
      components, with a `previewMode` selection in the shell store and
      actions), kept across view changes in the current document, hidden when
      the private descriptor has no interactive capability, and never shown
      for pages, use-case steps, comparisons or removed entries.
- [x] Mount Live frames through `postMessageAdapter({ frameOrigin })` in
      `packages/viewer/src/shell/frame_registry.tsx` with pending usage, the
      same `/static/` path and query parameters, and the device frame
      unchanged; mount Static frames exactly as today. Consume the Milestone 4
      descriptor's optional explicit origin or derive the frame origin from
      its port and the shell's own scheme/host name; never read this from the
      public catalogue.
- [x] Present the preparing and unavailable states from the design milestone,
      consuming the descriptor state, preparation capability, and private SSE
      updates delivered in Milestone 4; keep Static reachable in both, and
      disable highlight, pick and controls with the Static-only notice while
      Live is selected.
- [x] Apply the chosen controls rule from Milestone 1 when switching to Live
      with unsaved prop edits.
- [x] Keep Live selected across a watched reload that replaces the
      generation by carrying the preview mode in the one-shot recovery
      snapshot, and correct the contract's opted-out wording to "no control".
- [x] Browser tests: toggle visibility per catalogue and view kind, frame
      origin and sandbox attributes per mode, the preparing and unavailable
      states, navigation from a Live frame opens the destination in the shell,
      state persists across view changes and resets on reload, a watched
      rebuild remounts Live, the inspector notice appears, highlighting is
      disabled, unsaved edits are discarded, and the control works from the
      keyboard; unit tests for the pure state, recovery and markup.
- [x] Update `packages/viewer/README.md` and `packages/viewer/src/shell/README.md`;
      run the full check set and `cargo xtask check`; commit and push.

## Milestone 6: Per-entry Live eligibility for the shell — completed

Backend. Discovered while implementing Milestone 5: the resolved per-entry
`interactive` value reaches the private catalogue index, but the browser shell
receives only the public catalogue and route-scoped private workspace
evidence, and once Serve adopts the completed manifest that evidence no longer
carries the value, so the shell cannot hide Static/Live for an opted-out entry.

- [x] Define in `mokly-interactive-views.md` and `mokly-live-capabilities.md`
      how Serve carries each current screen's and component's resolved
      `interactive` value from `ComponentRuntime.interactiveEntries` in the
      private route-scoped workspace evidence, for the live index and the
      completed manifest alike; define missing values as unknown, fail-closed
      Live eligibility while Static remains available; and never expose the
      value in public catalogue JSON, static workspace evidence, export or
      publication.
- [x] Implement it in Serve's private workspace evidence and its validation in
      `packages/viewer/src/client/workspace_descriptor.ts`, surviving
      `completeCatalogue`, route evidence loads, evidence refreshes and watched
      rebuilds; omit and diagnose a missing runtime value once per entry and
      generation instead of failing the route.
- [x] Tests: opted-out and eligible screens and components before and after
      background completion, and the value's absence from public JSON, static
      evidence and export; missing screen and component values keep Static
      routes available, omit eligibility and report one diagnostic each.
- [x] Fix the Live browser bundle's `jsxDEV` shim so static JSX siblings retain
      esbuild's static-children signal without suppressing React's warning for
      genuinely unkeyed dynamic lists; cover both outcomes in the real-browser
      Live harness.
- [x] Update `src/server/README.md` and the viewer READMEs; run the full check
      set and `cargo xtask check`; commit and push.

## Milestone 7: Hide Static/Live for opted-out entries — completed

Tags: ui

Implementation decisions recorded in the
[shell contract](../docs/protocol/mokly-interactive-views-shell.md): the shell
reads eligibility only from the private workspace adopted for the exact route;
`false`, or an adopted workspace without the value, renders no control and a
Static stage while a Live selection stays selected for the next eligible view.
Same-shell navigation commits before the destination's workspace arrives, so
that view is pending until adoption. Like status and change marks, which keep a
presentation until matching evidence arrives, the toolbar shows Static/Live
only if the previous view offered it (a retained Live selection shows the
preparing state), never prepares or mounts Live meanwhile, and changes at most
once per navigation; a route evidence request that fails or is
rejected ends pending as unknown. The shell behaviour moved from the main
contract into its own shell contract so both protocol documents stay short.

- [x] Hide the Static/Live control, with no placeholder gap, for an entry
      whose resolved `interactive` is false, reading the private eligibility
      delivered in Milestone 6 (moved from Milestone 5); never offer or mount
      Live while eligibility is unknown; and remove the interim unavailable
      fallback note from the contract.
- [x] Keep the previous view's control presence while a newly routed view's
      eligibility is pending, never preparing or mounting Live until it is
      known; end pending as unknown when the route evidence request fails or
      is rejected; and document the interval in the contracts (discovered
      while implementing: eligibility arrives after navigation commits).
- [x] Browser tests: toggle visibility per entry for an opted-out screen and an
      opted-out component, alongside eligible entries of the same catalogue
      (moved from Milestone 5); Live selected across eligible and opted-out
      screens, components, saved variants and Back; held route evidence from
      eligible to opted-out to eligible that neither prepares nor mounts Live
      and changes the control at most once; and unloadable route evidence.
- [x] Update `packages/viewer/src/shell/README.md`; run the full check set and
      `cargo xtask check`; commit and push.

## Milestone 8: Depict the Components tab while Live — completed

Tags: mockup

Discovered while reviewing Milestone 5: the shell shows the Static-only notice
in the Components tab while Live is selected, as the design contract now
states, but no artboard depicts that state. Mockups must stay aligned with the
implementation, so add it to the Static and Live design catalogue.

Implementation decisions recorded in the
[design contract](../docs/protocol/mokly-interactive-views-design.md): the new
`design-interactive-screen` artboard shows the Welcome screen workspace, whose
tab is named Components (a component's tab is Nested components, and Action has
none), with Live selected and the Components tab open. Its Static segment opens
the screen's own page, `design-component-inspection-details`, which keeps its
toolbar unchanged because only the two canonical entry points record a preview
mode, so the artboard is entered from the catalogue navigation. The count lock
for "Browse, page, publication, appearance and Changes" designs no longer
includes the Static and Live family, which the example README and design links
contract now count separately, so their totals add up.

- [x] Add a Workspace screen to the interactive design catalogue that shows a
      component or screen workspace in Live with the Components tab selected
      and its "Switch to Static to inspect or edit this view." notice, with
      separate mobile and desktop components, reachable from the owning
      Workspace gallery page and the design navigation (at most five screens
      per page).
- [x] Update `docs/protocol/mokly-interactive-views-design.md` and the design
      suites (ids, routes, viewports, notice copy, navigation, counts).
- [x] Run `npm run build`, `npm run example:build`, `npm run example:check`,
      smoke the new artboards through `npm run dev`, run `cargo xtask check`,
      commit and push.

## Milestone 9: Keep the approved narrow toolbar without Static/Live — completed

Tags: ui

Discovered while reviewing Milestone 7: Milestone 5 moved the view toolbar
onto its own row at narrow widths for every workspace, so catalogues without
Live (the default) and opted-out entries no longer match their approved mobile
artboards, which keep the toolbar beside the title. Only views that show the
Static/Live control are drawn with the toolbar on its own row.

Implementation decisions recorded in the
[shell contract](../docs/protocol/mokly-interactive-views-shell.md#control):
`WorkspaceControls` marks the toolbar with `data-preview-mode-offered` exactly
when it renders the control, and only that mark takes the narrow row. The row
therefore follows the control's presence, including the presence a pending
view retains, and a comparison, which hides the control, returns the toolbar
beside the title. A narrow toolbar without the mark drops `margin-left: auto`,
so it stays at the end of the title row when it fits and, when the title
leaves no room, wraps below it starting where the heading starts, as every
mobile artboard draws a wrapped toolbar; before Milestone 5 a wrapped toolbar
was right-aligned, which no artboard shows.

- [x] Take the narrow toolbar row only when the Static/Live control is shown;
      views without it (static-only catalogues, opted-out entries, pages and
      comparisons) keep the approved narrow layout, with no layout shift while
      eligibility is pending.
- [x] Browser and markup tests for the narrow toolbar with and without the
      control, and desktop and mobile screenshots compared with the matching
      artboards (static-only catalogue, opted-out entry, Live-capable screen
      and component).
- [x] Update `packages/viewer/src/shell/README.md` and the shell contract if
      the wording changes; run `cargo xtask check`; commit and push.

## Milestone 10: Example adoption, smoke test and review — completed

- [x] Enable `interactive: "serve"` in `examples/basic/mokly.config.ts`, add
      the `interactive` export to `examples/basic/renderer.tsx` mirroring its
      providers, and add one example screen with a genuinely stateful shared
      component so Live is demonstrable.
- [x] Keep saved-component rendering beneath the renderer's Live provider tree
      and add a real-browser regression test for provider context.
- [x] Run `npm run build`, `npm run example:build`, `npm run example:check`;
      smoke through `npm run dev`: switch to Live, exercise the stateful
      control, follow a catalogue link from the Live frame, switch back to
      Static, and confirm Changes and comparisons are unaffected; save
      screenshots under `.context/`.
- [x] Confirm `mokly export` output contains no bundle, bootstrap or React
      and that `mokly check` ignores the option.
- [x] Update the root and example READMEs and packaged guides. Note that
      Release Please generates `CHANGELOG.md` from the Conventional Commit
      title, so this milestone does not edit it.
- [x] Split the interactive views protocol into focused overview, browser
      runtime, Serve delivery, and shell documents; update every moved link and
      remove stale delivery wording.
- [x] Run the full check set and `cargo xtask check`; `git add -A`, commit
      with a Conventional Commits message, and push.
- [x] Review: after the push, use `docs/implementation-review-prompt.md`
      against `origin/main` and report numbered findings with severity,
      impact and lettered options, without changing the implementation.
      Reviewed at `72602945`: three Medium findings, each confirmed against
      the code and reported to the user for a decision: the Live bundle
      compiles the current files rather than the accepted generation's
      sources; `MockLink asChild` controls whose component ignores `onClick`
      (including the example's "View details" action) do not navigate in
      Live; and forwarded app origins cannot pass the preparation request's
      Origin check.

### Mainline integration record

Merge 1 (`e7d0ee2214aec9d0fb9d6a3492fc47b563419632`) from `b2c82c15` keeps imported CSS delivery (#125) and entry-scoped
shell bootstraps (#120). Live replays the accepted Node graph's stylesheet
JavaScript and serves its accepted generated CSS and asset bytes. CSS Module
symlinks retain separate logical class maps. Installed stylesheet modules use
the same maps without exposing package paths in public source inventory.
Ordinary installed-package JavaScript retains its existing resolution behavior.

The following table records every conflict decision for the future PR
description. The existing milestone checklists remain complete. The user will
run the independent implementation review after this merge is pushed.

| Conflicted path                                                    | Resolution                                                                                                                                        |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/protocol/README.md`                                          | Keep both protocol indexes, including main's imported-styles and bootstrap docs and the branch's Live, rebuild-status and public-exclusions docs. |
| `docs/protocol/mokly-component-design.md`                          | Keep main's design contract and add the branch's Live inspection rules and combined design counts.                                                |
| `docs/protocol/mokly-configuration.md`                             | Keep main's stylesheet/PostCSS configuration and the branch's interactive configuration; link each focused contract.                              |
| `docs/protocol/mokly-export.md`                                    | Keep main's export contract; retain the branch's private Live/status exclusions in the focused export contracts.                                  |
| `docs/protocol/mokly-live-capabilities.md`                         | Pair main's scoped public bootstrap with complete private workspace evidence, Live eligibility/readiness and rebuild status.                      |
| `docs/protocol/mokly-viewer.md`                                    | Keep main's scoped viewer contract and retain the branch's behavior in its focused interactive and rebuild contracts.                             |
| `examples/basic/README.md`                                         | Document imported CSS/PostCSS, main's scoped delivery, Live adoption and the combined design inventory.                                           |
| `examples/basic/entries/design/components/parts/view_controls.tsx` | Retain main's controls and loading state alongside the branch's Static/Live controls.                                                             |
| `examples/basic/entries/design/library/controls/view-controls.tsx` | Preserve main's loading variant and the branch's Live variant and control schemas.                                                                |
| `packages/viewer/src/client/host_capabilities.ts`                  | Preserve main's host evidence interface and the branch's private interactive and rebuild capabilities.                                            |
| `packages/viewer/src/shell/README.md`                              | Describe main's atomic scoped adoption and Usage delivery alongside Live state, recovery and failure notices.                                     |
| `packages/viewer/src/shell/capability_commit.ts`                   | Keep atomic scoped catalogue/workspace adoption and add private interactive/status adoption with version fences.                                  |
| `packages/viewer/src/shell/capability_store.ts`                    | Keep main's request-bound workspace and retry behavior; retain branch readiness/status subscriptions and extract route-evidence handling.         |
| `packages/viewer/src/shell/stage_frame.tsx`                        | Keep main's omitted-usage handling and the branch's Live frames and extracted document-frame owner.                                               |
| `packages/viewer/src/shell/workspace.tsx`                          | Keep main's Usage delivery state and the branch's Live controls and inspection notices.                                                           |
| `packages/viewer/tests/host_capabilities.test.tsx`                 | Keep main's split test owners and retain branch rendering/privacy cases in the rendering suite.                                                   |
| `plans/README.md`                                                  | Keep both branch plans active until PR merge; mark main's imported-CSS and scoped-bootstrap plans completed.                                      |
| `scripts/preview/catalogue.mjs`                                    | Keep main's scoped capture, binary assets and stability helpers; force interactive off for every preview operation.                               |
| `src/build/README.md`                                              | Document main's imported-style outputs and the branch's accepted Live source capture.                                                             |
| `src/build/compile.ts`                                             | Preserve binary/style outputs while retaining interactive eligibility and source capture.                                                         |
| `src/build/component_runtime.ts`                                   | Carry main's style outputs alongside branch eligibility and generation-pinned sources.                                                            |
| `src/build/load_graph.ts`                                          | Keep main's evaluation and PostCSS-loader API; add branch capture options and record actual stylesheet modules.                                   |
| `src/build/source_inventory.ts`                                    | Preserve main's package-code ownership rules and the branch's confined runtime/source helpers.                                                    |
| `src/client/README.md`                                             | Document scoped public/private adoption and private readiness/status transport.                                                                   |
| `src/client/react_capability_updates.ts`                           | Keep main's strict scoped reader and the branch's interactive/rebuild events and recovery.                                                        |
| `src/server/controls/runtime_ipc.ts`                               | Keep binary-safe outputs and carry branch eligibility, captured modules, resolutions and rebuild status.                                          |
| `src/server/http.ts`                                               | Preserve accepted generated resources and scoped delivery; retain Live/status setup and extract startup/asset helpers.                            |
| `src/server/http_request_handler.ts`                               | Pass main's accepted generated bytes together with branch Live/status request context.                                                            |
| `src/server/http_routes.ts`                                        | Preserve main's generated routes and add branch readiness, status and private eligibility routing.                                                |
| `src/server/serve_watched.ts`                                      | Preserve main's hydrated stylesheet watch inventory and the branch's typed source/delivery phases and update fences.                              |
| `tests/client_react_capabilities.test.ts`                          | Keep main's scoped fixtures and retain branch Live/privacy assertions in matching focused tests.                                                  |
| `tests/component_design_attribution.test.ts`                       | Preserve both design families and update shared-style attribution to the combined inventory.                                                      |
| `tests/design_library_usage.test.ts`                               | Preserve both component libraries and their combined usage counts.                                                                                |
| `tests/design_links.test.ts`                                       | Retain main's split link suites and include branch interactive/rebuild navigation in the combined inventory.                                      |
| `tests/protocol_doc_sizes.test.ts`                                 | Keep main's exact caps; lower the runtime cap after removing stale text. Add no caps and raise none.                                              |

Outside conflict markers, stylesheet recording and replay are implemented in
`src/build/styles/collect.ts`, `src/build/interactive_source_capture.ts`, the
new `interactive_source_loaders.ts` and `interactive_source_paths.ts`, and
`src/interactive/source_resolution.ts`. `src/interactive/server_static.ts`
serves only accepted allowlisted generated resources. Focused source-pinning
and delivery tests cover edits, deletion, invalid CSS, aliases, packages,
derived/committed output, headers, HEAD and confinement. Browser tests compare
Workspace note and Welcome in Static/Live at desktop and mobile sizes.

The example registers main's Workspace note as a component and renders it on
Welcome. Main's Usage delivery state reaches `workspace_inspector.tsx`.
`src/server/watch_action_queue.ts` owns the extracted queue. Startup snapshots,
generated-resource initialization and catalogue asset loading have focused
owners. The obsolete branch-only preview asset helper is removed. These splits
keep changed production source files within main's length policy without
changing the ratchets or public package exports.

The separate source-file-length gate also requires test splits. Reporter Live
output, authoring markup, Live frame origins, listener authority and preview
color styles have focused test files. Registry-validation configuration, shell
CSS readers and watched-runtime doubles have shared test helpers. The existing
large shell suite is split into rendering, navigation, tags, chrome, styles,
appearance and preview-color suites. Every test case and assertion is retained.
Each new or changed test owner stays within 300 lines.

Merge 1's plain dependency audit fails on `GHSA-vfj7-8cjw-p6xm` in main's
existing development dependency path through Metro and `braces@3.0.3`. There
is no patched release. Its package manifest and lockfile match `b2c82c15`.
A separate merge brings main's strict, expiring audit exception from #130
(`1dc91580`). The exception, expiry, dependency path and tests stay unchanged.
The complete integration gate runs after that merge; the branch is pushed
only after the final gate passes.

Both parents of merge 1 are verified: `3d411390` and `b2c82c15`.
Its remerge diff lists 101 paths. All paths were read before merge 2.
No implementation or test was lost. The user’s review found one missing
branch contract statement about interactive identity fences during evidence
adoption. The follow-up restores it in
[mokly-interactive-host-integration.md](../docs/protocol/mokly-interactive-host-integration.md#evidence-adoption-fences)
and links it beside main’s unchanged atomic-adoption paragraph in
`docs/protocol/mokly-live-capabilities.md`. The content-reload sentence group
moves to that focused section. Both docs stay within 250 lines; no cap changes.
Partial-clone transient-blob diagnostics did not cut any saved diff. No parent
comparison fallback or clone repair was needed.

The Markdown link check found the root `README.md` still linked to the removed
branch-only preview asset helper. The follow-up points to main's equivalent
`scripts/preview/capture.mjs`. The failing link check captures that defect.

The table above records the 35 original conflicts. The following table
records every other path in merge 1’s remerge diff and its reason.

| Other remerge path                                                       | Reason                                                                                                                      |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `docs/protocol/mokly-export-public-files.md`                             | Keep main’s binary resource export rules and the branch’s private Live/status exclusions.                                   |
| `docs/protocol/mokly-interactive-source-pinning.md`                      | State the accepted stylesheet-module capture, logical CSS identities and private resource pinning.                          |
| `docs/protocol/mokly-interactive-views-serve.md`                         | State accepted generated CSS/asset delivery without reserved disk fallback.                                                 |
| `docs/protocol/mokly-shell-bootstrap.md`                                 | Keep main’s scoped bootstrap and pair it with private Live/status state.                                                    |
| `examples/basic/entries/catalogue.mockup.tsx`                            | Render main’s Workspace note through its registered component wrapper on Welcome.                                           |
| `examples/basic/src/components/workspace-note/workspace-note.mockup.tsx` | Expose main’s product component as a saved component view for Static/Live parity.                                           |
| `examples/basic/src/components/workspace-note/workspace-note.mokly.tsx`  | Register main’s component with declared ownership and desktop/mobile saved renders.                                         |
| `packages/viewer/src/shell/capability_route_evidence.ts`                 | Move main’s every-target evidence loader and retry state into the branch’s focused owner.                                   |
| `packages/viewer/src/shell/workspace_inspector.tsx`                      | Pass main’s Usage delivery state while keeping Live inspection notices.                                                     |
| `packages/viewer/tests/host_capabilities_rendering.test.tsx`             | Retain both sides’ SSR and private export assertions in main’s rendering test owner.                                        |
| `packages/viewer/tests/preview_mode.test.ts`                             | Move only Live origin cases to the new origin suite to meet the length limit.                                               |
| `packages/viewer/tests/preview_mode_origin.test.ts`                      | Retain all moved origin and logical Live path cases.                                                                        |
| `packages/viewer/tests/scoped_shell_usage.test.tsx`                      | Set the new explicit inactive Live state in main’s existing scope test.                                                     |
| `plans/imported-css-delivery.md`                                         | Mark #125 complete after its implementation PR merged; retain all review records.                                           |
| `plans/interactive-views.md`                                             | Record conflict decisions, semantic adaptations and verification without reopening milestones.                              |
| `plans/route-scoped-shell-bootstrap.md`                                  | Mark #120 complete after its implementation PR merged.                                                                      |
| `scripts/preview/assets.mjs`                                             | Remove this branch-only duplicate; main’s capture.mjs owns the full binary-safe asset capture.                              |
| `src/build/interactive_source_capture.ts`                                | Capture exact accepted stylesheet JavaScript and resolutions; retain ordinary repository byte capture.                      |
| `src/build/interactive_source_loaders.ts`                                | Extract loader selection; replay accepted CSS modules with the JavaScript loader.                                           |
| `src/build/interactive_source_paths.ts`                                  | Extract logical CSS identities and preserve confined authored aliases.                                                      |
| `src/build/styles/collect.ts`                                            | Record each existing Node stylesheet loader result without changing Static processing.                                      |
| `src/interactive/README.md`                                              | Describe accepted module replay, CSS symlink identities and generated-resource delivery.                                    |
| `src/interactive/server_static.ts`                                       | Serve only accepted allowlisted generated CSS/asset bytes with existing headers and confinement.                            |
| `src/interactive/source_resolution.ts`                                   | Replay captured CSS modules in repository and installed-package resolution paths.                                           |
| `src/server/README.md`                                                   | Document the extracted watch queue and retained classification/debounce owners.                                             |
| `src/server/client_modules.ts`                                           | Extract timed catalogue asset loading without changing the asset inventory.                                                 |
| `src/server/generated_static.ts`                                         | Extract main’s committed startup resource discovery and accepted-byte snapshot.                                             |
| `src/server/http_initial.ts`                                             | Retain main’s snapshot validation in the branch’s startup snapshot owner.                                                   |
| `src/server/serve_lifecycle.ts`                                          | Replace the branch’s source refresh with main’s equivalent hydrateWatchInventory, which includes PostCSS watch directories. |
| `src/server/watch_action_queue.ts`                                       | Move the complete serialized queue and progress observer into a focused owner.                                              |
| `src/server/watch_events.ts`                                             | Keep classification, gates and debounce; share priority with the extracted queue.                                           |
| `tests/authoring.test.tsx`                                               | Share registry configuration and move rendering cases without dropping assertions.                                          |
| `tests/authoring_rendering.test.tsx`                                     | Retain the moved ReviewIgnore, MockLink and material-key rendering cases.                                                   |
| `tests/browser/interactive_fixture.ts`                                   | Read main’s generated view outputs through its binary-safe text helper.                                                     |
| `tests/browser/interactive_imported_styles.spec.ts`                      | Test exact styles and screenshots for Workspace note and Welcome on desktop and mobile.                                     |
| `tests/cli_reporter.test.ts`                                             | Move only Live origin reporting into a focused suite to meet the length limit.                                              |
| `tests/cli_reporter_live.test.ts`                                        | Retain the moved plain/rich Live origin output and terminal-width assertions.                                               |
| `tests/client_route_interactive_evidence.test.ts`                        | Adapt branch eligibility adoption assertions to main’s scoped public bootstrap.                                             |
| `tests/design_links_inventory.test.ts`                                   | Include interactive and rebuild design specs in main’s exact inventory check.                                               |
| `tests/design_screen_counts.test.ts`                                     | Accept the combined ninety light-only screens in the existing written-count parser.                                         |
| `tests/helpers/interactive_styles.ts`                                    | Share a real CSS Module/plain CSS/PostCSS fixture and accepted Live compilation helpers.                                    |
| `tests/helpers/react_capability_environment.ts`                          | Retain main’s scoped fixtures and add private interactive/rebuild event support.                                            |
| `tests/helpers/registry_validation.ts`                                   | Share the unchanged complete registry-only configuration between test owners.                                               |
| `tests/helpers/shell_css.ts`                                             | Extract stylesheet normalization and dark-token selector readers.                                                           |
| `tests/helpers/shell_fixture.ts`                                         | Extract the complete catalogue fixtures and shell assertion helpers.                                                        |
| `tests/helpers/watch_boundary_runtime.ts`                                | Extract unchanged watcher integration doubles to meet the length limit.                                                     |
| `tests/interactive_example_adoption.test.ts`                             | Use main’s binary-safe output reader and include the registered Workspace note eligibility.                                 |
| `tests/interactive_imported_styles.test.ts`                              | Test exact Static class maps, empty plain modules, edit/delete/break pinning and uncaptured failure.                        |
| `tests/interactive_server.test.ts`                                       | Move listener lifecycle and authority cases without changing the remaining route/header cases.                              |
| `tests/interactive_server_authority.test.ts`                             | Retain every moved listener lifecycle and Host authority assertion.                                                         |
| `tests/interactive_source_ipc.test.ts`                                   | Add main’s required style output fields to existing capture transport fixtures.                                             |
| `tests/interactive_styles_alias.test.ts`                                 | Test distinct path-derived CSS Module maps and pinning after alias deletion.                                                |
| `tests/interactive_styles_delivery.test.ts`                              | Test accepted CSS/assets in both output modes, links, headers, HEAD and confinement.                                        |
| `tests/interactive_styles_packages.test.ts`                              | Test accepted installed CSS exports without leaking package paths into public source inventory.                             |
| `tests/rebuild_status.test.ts`                                           | Update the queue import after its extraction; retain status phase and fence cases.                                          |
| `tests/server_reporting.test.ts`                                         | Update the queue import after its extraction; retain reporter and debounce cases.                                           |
| `tests/shell.test.ts`                                                    | Keep rendering cases and move the other complete groups to focused suites.                                                  |
| `tests/shell_appearance.test.ts`                                         | Retain all moved appearance, startup and embedded-viewer cases.                                                             |
| `tests/shell_chrome.test.ts`                                             | Retain all moved brand, search, browser-icon and divider assertions.                                                        |
| `tests/shell_navigation.test.ts`                                         | Retain all moved tree, breadcrumbs, active rows, missing routes and filter assertions.                                      |
| `tests/shell_preview_colors.test.ts`                                     | Retain all moved dark-device, scheme-label and breakpoint assertions.                                                       |
| `tests/shell_styles.test.ts`                                             | Retain all moved design-contract, tag-chip and tag-picker CSS assertions.                                                   |
| `tests/shell_tags.test.ts`                                               | Retain all moved details, tag inventory and search-picker assertions.                                                       |
| `tests/variant_validation.test.ts`                                       | Reuse the unchanged registry fixture without changing variant validation cases.                                             |
| `tests/watch.test.ts`                                                    | Update the queue import after its extraction; retain all watch cases.                                                       |
| `tests/watch_boundaries.test.ts`                                         | Move only integration doubles to the helper; retain every boundary case.                                                    |

Merge 2 (`0afd96cf41d1311b654dff0763b261d713ecab7e`) has exactly two
parents: merge 1 and `1dc91580`. It adds main’s reviewed audit exception (#130)
without changing its path, inclusive `2026-11-03` UTC end date, evaluator,
runner, declarations, fixtures, tests or security docs. The manifest and
lockfile match main. The merge has no conflicts and no remerge-diff paths.
The three automatically combined files were read separately:

| Merge 2 path changed on both sides | Reason                                                                                                         |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `README.md`                        | Keep the branch’s Live/status description and add main’s exception policy and strict packed-consumer boundary. |
| `docs/protocol/README.md`          | Keep both feature indexes and main’s audit exception/consumer contract description.                            |
| `tests/package.test.ts`            | Keep branch private-state exclusions and main’s exclusion of scripts from the package.                         |

`npm ci`, `npm run dependencies:check`, the audit/security/package tests
(82 cases), source length and all repository ratchets pass for merge 2.
All 24 one-sided files match main exactly. Merge 1 deletes no file from its
actual source. Its temporary audit against newer main listed only the 16
not-yet-merged #130 additions. Merge 2 has no deletion against current main.
The final complete gate runs after this record commit. The user owns the
independent post-push implementation review.

The first complete gate on the combined tip passed the repository and package
suites. The unit suite ran 3,842 tests and found one guide-copy failure:
`docs/guides/start/serve.md` named a repository-only example path. Main's
existing `tests/guides_copy.test.ts` captures this rule. The follow-up removes
that path and keeps every Live example instruction. The example README already
owns the repository source locations. The complete unit suite and then the
complete gate run again after the follow-up commit.

The next complete gate passed the repository, package and all 3,842 unit
tests. The browser suite had 780 passes, two setup failures and 12 skips.
Both failed setup paths use the ordinary preview fixture. Merge 1 registered
Workspace note as a saved Mokly component and rendered it through the registry
on Welcome. This gives the imported-style component its own Static/Live view
and records its screen usage. The focused ordinary fixture still exported
only the older example component list. The follow-up imports `workspaceNote`
and includes `workspaceNote.entries`, without changing the production example.
The fixture failed in 7.67 seconds and 7.58 seconds, below its 300-second limit.

A new unit guard parses the real catalogue and the ordinary fixture source.
It requires each imported example component module, each named component
binding, and its registry entries in the fixture. The guard fails before the
fix in 30 milliseconds. It uses the existing TypeScript parser and requires
no catalogue build, shared production list, or new internal export. The two
affected browser specs, complete browser suite, hydration suite and complete
gate run again after the fix commit. Existing milestones remain complete.

The two ordinary preview specs pass all 14 cases after the registry fix.
Their build/export fixture takes 166.20 seconds and serving takes 1.44 seconds,
below its 300-second limit. The complete browser rerun then has 793 passes,
one failed parity case and no skips. The failed desktop Welcome trace has
byte-identical full-page screenshots. The user measured only two different
pixels in the note element capture, at the anti-aliased rounded corner.
The first repeat with `page.screenshot({ fullPage: true, clip })` has 17 passes
and three desktop Welcome failures. Each failed image differs at the same two
rounded-corner pixels. The Static page reaches the Live pixels after a later
paint; fonts-ready does not wait for background-image decoding. A second repeat
adds image decoding, two animation frames and a bounded stability loop; it has
35 passes and five failures at those same two pixels. The page can retain a
stable composited first paint because Playwright uses the viewport capture
when the full page fits it. The follow-up changes only the test: decode the
note's background image, wait two animation frames, then poll full-page Chrome
captures with `captureBeyondViewport: true` 100 milliseconds apart until two
consecutive PNGs match exactly, with a five-second limit. Crop the note from
that stable PNG in a blank page's canvas. This forces a full-surface raster and
avoids a second capture. It adds no dependency. Both assertions keep exact byte
equality. No pixel tolerance or product change is added. All four cases pass
ten times (40/40) in 2 minutes 36 seconds with exact byte equality. The complete
browser, hydration and final complete gate run after the test-fix commit.

The next complete gate passed repository, package and all 3,843 unit cases,
then failed one desktop component inspection case. The unchanged main test
passed 30 times in isolation. Delaying the Toolbar desktop response by 1,500
milliseconds reproduced the unavailable Highlight state twice in six runs on
the merged tree, but not in six runs on main. In both trees, mobile Usage
provided the two instance rows while the desktop frame was still blank.

A deterministic microtask probe then delivered ready usage after the initial
synchronization check and before initialization ended. It failed on both
main `1dc91580` and the merged tree: the session was Ready with usage revision
1, but the adapter still held unavailable metadata and received no update.
The frame hook is identical to main. This is an existing main race that the
merge's scheduling exposed more often. The user authorized a fix here after
that classification. A separate committed regression test fails in all three
repeats before the fix. The fix moves the end of initialization into the
synchronous final synchronization check. Later evidence uses the existing
ordered update and readiness path. Adapter behavior, frame navigation and
inspection failure handling remain unchanged. The complete browser, hydration
and final gate run after this fix. Existing milestones remain complete.

After the readiness fix, the deterministic test passes all ten repeats. The
1,500-millisecond delayed-frame reproduction passes all ten repeats: Highlight
is offered before the desktop load each time and remains active after it.
The unchanged component example passes desktop and mobile ten times each
(20/20). The temporary main worktree is removed. The frame usage adoption
paragraphs move intact to a focused protocol document with the initial handoff
rule; the frame-adapter exact cap is lowered from 381 to 362. No cap is added
or raised. The source length gate also requires moving the unchanged identity
comparison and disposal helpers from the 304-line frame hook to
`frame_session_lifecycle.ts`. The separate product commit records the existing-main diagnosis.

#### Merge 3: main's frame and generated-output fixes

Merge 3 (`08c990be95a579e151c4a88a9949a88830516fcd`) integrates main
`800fe9f88a0173429b25baa1bcf41ed9e59b2256` (#129) from source tip
`e8950d84238fa13b705992054d94449db80df8b0`. The source-tip audit lists 40
incoming changed paths. The merge has exactly two parents. All 12 listed
remerge diffs are complete and were reviewed before this record commit.
There is no transient-blob error or parent-diff fallback in this review.

| Conflicted path                                 | Resolution                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/viewer/src/shell/frame_mount_hook.ts` | Use main's exact 191-line hook and its `frame_session_usage.ts` owner. Main's final revision check and readiness callback form one synchronous handoff.                                                                                                                                                                              |
| `plans/README.md`                               | Use main's Imported CSS Delivery wording in Completed. Keep Interactive Views and Serve Rebuild Status in Active. The immediate review finds main's old Route-Scoped Shell Bootstrap entry in Active; this follow-up retains the branch's correct Completed state because PR #120 has merged. Each of these four plans appears once. |
| `plans/imported-css-delivery.md`                | Use main's complete Status, PR #125 completion and resolved Milestone 47 findings. The file matches main exactly.                                                                                                                                                                                                                    |

Main's fix covers the same handoff as `e8950d84`, so that branch-specific
one-line fix is superseded. The branch's initialization test and main's mount
race test each pass ten times on the merged code (20/20). Both schedule usage
adoption at the final mount-completion microtask boundary. The different usage
values and triggers do not introduce a distinct order. Main's regression test
remains; remove the duplicate branch spec and its helper under the user's
explicit instruction. Main's hook is below 300 lines, so the lifecycle extraction
is unnecessary. Its identity and disposal behavior remains in main's hook.

| Other remerge path                                     | Reason                                                                                                                                                                                                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/protocol/mokly-frame-adapter.md`                 | Point to the synchronous readiness rule in the focused adoption contract. Keep the exact 362-line cap.                                                                                                                                     |
| `docs/protocol/mokly-frame-usage-adoption.md`          | State main's initial-loop/final-callback rule and later ordered adoption once. Preserve the existing update, inspection and cancellation paragraphs.                                                                                       |
| `packages/viewer/src/client/README.md`                 | Replace the removed lifecycle helper reference with main's usage owner and link the shared handoff contract.                                                                                                                               |
| `packages/viewer/src/shell/README.md`                  | Keep main's new hook/usage ownership and readiness wording. Link the focused contract and keep the branch's Live and rebuild-status sections.                                                                                              |
| `packages/viewer/src/shell/frame_session_lifecycle.ts` | Remove this branch-only extraction. Main's shorter hook retains the same comparison and disposal operations.                                                                                                                               |
| `src/interactive/README.md`                            | State that a generated-output writer cannot change accepted Live source or resource bytes. Runtime adoption is the replacement boundary.                                                                                                   |
| `tests/browser/frame_initialization.spec.ts`           | Remove the duplicate branch handoff test after its ten passing runs against main's fix. Keep main's race test.                                                                                                                             |
| `tests/helpers/frame_initialization.tsx`               | Remove the helper used only by that duplicate test.                                                                                                                                                                                        |
| `tests/interactive_output_lock.test.ts`                | Add derived and committed integration cases: a queued writer cannot block or change accepted Live CSS/assets or source replay; a completed disk write still does not adopt a runtime; explicit runtime replacement supplies the new bytes. |

All three removed files are branch-only and their removal is explicitly
authorized by the merge brief. No main file, test or feature is removed.
The precommit, cached and postcommit main deletion audits are empty. Of the
40 incoming paths, 35 match main exactly. The other five retain branch docs
or plan entries: `docs/protocol/mokly-timings.md`,
`packages/viewer/src/shell/README.md`, `src/build/README.md`,
`src/server/README.md`, and `plans/README.md`. Main's `output.lock` timing, lock ownership,
cancellation and watched-resource contract text remains in those combinations.

Keep main's generated-output writer lock, export write/capture and input
recheck holds, Serve cancellation of lock waits, baseline cache walk retries,
native CI tests and deterministic watched-child resource ordering tests.
The Live bundle and accepted resource origin use in-memory generation bytes.
The new integration tests and doc size/link checks pass 6/6. Type checking,
formatting, lint, source length and all repository ratchets pass; a missing
explicit `Response` type in the new test is corrected before the passing rerun.
No protocol cap is added or raised. Existing completed milestones stay complete.

After this record, install the merged dependencies and run the focused frame,
component, output-lock, watched-resource, Live and imported-style tests.
Then run one complete `cargo xtask check` without concurrent edits, audit main
deletions again and push once. The user owns the independent post-push review.

#### Post-push review

The independent review at `51f0aa7b` found no lost content from either side in
the three merges or their follow-up commits. It found one Medium finding:
stylesheet requests from installed-package JavaScript still resolve through the
file system, so deleting such a stylesheet after acceptance fails that
generation's Live bundle. The user chose option A.
[Serve Rebuild Status Milestone 9](./serve-rebuild-status.md#milestone-9-pin-installed-stylesheet-requests--completed)
owns the fix.

On 2026-10-04 the user approved the plan index change in Merge 3: Route-Scoped
Shell Bootstrap stays in Completed in `plans/README.md`, because PR #120 has
merged.

## Milestone 11: Forwarded catalogue origin — completed

Backend. Closes final review finding 3 (option A, chosen by the user). The
catalogue listener admits only loopback Host values, and the Live preparation
POST requires `Origin` to equal `http://<that loopback Host>`. Behind a reverse
proxy that presents a public catalogue address, the browser sends the public
`Origin`, so preparation returns 403 and Live never starts, although
`--interactive-origin` documents forwarded setups. The component render request
has the same Origin rule, so prop edits fail there too.

- [x] Update `docs/protocol/mokly-interactive-host-integration.md`,
      `docs/protocol/mokly-interactive-views-serve.md`, the controls contract
      and `docs/guides/cli/serve.md`: add an explicit canonical public
      catalogue origin option (for example `--app-origin <origin>`), validated
      like `--interactive-origin`. Serve admits exactly its authority as an
      additional catalogue Host. Live preparation and component render
      requests accept exactly that `Origin` in addition to the loopback rule.
      In forwarded mode the Live listener accepts only that `mokly-host`, and
      Live documents name exactly that origin in `frame-ancestors`, replacing
      the broad `http: https:` policy. Define the combinations with
      `--interactive-origin` and the behavior without the option. Forwarded
      headers still grant nothing.
- [x] Add failing tests first: through a real local reverse proxy with a
      different browser-facing host name, open the catalogue, edit a
      component prop, select Live and see the Live preview.
- [x] Implement the option in the CLI, the watched supervisor and child, the
      catalogue listener, the Live listener and its policy.
- [x] Tests: strict option validation; exact Origin, Host, `mokly-host` and
      `frame-ancestors` behavior with and without the option; other origins
      and hosts stay refused; watched restarts keep the option; no CORS
      headers; exports and publication are unchanged.
- [x] Security: use one hostname/IP allowlist for both origin options; record
      failing punctuation table tests, check all header/policy/descriptor sinks,
      and validate programmatic listeners before they produce responses.
- [x] Smoke: run the example through `npm run dev` with both forwarded origins;
      edit a prop and switch Plan your visit to Live in Chrome. Save screenshots
      under `.context/iv-m11-smoke/`.
- [x] Diagnose the second prop-edit timeout from the browser trace and network
      log. Keep both successful render POSTs in the reverse-proxy test.
- [x] Record exact ordinary-preview phase times and run three alternating build
      samples per version against `51f0aa7b` in a temporary worktree. Explain the
      default preview failure before pushing and remove the temporary worktree.
- [x] Update `src/server/README.md` and `src/interactive/README.md`; run
      `cargo xtask check`; commit and push.
- [x] Review: after the push, use `docs/implementation-review-prompt.md`
      against `origin/main` and report numbered findings with severity,
      impact and lettered options, without changing the implementation.
      Reviewed at `3eedd03b`: one Medium finding, confirmed against the code
      and reported to the user for a decision: the shared validator accepts a
      bracketed IPv6 `--app-origin`, but a Content Security Policy source
      cannot express an IPv6 literal, so Chrome ignores that
      `frame-ancestors` entry and blocks both Live frames. Both reverse-proxy
      browser tests and 347 focused tests passed.

## Milestone 12: Integrate main's path identity contract — completed

Merge `781da7ae3261e6694a5ef5608a91f3e34061f6d0` into source tip
`4cecfa5a2c5312d3592cb5eac63a8aab98fce005`. The merge base is
`800fe9f88a0173429b25baa1bcf41ed9e59b2256`. Keep both feature sets.
The initial merge has 75 conflicted paths. No PR exists, so this milestone
records the intentional resolutions. Copy this record into the PR description
when the PR opens. Main first pointed to `c4138a0b`. It advanced to `60d48370`
with documentation changes, then to `781da7ae` with the generated-output lock
fix. Merge each delta with the previous main target as its three-way base.
Keep all completed code resolutions, then set the pending merge's second
parent to the fully integrated main target. The final merge still has exactly
two parents.

- [x] Read the path, root, module and artifact contracts before resolving conflicts.
- [x] Combine the contracts and migrate Live code, examples and fixtures to paths.
- [x] Add a failing regression for definition link tokens, then fix the mismatch.
- [x] Share native and Live navigation validation and publication to keep the inspector within
      its existing 9,216-byte budget. The package check first reports 9,251 bytes.
- [x] Update stale design link and documentation assertions. Check focused preview
      component discovery against the real example catalogue.
- [x] Remove repeated physical classification for paths with identical logical
      and physical roots. The existing 20,000-file regression exceeds its
      2,500-millisecond limit before this change. Keep that limit unchanged.
      Cache physical projections within one collection. Add a failing call-count
      regression and check that each collection rechecks changed symlink targets.
- [x] Give design-library runtime tests a current isolated baseline so they
      retain their saved-status assertions before this merge is committed.
- [x] Move ordinary-preview preparation to an owned Node child process. The
      browser fixture times out at 300 seconds before this change. Profiling
      shows over 90 percent of sampled worker time in React debug-stack capture;
      the same preparation takes 67 seconds in ordinary Node. Keep all artifact,
      navigation and freshness assertions and the five-minute limit.
      All 14 browser cases pass after the change; preparation takes 62 seconds.
- [x] Integrate main's lock-directory preservation fix and its tests. The first
      full gate passes before this new main commit is integrated. Run the full gate
      again on the final merge tree before committing.
- [x] Run the focused tests, example checks, browser smoke and `cargo xtask check`.
      The final gate against `781da7ae` passes: 4,714 TypeScript tests,
      902 browser cases, 286 hydration cases, and 15 Rust tests. Both packed
      packages pass all six consumer scenarios. Build and example checks pass
      with 524 generated files. The focused regressions and mobile/desktop
      Live smoke checks also pass. Generated output remains ignored.
- [x] Audit every resolution and main deletion; stage all authored files,
      commit with two parents, inspect every remerge-diff path and push.
      Merge `37ccdbcd930656a2018c49b6dd53e706d1735ce4` has exactly two
      parents: `4cecfa5a` and `781da7ae`. All 247 remerge-diff paths were
      inspected before the push. No main feature was lost. No file is deleted
      relative to main. All authored files are tracked. The remote branch
      `calummoore/denpasar-v4` was verified at the merge commit after the push.
- [x] Review after the push with `docs/implementation-review-prompt.md`
      against `origin/main`. Report findings and recommendations without
      changing the implementation.
      Reviewed `37ccdbcd` against `781da7ae` after the push. The review covered
      the full branch diff of 449 paths, including Live, rebuild status,
      source capture, server lifecycle, viewer state, examples, tests and docs.
      The review confirmed four earlier findings and one new lifecycle finding.
      Findings remain open for the user's decision. Only this review record
      changes after the completed code checks.

### Post-push review

1. **Medium: Closing Serve leaves an active Live compilation running.**
   [Live server close](../src/interactive/server.ts), line 143, closes the
   listener and connections but does not close the bundle service. A controlled
   compiler remained active after the real app and Live server had closed:
   its abort signal was false and its preparation promise was still pending.
   A programmatic caller can therefore finish shutdown while compiler work
   still uses resources and retains the accepted source capture. A stalled
   compiler can keep this work alive indefinitely.
   Option A: give the generation and bundle services an explicit close method.
   Abort both retained generations, drain their work, and reject late state
   callbacks. Add a shutdown test with a pending compiler.
   Option B: document that callers must wait for every compilation before
   closing Serve. Recommend A. Lifecycle ownership belongs in the service;
   a caller rule does not protect every shutdown or failure path.

2. **Medium: Some child controls cannot navigate in Live.**
   [MockLink child adapter](../src/authoring/links.tsx), line 126, adds only
   an `onClick` prop to a child component. A child that does not forward that
   prop renders a button with no navigation handler. The browser reproduction
   mounted Live successfully. Clicking such a child emitted zero navigation
   events; the equivalent native button emitted one. Without a change, controls
   supported by the Static child adapter can stop navigating in Live.
   Option A: add shared DOM-level child link handling and browser coverage for
   children that ignore event props, including disabled controls.
   Option B: require every consumer child to forward `onClick` and document
   that narrower Live contract. Recommend A. It protects the existing public
   child-control contract instead of fixing only the example control.

3. **Medium: Accepted IPv6 catalogue origins cannot frame Live.**
   [Origin validation](../src/http_origin.ts), line 21, accepts bracketed IPv6
   addresses. [The Live frame policy](../src/interactive/server_router.ts),
   line 225, inserts that value into `frame-ancestors`. Chrome rejected an
   iframe from an accepted `http://[::1]:<port>` parent in the reproduction.
   Without a change, users can start Serve with an accepted origin but cannot
   use Live through it.
   Option A: validate catalogue origins against the browser frame policy when
   Live is enabled. Reject unsupported literal origins early and direct users
   to a hostname. Add a real browser test at this boundary.
   Option B: document the hostname workaround while keeping the current
   accepted input range. Recommend A. A shared origin capability check and
   browser regression protect all entry points; a string-format test is not
   sufficient. Do not broaden the ancestor policy with a wildcard.

4. **Medium: Repository-linked React packages block Live compilation.**
   [The Live source guard](../src/interactive/source_resolution.ts), line 117,
   rejects a repository file loaded outside the saved resolution namespace.
   The React peer resolver runs before source capture and selects such files
   directly. A fixture with `node_modules/react` linked to `packages/react`
   accepted its Static runtime, then Live failed with `source-not-captured`
   for `packages/react/jsx-runtime.js`. Without a change, this supported package
   layout cannot use Live.
   Option A: share the peer-ownership rule across React resolution, source
   capture and the Live load guard. Keep one React instance and the documented
   unpinned peer behavior. Add linked-peer tests for Node and browser builds.
   Option B: reject repository-linked peers explicitly and document that limit.
   Recommend A. A shared rule fixes the boundary mismatch without weakening
   source protection for other linked repository packages.

5. **Low: Error details retain absolute paths after field names.**
   [Failure path rewriting](../src/server/rebuild_status_detail.ts), line 120,
   tests a whole token for a leading path. Both `path=/private/example.ts` and
   `path=file:///private/example.ts` pass through unchanged in the reproduction.
   Without a change, the browser's error detail can expose machine paths that
   the documented sanitizer must remove.
   Option A: recognize path boundaries after field names and punctuation.
   Add table-driven cases for POSIX paths, Windows paths and file URLs.
   Option B: replace consumer failure detail with fixed product text.
   Recommend A. A common path scanner preserves useful error details and
   covers more formats than a special case for the text `path=`.

The four earlier findings are items 2 to 5. Item 1 is new. The checked code
remains unchanged. The full gate passed, but these focused review reproductions
show gaps in the existing regression coverage. Browser reproductions used the
installed Chrome on Linux; this review did not run Safari or a native Mac.

### Resolution record

#### Documentation and public contracts

Keep main's path, root, folder, Markdown, move, manifest-v8 and catalogue-v4 contracts. Keep the branch's Live, accepted-source and rebuild-status contracts. Replace old IDs and routes in branch prose. Move complete configuration, comparison and component-verification sections into focused documents to meet size limits. Keep links and exact reviewed caps aligned.

Restore main's Runtime paragraph break and its existing 437-line cap. This
document has no remaining content or formatting difference from main.

- `README.md`
- `docs/guides/authoring/config.md`
- `docs/guides/start/serve.md`
- `docs/protocol/ci-verification.md`
- `docs/protocol/ci-suite-evidence.md`
- `docs/protocol/README.md`
- `docs/protocol/mokly-authoring.md`
- `docs/protocol/mokly-comparison-pane-designs.md`
- `docs/protocol/mokly-component-design-verification.md`
- `docs/protocol/mokly-component-design.md`
- `docs/protocol/mokly-configuration-discovery.md`
- `docs/protocol/mokly-configuration.md`
- `docs/protocol/mokly-design-component-library.md`
- `docs/protocol/mokly-export-public-files.md`
- `docs/protocol/mokly-interactive-host-integration.md`
- `docs/protocol/mokly-interactive-views-design.md`
- `docs/protocol/mokly-interactive-views-runtime.md`
- `docs/protocol/mokly-interactive-views.md`
- `docs/protocol/mokly-public-exclusions.md`
- `docs/protocol/mokly-rebuild-status-design.md`
- `docs/protocol/mokly-runtime.md`
- `docs/protocol/mokly-shell-design.md`
- `src/build/README.md`
- `src/interactive/README.md`
- `src/server/README.md`

#### Reference catalogue migration

Keep main's discovered `specs` tree. Move the branch's Live and rebuild-status screens from the old `entries` tree into that tree. Replace removed aggregate modules with discovered entry modules and folder metadata. Keep every screen, both viewports, shared controls, renderer providers, Live opt-outs, Guest picker and Workspace note. Update links, local variant slugs and stylesheet routes to the path contract. The old entry files are replaced by their `specs` owners; no main feature is removed.

- `examples/basic/README.md`
- `examples/basic/entries/design/components/parts/destinations.ts`
- `examples/basic/entries/design/design.mockup.tsx`
- `examples/basic/entries/design/interactive/index.tsx`
- `examples/basic/entries/design/interactive/modes/screens.tsx`
- `examples/basic/entries/design/interactive/parts/destinations.ts`
- `examples/basic/entries/design/interactive/parts/live_screen.tsx`
- `examples/basic/entries/design/interactive/parts/navigation_states.ts`
- `examples/basic/entries/design/interactive/parts/preview_screen.tsx`
- `examples/basic/entries/design/interactive/parts/static_notice.tsx`
- `examples/basic/entries/design/interactive/parts/workspace_screen.tsx`
- `examples/basic/entries/design/interactive/workspace/screens.tsx`
- `examples/basic/entries/design/library/library.mockup.ts`
- `examples/basic/entries/design/parts/destinations.ts`
- `examples/basic/entries/design/rebuild-status/index.tsx`
- `examples/basic/entries/design/rebuild-status/screens.tsx`
- `examples/basic/mokly.config.ts`
- `examples/basic/renderer.tsx`
- `examples/basic/specs/catalogue.tsx`
- `examples/basic/specs/design/components/parts/component_layout.tsx`
- `examples/basic/specs/design/components/parts/destinations.ts`
- `examples/basic/specs/design/components/parts/navigation.tsx`
- `examples/basic/specs/design/components/parts/navigation_tree.ts`
- `examples/basic/specs/design/components/parts/screen_info.tsx`
- `examples/basic/specs/design/interactive/_folder.json`
- `examples/basic/specs/design/interactive/index.mockup.ts`
- `examples/basic/specs/design/interactive/index.tsx`
- `examples/basic/specs/design/interactive/modes/_folder.json`
- `examples/basic/specs/design/interactive/modes/index.mockup.ts`
- `examples/basic/specs/design/interactive/modes/screens.tsx`
- `examples/basic/specs/design/interactive/parts/destinations.ts`
- `examples/basic/specs/design/interactive/parts/live_screen.tsx`
- `examples/basic/specs/design/interactive/parts/navigation_states.ts`
- `examples/basic/specs/design/interactive/parts/preview_screen.tsx`
- `examples/basic/specs/design/interactive/parts/static_notice.tsx`
- `examples/basic/specs/design/interactive/parts/workspace_screen.tsx`
- `examples/basic/specs/design/interactive/workspace/_folder.json`
- `examples/basic/specs/design/interactive/workspace/index.mockup.ts`
- `examples/basic/specs/design/interactive/workspace/screens.tsx`
- `examples/basic/specs/design/library/chrome/rebuild-notice.mockup.ts`
- `examples/basic/specs/design/library/chrome/rebuild-notice.tsx`
- `examples/basic/specs/design/library/chrome/rebuild-notice.view.tsx`
- `examples/basic/specs/design/library/chrome/top-bar.tsx`
- `examples/basic/specs/design/library/controls/view-controls.tsx`
- `examples/basic/specs/design/parts/destinations.ts`
- `examples/basic/specs/design/parts/rebuild_status.ts`
- `examples/basic/specs/design/rebuild-status/_folder.json`
- `examples/basic/specs/design/rebuild-status/index.mockup.ts`
- `examples/basic/specs/design/rebuild-status/screens.tsx`
- `examples/basic/specs/example/screens/visit.mockup.ts`
- `examples/basic/src/components/guest-picker/guest-picker.mokly.tsx`
- `examples/basic/src/components/workspace-note/workspace-note.mokly.tsx`

#### Viewer state and frames

Keep main's path lookup, move evidence, Markdown frames and scheme behavior. Keep Live eligibility, Static/Live selection, inspector restrictions and rebuild notices. Move the whole-document frame and recovery snapshot into focused owners. Update their callers without retaining pass-through exports.

- `packages/viewer/src/inspector/README.md`
- `packages/viewer/src/inspector/links.ts`
- `packages/viewer/src/inspector/metadata.ts`
- `packages/viewer/src/inspector/runtime.ts`
- `packages/viewer/src/inspector/values.ts`
- `packages/viewer/src/shell/capability_route_evidence.ts`
- `packages/viewer/src/shell/capability_store.ts`
- `packages/viewer/src/shell/component_controls.tsx`
- `packages/viewer/src/shell/context.ts`
- `packages/viewer/src/shell/document_stage_frame.tsx`
- `packages/viewer/src/shell/metadata.ts`
- `packages/viewer/src/shell/preview_mode.ts`
- `packages/viewer/src/shell/stage_frame.tsx`
- `packages/viewer/src/shell/store.tsx`
- `packages/viewer/src/shell/store_actions.ts`
- `packages/viewer/src/shell/store_recovery.ts`
- `packages/viewer/src/shell/workspace.tsx`
- `packages/viewer/src/shell/workspace_data.ts`
- `packages/viewer/src/shell/workspace_inspector.tsx`

#### Authoring and configuration

Keep main's branded exports, flat definitions, root discovery, path identity and local variant slugs. Add the branch's existing `interactive` fields to the accepted shapes. Definition links retain the private 36-character token shape. Generate its random bytes through Web Crypto so Node and browser bundles share the same implementation.

- `src/authoring/definitions.ts`
- `src/authoring/fields.ts`
- `src/authoring/identity.ts`
- `src/authoring/links.tsx`
- `src/authoring/types.ts`
- `src/authoring/variants.ts`
- `src/components/definition.ts`
- `src/components/render_request.ts`
- `src/components/types.ts`
- `src/components/wrapper.tsx`
- `src/config/types.ts`
- `src/config/validate.ts`
- `src/registry/catalogue_index.ts`
- `src/registry/entry_validation.ts`

#### Build and accepted runtime

Keep main's output snapshot, source inventory, Markdown and move support. Keep accepted Live source capture, style replay and runtime eligibility. Project accepted root ownership into the browser module graph. Move `LoadedGraph` to its type owner and update direct imports. Preserve generated-output privacy and publication exclusions.

The full gate exposes a 20,000-file dependency scan above its existing time
limit. Reuse identical logical/physical classifications and cache physical
projections for one collection. Keep the same ownership decisions and reset
the cache at the next collection. The focused case falls from 2.76 seconds to
1.63 seconds. Keep the 2.5-second limit and all validation precedence checks.

- `scripts/preview/catalogue.mjs`
- `docs/protocol/mokly-imported-styles-postcss.md`
- `src/build/README.md`
- `src/build/compact_runtime.ts`
- `src/build/compile.ts`
- `src/build/component_runtime.ts`
- `src/build/consumer_bundle.ts`
- `src/build/consumer_entry.ts`
- `src/build/document_compiler.ts`
- `src/build/live_runtime.ts`
- `src/build/load_graph.ts`
- `src/build/loaded_graph.ts`
- `src/build/package_owned_paths.ts`
- `src/build/render_cooperative.ts`
- `src/build/source_freshness.ts`
- `src/build/source_inventory.ts`
- `src/build/styles/dependency_inventory.ts`
- `src/build/styles/dependency_walk.ts`
- `src/compatibility/transform.ts`
- `src/review/accepted_generation.ts`

#### Live browser runtime

Use paths throughout private bootstrap, diagnostics and eligibility. Collect every branded named or default export. Derive paths with the same root rules as static compilation. Resolve relative links, imported definition links and variants through accepted identities. Use `screenPath` for navigation events and include Markdown destinations in the route table.

- `src/interactive/diagnostics.ts`
- `src/interactive/document.ts`
- `src/interactive/errors.ts`
- `src/interactive/generation.ts`
- `src/interactive/route_table.ts`
- `src/interactive/runtime/bootstrap.ts`
- `src/interactive/runtime/consumer.d.ts`
- `src/interactive/runtime/definitions.ts`
- `src/interactive/runtime/diagnostics.ts`
- `src/interactive/runtime/entry.ts`
- `src/interactive/runtime/mount.tsx`
- `src/interactive/runtime/route_context.ts`
- `src/interactive/server_diagnostic.ts`
- `src/interactive/server_static.ts`
- `src/interactive/types.ts`

#### Serve lifecycle

Keep main's demand documents, accepted generated bytes, move targets and runtime replacement. Keep Live listener startup, forwarded origins, private capability state and rebuild events. Split initial change resolution, document observation and failure cleanup into their existing lifecycle owners to keep HTTP composition below the source limit.

- `src/server/client_modules.ts`
- `src/server/controls/runtime_ipc.ts`
- `src/server/controls/transient.ts`
- `src/server/generated_static.ts`
- `src/server/http.ts`
- `src/server/http_documents.ts`
- `src/server/http_initial.ts`
- `src/server/http_shutdown.ts`
- `src/server/http_types.ts`
- `src/server/http_update.ts`
- `src/server/rebuild_status_state.ts`
- `src/server/supervisor.ts`
- `src/server/supervisor_types.ts`
- `src/server/update_messages.ts`
- `src/server/view_routes.ts`
- `src/server/workspace_eligibility.ts`

#### Regression coverage

Keep main's tests and migrate branch fixtures and assertions to roots, paths, current wire formats, screenPath navigation and discovered example files. Keep the behavior each test checks. Add unit and browser cases for named exports, nested index roots, transparent folders, variants, stateful components, relative links, imported definitions and Markdown destinations. Capture the token-format failure before fixing it.

- `packages/viewer/tests/disclosure_evidence.test.ts`
- `packages/viewer/tests/document_light_only.test.tsx`
- `packages/viewer/tests/host_capabilities_rendering.test.tsx`
- `packages/viewer/tests/live_eligibility.test.ts`
- `packages/viewer/tests/preview_mode.test.ts`
- `packages/viewer/tests/preview_mode_markup.test.tsx`
- `packages/viewer/tests/preview_mode_origin.test.ts`
- `packages/viewer/tests/rebuild_status.test.tsx`
- `packages/viewer/tests/rebuild_status_markup.test.tsx`
- `tests/app_origin_admission.test.ts`
- `tests/app_origin_watch.test.ts`
- `tests/authoring.test.tsx`
- `tests/authoring_rendering.test.tsx`
- `tests/authoring_variants.test.tsx`
- `tests/browser/design_rebuild_status.spec.ts`
- `tests/browser/design_library_runtime.spec.ts`
- `tests/browser/interactive.spec.ts`
- `tests/browser/interactive_fixture.ts`
- `tests/browser/interactive_fixture_sources.ts`
- `tests/browser/interactive_forwarded_origin.spec.ts`
- `tests/browser/interactive_imported_styles.spec.ts`
- `tests/browser/interactive_path_identity.spec.ts`
- `tests/browser/interactive_shell.spec.ts`
- `tests/browser/interactive_shell_eligibility.spec.ts`
- `tests/browser/interactive_shell_fixture.ts`
- `tests/browser/interactive_shell_helpers.ts`
- `tests/browser/interactive_shell_inspector.spec.ts`
- `tests/browser/interactive_shell_pending.spec.ts`
- `tests/browser/interactive_shell_toolbar.spec.ts`
- `tests/browser/interactive_shell_watch.spec.ts`
- `tests/browser/ordinary_preview_fixture.ts`
- `tests/browser/react_shell_hydration_helpers.ts`
- `tests/browser/rebuild_status_layout.spec.ts`
- `tests/browser/rebuild_status_tabs.spec.ts`
- `tests/browser/rebuild_status_watch.spec.ts`
- `tests/client_interactive_capability.test.ts`
- `tests/client_route_interactive_evidence.test.ts`
- `tests/component_design_attribution.test.ts`
- `tests/component_export.test.ts`
- `tests/design_interactive_views.test.ts`
- `tests/design_interactive_workspace.test.ts`
- `tests/design_library_usage.test.ts`
- `tests/design_link_states.test.ts`
- `tests/design_links.test.ts`
- `tests/design_rebuild_reuse.test.ts`
- `tests/design_rebuild_status.test.ts`
- `tests/design_screen_counts.test.ts`
- `tests/example_links.test.ts`
- `tests/example_focused_baseline.test.ts`
- `tests/fixture_replacements.test.ts`
- `tests/helpers/design_rebuild_status.ts`
- `tests/helpers/example_baseline.ts`
- `tests/helpers/interactive_server.ts`
- `tests/helpers/ordinary_preview_source.ts`
- `tests/helpers/ordinary_preview_worker.mjs`
- `tests/helpers/registry_validation.ts`
- `tests/helpers/shell_fixture.ts`
- `tests/helpers/variant_validation.ts`
- `tests/interactive_authoring.test.tsx`
- `tests/interactive_bundle.test.ts`
- `tests/interactive_compaction.test.ts`
- `tests/interactive_configuration.test.ts`
- `tests/interactive_diagnostics.test.ts`
- `tests/interactive_document.test.ts`
- `tests/interactive_eligibility.test.ts`
- `tests/interactive_example_adoption.test.ts`
- `tests/interactive_imported_styles.test.ts`
- `tests/interactive_path_identity.test.ts`
- `tests/interactive_route_parity.test.ts`
- `tests/interactive_server.test.ts`
- `tests/interactive_source_failure.test.ts`
- `tests/interactive_source_installed_ipc.test.ts`
- `tests/interactive_source_installed_linked.test.ts`
- `tests/interactive_source_installed_linked_ipc.test.ts`
- `tests/interactive_source_installed_linked_serve.test.ts`
- `tests/interactive_source_installed_privacy.test.ts`
- `tests/interactive_source_installed_styles.test.ts`
- `tests/interactive_source_ipc.test.ts`
- `tests/interactive_styles_alias.test.ts`
- `tests/interactive_styles_delivery.test.ts`
- `tests/interactive_styles_packages.test.ts`
- `tests/interactive_workspace_eligibility.test.ts`
- `tests/inspector_inert.test.ts`
- `tests/origin_host_validation.test.ts`
- `tests/postcss_dependency_cache.test.ts`
- `tests/protocol_doc_sizes.test.ts`
- `tests/server_update_messages.test.ts`
- `tests/shell.test.ts`
- `tests/shell_appearance.test.ts`
- `tests/shell_chrome.test.ts`
- `tests/shell_navigation.test.ts`
- `tests/shell_styles.test.ts`
- `tests/shell_tags.test.ts`
- `tests/variant_validation.test.ts`

#### Plan records

Adopt main's status paragraphs and removal of the plans index. Keep the branch's two open plans and pending review decisions in their own status paragraphs. Use main's dated completion record for Route-Scoped Shell Bootstrap. Record this merge in the active Interactive Views plan without reopening completed milestones.

- `plans/README.md`
- `plans/interactive-views.md`

#### Latest main documentation update

Apply each documentation change from `60d48370`. Keep main's plan statuses and
PR dates. Resolve the Route-Scoped Shell Bootstrap heading to main's more
complete dated record. Move the two branch-only active plan summaries from the
retired index into their owning status paragraphs. Update directory links and
keep the branch's additional Live and rebuild documentation.

- `AGENTS.md`
- `README.md`
- `examples/basic/README.md`
- `packages/viewer/src/client/README.md`
- `plans/README.md`
- `plans/app-independent-mokabook-library.md`
- `plans/authenticated-frame-document-handoff.md`
- `plans/browse-shell-design-parity.md`
- `plans/changes-path-only-evidence.md`
- `plans/ci-performance.md`
- `plans/cli-terminal-experience.md`
- `plans/co-located-entry-discovery-follow-up.md`
- `plans/co-located-entry-discovery.md`
- `plans/comparison-pane-scroll-alignment.md`
- `plans/component-explorer.md`
- `plans/configurable-changes-listing.md`
- `plans/consumer-static-export.md`
- `plans/css-change-attribution.md`
- `plans/delta-publishing.md`
- `plans/derived-baseline-review-fixes.md`
- `plans/derived-baselines.md`
- `plans/evidence-first-release-publish.md`
- `plans/hierarchy-inferred-breadcrumbs.md`
- `plans/id-derived-routes.md`
- `plans/imported-css-delivery.md`
- `plans/in-frame-catalogue-link-navigation.md`
- `plans/mocklink-child-controls.md`
- `plans/mokabook-dependency-patch-upstreaming.md`
- `plans/mokabook-design-components.md`
- `plans/mokabook-design-mocklinks.md`
- `plans/mokly-package-migration.md`
- `plans/mokly-viewer-library.md`
- `plans/native-color-scheme-support.md`
- `plans/nav-path-hierarchy.md`
- `plans/optional-published-changes.md`
- `plans/package-documentation.md`
- `plans/path-identity.md`
- `plans/publish-catalogue.md`
- `plans/react-browse-shell.md`
- `plans/release-gated-node-compatibility.md`
- `plans/removed-content-previews.md`
- `plans/review-fix-followups.md`
- `plans/route-scoped-shell-bootstrap.md`
- `plans/screen-variants-follow-up.md`
- `plans/screen-variants.md`
- `plans/tag-filtering.md`
- `plans/unchanged-view-fast-path.md`
- `plans/unified-catalogue-pages.md`
- `plans/viewer-comment-anchoring.md`
- `plans/viewer-dark-mode.md`
- `plans/viewer-owned-historical-previews.md`
- `src/export/README.md`
- `src/publish/README.md`
- `plans/serve-rebuild-status.md`

#### Latest main lock update

Keep all 12 changes from `781da7ae` (PR #132). Lock release removes only the
lock file, so another writer never loses its parent directory during creation.
Keep main's regression for the APFS `EINVAL` race, its baseline directory
simplification, and its updated cache assertions. Keep main's removal of
`tests/baseline_directory_walk.test.ts`; it tested the retired retry behavior
and is already absent from the new main. No file is deleted relative to main.
Combine the build README addition with the branch's Live and dependency-cache
documentation. All 12 paths merge without new conflicts.

- `docs/protocol/mokly-baseline-storage.md`
- `docs/protocol/mokly-rendering-generated.md`
- `src/baseline/confinement.ts`
- `src/build/README.md`
- `src/build/output_lock_file.ts`
- `tests/baseline_directory_walk.test.ts`
- `tests/derived_build.test.ts`
- `tests/derived_cache_boundaries.test.ts`
- `tests/export_current_derived.test.ts`
- `tests/generated_output_lock.test.ts`
- `tests/helpers/output_directory_lock_spy.ts`
- `tests/path_transaction_regressions.test.ts`

## Post-merge follow-up (non-blocking)

- Live inspection: measure boundaries in the mounted DOM and re-enable
  highlight and pick for Live frames.
- Live controls: apply prop edits to the mounted tree directly.
- `interactive: "export"`: ship the bundle in static exports on a separate
  host origin, after a decision on export size and hosting requirements.
