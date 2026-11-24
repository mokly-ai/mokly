# Secrets And Identity

The foundation stack creates secret **IDs and IAM bindings only**. Secret values, private
keys, provider tokens and database passwords never appear in Terraform inputs,
plans, outputs or state. GitHub stores federation resource names as secrets;
it holds no service-account JSON key.

## Inventory

The stable-environment IDs below have prefix `mkc-<environment>-` in project
`mokly-508518`, with environment `production` or `main-preview`. No PR IDs
are created. [Preview Secrets](#preview-secrets) defines the namespace model.

| Suffix                  | Consumer / owner                                      | Rotation                                                                                                                                                                     |
| ----------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalogue-signing-key` | API and catalogue capability signing / operations     | Generate 32 random bytes as lowercase hex; add version and restart both workloads; existing grants/cookies expire                                                            |
| `postmark-token`        | API mail adapter / Postmark sync / operations         | Replace Postmark server token, add version, roll API, revoke old token after smoke                                                                                           |
| `origin-tls-key`        | Ingress bootstrap / operations                        | Generate new key and Cloudflare Origin CA certificate together before expiry                                                                                                 |
| `origin-tls-id`         | Legacy stable certificate history / operations        | Retained stable identifiers; no new per-PR history ID                                                                                                                        |
| `origin-tls-cert`       | Ingress bootstrap / operations                        | Same rotation as key; includes internal app-origin, public API and catalogue wildcard SANs                                                                                   |
| `github-app-key`        | API GitHub App signer / GitHub App owner              | Add replacement App key, roll API, then revoke the old key                                                                                                                   |
| `github-client-secret`  | API GitHub OAuth / GitHub App owner                   | Add replacement client secret, roll API, then revoke the old secret                                                                                                          |
| `github-webhook-secret` | API webhook verification / GitHub App owner           | Coordinate the GitHub webhook setting and API rollout                                                                                                                        |
| `e2b-api-key`           | API cloud build sandboxes / E2B team owner            | Create a replacement E2B key, add version, roll API, verify a build and inventory cleanup, then delete the old key                                                           |
| `publish-smoke-token`   | Operator publish proof / project owner                | Issue a project publishing token through the API; replace and revoke through the API                                                                                         |
| `stripe-catalogue-key`  | Deploy workflow catalogue sync / Stripe account owner | Create a [restricted key](../protocol/cloud/billing-catalogue-operations.md#key-per-environment), add a version, dry-run sync, disable old version, delete old key in Stripe |
| `stripe-secret-key`     | API billing provider / Stripe account owner           | Create a replacement restricted key with the [Billing smoke](./billing-smoke.md#keys-and-secrets) permissions, add version, roll API, then delete the old key                |
| `stripe-webhook-secret` | API webhook verification / Stripe account owner       | Roll the endpoint secret in Stripe, add version and roll API within Stripe's overlap window                                                                                  |

The chart mounts all three GitHub secrets into the API only when
`github.enabled` is true, and `e2b-api-key` only when `builds.enabled` is true;
the entrypoint maps them to the runtime's secret
environment variables. Disabled environments need no active GitHub secret
versions. Disabled builds need no active E2B key version. The two API Stripe secrets follow the same rule under `billing.enabled`,
exist for stable environments only like `postmark-token`, and use the
account's test mode on `main-preview` and live mode in production. The
Terraform, chart and entrypoint support is in place. PR environments use the log mailer with `MKC_ENV=preview`, which
requires HTTPS origins. They have no Postmark secret ID, version or mount.
Authentication links appear in restricted
API logs; access to those logs permits using those links.
Before the readable-address rollout, configure each GitHub App registration
with `<app-origin>/auth/github/callback` as its user callback and
`<app-origin>/auth/github/install` as its setup URL. The webhook uses
`<api-origin>/v1/github/webhooks`; see [Deployment](./deploy.md) for each origin.
`POSTMARK_FROM` is nonsecret environment configuration. Stable SQL uses short-lived IAM
authentication; PR Postgres uses its generated namespace password.

The separate `stripe-catalogue-key` follows the same environment modes but is
read only by the deploy workflow; no workload can read it, and the API's
`stripe-secret-key` never enters that workflow.

For the first `main-preview` rollout, `github-app-key` and
`github-webhook-secret` already have active versions. Apply the updated
foundation first so Terraform creates `github-client-secret`, then add its
waiting value as a version; do not recreate or copy the two existing values.
The `origin-tls-key`, `origin-tls-cert`, `origin-tls-id` and
`catalogue-signing-key` IDs also have active versions from the verified
2026-09-18 provisioning. That Origin CA certificate named the former app and
API hosts; on 2026-09-24 the operator rotated both stable environments' key
and certificate to version 2, covering the internal app-origin host, the
public API host, the catalogue wildcard and, until the next rotation, the
former app host so a rollback stays reachable. The signing key is unaffected
and remains reusable.

| Shared secret                           | Scope and consumer                                                                                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `mkc-cloudflare-api-token`              | Operator only; app/catalogue zones: DNS/certificate-pack and Origin CA edit, plus app/API zone settings edit when `manage_zone_settings` is true; no Workers permissions |
| `mkc-cloudflare-plan-token`             | Plan account; matching DNS, SSL/certificate and zone read access across the app and catalogue zones                                                                      |
| `mkc-cloudflare-apply-token`            | Apply account; DNS and SSL and Certificates edit on only the app and catalogue zones; no Origin CA, zone-settings or Workers permissions                                 |
| `mkc-cloudflare-worker-token`           | Deploy account; Workers Scripts and Workers Routes edit on only the app/API zone                                                                                         |
| `mkc-preview-origin-tls-key`            | Deploy reads shared Origin CA private key; platform copies to `preview-origin-tls` key `tls.key`                                                                         |
| `mkc-preview-origin-tls-cert`           | Deploy reads certificate for exactly `*.preview.D`, `*.preview.api.D`; copy key `tls.crt`                                                                                |
| `mkc-catalogue-dns-token`               | Deploy and cert-manager; Zone DNS Edit + Zone Read on only catalogue zone `C`; copy to `catalogue-dns-token` key `api-token`                                             |
| `mkc-desktop-developer-id-p12`          | Operator only; backup of `CSC_LINK` as the raw `.p12` file; see [Desktop release secrets](#desktop-release-secrets)                                                      |
| `mkc-desktop-developer-id-p12-password` | Operator only; backup of `CSC_KEY_PASSWORD`                                                                                                                              |
| `mkc-desktop-notary-api-key`            | Operator only; backup of `APPLE_API_KEY` as the `.p8` file                                                                                                               |

Operations rotates the shared API token in Secret Manager, verifies DNS and
Origin CA access with the replacement, then revokes the old token. The token is
never mounted into a workload or granted to CI. Operator Origin CA API
requests use `Authorization: Bearer`; per-PR issuance and certificate-history
secrets are retired. Cloudflare documents the required Zone SSL and
Certificates edit permission in [Origin CA automation](https://developers.cloudflare.com/ssl/origin-configuration/origin-ca/#api-calls)
and the Bearer request shape in the [create API](https://developers.cloudflare.com/api/resources/origin_ca_certificates/methods/create/).

Rotate the apply token independently: add its replacement as a new
`mkc-cloudflare-apply-token` version, run one stable plan/apply with no changes,
then revoke the previous Cloudflare token. It is available only to the apply
identity and never enters plan, deploy, preview or workload jobs.

`mkc-cloudflare-origin-ca-token` is a retired, unused Secret Manager ID. The
real foundation state already contains it with deletion protection, so Terraform
temporarily preserves its address as
`google_secret_manager_secret.origin_ca`; do not add a version or grant access.
Removing that resource block in one step would plan a destroy that the provider
must reject. Retire it in two reviewed foundation applies: first change
`deletion_protection` to `false` and apply that update; after state records the
disabled protection, remove the resource block and apply the intentional
destroy. Keep the test assertion until that staged cleanup is complete.

The public-site workflow uses GitHub Actions secret
`CLOUDFLARE_PAGES_API_TOKEN`, falling back to the existing
`CLOUDFLARE_API_TOKEN`, together with nonsecret repository variable
`CLOUDFLARE_ACCOUNT_ID`. The token needs Cloudflare Pages edit access for the
`mokly-site` project. It enters only the workflow's validation, deploy and
cleanup step environments; fork builds receive neither credential. Prefer the
narrow Pages token when both secrets are available, rotate it in GitHub, run a
same-repository preview smoke, then revoke the old value. The Pages project and
token are intentionally outside Terraform; manually created Terraform-owned
Cloudflare or GCP resources still require import before their first apply, as
the [import rule](./foundation.md#imports) times it.

The deploy workflow reads `mkc-cloudflare-worker-token` only after its GCP OIDC
exchange. An operator creates the token with Account → Workers Scripts → Edit
and Zone → Workers Routes → Edit, restricted to the app/API zone, then adds it
as a Secret Manager version. It is not mounted into a workload, exposed to
Terraform plan/apply jobs or passed to site/PR-preview steps. Wrangler receives
it through one process environment backed by a mode-0600 temporary file. Rotate
the Secret Manager version, verify an idempotent Worker deploy, then revoke the
old Cloudflare token. It is the only token with Workers permissions.

### Worker token cutover

Record: on 2026-09-28, PR #29 added the manual Deploy dispatch, and Deploy
stopped reading repository secret `CLOUDFLARE_WORKER_API_TOKEN`. This runbook
required an operator to add the first token version and delete that repository
secret before the merge. A new setup needs no cutover.

Do not store the token as a repository secret. A branch-selected manual run uses
that branch's workflow file; a repository secret would therefore bypass the
protected-main boundary. The GCP provider instead rejects a non-main workflow
ref before it can read the token.

The Foundation run of the merged change creates the protected secret ID and
the deploy identity's single accessor grant. Then add the token without placing
it on the command line:

```sh
gcloud secrets versions add mkc-cloudflare-worker-token \
  --project=mokly-508518 --data-file=/secure/cloudflare-worker-token
```

If the secret ID or the IAM binding already exists outside Terraform, import it
as the [import rule](./foundation.md#imports) times it:

```sh
terraform -chdir=infra/terraform/foundation import \
  google_secret_manager_secret.cloudflare_worker \
  projects/mokly-508518/secrets/mkc-cloudflare-worker-token
terraform -chdir=infra/terraform/foundation import \
  google_secret_manager_secret_iam_member.cloudflare_worker \
  'projects/mokly-508518/secrets/mkc-cloudflare-worker-token roles/secretmanager.secretAccessor serviceAccount:mkc-github-deploy@mokly-508518.iam.gserviceaccount.com'
```

The managed Secret Manager CSI driver authenticates as the **Google service
account** annotated on each Kubernetes service account. Foundation passes its
created account emails to `modules/secrets`, which owns one scoped
`google_secret_manager_secret_iam_member.workload` binding per workload/secret.
The API reads its signing key, three GitHub secrets and (for stable environments)
Postmark token, two Stripe credentials and E2B key. Catalogue reads only its signing
key. Neither workload reads `stripe-catalogue-key`.
Workloads cannot read origin TLS credentials or the operator's publish token. The namespace-specific
Kubernetes-to-Google Workload Identity binding also serves Cloud SQL and GCS.
Do not add duplicate direct Kubernetes-principal secret grants.

The 2026-09-19 preview rollout required six manual Google-account grants because
Terraform granted the direct Kubernetes principals instead. Adopt those grants
before applying this correction. For each existing API secret, import the
`api/PURPOSE` address; use `catalogue/catalogue-signing-key` and the `cat`
Google account for the sixth binding:

```sh
terraform -chdir=infra/terraform/foundation import \
  'module.secrets["main-preview"].google_secret_manager_secret_iam_member.workload["api/postmark-token"]' \
  'projects/mokly-508518/secrets/mkc-main-preview-postmark-token roles/secretmanager.secretAccessor serviceAccount:mkc-main-preview-api@mokly-508518.iam.gserviceaccount.com'
```

After import, review a plan that retains those Google-account grants, creates
missing environment grants, and removes only the obsolete direct-principal IAM
members. No secret ID or version should be replaced. Fresh environments need no
manual secret-access workaround. Verify a real CSI mount after reconciliation;
mock-provider tests cannot prove provider authentication.

### Desktop release secrets

The release job and the promotion job of the desktop release workflow use the
`desktop-release` GitHub environment.
[Desktop distribution](../protocol/cloud/desktop-distribution.md#release-secrets)
says which step receives each secret. The environment admits only the `main`
branch and has no required reviewer, because the merge of the desktop release
pull request approves the release. The jobs read none of the secrets from
Secret Manager, and none enters a workload or a Terraform job.

The workflow writes the certificate and the API key to mode-0600 temporary
files for electron-builder and never places a value on a command line. The
packaging script replaces `CSC_LINK` and `APPLE_API_KEY` with their temporary
file paths in the builder environment and removes both files after success or
failure. The Contents write scope of `DESKTOP_RELEASES_TOKEN` covers every
request of both jobs, so the token needs no other scope.

A repository administrator creates the environment once and limits it to
`main`:

```sh
gh api -X PUT repos/mokly-ai/mokly/environments/desktop-release \
  -F 'deployment_branch_policy[protected_branches]=false' \
  -F 'deployment_branch_policy[custom_branch_policies]=true'
gh api -X POST repos/mokly-ai/mokly/environments/desktop-release/deployment-branch-policies \
  -f name=main -f type=branch
```

Enter each secret with
`gh secret set NAME --env desktop-release --repo mokly-ai/mokly`, which reads
the value without printing it. After the first desktop release passes, delete
the repository secrets of the same names.

| Secret                   | Value                                                                          | Owner                          | Rotation                                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------ | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `CSC_LINK`               | Base64 `.p12` export of the Developer ID Application certificate               | Apple Developer account holder | Export the renewed certificate before expiry, replace the secret, check the next desktop release, then revoke the old certificate      |
| `CSC_KEY_PASSWORD`       | The `.p12` password                                                            | Apple Developer account holder | Rotated with `CSC_LINK`                                                                                                                |
| `APPLE_API_KEY`          | The App Store Connect API key `.p8` contents                                   | Apple Developer account holder | Create a replacement key in App Store Connect, replace the three Apple API secrets, check the next desktop release, revoke the old key |
| `APPLE_API_KEY_ID`       | That key's identifier                                                          | Apple Developer account holder | Rotated with `APPLE_API_KEY`                                                                                                           |
| `APPLE_API_ISSUER`       | The App Store Connect issuer identifier                                        | Apple Developer account holder | Rotated with `APPLE_API_KEY`                                                                                                           |
| `DESKTOP_RELEASES_TOKEN` | Fine-grained GitHub token with contents write on `mokly-ai/mokly-desktop` only | Repository administrator       | Create a replacement token, replace the secret, check the next desktop release, then delete the old token                              |

The operator keeps a backup of the three credential values in the
operator-only Secret Manager IDs of the [Inventory](#inventory):
`mkc-desktop-developer-id-p12` holds the raw `.p12` file,
`mkc-desktop-developer-id-p12-password` its password, and
`mkc-desktop-notary-api-key` the `.p8` file. Foundation owns the three IDs
and grants no identity access to them. The values never enter Terraform.
App Store Connect always shows the key ID and the issuer ID, so they need no
backup. After a rotation, add each new value as a new version of the same ID.
To restore the three environment secrets from the backups:

```sh
umask 077
dir="$(mktemp -d)"
for id in mkc-desktop-developer-id-p12 mkc-desktop-developer-id-p12-password mkc-desktop-notary-api-key; do
  gcloud secrets versions access latest --secret="$id" --project=mokly-508518 --out-file="$dir/$id"
done
base64 < "$dir/mkc-desktop-developer-id-p12" | gh secret set CSC_LINK --env desktop-release --repo mokly-ai/mokly
gh secret set CSC_KEY_PASSWORD --env desktop-release --repo mokly-ai/mokly < "$dir/mkc-desktop-developer-id-p12-password"
gh secret set APPLE_API_KEY --env desktop-release --repo mokly-ai/mokly < "$dir/mkc-desktop-notary-api-key"
rm -rf "$dir"
```

## Identity Boundaries

GitHub OIDC exchanges a token for a short-lived GCP credential. The federation
provider checks numeric repository and owner IDs and a trusted workflow ref on
`refs/heads/main`. Separate plan, apply, deploy, Postmark sync and foundation
service accounts have separate bindings. Plan has compute/container/Cloud
SQL/Secret Manager/Monitoring metadata viewer roles, service usage, the
`mkcFoundationPlan` role with only `get`, `list`, `getIamPolicy` and
`getAttestationRules` permissions for the foundation resource types, its own
read-only Cloudflare secret, and objectAdmin only on the state bucket for
backend locks.
It cannot read publication objects.
Apply has state access, one custom role limited to the CRUD operations used by
the per-environment SQL, reserved IP, Cloud Armor and alert-policy resources,
including `logging.notificationRules.create`, `logging.notificationRules.delete`,
`logging.notificationRules.get`, `logging.notificationRules.list` and
`logging.notificationRules.update` for log-based alerts. It can access only the
dedicated Cloudflare apply token. It has no IAM or
federation permissions and cannot read workload secrets or publication objects;
the trusted workflow invokes only the per-environment Terraform root.
The dedicated `mkc-github-postmark` identity is trusted only by the protected
`deploy.yml` workflow on `main`. Foundation grants it `secretAccessor` on the
two stable `postmark-token` IDs and no other cloud role. Repository secret
`GCP_POSTMARK_SYNC_SERVICE_ACCOUNT` contains its email address, not a token.
The sync jobs read each environment's token immediately before calling
Postmark, mask it in the runner, and do not persist it. After the Foundation run
of the merged change creates the identity, set that repository secret from the
foundation `github_service_accounts.postmark` output. See
[Postmark template synchronization](../protocol/cloud/email-postmark-sync.md).

The dedicated `mkc-github-foundation` identity is trusted only by the protected
`foundation.yml` workflow on `main`. Its custom role `mkcFoundationApply` has an
exact permission list for the resource types of the foundation root: project
services and IAM, custom roles, service accounts and their policies, workload
identity federation, networking, GKE, Artifact Registry, buckets and Secret
Manager IDs and policies. It also has objectAdmin on the state bucket and
`secretAccessor` on only `mkc-cloudflare-foundation-token`. Outside the state
bucket, it reads no secret version or object content and holds no Kubernetes
object permission. It can change project IAM, so treat it as owner-equivalent: the
Foundation workflow file and `main` protection are part of its credential
boundary. Repository secret `GCP_FOUNDATION_SERVICE_ACCOUNT` contains its email
address, not a token. See [Foundation apply](./foundation.md).

Deploy has project-level `roles/container.developer` and the custom
`mkcPreviewPlatformDeploy` role, Artifact Registry writer on the Mokly
repository. Its Secret Manager access is limited to named stable ingress TLS
and Stripe catalogue-key IDs, the dedicated Worker token and the three shared
preview IDs below. On 2026-09-23,
`kubectl auth can-i` with a token minted as
`mkc-github-deploy@mokly-508518.iam.gserviceaccount.com` on
`mkc-autopilot` allowed CRDs, IngressClass, ClusterIssuer and namespaced
workloads, but denied RBAC and webhook creation, including the platform charts'
namespaced Roles and RoleBindings. The [preview platform contract](../protocol/cloud/preview-platform.md#authorization-and-readiness)
records the exact results and missing IAM permissions. The custom role grants
only the missing RBAC/webhook create, update and delete verbs plus `escalate`
and `bind`, which Kubernetes requires when installing roles and bindings whose
permissions the deploy identity does not already hold. The operator-installed
platform and PR chart proved the scripts, not deploy-identity authorization;
verify the deploy preflight after the Foundation workflow applies a change to
that role.
The GKE DNS front end and Kubernetes object authorizer require project IAM
without a cluster-name or Kubernetes-object-name condition. `mokly-508518`
contains only `mkc-autopilot`; only trusted `main` workflows can assume the
deploy identity. Create an RBAC or dedicated-project boundary before adding
a second cluster. Deploy gains `roles/storage.admin` on only
`mokly-508518-preview-blobs`, including IAM updates for the two conditional PR
object grants and prefix cleanup. It also gains `roles/secretmanager.secretAccessor`
on the dedicated Worker token and the three shared preview IDs above. It gains
the same role on each stable environment's `stripe-catalogue-key` and no other
API credential. It has no Terraform state access; only plan/apply access the
state bucket. Deploy cannot administer project IAM,
provision service accounts or apply foundation infrastructure. It has no direct
Secret Manager access to API credentials; as a cluster workload administrator
it can deploy code that uses workload privileges, so treat trusted deployment
code and main-branch protection as part of the credential boundary.
The cluster permission includes workload/secret administration in its namespaces;
protect the deploy workflow and `main` merge controls accordingly.

Foundation owns service accounts, project/resource IAM and bucket/Secret
Manager ID creation, and the Foundation workflow applies it. The sole runtime
IAM exception is the preview workflow
maintaining the two prefix-scoped members per PR on the shared bucket. A
protected-main push or accepted manual Deploy dispatch authorizes CI to plan
and apply the exact saved stable-environment plan before workload deployment.
PR namespace/DNS/prefix lifecycle is automated; no PR environment state exists. Policy tests prohibit
broad Owner/Editor/Viewer, IAM-admin and service-admin roles, pin the apply
role to the environment root's required permissions and pin both foundation
roles to exact lists.

Stable APIs mount Postmark; PR APIs use the log mailer. Stable API/catalogue
mount the signing key through CSI. Their
Kubernetes accounts `api`, `catalogue` and `reset` in `mkc-<environment>` are
annotated with their environment GCP service accounts. Workload Identity binds
precisely those namespace/account names. Reset is a non-serving, release-only
identity used by the Admin API and Helm hook, and the only workload identity
assigned the `cloudsqlsuperuser` database role. Deploy may impersonate reset
only to list, delete and create the database in a reset release, which names
the instance of its own environment. The reset role has no instance condition,
because IAM conditions do not apply to Cloud SQL database operations, so each
reset account can manage the databases of both stable instances. Stable API
mounts Postmark through the
managed Secret Manager CSI driver; the entrypoint reads the mounted file before
starting the binary. The catalogue Google service account receives access only
to the signing key. Catalogue gets no API mail or GitHub credentials. Migration
and maintenance Jobs mount no secrets. Environment SQL connection grants are
scoped to its instance; GCS and Secret Manager IAM are scoped to individual
resources.

The deploy account can read ingress TLS secrets to create the Kubernetes
`origin-tls` secret before Helm. Certificate values travel through a private temporary directory and are removed
on exit. Rotation adds a Secret Manager
version, refreshes that secret and runs the normal rollout and smoke checks.
API secrets are read at process startup: adding a version requires a rollout,
even if CSI has refreshed the mounted file. A database reset is destructive and
must not be used for routine secret rotation. For a targeted operator restart,
export `MKC_APP_ORIGIN`,
`MKC_API_ORIGIN`, `MKC_CATALOGUE_DOMAIN` and `MKC_REVISION` from the deployment
record. Export `MKC_DESKTOP_CLIENT` from that environment's Helm
`desktopClient` value. Smoke checks the app at the origin root and needs no
base-path setting.
After adding a version, run:

```sh
kubectl -n "mkc-$ENVIRONMENT" rollout restart deployment/api
kubectl -n "mkc-$ENVIRONMENT" rollout status deployment/api --timeout=10m
python3 infra/scripts/smoke.py
```

A Helm upgrade to identical values does not itself restart pods; use the
explicit restart above when rotating a secret without changing the image.

Rotate catalogue signing material by adding a new version and restarting both
`deployment/api` and `deployment/catalogue`. Existing signed cookies become
invalid; readers obtain new access through the app. Coordinate the rollout to
minimize mismatched-key failures. Never print the key into logs.

For builds, foundation owns `mkc-<environment>-e2b-api-key` and its API Google
account's single accessor grant in each stable environment. Deploy, catalogue,
app, migration and maintenance receive no E2B key mount. The API entrypoint
exports its mounted file as `MKC_E2B_API_KEY` at startup. API process restarts
are required after rotation. Follow [Build template](./build-template.md) for
initial provisioning, imports, overlap, rollout and the real build proof.

## Preview Secrets

Foundation implements the three shared IDs and deploy grants; an operator
supplies their values. Import any pre-created ID at
`google_secret_manager_secret.preview["SECRET_ID"]` using
`projects/mokly-508518/secrets/SECRET_ID` before the first apply, substituting
one of the three full IDs in the inventory above. Secret versions stay outside
Terraform. The platform and namespace lifecycle scripts passed the September 23
credentialed proof recorded in [Previews](./preview.md).
The platform script reads shared TLS and catalogue DNS values into private
files and upserts Secrets in `mkc-preview-system`. It never passes values in
command arguments, logs or Helm values. Only cert-manager reads the catalogue
DNS token in-cluster; PR workloads cannot.

Rotate shared Origin CA material by issuing a new matching key/certificate for
exactly `*.preview.D` and `*.preview.api.D`, validating SANs/expiry/key match,
and adding versions to `mkc-preview-origin-tls-key` and
`mkc-preview-origin-tls-cert`. Run `preview-platform.sh` then its readiness
check; nginx reloads the updated `preview-origin-tls`. Smoke an existing PR
through Cloudflare before revoking the old certificate. Keep old versions until
verification passes. App/API edge certificates remain in the existing pack.

Rotate the DNS token by creating a replacement with Zone DNS Edit and Zone Read
on only `C`, adding a `mkc-catalogue-dns-token` version, and running the platform
script. Verify issuer readiness and a real DNS-01 issuance before revoking the
old token; readiness alone does not exercise a new challenge. Preview deploy
and cleanup read the latest version. PR certificates renew through
`ClusterIssuer/mkc-preview-letsencrypt`; their private keys never enter GCP
Secret Manager or workflow artifacts. The shared ACME account remains in
`mkc-preview-system` across PR deletions.

The deploy script creates these PR namespace Secrets once:

| Secret                  | Keys                                                               | Lifetime                                                             |
| ----------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `postgres-credentials`  | `password` (32 random bytes as hex), `url` (complete Postgres URL) | Namespace; never regenerate against an existing PVC                  |
| `catalogue-signing-key` | `catalogue-signing-key` (32 random bytes as lowercase hex)         | Namespace; mounted at `/var/run/mokly-secrets/catalogue-signing-key` |
| `preview-sign-in`       | `preview-sign-in` (32 random bytes as lowercase hex)               | Namespace; API mount; may be created beside an existing PVC          |

The exact URL is
`postgres://mokly:<password>@postgres:5432/mokly?sslmode=disable&connect_timeout=5`.
API and catalogue share that namespace database owner and signing key. They
have direct workload-identity bucket grants, no Google-account annotations,
Cloud SQL proxy or CSI secret classes. Pushes never rotate the keys/password;
normal removal and redeployment creates a new database and new keys. Damaged
Secrets require restoring the matching value or explicitly discarding the PR
namespace and its data, not overwriting the password on redeploy.

API/catalogue/app keep service-account token automount disabled, and the PR
chart creates no Role or RoleBinding. These are trusted same-repository PR
workloads in a shared cluster, not hostile-tenant isolation.

## Initial Provisioning

Authenticate as an authorized operator with `gcloud auth login` and
`gcloud auth application-default login`; select `mokly-508518`. Follow
[State bootstrap](../../infra/terraform/README.md) first. For a stable environment, from a secure shell:

```sh
openssl rand -hex 32 | tr -d '\n' > /secure/catalogue-signing-key
gcloud secrets versions add "mkc-$ENVIRONMENT-catalogue-signing-key" \
  --project=mokly-508518 --data-file=/secure/catalogue-signing-key
gcloud secrets versions add "mkc-$ENVIRONMENT-postmark-token" \
  --project=mokly-508518 --data-file=/secure/postmark-token
gcloud secrets versions add "mkc-$ENVIRONMENT-origin-tls-key" \
  --project=mokly-508518 --data-file=/secure/tls.key
gcloud secrets versions add "mkc-$ENVIRONMENT-origin-tls-cert" \
  --project=mokly-508518 --data-file=/secure/tls.crt
gcloud secrets versions add "mkc-$ENVIRONMENT-github-client-secret" \
  --project=mokly-508518 --data-file=/secure/github-client-secret
gcloud secrets versions add "mkc-$ENVIRONMENT-github-app-key" \
  --project=mokly-508518 --data-file=/secure/github-app-key.pem
gcloud secrets versions add "mkc-$ENVIRONMENT-github-webhook-secret" \
  --project=mokly-508518 --data-file=/secure/github-webhook-secret
```

The webhook secret must be at least 32 bytes (`openssl rand -hex 32`); the API
refuses to start on a shorter value. Set the same value on the GitHub App
before adding the Secret Manager version, then recreate the API pods so the
CSI mount picks up the new version.

Create a Cloudflare Origin CA certificate for the environment's internal
app-origin host, public API host and wildcard catalogue SAN using the Cloudflare
dashboard/API. Store the private key only in Secret Manager and the operator's
secured temporary file. Validate the matching key, exact SANs and expiration
before rollout. App/API edge issuance comes from the one foundation-owned
Advanced Certificate Manager pack; main-preview catalogue edge certificates remain
per environment; PRs use cert-manager. Wait until every applicable certificate is active.

For a fresh SQL instance, use Cloud SQL Studio as the database administrator
to grant the Terraform-created API IAM user database/schema creation grants:

```sql
GRANT CONNECT, CREATE, TEMPORARY ON DATABASE mokly TO "mkc-main-preview-api@mokly-508518.iam";
-- Run in the mokly database; replace the environment in the identifier.
GRANT USAGE, CREATE ON SCHEMA public TO "mkc-main-preview-api@mokly-508518.iam";
```

After API migrations create the tables, grant the catalogue user schema access,
reads and one-use grant consumption. Before the first Helm release, run the API
image's `migrate` with the API IAM connection from an authenticated operator
environment. As the administrator, grant database/schema access (replace the
environment in each identifier):

```sql
GRANT CONNECT ON DATABASE mokly TO "mkc-main-preview-cat@mokly-508518.iam";
GRANT USAGE, CREATE ON SCHEMA public TO "mkc-main-preview-cat@mokly-508518.iam";
```

Then connect **as the API IAM user**, which owns the migrated tables, to grant
catalogue reads and default privileges. Cloud SQL's `postgres` administrator
cannot grant access to API-owned tables merely through its `cloudsqlsuperuser`
role; attempting the whole sequence as that administrator fails.

```sql
GRANT SELECT ON ALL TABLES IN SCHEMA public TO "mkc-main-preview-cat@mokly-508518.iam";
GRANT DELETE ON catalogue_grants TO "mkc-main-preview-cat@mokly-508518.iam";
ALTER DEFAULT PRIVILEGES FOR ROLE "mkc-main-preview-api@mokly-508518.iam" IN SCHEMA public
  GRANT SELECT ON TABLES TO "mkc-main-preview-cat@mokly-508518.iam";
```

Catalogue `serve` runs Diesel migration setup and reads migration metadata at
startup, so it is not a SQL read-only principal. The API migration Job must
finish first; catalogue has no ownership grant to change existing API tables.
Future migrations introducing catalogue writes require explicit grants here.
PRs use namespace Postgres and generated Secrets; none of these Cloud SQL
IAM grants applies to them. CI cannot reset stable SQL passwords. Only an
explicit stable `reset=true` dispatch recreates the database through the Cloud
SQL Admin API under the dedicated reset identity; the API identity then grants
access on the tables it creates. See [Preview](./preview.md).
Do not store an administrator password in the repository or a GitHub secret.

The first `main-preview` SQL bootstrap completed on 2026-09-18 with the API
image at digest
`sha256:700f4eecd88560662f94c4fdbd10e495eaab10df2a84a4885175f7d6bd8b8f3a`.
Four temporary GKE Jobs applied the database/schema grants, ran all six
migrations through the API IAM identity, and applied the catalogue
SELECT/DELETE and API-owned default grants above. The operator verified that all
temporary label-scoped resources and the bootstrap API Kubernetes service
account were removed. No product data or application workload was created. The
preflight also confirmed that Cloud SQL omits `type` for the built-in `postgres`
user; do not classify that account as an IAM user from a missing field.

## Credentials Created Before Terraform

Manual creation is supported. For a resource that a pending change declares,
follow the [import rule](./foundation.md#imports), which covers foundation and
both stable environment states. Import a foundation resource
that `main` already declares before the next foundation apply, which today is
the [foundation bootstrap](./foundation.md#foundation-bootstrap). Before the
**first apply**, import every existing
managed resource at its exact address, then plan until no duplicate create is
proposed. Secret versions and service-account keys are never managed/imported
here. Examples for main-preview (with the foundation backend initialized):
Set `ENVIRONMENT=main-preview` for these addresses.

```sh
terraform -chdir=infra/terraform/foundation import \
  'module.secrets["main-preview"].google_secret_manager_secret.this["postmark-token"]' \
  "projects/mokly-508518/secrets/mkc-$ENVIRONMENT-postmark-token"
terraform -chdir=infra/terraform/foundation import \
  'module.identity["main-preview"].google_service_account.workload["api"]' \
  "projects/mokly-508518/serviceAccounts/mkc-$ENVIRONMENT-api@mokly-508518.iam.gserviceaccount.com"
terraform -chdir=infra/terraform/foundation import \
  module.github.google_iam_workload_identity_pool.github \
  projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/mkc-github
```

Use the same `TF_VAR_*` inputs as the subsequent plan. See each provider's import
reference for SQL users, DNS records and IAM members; resource IDs are not
display names. Do not interpret a warning line as an ID or suppress a failed
import. No script here guesses resource existence from error text. Real CLI
recordings and their limits are in `infra/tests/fixtures/README.md`.
