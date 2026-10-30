# Identify the static CORS console notice source

- **Severity:** Low. **Effort:** Small.
- **Kind:** Outside the scope.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: an M8 browser follow-up of the rebuild.
- **Location:** `tests/browser/static_cors.spec.ts:19` and
  `tests/browser/console_notices.ts:13`.
- **Reason:** The test failed once in an unrelated gate run and passed
  unchanged in isolation, so a separate branch investigates it.

- **Source:** Review.
- **Category:** Test (estimate).
- **Terms:**
  - **Sandbox notice:** Chrome's console message `Blocked script execution in '{url}' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
  - **Console policy:** the shared rule in `tests/browser/console_notices.ts`
    that decides which console messages a browser check accepts.
- **Background:** The test and the console policy work as follows.
  - The test "a public embedded viewer fetches copied data without credentials
    or live endpoints" installs Playwright's fake clock.
  - Then it opens a host page that embeds the viewer in sandboxed frames.
  - Chrome reports each script that tries to run in such a frame with the
    sandbox notice.
  - The console policy accepts the notice for the viewer's own sandboxed
    documents.
  - It also accepts the exact `about:blank` notice when its location is empty
    or `about:blank`.
- **Problem:** In one gate run, the test reported the sandbox notice from
  `about:blank` and failed, and it passed unchanged in isolation. The record
  does not give the notice location or the full failure text. The suspected
  source is clock or trace injection during sandboxed frame navigation, and
  the record says to keep the assertions and the console policy.
- **Impact if no action:** A gate can fail on this test without a product
  change, and the developer must rerun it.
- **Root question:** Where does the unexpected sandbox notice come from,
  and does the console policy already accept it?
- **Options:**
  - **A.** Confirm the notice origin before a separate fixture fix. Repeat
    the test, record the notice text and its location, and record the pass
    counts. Effort: Small.
  - **B.** Apply A, then make the fixture deterministic for that origin,
    for example by installing the clock before the frames navigate. Keep
    every assertion and the console policy. Effort: Small (estimate).
- **Left out:** Accepting every sandbox notice hides real script failures,
  so it breaks the console policy.
- **Wider fix:** None. The shared console policy is already the one rule
  for these notices.
- **Previous examples:** The console policy says that Playwright's trace
  recorder and `page.clock` injections can cause the notice in a transient
  `about:blank` frame.
- **Related:** [frame-adapter-message-flake.md](./frame-adapter-message-flake.md)
  is the other one-time failure in the same list of browser follow-ups of
  the rebuild. There, a frame adapter test once got no navigation event. It
  has a different test and a different suspected source, so each item needs
  its own reproduction and fix.
- **Recommendation:** A. The record recommends confirming the origin
  first, and the current policy may already accept the notice.
- **Action:** ask the user (estimate), because the failure has not been
  reproduced, and the flaky-test rule asks the user for an unknown source.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L4701).
