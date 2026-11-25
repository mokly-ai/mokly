# Router token doc names only the deploy workflow

- **Severity:** Low. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-25, from the options check of `plans/app-on-cloudflare.md` on branch `calummoore/gcp-project-cost-v2-3foo`.
- **Location:** `docs/protocol/cloud/origin-router.md` (the Worker token paragraph), `infra/terraform/modules/github/main.tf`.
- **Reason:** The doc paragraph and the identity binding are outside the app hosting change.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Deploy service account:** `mkc-github-deploy`, the GCP identity that GitHub Actions jobs on `main` impersonate through workload identity federation.
- **Background:**
  - `origin-router.md` says that only the GitHub deploy service account can read the Worker token, after GCP verifies the repository IDs and the `deploy.yml` workflow ref on `refs/heads/main`.
  - `infra/terraform/modules/github/main.tf` lets `preview.yml@refs/heads/main` use the same deploy service account.
- **Problem:** The doc names one workflow, but two workflows can read the Worker token.
- **Impact if no action:** A reader of the protocol trusts a narrower credential boundary than the code enforces.
- **Root question:** Which workflows may read the Worker token, and does the doc state that set?
- **Options:**
  - **A.** Change the doc to name both workflows. Effort: Small.
  - **B.** Give `preview.yml` its own service account without access to the Worker token, and keep the doc. Effort: Medium.
- **Left out:** No other approach: the doc or the binding must change.
- **Wider fix:** B. It makes the doc's boundary true.
- **Previous examples:** None found.
- **Recommendation:** B. Preview jobs need no Worker token. `plans/app-on-cloudflare.md` also needs a separate preview identity for its preview bucket token.
- **Action:** ask the user, because B changes an IAM boundary on `main`, and A changes a statement of the protocol.
