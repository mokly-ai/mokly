# Infrastructure Promotion

This contract defines how a protected `main` push or a manual Deploy dispatch
at `refs/heads/main` authorizes stable Terraform changes without a second
environment approval. It applies to the
`main-preview` and `production` instances of `infra/terraform/environment`.
The Foundation workflow applies the foundation root under the
[foundation promotion contract](./foundation-promotion.md). The bootstrap root
stays operator-applied. The preview workflow owns PR namespaces,
DNS records, prefix objects and conditional bucket grants, with no PR
Terraform environment state; see [PR previews](./pr-preview-environments.md).
Bucket lifecycle removal must be an in-place update, never a destroy or
replacement.

The environment apply role must cover the Logging notification rules associated
with every `google_monitoring_alert_policy` that uses `condition_matched_log`.
It includes `logging.notificationRules.create`, `logging.notificationRules.delete`,
`logging.notificationRules.get`, `logging.notificationRules.list` and
`logging.notificationRules.update`, in addition to the Monitoring policy
permissions. Foundation owns this role. The Foundation run of a merged commit
applies a permission change before the Deploy run of that commit plans an
environment.

## Promotion Sequence

The deploy workflow uses separate plan, apply and workload-deploy identities.
The sequence below has no automatic Stripe archive stage.

1. Build the immutable workload images. In parallel, wait for the Foundation
   run of the same commit, as the
   [foundation promotion contract](./foundation-promotion.md#deploy-waits-for-foundation)
   defines. No credentialed job starts before that wait passes.
2. Publish the immutable workload images.
3. Deploy the shared origin Worker. When cloud deployment is configured, all
   Worker credentials and settings are mandatory; a missing input stops before
   the main-preview plan. A complete cloud deployment cannot treat the Worker
   as an optional skip because every public product request depends on it.
4. Run `preview-platform` with the deploy identity: install/verify the shared
   ingress-nginx, cert-manager and issuer using the pinned versions. Require
   `MKC_PREVIEW_INGRESS_IP` and `MKC_PREVIEW_BLOBS_BUCKET` and the three
   shared secret versions. A partial configuration fails before planning.
5. Plan main-preview with the read-only identity. Save `release.tfplan`, its
   human and JSON forms, and exact Helm inputs in one immutable workflow
   artifact.
6. Apply that exact binary plan with the apply identity. Applying never creates
   a replacement plan.
7. Reconcile the main-preview Stripe catalogue from the reviewed artifact when
   `billing.enabled` is true; a missing catalogue-key version fails closed.
8. Roll out and smoke main-preview.
9. When production promotion is enabled, repeat plan and apply, reconcile its
   catalogue, then roll out and smoke production.

Manual dispatch exposes one boolean `reset` input, defaulting to `false`. When
it is `true`, each enabled stable release stops its serving and maintenance
workloads and its prior release jobs so that no old process can write during
the reset, deletes and recreates the `mokly` database under the non-serving
reset identity, runs every migration from empty and restores the catalogue
role's table grants before any workload starts, and then requires the normal
smoke checks. `main-preview` serves the public `br-main` host; production still
runs only when `MKC_PRODUCTION_ENABLED` is exactly `true`.

Reset irreversibly deletes all rows in the selected stable databases. It keeps
the Cloud SQL instances, IAM users, backups, blob objects, Stripe provider
resources, Secrets, ingress, DNS, Terraform state and Helm history. Retained
objects become unreachable orphans and may be removed independently. Each
environment has a dedicated `reset` Google/Kubernetes service account and IAM
database user. Its custom Cloud SQL role can create, delete and list databases,
and deploy can impersonate only those reset accounts. A reset recreates only the
database of the environment that it resets. Only reset has `cloudsqlsuperuser`.
The API identity applies post-migration grants on the tables it owns, while
catalogue retains its least-privilege role. A failure after database recreation
keeps the serving and maintenance workloads stopped and cannot restore deleted
rows; rerun the same reset after correcting the failure or perform an explicit
backup recovery.

Decision: the database role of each reset account has no instance condition,
because IAM conditions do not apply to Cloud SQL database operations and an
instance condition denies every reset. A recreate through a SQL connection as
the reset database user, which keeps a per-instance limit, was rejected because
only a credentialed run can prove the Cloud SQL privileges that it needs.

The workflow refuses dispatches whose Git ref is not `refs/heads/main` before
the build or any credentialed job. Stable applies accept only `push` or
`workflow_dispatch` events from the trusted `deploy.yml` workflow ref on
`main`. The checked-in Deploy workflow reads only GCP federation resource names
from repository secrets, never the Cloudflare Worker credential.
Foundation stores that credential under
`mkc-cloudflare-worker-token` and grants only the deploy identity access; the
origin-router reads it after the same workflow-ref-bound OIDC exchange. A
branch-selected dispatch can change its workflow file, but it cannot exchange
that branch identity for the deploy account or read the provider token.

Promotion runs never overlap. A saved plan is rejected when the state has
changed since the plan was created.

The required aggregate rejects every failed, cancelled, or unexpectedly
skipped foundation wait, Worker, preview-platform, plan, apply, catalogue sync,
rollout, or smoke stage. It has no archive-job dependency or archive result. An operator may run
the optional manual clean-up only under the
[catalogue archive contract](./billing-catalogue.md#archive).

Only wholly unconfigured cloud deployment accepts the explicit platform skip.

## Destructive Action Approval

Creates, reads, no-ops and in-place updates need no additional declaration.
Any plan action containing `delete` or `forget` is destructive. This includes
both replacement orders (`delete, create` and `create, delete`). A destructive
stable plan is accepted only when the merged revision contains this file:

```text
infra/terraform/environment/destructive-approvals/<environment>.json
```

Foundation uses the same document at its own path, with `environment` set to
`foundation`; see [Foundation promotion](./foundation-promotion.md#destructive-actions).

The document has exactly these fields:

```json
{
  "schemaVersion": 1,
  "environment": "main-preview",
  "configurationDigest": "sha256:<64 lowercase hex characters>",
  "reason": "Rename the stable application records.",
  "actions": [
    {
      "address": "module.dns.cloudflare_dns_record.this[\"app\"]",
      "actions": ["delete", "create"]
    }
  ]
}
```

The action list must equal the plan's destructive resource addresses and
ordered action arrays, with no missing or additional entry. Entries use
canonical address order; a deposed object also carries Terraform's opaque
`deposed` key so two objects at one address remain distinct. The environment
must match the plan, the reason must contain 10–500 non-whitespace characters,
and unknown or duplicate JSON fields fail closed. An unsupported plan format or
action also fails closed.

`configurationDigest` hashes the path and bytes of every `.tf` and
`.terraform.lock.hcl` file under the environment root and shared Terraform
modules. Changing any applicable configuration invalidates the approval. In
GitHub Actions, the approval must also be tracked and byte-for-byte unchanged
from `HEAD`.

The [deployment runbook](../../ops/deploy.md#stable-environment-apply) generates
the document from the real plan. The plan job publishes evidence even when the
policy blocks it.

## Single-Use Cleanup And Recovery

An approval remaining after its destructive actions disappear is stale and
fails the next plan. Remove it in the next merge; this prevents an old approval
from silently authorizing a later recurrence. A changed digest or action set
requires a newly generated document and another merge.

Apply regenerates JSON from the downloaded binary plan and checks the policy
again immediately before Terraform. Editing the artifact JSON cannot bypass
the gate. A policy failure makes no provider mutation.

The environment wrapper accepts only `production` and `main-preview`, with
`plan`, `check` and `apply` actions; there is no destroy plan action and no
per-PR state. PR cleanup uses `preview-destroy.sh preview-pr-N` under the trusted
preview workflow. It never deletes shared foundation or stable resources.
