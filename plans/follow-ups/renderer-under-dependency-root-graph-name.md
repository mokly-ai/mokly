# A renderer under a package root loses its CSS

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-28, from review round 2 of the branch
  `calummoore/storybook-track-e-storybook-folders-87sk`, the check of finding
  304, option D.
- **Location:** `crates/mokly-graph/src/styles.rs:259`,
  `crates/mokly-render/src/bundle_styles.rs:127`,
  `crates/mokly-graph/src/render_preparation.rs:108`, and
  `docs/protocol/mokly-configuration.md:76`.
- **Reason:** The renderer lookup is older than the branch that found the
  problem, and that branch fixed only the same lookup for Storybook previews.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Package root:** a configured directory whose `node_modules` supplies
    dependencies, from `moduleResolution.packageRoots`.
  - **Module graph:** the sidecar's list of compiled modules and their
    imports, keyed by logical names such as `node_modules/pkg/file.ts`.
  - **Renderer:** the optional configured module that wraps every React
    screen and component render.
- **Background:**
  - The core finds the configured renderer in the module graph by its
    resolved repository path, to bundle its CSS, to link that CSS, and to give
    entry modules a precise render key.
  - The graph names a file under a selected dependency root by its logical
    `node_modules/...` name, not by its repository path.
  - `docs/protocol/mokly-configuration.md:76` says that resolved paths match
    the sidecar graph.
  - Finding 304 of the same branch had this mismatch for Storybook previews.
    Its fix stores the logical name from the compiler's own edge in the
    preview selection record.
- **Problem:** A configured renderer whose real file is under a selected
  dependency root is not found in the graph. Mokly then does not bundle or
  link its CSS, and entry modules fall back to the whole-bundle render key.
- **Impact if no action:** Documents render without the renderer's CSS, and
  Serve rebuilds every entry on any change.
- **Root question:** How does the core find the configured renderer in the
  compiler's module graph, wherever its real file lives?
- **Options:**
  - **A.** Map the renderer's repository path to its logical name in the core
    from the side's dependency mappings, as `SideInputs::logical_dependency`
    does for PostCSS. Effort: Medium.
  - **B.** The bundle result reports the graph name of each root module that
    the virtual entry imports, including the renderer, from the compiler's own
    edge. The core finds the renderer only through that name. Correct
    `docs/protocol/mokly-configuration.md:76`. Effort: Medium.
- **Left out:** Rejecting a renderer under a package root: it adds a new
  build error and breaks setups that render today without CSS.
- **Wider fix:** B, because the compiler's own name serves every remap.
- **Previous examples:** Finding 304 of the branch above, for previews.
- **Recommendation:** B. It uses the same record as the preview fix.
- **Action:** fix after merge, apply B, because the lookup is outside the
  scope of the branch that found it.
