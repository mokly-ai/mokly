# Environments

Mokly Cloud runs in GCP project `mokly-508518`. The regional GKE Autopilot
cluster, stable private Cloud SQL Postgres 16 instances and GCS buckets use the same
region (`us-central1` by default). Set `region` before the first apply; moving
it is a migration. Bookfolio's source was unavailable; this stack implements
the agreed shape from first principles.

## Inputs And Ownership

The operator supplies the app/API Cloudflare `zone_id` and `domain`,
independent `catalogue_zone_id` and `catalogue_base_domain`, notification channels and existing canonical apex/www
targets. Current production bindings are recorded in [Production](./production.md). `D` below
means the app/API domain and `C` the separate catalogue registrable domain;
neither is a literal hostname.
Never infer a production domain from the GCP project name. Record the resolved
values in the deployment change before applying. The direct-upload Cloudflare
Pages project `mokly-site` is owned by this repository's site workflow, outside
Terraform; an operator creates or adopts it and attaches the apex `D`.

The `foundation` state, which the [Foundation workflow](./foundation.md)
applies, owns the VPC, private service connection,
Autopilot cluster, Artifact Registry, federation, stable workload Google
accounts/IAM/buckets/secret IDs, plus the shared preview regional address,
bucket, TLS/DNS secret IDs, two proxied A wildcards and app/API certificate
pack. Wrangler in the main deploy workflow owns the shared Worker and its
three routes. The same workflow owns the Kubernetes preview platform. Zone SSL
adoption remains opt-in; cache rules stay operator-owned.

Only `production` and `main-preview` have `environment` states: SQL,
Cloud Armor, reserved global IP, their specific DNS records, dead-letter alert
policies and main-preview's catalogue edge pack. Google creates a Logging
notification rule for each log-based alert policy; Terraform does not manage
it. Protected-main CI applies
those exact saved plans on a push or a manual Deploy dispatch from `main`. PRs
have no environment state, Google accounts or Secret Manager IDs. The preview
workflow owns each PR namespace/Helm release,
Postgres/PVC/Secrets, cert-manager Certificate, catalogue A record, blob prefix
and conditional bucket grants. Namespace/release names are `mkc-<environment>`
and `mokly-cloud`. [PR preview contracts](../protocol/cloud/pr-preview-environments.md)
define the contract. Foundation declares the shared preview resources and host
mapping; the main deploy workflow installs the platform, and the preview
workflow manages PR namespaces. `environment.sh`, `terraform-environment.sh`
and `rollout.sh` accept only `production` or `main-preview`; PRs use
`preview-deploy.sh` and `preview-destroy.sh` instead. The September 23
credentialed platform and PR lifecycle proof is recorded in
[Previews](./preview.md).

| Environment    | Public app origin           | API host                | Internal app-origin host    | Catalogue host pattern       |
| -------------- | --------------------------- | ----------------------- | --------------------------- | ---------------------------- |
| `production`   | `https://D`                 | `api.D`                 | `app-origin.D`              | `p-<uuid>.C`                 |
| `main-preview` | `https://br-main.preview.D` | `br-main.preview.api.D` | `app-origin-main-preview.D` | `p-<uuid>.br-main.preview.C` |
| `preview-pr-N` | `https://pr-N.preview.D`    | `pr-N.preview.api.D`    | `app-origin-pr-N.preview.D` | `p-<uuid>.pr-N.preview.C`    |

Only positive decimal PR numbers are accepted. The app serves root-relative
slug addresses on each public app origin. Every preview path serves the app.
On the production apex the Worker passes `/` and the site's declared route
and asset segments to Pages and proxies all other paths to the app. Catalogue HTML
never goes through the app or API service. All public origins use HTTPS.
Catalogue content requires a different registrable domain from app/API;
separate sibling subdomains alone do not isolate cookies.

The internal app-origin host is never public navigation. Stable first-level
hosts use GCE ingress, Origin CA and environment Cloud Armor; the PR internal
host uses the foundation wildcard, shared Origin CA certificate and
`IngressClass/mkc-preview`. Direct browser access to that PR internal host
gets the Worker label-validation 404. The public API retains its normal role.

Production site links to the app with relative `/sign-in` and `/sign-up` paths. PR site
previews remain at `https://pr-N.mokly-site.pages.dev`; their app links are
inert on that alias, and the bot comment names
`https://pr-N.preview.D/sign-in` for application review. Main-preview has no
marketing site.

## DNS, Certificates And Worker

| Name                                                                        | Type / target                                   | Owner                           |
| --------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------- |
| `D`                                                                         | Custom domain on Pages project `mokly-site`     | Operator                        |
| `www.D`                                                                     | Permanent redirect to `https://D`               | Operator                        |
| `getmokly.com`, `www.getmokly.com`                                          | Redirect to `https://mokly.ai`                  | Operator (Cloudflare dashboard) |
| `*.preview.D`                                                               | Proxied A → regional `mkc-preview-ingress` IPv4 | Foundation state                |
| `*.preview.api.D`                                                           | Proxied A → same shared regional IPv4           | Foundation state                |
| `app-origin.D`, `api.D`, `*.C`                                              | Proxied A → production reserved global IPv4     | Production environment state    |
| `app-origin-main-preview.D`, `br-main.preview.api.D`, `*.br-main.preview.C` | Proxied A → main-preview reserved global IPv4   | Main-preview environment state  |
| `*.pr-N.preview.C`                                                          | DNS-only A → shared regional IPv4, TTL 300      | Preview workflow                |

The two foundation wildcards use automatic TTL (`1`). Specific stable records
win over them. The PR public and internal app hosts share `*.preview.D`; no
per-PR app/API record exists. A valid PR without a namespace resolves and
gets the shared ingress default-backend 404 for any path, not a DNS failure.

The `apps/worker` Wrangler configuration binds the Worker to exactly `D/*`
and `*.preview.D/*`; the deploy workflow owns both script and route updates.
Terraform owns neither. The Pages custom domain stays attached; the Worker
passes requests for the site's declared paths through unchanged. The complete mapping, label and response contract is
[Origin router](../protocol/cloud/origin-router.md).

The Pages custom-domain binding is an explicit operator action, not a Terraform
resource. Attach only the apex to Pages and configure `www.D` as a permanent
redirect to that apex. It must not be a second Pages custom domain: the site's
relative account links require the Worker route on the apex. See
[Marketing site](../protocol/cloud/marketing-site.md) and
[Site delivery](../protocol/cloud/site-delivery.md). The operator-managed legacy
redirect preserves the incoming path and query string, and its DNS has no
reachable origin. For app/API and stable catalogue hosts, Cloudflare provides DNS
and TLS transport only. PR catalogue DNS is DNS-only; ingress-nginx terminates
its public HTTPS certificate directly. Operator-managed cache rules bypass edge caching for
app/API in their zone and catalogue in its own zone; Full (strict) TLS must be
enabled in both zones, and Browser Integrity Check must be off (or exempt the
API and catalogue hosts) so non-browser clients are not answered with 403.
Authorization and caching headers remain the workload's responsibility.

Cloudflare Universal SSL covers the app/API apex and first-level names,
including `api.D` and stable internal app-origin hosts. It does not cover the
nested `*.preview.D` or `*.preview.api.D` names (including PR internal hosts). The foundation state
therefore creates one 90-day Let's Encrypt Advanced Certificate Manager pack
on the app/API zone, validated with TXT records, containing exactly `D`,
`*.preview.D` and `*.preview.api.D`. Cloudflare requires the apex in the pack
even though Universal SSL already covers it. The pack is shared and is never
created per environment or pull request.

Production catalogue `*.C` keeps Universal SSL; main-preview keeps its
per-environment Let's Encrypt Cloudflare pack for `*.br-main.preview.C`.
PR catalogue `*.pr-N.preview.C` uses cert-manager's `catalogue-tls` certificate
from `ClusterIssuer/mkc-preview-letsencrypt`, with the same-named Secret in
its namespace. Only the preview workflow owns its DNS-only A record. See
[Catalogue hosting](../protocol/cloud/catalogue-hosting.md) and
[platform TLS](../protocol/cloud/preview-platform.md).

## Data And Runtime Boundaries

| Resource                 | Stable environments                                                                                                         | PR previews                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Blob bucket              | `mokly-508518-<environment>-blobs`                                                                                          | `mokly-508518-preview-blobs`, objects under `pr-N/`                          |
| Database                 | Private Cloud SQL `mkc-<environment>`, database `mokly`                                                                     | `StatefulSet/postgres`, database/user `mokly`                                |
| API / catalogue identity | `mkc-<environment>-api@mokly-508518.iam.gserviceaccount.com` / `mkc-<environment>-cat@mokly-508518.iam.gserviceaccount.com` | Direct Kubernetes principals `ns/mkc-preview-pr-N/sa/api` and `sa/catalogue` |
| Database reset identity  | `mkc-<environment>-reset@mokly-508518.iam.gserviceaccount.com`; non-serving, `cloudsqlsuperuser`                            | Namespace deletion recreates Postgres; no reset identity                     |
| Credentials              | Passwordless SQL IAM; CSI Secret Manager mounts                                                                             | Namespace `postgres-credentials` and `catalogue-signing-key`                 |
| Persistence              | SQL backups/PITR; protected resources                                                                                       | 2 GiB PVC across pushes; deleted on namespace cleanup                        |

API owns migrations. Stable catalogue startup uses its separate IAM principal
and requires [SQL grants](./secrets.md) after the migration Job. PRs share the
namespace database owner: API init waits for Postgres and migrates; catalogue
waits for the API's current migration state and intended revision. Both retain
startup migration checks. Stable API/catalogue have write/read bucket roles;
PRs use exactly the conditional prefix bindings in the
[identity contract](../protocol/cloud/pr-preview-environments.md#gcs-identity-and-retention).

Stable SQL and secret IDs retain deletion protection; stable buckets reject
nonempty deletion. Live stable blobs have no age-based deletion: only
noncurrent versions expire after 30 days, incomplete multipart uploads after
seven days, and soft-deleted bytes after seven days. Daily publication
maintenance deletes a current object only after it has had no reference for
24 hours. Successful publications keep their objects until their project or
workspace is deleted.

The stable reset identity is used only for an explicit `deploy.yml` dispatch
with `reset=true`. The release impersonates it to recreate `mokly` through the
Cloud SQL Admin API; its Helm hook then grants schema creation to API and
database access to catalogue before migrations. It is never used by a
Deployment or CronJob. Normal releases neither schedule the reset Jobs nor
erase data.

PR storage deliberately differs: no bucket versioning, and seven-day soft
deletion applies. Live objects have no age-based deletion. Prefix cleanup
deletes them after namespace removal, so the object prefix and the database
that indexes it have one lifetime. PR database/PVC has no backup guarantee.
A shared cluster is not a hostile-tenant boundary; only trusted same-repository
PR code approved with the label runs. GCS listing/GC is not scheduled in PR
workloads because their object conditions do not grant bucket-level listing.

### Blob Storage Sizing

Object storage scales with distinct bytes per project, not distinct bytes per
environment. Publications in one project reuse a durable hash, while equal
bytes in another project have another incarnation and object. Capacity planning
must therefore sum each project's distinct retained catalogue bytes. Budget an
additional roughly 1 MiB per project and Mokly version for the common scripts,
fonts and styles present in most catalogues; publication-specific files remain
deduplicated across that project's retained history. Database sizing likewise
includes one blob row per `(project_id, hash)` and one file row per published
path.

## Runtime Settings

Helm `database.mode` is `cloudsql` for stable environments and `namespace`
for PRs. It selects database/secret/init behavior, not a runtime environment
variable. `preview.blobsBucket` comes from `MKC_PREVIEW_BLOBS_BUCKET`;
`ingressAddress` comes from `MKC_PREVIEW_INGRESS_IP` for PRs.

### Workload settings

The Deployment column is a machine-readable chart contract. An
`env:<workloads>@<environments>` marker names the exact rendered container
environments; `all` means production, main-preview and PR preview. A cell
with several comma-separated markers names the union of their targets.
`local-only` and `build-time` are the only non-rendered markers. The Helm check
compares both directions, so a documented setting cannot disappear and a
rendered setting cannot go undocumented.

<!-- workload-settings:start -->

| Setting                                                            | Deployment                                                         | Consumer and contract                                                                                                                         |
| ------------------------------------------------------------------ | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `MKC_DATABASE_URL`                                                 | `env:api,catalogue,maintenance@all`                                | Stable: passwordless IAM sidecar URL; PR: `postgres-credentials` key `url`                                                                    |
| `MKC_ENV`                                                          | `env:api,catalogue@all`, `env:maintenance@production,main-preview` | Stable `production`; PR Rust workloads `preview`; log mailer, preview sign-in and HTTPS behavior; stable publication maintenance `production` |
| `MKC_BIND`                                                         | `env:api@all`                                                      | API listener; chart default `0.0.0.0:8080`                                                                                                    |
| `MKC_CATALOGUE_BIND`                                               | `env:catalogue@all`                                                | Catalogue listener; chart default `0.0.0.0:8080`                                                                                              |
| `MKC_APP_ORIGIN`                                                   | `env:api,catalogue@all`                                            | Exact public app origin for API CORS/redirects and catalogue framing                                                                          |
| `MKC_DESKTOP_CLIENT`                                               | `env:api,catalogue@all`                                            | Admit `mokly-app://desktop`; stable `true`, PR previews `false`; absent means `false`                                                         |
| `MKC_SITE_ORIGIN`                                                  | `env:api@production,main-preview`                                  | Site host for Postmark email logos, derived from `domain` by Helm                                                                             |
| `MKC_API_ORIGIN`                                                   | `env:api@all`                                                      | Exact public API origin starting every upload plan's blob and completion URL                                                                  |
| `MKC_CATALOGUE_ORIGIN`                                             | `env:api,catalogue@all`                                            | HTTPS wildcard base without the publication label                                                                                             |
| `MKC_FILE_STORE`, `MKC_GCS_BUCKET`                                 | `env:api,catalogue@all`, `env:maintenance@production,main-preview` | Both use `gcs`; stable dedicated bucket, PR shared bucket; stable publication maintenance uses the dedicated bucket                           |
| `MKC_GCS_PREFIX`                                                   | `env:api,catalogue@preview-pr`                                     | PR shared-bucket prefix `pr-N`; stable environments render no prefix                                                                          |
| `MKC_FILE_STORE_ROOT`                                              | `local-only`                                                       | Local development when `MKC_FILE_STORE=local`                                                                                                 |
| `MKC_STRIPE_API_ORIGIN`                                            | `local-only`                                                       | Local billing tests; defaults to Stripe's origin and the chart never sets it                                                                  |
| `MKC_GITHUB_API_ORIGIN`, `MKC_GITHUB_WEB_ORIGIN`                   | `local-only`                                                       | Local development only; both together point the App at the recorded GitHub                                                                    |
| `MKC_INGEST_WORKERS`                                               | `env:api@all`                                                      | Publication writes; integer default 8, chart range 1–32                                                                                       |
| `MKC_UPLOAD_MEMORY_BYTES`                                          | `env:api@all`                                                      | Process-wide upload bodies; positive integer bytes, default 536870912                                                                         |
| `MKC_UPLOAD_BLOB_GZIP`                                             | `env:api@all`                                                      | Plan gzip Blob advertisement; strict boolean, default false                                                                                   |
| `MKC_CATALOGUE_HOT_CACHE_BYTES`                                    | `env:catalogue@all`                                                | Verified-object LRU; nonnegative integer bytes, default 134217728, 0 disables                                                                 |
| `MKC_MAILER`                                                       | `env:api@all`                                                      | Stable uses Postmark; PR uses logs                                                                                                            |
| `MKC_BILLING`                                                      | `env:api@production,main-preview`                                  | Stable API billing mode; rendered only when `billing.enabled` is true                                                                         |
| `POSTMARK_FROM`                                                    | `env:api@production,main-preview`                                  | Stable Postmark sender                                                                                                                        |
| `MKC_PREVIEW_SIGN_IN_EMAIL`                                        | `env:api@preview-pr`                                               | PR preview sign-in account `preview@mokly.ai`; configures it alone, and the verifier below is optional                                        |
| `MKC_PREVIEW_SIGN_IN_PLAN`                                         | `env:api@preview-pr`                                               | `team` for PRs; optional `free` (default) or `team`; requires the preview sign-in email and capability                                        |
| `MKC_TRUSTED_PROXY_HOPS`, `MKC_TRUSTED_PROXY_CIDRS`                | `env:api@all`                                                      | Stable supplies 3 hops, PR 2; explicit allowlist                                                                                              |
| `MKC_GITHUB_APP_ID`, `MKC_GITHUB_CLIENT_ID`, `MKC_GITHUB_APP_SLUG` | `env:api@production,main-preview`                                  | Rendered when stable `github.enabled` is true; PR GitHub configuration is disabled                                                            |
| `MKC_E2B_BUILD_TEMPLATE`, `MKC_E2B_DEPLOYMENT_ID`                  | `env:api@production,main-preview`                                  | Verified template build reference and exclusive deployment inventory namespace; rendered when `builds.enabled`                                |
| `MKC_BUILDS_PER_PROCESS`                                           | `env:api@production,main-preview`                                  | Build attempt ceiling per API process; integer 1–16, default 4; rendered when `builds.enabled`                                                |
| `MKC_E2B_DENIED_DESTINATIONS`                                      | `env:api@production,main-preview`                                  | Optional comma-separated IPs or CIDRs, at most 32; rendered only for an enabled build group with a nonempty list                              |
| `EXPO_PUBLIC_MKC_API_ORIGIN`, `EXPO_PUBLIC_MKC_APP_ORIGIN`         | `env:app@all`                                                      | Required app image build arguments; runtime asserts the same values                                                                           |
| `MKC_EXPECTED_REVISION`, `PORT`                                    | `env:app@all`                                                      | App startup revision assertion and listener (8080)                                                                                            |
| `MKC_AUTH_LINK_RETENTION_SECONDS`                                  | `env:maintenance@all`                                              | Prune: seconds after link and desktop grant expiry, default 604800                                                                            |
| `MKC_AUTH_SESSION_RETENTION_SECONDS`                               | `env:maintenance@all`                                              | Prune: seconds after absolute or seven-day idle expiry, default 86400                                                                         |
| `MKC_AUTH_RATE_RETENTION_SECONDS`                                  | `env:maintenance@all`                                              | Prune: seconds after counter reset, default 86400                                                                                             |
| `MKC_BUILD_RETENTION_SECONDS`                                      | `env:maintenance@all`                                              | Prune: seconds after a build finishes; 0–31536000, default 2592000; rendered even when builds are disabled                                    |
| `MKC_GITHUB_OAUTH_RETENTION_SECONDS`                               | `env:maintenance@all`                                              | GitHub prune: seconds after OAuth flow expiry; 0–31536000, default 86400                                                                      |
| `MKC_GITHUB_DELIVERY_RETENTION_SECONDS`                            | `env:maintenance@all`                                              | GitHub prune: seconds after a terminal delivery's receipt; 0–31536000, default 2592000                                                        |

<!-- workload-settings:end -->

Secret-backed settings use mounted files and are exported by each image
entrypoint, so they are not Kubernetes environment entries and are outside the
workload-settings parity matrix.

| Setting                                                                           | Delivery                                                                                       |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `MKC_CATALOGUE_SIGNING_KEY`                                                       | API and catalogue; stable CSI or PR namespace Secret                                           |
| `POSTMARK_SERVER_TOKEN`                                                           | Stable API CSI mount                                                                           |
| `MKC_STRIPE_SECRET_KEY`, `MKC_STRIPE_WEBHOOK_SECRET`                              | Stable API CSI mount when `billing.enabled` is true                                            |
| `MKC_GITHUB_CLIENT_SECRET`, `MKC_GITHUB_PRIVATE_KEY`, `MKC_GITHUB_WEBHOOK_SECRET` | Stable API CSI mount when `github.enabled` is true                                             |
| `MKC_E2B_API_KEY`                                                                 | Stable API CSI mount of `e2b-api-key` when `builds.enabled` is true                            |
| `MKC_PREVIEW_SIGN_IN_VERIFIER`                                                    | PR API only: optional `preview-sign-in` namespace Secret; requires `MKC_PREVIEW_SIGN_IN_EMAIL` |

The preview sign-in verifier is the scrypt verifier of the preview password,
which each deploy copies from `mkc-preview-sign-in-password`. A malformed
verifier, one outside the bounds of
[Preview sign-in](../protocol/cloud/preview-sign-in.md#verifier), or one
without the email or the capability fails startup with a typed key-only
error. Without it, the API accepts no password.

The preview sign-in plan fails startup with a typed key-only error for an
unknown value, a missing email, or a missing capability. It applies only
when a new workspace's creator email matches the normalized preview email
in the creation transaction. Existing plans do not change. Team defaults new
projects to private and allows private uploads, with no subscription and no
change to seat counting. Unconfigured billing still shows “Billing opens soon”.
`scripts/cloud/dev-api.sh` also sets `MKC_PREVIEW_SIGN_IN_PLAN=team` and the
verifier of its local preview password.

The API resolves both runtime prices from the
[Stripe billing catalogue's lookup keys](../protocol/cloud/billing-catalogue.md#runtime-resolution).
Catalogue command, credential and deployment boundaries are in
[Stripe billing catalogue operations](../protocol/cloud/billing-catalogue-operations.md).

`MKC_INGEST_WORKERS` rejects a non-integer at API startup; a direct runtime
integer outside the supported range is clamped. Helm accepts only 1–32 so a
deployment cannot rely on clamping.
`MKC_UPLOAD_MEMORY_BYTES` rejects zero, empty, negative, fractional and
overflowing values. The API shares one nonblocking weighted budget across all
archive validation and raw or gzip Blob bodies. `MKC_UPLOAD_BLOB_GZIP` accepts
only `true` or `false` and defaults to `false`; it controls Plan advertisement,
while gzip decoding remains enabled on every receiver after Phase 1. The
marker uses schema 3.
Blob bytes have no schema wrapper.
Uploads skip hashes with a database durability marker. Stable environments
remove live objects only through reference-aware collection, and PR previews
delete their prefix only together with the namespace database. Browser and
integration harnesses create a fresh local store and isolated database schema
for each run, then remove both during teardown.

The API application pool has at most eight Postgres connections with a
five-second acquisition timeout. The pool opens a connection only when a call
needs one and closes each connection at most 90 seconds after its last call. Each admitted upload serializes its short marker batches
through at most one connection regardless of worker count; object I/O remains
parallel and outside transactions. The health reader keeps its separate
single-connection pool.
`MKC_CATALOGUE_HOT_CACHE_BYTES` accepts a nonnegative integer byte count;
empty, negative, fractional, overflowing or otherwise non-integer values fail
with the typed configuration-key error and prevent API or catalogue startup.
Cache capacity is a per-process memory bound, not a shared cluster budget. It
accounts for retained entries, in-flight fills and evicted bytes still owned by
responses. The catalogue reserves a full object's declared length plus a fixed
512-byte entry overhead before buffering it and streams without cache
allocation when the reservation is refused; the reservation is released only
with the last shared owner. The overhead keeps zero-byte and tiny objects
inside the budget, so the default holds at most 262,144 entries; its
derivation is in [Catalogue delivery](../protocol/cloud/catalogue-delivery.md#bounded-hot-cache).

Helm exposes these settings as `api.ingestWorkers`,
`api.uploadMemoryBytes` and `catalogue.hotCacheBytes`. The byte settings use
the JSON-safe integer ceiling, 9007199254740991, so schema validation and Helm
render every accepted integer as the same exact quoted decimal instead of
rounding it or using scientific notation. Their base values match the Rust
defaults in every environment. To tune one environment, change its checked-in
file under `infra/helm/mokly-cloud/environments/`; keep the shared defaults in
`values.yaml`.

`render-values.py` intentionally does not copy these settings from process
environment variables. It owns release-derived identity, images, origins and
storage assertions; checked-in chart values own operational tuning so a
release has one reviewable source for each number.

### API Upload Memory Sizing

The API Deployment has a 1.5 GiB (`1536Mi`) memory limit. API jobs, the
preview-seed job included, keep a 1 GiB limit. The default 512 MiB upload
budget covers retained decompressed file allocations across both admitted
requests, including every shared writer and GCS request-body clone.
The rest of the limit is headroom for the memory outside that budget. The
worst case, measured on 2026-11-28, is about 1.4 GiB:

| Memory use                                                                    | Size          |
| ----------------------------------------------------------------------------- | ------------- |
| Upload budget                                                                 | 512 MiB       |
| Marker and index parsing of the two admitted plans                            | About 300 MiB |
| Two stored-index reads, each with 64 MiB of bytes and about 81 MiB of parsing | About 290 MiB |
| Two compressed plan bodies, each capped at 100 MiB                            | Up to 200 MiB |
| Runtime and process baseline                                                  | About 100 MiB |

The runtime row includes the bounded channels and gzip buffers, up to sixteen
concurrent 64 KiB GCS response bodies at the default eight workers per
admitted upload, database clients and the async runtime. File bodies are not
copied for parallel puts. Capacity exhaustion returns retryable
`upload-unavailable` immediately instead of borrowing from that headroom.

The process holds at most two parsed stored indexes at a time. Completion, the
screens API and GitHub check rendering share these two read slots. A caller
waits for a free slot, and its slot stays taken until it drops the parsed
index.

The API Deployment and the preview-seed job set `MALLOC_ARENA_MAX=2`, which
limits glibc to two allocator arenas. Freed parse memory then stays in arenas
that later reads reuse. On 2026-11-28, eight parallel stored-index reads left
631 MiB resident after they ended without this limit, and 166 MiB with it.

### Catalogue Memory Sizing

The catalogue workload has a 1 GiB memory limit. Its default 128 MiB hot
cache budget covers retained entries, fills and evicted objects still held by
responses, leaving 896 MiB for concurrent uncached streams, compression,
database clients, the async runtime and the process baseline. Set
`catalogue.hotCacheBytes: 0` to disable allocation through the cache while
measuring or diagnosing memory use.

### Delta Upload Settings

Blob PUTs use this same `MKC_UPLOAD_MEMORY_BYTES` budget; there is no second
blob-upload budget. A raw PUT holds its complete declared `Content-Length`
while the body is buffered and verified. A gzip PUT holds both its encoded
`Content-Length` and its reserved decoded file size while it is received and
decoded. The encoded reservation is released before the storage call. The
decoded reservation stays held through storage and both reservations release
on every error. This is independent of `MKC_INGEST_WORKERS`, the two-request
admission count that bounds plan archives, and the catalogue process's cache.

`MKC_API_ORIGIN` is the exact public API origin (scheme, host and optional
port, without a path) that starts every plan response's blob and completion
URL. The chart renders `https://api.<domain>` for stable environments and
`https://<label>.preview.api.<domain>` for PR previews, the same origin as the
app's `EXPO_PUBLIC_MKC_API_ORIGIN`, and `scripts/cloud/dev-api.sh` sets the local
listener origin. A missing or invalid value prevents API startup. The CLI sends
its bearer only to URLs on its configured endpoint's origin, so publishers name
this origin in `--endpoint`.

Retention intervals accept 0–31536000. Authentication, build and GitHub
pruning and the dead-letter observers need only the database. Publication
maintenance also needs the API identity's access to the environment's bucket.
No maintenance command loads a mail, GitHub, Stripe, E2B or catalogue-signing
credential. The chart schedules auth and build pruning hourly, publication
dead-letter observation every five minutes, GitHub record pruning daily in
every environment and publication maintenance daily in production and main
preview, whatever the `github.enabled` value. Billing-enabled releases also
schedule `billing-delivery-status` every five minutes; every job has a
ten-minute deadline.
GitHub App configuration is all-or-none. `github.enabled: false` is the explicit
disabled state and renders no `MKC_GITHUB_*` values or GitHub CSI objects.
`MKC_GITHUB_API_ORIGIN` and `MKC_GITHUB_WEB_ORIGIN` are never deployed: the
chart renders neither, both must be set together, and either one outside
`MKC_ENV=development` fails startup naming the key.

Billing configuration is all-or-none in the same way: `billing.enabled: false`
renders no `MKC_BILLING` or `MKC_STRIPE_*` values and no Stripe CSI objects,
and PR environments never enable it. The chart owns the billing values, secrets
and delivery alert; see
[Billing](../protocol/cloud/billing.md) for the runtime contract.

[Outbound links](../protocol/cloud/web-product-shell.md#outbound-links) defines
the app's site-link origins, including the desktop shell. The app has no
separate site-origin runtime or build setting. The stable API uses
`MKC_SITE_ORIGIN` for email logo URLs.

For Cloudflare → GKE external application load balancer, the verified path is
socket GFE → reserved load-balancer address → Cloudflare edge → client. The chart
uses three forwarded entries, GFE and Cloudflare networks plus the reserved IP
as `/32`. Ranges follow [Cloudflare’s published list](https://www.cloudflare.com/ips/)
and [Google’s GFE/header contract](https://docs.cloud.google.com/load-balancing/docs/https#x-forwarded-for_header),
checked 2026-09-17. Review this against the actual ingress path; a short, malformed or
untrusted chain falls back to the socket peer. Never set trusted CIDRs to all
networks. See [REST IP selection](../protocol/cloud/rest-proxies.md#trusted-proxies).

PR nginx uses a source-preserving passthrough load balancer. The API walk is
nginx pod → Cloudflare → client, with two hops and the `10.24.0.0/14` pod
range plus Cloudflare CIDRs. Do not append the ingress IP or GFE ranges. The
walk is specified in [REST](../protocol/cloud/rest-proxies.md#trusted-proxies), the
controller configuration in [Preview platform](../protocol/cloud/preview-platform.md),
and the forged-header proof in the
[preview runbook](./preview.md#shared-platform-prerequisites).

## Cloud Build Settings

The tables above define the [cloud build](../protocol/cloud/cloud-builds.md) settings.
`builds.enabled` is all-or-none like GitHub and billing, requires
`github.enabled`, and PR previews never enable it. The runtime contract is the
[runner configuration](../protocol/cloud/cloud-build-runner.md#configuration).

The environment's `MKC_MAIN_PREVIEW_APP_CONFIG` or `MKC_PRODUCTION_APP_CONFIG`
JSON carries `builds`. Omit it or use exactly `{ "enabled": false }` before
provisioning. To enable it, supply `enabled: true`, `template` (the verified
build reference `TEMPLATE_ID:BUILD_ID` from the
[template runbook](./build-template.md), nonempty without surrounding
whitespace) and `deploymentId`
(1–63 lowercase letters, digits or hyphens). The ID belongs only to builds and
must differ across environments. Optional `perProcess` is an integer from
1 through 16, default 4. Optional `deniedDestinations` is an array of up to
32 IP or CIDR strings. An omitted or empty array renders no deny variable;
the runner still adds its fixed private, metadata and reserved-range denies.
CIDR prefix lengths use one or two decimal digits for IPv4 and one through
three for IPv6. CIDR decimal octets can have leading zeros; bare IPs use the
strict IP grammar. IPv6 zone IDs and dotted netmasks are invalid, matching the
Rust configuration parser.
The chart passes deployment-specific entries unchanged to the runtime.
Never deny the API origin's public addresses; uploads need that origin.

The renderer rejects secrets and unsupported fields in this group. The chart
rejects partial or disabled groups with build values, builds without GitHub,
and builds with `scaling.minReplicas` below two. Stable defaults remain two.
`maintenance.buildRetentionSeconds` is a checked-in chart setting, separate
from app-config JSON. It defaults to 2592000 and accepts 0–31536000.
Only prune receives it; maintenance never mounts an E2B key.

Follow [Build template](./build-template.md) before enabling or rotating builds.
With builds disabled, the chart mounts no E2B key and sets no API build values.
The API schedules nothing, starts no build worker and reports builds unavailable.
This path applies to every PR preview and any unprovisioned stable environment.

## Availability

The static site is implemented but has not been deployed.
All three workloads are enabled and require immutable image digests. App images
are built per environment; runtime JSON cannot change baked browser origins.
Local builds, tests and image smoke do not prove GKE, Cloudflare or credential
authorization. The first environment rollout and publish proof remain required.
