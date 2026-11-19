# mokly publish lacks a pull request option

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from the post-merge notes of the deleted `plans/cloud-builds.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `crates/mkc-publications/src/envelope.rs:44-60`, the build-record override, and the `Publish` options of `crates/mokly-cli/src/grammar.rs:106-130`.
- **Reason:** The fix adds a public option to `mokly publish`, which the user decides.
- **Checked:** 2026-10-31, at commit `f568853e`. The problem is still open. The pinned CLI and the latest release, 0.17.0, have no pull request option. `envelope.rs` still takes the number from the build record.

- **Terms:**
  - **Upload envelope:** The `mokly-upload.json` record that `mokly publish` sends, with the repository, branch, head SHA and pull request number.
  - **Build-record override:** The cloud builds rule that takes a publication's pull request number from the build record, not from the envelope.
  - **Runner:** `crates/mkc-build-sandbox`, which runs `mokly publish` for a repository in a cloud sandbox.
- **Background:**
  - The CLI reads a pull request number only from GitHub Actions variables. A cloud build runs outside GitHub Actions, so its envelope has no number.
  - Decision 6 of the cloud builds work therefore takes the number from the build record and emulates no Actions variable.
  - On 2026-11-17 the CLI of this repository still has no pull request option: the `Publish` options in `crates/mokly-cli/src/grammar.rs:106-130` are the endpoint, the token, the repository, the upload concurrency, `--strict` and `--no-changes`.
  - The runner runs the repository's own installed CLI when its version is at least `MIN_MOKLY_VERSION`, 0.18.0, in `crates/mkc-build-sandbox/src/versions.rs`. Without an installed CLI, it runs the newest npm release, `@mokly/mokly@latest`.
  - So a new CLI option reaches every cloud build only when the minimum supported version has it. Until then, the override must stay for older CLIs.
  - Mokly Cloud now lives in this repository. The CLI option and the runner change can land in one change, with no proposal to another repository.
- **Problem:** The cloud keeps a special rule for the pull request number of cloud builds, because the CLI cannot send the number outside GitHub Actions.
- **Impact if no action:** The cloud keeps the build-record override. Other continuous integration systems outside GitHub Actions also cannot send a pull request number.
- **Root question:** How does a publication outside GitHub Actions carry its pull request number?
- **Options:**
  - **A.** Keep the build-record override, and change no CLI option. Effort: Small.
  - **B.** Add `mokly publish --pull-request {number}`, so the envelope carries the number outside GitHub Actions. The runner passes it when the repository's CLI has the option. Retire the override when `MIN_MOKLY_VERSION` reaches the first release with the option. Effort: Medium.
- **Left out:** Emulate the GitHub Actions variables in the runner. Decision 6 of the cloud builds work rejected it.
- **Wider fix:** None.
- **Previous examples:** None found.
- **Recommendation:** B. Every continuous integration system then gets the number into the envelope, and the cloud can drop its special rule once older CLIs leave the supported range.
- **Action:** ask the user, because B adds a public CLI option, a change at the CLI boundary that no requirement covers.

Source: [the post-merge notes](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/cloud-builds.md?plain=1#L2245-L2275) of the deleted plan.
