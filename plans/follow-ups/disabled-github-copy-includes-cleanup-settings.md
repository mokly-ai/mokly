# Disabled GitHub copy includes cleanup settings

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-10-31, from post-push retention review finding 3 and its independent check.
- **Location:** `docs/ops/environment.md:390-391`; `docs/ops/environment.md:240-241`; `infra/README.md:11-12`.
- **Reason:** The user deferred this work to a follow-up on 2026-11-02. It does not block the current PR.
- **Decision:** The user approved deferral, without selecting an implementation option. Keep C as the recommendation for future work.

**Terms:** The GitHub App is the serving integration. `github-prune` is a
database-only cleanup job with two retention-window settings.

**Background:** The approved cleanup runs in every environment even when
`github.enabled` is false. Disabled serving deployments receive no GitHub App
identity or credential settings and no GitHub credential mounts.

**Problem:** The environment guide says disabled GitHub renders no
`MKC_GITHUB_*` values. The infrastructure README says disabled releases render
no GitHub settings. Both claims include the two cleanup-window variables,
which the chart deliberately renders in every environment. The setting
inventory and rendered-job tests already describe the behavior correctly.

**Impact if no action:** Operators can mistake expected cleanup settings for
an incorrectly enabled integration.

**Root question:** How should operators learn what disabling the App removes
while independent cleanup keeps its settings?

**Options:**

- **A — Explain the distinction in both guides.** Narrow the claims to App
  identity and credential settings and state the cleanup exception. Effort:
  Small.
- **B — Link the configuration boundaries.** Keep the all-or-none statement,
  remove the broad prefix claim and link the setting inventory and GitHub
  contract. Correct the infrastructure README too. Effort: Small.
- **C — Put render conditions in the inventory.** Narrow the App statement,
  mark both cleanup rows as rendered with GitHub disabled, and correct the
  infrastructure README's broad claim. Effort: Small.
- **D — Rename the cleanup variables.** Move them out of the App prefix in
  configuration, templates, tests and docs, then restore the whole-render
  prefix assertion. Effort: Small. This makes domain naming less clear and
  changes a working configuration interface for a wording defect.

**Recommendation:** C, replacing the initial A after the independent check.
It keeps each setting's render condition in its inventory row and corrects
both guides.

**Wider fix:** The existing documentation rule requires one home for each
fact. B and C apply it. New prose tests or a new lint are unnecessary.

**Left out:** Disabling the cleanup or hiding its configurable windows would
break the approved independence from the GitHub App.

**Related:** The cleanup-grace wording item also changes the environment
guide, in a separate paragraph. The edits can share a documentation change.

**Action:** Fix after merge in separate work requested by the user. Confirm
the approach when that work starts. Do not change the guides or environment
variable names in the current PR.
