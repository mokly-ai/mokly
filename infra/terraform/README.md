# Terraform And State Bootstrap

Use Terraform 1.16.2. `bootstrap/` owns the state bucket, `foundation/` owns the
shared platform and `environment/` is instantiated only for production/main-preview using
separate backend prefixes. Modules have independent mock-provider tests and
committed provider locks. Values and private keys never enter Terraform.

## Ownership and shared-zone adoption

The [Foundation workflow](../../docs/protocol/cloud/foundation-promotion.md) plans
and applies foundation on every `main` push and accepted dispatch. Foundation
owns GCP service accounts, project/resource IAM, bucket and secret IDs/access. The preview workflow maintains only the
two conditional PR members on the shared preview bucket. Secret-access bindings use the Google accounts annotated
on the workload Kubernetes accounts, matching managed CSI, Cloud SQL and GCS;
see [Secrets](../../docs/ops/secrets.md). Its `environments` set defaults to production and
main-preview and accepts no PR environment entries.
It also owns the app/API zone's two proxied preview wildcard A records and the
shared Advanced Certificate Manager pack. The `getmokly.com` redirect is
operator-managed in the Cloudflare dashboard, outside Terraform. Wrangler in
the deploy workflow owns the origin Worker script and routes; Terraform never
declares them.
Environment owns SQL resources, DNS, reserved ingress IP, Cloud Armor and the
publication and billing-delivery dead-letter alerts with required existing
notification channels. Foundation creates three stable-only Stripe secret IDs:
`stripe-secret-key`, `stripe-webhook-secret` and `stripe-catalogue-key`. The API
Google account receives CSI access to the first two; only the deploy identity
can read the catalogue key.
Foundation also owns `e2b-api-key` for each stable environment. Only its API
Google account receives the secret reader grant. Secret versions stay
operator-owned. Merge or import the ID and grant before enabling builds;
see [Build template](../../docs/ops/build-template.md).
Foundation also owns three operator-only desktop release backup IDs. No
identity receives a reader grant on them; see
[Desktop release secrets](../../docs/ops/secrets.md#desktop-release-secrets).
CI uses five identities. Plan has specific metadata viewer roles, the
`mkcFoundationPlan` role with only `get`, `list`, `getIamPolicy` and
`getAttestationRules` permissions, the read-only Cloudflare credential and
state-bucket access for backend locking.
Apply has state access, a custom role limited to per-environment resources and
the dedicated editable Cloudflare credential. Log-based alert policies also
require `logging.notificationRules.create`, `logging.notificationRules.delete`,
`logging.notificationRules.get`, `logging.notificationRules.list` and
`logging.notificationRules.update` to manage their associated Logging rules.
Deploy rolls workloads and maintains prefix grants with
`roles/storage.admin` on only `mokly-508518-preview-blobs`. Postmark sync reads
only the two stable Postmark token IDs. Foundation applies the foundation root
from the Foundation workflow on `main` only. It has the custom role
`mkcFoundationApply`, whose exact permission list covers the resource types
that the root declares, state access and the dedicated
`mkc-cloudflare-foundation-token`. Because it can change project IAM, it is
owner-equivalent inside the project. The other four identities hold no IAM
admin, service admin, Owner, Editor or broad Viewer role. Scope deploy grants to the single-cluster project,
image repository, shared preview bucket, ingress secrets, stable catalogue keys
and catalogue DNS token; inspect the policy test. GKE's DNS front
end and Kubernetes object authorizer require the deploy
`roles/container.developer` binding without a cluster-name condition. The
additional project-level `mkcPreviewPlatformDeploy` custom role grants only
the RBAC and webhook verbs the preview platform charts need.
Neither grant can be conditioned on Kubernetes object names: Google project
IAM authorizes Kubernetes API requests before resource-name-specific RBAC.
The project therefore remains a one-cluster security boundary. Only trusted
`main` workflows can assume the deploy identity; before adding another
cluster, move workload authorization to cluster-local Kubernetes RBAC or a
dedicated project.

An operator applies only the changes in the
[operator path](../../docs/protocol/cloud/foundation-promotion.md#operator-path).

The provider-free `modules/naming` defines workload/reset account IDs/emails, namespaces
and blob bucket names. Foundation's identity/storage modules and the environment
stack consume it, keeping existing resource names aligned without remote-state
reads. Its tests cover production/main-preview and reject PR names; PR namespace
naming lives in the preview scripts/chart, not a Terraform environment.

Before first apply, securely record the shared Cloudflare zone configuration:

```sh
umask 077
curl --fail-with-body -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/$TF_VAR_zone_id/settings/ssl" > /secure/zone-ssl.json
curl --fail-with-body -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/$TF_VAR_zone_id/rulesets/phases/http_request_cache_settings/entrypoint" > /secure/zone-cache.json
```

Record a 404 entrypoint response as absence only after verifying its HTTP status;
authentication errors are failures. The marketing owner must approve shared
settings. `manage_zone_settings` defaults false. To adopt SSL management, confirm
Full (strict) works for apex/www and set it true. Before the import and the
merge, give each token its zone settings permission from the token list in
[Shared Foundation](#shared-foundation). Then **before apply** import, as
[Foundation imports](../../docs/ops/foundation.md#imports) times it:

```sh
terraform -chdir=infra/terraform/foundation import \
  'cloudflare_zone_setting.tls[0]' "$TF_VAR_zone_id/ssl"
```

Terraform never owns the shared cache entrypoint. In Cloudflare's Caching >
Cache Rules dashboard, preserve all recorded marketing rules. Use this exact
bypass expression in the app/API zone. Replace each `"<APP_DOMAIN>"`, quotes
included, with the app/API apex, so that each host is one quoted string:

```text
ends_with(http.host, ".preview."<APP_DOMAIN>"") or http.host eq "app-origin."<APP_DOMAIN>"" or (starts_with(http.host, "app-origin-") and ends_with(http.host, "."<APP_DOMAIN>"")) or http.host eq "api."<APP_DOMAIN>"" or ends_with(http.host, ".preview.api."<APP_DOMAIN>"")
```

The production Worker disables caching on app subrequests; the apex site
keeps its own caching rules.

Use this exact bypass expression in the catalogue zone. Replace
`"<CATALOGUE_DOMAIN>"`, quotes included, with the catalogue zone apex:

```text
ends_with(http.host, "."<CATALOGUE_DOMAIN>"")
```

An unreplaced placeholder leaves `<APP_DOMAIN>` or `<CATALOGUE_DOMAIN>` outside
every [quoted string](https://developers.cloudflare.com/ruleset-engine/rules-language/values/#quoted-string-syntax),
where it is not valid Rules language. Cloudflare
[validates each expression](https://developers.cloudflare.com/ruleset-engine/rules-language/expressions/edit-expressions/#expression-validation)
before it saves a rule, so the dashboard shows a parsing error instead.

Review rule ordering and verify the smoke headers. Apply the app/API rule in
its zone and the catalogue rule in the catalogue zone.
Record Full (strict) TLS and cache settings in both zones; foundation's optional
SSL adoption manages only the app/API zone. Export the rulesets again and
retain the before/after diff. DNS/certificate tokens need permissions in both
zones.

Universal SSL covers the apex and first-level hosts but not
`*.preview.<domain>` or `*.preview.api.<domain>`. Foundation creates one
90-day Let's Encrypt Advanced Certificate Manager pack containing the apex
and both wildcards, with TXT validation. The proxied A records
`*.preview.<domain>` and `*.preview.api.<domain>` point at the foundation
regional `mkc-preview-ingress` address. Main-preview keeps its
environment-owned advanced catalogue pack; production keeps Universal SSL. PR
catalogue DNS/certificates are workflow/cert-manager resources outside
Terraform. A pack or wildcard record that already exists in the Cloudflare
dashboard must be imported before the first foundation apply; the import IDs
are under
[Reconcile Manually Created Resources](#reconcile-manually-created-resources).

## Before The First Apply

An authorized operator supplies `MKC_REGION` (default `us-central1`),
`MKC_STATE_BUCKET` (a globally unique private bucket name), `MKC_DOMAIN`,
`MKC_CLOUDFLARE_ZONE_ID`, an independent `MKC_CATALOGUE_BASE_DOMAIN` and `MKC_CATALOGUE_CLOUDFLARE_ZONE_ID`, existing
`MKC_NOTIFICATION_CHANNELS` (JSON array of channel resource names). Check the
project is `mokly-508518`, billing is enabled, and the chosen region supports
Autopilot and Cloud SQL. Record those bindings in the deployment change. The
site host is the app/API apex and is attached separately to the
operator-managed Cloudflare Pages project. The current domain and origin
bindings are recorded in [Production](../../docs/ops/production.md).

```sh
gcloud auth login
gcloud auth application-default login
gcloud config set project mokly-508518
export TF_VAR_region="${MKC_REGION:?}"
export TF_VAR_state_bucket="${MKC_STATE_BUCKET:?}"
terraform -chdir=infra/terraform/bootstrap init
```

If the bucket already exists, import it **before apply**:

```sh
terraform -chdir=infra/terraform/bootstrap import google_storage_bucket.state "$MKC_STATE_BUCKET"
```

Otherwise review and apply the bootstrap plan. It enables uniform access,
public-access prevention, versioning, soft deletion and `prevent_destroy`.
The initial local state contains bucket metadata only. Move that state into
the bucket by creating a local ignored backend file:

```sh
terraform -chdir=infra/terraform/bootstrap plan -out=bootstrap.tfplan
terraform -chdir=infra/terraform/bootstrap apply bootstrap.tfplan
cat > infra/terraform/bootstrap/remote.backend.tf <<'HCL'
terraform {
  backend "gcs" {}
}
HCL
terraform -chdir=infra/terraform/bootstrap init -migrate-state \
  -backend-config="bucket=$MKC_STATE_BUCKET" -backend-config=prefix=bootstrap
```

Confirm the remote object and lock behavior before removing the local state
backup. Keep a secured backup in the operator's recovery storage. Never commit
state, plans, credentials or the local bootstrap backend file. The bucket's
`bootstrap/default.tfstate` state is separate from all environment prefixes.
The bootstrap state stays remote for future bucket maintenance; CI's offline
validation uses the committed backend-free source.

## Shared Foundation

The Foundation workflow applies foundation under the
[foundation promotion contract](../../docs/protocol/cloud/foundation-promotion.md).
The operator path uses the same wrapper outside GitHub Actions. Operator roles
must cover API enablement, project IAM, service accounts/federation,
networking, GKE, Artifact Registry, GCS and Secret Manager. Use temporary
operator credentials, not a saved service-account JSON key.

```sh
export MKC_REGION="${MKC_REGION:?}" MKC_STATE_BUCKET="${MKC_STATE_BUCKET:?}"
export MKC_DOMAIN="${MKC_DOMAIN:?}" MKC_CLOUDFLARE_ZONE_ID="${MKC_CLOUDFLARE_ZONE_ID:?}"
export MKC_REPOSITORY_ID="$(gh api repos/mokly-ai/mokly-cloud --jq '.id')"
export MKC_REPOSITORY_OWNER_ID="$(gh api repos/mokly-ai/mokly-cloud --jq '.owner.id')"
bash infra/scripts/terraform-foundation.sh plan
# Review .context/plans/foundation/plan.txt.
bash infra/scripts/terraform-foundation.sh apply
terraform -chdir=infra/terraform/foundation output
```

The wrapper initializes backend prefix `foundation` and saves
`release.tfplan`, `plan.txt` and `plan.json` under `.context/plans/foundation`.
It reads the Cloudflare token from Secret Manager, so no token enters shell
history: `plan` and `check` read `mkc-cloudflare-plan-token`, an operator
`apply` reads `mkc-cloudflare-api-token`, and a CI `apply` reads
`mkc-cloudflare-foundation-token`. In GitHub Actions it accepts `apply` only
from the Foundation workflow on `main`. `check` exits 2 when the plan has
changes. CI passes only the region, state bucket, domain, zone ID and numeric
repository and owner IDs, so commit any other variable value as its default.
The foundation output supplies the GitHub provider resource name and the
plan, apply, deploy, Postmark sync and foundation account emails. Configure
those names as the GitHub secrets listed in
[Deployment](../../docs/ops/deploy.md). No key is generated.

Add the operator token as a version of `mkc-cloudflare-api-token`, a separate
read-only token as `mkc-cloudflare-plan-token`, a stable-environment token
as `mkc-cloudflare-apply-token` and a foundation token as
`mkc-cloudflare-foundation-token`. Add the origin-router token as a version of
`mkc-cloudflare-worker-token`. The operator token needs DNS, certificate-pack
and Origin CA SSL and Certificates edit on the app and catalogue zones, plus
Zone Settings edit on the app/API zone when `manage_zone_settings` is true. The
plan token needs matching read permissions, including zone-settings read on the
app/API zone when Terraform manages the zone settings. The apply token needs
only DNS and SSL and Certificates edit on the app and catalogue zones; exclude
Origin CA, zone-settings and Workers permissions. The foundation token needs
only DNS and SSL and Certificates edit on the app/API zone, plus Zone Settings
edit when `manage_zone_settings` is true. Plan, apply and foundation can access
only their own token. The Worker token needs Workers Scripts and Workers Routes edit on only
the app/API zone; only the main-ref-bound deploy identity can access it. The
checked-in Deploy workflow receives no repository-scoped provider credential.
The deploy identity needs project-level `roles/container.developer` for the GKE
DNS endpoint and Kubernetes objects, and the custom role
`projects/mokly-508518/roles/mkcPreviewPlatformDeploy` for the preview
platform charts' RBAC and webhooks. It also needs
named resource bindings; grants are explicit in `foundation/permissions.tf`,
`foundation-roles.tf`, `environments.tf` and `preview.tf`. The project has only `mkc-autopilot`;
adding another cluster requires a new authorization boundary first. All
accounts are trusted workflow identities. An IAM administrator should
inspect their grants, the custom roles and the numeric repository/owner
conditions before enabling them.

CI applies foundation, including its network, federation trust, node identity
and zone settings. It never deletes, replaces or forgets a trust resource; an
operator applies those changes. Cache rules remain operator-owned. To adopt
SSL management, change the `manage_zone_settings` default in a reviewed change.
Before the import and the merge, give each token its zone settings permission
from the list above. Import the setting as
[Foundation imports](../../docs/ops/foundation.md#imports) times it.
The canonical site's apex/www DNS and legacy redirect hosts remain outside this
stack. Foundation manages only the Mokly Cloud zone resources declared above;
the legacy redirects are operator-managed in the Cloudflare dashboard.

A change to the shared preview bucket must plan as an in-place update to
`google_storage_bucket.preview_blobs`. Inspect its foundation plan for a
destroy or replacement before the merge, because the Foundation run of the
merge applies that plan.

## Shared Preview Foundation

Foundation implements the shared resources in the
[preview contract](../../docs/protocol/cloud/pr-preview-environments.md).
`preview.tf` owns regional external address `mkc-preview-ingress`,
bucket `mokly-508518-preview-blobs` (uniform access, public-access prevention,
no versioning or live-object age rule, seven-day soft deletion), A wildcards
`*.preview.D` and `*.preview.api.D`, and Secret Manager IDs
`mkc-preview-origin-tls-key`, `mkc-preview-origin-tls-cert`,
`mkc-catalogue-dns-token`. Outputs `preview_ingress_ip` / `preview_blobs_bucket`
supply the matching repository variables. Secret values never enter Terraform state.
The Foundation workflow applies these resources. An operator supplies the
secret versions before the platform and PR lifecycle scripts run; local
mock-provider checks do not provision resources.

Deploy gets `roles/secretmanager.secretAccessor` on those three IDs and the
dedicated `mkc-cloudflare-worker-token`, plus `roles/storage.admin` on that one
bucket. PR `api`/`catalogue` direct Kubernetes
principals receive conditional objectUser/objectViewer from the workflow,
with the exact `resource.name.startsWith(.../objects/pr-N/)` condition in the
parent contract. It does not authorize bucket listing by PR workloads. Neither
stable accounts/buckets nor the state bucket gain this deploy grant.

Each stable environment has `api`, `catalogue` and non-serving `reset` Google
accounts. Only reset receives the Cloud SQL `cloudsqlsuperuser` database role;
its connection roles are condition-scoped to that environment's instance, and
its Workload Identity binding names only Kubernetes service account `reset` in
the matching namespace. A three-permission custom role lets each reset account
list, delete and create databases. That role has no instance condition, because
IAM conditions do not apply to Cloud SQL database operations; deploy may
impersonate those two accounts but receives none of those permissions directly.
API and catalogue keep their least-privilege database roles. The automatic
stable environment applies expect both reset Google accounts and their grants to
exist. The Foundation run of a commit applies them before the Deploy run of that
commit plans an environment.

Main deploy owns `mkc-preview-system` and both Helm platform releases; Terraform
owns no chart resources. `roles/container.developer` cannot create
ClusterRoles, ClusterRoleBindings, Roles, RoleBindings or webhook
configurations, which the rendered platform charts create, so foundation
binds the custom role `mkcPreviewPlatformDeploy` to the deploy account only.
It grants exactly the missing create/update/delete permissions and RBAC
`escalate`/`bind`: Kubernetes rejects a (Cluster)Role or (Cluster)RoleBinding
that grants permissions its creator does not hold without them. Project IAM
cannot condition the grant on Kubernetes object names, so it is bounded to the
single cluster `mkc-autopilot` in this project and to the deploy identity,
assumable only by trusted `main` workflows. The
[preview platform contract](../../docs/protocol/cloud/preview-platform.md#authorization-and-readiness)
holds the authorization requirements. Per-PR namespaces, Postgres/PVC/Secrets,
the DNS-only catalogue record, Certificate and prefix objects never get a
Terraform state. Stable deletion protection stays unchanged.

## Reconcile Manually Created Resources

List and inspect resources using the real provider CLI/API, preserve stdout,
stderr and exit codes, and use canonical provider import IDs. The import
examples in [Secrets](../../docs/ops/secrets.md) cover secret IDs, accounts and
federation. Useful additional addresses:

| Resource                          | Terraform address                                                         | Import ID                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Shared Cloudflare edit-token ID   | `google_secret_manager_secret.cloudflare` in foundation                   | `projects/mokly-508518/secrets/mkc-cloudflare-api-token`                                           |
| CI Cloudflare apply-token ID      | `google_secret_manager_secret.cloudflare_apply` in foundation             | `projects/mokly-508518/secrets/mkc-cloudflare-apply-token`                                         |
| CI Cloudflare Worker-token ID     | `google_secret_manager_secret.cloudflare_worker` in foundation            | `projects/mokly-508518/secrets/mkc-cloudflare-worker-token`                                        |
| CI Cloudflare foundation-token ID | `google_secret_manager_secret.cloudflare_foundation` in foundation        | `projects/mokly-508518/secrets/mkc-cloudflare-foundation-token`                                    |
| Retired protected Origin CA ID    | `google_secret_manager_secret.origin_ca` in foundation                    | `projects/mokly-508518/secrets/mkc-cloudflare-origin-ca-token`                                     |
| Shared Cloudflare read-token ID   | `google_secret_manager_secret.cloudflare_plan` in foundation              | `projects/mokly-508518/secrets/mkc-cloudflare-plan-token`                                          |
| App/API edge certificate pack     | `cloudflare_certificate_pack.app_api` in foundation                       | `ZONE_ID/PACK_ID`                                                                                  |
| Preview app wildcard A            | `cloudflare_dns_record.preview_placeholder` in foundation                 | `ZONE_ID/RECORD_ID`                                                                                |
| Preview API wildcard A            | `cloudflare_dns_record.preview_api` in foundation                         | `ZONE_ID/RECORD_ID`                                                                                |
| Preview regional ingress IPv4     | `google_compute_address.preview_ingress` in foundation                    | `projects/mokly-508518/regions/REGION/addresses/mkc-preview-ingress`                               |
| Shared preview blob bucket        | `google_storage_bucket.preview_blobs` in foundation                       | `mokly-508518-preview-blobs`                                                                       |
| Shared preview secret IDs         | `google_secret_manager_secret.preview["SECRET_ID"]` in foundation         | `projects/mokly-508518/secrets/SECRET_ID`                                                          |
| Desktop release backup IDs        | `google_secret_manager_secret.desktop_release["SECRET_ID"]` in foundation | `projects/mokly-508518/secrets/SECRET_ID`                                                          |
| GitHub deploy account             | `module.github.google_service_account.github["deploy"]`                   | `projects/mokly-508518/serviceAccounts/mkc-github-deploy@mokly-508518.iam.gserviceaccount.com`     |
| GitHub Postmark sync account      | `module.github.google_service_account.github["postmark"]`                 | `projects/mokly-508518/serviceAccounts/mkc-github-postmark@mokly-508518.iam.gserviceaccount.com`   |
| GitHub apply account              | `module.github.google_service_account.github["apply"]`                    | `projects/mokly-508518/serviceAccounts/mkc-github-apply@mokly-508518.iam.gserviceaccount.com`      |
| GitHub foundation account         | `module.github.google_service_account.github["foundation"]`               | `projects/mokly-508518/serviceAccounts/mkc-github-foundation@mokly-508518.iam.gserviceaccount.com` |
| GitHub OIDC provider              | `module.github.google_iam_workload_identity_pool_provider.github`         | `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/mkc-github/providers/github`       |
| Environment blob bucket           | `module.storage["ENVIRONMENT"].google_storage_bucket.blobs` in foundation | `mokly-508518-ENVIRONMENT-blobs`                                                                   |
| SQL instance                      | `module.sql.google_sql_database_instance.this`                            | `projects/mokly-508518/instances/mkc-ENVIRONMENT`                                                  |
| Internal app-origin DNS record    | `module.dns.cloudflare_dns_record.this["app"]`                            | `ZONE_ID/RECORD_ID`                                                                                |

Import under the matching backend prefix and input values. For an object that
a pending change declares, follow the
[import rule](../../docs/ops/foundation.md#imports), which covers foundation
and both stable environment states. Import a foundation object
that `main` already declares before the next foundation apply, which today is the
[foundation bootstrap](../../docs/ops/foundation.md#foundation-bootstrap). Never
import secret versions/private keys. Read the actual plan after import; unexpected destroys,
replacements or duplicate creates mean reconciliation is unfinished. Provider
warnings are not identifiers. No mock here pretends to capture successful cloud
CLI output; credential-free recordings and their provenance live in
`infra/tests/fixtures/README.md`.

For shared preview IDs, substitute exactly `mkc-preview-origin-tls-key`,
`mkc-preview-origin-tls-cert` or `mkc-catalogue-dns-token` for `SECRET_ID`.

The retired Origin CA Key ID above is unused but exists in the applied
foundation state with `deletion_protection = true`; preserve that resource and
address. To retire it, first set protection to false and apply, then remove
the resource block and apply the intentional destroy; deleting the protected
block directly is not a valid one-pass retirement.

## Per-Environment State And Recovery

The trusted main deployment workflow plans each stable environment with the
read-only identity, publishes the binary and human-readable plan, and applies
that exact binary with the apply identity before workload rollout. Merge is the
approval; there is no environment-review gate. The script rejects CI apply from
any other workflow, event, ref or environment. Deletes, replacements and
forgotten resources additionally require the exact committed manifest defined
by [Infrastructure promotion](../../docs/protocol/cloud/infrastructure-promotion.md);
the apply path regenerates JSON from the binary plan and checks it again.
Operators may use the same wrapper for stable recovery. Environment state
prefixes are only `environments/production` and `environments/main-preview`;
there is no PR environment state or `destroy-plan` action. Foundation uses
prefix `foundation` and bootstrap uses prefix `bootstrap`. Keep state access restricted and audited; backend
locks require object writes even for a plan. Never `force-unlock` an active run.
A stranded lock requires checking the owning operation has ended.

PR cleanup belongs to the preview lifecycle scripts. They remove
the namespace/PVC, conditional bucket members, prefix objects and catalogue
DNS record; shared platform resources remain.
See [Preview](../../docs/ops/preview.md).
Do not run bare `destroy` against a shared or stable backend. SQL and stable secret IDs have provider
deletion protection; stable blob buckets reject deletion while nonempty.

## Development

```sh
bash infra/scripts/check-terraform.sh
```

This runs format, backend-free init, validate and `terraform test` for every
module/root. With the plan or operator identity,
`bash infra/scripts/terraform-foundation.sh check` plans foundation against the
real providers and exits 2 when the plan has changes. Mock providers exercise Terraform expressions and provider schemas;
they do not exercise cloud permissions, create resources or prove a deploy.
Dependency locks must be refreshed deliberately with `init -upgrade` and reviewed
when changing a provider pin. Provider test outputs are not CLI reconciliation
fixtures for existing cloud resources.

Locks include Linux amd64 and macOS amd64/arm64 hashes. Refresh deliberately:

```sh
terraform -chdir=infra/terraform/foundation providers lock \
  -platform=linux_amd64 -platform=darwin_arm64 -platform=darwin_amd64
```

Repeat for each root/module. Only DNS, environment (which composes DNS), and
foundation require Cloudflare; unrelated modules do not download that provider.
The naming module has no providers or provider lock. Foundation's policy test
uses a mocked apply to evaluate computed principals. It permits deploy
`roles/storage.admin` on exactly the shared preview bucket and rejects every
other deploy bucket grant; its inventory audits every bucket binding.

### Key Code

- `bootstrap/` — the state bucket root with its own backend prefix.
- `foundation/main.tf` — the Cloudflare token secret IDs (`google_secret_manager_secret.cloudflare`, `cloudflare_plan`, `cloudflare_apply`, `cloudflare_worker`), the retired `origin_ca` ID and the optional zone-setting adoption.
- `foundation/preview.tf` — the shared preview resources: `google_compute_address.preview_ingress`, `google_storage_bucket.preview_blobs`, the three `google_secret_manager_secret.preview["SECRET_ID"]` IDs, the wildcard records `cloudflare_dns_record.preview_placeholder` and `cloudflare_dns_record.preview_api`, and the `preview_ingress_ip` and `preview_blobs_bucket` outputs.
- `foundation/permissions.tf` — the CI identity grants and the custom roles `environment_apply`, `preview_platform_deploy` (`mkcPreviewPlatformDeploy`) and `stable_database_reset`.
- `foundation/foundation-roles.tf` — the custom roles `foundation_apply` (`mkcFoundationApply`) and `foundation_plan` (`mkcFoundationPlan`), their bindings, and the `cloudflare_foundation` token ID and its grant.
- `foundation/environments.tf` — the per-environment identity, storage and secrets module instances, the SQL and reset IAM members and the deploy secret-access bindings.
- `foundation/contracts.tftest.hcl` — the policy test that audits every bucket binding and the deploy grants.
- `foundation/foundation-roles.tftest.hcl` — the test that pins both foundation permission lists and the foundation identity's grants.
- `environment/` — the stable root: `main.tf` composes the naming, SQL and DNS modules and reserves the global ingress address, `armor.tf` holds the Cloud Armor policy and `alerts.tf` the dead-letter alerts.
- `modules/naming` — the provider-free account, namespace and bucket names; `modules/dns`, `modules/sql`, `modules/gke`, `modules/network`, `modules/identity`, `modules/storage`, `modules/secrets` and `modules/github` — one provider resource group each, with their mock-provider tests.

### Related Docs

- [Infrastructure promotion](../../docs/protocol/cloud/infrastructure-promotion.md)
- [Foundation promotion](../../docs/protocol/cloud/foundation-promotion.md) and [Foundation apply](../../docs/ops/foundation.md)
- [PR preview environments](../../docs/protocol/cloud/pr-preview-environments.md)
- [Preview platform](../../docs/protocol/cloud/preview-platform.md)
- [Deployment smoke checks](../../docs/protocol/cloud/deployment-smoke-checks.md)
- [Environments](../../docs/ops/environment.md), [Deployment](../../docs/ops/deploy.md), [Secrets](../../docs/ops/secrets.md) and [Production](../../docs/ops/production.md)
- [Architecture](../../docs/architecture/cloud.md)
