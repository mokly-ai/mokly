# Make the deployment test observe its step failure

- **Severity:** Low. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  user item 143, from finding 2 of the review of the 89 B and 90 C work.
- **Location:** `tests/browser/static_deployment_flow.spec.ts:42-80`,
  `:137-194`, and `:180`, and `tests/browser/README.md:86-92`.
- **Reason:** On 2026-10-21 the user deferred the open review items until
  after the merge and kept each choice for a later decision.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Deployment:** one published copy of a static catalogue site. A
    replacement deployment makes the open page load the next copy.
  - **Step:** one screen of a use-case flow, loaded as its own entry detail.
- **Background:**
  - The spec publishes the next deployment while a page is open. It checks
    that the shell never shows a stage that cannot be shown.
  - The review of 2026-10-21 found a test of this spec, then at lines
    130-182 on a rebuild branch, that passed on an abort alone. The
    replacement aborted the step's load before its 404 could arrive.
  - The test is now "a removed step that fails after another deployment
    keeps the use case loading", at lines 137-194. It holds the full page
    load, answers the removed step, and waits for the outgoing document's
    settled report before it releases the load.
  - `recordStepAnswer`, at lines 42-80, sends that settled report through
    `answer.then(report, report)` at line 69. So the report fires when the
    step load succeeds and when it is rejected, also by an abort.
- **Problem:**
  - The test ignores a failed `route.continue` with
    `.catch(() => undefined)`, at line 180.
  - It never asserts that the step response has status 404.
  - Its storage check, at lines 187-192, checks only that the stage is busy
    and that no unavailable stage was seen. It checks no failure alert.
  - So the test can still pass on the abort alone, without the step failure
    that its title names.
- **Impact if no action:** The test does not protect failure delivery, so a
  regression can pass unnoticed.
- **Root question:** How does the deployment test prove the behaviour that
  its title states?
- **Options:**
  - **A.** Rename the test, reword its comment and the README text, and
    record and assert the abort that it reaches. Effort: Small.
  - **B.** Add an explicit failure-ready signal, and assert the 404 before
    the replacement abort. Effort: Medium.
- **Left out:** Keep the current title and assertions. The test then still
  cannot fail for its stated behaviour. Fewer than three approaches exist,
  because the test either proves the failure or stops claiming it.
- **Wider fix:** B. An explicit signal makes the failure part of the
  scenario.
- **Previous examples:** The second test of the spec asserts the 404 at line 282. Its title is "a removed step that fails before the other details
  keeps the use case loading".
- **Recommendation:** A. It makes the test state only the behaviour that
  its scenario can prove. B best protects failure delivery.
- **Action:** ask the user, because condition 5 holds: on 2026-10-21 the
  user deferred the open review items past the merge to decide each one
  later.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6090).
