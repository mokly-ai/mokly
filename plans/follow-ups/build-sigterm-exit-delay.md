# Build exits late after SIGTERM in its output step

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-01, from the branch `conductor/rust-rebuild-59-performance-follow-ups`, which changed the large benchmark harness but not the build's signal handling.
- **Location:** `crates/mokly-static/src/fingerprint.rs:87` and `:136`, the two `output.input-read` spans, and the cancellation checks of `crates/mokly-cli/src/build.rs:167`.
- **Reason:** The delay showed once, with the debug binary, during a harness run. Nobody reproduced it with the release binary.

- **Source:** Implementation.
- **Category:** Product bug.
- **Terms:**
  - **Large benchmark harness:** the opt-in scripts under `scripts/large/`,
    which run `mokly build` on the generated large fixture and stop it with
    SIGTERM, then SIGKILL 10 seconds later.
  - **Output reservation:** the lock directory
    `.mokly-export-reservations/locks/{output}` that a build holds while it
    writes its output. A build that a signal kills cannot remove it.
- **Background:**
  - On 2026-10-28, the harness ran
    `mokly build --debug-timings --strict --base {baseline}` on the default
    large React fixture, with the debug binary that `npm run build`
    installs. The fixture had 1,620 routes and 5,850 documents.
  - The harness sent SIGTERM at its 300-second deadline. The build's last
    timing line ended at 295,979 ms, in the `output.input-read` span.
  - The build did not exit within the next 10 seconds, so the harness sent
    SIGKILL. The harness reported `Fixture command exited with SIGKILL`.
  - The killed build left `.mokly-export-reservations/locks/mokly-static` in
    the fixture. Every later build of that fixture then failed with
    `[mokly/export-invalid] Output is reserved.` until the lock was removed
    by hand.
  - `crates/mokly-cli/src/build.rs:167` checks cancellation at every build
    phase. The output read spans of `crates/mokly-static/src/fingerprint.rs`
    may not check it while they read.
- **Problem:** A build in its output step can take more than 10 seconds to
  stop after SIGTERM. A second signal then kills it and leaves its output
  reservation behind.
- **Impact if no action:** A tool or a person that stops a build with a
  short grace period can leave a reservation that blocks every later build
  until a manual recovery.
- **Root question:** How does a build stop within a short grace period at
  any phase?
- **Options:**
  - **A.** Reproduce with the release binary first: run the build on the
    large React fixture, send SIGTERM during `output.input-read`, and time
    the exit. Close the item when the release binary exits within
    10 seconds. Effort: Small.
  - **B.** Check cancellation inside the output read loop of
    `fingerprint.rs`, so that a requested stop ends the read between files.
    Effort: Small.
  - **C.** Release the output reservation in the cancellation path of
    every phase, so that a cancelled build never leaves it. Effort: Medium.
- **Left out:** A longer grace period in the harness. It hides a slow stop
  and does not help other callers.
- **Wider fix:** C. A cancellation that always releases the reservation
  removes the blocked later builds for every phase.
- **Previous examples:** None found.
- **Recommendation:** A, then B when the release binary also exits late.
  The delay was seen only with the debug binary.
- **Action:** fix after merge, apply A, because the delay has no release
  reproduction and the branch that found it does not touch the build.
