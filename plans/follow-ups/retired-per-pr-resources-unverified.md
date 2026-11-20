# Retired per-PR cloud resources may remain

- **Severity:** Low (estimate). **Effort:** Small (estimate). **Confidence:** Low. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-10-30, from the post-merge tasks of the deleted `plans/pr-preview-environments.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** The Google Cloud project of the previews, its DNS zones, and `docs/ops/preview.md`.
- **Reason:** The resources live in Google Cloud, outside the repository, so only an operator can find and remove them.
- **Checked:** 2026-10-31, at commit `f568853e`. The audit could not verify whether any retired resource remains. The repository cannot list the cloud project, and no inventory of the old resources is recorded.

- **Terms:**
  - **Old preview lifecycle:** The previews before PR #18, which gave each pull request its own Terraform environment.
- **Background:** Before PR #18 merged on 2026-09-24, each preview had its own cloud resources.
  - A Cloud SQL instance, a bucket, two service accounts and eight Secret Manager IDs.
  - A reserved address, DNS records and a certificate pack.
  - PR #18 made a preview a namespace and a Helm release on a shared platform. It removed the per-PR Terraform grammar. The plan asked an operator to remove the retired per-PR Secret Manager IDs, service accounts and buckets.
  - The repository records no inventory or cleanup of these resources. That absence does not prove that any of them remain.
  - `docs/ops/preview-verification.md` records the cleanup of a namespace-era preview in September. That proof covers the current lifecycle, not the resources of the old one.
  - The current naming module builds `mkc-<environment>` account and secret names and `<project>-<environment>-blobs` bucket names. An old environment was `preview-pr-N`, so the old names likely contain `mkc-preview-pr-` or `-preview-pr-`. That pattern is an inference.
- **Task:**
  1. Make a read-only list of each old resource kind that the Background names, with the grants of each service account.
  2. Match each one against the active previews, and record the dated inventory in `docs/ops/preview.md`.
  3. Remove each unused resource in a separate reviewed cleanup. Use this order, so that no grant dangles: grants first, then the accounts and secrets, then the buckets.
- **Impact if no action:** Retired resources, if any remain, keep their cost and their access grants.
- **Needs:** Read access to the Google Cloud project and its DNS zones. The cleanup also needs owner access.
- **Done when:** The previews runbook records the dated inventory, and each unused resource that it found is removed or has its own follow-up item.

Source: [the post-merge tasks](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/pr-preview-environments.md?plain=1#L610-L625) of the deleted plan.
