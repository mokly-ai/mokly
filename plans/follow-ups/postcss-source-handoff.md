# PostCSS takes its sources apart from the compiler

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-20, from round 2 of the implementation review of the
  branch `calummoore/mokly-stylesheet-resolution-evidence-fix-qnp4`, at
  commit `079b465e1`, finding 4. The final call split the finding: that
  branch applied option A, and this item holds option C.
- **Location:** `crates/mokly-css/src/types.rs:92`,
  `crates/mokly-css/src/compiler.rs:146`,
  `crates/mokly-render/src/stylesheet_compiler.rs:56`,
  `crates/mokly-render/src/postcss.rs:41` and line 66,
  `crates/mokly-css/src/_tests_/compiler_tests.rs:149`, and
  `crates/mokly-render/README.md:373`.
- **Reason:** Option C changes the shared `CssProcessor` trait and its mocks
  in two crates, beyond the cleanup that the branch needed.

- **Source:** Review.
- **Category:** Code structure.
- **Terms:**
  - **PostCSS:** the consumer's CSS processing step, which Mokly runs
    through its Node sidecar.
  - **Recording tree:** `RecordingTree`, the source tree of one stylesheet
    root that records each read and path check for the cache and the watch.
  - **Root adapter:** `RootPostCss`, the processor that `PostCss::for_root`
    builds with the recording tree and the resolver of one root.
- **Background:**
  - `CssProcessor`, at `crates/mokly-css/src/types.rs:92`, is the PostCSS
    seam of the core CSS compiler. Its `process` takes a path, the source,
    and the excluded set. The mokly-css `Compiler` owns the tree and the
    resolver of a compile, and it calls `process` at
    `crates/mokly-css/src/compiler.rs:146`.
  - `CapturingCompiler::compile`, in
    `crates/mokly-render/src/stylesheet_compiler.rs`, builds one recording
    tree and one resolver for each root. It gives both to the `Compiler`,
    and the same two values to `PostCss::for_root` at line 56. The root
    adapter keeps them for the nested-import check of each call.
  - `PostCss` holds the shared state of one attempt: the context lease, the
    request turns, the cache, the failure memo, and the module digests. Its
    read inventory reads through the shared, unrecorded `PostCss.tree`.
  - Since 2026-11-20, the root adapter is the only PostCSS processor. The
    direct `CssProcessor` implementation of `PostCss`, its stored resolver,
    and the constructor resolver are gone. The PostCSS tests run through
    `for_root`, with every assertion.
  - `mokly-css` and `mokly-render` have `publish = false`, so the trait is
    internal. Its implementations are `IdentityProcessor`, the root adapter,
    and the `CssProcessorMock` of unimock.
- **Problem:** PostCSS gets the tree and the resolver of a root through a
  separate hand-off, apart from the compiler that owns them. The pairing is
  correct today. Only the one call in `CapturingCompiler::compile` keeps it.
- **Impact if no action:** A later caller or processor can pair PostCSS
  with other sources, such as an unrecorded tree. Its reads then miss the
  records and the watch, as the stored resolver did before 2026-11-20.
- **Root question:** How can PostCSS read only through the sources of the
  compiler that calls it, with no separate hand-off?
- **Options:**
  - **A.** Keep the state that option A left on 2026-11-20. The root adapter
    is the only path, and the tests use `for_root`. Effort: Small.
  - **B.** Bind the recording tree of each root and a resolver over it in
    one root-source type, and let `for_root` accept only that type. It guards
    only the PostCSS side, because the `Compiler` keeps separate source
    fields. Effort: Small.
  - **C.** Add the tree and the resolver to `CssProcessor::process`. The
    `Compiler` passes its own on each call. `PostCss` keeps its shared
    attempt and inventory state and implements the trait once. Effort:
    Medium.
    - Retire `RootPostCss` and `for_root` in this change only.
    - Update `IdentityProcessor`, the `CssProcessorMock` expectation at
      `crates/mokly-css/src/_tests_/compiler_tests.rs:149`, each test that
      calls `process` or `for_root`, and the README entry at
      `crates/mokly-render/README.md:373`.
    - Keep every test and every assertion. Keep the nested-import check on
      each call and the PostCSS cache key.
- **Left out:**
  - A direct implementation under `#[cfg(test)]`, or one that wraps
    `for_root`. Both keep two entry paths.
  - A split of the shared attempt state of `PostCss`. It adds no protection.
  - A nested-import check inside the mokly-css compiler. C gives the same
    guarantee at a lower cost, and it keeps the side-specific dependency
    mapping in `mokly-render`.
- **Wider fix:** C. The compiler supplies its own sources on each call, so
  no caller or processor can read through other sources. The `rust` skill
  rule to move all users of a replaced API finds leftovers, but it does not
  remove the hand-off.
- **Previous examples:** The branch above moved compilation to one recording
  tree for each root, and the stored PostCSS resolver did not follow. Only
  tests still used it. Commit `f08d02dfb` removed the leftover viewer layers
  of another replacement.
- **Recommendation:** C. It removes the separate hand-off with one shared
  signature, and the behaviour stays the same.
- **Action:** fix after merge, apply C, because C changes the shared
  `CssProcessor` trait and its mocks in two crates, outside the branch that
  found it.
