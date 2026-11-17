# Check status help omits build dead letters

- **Severity:** Low (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-30, from the outside-the-scope note of the Milestone 13 review TODO in the deleted `plans/documentation-skill-alignment.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `crates/mkc-api/src/cli.rs:48`, the help of the `publication-check-status` subcommand, and `crates/mkc-publications/src/check_recovery.rs:29-38`.
- **Reason:** The help text came from `main` during the PR #51 merge, outside that review's scope.
- **Checked:** 2026-10-31, at commit `f568853e`. The problem is still open. The help at `cli.rs:48` still names only the publication dead letters, and `dead_letters` counts both kinds.
- **Category:** UX wording.

- **Terms:**
  - **Dead letter:** A check delivery that used its retry budget and waits for an operator to requeue it.
- **Background:** `mkc-api publication-check-status` reports the state of the check delivery outboxes for operators. The cloud builds work added build check deliveries beside the publication ones. `dead_letters` in `crates/mkc-publications/src/check_recovery.rs:29-38` adds the publication and the build counts. The review of 2026-10-21 found that the help text names only the publication dead letters.
- **Problem:** The help text does not say that the command also reports build check dead letters.
- **Impact if no action:** An operator who reads the help misses the build check backlog during recovery.
- **Root question:** How does the help text describe everything that the command reports?
- **Options:**
  - **A.** Add the build check dead letters to the help text. Effort: Small.
  - **B.** Describe the command by its purpose, the check delivery backlog, without a list. Effort: Small.
- **Left out:** None. A and B are the two outcomes.
- **Wider fix:** B. A purpose description does not drift when a new outbox joins.
- **Previous examples:** None found.
- **Recommendation:** A. An operator needs the exact list during recovery.
- **Action:** fix after merge, apply A, because the help text came from `main` outside the review's scope.

Source: [the Milestone 13 review TODO](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/documentation-skill-alignment.md?plain=1#L739-L770) of the deleted plan.
