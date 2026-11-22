# Prepared PostCSS child has two start paths

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-22, from the branch
  `calummoore/mokly-earlier-postcss-start-bdhv`, round 2 of its
  implementation review. That branch added the `prepareContext` request.
- **Location:** `packages/mokly/src/sidecar/session.ts` (the `bundle` case,
  which calls `this.workers.prepare` for a `preparation`), and
  `docs/protocol/mokly-sidecar-postcss.md` ("Prepared Contexts").
- **Reason:** The recommended option changes protocol text that the performance
  orchestrator approved on 2026-11-22, and the next change to the child start
  can take it with its own protocol check.

- **Source:** Review.
- **Category:** Code structure.
- **Terms:**
  - **Prepared child:** the PostCSS child process that a sidecar starts for a
    prepared context before the first stylesheet needs it.
  - **`prepareContext`:** the sidecar request that the pool sends, for each
    `bundle` request with a preparation, to the same process after the slot
    cleanup and before the bundle cache read and the seed. It starts the
    prepared child and answers at once.
  - **Leftover layer:** code that keeps an old way working beside the new way.
- **Background:**
  - Since #464, the `bundle` request starts the prepared child when it reaches
    the sidecar.
  - Since 2026-11-22, `prepareContext` starts it earlier. The approved protocol
    text says: "A `bundle` request starts the preparation only when no earlier
    request did."
  - The design call of 2026-11-22 kept the `preparation` member of the `bundle`
    request, so that the sidecar disposes the context when the `bundle` request
    fails.
  - In every product flow, `prepareContext` reaches the process first, also on a
    retry, and its handler always answers `null`. So the start in the `bundle`
    case never starts a child. `PostcssWorkers.prepare` starts no second child
    for a context that it already prepares.
  - Some session tests still start prepared children through `bundle`, which no
    product flow does.
- **Problem:** Two requests can start one prepared child. Only one start path
  runs in the product.
- **Impact if no action:** Each later change to the child start, such as an
  earlier start in a light sidecar entry, must keep both paths on one
  preparation, or a second child starts.
- **Root question:** How does each prepared child keep one start path that the
  product uses and the tests cover, so that no later change starts a second
  child?
- **Options:**
  - **A.** Change nothing. The `bundle`-side start stays as a fallback.
    Effort: Small.
  - **B.** Remove only the start in the `bundle` case. The `bundle` request
    keeps its `preparation` member and its release on failure. After a failed
    `prepareContext`, the first `processCss` starts the child, as for a context
    without preparation, so no output changes. Change the protocol sentence
    above, the `docs/protocol/mokly-sidecar-memory.md` sentence that names "a
    `prepareContext` or `bundle` request", the `session.ts` and `postcss.ts`
    entries of `packages/mokly/src/sidecar/README.md`, and the doc comment of
    `Pool::prepare_context` in `crates/mokly-sidecar/src/pool_requests.rs`.
    Remove the start assertions of the test "Bundle starts preparation before
    compilation and does not await it" under the removal rule of the `testing`
    skill, and keep its reuse assertions. Move the other session tests of
    prepared children to `prepareContext`. Effort: Medium.
  - **C.** Do B, and stop sending the `preparation` member to the sidecar; the
    core's release ends the child of a failed `bundle` request. It needs a
    wire type for `bundle` that differs from the pool API. Effort: Large.
  - **D.** Do A, and move the session tests of prepared children to the product
    order: each sends `prepareContext` before its `bundle` request and keeps
    every assertion. The two tests of the `bundle`-side start stay. No
    requirement changes. Effort: Small.
  - **E.** Do B, and send the sidecar only the context of the `preparation`
    member, so that the type prevents a start from a `bundle` request. Effort:
    Large.
- **Left out:** Keep only the `bundle`-side start and remove `prepareContext`:
  it fails the goal of the earlier start. A public `prepareContext` from the
  core before its `bundle` call: it breaks the approved condition that
  `prepareContext` reaches the process inside the slot claim of its `bundle`
  request.
- **Wider fix:** None. The "Replacing an old way" rule of the `plans` skill
  already covers leftover layers.
- **Previous examples:** #464 put the start in the `bundle` request.
- **Recommendation:** B. It leaves the one start path that the product uses,
  keeps the release, and changes no output.
- **Action:** ask the user, because B changes approved protocol text, and no
  recorded decision covers that change.
