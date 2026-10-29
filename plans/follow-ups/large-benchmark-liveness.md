# Use progress as the large benchmark liveness signal

- **Severity:** Low. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** `scripts/large/`.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Design.
- **Category:** test.
- **Background:** The large benchmark uses a 300-second liveness deadline for build scenarios. Measured HTML and React builds take 467 and 921 seconds.
- **Problem:** A healthy build can exceed the fixed deadline without becoming stuck.
- **Impact if no action:** The benchmark can fail before producing a measurement.
- **Root question:** How should Mokly use progress as the large benchmark liveness signal?
- **Options:**
  - **A.** Raise the build deadline above the measured durations. Effort: Small.
  - **B.** Reset a liveness deadline after each progress record. Effort: Medium.
- **Left out:** Removing the deadline loses stuck-process detection.
- **Wider fix:** B. Progress-based liveness adapts to catalogue size without an elapsed-time result assertion.
- **Previous examples:** Batch 25 recorded the measured build durations.
- **Recommendation:** B. It distinguishes slow progress from a hung build.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6197).
