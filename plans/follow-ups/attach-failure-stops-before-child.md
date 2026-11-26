# A failed attach gives back an unstopped child

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-26, from review finding 1 of the branch `calummoore/attach-returns-process-tree`, as the wider fix that the branch split off.
- **Location:** `crates/mokly-platform/src/processes.rs:38-49`, `crates/mokly-git/src/system.rs:80-91`, `crates/mokly-compare/src/process.rs:73-83`, and `crates/mokly-sidecar/src/process_factory.rs:132-151`.
- **Reason:** The fix moves the stop of the sidecar startup tree out of `Reaper::drop`, so it changes the sidecar startup cleanup and its timing spans.

- **Source:** Review.
- **Category:** Code structure.
- **Terms:**
  - **`AttachFailure`:** the error of `ProcessGroups::attach`. It gives back the unreaped child with the cause.
  - **`kill_unattached`:** the `ProcessGroups` method that stops the whole tree of a configured child that has no guard. On Unix it signals the process group of the child.
- **Background:**
  - On Unix, each managed child runs in its own session or group, so it can start child processes of its own before `attach` runs.
  - `AttachFailure` has a public `child` field. Its doc comment asks the caller to call `kill_unattached` before it reaps the child.
  - The Git runner, the base install, and the sidecar follow that rule. The Git runner and the base install each have a test, `a_failed_attachment_stops_the_unattached_tree`, that fails when the call is missing. The sidecar stops the tree in `Reaper::drop`, inside its startup stop span.
- **Problem:** A caller can take the child out of `AttachFailure` and reap it without the stop.
- **Impact if no action:** A new caller, or a refactor of one of the three callers, can leave the child processes of a failed attachment running. Only a caller with its own test catches it.
- **Root question:** How does the type of `AttachFailure` make the stop come before the reap?
- **Options:**
  - **A.** Change nothing. Each caller keeps its test. Effort: Small.
  - **B.** Make the `child` field private. Give the child back only through a method that calls `kill_unattached` first, such as `AttachFailure::stop(self, groups)`. The sidecar calls it inside its startup stop span, and the `--debug-timings` output stays the same. Update the test doubles that build an `AttachFailure`. Effort: Medium.
- **Left out:** A call of `kill_unattached` inside `SystemProcessGroups::attach`, because the stop would then run outside the sidecar startup stop span, and a caller test with a mocked `attach` could not check it.
- **Previous examples:** The same branch moved the reap of the root into `ProcessTree`, so that `attach` makes an early reap impossible.
- **Recommendation:** B. The type then holds the rule for every future caller.
- **Action:** fix after merge, apply B, because it changes the sidecar startup cleanup.
