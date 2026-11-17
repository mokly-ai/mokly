# Foundation Apply

This runbook covers the Foundation workflow, which plans and applies the shared
foundation Terraform root from CI, the Deploy wait for it, and the operator
tasks that remain. [Foundation promotion](../protocol/cloud/foundation-promotion.md)
is the contract. The [Terraform README](../../infra/terraform/README.md#shared-foundation)
describes the foundation resources and the `terraform-foundation.sh` wrapper.

## Normal Operation

Every push to `main` and every manual dispatch from `main` runs **Foundation**:

1. **Plan foundation infrastructure** authenticates as
   `GCP_PLAN_SERVICE_ACCOUNT` and saves the `plan-foundation` artifact:
   `release.tfplan`, `plan.txt` and `plan.json`.
2. **Apply foundation infrastructure** authenticates as
   `GCP_FOUNDATION_SERVICE_ACCOUNT` and applies that exact saved plan.
3. **Foundation required** fails when a job failed, was cancelled or was
   skipped while cloud identity is configured.

To run it without a new commit:

```sh
gh workflow run foundation.yml --ref main
```

The Deploy run of the same commit starts **Wait for foundation** beside the
image build. Its credentialed jobs start only after that job passes. A
Foundation run without changes normally ends before the image build does.

## Wait Failures

**Wait for foundation** reports one of these failures:

| Message                                                          | Action                                                                                              |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `Foundation run <URL> concluded <conclusion> for <SHA>.`         | Open the run and correct the cause. Use **Re-run all jobs** on it. Then re-run the Deploy run.      |
| `No Foundation run of <SHA> appeared within 5 minutes.`          | Check that the Foundation workflow is enabled. Dispatch it from `main`. Then re-run the Deploy run. |
| `The Foundation run of <SHA> did not finish within 120 minutes.` | Wait for that run to finish. Then re-run the Deploy run.                                            |

Act only on the runs of the newest commit on `main`. A re-run keeps the commit
of the original run, so a re-run of an older run applies older configuration
and older images. A failed run of an older commit needs no action, because the
runs of the newest commit carry its change.

To re-run a Deploy run that failed at the wait, use **Re-run failed jobs**
within one day of its image build. The image artifact expires after one day,
so after that use **Re-run all jobs**. Use **Re-run all jobs** for a failed
Foundation run, so that the apply never reuses a saved plan that Terraform
rejects. When the fix is a new commit, its own runs apply it, and no re-run is
needed.

When a newer push supersedes a queued Foundation run, GitHub cancels the queued
run. GitHub normally cancels the queued Deploy run of that commit too. A Deploy
run of that commit that already started fails at the wait. The Deploy run of
the newer commit continues, so no action is needed.

## Permission Denials After An IAM Change

IAM changes take effect after a propagation delay. When a credentialed job
fails with a permission denial directly after a Foundation run that changed a
role or a binding, wait a few minutes. When that run belongs to the newest
commit on `main`, use **Re-run all jobs** on it, so that each apply gets a new
plan. A re-run of only a failed apply job
reuses its saved plan, and Terraform rejects that plan when the failed apply
changed the state. Change the role again only when the re-run fails with the
same denial.

## Destructive Foundation Plans

A delete, replacement or forget in the foundation plan needs the committed
approval `infra/terraform/foundation/destructive-approvals/foundation.json`,
which the [contract](../protocol/cloud/foundation-promotion.md#destructive-actions)
defines. Generate it from the real plan, never by hand from terminal output:

```sh
mkdir -p infra/terraform/foundation/destructive-approvals
python3 infra/scripts/terraform-plan-policy.py approval \
  foundation .context/plans/foundation/plan.json \
  --reason "Explain the intended destructive result." \
  > infra/terraform/foundation/destructive-approvals/foundation.json
```

Review `plan.txt`, `plan.json`, the approval and the configuration change
together, then commit the approval with the change. Remove it in the next merge
after the Foundation run applies it.

CI never deletes, replaces or forgets a
[trust resource](../protocol/cloud/foundation-promotion.md#trust-set), even with an
approval. The plan job then fails with a `Terraform plan policy:` message that
names the resource. To apply such a change:

1. Merge the change. The Foundation run fails at the plan, and Deploy runs fail
   at the wait.
2. Check out `main` and authenticate with the operator identity.
3. Run `bash infra/scripts/terraform-foundation.sh plan` with the inputs in the
   [Terraform README](../../infra/terraform/README.md#shared-foundation).
4. Generate the approval document with the command above. Do not commit it: CI
   refuses the change anyway, and the approval is stale after the apply.
5. Review `plan.txt`, then run `bash infra/scripts/terraform-foundation.sh apply`.
6. Delete the local approval document.
7. Dispatch Foundation from `main` with `gh workflow run foundation.yml --ref main`.
   It applies the remaining changes of `main` and passes.
8. Dispatch Deploy from `main` with `gh workflow run deploy.yml --ref main`.
   Do not re-run an older Deploy run.

## Imports

A change can declare an object that already exists outside Terraform, such as
a manually created secret ID, the zone SSL setting or an environment DNS
record. This rule covers each state that CI plans and applies from `main`:

| State          | Root directory                | Backend prefix              | Planned and applied by                       |
| -------------- | ----------------------------- | --------------------------- | -------------------------------------------- |
| Foundation     | `infra/terraform/foundation`  | `foundation`                | Foundation                                   |
| `main-preview` | `infra/terraform/environment` | `environments/main-preview` | Deploy                                       |
| `production`   | `infra/terraform/environment` | `environments/production`   | Deploy, when production promotion is enabled |

Import that object into its state only after the change is approved, then
merge the change at once. Hold other merges until it lands: until then, each
run on `main` that plans that state plans to delete the imported object, and
the plan policy fails that run. A failed Foundation run also fails the Deploy
runs of those commits at the wait. The operator-applied bootstrap state is
outside this rule, because no CI run plans it.

1. Get approval for the change that declares the object.
2. Check out the change with the operator identity. Initialize the backend of
   the state. For foundation, use the inputs in the
   [Terraform README](../../infra/terraform/README.md#shared-foundation):

   ```sh
   root=infra/terraform/foundation
   export TF_VAR_region="$MKC_REGION" TF_VAR_state_bucket="$MKC_STATE_BUCKET"
   export TF_VAR_domain="$MKC_DOMAIN" TF_VAR_zone_id="$MKC_CLOUDFLARE_ZONE_ID"
   export TF_VAR_repository_id="$MKC_REPOSITORY_ID" TF_VAR_owner_id="$MKC_REPOSITORY_OWNER_ID"
   terraform -chdir="$root" init -reconfigure \
     -backend-config="bucket=$MKC_STATE_BUCKET" -backend-config=prefix=foundation
   ```

   For an environment, set `ENVIRONMENT` to `main-preview` or `production`, and
   use the inputs in
   [Before The First Apply](../../infra/terraform/README.md#before-the-first-apply):

   ```sh
   root=infra/terraform/environment
   export TF_VAR_environment="$ENVIRONMENT" TF_VAR_region="$MKC_REGION"
   export TF_VAR_domain="$MKC_DOMAIN" TF_VAR_zone_id="$MKC_CLOUDFLARE_ZONE_ID"
   export TF_VAR_catalogue_base_domain="$MKC_CATALOGUE_BASE_DOMAIN"
   export TF_VAR_catalogue_zone_id="$MKC_CATALOGUE_CLOUDFLARE_ZONE_ID"
   export TF_VAR_notification_channels="$MKC_NOTIFICATION_CHANNELS"
   export TF_VAR_network_id=projects/mokly-508518/global/networks/mkc
   terraform -chdir="$root" init -reconfigure \
     -backend-config="bucket=$MKC_STATE_BUCKET" \
     -backend-config="prefix=environments/$ENVIRONMENT"
   ```

3. Import each object at its address. A Google import needs no Cloudflare
   token. A Cloudflare import reads the object, so set the read-only plan token
   first:

   ```sh
   export CLOUDFLARE_API_TOKEN="$(gcloud secrets versions access latest \
     --secret=mkc-cloudflare-plan-token --project=mokly-508518)"
   terraform -chdir="$root" import 'ADDRESS' 'IMPORT_ID'
   unset CLOUDFLARE_API_TOKEN
   ```

4. Run `bash infra/scripts/terraform-foundation.sh plan` for foundation, or
   `bash infra/scripts/terraform-environment.sh "$ENVIRONMENT" plan` for an
   environment. The plan must show no create of the imported object and no
   delete or replacement.
5. Merge the change at once. The Foundation or Deploy run of the merge applies
   the plan of that state.

## Recovery

When the Foundation workflow cannot authenticate, read the state or read its
token, apply foundation from `main` as the operator with the same wrapper. A
recovery apply that recreates a trust resource restores the CI path; check the
next Foundation run.

CI can also lose its access through a merged change, such as an in-place update
that disables the identity pool or a new authoritative IAM resource. Then
`main` still declares the cause, so an apply from `main` alone does not restore
the access:

1. Merge a change that reverts the cause. Its Foundation run fails, and its
   Deploy run fails at the wait. Do not commit an approval with the revert,
   because the approval is stale after the operator apply.
2. Apply foundation from `main` as the operator with the same wrapper. When the
   plan has a delete or forget, for example of an authoritative IAM resource,
   use a local approval as steps 4 to 6 of the
   [trust-set procedure](#destructive-foundation-plans) show.
3. Dispatch Foundation from `main` with `gh workflow run foundation.yml --ref main`.
4. Dispatch Deploy from `main` with `gh workflow run deploy.yml --ref main`.

## Foundation Bootstrap

The foundation identity is itself a foundation resource, so an operator applies
it once, from the branch that adds the Foundation workflow, before that branch
merges. Use the operator identity and the inputs in the
[Terraform README](../../infra/terraform/README.md#shared-foundation).

1. Import each object that `main` declares and that already exists outside
   Terraform, such as a manually created E2B or Stripe catalogue key ID, as
   [Imports](#imports) steps 2 and 3 show. Then run
   `bash infra/scripts/terraform-foundation.sh plan` and review
   `.context/plans/foundation/plan.txt`. Expect creates for the foundation
   account, its trust binding, the plan identity's trust binding for
   `foundation.yml`, both foundation custom roles and their bindings, the
   foundation state grant, `mkc-cloudflare-foundation-token` and its grant. Expect in-place updates of the provider condition and of
   `mkcEnvironmentApply`, which gains the five Logging permissions. Also expect
   any other merged foundation change that no operator applied yet. Expect no
   delete or replacement.
2. Run `bash infra/scripts/terraform-foundation.sh apply`.
3. Add the foundation token. It has DNS edit and SSL and Certificates edit on
   the app/API zone only:

   ```sh
   gcloud secrets versions add mkc-cloudflare-foundation-token \
     --project=mokly-508518 --data-file=/secure/cloudflare-foundation-token
   ```

   Check that the token in `mkc-cloudflare-plan-token` can read the DNS
   records, the certificate packs and the zone settings of that zone.

4. Grant your own account `roles/iam.serviceAccountTokenCreator` on
   `mkc-github-plan` and `mkc-github-foundation`. These grants are temporary:

   ```sh
   operator=$(gcloud config get account)
   for name in mkc-github-plan mkc-github-foundation; do
     gcloud iam service-accounts add-iam-policy-binding \
       "$name@mokly-508518.iam.gserviceaccount.com" --project=mokly-508518 \
       --member="user:$operator" --role=roles/iam.serviceAccountTokenCreator
   done
   ```

5. Prove the plan identity. `check` exits 0 when the plan has zero changes:

   ```sh
   account=mkc-github-plan@mokly-508518.iam.gserviceaccount.com
   gcloud auth application-default login --impersonate-service-account="$account"
   gcloud config set auth/impersonate_service_account "$account"
   bash infra/scripts/terraform-foundation.sh check
   ```

6. Prove the foundation identity on that saved plan with the CI apply path:

   ```sh
   account=mkc-github-foundation@mokly-508518.iam.gserviceaccount.com
   gcloud auth application-default login --impersonate-service-account="$account"
   gcloud config set auth/impersonate_service_account "$account"
   GITHUB_ACTIONS=true GITHUB_EVENT_NAME=workflow_dispatch \
     GITHUB_REF=refs/heads/main \
     GITHUB_WORKFLOW_REF=mokly-ai/mokly-cloud/.github/workflows/foundation.yml@refs/heads/main \
     bash infra/scripts/terraform-foundation.sh apply
   ```

   This proves authentication, the state lock, the token read and the policy
   path. The first Foundation run that changes each resource type proves its
   write permissions.

7. For each permission denial in steps 5 and 6, add the missing permission to
   `mkcFoundationPlan` or `mkcFoundationApply` on the branch. Restore your own
   credentials and plan as the operator:

   ```sh
   gcloud config unset auth/impersonate_service_account
   gcloud auth application-default login
   bash infra/scripts/terraform-foundation.sh plan
   ```

   Review the plan output, then run
   `bash infra/scripts/terraform-foundation.sh apply`. Repeat steps 5 and 6.

8. Restore your own credentials, then remove both temporary grants:

   ```sh
   gcloud config unset auth/impersonate_service_account
   gcloud auth application-default login
   for name in mkc-github-plan mkc-github-foundation; do
     gcloud iam service-accounts remove-iam-policy-binding \
       "$name@mokly-508518.iam.gserviceaccount.com" --project=mokly-508518 \
       --member="user:$operator" --role=roles/iam.serviceAccountTokenCreator
   done
   ```

9. Set the repository secret from the foundation output:

   ```sh
   account=$(terraform -chdir=infra/terraform/foundation \
     output -json github_service_accounts | python3 -c \
     'import json,sys; print(json.load(sys.stdin)["foundation"])')
   gh secret set GCP_FOUNDATION_SERVICE_ACCOUNT --body "$account"
   ```

10. Record the apply date, the resource counts and the proof outcome below.

A write permission that is missing later shows as a denial in a Foundation
apply. Add it to `mkcFoundationApply` and merge. The Foundation run of that
merge updates the role and retries the change. When the retry fails with the
same denial during IAM propagation, and that merge is still the newest commit on
`main`, use **Re-run all jobs** on that run.

### Bootstrap Record

On 2026-10-23, an operator ran the bootstrap from branch
`calummoore/terraform-ci-deployment-plan` at `bf43a47`, with Terraform 1.16.2.

- Steps 1 and 2: the plan and the apply had 14 creates, 2 in-place updates and
  no delete. The provider condition gained `foundation.yml`, and
  `mkcEnvironmentApply` gained the five Logging permissions. The creates also
  held the E2B key IDs and grants from PR #45. No object needed an import.
- Step 3: version 1 of `mkc-cloudflare-foundation-token` holds a token with DNS
  and SSL and Certificates Read and Write on `mokly.ai` only.
- Steps 5 to 7: the plan identity was denied
  `iam.googleapis.com/workloadIdentityPools.getAttestationRules`, which
  provider 8.3.0 calls when it reads the identity pool. Commit `f775436` added
  it to both foundation roles, and the operator applied it. Then the plan
  identity's `check` reported no changes, and the foundation identity applied
  that plan through the CI path with 0 changes.
- The proofs passed an impersonated access token in `GOOGLE_OAUTH_ACCESS_TOKEN`
  and set `CLOUDSDK_AUTH_IMPERSONATE_SERVICE_ACCOUNT` on single commands, so no
  `gcloud` or ADC setting changed.
- Steps 8 and 9: the temporary grants are removed, and
  `GCP_FOUNDATION_SERVICE_ACCOUNT` is set.
