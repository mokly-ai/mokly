# Linked renderer path drops its stylesheet root

- **Severity:** High (estimate). **Likelihood:** Rare (estimate). **Effort:** Medium (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #240 and its completed plan, which put the
  problem outside the scope of its first review.
- **Location:** `crates/mokly-render/src/stylesheets.rs:98` to line 127,
  and `crates/mokly-render/src/graph.rs:135`.
- **Reason:** The path difference is older than PR #240, and the review found
  it outside the diff of that change.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Renderer:** the module that the `renderer` field of
    `mokly.config.json` names. It wraps React screens in the product's
    providers, and its stylesheets apply to every screen.
  - **Stylesheet root:** one module whose imported stylesheets the render
    runtime bundles into one CSS output for the documents that use it.
- **Background:**
  - `crates/mokly-render/src/graph.rs:135` reads the renderer path from the
    configuration.
  - `crates/mokly-render/src/stylesheets.rs:98` to line 127 walks the module
    graph from that path. When the walk finds stylesheets, it adds a
    stylesheet root for the renderer.
  - The module graph names each module by its real path.
  - PR #240, merged on 2026-10-28, gave config-relative paths one normalized
    form. It fixed the renderer spellings with `.`, `..`, and empty
    segments, which lost the renderer stylesheet before.
- **Problem:** A renderer configured through a symbolic-link directory, such
  as `link/renderer.tsx`, keeps its link path. The module graph names its
  real path, so the walk finds no module, and the renderer gets no
  stylesheet root. The review of PR #240 showed this with a probe on
  2026-10-28.
- **Impact if no action:** The build exits 0 and renders every React screen
  without the renderer's styles, with no warning. A comparison also misses
  an edit of that stylesheet, because both sides lack it.
- **Root question:** How does the renderer get its stylesheet root, whatever
  path spelling reaches the renderer module?
- **Options:**
  - **A.** Resolve the configured renderer path to its real path before the
    stylesheet walk, as the module graph names modules. Effort: Small
    (estimate).
  - **B.** Warn when the configured renderer is not in the module graph, and
    keep the current roots. The build still lacks the styles. This adds a
    warning. Effort: Small (estimate).
  - **C.** Give every configured module path, the renderer and the PostCSS
    module included, one resolved form at configuration load, so that no
    consumer compares a link path with a real path. Effort: Medium
    (estimate).
- **Left out:** Rejecting a renderer path that goes through a link. Links to
  modules inside the repository are valid input for the sidecar, so the
  rejection would remove a working layout.
- **Wider fix:** C (estimate). One resolved form removes the link and real
  path difference for every consumer.
- **Previous examples:** PR #240 fixed the renderer spellings with `.`, `..`,
  and empty segments on 2026-10-28, which had the same symptom.
- **Related:**
  - [config-repository-root-symlink.md](./config-repository-root-symlink.md)
    is the second linked-path problem that the same review found. It
    concerns the containment checks of the configuration.
  - [postcss-link-message-contract.md](./postcss-link-message-contract.md)
    asks which configured paths, the renderer included, name an unresolved
    symbolic link when they fail in the base tree of Changes. It is the same
    class of link handling in another reader.
- **Recommendation:** C (estimate). It removes the cause for the renderer
  and for every other configured module path.
- **Action:** fix after merge, apply C (estimate), because a silent loss of
  styles is a product bug outside the reviewed diff, and C is not blocked.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/normalize-config-relative-paths.md?plain=1#L327).
