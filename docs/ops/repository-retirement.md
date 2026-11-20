# Repository Retirement

This page continues the [repository cutover](./repository-cutover.md) runbook
after production runs from `mokly-ai/mokly`.

Do these steps in order after the first Deploy run reaches production. Each
step needs owner access to both repositories.

1. Disable the two old workflows that
   [Stop The Old Deployments](./repository-cutover.md#stop-the-old-deployments)
   left on:
   `for name in ci foundation; do gh workflow disable "$name.yml" -R mokly-ai/mokly-cloud; done`.
   Check: `gh workflow list -R mokly-ai/mokly-cloud --all` shows all six as `disabled_manually`.
2. List the resources of the PR previews: the namespaces, the bucket IAM
   conditions, the object prefixes and the marked DNS records. Use the
   [operator tools](./deploy.md#prerequisites). Sign in with
   `gcloud auth login` as an operator with the deploy identity's access to the
   cluster, the preview bucket and `mkc-catalogue-dns-token`, which
   [Identity Boundaries](./secrets.md#identity-boundaries) lists:

   ```sh
   for name in MKC_REGION MKC_DOMAIN MKC_CATALOGUE_BASE_DOMAIN MKC_CATALOGUE_CLOUDFLARE_ZONE_ID \
     MKC_PREVIEW_INGRESS_IP MKC_PREVIEW_BLOBS_BUCKET; do export "$name=$(gh variable get "$name" -R mokly-ai/mokly)"; done
   gcloud container clusters get-credentials mkc-autopilot --region="$MKC_REGION" --project=mokly-508518 --dns-endpoint
   kubectl get namespaces -o name | grep -oE 'mkc-preview-pr-[0-9]+$'
   gcloud storage buckets get-iam-policy gs://mokly-508518-preview-blobs --format=json --project=mokly-508518 |
     grep -oE 'mkc-preview-pr-[0-9]+' | sort -u
   gcloud storage ls gs://mokly-508518-preview-blobs --project=mokly-508518 | grep -oE '/pr-[0-9]+/$'
   curl -fsS -H "Authorization: Bearer $(gcloud secrets versions access latest --secret=mkc-catalogue-dns-token --project=mokly-508518)" \
     "https://api.cloudflare.com/client/v4/zones/$MKC_CATALOGUE_CLOUDFLARE_ZONE_ID/dns_records?per_page=100" |
     grep -oE 'mokly-preview:preview-pr-[0-9]+|"total_pages": *[0-9]+'
   ```

   For each N that is not an open pull request in
   `gh pr list -R mokly-ai/mokly --label preview`, run
   `bash infra/scripts/preview-destroy.sh preview-pr-N` as
   [Cleanup And Recovery](./preview.md#cleanup-and-recovery) says. Check: when
   you run the list again, it names only open labelled pull requests, and
   `total_pages` is 1.

3. Remove the old repository from the trust. CI cannot, because the change
   deletes trust bindings. Hold merges to `main`. Run
   `gh variable delete MKC_LEGACY_REPOSITORY_ID -R mokly-ai/mokly`, then steps 2
   to 8 of the [trust-set procedure](./foundation.md#destructive-foundation-plans)
   with `MKC_LEGACY_REPOSITORY_ID` unset. Expect 8 deletes of
   `mokly-ai/mokly-cloud/` bindings and an in-place update of the condition.
   Check: the `gcloud` command of
   [the trust step](./repository-cutover.md#trust-both-repositories) prints
   only `mokly-ai/mokly`.
4. Port the change of each pull request that
   [Stop The Old Deployments](./repository-cutover.md#stop-the-old-deployments)
   closed to the [combined paths](../protocol/repository-layout.md#directories)
   here, or drop it. Then run
   `gh pr comment NUMBER -R mokly-ai/mokly-cloud --body "Moved to URL."`
   before the archive, because an archived repository is read-only.
   Check: `gh pr list -R mokly-ai/mokly-cloud` prints nothing.
5. The old CI no longer runs, so turn off its required check with
   `gh api -X PUT repos/mokly-ai/mokly-cloud/rulesets/23759144 -f enforcement=disabled`.
   In `https://github.com/mokly-ai/mokly-cloud/edit/main/README.md`, replace the
   text with a link to `https://github.com/mokly-ai/mokly`. Commit to `main`.
6. Run `gh repo archive mokly-ai/mokly-cloud --yes`. Check:
   `gh api repos/mokly-ai/mokly-cloud --jq .archived` prints `true`.
7. Add a dated record to the end of this page: the merge commit, the run URLs
   of each check of this page and of the
   [repository cutover](./repository-cutover.md), and each change to their
   steps.

## Cutover Record

The cutover ran on 2026-11-19 and 2026-11-20. Merge commit: `5cba4dc4` (#350).

- **Stop The Old Deployments (2026-11-19):** #133, #107 and #88 closed. Their
  Preview runs [44608586082](https://github.com/mokly-ai/mokly/actions/runs/44608586082), [44608593672](https://github.com/mokly-ai/mokly/actions/runs/44608593672) and [44608605274](https://github.com/mokly-ai/mokly/actions/runs/44608605274)
  printed **Preview removed**. The Site runs [44608584890](https://github.com/mokly-ai/mokly/actions/runs/44608584890) and
  [44608592462](https://github.com/mokly-ai/mokly/actions/runs/44608592462) printed `retained` with HTTP 400, and #88 got no site run,
  so the manual loop deleted 25 `pr-N` deployments. The old Deploy, Desktop
  release, Preview and Site workflows were disabled.
- **Trust Both Repositories:** the operator plan was 8 to add, 1 to change and
  0 to destroy. The apply matched it, and `check` showed no changes.
- **Copies:** 15 secrets, 17 variables, the three environments and the
  `preview` label. `notarytool history` accepted the restored Apple key.
- **Turn On Cloud Delivery (2026-11-20):** Foundation [44714095037](https://github.com/mokly-ai/mokly/actions/runs/44714095037) had no
  changes. Deploy [44714407942](https://github.com/mokly-ai/mokly/actions/runs/44714407942) deployed `e5acd1a2` to main-preview and
  production. The first push Deploy, [44715518003](https://github.com/mokly-ai/mokly/actions/runs/44715518003), passed.
- **Retirement (2026-11-20):** the old CI and Foundation were disabled, and the
  preview inventory found no resource. The operator trust plan was 0 to add,
  1 to change and 8 to destroy, and the apply matched it. The condition then
  named only `1305675953`. Foundation [44726543979](https://github.com/mokly-ai/mokly/actions/runs/44726543979) had no changes, and
  Deploy [44726762157](https://github.com/mokly-ai/mokly/actions/runs/44726762157) passed. The old ruleset was disabled, the old
  README commit is `966f808d`, and the old repository is archived. The owner
  ports the closed pull requests from their archived branches, so they got no
  **Moved to** comment.
- **Changes to the steps:** the operator needs Terraform 1.16.2 exactly. When
  the Google application-default credentials need a new login, export
  `GOOGLE_OAUTH_ACCESS_TOKEN="$(gcloud auth print-access-token)"` for
  Terraform. Run the manual Pages loop with `bash`, because `zsh` does not
  split the ID list. A Wrangler login can supply its Cloudflare token. The
  retirement plan exits 1 at the policy check before its approval exists.
