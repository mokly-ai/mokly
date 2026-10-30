# Remove the obsolete shared-version exception

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from PR #199 and the completed Rust rebuild plan:
  user item 197.
- **Location:** `scripts/release/versions.mjs:36-40`.
- **Reason:** The check is release functionality, so its removal needs the
  user's approval.

- **Source:** Design.
- **Category:** Process.
- **Terms:**
  - **Lockstep versions:** the release rule that `@mokly/mokly`,
    `@mokly/viewer`, and `@mokly/ui` share one version number.
- **Background:**
  - Before the lockstep migration, the CLI was at 0.15.0 and the viewer at
    0.6.0. Releases from 0.16.0 on use one shared version. The packages are
    at 0.17.0 today.
  - `scripts/release/versions.mjs:36-40` asserts that the viewer version
    equals the CLI version. It still accepts the old pair, CLI 0.15.0 with
    viewer 0.6.0, with the message "viewer must use the shared version after
    the lockstep migration".
- **Problem:** No release can return to the old pair after 0.16.0, but the
  exception stays in the release check.
- **Impact if no action:** The release check keeps a dead branch, and it
  would accept an invalid mixed pair if the versions ever went back.
- **Root question:** Should the release check allow any version pair other
  than one shared version?
- **Options:**
  - **A.** Remove the exception, so that the check requires one shared
    version. Effort: Small.
  - **B.** Keep the exception. Effort: Small.
- **Left out:** Add another special pair. It adds more stale behaviour.
  Fewer than three approaches exist, because the exception either stays or
  goes.
- **Wider fix:** A. One shared-version rule removes the obsolete branch.
- **Previous examples:** None found.
- **Recommendation:** A. It matches every release after 0.16.0.
- **Action:** ask the user, because condition 3 holds: the plan recorded
  that the removal needs the user's approval, because the check is release
  functionality on `main`.

The full historical record is in the [Rust rebuild plan at the commit before deletion](https://github.com/mokly-ai/mokly/blob/f93afceaa1d94de3526c4825cc11708c951678ba/plans/rust-rebuild.md?plain=1#L6540).
