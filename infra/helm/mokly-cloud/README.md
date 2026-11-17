# Mokly Cloud Helm Chart

This chart deploys the API, isolated catalogue server and Expo app as release
`mokly-cloud` in `mkc-<environment>`. Use reviewed immutable images and derived
origins from the release renderer. Publication HTML is served only on the
independent catalogue domain.

`desktopClient` renders `MKC_DESKTOP_CLIENT` for the API and catalogue server.
The production and main-preview values enable it. PR preview values disable
it. The base value is `false`. This admits `mokly-app://desktop` beside the
public app origin for CORS, request Origin checks and catalogue framing.
The release renderer copies this exact environment value into reviewed
release values and smoke inputs. A missing or mismatched reviewed value
fails before rollout; no separate smoke environment map exists.

The chart implements both database modes: `cloudsql` for the stable
environments and `namespace` for PR previews. The complete preview contract is
[PR preview environments](../../../docs/protocol/cloud/pr-preview-environments.md);
the shared platform and lifecycle scripts are in `infra/scripts/`.

## Database Modes

| Setting / behavior | `cloudsql`                          | `namespace`                                                |
| ------------------ | ----------------------------------- | ---------------------------------------------------------- |
| Environments       | `production`, `main-preview`        | `preview-pr` plus `prNumber: N`                            |
| Database           | Stable Cloud SQL IAM / proxy        | `postgres:5432/mokly`, generated password                  |
| `MKC_DATABASE_URL` | IAM URL through localhost sidecar   | `postgres-credentials` key `url`                           |
| Migration          | Ordered pre-install/pre-upgrade Job | API `wait-for-postgres`, then `migrate` init               |
| Catalogue start    | After migration Job                 | `wait-for-api` init, exact revision and current migrations |
| Signing key        | Managed CSI                         | Namespace Secret `catalogue-signing-key`, same-named key   |
| Preview sign-in    | Not rendered                        | API-only Secret `preview-sign-in`, same-named key          |
| Service accounts   | Google-account annotations          | Direct Kubernetes identities; no annotations               |
| Ingress            | GCE, global IP, Cloud Armor         | `ingressClassName: mkc-preview`, shared regional IP        |
| Replicas           | Stable autoscaling/PDB values       | One each, no HPA or PDB                                    |

`database.mode` defaults to `cloudsql`; each stable overlay states it explicitly.
`environments/preview-pr.yaml` selects `namespace`. Template validation rejects
PR/cloudsql and stable/namespace, malformed PR numbers, wrong namespaces,
missing digests, origin mismatches and PR GitHub App enablement.
Stable API renders set `MKC_SITE_ORIGIN=https://<domain>` for hosted email logo
URLs, including main-preview where `MKC_APP_ORIGIN` uses a preview host. PR API
renders use the log mailer and have no site-origin setting.

`billing` accepts exactly `enabled: <boolean>`. Stable releases with billing
enabled mount the Stripe credentials and set `MKC_BILLING=stripe`; the API
resolves both catalogue prices by lookup key. PR releases keep billing disabled.

`builds` defaults to `enabled: false`. Stable app-config JSON can enable it
with `template` and `deploymentId`, plus optional `perProcess` (1–16, default 4) and `deniedDestinations` (up to 32 IPs or CIDRs). An empty list renders no
deny variable. Enabled builds require GitHub and `scaling.minReplicas >= 2`.
Partial groups, settings beside a disabled group and PR enablement fail render.
Only API receives build settings and the `e2b-api-key` CSI entry. Prune gets
`maintenance.buildRetentionSeconds` (0–31536000, default 2592000) in every
environment without a secret mount. See
[Build template](../../../docs/ops/build-template.md) before enabling builds.

Namespace mode renders StatefulSet/Service `postgres` with the pinned
`postgres.image` digest, `postgres.storageSize: 2Gi`,
`postgres.storageClassName: standard-rwo`, and PVC `data-postgres-0`. The
[database contract](../../../docs/protocol/cloud/pr-preview-environments.md#chart-values-and-runtime)
specifies its user and lifetime. The PVC/Secrets persist across pushes and
disappear on namespace deletion. Helm does not generate credentials: the
trusted deploy script creates them once before installation. Never replace a
password beside an existing database. No PR proxy, CSI class, GCE
BackendConfig or migration hook renders. The scheduled maintenance CronJobs
use only the URL Secret.

Postgres runs under the chart's restricted security context as the image's
user and group 999 with `fsGroup: 999`; `PGDATA` is a child of the PVC mount,
and the socket and temporary directories are writable `emptyDir`s, so the
entrypoint needs neither root nor a recursive chown.

## Preview Values And Origins

`render-values.py preview-pr-N` supplies `environment: preview-pr`, integer
`prNumber`, `database.mode: namespace`, `domain`, `catalogueBaseDomain`,
`region`, `revision`, all three workload images,
`preview.blobsBucket: mokly-508518-preview-blobs` from
`MKC_PREVIEW_BLOBS_BUCKET`, and `ingressAddress` from
`MKC_PREVIEW_INGRESS_IP`. The stable ingress map never selects a PR address.

Both Rust services use `MKC_FILE_STORE=gcs`, that bucket and
`MKC_GCS_PREFIX=pr-N`. They share `MKC_APP_ORIGIN=https://pr-N.preview.D`
and `MKC_CATALOGUE_ORIGIN=https://pr-N.preview.C`. The API log mailer requires
`MKC_ENV=preview`. The prefix and namespace database have one lifetime: preview
cleanup removes both, while the shared bucket has no live-object age rule. The
API's projected read-only secret volume combines the catalogue signing key with
API-only `preview-sign-in`; the entrypoint exports the latter as
`MKC_PREVIEW_SIGN_IN_SECRET`, while the chart sets
`MKC_PREVIEW_SIGN_IN_EMAIL=preview@mokly.ai` and `MKC_PREVIEW_SIGN_IN_PLAN=team`.
Stable renders include none of these settings. The plan is fixed by namespace
mode, not a configurable chart value. It makes new workspaces created by
the configured account start on Team. Projects default to private and private
uploads are allowed. It creates no subscription, leaves seat counting unchanged
and leaves the unconfigured Billing pane at “Billing opens soon”. Existing
workspaces keep their plan. Runtime validation accepts `free` (the absent
default) or `team` only with the sign-in pair and capability; see
[Preview sign-in](../../../docs/protocol/cloud/auth-sessions.md#preview-sign-in).
The app image is baked with the exact public app and API origins; runtime
settings assert them and cannot retarget it.

Ingress hosts are `app-origin-pr-N.preview.D`, `pr-N.preview.api.D` and
`*.pr-N.preview.C`, routed only to their respective Services. The sole per-PR
TLS entry uses `Secret/catalogue-tls`; the chart's `Certificate/catalogue-tls`
uses `ClusterIssuer/mkc-preview-letsencrypt` for that catalogue wildcard.
App/API use the shared controller default Origin CA certificate. The chart
never installs ingress-nginx, cert-manager or the ClusterIssuer. Their exact
values/pins belong to [Preview platform](../../../docs/protocol/cloud/preview-platform.md).

`api.trustedProxyHops: 2` and `api.trustedProxyCidrs: [10.24.0.0/14]`
implement the nginx path. The helper appends `cloudflare.trustedProxyCidrs`,
the shared list in `values.yaml`, to either environment's proxy ranges. Stable values
remain three hops with GFE/Cloudflare/reserved-IP trust. Default-deny policies
admit controller traffic, narrowly scoped database/init traffic, DNS,
workload-identity metadata and HTTPS as defined in the parent contract.
Namespace Services expose their workload ports; the API requires
`api.port: 8080` and `api.healthPath: /v1/health` for the catalogue startup gate.

Only PR releases render the suspended CronJob `preview-seed`, the template of
the [preview seed Job](../../../docs/protocol/cloud/preview-seed-job.md). It never
runs on its schedule. For each workflow run attempt, the trusted release script
`preview-seed-job.py` creates one Job from it and adds `--run <run>` to the
arguments. The template pod has one `api` container with the API image,
`args: [preview-seed]`, and the API's environment and secret volume. The pod
uses the `api` service account. Its `maintenance` label gives it the network
access of the maintenance pods.

## Publication Runtime Tuning

| Chart value               | Workload  | Default     | Accepted values            |
| ------------------------- | --------- | ----------- | -------------------------- |
| `api.ingestWorkers`       | API       | `8`         | Integer 1–32               |
| `api.uploadMemoryBytes`   | API       | `536870912` | Integer 1–9007199254740991 |
| `api.uploadBlobGzip`      | API       | `false`     | Boolean                    |
| `catalogue.hotCacheBytes` | Catalogue | `134217728` | Integer 0–9007199254740991 |

The chart renders these values as exact quoted decimal environment variables
in every environment. `catalogue.hotCacheBytes: 0` disables the hot cache.
Invalid types and ranges fail schema validation before a workload is rendered.

The API's 1 GiB memory limit pairs with the 512 MiB process-wide upload budget.
Raw Blob buffers remain charged through storage writes. Gzip Blob requests
charge both encoded and decoded sizes until the encoded body is decoded, then
keep the decoded reservation through storage. The remaining headroom covers
compressed requests, validation/index metadata, provider responses, database
clients and runtime overhead. The catalogue's 1 GiB limit pairs with the 128
MiB cache budget, leaving 896 MiB for streams, compression and runtime
overhead. See [Environment](../../../docs/ops/environment.md#runtime-settings)
for the complete sizing contract.

The shared defaults live in `values.yaml`. Put an intentional environment
override in the matching checked-in `environments/*.yaml` file.
`render-values.py` does not accept these operational settings: it derives
release identity, images, origins and storage assertions, while chart values
remain the reviewable source for tuning.

## Operation And Checks

Deploy through the trusted scripts after the operator establishes the shared
platform and supplies its credentials:

```sh
bash infra/scripts/preview-deploy.sh preview-pr-123
bash infra/scripts/preview-destroy.sh preview-pr-123
```

Set the required inputs in [Script interfaces](../../../docs/protocol/cloud/preview-scripts.md)
first. Stable rollout continues through `rollout.sh ENVIRONMENT`. Direct Helm
calls do not substitute for readiness, credential creation, DNS/IAM and smoke.
For a stable release, `RESET_RELEASE=true` deletes the current `mokly` database
contents through the dedicated reset identity, reapplies migrations and
catalogue grants, then starts and smokes fresh workloads. The Cloud SQL instance,
blob bucket, secrets and other infrastructure remain. False or unset preserves
the database and performs a normal rollout.

## Development

```sh
cargo xtask check --suite cloud-helm
cargo xtask check --suite cloud-infrastructure
python3 infra/helm/tests/check.py --update
```

The Helm check validates goldens, rejected inputs, runtime-setting documentation
parity and the union of network permissions, using the locked YAML parser
installed by `npm ci`. Use `--update` only for an intentional
template change, review every generated diff, then rerun the checks.

### Key Code

- `values.yaml` and `values.schema.json` — the shared defaults, the one Cloudflare CIDR list `cloudflare.trustedProxyCidrs`, and the schema that rejects invalid runtime settings before a workload renders.
- `environments/production.yaml`, `environments/main-preview.yaml` and `environments/preview-pr.yaml` — the per-environment overlays; the PR overlay selects `database.mode: namespace`.
- `templates/_helpers.tpl` — `mkc.environment`, `mkc.host`, `mkc.publicAppOrigin`, `mkc.catalogueDomain` and `mkc.validate`, the mode, PR number, digest and origin checks that fail a render.
- `templates/_validation.tpl` — `mkc.validateRuntimeEnv`, which rejects runtime assertions that differ from the release origins and storage.
- `templates/_runtime.tpl` — the workload environment, security context and secret volumes, including `mkc.trustedProxyCidrs`, which appends the Cloudflare list to the mode-specific proxy ranges.
- `templates/_builds.tpl` — `mkc.validateBuilds`, which fails a render that enables builds in a PR preview, without GitHub, with fewer than two API replicas or with a malformed denied destination, and `mkc.buildEnv`, the API's cloud build settings.
- `templates/_init.tpl` and `files/wait-for-api.mjs` — the namespace-mode init containers: `wait-for-postgres` and `migrate` for the API, and the catalogue's `wait-for-api` gate that polls the API health for the intended revision.
- `templates/postgres.yaml` — the namespace Postgres Service and StatefulSet, whose PVC `data-postgres-0` is retained on deletion and scale-down.
- `templates/workloads.yaml` — the three Deployments; the namespace-mode API uses `Recreate`.
- `templates/migration.yaml`, `templates/database-reset.yaml` and `templates/bootstrap.yaml` — the stable migration Job, the reset hook, and the service accounts and CSI classes.
- `templates/ingress.yaml` and `templates/certificate.yaml` — the GCE Ingress for stable environments, the ingress-nginx hosts for PRs and `Certificate/catalogue-tls`.
- `templates/network-policy.yaml`, `templates/network-preview.yaml` and `templates/_network.tpl` — the default-deny policies and their preview egress rules.
- `templates/services.yaml`, `templates/scaling.yaml` and `templates/maintenance.yaml` — the Services and BackendConfigs, the stable autoscalers and disruption budgets, and the maintenance CronJobs.
- `templates/preview-seed.yaml` — the suspended PR-only CronJob `preview-seed`, which uses the API's image, environment and secret volume. `infra/scripts/preview-seed-job.py` creates each seed Job from it.
- `../tests/check.py` — the Helm lint, golden renders and rejected-input cases.
- `../tests/build_contract.py` — the build settings, the API-only `e2b-api-key` entry and the rejected build configurations.

### Related Docs

- [PR preview environments](../../../docs/protocol/cloud/pr-preview-environments.md)
- [Preview platform](../../../docs/protocol/cloud/preview-platform.md)
- [Preview script interfaces](../../../docs/protocol/cloud/preview-scripts.md)
- [Preview seed Job](../../../docs/protocol/cloud/preview-seed-job.md)
- [Infrastructure promotion](../../../docs/protocol/cloud/infrastructure-promotion.md)
- [Deployment smoke checks](../../../docs/protocol/cloud/deployment-smoke-checks.md)
- [Cloud build runner](../../../docs/protocol/cloud/cloud-build-runner.md)
- [Desktop application](../../../docs/protocol/cloud/desktop-app.md)
- [Build template](../../../docs/ops/build-template.md)
- [Environments](../../../docs/ops/environment.md)
- [Architecture](../../../docs/architecture/cloud.md)
