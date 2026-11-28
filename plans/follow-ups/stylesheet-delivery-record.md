# Stylesheet drops read watch names, not delivered files

- **Severity:** High. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-28, from review round 1 of the branch
  `calummoore/storybook-track-e-storybook-folders-87sk`, the wider fix E of
  finding 202, which also covers a new problem of its finding check.
- **Location:** `crates/mokly-render/src/bundle_styles.rs:145`, where
  `prepare_roots` drops the renderer's and the preview's files from a later
  root. `crates/mokly-render/src/bundle_styles.rs:171`, where
  `stylesheet_closure` builds the drop set from the recorded inputs of a
  bundle. `crates/mokly-css/src/compiler_assets.rs:58`, where the compiler
  records the link name and the real path of a stylesheet.
  `crates/mokly-css/src/resolver.rs:200`, where the CSS resolver names a
  nested `@import` by its link path.
- **Reason:** The fix changes the renderer pruning that is already on the
  primary branch and the shared stylesheet bundle record, outside the diff of
  the branch that found it.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Root:** A delivery root: a module or stylesheet that gets its own
    stylesheet bundle, such as the renderer, a preview file, or a stories
    file.
  - **Closure:** The stylesheets of a root's bundle, with every nested
    `@import`.
  - **CSS Module:** A stylesheet whose local class names contain a hash of the
    path that Mokly compiled it under.
  - **Class map:** The map from authored class names to the generated names
    that JavaScript puts in the rendered HTML.
  - **Link name:** The path of a file through a workspace or package link. The
    same file also has its real path.
- **Background:**
  - The section "Roots, Collection And Deduplication" of
    `docs/protocol/mokly-imported-styles.md` gives the drop rule. Each later
    root drops every file of the renderer's closure, and a stories file root
    also drops every file of its preview's closure. The first linked root
    wins.
  - The drop set of a later root is the list of inputs that the earlier
    bundle recorded. That list serves two jobs: the files that the earlier
    bundle delivered, and the names that Mokly keeps for watching, caching,
    and source protection. For a stylesheet read through a link, the
    compiler records the link name and the real path.
  - On 2026-11-28 a review found that a CSS Module could lose its selectors
    this way. A preview's CSS reached `node_modules/pkg/theme.module.css`
    through a link, and a story imported `packages/pkg/theme.module.css`
    from JavaScript. The story dropped the module, but the preview had
    emitted selectors hashed with the link path.
  - The branch that found it fixed that case. A CSS Module counts as
    delivered only under a path that has a class map in the earlier root's
    bundle, for the renderer and the previews, on both compile paths. Every
    other closure name still drops, the link names of plain CSS included.
  - The same review found a second case that stays open. On the esbuild
    path, a linked stylesheet that a preview imports through JavaScript has
    its real path as its name. The CSS resolver names the same file by its
    link path in a stories file's `@import`. The drop set then misses that
    name, so the story bundle keeps the import.
  - The renderer has the same second case. It was already on the primary
    branch before that review.
- **Problem:** The drop rule reads watch and protection names, not the files
  that each bundle delivered under each name. A linked plain stylesheet that
  a story reaches under its other name then comes back after the preview's
  later rules.
- **Impact if no action:** A story can show a repeated stylesheet that
  overrides the rules of its preview, so the story differs from Storybook
  with no error.
- **Root question:** How does a later root drop exactly the stylesheets that an
  earlier root already delivered, under every name that reaches them?
- **Options:**
  - **A.** Give each stylesheet bundle a delivery record:
    - The record names each plain stylesheet by its physical identity and
      each CSS Module by the path of its class map.
    - Drop and prune from that record. This includes a later root's nested
      `@import` that reaches a delivered plain file under its other name.
    - Keep the link names only in the watch, cache, and protection records.
    - Cost: a new field of the stylesheet bundle record in `mokly-css` and in
      every test literal of that record, identity checks in the compiler, and
      a change to the renderer pruning.
    - Effort: Medium.
  - **B.** Give a linked stylesheet one identity across both source paths and
    both import pipelines. This needs one shared rule for class names, and it
    changes existing generated names. Effort: Large.
- **Left out:**
  - Turn off the preview drop for all stylesheets. The preview's CSS then
    repeats in each story bundle, against the rule that the first linked
    root wins.
  - Name the files of the JavaScript graph by their link paths. The sidecar
    module rules name a linked file by its real path, and esbuild and Vite
    key modules by that path.
  - Fail the build when two names reach one stylesheet. It is a new build
    error, which needs the user, and it fails a project that Storybook
    builds.
- **Wider fix:** A. One record of what each bundle delivered serves every drop,
  under every name and on both compile paths.
- **Previous examples:** None found.
- **Related:** `plans/follow-ups/cold-stylesheet-batch-after-prerequisites.md`:
  the same code. Its batches carry the drop sets of the earlier roots, so
  under A they must carry the delivery record.
- **Recommendation:** A. It separates delivery from watching, so each drop
  matches the CSS that the earlier root emitted.
- **Action:** fix after merge, apply A, because it changes the renderer pruning
  that is already on the primary branch and the shared stylesheet bundle
  record.
