# Attach still lets a caller reap early

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Fix after merge.
- **Added:** 2026-11-26, from review finding 2 of the branch `calummoore/fix-cleanup-can-signal-a-reused-process-97ed`, as the wider fix that the branch split off.
- **Location:** `crates/mokly-platform/src/processes.rs:26-35`, `crates/mokly-platform/src/processes/tree.rs:38-48`, and `crates/mokly-sidecar/src/process_reaper.rs:19-114`.
- **Reason:** The fix changes the public `ProcessGroups` trait and every test double of `attach` in crates outside the branch that fixed the reap.

- **Source:** Review.
- **Category:** Code structure.
- **Terms:**
  - **Process tree guard:** the `ProcessGroup` that `ProcessGroups::attach` returns. It signals the process group of a command and its descendants.
  - **`ProcessTree`:** the `mokly-platform` type that owns a child and its guard. It waits for the exit without a reap and reaps the child only after the guard drops.
  - **Reap:** the wait call that removes an exited child from the process table. After it, the child's process ID and group number can pass to a new process.
- **Background:**
  - On Unix, the guard signals a process group by number. The number stays reserved only while the root process is unreaped.
  - The Git runner, the base install, and the sidecar now give the child and the guard to a `ProcessTree`. Each has a test that fails when a tree signal follows the reap.
  - `ProcessGroups::attach` still borrows the `Child` and returns only the guard. The hand-over to `ProcessTree` is a rule in a doc comment.
  - The sidecar needs a two-state `Root` enum, `Reaper::child`, `Reaper::own`, and an "already has a process tree" error only because of this hand-over.
- **Problem:** A caller can keep the `Child` after `attach` and reap it while the guard can still signal.
- **Impact if no action:** A new caller, or a refactor of one of the three callers, can bring back the reuse of a group number. Only a caller that has its own reap-order test catches it.
- **Root question:** How does the type of `attach` make an early reap impossible?
- **Options:**
  - **A.** Change nothing. Each caller keeps its reap-order test. Effort: Small.
  - **B.** Make `attach` take the `Child` by value and return a `ProcessTree`, or the child and the error when attachment fails. Delete the sidecar hand-over code. Update the implementations and mocks of `attach` in `mokly-git`, `mokly-sidecar`, `mokly-test-support`, and their tests. Effort: Medium.
- **Left out:** A lint against `.attach(` outside `ProcessTree`, because a new lint needs the user's approval and B makes it unneeded.
- **Previous examples:** `a_finished_git_command_is_reaped_only_after_its_last_tree_signal`, `a_finished_manager_is_reaped_only_after_its_last_tree_signal`, and `a_stopped_sidecar_is_reaped_only_after_its_last_tree_signal` protect the three current callers.
- **Recommendation:** B. The type then holds the rule for every future caller, and the sidecar loses its hand-over state.
- **Action:** fix after merge, apply B, because it changes the public trait and test doubles in other crates.
