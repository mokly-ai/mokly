# Session error handler fails on null params

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-22, from round 3 of the review of the branch
  `calummoore/mokly-earlier-postcss-start-bdhv`, whose finding check listed
  it outside the scope.
- **Location:** `packages/mokly/src/sidecar/session.ts:52`, the error
  handler of `Session.call`.
- **Reason:** The branch that found it does not change `Session.call`, so a
  separate change fixes the handler.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Session:** the sidecar class that dispatches each request to its
    method, in `packages/mokly/src/sidecar/session.ts`.
  - **Error handler:** the `catch` block of `Session.call`. It turns an
    error that is not a `SidecarError` into `bundle-failed` or
    `render-failed`, with the entry files of the request's generation in the
    message.
- **Background:**
  - The handler reads `"generation" in request.params` to choose the text of
    the message.
  - When a request has `null` params, that expression throws a type error
    inside the handler. The sidecar entry then answers `render-failed` with
    the text of that second error, not of the first one.
  - The same-version binary always sends typed params, so only a malformed
    frame or a test reaches this path. The process stays usable either way.
  - The test "After a failed prepareContext, a prepared bundle starts no
    PostCSS child, and the first processCss starts it" in
    `tests/sidecar_prepared_child_start.test.ts` sends such a request to make
    `prepareContext` fail.
- **Problem:** A failure inside the handler replaces the code and the message
  of the request's own error.
- **Impact if no action:** A malformed request reports `render-failed` with a
  message about the handler, so the cause of the first error is lost.
- **Root question:** How does the session report the error of a request,
  whatever shape its params have?
- **Options:**
  - **A.** Guard the expression: use the generation only when the params are
    an object that holds a `generation` string. Add a test that sends `null`
    params and expects `bundle-failed` with the text of the first error.
    Effort: Small.
  - **B.** Reject a request whose params are not an object in the sidecar
    entry, with `sidecar-protocol`, before the session reads it. It changes
    the reply of a malformed frame from a usable error to a protocol error
    that replaces the process. Effort: Small.
- **Left out:** Change nothing: it fails the goal, because the first error is
  lost.
- **Wider fix:** None. The decision in `docs/protocol/mokly-sidecar.md` that
  each side trusts the frames of the same version already limits checks of
  every frame field.
- **Previous examples:** None found.
- **Recommendation:** A. It keeps the reply that the test relies on, and it
  reports the first error.
- **Action:** fix after merge, apply A, because the handler is outside the
  diff that found the problem, and only a malformed frame reaches it.
