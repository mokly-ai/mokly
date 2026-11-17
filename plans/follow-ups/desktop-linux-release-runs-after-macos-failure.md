# Linux release publishes after a macOS failure

- **Severity:** Medium. **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from release finding 12, which the open PR #58 (`calummoore/desktop-release-alpha1-plan`) recorded on 2026-10-26 in the deleted `plans/desktop-app-shell.md`.
- **Location:** `.github/workflows/desktop-release.yml:100-116`, the strategy and time limit of the `release` job, and its publish steps at `:139-153`.
- **Reason:** The fix changes the release workflow on `main`, and the source waits for the user's approval.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. The job still sets `fail-fast: false` and `timeout-minutes: 60`, so a partial release is still possible. Nobody reproduced a timeout.
- **Category:** Process.

- **Terms:**
  - **Release job:** The matrix job `release` of `.github/workflows/desktop-release.yml`, which builds and publishes one platform's packages for a `desktop-v*` tag.
  - **`fail-fast`:** The GitHub Actions matrix setting that cancels the other running and queued jobs of a matrix when one of them fails.
  - **Notarization:** Apple's check of a signed macOS package, which the release job waits for before it publishes.
- **Background:** The list below gives the facts.
  - A `desktop-v*` tag runs the release job once for macOS and once for Linux. `max-parallel: 1` runs them one after the other, and both fill one pre-release.
  - `docs/protocol/desktop-distribution.md:35-36` says: "The two platform publishers run in sequence to create and fill one pre-release." It says nothing about a failed publisher. Running in sequence does not make the two uploads one all-or-nothing step.
  - The job sets `fail-fast: false` and `timeout-minutes: 60`. Both arrived with PR #42 on 2026-10-21, and the deleted plan records no reason for them.
  - With `fail-fast: false`, a failed macOS job does not cancel the queued Linux job. [GitHub's matrix failure rule](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idstrategyfail-fast) cancels running and queued matrix jobs when `fail-fast` is true.
  - The first notarization, for `0.1.0-alpha.1` on 2026-10-26, used 36 of the job's 60 minutes. That one run does not prove that 60 minutes is too short now.
  - Attempt 1 of that release run, 40316994987, notarized both macOS packages. It then failed with HTTP 403 at release creation, until the releases token gained Contents write access. Attempt 2 published all twelve files.
  - Published assets are never replaced or deleted. Delayed recovery needs a new package version and a matching new tag, as `docs/protocol/desktop-distribution.md:38-47` defines.
  - The workflow also shows the reverse case: when the Linux job fails after the macOS job published, the release keeps the macOS packages only.
  - The source records only its recommended option C. Options D and E are new in this item, written from the workflow and the protocol.
- **Problem:** When the macOS job fails, the queued Linux job still runs and can publish a pre-release with Linux packages only. Separately, the 60-minute limit may leave too little time for a slow notarization. Nobody has measured that risk.
- **Impact if no action:** A failed macOS release can leave a Linux-only pre-release on the public feed. Its fix needs a new version and tag. A slower notarization may pass the limit and fail the release.
- **Root question:** How does one tag publish the packages of both platforms or of neither, within a time limit that fits notarization?
- **Options:**
  - **C.** Raise the release job's limit to 120 minutes, and set `fail-fast: true`, so a failed macOS job cancels the queued Linux job. A Linux failure after the macOS upload still leaves a macOS-only release. Effort: Small.
  - **D.** Split the matrix into a macOS job and a Linux job that `needs` it, with the longer limit on the macOS job. The reverse case stays as in C. Effort: Small.
  - **E.** Publish into a draft release, and make it public only after both platforms upload and pass the asset check. A failure on either platform then publishes nothing. It changes the release contract in `docs/protocol/desktop-distribution.md`, and its draft promotion still needs a concrete design. Effort: Medium.
- **Left out:** Change nothing, or raise only the time limit. A failed macOS job then still lets Linux publish alone, which fails the goal.
- **Wider fix:** E. A release that turns public only after every platform passes prevents a partial release in both directions.
- **Previous examples:** None found.
- **Recommendation:** C. It is the source's recommendation and the smallest change that stops a Linux-only release after a macOS failure. C does not meet the both-or-neither goal when Linux fails after the macOS upload. E protects the feed best, because it also covers a Linux failure.
- **Action:** ask the user, because condition 2 holds: C adds release behaviour that no requirement covers. The source also waits for the user's approval.

Source: [release finding 12](https://github.com/mokly-ai/mokly-cloud/blob/a8997fb22dab7ce22409b966008cd7f9eb075043/plans/desktop-app-shell.md?plain=1#L744-L747) on the branch of PR #58.
