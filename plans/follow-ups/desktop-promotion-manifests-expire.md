# Promotion manifests expire before a rerun

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-24, from review finding 2 of the branch `calummoore/desktop-releases-become-latest-releases-clkn`.
- **Location:** `.github/workflows/desktop-release.yml`, the step "Upload the verified release manifest" of the `release` job and the step "Download the verified release manifests" of the `promote` job. `packages/desktop/scripts/release-promote.mjs`, the manifest reader.
- **Reason:** The case is rare and the previous release stays latest, so the fix waits for a later branch, as the fix rule says for a Rare Medium product bug.
- **Category:** Product bug.

- **Terms:**
  - **Platform manifest:** A JSON file that each platform job writes after its own asset check. It holds the owner, the repository, the tag, the release id, the platform and the names and sizes of the checked assets.
  - **Promotion:** The `promote` job. It reads both platform manifests and the draft, checks the complete fixed inventory, then makes the draft the latest full release.
  - **Job output:** A value that GitHub Actions keeps from one job for the jobs that need it. A rerun keeps the outputs of the jobs that it does not run again.
- **Background:**
  - On 2026-11-24 the owner chose full desktop releases. Each release becomes latest only after the complete asset check of both platforms.
  - Each platform job uploads its manifest as the workflow artifact `desktop-release-macos` or `desktop-release-linux`, with `retention-days: 14`. The promotion downloads both with `actions/download-artifact`.
  - GitHub allows a rerun of a failed run for 30 days. After 14 days the artifacts are gone, so a promotion rerun has no manifests and fails.
  - When a platform job checks its assets but then fails to store its manifest, a rerun of that job stops at the existing asset names. The complete draft then stays a draft.
  - The workaround is a new version through the next desktop release pull request. `packages/desktop/README.md` already gives that recovery after a partial upload.
  - A matrix job needs a different output name for each platform.
- **Task:** Return each platform manifest as a job output with a name per platform, such as `macos` and `linux`, from the `release` job. Pass both outputs to the promotion, and remove the artifact upload and download. Keep the manifest writer and reader as one format, and move the command-level test of `packages/desktop/src/_tests_/release-promote.test.ts` to the new input.
- **Impact if no action:** A rare failure of a manifest upload, or a promotion rerun after 14 days, needs a new version.
- **Related:** `plans/follow-ups/desktop-stranded-draft-needs-repair-path.md` holds the wider fix, which waits for the owner. When the owner chooses its option E or D, that work can replace this task. `plans/follow-ups/desktop-promotion-can-move-latest-backward.md`: a longer rerun window makes a late promotion possible for longer, so land its answer first.
- **Done when:** The promotion reads the manifests from job outputs, and a promotion rerun within GitHub's 30-day window can read them.
