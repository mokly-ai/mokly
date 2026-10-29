# Decide the publish render-cache lifetime

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #222 and its completed plan.
- **Location:** `crates/mokly-cli` publication output.
- **Reason:** The review or plan deferred this work until after PR #222.

## Task

`publish` keeps the render cache alive through upload because its output owns the cache. Measure the cost and decide whether to release it earlier.

## Decision

- **Source:** Design.
- **Category:** performance.
- **Background:** Publication builds output and then uploads it. The publication output owns the render cache through both phases.
- **Problem:** The upload can retain a large cache that it no longer uses. The cost has not been measured.
- **Impact if no action:** Publication can keep avoidable memory until every upload ends.
- **Root question:** How should Mokly decide the publish render-cache lifetime?
- **Options:**
  - **A.** Keep the cache through upload. Record no new measurement. Effort: Small.
  - **B.** Measure retained bytes. Release the cache before network upload when the output no longer needs it. Effort: Medium.
- **Left out:** A separate upload-process cache has no upload consumer and adds complexity.
- **Wider fix:** B.
- **Previous examples:** The render-cache weight plan measured cache ownership in build and Serve.
- **Recommendation:** B. It uses evidence and ends ownership at the last consumer.
- **Action:** ask the user, because condition 6 holds. This performance or process change needs the user to choose its cost.

The full historical record is in the [plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/render-cache-weight-and-watch-recheck.md?plain=1#L422).
