# Gate stage count comment can drift

- **Severity:** Low. **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from re-review finding 1 of the Milestone 7 review TODO in the deleted `plans/desktop-app-shell.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `xtask/src/task.rs:38`.
- **Reason:** The source says to wait for the user's choice and not to apply a default.
- **Checked:** 2026-10-31, at commit `f568853e`. The original mismatch is fixed: the comment says 25 stages, and `STAGES` in `xtask/src/stage.rs` holds 25. Only the reserved wording choice is still open.
- **Category:** Code structure.

- **Background:** `cargo xtask check` runs the stages that `xtask/src/stage.rs` lists. On 2026-10-21 the review found that `xtask/README.md` and the `full_tasks()` comment in `xtask/src/task.rs` gave a 24-stage total, while the gate had 25. Later work removed the README sentence. On 2026-10-30 the comment at `task.rs:38` reads "Expand the complete 25-stage aggregate", which is true at commit `f568853e`.
- **Problem:** The comment states a number that the next new stage makes false.
- **Impact if no action:** The comment goes stale again with the next stage.
- **Root question:** How does the comment describe the gate without a number that can drift?
- **Options:**
  - **A.** Keep the number, and update it with each new stage. Effort: Small.
  - **B.** Use count-free wording, such as "every stage of the aggregate". Effort: Small.
- **Left out:** A test that compares the comment with the stage list. The `testing` skill keeps tests away from prose.
- **Wider fix:** B. Count-free wording cannot drift.
- **Previous examples:** The same count went stale in `xtask/README.md` and the comment when the desktop stage made 25.
- **Recommendation:** B. The review recommended it.
- **Action:** ask the user, because condition 5 holds: the source asked to wait for the user's choice.

Source: [the Milestone 7 review TODO](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/desktop-app-shell.md?plain=1#L734-L795) of the deleted plan.
