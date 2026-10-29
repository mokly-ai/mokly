# Remove the obsolete shared-version exception

- **Severity:** Low. **Effort:** Small.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan.
- **Location:** `scripts/release/versions.mjs`.
- **Reason:** PR #199 merged before this work. The completed plan is now being removed.

- **Source:** Design.
- **Category:** process.
- **Background:** The shared-version check allows the pre-lockstep pair CLI 0.15.0 and viewer 0.6.0. Releases now use one shared version.
- **Problem:** No future release can validly return to the old pair. The exception remains executable release behavior.
- **Impact if no action:** The check can accept an invalid mixed-version release.
- **Root question:** How should Mokly remove the obsolete shared-version exception?
- **Options:**
  - **A.** Remove the obsolete exception and require one shared version. Effort: Small.
  - **B.** Keep the historical exception. Effort: Small.
- **Left out:** Adding another special pair increases the stale behavior.
- **Wider fix:** A. One shared-version rule removes the obsolete branch.
- **Previous examples:** User item 197 records the lockstep migration boundary.
- **Recommendation:** A. It matches every release after 0.16.0.
- **Action:** ask the user, because condition 5 holds. The user deferred this item for a later decision.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6540).
