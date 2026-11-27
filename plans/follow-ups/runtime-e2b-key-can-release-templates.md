# The runtime E2B key can release templates

- **Severity:** Medium. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from a finding check of review round 1 of branch `calummoore/e2b-build-enabling-vbbo`.
- **Location:** `docs/ops/build-template.md`, the release command and the Secret Manager steps that store `/secure/e2b-api-key`.
- **Reason:** The runbook used one team key for both jobs before that branch, which did not change those lines.

- **Source:** Review.
- **Category:** Security.
- **Terms:**
  - **Team key:** the E2B API key of the team that owns the build templates.
- **Background:** The runbook builds template releases with the team key in `/secure/e2b-api-key` and stores the same file as the runtime secret `mkc-ENVIRONMENT-e2b-api-key` that the API uses to create sandboxes.
- **Problem:** Anyone who obtains the runtime secret can also build new templates in that E2B team. Since 2026-11-25 deployments use a build reference, so a new build no longer changes what a deployment starts, but the key still allows release and template changes.
- **Impact if no action:** A leaked runtime key gives template write access, not only sandbox access.
- **Root question:** How does each job hold only the E2B access it needs?
- **Options:**
  - **A.** Document the shared scope as an accepted risk. Effort: Small.
  - **B.** Use a separate E2B team or key for releases, if E2B supports keys that cannot build templates, and record which key each step uses. Effort: Medium.
- **Left out:** None.
- **Wider fix:** B.
- **Previous examples:** None found.
- **Related:** `build-template-config-accepts-bare-id.md`.
- **Recommendation:** B, after checking whether E2B offers a key scope without template builds.
- **Action:** ask the user, because B changes the provider account setup.
