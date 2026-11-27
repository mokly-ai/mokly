# Build worker shares the API process

- **Severity:** Low (estimate). **Effort:** Large (estimate). **Confidence:** Medium. **Harder later:** Yes.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from the post-merge notes of the deleted `plans/cloud-builds.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `crates/mkc-api`, the composition root that runs the workers, and `infra/helm/mokly-cloud/`.
- **Reason:** The plan made the move depend on resource pressure under real traffic, and the move is a Large infrastructure change.
- **Checked:** 2026-10-31, at commit `f568853e`. The audit could not verify the need for a move. The API process still runs the build loop beside HTTP and the other workers. The repository holds no measurement of build load, API latency or restart cadence.
- **Category:** Performance.

- **Terms:**
  - **Build worker:** The worker that claims cloud builds, runs them in sandboxes and records their outcomes.
- **Background:** The API binary is the composition root that also runs the workers, the build worker included. The cloud builds plan said to move the build worker to its own deployment if API resource pressure or the restart cadence shows that it should not share the process. `plans/follow-ups/serving-memory-limits-not-tuned.md` holds the measurement.
- **Problem:** Build load and API requests share one process. The repository holds no measurement of whether that harms the API.
- **Impact if no action:** Heavy build use can slow API requests, and every API rollout restarts the running builds.
- **Root question:** Where does the build worker run?
- **Options:**
  - **A.** Keep the build worker in the API process. Effort: Small.
  - **B.** Move the build worker to its own deployment when the measurement shows pressure. It needs a new workload, its Helm values, its identity and its smoke. Effort: Large.
- **Left out:** Move it before the measurement. No data shows the need.
- **Wider fix:** None.
- **Previous examples:** None found.
- **Related:** `plans/follow-ups/serving-memory-limits-not-tuned.md`, same measurement. That task records the pressure and restart cadence that this choice waits for, and it makes no choice.
- **Recommendation:** B, only if the measurement shows API pressure or harmful build restarts. Decide after that measurement. Until then, the build worker stays in the API process. A shared process restarts the running builds on every API rollout.
- **Action:** ask the user, because condition 3 holds: B is a Large infrastructure change.

Live cloud builds run on main-preview and production since 2026-11-27, as "Live Evidence" of `docs/ops/build-template.md` records. They do not run under real traffic yet. Measure only after builds run under real traffic.

Source: [the post-merge notes](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/cloud-builds.md?plain=1#L2245-L2275) of the deleted plan.
