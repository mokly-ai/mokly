# Runner reports a broken Mokly install as old

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-01, from the planning of the `@mokly/mokly` 0.18.0 upgrade on the branch `calummoore/mokly-cli-upgrade`.
- **Location:** `crates/mkc-build-sandbox/src/publish.rs:37-40`, `crates/mkc-build-sandbox/src/versions.rs:10-21` and `crates/mkc-publications/src/build_worker/outcome.rs:85-87`.
- **Reason:** The case exists only after the upgrade to a native Mokly CLI merges, and its fix needs a new stored build cause and new copy, which the user decides.
- **Category:** Product bug.

- **Terms:**
  - **Runner:** `crates/mkc-build-sandbox`, which runs `mokly publish` for a repository in a cloud sandbox.
  - **Version probe:** the runner's `mokly --version` call before a publish. It decides whether the repository's own CLI is new enough.
  - **Native package:** the optional `@mokly/native-{target}` npm package that holds the Mokly binary for one platform, from `@mokly/mokly` 0.16 on.
- **Background:**
  - From 0.16 on, the `mokly` command is a small Node script that starts a native binary from an optional native package.
  - The script prints `[mokly/cli-invalid]` and exits 1 when the native package is missing, when Node is outside the supported range, when the system has no glibc, or when the binary's version differs from the script's.
  - The runner treats any non-zero exit of the version probe, and any output that is not a supported SemVer, as `BuildOutcome::UnsupportedMoklyVersion`.
  - The build worker stores that outcome as `BuildFailure::UnsupportedMoklyVersion`, and the check and the app tell the reader to update Mokly.
- **Problem:** A repository with a current Mokly whose install skipped optional dependencies, or that runs on an unsupported Node, gets the message to update Mokly. Updating does not help.
- **Impact if no action:** The reader follows wrong recovery advice and cannot publish until someone reads the build log.
- **Root question:** How does a reader learn the real reason when the repository's Mokly cannot start?
- **Options:**
  - **A.** Keep one cause, and change its copy to name both an old version and a broken install. Effort: Small.
  - **B.** Add a stored cause for a CLI that cannot start, chosen when the probe prints `[mokly/cli-invalid]`, with its own copy. It needs a migration of the build cause constraint, an API value and an app message. Effort: Medium.
  - **C.** Fall back to the cloud's pinned CLI when the repository's CLI cannot start. It hides the broken install and publishes with a version that the repository did not choose. Effort: Medium.
- **Left out:** Parse the free text after `[mokly/cli-invalid]` to give one message per cause. The text is not a documented interface, so a release can change it.
- **Wider fix:** B, because a typed cause keeps each failure apart for every reader of the build record.
- **Previous examples:** None found.
- **Recommendation:** B. The reader gets the right recovery step, and the cause stays typed for the API and the app.
- **Action:** ask the user, because B adds a new stored cause and new behaviour at the API boundary that no requirement covers.
