# Plugin reports depend on Mokly's hook order

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from round 1 of the implementation review of the
  branch `calummoore/storybook-track-d-finish-nkpi`, finding 61, option D.
  The branch applied option B of that finding, a first-plugin report
  collector. This item is its wider fix.
- **Location:** `packages/mokly/src/sidecar/vite-plugin.ts:129`,
  `packages/mokly/src/sidecar/vite-plugin.ts:167`,
  `packages/mokly/src/sidecar/vite-css-transform.ts:92`,
  `packages/mokly/src/sidecar/vite-setup.ts:110`, and
  `packages/mokly/src/sidecar/vite-setup.ts:119`.
- **Reason:** D wraps the hooks of every third-party plugin of the setup, so
  it needs its own branch.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Vite adapter:** The optional compile path that compiles JavaScript and
    transforms stylesheets through the project's own Vite setup.
  - **Plugin report:** A file that a Vite plugin reports with
    `this.addWatchFile` or loads with `this.load` while Vite loads or
    transforms a module.
  - **Report collector:** The first Mokly plugin of the setup. Its
    `order: "pre"` load and transform hooks record the plugin reports of each
    module.
  - **Hook order:** Vite runs the hooks of one kind in three groups: hooks
    with `order: "pre"`, normal hooks, and hooks with `order: "post"`. Inside
    a group, it keeps the order of the plugins.
  - **Source inventory:** The list of source files that Mokly uses to stop
    their publication through document links.
- **Background:**
  - `docs/protocol/mokly-vite-adapter-inputs.md:22` makes each plugin report
    an input of the compile. `docs/protocol/mokly-vite-adapter-styles.md:32`
    makes each file that a stylesheet transform reports a watched input and a
    protected input of the source inventory.
  - Vite runs each `order: "pre"` hook before the normal hooks, at
    `node_modules/vite/dist/node/chunks/node.js:34179`. Vite's own
    `this.load` adds no graph edge, at `node.js:8806`.
  - Mokly puts its plugins first in the plugin list, at
    `packages/mokly/src/sidecar/vite-setup.ts:110`. The four plugins that
    Vite puts before the setup's plugins have no `order: "pre"` load or
    transform hook, at `node.js:34084`. The only `order: "pre"` hook of Vite
    8.3.8 is the build-only `renderStart` hook of `vite:prepare-out-dir`, at
    `node.js:34329`. Tailwind 4.3.3 sets `enforce: "pre"` with no hook order.
  - On 2026-11-25 the branch that found this item built the report collector.
    Its `order: "pre"` hooks install the wrappers of `this.addWatchFile` and
    `this.load` and return nothing. The collector keeps the record of each
    module until Vite transforms that module again. The JavaScript path and
    the stylesheet path both take their plugin reports from it. Mokly's own
    `load` hook at `vite-plugin.ts:129`, which returns Mokly's own sources,
    keeps its place.
  - The same branch put Mokly's protected-import resolver in an
    `order: "pre"` `resolveId` hook of a first Mokly plugin. That resolver
    must win, not only observe.
  - The later Storybook setup on the Vite adapter brings Storybook's core
    Vite plugins and its `viteFinal` hook into the setup.
  - After `resolveConfig`, `resolved.environments.ssr.plugins` holds the
    final plugin list of the SSR environment. It also holds the plugins that
    `applyToEnvironment` returns, which Vite creates after `patchPlugins`
    runs, at `node.js:37884` and `node.js:37888`.
  - `hookViteCss` restores the plugin context when its handler ends, at
    `packages/mokly/src/sidecar/vite-css-hooks.ts:89`.
- **Problem:**
  - The collector sees a report only when its own hook runs before the hook
    that reports. So it depends on Mokly's plugin staying first among the
    plugins with `order: "pre"` hooks.
  - A plugin that Vite or a later setup puts before Mokly's can still report
    a file that the collector misses. A new ordered Vite hook can too.
  - Before the direct fix, every setup plugin with an `order: "pre"` load or
    transform hook lost its stylesheet reports. On the JavaScript path, a
    file that such a hook loaded with `this.load` got no graph edge and no
    plugin input.
- **Screenshot:** In a Serve preview after a reported color input changes,
  mark the area that still uses the old color.
- **Impact if no action:** Serve can keep stale CSS or JavaScript output
  after an edit. A document can also publish a reported file that should be
  protected.
- **Root question:** How does Mokly record every file that a setup plugin
  loads or reports during a load or a transform, whatever the order of the
  plugin's hook?
- **Options:**
  - **A.** Give Mokly's stylesheet capture hooks `order: "pre"`. Add a
    regression test that checks the inline result of a pre-ordered plugin.
    The report hooks at `vite-plugin.ts:129` and line 167 also serve
    JavaScript. Effort: Small.
  - **B.** Start one report collector before the ordered load and transform
    hooks. Share its file classification with the JavaScript path, and keep
    actual stylesheet reads separate. The branch applied B on 2026-11-25.
    Effort: Medium.
  - **C.** Collect the reports from Vite's per-module graph for CSS and
    JavaScript. Keep early interception for loads that a plugin does without
    a watch call. Vite's graph merges plugin reports and code imports, at
    `node.js:26731`, so a file that the same module imports loses its report
    role. Effort: Medium.
  - **D.** Wrap the hooks of each plugin:
    - Wrap the `load` and `transform` handler of each plugin in
      `resolved.environments.ssr.plugins`, after `resolveConfig` and before
      `createServer`, at `vite-setup.ts:119`.
    - Each wrapper records the `this.addWatchFile` and `this.load` calls of
      its own handler, with the plugin name and the module id. It restores
      the context when the handler ends, as `hookViteCss` does.
    - Classify the record with the shared file rule of the collector, on
      both compile paths.
    - Cost: it changes the hook object of each third-party plugin. It must
      keep each `filter` and `order`. A frozen plugin object needs a copied
      entry.
    - Test an `order: "pre"` plugin that comes before Mokly's, and a plugin
      that `applyToEnvironment` returns.
    - Effort: Medium.
- **Left out:**
  - A broad watch rule. It fails the goal, because a watch rule does not make
    a file a protected input.
  - A contract that covers only the hooks after Mokly's. It fails the goal,
    because Serve then stays stale and the file stays unprotected.
  - A warning for a plugin with an ordered load or transform hook. It fails
    the goal, because the report is still lost.
  - A record of every file that the setup reads. The inputs protocol rejects
    it, because Vite reads some files in native code.
  - A patch of Vite's plugin context classes is not a real choice. Vite does
    not export them, so the patch depends on private code across the
    supported `^8.0.0` range.
  - Vite's container-wide `watchFiles` set, at `node.js:8832`, is not a real
    choice. It only grows, and it mixes the reports of every module.
  - D does not replace the protected-import resolver of the first Mokly
    plugin, because that resolver must win.
- **Wider fix:** D. D records the calls of each hook wherever Vite sorts it,
  so a plugin placed before Mokly's or a new ordered Vite hook cannot escape.
  B depends on its collector running first. D keeps the shared file rule of
  B.
- **Previous examples:** Commit `fa9b18de2` fixed dropped JavaScript plugin
  inputs. `plans/follow-ups/render-key-input-roles.md` records a shared
  boundary for those inputs.
- **Related:**
  - `plans/follow-ups/render-key-input-roles.md`: its option C reads the
    per-module record of plugin reports. Keep the record for each module id.
  - `plans/follow-ups/vite-sass-outside-root-reads.md`: its option E puts a
    check in the classification of the same record.
  - `plans/follow-ups/vite-renderer-pruning-css-modules.md`: each recorded
    stylesheet report joins the dependency set that the renderer pruning
    reads.
  - `plans/follow-ups/vite-tailwind-scan-scopes.md`: the same code. If D here
    lands, move the scan pattern rule of that item into the shared report
    rule of D.
- **Recommendation:** D. It records each report whatever the order of its
  hook, so the record does not depend on the position of Mokly's plugin.
- **Action:** fix after merge, apply D, because D wraps the hooks of every
  third-party plugin of the setup.
