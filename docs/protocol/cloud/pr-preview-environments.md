# PR Preview Environments

Status: [Milestone 5](../../../plans/preview-password-sign-in.md#milestone-5-store-deploy-comment-and-local-stack) adds the verifier store, the deploy copy, and the optional mount.

This contract defines the environment that every labelled pull request gets:
its namespace, data, hosts, TLS, identity and network boundaries. The
[reviewer runbook](../../ops/preview.md) describes its operation. Stable
environments keep Cloud SQL, GCE ingress, Origin CA and their Terraform states.

`D = MKC_DOMAIN`, `C = MKC_CATALOGUE_BASE_DOMAIN`. `N` matches
`[1-9][0-9]{0,8}`. The project is `mokly-508518`, the cluster is
`mkc-autopilot`, and `MKC_REGION` defaults to `us-central1`.

## Resource Ownership

| Resource                   | Name / scope                                                               | Owner                                           |
| -------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------- |
| Namespace / Helm release   | `mkc-preview-pr-N` / `mokly-cloud`                                         | Preview workflow                                |
| Shared system namespace    | `mkc-preview-system`                                                       | Main deploy `preview-platform` job              |
| Regional external IPv4     | `mkc-preview-ingress`                                                      | Foundation Terraform                            |
| Blob bucket                | `mokly-508518-preview-blobs`                                               | Foundation Terraform                            |
| Proxied A records          | `*.preview.D`, `*.preview.api.D` → shared IPv4                             | Foundation Terraform                            |
| DNS-only A record          | `*.pr-N.preview.C` → shared IPv4, TTL 300                                  | Preview workflow                                |
| App/API edge certificate   | Existing pack: `D`, `*.preview.D`, `*.preview.api.D`                       | Foundation Terraform                            |
| App/API origin certificate | Secret Manager `mkc-preview-origin-tls-key`, `mkc-preview-origin-tls-cert` | Operator values; foundation IDs/IAM             |
| Catalogue DNS token        | Secret Manager `mkc-catalogue-dns-token`                                   | Operator value; foundation ID/IAM               |
| Preview password verifier  | Secret Manager `mkc-preview-sign-in-password`                              | Operator value; foundation ID/IAM               |
| Catalogue certificate      | `Certificate/catalogue-tls`, `Secret/catalogue-tls` in PR namespace        | Helm declaration; cert-manager issuance/renewal |
| Postgres                   | `StatefulSet/postgres`, `Service/postgres`, `PVC/data-postgres-0`          | PR Helm release; namespace deletion removes PVC |
| Seed Job template          | `CronJob/preview-seed`, suspended                                          | PR Helm release                                 |
| Seed Jobs                  | `Job/preview-seed-<run>`, one for each workflow run attempt                | Preview workflow creates and deletes each       |
| Generated secrets          | `postgres-credentials`, `catalogue-signing-key`                            | Preview deploy script; namespace lifetime       |
| Verifier copy              | `preview-sign-in` in PR namespace                                          | Preview deploy script; copied on each deploy    |
| Bucket access and objects  | Two conditional IAM members, prefix `pr-N/`                                | Preview deploy/destroy scripts                  |

Terraform accepts only `production` and `main-preview` environments. No PR
state, Cloud SQL instance, Google service account, bucket, Secret Manager ID,
global address, Cloud Armor policy or Cloudflare certificate pack is created.
The [platform contract](./preview-platform.md) owns shared Kubernetes details;
[script interfaces](./preview-scripts.md) own provider mutation and retries.

## Hosts And TLS

| Purpose        | Host / origin                     | Path and transport                                     |
| -------------- | --------------------------------- | ------------------------------------------------------ |
| Public app     | `https://pr-N.preview.D`          | Worker proxies every path to the preview app           |
| Internal app   | `app-origin-pr-N.preview.D`       | Worker same-zone HTTPS fetch → ingress-nginx → app     |
| Public API     | `https://pr-N.preview.api.D`      | Cloudflare HTTPS → ingress-nginx → API                 |
| Catalogue base | `https://pr-N.preview.C`          | Configuration suffix only; not a browsable publication |
| Publication    | `https://p-<uuid>.pr-N.preview.C` | DNS-only, browser HTTPS → ingress-nginx → catalogue    |

The first two A wildcards and the existing shared edge pack cover the app/API
hosts. The controller's default Origin CA certificate covers exactly
`*.preview.D` and `*.preview.api.D`. A direct request to the internal app host
matches the Worker's unsupported-label rule and gets a router 404 without a
fetch. An absent PR's valid public URL resolves but gets the ingress default
backend's 404; the Worker preserves that response and adds `noindex`.

Each catalogue certificate has exactly one SAN, `*.pr-N.preview.C`, and uses
`issuerRef: {name: mkc-preview-letsencrypt, kind: ClusterIssuer, group: cert-manager.io}`.
The publication label is one level below `pr-N.preview.C`; neither `*.C` nor
`*.preview.C` covers it. Ingress uses `ingressClassName: mkc-preview`, no GCE
annotations, and one TLS entry containing that wildcard and `catalogue-tls`.
App/API hosts use the controller default certificate, never a per-PR copy.
Keep the Certificate and Secret on upgrades; namespace deletion removes both.
Use RSA 2048, `privateKey.rotationPolicy: Always`, `duration: 2160h` and
`renewBefore: 720h`. Do not replace a healthy Certificate to deploy a new image.

## Chart Values And Runtime

The [chart README](../../../infra/helm/mokly-cloud/README.md) is the values guide.
The PR renderer must emit these values, rejecting inconsistent assertions:

| Values key                                          | PR value / source                                                |
| --------------------------------------------------- | ---------------------------------------------------------------- |
| `environment`, `prNumber`                           | `preview-pr`, integer `N`                                        |
| `project`, `region`                                 | `mokly-508518`, `MKC_REGION`                                     |
| `domain`, `catalogueBaseDomain`                     | `MKC_DOMAIN`, `MKC_CATALOGUE_BASE_DOMAIN`                        |
| `ingressAddress`                                    | `MKC_PREVIEW_INGRESS_IP`; never the stable ingress map           |
| `database.mode`                                     | `namespace`; stable environments require `cloudsql`              |
| `postgres.image`                                    | The exact pinned Postgres image digest                           |
| `postgres.storageSize`, `postgres.storageClassName` | `2Gi`, `standard-rwo`                                            |
| `preview.blobsBucket`                               | `MKC_PREVIEW_BLOBS_BUCKET`, exactly `mokly-508518-preview-blobs` |
| `preview.signInEmail`                               | Exactly `preview@mokly.ai`                                       |
| `api.trustedProxyHops`                              | `2`                                                              |
| `api.trustedProxyCidrs`                             | `10.24.0.0/14` pod range plus Cloudflare's published CIDRs       |
| `scaling.minReplicas`, `scaling.maxReplicas`        | Both `1`; no PR HPA                                              |
| `pdb.enabled`, `github.enabled`                     | Both `false`                                                     |
| `api.image`, `catalogue.image`, `app.image`         | Validated immutable Artifact Registry digests                    |
| `revision`                                          | PR head's 40-character lowercase Git SHA                         |

Stable values default to `database.mode: cloudsql`; the PR overlay selects
`namespace`. The runtime allowlist is the mode-specific ranges plus one
checked-in copy of Cloudflare's published CIDRs that both modes share. Reject
PR/cloudsql and stable/namespace combinations, invalid PR numbers, different
buckets, enabled GitHub configuration and mismatched origins.
`MKC_APP_CONFIG` / `MKC_CATALOGUE_CONFIG` may assert only derived nonsecret
settings; API/storage/secret configuration cannot be overridden by PR metadata.

Both Rust workloads and their database-only init/maintenance containers read
`MKC_DATABASE_URL` from `postgres-credentials` key `url`. `POSTGRES_USER=mokly`,
`POSTGRES_DB=mokly`, and Postgres reads `POSTGRES_PASSWORD` from key `password`.
Generate that password as 32 random bytes encoded in lowercase hex (64 chars),
so no URL escaping is needed. The exact URL is
`postgres://mokly:<password>@postgres:5432/mokly?sslmode=disable&connect_timeout=5`.
These ephemeral services share this database owner; stable IAM SQL grants do
not apply. This is a trusted-code review environment, not SQL tenant isolation.

The signing Secret key is `catalogue-signing-key`, containing 32 random bytes
as 64 lowercase hex characters with no newline. Mount it read-only at
`/var/run/mokly-secrets/catalogue-signing-key`, from which the workload reads
`MKC_CATALOGUE_SIGNING_KEY`. No CSI classes, Google account annotations, Cloud
SQL proxy containers or pre-install/pre-upgrade migration Job render in PRs.
Both Rust services use `MKC_ENV=preview`, `MKC_FILE_STORE=gcs`,
`MKC_GCS_BUCKET=mokly-508518-preview-blobs`, `MKC_GCS_PREFIX=pr-N`, the exact
public `MKC_APP_ORIGIN` and catalogue-base `MKC_CATALOGUE_ORIGIN` above.
The API uses `MKC_MAILER=log`; no Postmark/GitHub secret is mounted. It mounts
the optional Secret `preview-sign-in` read-only at
`/var/run/mokly-secrets/preview-sign-in`, from which it reads
`MKC_PREVIEW_SIGN_IN_VERIFIER` when the verifier exists, and sets
`MKC_PREVIEW_SIGN_IN_EMAIL=preview@mokly.ai` and `MKC_PREVIEW_SIGN_IN_PLAN=team`.
[Preview sign-in](./preview-sign-in.md) defines the verifier and its copy.
Stable releases render none of these settings. The optional plan defaults to
`free`, accepts only `free` and `team`, and requires the email and the same
preview sign-in capability. New workspaces created by that normalized
account email start on Team; other and existing workspaces keep their plan.
Team permits private uploads and defaults new projects to private, without a
subscription or a change to seat counting. Billing stays unconfigured and its
pane reads “Billing opens soon”.
The [preview seed](./preview-seed.md) owns that account's lifecycle.

Postgres is one replica with one `ReadWriteOnce` PVC that keeps its data across
pushes. PVC retention is `Retain` on StatefulSet deletion or scale-down;
namespace deletion is the destructive boundary. Stable resources are unaffected.

The API starts only after Postgres accepts connections, waiting at most 300 s,
and after the release image's migrations have run. It uses `Recreate` for its
single replica so different preview revisions do not serve concurrently across
migrations. The catalogue starts only after the API health reports
`status: ok`, `migrations: current` and the intended revision, waiting at most
600 s. Both binaries keep their startup migration checks. No init step invents
fixture data; after deployment the release job runs the
[preview seed](./preview-seed.md) as a Job of the API image, which creates
the sample account and project through the API's actions. The auth pruning and
check-status CronJobs use the URL Secret with no proxy or signing-key mount.
Namespace Services expose their workload ports; API port `8080` and health
path `/v1/health` are fixed to keep the catalogue gate reachable.

## GCS Identity And Retention

The API principal is
`principal://iam.googleapis.com/projects/<number>/locations/global/workloadIdentityPools/mokly-508518.svc.id.goog/subject/ns/mkc-preview-pr-N/sa/api`;
replace `<number>` with the numeric project number returned by GCP, never the
project ID. The catalogue principal substitutes `sa/catalogue`.
Grant API `roles/storage.objectUser` and catalogue
`roles/storage.objectViewer` only on `mokly-508518-preview-blobs`, each with:

```text
resource.name.startsWith('projects/_/buckets/mokly-508518-preview-blobs/objects/pr-N/')
```

Use condition title `mkc-preview-pr-N`, description `Objects for preview-pr-N`.
Foundation grants deploy `roles/storage.admin` on this bucket only so it can
maintain bindings and remove objects. No per-PR Google accounts are involved.
Other policies/members must survive every read/modify/write. Removal matches
principal, role and complete condition.

The object condition does **not** grant `storage.objects.list`: that check is
on the bucket, and GCS cannot restrict listing by `resource.name` to a prefix.
PR workloads get no bucket-wide list grant; no GC/listing job is scheduled.
Deploy performs cleanup with its bucket-scoped admin grant. Library listing
still supports prefixes for other authorized callers, as specified in
[Publication storage](./persistence-publication-storage.md#object-prefixes).
See [GCS conditional access](https://docs.cloud.google.com/storage/docs/access-control/iam).

The shared bucket uses uniform access, public-access prevention, no versioning
and seven-day soft deletion. It has no age-based live-object deletion. Each
`pr-N/` prefix lives as long as the namespace database that indexes it:
namespace deletion removes the database/PVC and cleanup removes every live
prefix object, then confirms none remain. Soft-deleted bytes expire under the
bucket recovery policy. A durability marker therefore cannot outlive its
object. No automatic stale PR reaper exists. Artifact Registry keeps
`preview-` tags for seven days and retains `release-` versions even when the
digest also has a preview tag.

## Network Boundaries

Default-deny PR NetworkPolicies admit app/API/catalogue ports only from
`mkc-preview-system` controller pods, plus catalogue's `wait-for-api` to the
API service. Postgres port 5432 admits only this namespace's API, catalogue,
migration init and maintenance pods. DNS goes to kube-dns / NodeLocal DNS;
workloads may reach the GKE metadata server at `169.254.169.254:80` and public
HTTPS, excluding private/link-local ranges. The seed Job carries the
`maintenance` label, so it gets exactly the access of maintenance pods. There
is no Cloud SQL egress.
Workload service-account tokens stay unmounted, and the chart creates no
namespace Role or RoleBinding. Browser tests run in CI against a local stack,
never inside a PR namespace. No product screen gains environment labels.
