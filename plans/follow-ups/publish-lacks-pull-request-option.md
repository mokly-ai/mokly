# mokly publish lacks a pull request option

- **Severity:** Low (estimate). **Effort:** Large (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-10-30, from the post-merge notes of the deleted `plans/cloud-builds.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `crates/mkc-publications/src/envelope.rs:44-60`, the build-record override.
- **Reason:** The change belongs to the open-source `mokly-ai/mokly` repository, and the cloud adopts it only from a released version.
- **Checked:** 2026-10-31, at commit `f568853e`. The problem is still open. The pinned CLI and the latest release, 0.17.0, have no pull request option. `envelope.rs` still takes the number from the build record.

- **Terms:**
  - **Upload envelope:** The `mokly-upload.json` record that `mokly publish` sends, with the repository, branch, head SHA and pull request number.
  - **Build-record override:** The cloud builds rule that takes a publication's pull request number from the build record, not from the envelope.
- **Background:** The CLI reads a pull request number only from GitHub Actions variables. A cloud build runs outside GitHub Actions, so its envelope has no number. Decision 6 of the cloud builds work therefore takes the number from the build record and emulates no Actions variable. `AGENTS.md` requires that a field the cloud needs lands upstream first. The latest published release, 0.17.0, still takes the number only from the Actions variables.
- **Task:** Propose in `mokly-ai/mokly` a `mokly publish --pull-request <number>` option, so the envelope carries the number outside GitHub Actions. After its release, adopt it in a deliberate pin bump and retire the build-record override.
- **Impact if no action:** The cloud keeps a special rule for the pull request number of cloud builds.
- **Needs:** A proposal to the open repository and its release, or a link to an earlier proposal outside its issue list. The proposal alone is Small. The adoption in a deliberate pin bump and the retirement of the override are Large. Opening the proposal is an outward-facing action, so confirm it with the owner first.
- **Done when:** A released CLI sends the number from the option, and the override is gone. Keep the build-record override until an approved released replacement exists.

Source: [the post-merge notes](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/cloud-builds.md?plain=1#L2245-L2275) of the deleted plan.
