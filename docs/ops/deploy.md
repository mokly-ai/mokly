# Deployment

This runbook is the operator path for the first `main-preview` deployment and
normal releases. On 2026-09-18 the operator applied the foundation and
`main-preview` infrastructure (both plans report zero changes) and completed the
first-install SQL bootstrap through temporary GKE Jobs without creating product
data. On 2026-09-19 the operator rolled out `main-preview` from revision
`23cb8d28fc08791a503087a143a66ee828960926`: Helm release `mokly-cloud` revision
1 is `deployed` and the smoke contract passed on its first attempt at 11:52:53
UTC once the load balancer was serving. Four findings from that first install
are recorded under [First Main-Preview Rollout](#first-main-preview-rollout)
and codified by
[Milestone F3](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-cloud-follow-ups.md#milestone-f3-first-rollout-findings)
in the archived follow-ups plan. On 2026-09-20 the operator rolled out
[Milestone F4](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-cloud-follow-ups.md#milestone-f4-provider-scoped-auth-callbacks)
as Helm revision 2 and completed the publish proof with the published CLI; see
[Publish Proof](#publish-proof). The catalogue fetch, header and idempotency
checks that section lists are recorded as
[post-merge follow-up](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-cloud-initial-scope.md#post-merge-follow-up-non-blocking)
in the archived initial scope plan. Local validation is not a
deployment. Production provisioning and release evidence are in
[Production](./production.md).
The unified-domain layout changed the app and preview API hosts; those dated rollout and
publish proofs have not been repeated for the new names.

## Promotion and infrastructure ownership

CI builds API and catalogue once and the app separately for each environment's
baked origins. It pushes all three immutable digests, deploys the shared origin Worker,
runs the required `preview-platform` job, publishes a real main-preview
Terraform plan plus rendered Helm inputs, applies that exact saved plan, and
deploys/smokes main-preview. Deployment does not run the optional Stripe
catalogue `archive` command; an operator may invoke it under the
[manual clean-up contract](../protocol/cloud/billing-catalogue.md#archive).

Production promotion is opt-in: leave repository variable
`MKC_PRODUCTION_ENABLED` unset or `false` while only main-preview is provisioned.
The required check then requires origin-router, preview-platform and
main-preview rollout/smoke success and
reports production as disabled. Other values besides `true` and `false` fail
before builds or deployment start. Image builds and publication still prepare
both app variants.

The required check has no archive-job dependency or archive result.

Set `MKC_PRODUCTION_ENABLED=true` only after the Foundation workflow has
applied the foundation prerequisites. The operator must also provision
production secrets and TLS and add the reserved IPv4 address under
`production` in `MKC_INGRESS_IPS`. Configure
`MKC_PRODUCTION_APP_CONFIG` when enabling its GitHub App. Missing production
configuration is a deployment failure once promotion is enabled.

With promotion enabled, only main-preview success unlocks the production plan
job. Each stable environment publishes its human-readable and binary plan,
then a separate apply job consumes that exact artifact before workload rollout.
Terraform never replans during apply. A protected `main` push or a manual
Deploy dispatch from `main` authorizes both stable-environment applies and
their releases; there is no second environment-review gate.

Use the manual reset only when a breaking database change or a
[Mokly release cutover](./mokly-release-cutover.md) requires every stable
environment to start empty:

Foundation gives both stable namespaces their dedicated reset
Google/Kubernetes identity, its database-reset role and
deploy-to-reset impersonation grant. The normal
environment plans then create the IAM database users and assign
`cloudsqlsuperuser` only to reset.

```sh
gh workflow run deploy.yml --ref main -f reset=true
```

The checkbox defaults to `false`. With reset enabled, the release stops the
serving and maintenance workloads, impersonates the environment's reset
identity to recreate `mokly` through the Cloud SQL Admin API, applies database
grants and migrations, then starts the workloads and runs the normal smoke
suite. It resets `main-preview` (the `br-main` host) first and production only
when `MKC_PRODUCTION_ENABLED=true`. Cloud SQL instances, backups, blob objects,
Stripe provider resources, Secrets, Terraform resources and Helm history
remain. The recreated database holds no account, workspace, project, token or
publication. Objects from the erased database are unreachable orphans: daily
publication maintenance deletes those older than 24 hours, and then the
bucket's noncurrent-version and soft-delete windows apply. Dispatches from any
ref other than `main` fail before build and credentialed work.

The Foundation workflow plans and applies foundation, including IAM,
federation and the CI identities, on every `main` push and accepted dispatch.
Each Deploy run waits for the Foundation run of its own commit before its first
credentialed job; see [Foundation apply](./foundation.md). The preview workflow
creates/deletes PR namespaces,
catalogue DNS records, object prefixes and their conditional bucket grants;
there is no per-PR Terraform state.

On a labelled PR, the unprivileged `build` and `capture` jobs run in parallel:
the first produces the three workload image archives and the second produces
the captured catalogue. The trusted `release` job deploys and smokes after a
successful build even when capture failed. After deploy evidence it runs the
seed as a Job of the PR's API image, publishes the final PR comment and
retains available smoke, seed status and seed proof in the 14-day
`preview-evidence-pr-N` artifact. For a deploy, **Preview required** requires
prepare, build, capture and release; cloud configuration; deployment smoke and
its report; the seed step and validated seed evidence; and the final comment.
Cleanup requires deletion and the final comment while build and capture stay
skipped. See [Previews](./preview.md).

Stable environment SQL, DNS, IP, Cloud Armor, catalogue edge
certificate and alert-policy changes are applied by CI through a dedicated
identity with no IAM or foundation-stack permissions. The workflow invokes only
the environment root. The plan identity is read-only, and the workload deploy
identity has no Terraform state access.
Log-based alert policies require `logging.notificationRules.create`,
`logging.notificationRules.delete`, `logging.notificationRules.get`,
`logging.notificationRules.list` and `logging.notificationRules.update` in the
apply role, in addition to its Monitoring permissions.

### Log-based alert permission repair

From 2026-09-28 until the bootstrap on 2026-10-23, main deploys failed in
**Apply main-preview infrastructure** with 403
`logging.notificationRules.create` denied while creating an alert policy.
The apply role lacked the Logging permissions above. Google creates a
notification rule for each log-based alert policy; see
[Configure log-based alerting policies](https://docs.cloud.google.com/logging/docs/alerting/log-based-alerts)
and [Logging access control](https://docs.cloud.google.com/logging/docs/access-control).

The one-time [foundation bootstrap](./foundation.md#foundation-bootstrap)
applies this repair together with the foundation identity. Confirm that the
`mkcEnvironmentApply` role then includes the five Logging permissions. After
the bootstrap, a permission change to a CI role applies on merge: the
Foundation run of the commit updates the role before the Deploy run of that
commit plans main-preview. When a job of the newest commit on `main` then fails
with a permission denial, wait a few minutes and use **Re-run all jobs**;
[IAM changes propagate with a delay](./foundation.md#permission-denials-after-an-iam-change).

Then dispatch the stable Deploy workflow from `main`. The first workload
release after this repair includes `202609271200_project_owned_blobs` and must
use the existing reset command, `gh workflow run deploy.yml --ref main -f reset=true`.
The [migration and rollout rules](#images-migration-and-rollout) require an empty
publication store: both migration directions reject rows in `blobs` or
`publication_files`. The reset recreates `mokly` in main-preview first and in
production only when `MKC_PRODUCTION_ENABLED=true`. It deletes database rows;
emptying the object bucket or prefix remains optional. For older labelled PR
previews, remove the `preview` label, wait for cleanup, then add it again, as
the same rollout rules require. After rollout, republish with the workspace
CLI under [Mokly Release Cutover](#mokly-release-cutover).

Record: on 2026-10-23, the bootstrap applied this repair, and Foundation run
39950457088 planned no changes. Deploy run 39950457205 of the same commit then
applied main-preview infrastructure, and its main-preview migration refused the
existing publication rows. On 2026-10-26, reset release 40253545142 recreated
both stable databases, migrated them from empty and passed smoke in
main-preview and production.

## Prerequisites

1. Install the pinned tools from [Repository layout](../protocol/cloud/repository-layout.md).
   `bash infra/scripts/install-tools.sh` installs Terraform and Helm on Linux
   amd64 with checksum verification. CI uses the same script.
   Operator commands also need Bash, Python 3, OpenSSL, Google Cloud SDK with
   `gke-gcloud-auth-plugin`, `kubectl` and the system `libpsl` runtime; image
   builds need BuildKit and crane from `infra/scripts/install-build-tools.sh`
   and `start-buildkit.sh`.
2. Complete [State bootstrap](../../infra/terraform/README.md), importing
   manually created resources before any apply. Set the real domain, zone ID
   and region in the deployment record.
3. Complete the one-time
   [foundation bootstrap](./foundation.md#foundation-bootstrap) as an operator
   and protect `main`; merging is the foundation, stable infrastructure and
   release approval. Configure the protected `preview`
   environment for PR workloads. Repository secrets
   `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_PLAN_SERVICE_ACCOUNT`,
   `GCP_APPLY_SERVICE_ACCOUNT`, `GCP_DEPLOY_SERVICE_ACCOUNT`,
   `GCP_POSTMARK_SYNC_SERVICE_ACCOUNT` and `GCP_FOUNDATION_SERVICE_ACCOUNT`
   are resource names, not credentials. Foundation creates the apply and
   foundation accounts, their custom roles, the `mkc-cloudflare-apply-token`,
   `mkc-cloudflare-foundation-token` and `mkc-cloudflare-worker-token` secret
   IDs, and the exact identity grants.
   Add a Cloudflare token version with DNS and SSL and Certificates edit access
   restricted to the app and catalogue zones to `mkc-cloudflare-apply-token`.
   Add a token version with DNS and SSL and Certificates edit access restricted
   to the app/API zone to `mkc-cloudflare-foundation-token`. Add the Worker token as a version
   of `mkc-cloudflare-worker-token` with Account → Workers Scripts → Edit and
   Zone → Workers Routes → Edit, restricted to the app/API zone. Do not store
   the Worker token as a repository secret. [Secrets](./secrets.md#worker-token-cutover)
   gives the reason and records the retired `CLOUDFLARE_WORKER_API_TOKEN`.
4. Set repository variables `MKC_REGION`, `MKC_DOMAIN`,
   `MKC_CLOUDFLARE_ZONE_ID`, `MKC_CATALOGUE_BASE_DOMAIN`,
   `MKC_CATALOGUE_CLOUDFLARE_ZONE_ID`, `MKC_STATE_BUCKET`, `MKC_POSTMARK_FROM`,
   `CLOUDFLARE_ACCOUNT_ID`,
   `MKC_INGRESS_IPS` (JSON environment-to-reserved-IPv4 map for every enabled
   stable deployment environment; no `preview-pr-N` entries),
   `MKC_PREVIEW_INGRESS_IP` (foundation output `preview_ingress_ip`) and
   `MKC_PREVIEW_BLOBS_BUCKET` (output `preview_blobs_bucket`, exactly
   `mokly-508518-preview-blobs`), optional `MKC_PRODUCTION_ENABLED` (unset or `false`
   until production provisioning is complete), and
   `MKC_NOTIFICATION_CHANNELS` (JSON array of existing Cloud Monitoring channel
   resource names). The catalogue domain must have a different
   registrable domain from app/API, including private Public Suffix List entries.
5. Optional `MKC_APP_CONFIG` / `MKC_CATALOGUE_CONFIG` JSON accepts `env`,
   `port` (default 8080) and `healthPath` (only `/_health`). Origins and storage
   derive from the environment; `env` can assert those exact values only.
   App config may also carry `github`, either `{ "enabled": false }` or a
   complete object with `enabled: true`, `appId`, `clientId` and `appSlug`.
   It may carry `billing` beside it as exactly `{ "enabled": <boolean> }`.
   PR environment rendering rejects enabled billing.
   It may carry `builds` beside them. Follow [Build template](./build-template.md)
   to publish and verify the template, provision the API-only key, and set the
   complete nonsecret group before enablement. Builds require the GitHub
   group and at least two API replicas. PR rendering rejects enabled builds.
   Stable plan jobs use the prefixed `MKC_MAIN_PREVIEW_*_CONFIG` and
   `MKC_PRODUCTION_*_CONFIG` variables. Empty config uses the implemented defaults.
   **The app bundle's build arguments are authoritative for browser origins.**
   Runtime JSON cannot rewrite the bundle: startup rejects origin/revision
   mismatches. Rebuild the app to change origins. Published `values.json` remains
   authoritative for the chart; secrets use CSI, never these JSON variables.
   Put the provisioned main-preview App identity and billing switch in the
   repository variable `MKC_MAIN_PREVIEW_APP_CONFIG`:

   ```json
   {
     "github": {
       "enabled": true,
       "appId": "4991055",
       "clientId": "Iv23linJhLOHvj1KB0jc",
       "appSlug": "mokly-main-preview"
     },
     "billing": {
       "enabled": true
     }
   }
   ```

   Use `MKC_PRODUCTION_APP_CONFIG` for production. PRs require
   `github.enabled: false` and use sign-in links from the log mailer. These values are release
   inputs, not chart defaults; the renderer places the validated object in the
   published `values.json`.

6. Complete [Secret provisioning](./secrets.md), both services' SQL grants,
   both zones' strict TLS/cache rules and applicable certificate activation.
   The foundation state creates one 90-day Let's Encrypt Advanced Certificate
   Manager pack containing the app/API apex, `*.preview.<domain>` and
   `*.preview.api.<domain>`, with TXT validation. Wait for it to become active;
   main-preview's catalogue pack remains separate and unchanged. PR catalogue
   certificates are issued by cert-manager using the catalogue-only DNS token.
   Turn Cloudflare's Browser Integrity Check off in both zones (or exempt the
   API and catalogue hosts): it answers 403 to non-browser clients such as the
   smoke runner, the publish CLI and webhook callers. Cloudflare Pages
   separately rejects the default Python `urllib` signature with error 1010
   whatever the zone settings say, so the smoke client identifies itself as
   `mkc-smoke`.
   Provision a
   unique shared API/catalogue signing key for each stable environment; PR
   deployment generates its own namespace signing Secret. To enable the
   GitHub App, add versions for that environment's client-secret, private-key
   and webhook-secret IDs, then set its complete nonsecret GitHub app config above.
   `{ "enabled": false }` renders none of the six runtime settings. A partial
   enabled configuration fails release rendering or API startup. Run the
   separate [GitHub smoke](./github-app-smoke.md) after rollout. GitHub App
   registration must set the callback URL to
   `<app-origin>/auth/github/callback` and the setup URL to
   `<app-origin>/auth/github/install`, and it must enable Redirect on update.
   Without that setting, Configure on GitHub never returns to the setup URL,
   so a workspace cannot link an account where the App is already installed.
   GitHub App credentials and the
   credentialed viewer/publication proof require operator inputs; the smoke and
   publish proof below remain separate integration checks.
   To enable billing in a stable environment, add versions to its
   `stripe-secret-key` and `stripe-webhook-secret` IDs and set the `billing`
   app-config object from prerequisite 5 to `{ "enabled": true }`. The API
   resolves the catalogue by lookup key.
   Add a version to `stripe-catalogue-key`; stable promotion uses it to create
   or reconcile the product and prices before rollout.
   Follow [Billing smoke](./billing-smoke.md) for mode selection, price and
   webhook setup, rollout checks and delivery recovery.

   Register each stable environment with these exact public URLs and with
   Redirect on update enabled, then re-point every existing App registration
   before the first rollout carrying this layout:

   | Environment  | User callback                                    | Setup URL                                       | Webhook URL                                        |
   | ------------ | ------------------------------------------------ | ----------------------------------------------- | -------------------------------------------------- |
   | production   | `https://D/auth/github/callback`                 | `https://D/auth/github/install`                 | `https://api.D/v1/github/webhooks`                 |
   | main-preview | `https://br-main.preview.D/auth/github/callback` | `https://br-main.preview.D/auth/github/install` | `https://br-main.preview.api.D/v1/github/webhooks` |

## Origin Router

Every push to `main` and every accepted manual Deploy dispatch runs the shared
origin-router job before the main-preview plan and rollout, but only after the
workload build succeeds. It checks the deploy identity and repository variables
`CLOUDFLARE_ACCOUNT_ID`, `MKC_DOMAIN` and `MKC_CLOUDFLARE_ZONE_ID`, then
exchanges the main-ref-bound OIDC token and reads
`mkc-cloudflare-worker-token`. A wholly unconfigured cloud identity produces an
explicit skip. Partial identity/settings or a missing token version fails the
job. Once image publication is enabled, the Worker is a hard prerequisite:
missing configuration blocks the main-preview plan and the required aggregate
fails. The provider token exists only in the Worker deployment process; no
Terraform, build, Helm, workload or PR-preview job receives it.

The renderer writes zone-ID routes, so the Worker token does not need permission
to look up a zone by name. The pinned Wrangler deploys the script and its
`D/*` and `*.preview.D/*` routes idempotently. The Worker stores no
secret and Wrangler is the only owner of its script and routes. To undo a bad
Worker deployment, render `wrangler.json` with the same domain and zone ID and
run `npm exec --workspace @mokly-cloud/worker -- wrangler rollback`
with the Worker credentials.

Foundation Terraform owns the supporting proxied A wildcards `*.preview.D`
and `*.preview.api.D` on the shared regional preview address and the shared
Advanced Certificate Manager pack. The pack already ordered in the
Cloudflare dashboard must be imported before the first foundation apply at
`cloudflare_certificate_pack.app_api` using import ID `ZONE_ID/PACK_ID`; import
the existing wildcard at `cloudflare_dns_record.preview_placeholder` using
`ZONE_ID/RECORD_ID`. Terraform never declares a Worker script or route.

## Preview Platform

Foundation reserves regional address
`mkc-preview-ingress`, creates `mokly-508518-preview-blobs` and the three IDs
`mkc-preview-origin-tls-key`, `mkc-preview-origin-tls-cert`,
`mkc-catalogue-dns-token`, then grants the deploy identity access as documented
in [Secrets](./secrets.md). Set `MKC_PREVIEW_INGRESS_IP` and
`MKC_PREVIEW_BLOBS_BUCKET` from its outputs. Import a pre-created address,
bucket or secret ID at its foundation address, listed in the
[Terraform README](../../infra/terraform/README.md#reconcile-manually-created-resources),
before the first apply. The old wildcard Terraform address
is retained while its AAAA placeholder becomes the proxied A record.

The foundation plan that removes the preview bucket's live-object age rule
must show `google_storage_bucket.preview_blobs` as an in-place update with no
destroy or replacement. Until a foundation apply completes, the provider's old
age rule remains active.

Before the first platform run, issue one matching Origin CA key/certificate
with exactly `*.preview.D` and `*.preview.api.D` SANs into those shared TLS
IDs. Create a separate token with Zone DNS Edit and Zone Read on only catalogue
zone `C`, stored in `mkc-catalogue-dns-token`. The app-zone token never enters
the cluster. [Secret rotation](./secrets.md#preview-secrets) defines refresh.

The `preview-platform` job uses the deploy identity after `origin-router` and
before `plan-main-preview`. It runs these idempotent commands:

```sh
bash infra/scripts/preview-platform.sh
bash infra/scripts/preview-platform-ready.sh
```

It installs both pinned charts in `mkc-preview-system`, copies shared Secrets,
applies `ClusterIssuer/mkc-preview-letsencrypt`, waits for its readiness and
requires the controller Service's address to equal `MKC_PREVIEW_INGRESS_IP`.
[Checked-in platform values](../../infra/helm/platform/) hold every static
chart setting and the issuer template; only the reserved address and the
Cloudflare CIDRs read from the workload chart are per-run Helm overrides.
[Platform inputs and values](../protocol/cloud/preview-platform.md) are exact.
The main deploy `required` aggregate requires this job whenever cloud deployment
is configured, even when production is disabled. Missing variables or secret
versions fail the gate; only wholly unconfigured cloud deployment may skip.
The publish credential gate treats a lone identity setting or any incomplete
identity/address/bucket tuple as a failure, so a partial configuration cannot
be mistaken for that skip.
PR workflows use only the readiness command and direct operators to this job
when it fails. They never install shared components or mutate Terraform.

The installer renders both pinned charts first, prints their complete
cluster-scoped inventory, and checks each object's lifecycle verbs with
`kubectl auth can-i` before it reads shared secret values or runs Helm. A denied
operation names the object and stops. The existing `roles/container.developer`
still needs a credentialed real-cluster result; a denial requires the smallest
recorded foundation grant, not a guessed permission or broad admin role. The
workflow-file/federation trust remains on `main`.

## Public Site

The public site is a direct-upload Cloudflare Pages deployment, independent of
Terraform, Helm and the API promotion chain. After `npm ci`, an
authenticated operator creates or adopts its one project:

```sh
npm exec --workspace @mokly-cloud/site -- \
  wrangler pages project create mokly-site --production-branch main
```

Run that command authenticated to the existing Cloudflare account with Pages
edit access. Configure the repository variables `MKC_DOMAIN`,
`CLOUDFLARE_ACCOUNT_ID`, plus the GitHub Actions secret
`CLOUDFLARE_PAGES_API_TOKEN` (or the existing
`CLOUDFLARE_API_TOKEN`). The derived origins must have no path, query,
fragment or credentials; a trailing site-origin slash is allowed. In the Pages
dashboard, attach the apex from `MKC_DOMAIN` under `mokly-site` → Custom
domains and complete the prompted DNS setup after the go-live content
alignment pass. Keep `Required CI` as the required branch status; the
Lighthouse job is not part of it. Cloudflare's
[direct-upload CI guide](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)
and [custom domain guide](https://developers.cloudflare.com/pages/configuration/custom-domains/)
describe the dashboard steps.

The legacy `getmokly.com` zone redirect is a Cloudflare zone redirect rule
managed in the dashboard, outside Terraform. To verify it, request
`/docs?from=legacy` through both hosts without following redirects and expect
status `301` with `Location: https://mokly.ai/docs?from=legacy`:

```sh
curl -sI 'https://getmokly.com/docs?from=legacy'
curl -sI 'https://www.getmokly.com/docs?from=legacy'
```

Every push to `main` builds the site and derives its origin as
`https://<MKC_DOMAIN>`. The site renders its app links as relative `/…` paths.
The workflow deploys `apps/site/dist` to the Pages production branch.
The workflow validates configuration before building and
never falls back to a registry-installed Wrangler. Cloudflare Pages applies
the deployed `_headers` file and its same-origin script CSP. The wildcard
CORS response lets any origin, a sandboxed frame with an opaque origin
included, read the public static files. The first
production run and custom-domain
smoke are post-merge operator actions; retain their workflow URL and tested
origin as deployment evidence. See
[Site delivery](../protocol/cloud/site-delivery.md) for the complete contract.

## Stable Environment Apply

Before the first automated apply, complete the
[foundation bootstrap](./foundation.md#foundation-bootstrap), which adds the
`mkc-cloudflare-foundation-token` version and configures
`GCP_FOUNDATION_SERVICE_ACCOUNT` for the `mkc-github-foundation` identity.
Import every manually created environment resource into its matching state,
add the apply-token version, and configure `GCP_APPLY_SERVICE_ACCOUNT`. A protected-main push or
manual Deploy dispatch from `main` then runs these stages for `main-preview`,
followed by production when enabled:

```sh
gcloud secrets versions add mkc-cloudflare-apply-token \
  --project=mokly-508518 --data-file=/secure/cloudflare-apply-token
apply_account=$(terraform -chdir=infra/terraform/foundation \
  output -json github_service_accounts | python3 -c \
  'import json,sys; print(json.load(sys.stdin)["apply"])')
gh secret set GCP_APPLY_SERVICE_ACCOUNT --body "$apply_account"
```

The secure file contains the separately scoped Cloudflare token, not the
operator token. Do not print either token or pass it on the command line.

Foundation also creates `mkc-github-postmark` with access only to the two
stable Postmark token IDs. The Postmark sync jobs fail until its service account
email is a repository secret. After the Foundation run of the merged change
creates the identity, set that secret:

```sh
postmark_account=$(terraform -chdir=infra/terraform/foundation \
  output -json github_service_accounts | python3 -c \
  'import json,sys; print(json.load(sys.stdin)["postmark"])')
gh secret set GCP_POSTMARK_SYNC_SERVICE_ACCOUNT --body "$postmark_account"
```

Each stable promotion checks generated email files against the reviewed
mockups, then queries that environment's Postmark server. It creates missing
templates, updates changed ones, and leaves equal ones untouched before the
API rollout. A Postmark failure blocks that rollout. The sync runs on every
eligible `main` push, so a manual Postmark edit is repaired on the next
promotion. [Postmark template synchronization](../protocol/cloud/email-postmark-sync.md)
defines the comparison and aliases.

1. **Wait for foundation** passes only after the Foundation run of the same
   commit succeeded; [Wait failures](./foundation.md#wait-failures) lists its
   messages and the action for each.
2. The read-only plan identity saves `release.tfplan`, `plan.txt`, `plan.json`
   and the exact Helm values as one workflow artifact.
3. The apply identity downloads that artifact and applies `release.tfplan`
   without replanning.
4. The deploy identity reconciles the Stripe catalogue when the artifact's
   `billing.enabled` is true; the key read fails closed.
5. The deploy identity rolls out those exact values and requires public smoke
   success.

The promotion sequence ends after rollout and smoke; it has no automatic
catalogue archive step.

The workflow-level concurrency group serializes stable promotions and the GCS
backend lock protects each state. The required aggregate rejects a failed
foundation wait, and a missing, failed, cancelled or skipped apply whenever
cloud deployment is configured. When a credentialed job of the newest commit on
`main` fails with a permission denial directly after a Foundation run that
changed IAM, wait a few minutes and use **Re-run all jobs**, so that each
environment gets a new plan. A re-run keeps its commit, so never re-run the run
of an older commit.
SQL deletion protection remains enabled for both stable environments.

Plans containing a delete, replacement or `forget` action require an exact
approval document committed with the merge. Generate it from the real plan:

```sh
mkdir -p infra/terraform/environment/destructive-approvals
python3 infra/scripts/terraform-plan-policy.py approval \
  "$ENVIRONMENT" ".context/plans/$ENVIRONMENT/plan.json" \
  --reason "Explain the intended destructive result." \
  > "infra/terraform/environment/destructive-approvals/$ENVIRONMENT.json"
```

Never hand-copy addresses from terminal output. Review `plan.txt`, `plan.json`,
the generated approval and the configuration change together, then commit the
file with the Terraform change. It binds the environment,
exact addresses/action order and a digest of all applicable Terraform sources.
Missing, extra, changed, uncommitted or stale approvals fail before apply. Remove
the approval in the next merge after it is consumed. The complete contract is
[Infrastructure promotion](../protocol/cloud/infrastructure-promotion.md).

When an approval check fails a run, merge the correction or the exact approval
to `main`. The runs of that new commit apply the fix. Do not re-run the failed
run. A re-run keeps its old commit and plans the old configuration again.

An operator can use the same wrapper for recovery outside GitHub Actions:

```sh
bash infra/scripts/terraform-environment.sh "$ENVIRONMENT" plan
# Inspect .context/plans/$ENVIRONMENT/plan.txt.
bash infra/scripts/terraform-environment.sh "$ENVIRONMENT" apply
```

The wrapper consumes the saved plan and never silently generates another. In
GitHub Actions it accepts `apply` only for `main-preview` or `production` from
the trusted `deploy.yml` push or manual dispatch on `refs/heads/main`; CI cannot
create a destroy plan. A bad plan must be corrected through code or state
import, not edited in the artifact.

## Images, Migration And Rollout

The release containing `202609271200_project_owned_blobs` requires an
environment reset. Dispatch `deploy.yml` from `main` with `reset=true`; the
workflow recreates each enabled stable database before rollout so the
publication store is empty when migrations run. The migration and its rollback
both refuse to continue when either `blobs` or `publication_files` contains a
row, reporting that the environment must be reset.

Emptying the environment's object bucket or prefix is optional. Objects left
behind after the database is recreated are unreachable orphans; no new
database row refers to them. In a stable environment, daily publication
maintenance deletes them once they are older than 24 hours.

Labelled PR previews need the same reset: the
[preview seed](../protocol/cloud/preview-seed.md) Job publishes a sample catalogue
into every preview, so a namespace created before this release stops at the
same migration on its next deploy. Remove the PR's `preview` label, wait for
its cleanup to finish, then add the label again; the new namespace starts with
an empty database. Previews created after this release are unaffected.

The Rust images use the repository Rust pin and Debian slim, with UID/GID
65532 and SIGINT shutdown. API defaults to `serve`; `migrate`, `prune`,
`prune-github`, `maintain-publications`, `publication-check-status` and
recovery use the same image. Catalogue exposes
only `serve`, which also checks/applies migrations. App uses pinned Node and
serves the Expo single-page build, synced Folio styles and hashed assets.
Unknown extensionless routes fall back to `index.html`; missing assets are 404.
App and catalogue health is `/_health`; API readiness is `/v1/health`.

Standalone BuildKit needs no Docker daemon. CI builds without cloud credentials,
then a separate federated job pushes the archives. For an operator release:

```sh
export MKC_REVISION="$(git rev-parse HEAD)"
bash infra/scripts/build-release.sh "$ENVIRONMENT"
bash infra/scripts/push-images.sh "$ENVIRONMENT"
export MKC_API_IMAGE="$(cat .context/api-image-ref.txt)"
export MKC_CATALOGUE_IMAGE="$(cat .context/catalogue-image-ref.txt)"
export MKC_APP_IMAGE="$(cat ".context/app-$ENVIRONMENT-image-ref.txt")"
export MKC_INGRESS_IP="$(terraform -chdir=infra/terraform/environment output -json deployment | python3 -c 'import json,sys; print(json.load(sys.stdin)["ingress_address"])')"
python3 infra/scripts/render-values.py "$ENVIRONMENT" > .context/release-values.json
export MKC_RELEASE_VALUES=.context/release-values.json
# Review the three digests, origins, revision and proxy trust before rollout.
bash infra/scripts/rollout.sh "$ENVIRONMENT"
```

The recorded 2026-09-18 preflight used exact revision
`81c9bbc374597057840e3fea9512480eb5347147` and these uploaded images:

- `us-central1-docker.pkg.dev/mokly-508518/mokly/mkc-api@sha256:700f4eecd88560662f94c4fdbd10e495eaab10df2a84a4885175f7d6bd8b8f3a`
- `us-central1-docker.pkg.dev/mokly-508518/mokly/mkc-catalogue-server@sha256:acfd760fb8f508235f19af2ae4e0fb4a07bca45ab912429d792032b36e15058a`
- `us-central1-docker.pkg.dev/mokly-508518/mokly/app@sha256:ee01022b5ab01a455249576dcf333d5bb32c89dbf0abe10947856e87e6240d8d`

The app manifest was independently verified as `linux/amd64`. With the real
GitHub App identifiers and reserved ingress address `8.232.187.218`, pinned Helm
4.3.0 strict lint passed. The reviewed values file has SHA-256
`703de1eb771e95ea585a56fe6915a7583d96f174b14dc1a3a66f0183ddf0a241`; the
rendered manifests have SHA-256
`54cf634b31be78ec298bec5f4018a2390373fbdfd4ac3c4d5eddd4097a70b5ed`.
The render contained 25 resources: three Deployments, Services, PDBs and HPAs;
two CronJobs; one Ingress; three BackendConfigs; one NetworkPolicy; three
ServiceAccounts; one migration Job; and two SecretProviderClasses. Every
resource passed GKE server dry-run admission. A separate follow-up read found
zero persisted workload, network or CSI resources. This is a render/admission
proof only; it neither installs the release nor clears the cache-rule gate.

The renderer requires built Artifact Registry digests for all three workloads. The wrapper creates the namespace and loads `origin-tls`.
Helm creates the ServiceAccounts, SecretProviderClass and NetworkPolicy as
pre-install/pre-upgrade hooks at weight -5, retained until the next hook execution.
The policy restricts migration egress even on the first install. The migration
Job runs at weight 0, with a deadline and zero retries. Direct
`helm upgrade --install` also orders prerequisites correctly when the namespace
and TLS secret exist. All three ServiceAccounts disable Kubernetes token
automount; workloads use Workload Identity/CSI and do not call the Kubernetes API.
These stable hook resources survive `helm uninstall`; a stable uninstall
requires operator cleanup of them. PR namespace mode has no migration/CSI
hooks; its [separate lifecycle](./preview.md) deletes the namespace.
No chart resources need kubectl adoption metadata.
The migration proxy is a native sidecar; Job labels are outside
workload Service/PDB selectors. Upgrade waits for readiness and rolls back on
Helm failure.

Stable GKE ingress still requires `kubernetes.io/ingress.class: gce`: with only
`spec.ingressClassName`, its controller takes no action.
This deliberate review exception follows [GKE's current controller contract](https://docs.cloud.google.com/kubernetes-engine/docs/concepts/ingress#controller_summary).
The IP endpoint is disabled; no master IPv4 CIDR is configured. Verify those
control-plane settings at the first credentialed plan/apply. At the first
credentialed rollout, verify the deploy identity reaches the DNS endpoint and
can read the target namespace with its unconditional
`roles/container.developer` binding. A cluster-name condition lets
`get-credentials` succeed but makes the DNS front end or Kubernetes object
authorizer return 403. The project contains only `mkc-autopilot`; establish
cluster-local RBAC or a dedicated project before creating a second cluster.
Also verify deploy works without
`roles/serviceusage.serviceUsageConsumer`; if a quota-project or SERVICE_DISABLED
error occurs, inspect API enablement and quota-project permissions before
requesting any additional grant. Neither behavior is verified without credentials.

Each BackendConfig attaches the environment's Cloud Armor policy.
`/v1/health` is throttled to 300 requests per source IP per minute (429 above
the limit). For proxied hosts, the IP key sees shared Cloudflare edge IPs,
not individual clients. It bounds traffic per attacker IP only for direct-to-LB
requests; it provides no per-client limit through Cloudflare and does not trust
a client-supplied forwarded header. Reassess using real traffic and add a
Cloudflare health rate-limit rule if per-client edge throttling is needed.
Kubelet and GCLB health probes reach the backend without this public policy.

Post-rollout HTTP smoke is mandatory. A first install allows up to 15 minutes
for the new GCE load balancer; later releases use a 60-second retry budget.
That budget is shorter than GCE's one-to-three-minute URL-map and certificate
propagation, so before a release that changes an environment's ingress
hostnames or origin certificate, stage the new hostnames on the live ingress
and the new certificate in its `origin-tls` Secret, wait for the ingress sync
events, and drop the `kubectl-patch` entry from the ingress managed fields so
Helm's server-side apply does not conflict. The 2026-09-24 unified-domain
rollouts of main-preview and production needed exactly this.
Stable CI rollout jobs allow 40 minutes for tool setup, Helm and smoke. A
failure fails the workflow and rolls back to the preceding Helm revision when
one exists. Database migrations are never rolled back automatically; use
backward-compatible forward migrations for live upgrades. A reset that fails
after database recreation leaves serving and maintenance workloads stopped;
correct the failure and dispatch the same reset again, or explicitly restore a
Cloud SQL backup. Helm cannot recover the deleted rows. First-install failure
leaves diagnostic resources and needs an operator to repair or uninstall. Logs
and report files contain no tokens. See
[Smoke contract](../protocol/cloud/deployment-smoke-checks.md).

## First Main-Preview Rollout

The 2026-09-19 rollout used revision
`23cb8d28fc08791a503087a143a66ee828960926`, values file SHA-256
`1b82a10f1341d7b3f809561de16a210d6e66b6cfc44a0e508d5a737674acefe0` and these
digests:

- `us-central1-docker.pkg.dev/mokly-508518/mokly/mkc-api@sha256:7cdc96141e1a4015c6a60f30c7534a692646a2ba83cb75abe0bcedf0d88793dc`
- `us-central1-docker.pkg.dev/mokly-508518/mokly/mkc-catalogue-server@sha256:1a50e1a97fd548538272f1a3be9f886e701cacee84e234e2dff8f89640fe5a0b`
- `us-central1-docker.pkg.dev/mokly-508518/mokly/app@sha256:e6cba4b2c40608f2d004b418dc46199a5a5843602ad15e2091d5e66c4e8229d7`

The images were built by standalone BuildKit on a machine without cloud
credentials and pushed from the operator's machine with the pinned `crane`;
the archive checksums matched. The Terraform check reported no changes before
rollout, lint and the Origin CA host checks passed, and the migration Job
completed. The install then needed four operator remediations:

1. **Secret access.** Every CSI mount failed with `PermissionDenied`. The chart
   annotates the API and catalogue Kubernetes service accounts with their
   Google service accounts, so the managed CSI provider authenticates as those
   accounts rather than as the direct Kubernetes principals Terraform binds.
   The operator granted `roles/secretmanager.secretAccessor` by hand to
   `mkc-main-preview-api@` on all five API secrets and to
   `mkc-main-preview-cat@` on the signing key. Those bindings were initially unmanaged. The
   [production reconciliation](./production.md) imported them into Terraform
   and removed the obsolete direct-principal grants.
2. **Webhook secret length.** The stored webhook secret was 20 bytes; the API
   requires at least 32 and crash-looped on `MKC_GITHUB_WEBHOOK_SECRET`. The
   operator rotated it to a 64-character value on the GitHub App and as Secret
   Manager version 2, disabled version 1 and recreated the API pods. A
   redelivered `installation.created` then returned 202, and a forged
   signature returns 401 `webhook-signature-invalid`.
3. **Browser Integrity Check.** Cloudflare answered 403 to the Python smoke
   runner while curl passed. The operator turned the check off in both zones.
4. **Ingress timing.** `helm --wait` returned when workloads were ready, but
   the GCE ingress took about ten more minutes to create its URL map, proxy and
   forwarding rule; Cloudflare returned 525 meanwhile and the in-script smoke
   exhausted its twelve attempts. The operator re-ran `smoke.py` after the
   ingress reported healthy backends; all seven checks passed. The rollout now
   gives a first install a bounded 15-minute smoke window.

On 2026-09-20 the operator rolled out revision
`4020d3f53f825ba7204cf902d1f7ec191a61b941`
([Milestone F4](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-cloud-follow-ups.md#milestone-f4-provider-scoped-auth-callbacks))
as Helm revision 2;
the in-script smoke passed. The first live GitHub connect then failed with
`permission-denied` because the App lacked the Email addresses read account
permission; after the operator added the permissions and events from
[GitHub App](../protocol/cloud/github-app.md) and accepted them on the `mokly-ai`
installation, connect succeeded.
[Milestone F6](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/mokly-cloud-follow-ups.md#milestone-f6-first-github-sign-in-findings)
of the archived follow-ups plan left the typed reason for that failure open.

The publish proof ran on 2026-09-20 against revision `4020d3f5`. The operator
signed in with GitHub, bound the existing `mokly-ai` installation (GitHub's
Configure page for an already-installed App never returns to the setup URL,
so the operator uninstalled and reinstalled through `/app/install`), created a
project for `mokly-ai/mokly` at `examples/basic/mokly.config.ts` and stored
its publishing token as `mkc-main-preview-publish-smoke-token` version 2. A
first project at the default config path refused the upload with
`upload-forbidden`, as the ingest contract requires. From a neutral working
directory, `npx --package=@mokly/mokly@0.11.0 mokly publish --config
<clone>/examples/basic/mokly.config.ts --no-changes` printed "Published Mokly
catalogue." and exited 0 for head `20e55ca02a7274b659031b2295bc4d3e92360767`
(a shallow clone has no baseline, so `--no-changes` was used). Run the CLI
outside the producer's own checkout: inside it, the repository's
`node_modules/.bin` shadows the published package and `npx` reports the
`mokly` command missing. Hand-built `tar` archives from macOS are rejected
with `upload-invalid-bundle` because of their metadata entries; only the CLI's
archive is a valid bundle.

The operator also created the cache-bypass rules on 2026-09-19: `app.mokly.ai`,
`api.mokly.ai`, `app-*.mokly.ai` and `api-*.mokly.ai` in the app zone, and
`*.moklyusercontent.com` in the catalogue zone.
The archived
[unified domain layout plan](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/unified-domain-layout.md)
renamed the app and preview API hosts; that dated cache-rule proof has not
been repeated for the new names.

## Publish Proof

After rollout smoke succeeds:

1. Sign up at the environment app, verify the email, create a real project
   matching the fixture repository/config, and create a publishing token.
2. Store that token as `mkc-main-preview-publish-smoke-token`. Do not use SQL
   fixtures or seed migrations to manufacture product data.
3. In a clean fixture repository with committed authored source and a
   `mokly.config.json` configuration, use the **published** package
   `@mokly/mokly@latest` in a separate installation prefix. Set `PROJECT_ID` to the real
   project UUID and `MKC_API_ORIGIN` to the deployed API origin. The CLI sends
   its token only to blob and completion URLs on that same origin, so the
   endpoint must use exactly the API workload's `MKC_API_ORIGIN`.

   `publish` builds in a private directory outside the checkout and writes no
   output into the repository. Its comparison renders the merge
   base of `HEAD` and `--base` from its sources and may install that base's
   locked dependencies, so allow npm registry access and use only trusted
   base code.
   [Mockup comparison base](../protocol/cloud/mockup-baselines.md) defines the same
   base rules for this repository's own catalogue.

```sh
export MOKLY_ENDPOINT="${MKC_API_ORIGIN:?}/v1/projects/${PROJECT_ID:?}/publications"
export MOKLY_TOKEN="$(gcloud secrets versions access latest \
  --secret=mkc-main-preview-publish-smoke-token --project=mokly-508518)"
PUBLISH_CONSUMER="$(mktemp -d)"
npm install --prefix "$PUBLISH_CONSUMER" --workspaces=false --no-audit --no-fund @mokly/mokly@latest
"$PUBLISH_CONSUMER/node_modules/@mokly/mokly/bin/mokly.mjs" --version
"$PUBLISH_CONSUMER/node_modules/@mokly/mokly/bin/mokly.mjs" publish --strict \
  --config mokly.config.json --base main
unset MOKLY_TOKEN
rm -r -- "${PUBLISH_CONSUMER:?}"
unset PUBLISH_CONSUMER
```

This deployed proof and the automated smoke each resolve the newest npm release
when they run. Record the installed version with each result.
The automated smoke does not replace this deployed proof.
A current-only publication is viewable from its
catalogue, while the cloud API
continues to return `operation-unavailable` for current-screen listing and
screen-specific sharing until the cloud adopts the catalogue
metadata for those API operations. Verify publication-level Share without claiming those API paths.

4. Record the exit status and returned publication URL/ID, revision, environment,
   UTC time and API health body. Open the returned publication in the app,
   check Browse/Changes, then fetch its catalogue URL with the app `Origin`.
   Confirm host isolation, expected content and the security headers from the
   smoke contract. Repeat the publish at the same revision and verify it
   reports `Mokly catalogue already published for this commit.` with the same
   publication. Do not reinterpret an error as a pass.
5. Export `MKC_APP_ORIGIN`, `MKC_API_ORIGIN`, `MKC_CATALOGUE_DOMAIN` and
   `MKC_REVISION` from the deployment record. Export `MKC_DESKTOP_CLIENT`
   from that environment's Helm `desktopClient` value, then re-run
   `python3 infra/scripts/smoke.py`. The command checks the root app layout and
   needs no base-path setting. Save its JSON report alongside the publish
   command output, without the token. Keep any follow-up item for this proof
   under [`plans/follow-ups/`](../../plans/follow-ups/) open until all evidence
   succeeds.

Daily publication maintenance runs in each stable environment with database
and bucket access only. It keeps every successful catalogue until its project
or workspace is deleted, recovers abandoned uploads, prunes failed-attempt
records and collects unreferenced objects. Hourly auth and build pruning, daily
GitHub record pruning and five-minute dead-letter observation are also
scheduled; see [maintenance](./maintenance.md) and
[check recovery](./check-recovery.md).

## Mokly Release Cutover

A Mokly change that changes the upload or catalogue formats needs an ordered
cutover after its merge: deploy the receiver first, reset the stable
environments, republish the dogfood catalogue and recreate the labelled PR
previews. [Mokly release cutover](./mokly-release-cutover.md) covers the
0.19.0 frame upgrade and the earlier format cutover. The frame upgrade needs
republication without a database reset.

The dated proofs above remain historical evidence. Record a new credentialed
proof after the cutover; local Markdown checks do not supply it.

## Cloud Build Rollouts

Keep builds disabled until [Build template](./build-template.md) records a
verified release and the stable environment has an active E2B key version.
Enable the complete app-config group beside GitHub and roll the API normally.
Wait for at least two ready API replicas and an API HPA minimum of two or
greater. Verify the API-only key mount without reading its value. PR releases
always omit the key and API build settings.

A template change rolls the API through changed values. A key-version change
needs an explicit API restart; an identical Helm upgrade does not restart it.
Keep the old template and key available through rollout and in-flight recovery.
Keep the environment deployment ID unchanged so the new worker can reconcile
old attempts. Prune receives build retention without an E2B credential.

Standard deployment smoke proves HTTP, revision and migration readiness. It
does not prove E2B access. On first enablement or template/key rotation, also
run the candidate assertion and a real build through publication, check
completion and sandbox cleanup. Record that separate proof in the runbook.
If it fails, restore the previous key, or a previous template reference that
meets the current contract as [Build template](./build-template.md) says, and
restart the API. When no template reference qualifies, disable builds.
Unprovisioned stable environments keep `builds.enabled: false` and the
documented unavailable path. Disabling builds requires draining or cancelling
active attempts first.

## Billing Activation

On 2026-10-30 the operator enabled billing in main-preview, in the Stripe test
mode of `acct_1UI7K0POK3tj6dqE`:

| Item                                      | Value                                                                                                                                                       |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Secret versions                           | Version 1 of `mkc-main-preview-stripe-catalogue-key`, `mkc-main-preview-stripe-secret-key` and `mkc-main-preview-stripe-webhook-secret`                     |
| Webhook endpoint                          | `we_1UWGSbPOK3tj6dqE1uq64zeq`, for `https://br-main.preview.api.mokly.ai/v1/billing/webhooks` with API version `2026-08-26.dahlia` and the six typed events |
| Customer Portal default configuration     | `bpc_1UWGcJPOK3tj6dqEBTiCNBx7`, with the one-subscription limit on                                                                                          |
| Product `mokly_team`                      | `prod_VXLZK63Bul3pbV`                                                                                                                                       |
| Price `mokly_team_editor_usd_month`       | `price_1UWGsiPOK3tj6dqEwRfHIu1T`                                                                                                                            |
| Price `mokly_team_collaborator_usd_month` | `price_1UWGsiPOK3tj6dqEyGqsG4um`                                                                                                                            |

[Deploy run 41071038236](https://github.com/mokly-ai/mokly-cloud/actions/runs/41071038236)
from revision `860b163f764fe230cbe25f1be859ce5c90dacf49` created the product and
both prices. [Deploy run 41078918408](https://github.com/mokly-ai/mokly-cloud/actions/runs/41078918408)
reported all three `validated`. Both billing webhook smoke checks passed. A
separate request with a forged signature returned 401
`webhook-signature-invalid`, and a request without the header returned 400
`validation-failed`. Stripe Tax is active with a GB head office and no
registration, so Checkout adds no tax. The
[walkthrough](./billing-smoke.md#walkthrough) has not run yet.

## Recovery

Inspect `kubectl -n mkc-$ENVIRONMENT get pods,jobs,events` and migration logs
first. For identity errors, check namespace/ServiceAccount bindings and secret
versions; for SQL errors, check proxy logs, private routing and schema creation grants.
For ingress/TLS errors, check GCE backend health, certificate SANs, Cloudflare
strict mode, Universal SSL and preview advanced certificate activation. Do not enable shared-origin
fallbacks or weaken TLS to make smoke pass. Restore SQL through a new instance
from PITR, then explicitly update the environment state after validating data.

A rollback restores the release manifest but not the hook objects. Without a
reset, `rollout.sh` rolls the release back after a failed upgrade or a failed
smoke. Stable releases create these objects in `pre-install,pre-upgrade` hooks,
and the chart has no rollback hook:

- `bootstrap.yaml` creates the ServiceAccounts `api`, `catalogue`, `app` and
  `reset`, and the SecretProviderClasses `api-secrets` and `catalogue-secrets`.
- `network-policy.yaml` creates the NetworkPolicy `mokly-cloud`.
- `migration.yaml` creates the Job `mokly-cloud-migrate`.
- `database-reset.yaml` creates the Jobs `mokly-cloud-reset-database` and
  `mokly-cloud-grant-database` during a reset.

After a rollback, the bootstrap objects and the network policy keep the form of
the newer release until the next upgrade replaces them. Helm deletes each Job
when it succeeds. A failed Job stays until the next run of that hook, so its
logs stay readable.

Reconcile the kept objects with the restored revision `N`. In
`helm history mokly-cloud -n "mkc-$ENVIRONMENT"`, `N` is the revision before
the newer release. A successful rollback adds the row `Rollback to N`. Set
`REVISION` to `N`, then compare its hooks with the live objects:

```sh
mkdir -p .context
helm get hooks mokly-cloud -n "mkc-$ENVIRONMENT" --revision "$REVISION" \
  > .context/restored-hooks.yaml
kubectl -n "mkc-$ENVIRONMENT" get -o yaml serviceaccount/api \
  serviceaccount/catalogue serviceaccount/app serviceaccount/reset \
  secretproviderclass/api-secrets secretproviderclass/catalogue-secrets \
  networkpolicy/mokly-cloud
```

Remove each `kind: Job` document from the saved file, because the Job would run
again. Then update the other objects in place:

```sh
kubectl -n "mkc-$ENVIRONMENT" apply -f .context/restored-hooks.yaml
```

Do not delete these objects. Serving pods need the ServiceAccounts and the
SecretProviderClasses. The network policy limits the traffic of every pod in
the namespace.
