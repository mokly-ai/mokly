# Recover from native watch event loss

- **Severity:** Medium. **Effort:** Medium.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** `crates/mokly-watch` and the Serve watcher integration.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Design.
- **Category:** product bug.
- **Background:** macOS FSEvents can batch or drop detail. Windows watch buffers can overflow.
- **Problem:** Mokly has no recovery rule for lost native events on those platforms.
- **Impact if no action:** Serve can stay on stale output after a dropped event.
- **Root question:** How should Mokly recover from native watch event loss?
- **Options:**
  - **A.** Rescan repository roots after each macOS batch. Check exact-input stamps on Windows. Effort: Medium.
  - **B.** Use one recursive watch for each root on both platforms. Effort: Medium.
- **Left out:** A periodic wall-clock rescan adds timing behavior and delays recovery.
- **Wider fix:** A. Platform-specific recovery keeps existing watcher ownership.
- **Previous examples:** The M11 plan deferred this choice until hosted platform runs existed.
- **Recommendation:** A. It handles each platform's known loss mode directly.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6078).
