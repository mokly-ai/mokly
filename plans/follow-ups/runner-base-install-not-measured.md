# Runner base install is not measured

- **Severity:** Low. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-11-02, from the post-merge tasks of the Mokly 0.18.0 upgrade plan on the branch `calummoore/mokly-cli-upgrade`, deleted with that change.
- **Location:** `docs/protocol/cloud/cloud-build-runner.md` and `docs/protocol/cloud/cloud-build-sandbox.md`, the runner template and its time limits.
- **Reason:** A real measure needs the deployed runner template and a real comparison build.

- **Terms:**
  - **Base install:** the dependency install that Mokly 0.18.0 runs for the base side of a comparison, in its own cache, before it renders the base.
  - **Runner template:** the E2B sandbox template in which cloud builds run.
- **Background:**
  - In 0.18.0, comparisons render both sides from sources with the installed Mokly version, so a comparison build installs the base's dependencies too.
  - The runner passes no base-install-scripts option, so the repository's own `review.baseInstallScripts` decides.
  - No measure of this install in the runner template exists.
- **Task:** Run a comparison build of a real repository in the runner template, and record the time and the disk use of the base install against the build's time and disk limits.
- **Impact if no action:** A comparison build can reach the build's time or disk limit without warning.
- **Needs:** The deployed change and a build that has a comparison.
- **Done when:** The measure is recorded, and each limit that it passes has a follow-up item or a fix.
