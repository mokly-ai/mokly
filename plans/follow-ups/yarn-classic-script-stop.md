# Stop Yarn Classic dependency scripts

- **Severity:** High. **Likelihood:** Rare (estimate). **Effort:** Large.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan: user item 150, finding 42 of the review of user decision 135 B.
- **Location:** `crates/mokly-platform/src/unix.rs:59`,
  `crates/mokly-platform/src/unix.rs:85`, and
  `docs/protocol/mokly-runtime.md:231`.
- **Reason:** A user rule of 2026-10-21 deferred each new review item of
  PR #199 until after its merge, for the user's later choice.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Process owner:** the platform code in `crates/mokly-platform` that
    starts each child in its own process group and stops the whole group.
  - **Scripts opt-in:** the `review.baseInstallScripts` setting and the
    `--base-install-scripts` flag, which turn on dependency lifecycle
    scripts in a base install.
- **Background:** The process owner stops children as follows.
  - On Linux and macOS the process owner starts each child with `setsid`, so
    the child leads a new session and process group.
  - To stop it, the owner signals that group with `kill(-pid, signal)`.
  - The scripts opt-in of 2026-10-21 relied on this owner to stop script
    children.
  - The runtime contract says that no orphan process survives a normal
    shutdown, a failed startup, or an interruption.
  - The rebuild asked for a decision before the first npm release of the new
    core, but releases have shipped since then.
- **Problem:** Yarn Classic 1.22.22 starts dependency scripts in a new
  session on Linux and macOS. The group signal does not reach them. A
  review of the scripts opt-in reproduced this on both systems.
- **Impact if no action:** A cancelled or stopped base install can leave
  consumer scripts running after Mokly exits. They can keep changing files or
  using resources.
- **Root question:** How should Mokly stop every process that a base
  install starts, also outside its process group?
- **Options:**
  - **A.** Document the process leak. Effort: Small (estimate).
  - **B.** Keep lifecycle scripts off for Yarn Classic on Unix, and warn
    when the user asks for them. Effort: Small (estimate).
  - **C.** Make the process owner stop every descendant, also in new
    sessions. Effort: Large.
- **Left out:** Another group signal cannot reach a new session.
- **Wider fix:** C. Ownership of every descendant removes the class for
  every child process.
- **Previous examples:** None found.
- **Recommendation:** C. It keeps the scripts opt-in for Yarn Classic and
  meets the no-orphan rule of the runtime contract.
- **Action:** ask the user, because condition 5 holds: the user reserved
  the choice for each open review item of the rebuild. Condition 3 also
  holds, because C is Large.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6109).
