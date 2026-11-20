# Delete the desktop signing repository secrets

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-11-20, from the post-merge TODOs of the desktop release
  pull request plan on branch `calummoore/desktop-release-process-ujn3`.
- **Location:** The Actions secrets of `mokly-ai/mokly`, and
  [Desktop release secrets](../../docs/ops/secrets.md#desktop-release-secrets).
- **Reason:** The repository secrets stay until the first release from the
  `desktop-release` environment passes, so that a setup mistake can be
  repaired from the old values.

- **Background:** The desktop release job now reads `CSC_LINK`,
  `CSC_KEY_PASSWORD`, `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`
  and `DESKTOP_RELEASES_TOKEN` from the `desktop-release` GitHub environment,
  which admits only `main`. Repository secrets of the same names can still
  exist from the earlier tag-triggered release.
- **Problem:** A workflow run on any branch of the repository can read a
  repository secret.
- **Impact if no action:** The signing credentials stay readable outside
  `main`, so a workflow on another branch could sign a build that installs as
  an update.
- **Task:** After the first desktop release passes, a repository
  administrator runs `gh secret delete NAME --repo mokly-ai/mokly` for each of
  the six names. Check that `gh secret list --env desktop-release --repo mokly-ai/mokly`
  still lists all six.
- **Needs:** A repository administrator, and one passed desktop release.
- **Done when:** The six names are absent from the repository secrets and
  present in the environment. Then delete this item.
