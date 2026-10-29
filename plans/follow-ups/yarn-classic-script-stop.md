# Stop Yarn Classic dependency scripts

- **Severity:** High. **Effort:** Large.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** The platform process owner and Yarn Classic base installation.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Review.
- **Category:** product bug.
- **Background:** Yarn Classic starts dependency scripts in a new process session on Linux and macOS. Mokly stops only its original process group.
- **Problem:** A cancellation can leave dependency scripts running after Mokly exits.
- **Impact if no action:** Orphaned consumer code can keep changing files or using resources.
- **Root question:** How should Mokly stop Yarn Classic dependency scripts?
- **Options:**
  - **A.** Document the process leak. Effort: Small.
  - **B.** Keep lifecycle scripts disabled for Yarn Classic on Unix and warn when requested. Effort: Small.
  - **C.** Make the platform process owner stop every descendant across new sessions. Effort: Large.
- **Left out:** Sending only another group signal cannot reach a new session.
- **Wider fix:** C. Descendant ownership removes the class for every child process.
- **Previous examples:** Review finding 42 reproduced the new-session behavior on Linux and macOS.
- **Recommendation:** C. It preserves script support and guarantees cleanup.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6109).
