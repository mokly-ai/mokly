# Story failures travel as successful fragments

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Fix after merge.
- **Added:** 2026-11-25, from the implementation review of the branch
  `calummoore/storybook-track-f-failed-stories-omid`, finding 3 of round 1.
  It is the wider fix that the agent split off, with the costs from its
  finding check.
- **Location:**
  - `crates/mokly-html/src/fragment.rs:52-81`: `Fragment`, with its optional
    `story_failure` field, and `StoryRenderFailure`. `:142-147`: the
    `FragmentRenderer` trait, whose `render` returns `Result<Fragment>`.
  - `crates/mokly-render/src/fragments.rs:67-82`: the sidecar renderer,
    which turns a failed story render into an `Ok` fragment.
  - `crates/mokly-graph/src/fragments.rs`, `MemoFragments::render`: the
    fragment cache.
  - `crates/mokly-graph/src/temporary.rs`, `PropsJob::artifact`: the
    same-props shortcut of the live props preview.
  - `crates/mokly-html/src/prepared_root.rs:54-59`:
    `PreparedRoot::into_ready`.
- **Reason:** The direct fix already guards the cache, and the typed result
  reaches about 20 files that implement or mock the renderer trait.

- **Source:** Review.
- **Category:** Code structure.
- **Terms:**
  - **Fragment:** `Fragment` in `crates/mokly-html/src/fragment.rs`, the
    output of one JavaScript render: its HTML, styles, markers, and records.
  - **Renderer trait:** `FragmentRenderer` in the same file, which each
    renderer implements and many tests mock.
  - **Story failure:** the result of a story whose own work throws, with the
    story id, the story name, and the reason.
  - **Fragment cache:** `MemoFragments` in
    `crates/mokly-graph/src/fragments.rs`, which keeps each rendered fragment
    under a key of the handle, the props, and the view.
  - **Live props preview:** the render of edited props for the Props tab,
    through the temporary preview route of Serve, the local development
    server.
- **Background:**
  - The result design call: on 2026-11-25, track F of the Storybook support
    plan decided that the sidecar returns a failed story render as a result,
    not as an error. The result holds the story's name and its reason. The
    core then writes the error document and the `story-render-failed`
    warning.
  - The sidecar renderer turns that result into an `Ok` fragment with empty
    HTML and the `story_failure` field set. So a story failure has the type
    of a successful render.
  - In the live props preview, a story failure gives the generic
    `render-failed` preview failure with HTTP 422. The Props tab then offers
    **Try again**.
  - Before the review fix of 2026-11-25, the fragment cache kept every `Ok`
    fragment, also a story failure. **Try again** with the same props then
    read the cached failure and did not run the story again. So a transient
    story failure blocked a valid edit until its cache entry went or an input
    changed.
  - The same-props shortcut of the live props preview could also return the
    cached error document of the saved view to a live request.
  - The review fix of 2026-11-25, in the same branch, fixed both sites. The
    fragment cache keeps no fragment with a story failure. The same-props
    shortcut skips a saved document that holds a story failure. Each site
    checks the failure field itself.
  - The document cache keeps the error document of a saved view on purpose.
    Section "The Warning" of `docs/protocol/mokly-storybook-failures.md`
    says that a reused document keeps its warning. So the same-props
    shortcut keeps its own check under each option below.
  - About 20 files implement or mock the renderer trait, in
    `crates/mokly-html`, `crates/mokly-graph`, and `crates/mokly-render`.
  - Some sites treat each renderer error as a fatal render.
    `PreparedRoot::into_ready` turns each error into a fatal attempt.
- **Problem:** The renderer trait gives a story failure the type of a
  successful fragment. So each site that caches or reuses a fragment must
  check the failure field. A new site that does not check it can serve a
  failure as reusable output again.
- **Impact if no action:** A later cache or reuse site can bring back the bug
  of 2026-11-25, in which **Try again** reused a failure. Each new
  implementation or mock of the trait adds to the cost of the type change.
- **Root question:** How can the types of the renderer keep a story failure
  from becoming reusable render output, at every site?
- **Options:**
  - **A.** Keep the renderer trait, and give the fragment cache its own
    stored type, which only a fragment without a story failure can build.
    The cache is then safe by its type. Each other site that keeps a fragment
    still needs its own check. Effort: Small.
  - **B.** Give the renderer a new result type: an enum with a rendered
    fragment or a story failure. Remove the failure field from `Fragment`.
    The fragment cache then accepts only a rendered fragment. The new type
    reaches the renderer trait and about 20 files that implement or mock it.
    Effort: Medium.
  - **C.** Make a story failure an error variant of the renderer. The cache
    keeps no error, so it never keeps a failure. Each site where an error
    means a fatal render then needs an exception, such as
    `PreparedRoot::into_ready` in `crates/mokly-html/src/prepared_root.rs:54`.
    A missed exception makes a failed story fatal again. The error variant
    also goes against the result design call. Effort: Medium.
- **Left out:**
  - Change nothing: each new site then depends on a check that the type does
    not ask for.
  - A retry count in the cache key: it keeps unusable entries and makes
    successful results harder to reuse.
  - Live requests that bypass the fragment cache: they render each repeat
    request again, also one that succeeded, and they protect the live route
    only.
- **Wider fix:** B. The input type of the fragment cache then cannot hold a
  story failure.
- **Previous examples:**
  - The bug of 2026-11-25 above, which the direct fix handled at two sites.
  - Commit `bc858df42`, "perf(graph): share link checks within each
    generation (#314)", added the test
    `a_transient_target_error_is_not_retained_as_an_anchor_result` in
    `crates/mokly-graph/src/_tests_/validation_retry_tests.rs:21`. It shows
    that a transient render failure must leave the next attempt free to
    succeed.
- **Related:** `plans/follow-ups/links-to-failed-stories-fail-builds.md`, the
  same cause. Its option C gives both anchor checks one failed-view state.
  The result type of B here can carry that state. Neither fix waits for the
  other.
- **Recommendation:** B. It keeps a story failure a result, as the result
  design call says, and the type then guards every site that caches a
  fragment.
- **Action:** fix after merge, apply B, because the direct fix guards both
  sites, and the typed result reaches about 20 implementations and mocks
  outside the diff.
