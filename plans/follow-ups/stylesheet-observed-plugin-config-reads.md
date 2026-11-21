# Retain observed plugin configuration reads

- **Severity:** High. **Likelihood:** Common. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-21, from the stylesheet restart investigation on
  `calummoore/mokly-stylesheet-store-across-restarts-jffu`.
- **Location:** `crates/mokly-render/src/postcss_read_inventory.rs:182`,
  `crates/mokly-render/src/stylesheet_record.rs:180`, and
  `crates/mokly-render/tests/integration/support.rs`.
- **Reason:** The bug exists on unchanged main, outside the speed change.
  The performance orchestrator assigned its fix to a separate workspace.

- **Source:** Implementation.
- **Category:** Product bug.
- **Terms:**
  - **Browserslist configuration:** A file such as `.browserslistrc` that
    selects the browser targets Autoprefixer uses.
  - **Read witness:** Evidence of the exact bytes a plugin read through an
    observed Node file API.
  - **Stylesheet record:** A compiled stylesheet and the input stamps that
    Mokly checks before reuse in another preparation.
- **Background:** Mokly Serve retains stylesheet records between preparations.
  Its PostCSS child records observed file reads. The core keeps a source
  witness only when the file also occurs in the plugin dependency inventory.
  It keeps a module witness only when the file occurs in the module list.
- **Problem:** Autoprefixer reads `.browserslistrc` through an observed API,
  but the file occurs in neither retained set. The core drops its witness.
  A later preparation can reuse CSS from the old browser targets.
- **Impact if no action:** Serve delivers incorrect stylesheet bytes after a
  browser-target edit, even when the catalogue is explicitly prepared again.
- **Root question:** How should stylesheet reuse detect changes to observed
  plugin configuration inputs?
- **Options:**
  - **A.** Add special handling for Browserslist configuration names. This
    fixes the example but misses configuration files of other plugins.
    Effort: Small.
  - **B.** Retain mapped observed plugin reads as private reuse evidence,
    even when dependency messages do not name them. Preserve each witness
    and its provenance. Validate the retained inputs before reuse. Keep
    public-resource membership and protection rules separate. Effort: Medium.
  - **C.** Compile every opaque PostCSS root again in each preparation.
    This avoids stale reuse but removes the existing PostCSS reuse gain.
    Effort: Medium.
- **Left out:** A change only to Autoprefixer's dependency messages requires
  consumer-specific behavior and does not fix the core's discarded evidence.
  Restarting Serve is a workaround, not a correction of retained reuse.
- **Wider fix:** B. Retaining observed private inputs fixes the discarded-read
  cause without a list of plugin-specific configuration names.
- **Previous examples:** The same observed-read filter also excludes the
  repository `package.json` in a direct Basic PostCSS diagnostic. Its runtime
  effect was not tested. Opaque reads remain a separate class under
  `docs/protocol/mokly-sidecar-postcss.md`.
- **Recommendation:** B. Preserve evidence that the child already observed.
  Do not claim that this closes unknown native reads or makes coverage complete.
- **Action:** fix now, apply B in the separate correctness branch. On
  2026-11-21 the performance orchestrator assigned the fix to workspace 223.
  The stylesheet store branch must not fix it. It must merge `main` after
  that correctness pull request merges, before its store work starts.

## Reproduction and evidence

The regression was reproduced on main commit
`793d0c77d1b096eb988e681963be4bca7a8df353`, tree
`30d6c00c07a95fd1d31b5ec7eb419bba2996a357`.
The run used Node 24.21.0, npm 11.21.0, Autoprefixer 10.6.1, one real
sidecar, and the normal Serve edit preparation path.

Use `Consumer::single` from
`crates/mokly-render/tests/integration/support.rs`:

1. Replace its specs with one HTML screen that contains a paragraph.
2. Configure `main.css` for every route and `postcss.mjs` as the PostCSS module.
3. Set `main.css` to `p { user-select: none }`.
4. Set the PostCSS module to import `autoprefixer` and return
   `{ plugins: [autoprefixer()] }`.
5. Set `.browserslistrc` to `Safari 14` and prepare through a serving Runtime.
6. Change only `.browserslistrc` to `Chrome 130` and prepare in the same Runtime.
7. Create a fresh Runtime over the exact same source tree, dependency tree,
   physical inputs, pool, workers, and version. Give it an empty memory cache.
8. Enable stylesheet watching and Serve edit plans on both runtimes.
9. Read `styles/main.css` from each generation and compare the changed outputs.

The initial result and the same-runtime result both were:

```css
p {
  -webkit-user-select: none;
  user-select: none;
}
```

The fresh-runtime control was:

```css
p {
  user-select: none;
}
```

The captured `ProcessCss` request counts were 1 initially, 1 after the edit,
and 2 after the fresh-runtime control. The skipped compile is in the core
reuse path. The control proves that changed targets produce different CSS.

The named regression was
`integration::browserslist_reuse_tests::a_browserslist_edit_recompiles_css_in_a_serving_runtime`.
Its final assertion failed with
`the next Serve generation must use the changed browser targets`.
It compared the same-runtime CSS with the fresh-runtime CSS above.
Every setup and control assertion passed.

The selected run used:

```sh
cargo test --locked -p mokly-render --test integration_tests \
  integration::browserslist_reuse_tests::a_browserslist_edit_recompiles_css_in_a_serving_runtime \
  -- --exact --nocapture
```

Result: exit 101, 0 passed, 1 failed, 0 ignored, and 143 filtered out.
The test took 1.84 seconds. Compilation and the run took 66.82 seconds.
The failing test remains a diagnostic, not a failing test on the speed branch.

## Done when

The same-runtime result equals the fresh-runtime control after the target edit.
The test fails on the main commit above and passes with the correction.
Unchanged preparations retain reuse. Observed inputs remain private where
required. The correction adds no claim of complete opaque-read coverage.
