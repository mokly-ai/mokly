# Interactive Views

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

Protocol owner: `docs/protocol/mokly-interactive-views.md` (created in
Milestone 1). Related contracts: [runtime](../docs/protocol/mokly-runtime.md),
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

## Milestone 8: Depict the Components tab while Live

Tags: mockup

Discovered while reviewing Milestone 5: the shell shows the Static-only notice
in the Components tab while Live is selected, as the design contract now
states, but no artboard depicts that state. Mockups must stay aligned with the
implementation, so add it to the Static and Live design catalogue.

- [ ] Add a Workspace screen to the interactive design catalogue that shows a
      component or screen workspace in Live with the Components tab selected
      and its "Switch to Static to inspect or edit this view." notice, with
      separate mobile and desktop components, reachable from the owning
      Workspace gallery page and the design navigation (at most five screens
      per page).
- [ ] Update `docs/protocol/mokly-interactive-views-design.md` and the design
      suites (ids, routes, viewports, notice copy, navigation, counts).
- [ ] Run `npm run build`, `npm run example:build`, `npm run example:check`,
      smoke the new artboards through `npm run dev`, run `cargo xtask check`,
      commit and push.

## Milestone 9: Keep the approved narrow toolbar without Static/Live

Tags: ui

Discovered while reviewing Milestone 7: Milestone 5 moved the view toolbar
onto its own row at narrow widths for every workspace, so catalogues without
Live (the default) and opted-out entries no longer match their approved mobile
artboards, which keep the toolbar beside the title. Only views that show the
Static/Live control are drawn with the toolbar on its own row.

- [ ] Take the narrow toolbar row only when the Static/Live control is shown;
      views without it (static-only catalogues, opted-out entries, pages and
      comparisons) keep the approved narrow layout, with no layout shift while
      eligibility is pending.
- [ ] Browser and markup tests for the narrow toolbar with and without the
      control, and desktop and mobile screenshots compared with the matching
      artboards (static-only catalogue, opted-out entry, Live-capable screen
      and component).
- [ ] Update `packages/viewer/src/shell/README.md` and the shell contract if
      the wording changes; run `cargo xtask check`; commit and push.

## Milestone 10: Example adoption, smoke test and review

- [ ] Enable `interactive: "serve"` in `examples/basic/mokly.config.ts`, add
      the `interactive` export to `examples/basic/renderer.tsx` mirroring its
      providers, and add one example screen with a genuinely stateful shared
      component so Live is demonstrable.
- [ ] Run `npm run build`, `npm run example:build`, `npm run example:check`;
      smoke through `npm run dev`: switch to Live, exercise the stateful
      control, follow a catalogue link from the Live frame, switch back to
      Static, and confirm Changes and comparisons are unaffected; save
      screenshots under `.context/`.
- [ ] Confirm `mokly export` output contains no bundle, bootstrap or React
      and that `mokly check` ignores the option.
- [ ] Update `README.md` and `CHANGELOG.md` entries; move this plan to
      Completed in `plans/README.md` when the PR merges.
- [ ] Run the full check set and `cargo xtask check`; `git add -A`, commit
      with a Conventional Commits message, and push.
- [ ] Review: after the push, use `docs/implementation-review-prompt.md`
      against `origin/main` and report numbered findings with severity,
      impact and lettered options, without changing the implementation.

## Post-merge follow-up (non-blocking)

- Live inspection: measure boundaries in the mounted DOM and re-enable
  highlight and pick for Live frames.
- Live controls: apply prop edits to the mounted tree directly.
- `interactive: "export"`: ship the bundle in static exports on a separate
  host origin, after a decision on export size and hosting requirements.
