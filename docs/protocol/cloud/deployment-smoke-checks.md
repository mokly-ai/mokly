# Deployment Smoke Checks

Every complete rollout runs `python3 infra/scripts/smoke.py`. It uses real HTTPS
origins, verifies server certificates and does not follow redirects. Every
request sends `User-Agent: mkc-smoke`: Cloudflare Pages rejects the default
Python `urllib` signature with error 1010 regardless of zone settings, so the
production site check cannot pass with an anonymous client. Inputs:
`MKC_APP_ORIGIN`, `MKC_API_ORIGIN`, `MKC_CATALOGUE_DOMAIN`, `MKC_REVISION`,
`MKC_DESKTOP_CLIENT` (explicitly `true` or `false`), and
optional `MKC_SMOKE_REPORT` (default `.context/deployment-smoke.json`) and
`MKC_SMOKE_TIMEOUT_SECONDS` (integer 1–900, default 60). Origins
must have no path/query/credentials and the revision must be a full Git SHA.
The deployed app layout is fixed at the origin root, so there is no app-base-path
input: smoke always checks `/sign-in`, a root-relative boot asset and, for a
preview, the app document at `/`.
The rollout derives them from the environment table below; callers cannot
override the naming rule. No production switch disables a check. A partial
chart with disabled workloads cannot count as a successful environment
deployment.

`render-values.py` resolves `desktopClient` from the checked-in Helm
environment overlay. Its release values and `--origins` output carry the
same flag that renders `MKC_DESKTOP_CLIENT` in both services. Stable and PR
rollout wrappers export that resolved value to smoke; an inherited shell
value cannot override it. Reviewed release values with a missing or
mismatched `desktopClient` fail before rollout. Standalone smoke requires
the explicit flag and fails before network requests if it is absent or
invalid. The desktop origin comes from `fixtures/desktop-origin.json`.

| Environment  | `MKC_APP_ORIGIN`            | `MKC_API_ORIGIN`                | Internal app host           | `MKC_CATALOGUE_DOMAIN` |
| ------------ | --------------------------- | ------------------------------- | --------------------------- | ---------------------- |
| production   | `https://D`                 | `https://api.D`                 | `app-origin.D`              | `C`                    |
| main-preview | `https://br-main.preview.D` | `https://br-main.preview.api.D` | `app-origin-main-preview.D` | `br-main.preview.C`    |
| preview-pr-N | `https://pr-N.preview.D`    | `https://pr-N.preview.api.D`    | `app-origin-pr-N.preview.D` | `pr-N.preview.C`       |

The [environment inventory](../../ops/environment.md#dns-certificates-and-worker)
records which state owns each host's DNS record and certificate.

## Stable Promotion

Every configured stable release deploys and smokes main-preview. Production
promotion starts only when the repository variable `MKC_PRODUCTION_ENABLED`
is exactly `true` and main-preview reports a completed rollout. An unset or
`false` value leaves both production jobs skipped; the required deployment
check reports that production promotion is disabled. Any other value fails
before image builds or deployment start, and fails the required check. Skipping
production never counts as a production deployment.

When enabled, production still requires its published infrastructure plan,
successful exact-plan apply, exact release values and successful smoke. A
protected `main` push or manual Deploy dispatch at `refs/heads/main` authorizes
both stable-environment applies and releases; the workflow does not wait for a
separate approval. Main-preview follows the same plan/apply/rollout order before
production planning begins. A manual dispatch with `reset: true` stops and later
starts all three workloads around a destructive database recreation in
main-preview and, when enabled, production. It migrates each empty database and
restores catalogue grants before the workloads start. The flag never skips or
weakens a smoke check; it deletes database rows while retaining blob objects and
infrastructure.
The required check rejects failed, cancelled or unexpectedly skipped jobs and
requires the `preview-platform` readiness job after `origin-router` and before
`plan-main-preview`, plus the rollout completion output for every enabled environment. Missing
origin-Worker configuration blocks the plan whenever cloud deployment is
configured. Destructive infrastructure actions additionally require the exact
committed declaration defined by
[Infrastructure promotion](./infrastructure-promotion.md). Missing
ingress configuration must identify the requested environment and the
`MKC_INGRESS_IPS` / `MKC_INGRESS_IP` inputs; it must never reuse another
environment's address. See [Deployment](../../ops/deploy.md) for activation.

## PR Platform Gate And Evidence

A PR deploy first requires the shared platform readiness gate of
[Preview platform](./preview-platform.md). A failure names `deploy.yml`'s
`preview-platform` job and blocks deployment; the preview workflow cannot
repair or install the shared platform. After the release, the PR's catalogue
Certificate must be ready before HTTPS smoke.

A PR deploy is complete when smoke succeeds and
`.context/deployment-smoke.json` is nonempty. The workflow retains that report
in `preview-evidence-pr-N` for 14 days, including a failed run's report when
one was written. The **Require deploy evidence** step checks only that smoke
report. The release job then runs the [preview seed](./preview-seed-job.md)
Job even when catalogue capture failed; its separate status and any proof join
the retained evidence. The required aggregate evaluates capture and seed
outcomes separately from deploy evidence. Capture or seed failure fails the
aggregate but never invokes rollback, and the PR comment follows the seed's
outcome/link table.
Only deployment failure invokes Helm rollback. Browser tests run in CI against
a local stack, never in a PR namespace.

## Exact Checks

| Check                    | Request and acceptance                                                                                                                                                                                                                 | Failure meaning                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| API reachability         | `GET <api>/v1/health`; status 200, JSON, `status: "ok"`, `Cache-Control: no-store`                                                                                                                                                     | API routing, process, database or migration readiness failed                           |
| API version              | Same body: nonempty `version`, `revision` exactly the intended 40-character commit                                                                                                                                                     | An old image, wrong origin or wrong build reached the ingress                          |
| Migration state          | Same body: `migrations: "current"`; measured against the live database at startup and on five-second cache expiry                                                                                                                      | Job/startup migrations have not completed or database cannot be read                   |
| API CORS                 | `GET` and `OPTIONS <api>/v1/health` with app, desktop and untrusted Origins; exact admission policy below                                                                                                                              | API admission differs from the Helm flag or the credentialed browser contract          |
| App served               | `GET <app>/sign-in`; status 200, app HTML with a root-relative script or stylesheet; fetch the asset and require 200 plus `immutable` when hashed; preview responses carry `X-Robots-Tag: noindex`                                     | Worker mapping, app service, export mount or browser boot asset is broken              |
| Preview root             | On main-preview and PR previews, `GET <app>/`; status 200 with the app document, `X-Robots-Tag: noindex`, and no redirect                                                                                                              | The Worker sent preview root to Pages or lost its preview indexing boundary            |
| Production site          | In production, `GET <app>/docs/`; status 200 with the site document and no redirect                                                                                                                                                    | The site route set or Pages pass-through is broken                                     |
| Wildcard DNS             | Resolve `smoke-<revision first 12>.catalogue-domain` with the system resolver                                                                                                                                                          | Wildcard DNS or propagation is missing                                                 |
| Catalogue isolation      | `GET https://smoke-<revision first 12>.catalogue-domain/`, header `Origin: <app>`; 404                                                                                                                                                 | Unknown publication routed to app/API or catalogue incorrectly returned content        |
| Catalogue headers        | Same 404: `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`, exact `frame-ancestors` policy below; no `Set-Cookie`                                                                                                          | Sandbox/cache contract is missing or host isolation leaked credentials                 |
| Catalogue CORS           | `GET` and `OPTIONS` on the reserved catalogue URL with app, desktop and untrusted Origins; exact admission policy below                                                                                                                | Catalogue admission differs from the Helm flag or the credentialed browser contract    |
| Billing webhook unsigned | `POST <api>/v1/billing/webhooks` with a small JSON body and no `Stripe-Signature`; a configured environment returns 400 JSON with `error.reason: "validation-failed"`; an unconfigured environment returns 503 `operation-unavailable` | Missing-signature validation or the configured/unconfigured billing boundary regressed |
| Billing webhook forged   | Same POST with current `t` and 64 zero hex characters as `v1`; a configured environment returns 401 JSON with `error.reason: "webhook-signature-invalid"`; an unconfigured environment returns 503 `operation-unavailable`             | Signature verification or the configured/unconfigured billing boundary regressed       |

The preview-root check is selected by the derived preview origin; it is not a
caller-controlled skip. Production runs the site check instead. Both requests
traverse the origin router that the [architecture doc](../../architecture/cloud.md)
places in front of the public origin.

The reserved `smoke-` label is not a publication ID and is never allocated to
one. Checking an unknown publication exercises wildcard routing
without retaining synthetic product data. It does not replace the first real
publish proof in [Deploy](../../ops/deploy.md). Security headers apply to catalogue
error responses as well as successful publication files. Additional CSP
directives are allowed; the `frame-ancestors` value must be exactly `'self'`
plus the app origin and, only when `MKC_DESKTOP_CLIENT=true`, the desktop
origin. No wildcard, duplicate directive, duplicate ancestor or extra origin
is allowed. A mismatch names `MKC_DESKTOP_CLIENT` and the expected and actual
ancestors. Self allows a standalone
publication shell to frame documents from its own publication host; it does
not match another publication subdomain. App and API hosts must differ, and
neither may sit below the catalogue domain.

Both services must echo the app Origin with
`Access-Control-Allow-Credentials: true` and `Vary: Origin`. They must echo
the desktop Origin under the same rule only when the flag is `true`.
`https://smoke-untrusted.invalid` must receive no allow-origin grant. The
same checks apply to preflights, which request `POST` and `content-type`;
admitted preflights must allow both. A CORS mismatch names the service,
method, Origin and flag. Reads must retain their normal status (200 for
API health, 404 for the reserved catalogue host); preflights return 200.

The API health route is public, has no authentication side effects and sets no
cookie. It returns only process/build and migration-readiness data; no connection
strings, provider details or credentials. The revision is embedded in the image
at build time and never supplied at runtime; local builds report
`development`. A database error returns the existing typed
500 `internal-error`; pending migrations return 503 `unavailable` with reason
`migrations-pending`. Stable environments rate-limit public health requests to
300 per minute per source IP, where Cloudflare edge IPs share the budget;
excess requests return 429. Liveness uses a TCP probe so a database outage does
not create restart loops. PR previews have no health rate limit; API
authentication rate limits still use the verified two-hop client IP.

## Timing And Reports

Each request has a 10-second timeout. The runner retries the complete check at
five-second intervals within a monotonic time budget. The rollout wrapper selects
900 seconds when no deployed Helm revision exists, allowing first stable GCE
routing or PR DNS propagation to settle; upgrades and standalone smoke default to 60 seconds.
The upgrade budget assumes the ingress hostnames and origin certificate are
unchanged; an upgrade that changes either without staging them first rolls
back, as the [deployment runbook](../../ops/deploy.md#images-migration-and-rollout)
describes.
An attempt already running may finish after the budget, bounded by its request
timeouts. No new attempt starts after the deadline. Deployment jobs allow time
for both Helm's 15-minute limit and first-install smoke (PR certificate readiness has its own prior 900s wait). DNS,
TLS, HTTP, malformed JSON and mismatched fields all fail. After the last
attempt it writes a JSON result with revision, UTC time, per-check results and
the final diagnostic, then exits 1. Success writes the same evidence and exits 0. Response bodies and credentials are not recorded. Workflow logs name each
check and result. Helm has its own bounded migration/rollout timeout before
HTTP smoke begins; a timeout is never a skip.

Smoke failure fails deployment and its unconditional aggregate. The rollout
wrapper restores the previous Helm revision if one exists; no automatic
database downgrade is attempted. First deployment failure remains failed with
diagnostic resources available. Operator recovery is in the deployment runbook.

## Cloud Build Readiness

Build-enabled stable releases require at least two ready API replicas and an
API HPA minimum of two or greater. Their complete GitHub and build groups must
be present, and only the API mounts `e2b-api-key`. Migration, maintenance,
catalogue and app mount no E2B key. The prune workload receives
`MKC_BUILD_RETENTION_SECONDS` even when builds are disabled.

The public health response and automated smoke remain provider-independent.
They do not claim E2B readiness. A configured project reports build
availability from configuration and repository access; a provider outage does
not change that predicate. First enablement and template/key rotations require
the credentialed proof in [Build template](../../ops/build-template.md): the
candidate assertion through `stream_process` with one added environment entry,
then a real build reaching a ready publication, completed check and sandbox
cleanup. Record that evidence separately from deployment-smoke JSON.

Unprovisioned stable releases and every PR preview omit all API build values
and the E2B mount. The API schedules nothing and runs no build worker. A member
read of an installation-linked project reports `buildsAvailable: false`; a
build request receives `builds-unavailable`. CI publication remains available.
Helm and renderer tests prove PR enablement fails before deployment.

## Verification Boundary

Local verification exercises the real HTTP client against local servers and
runs the Terraform and Helm checks without cloud credentials; it does not claim
to exercise public DNS, Cloudflare, GKE or TLS issuance. Only a rollout's smoke
proves them. PR preview environments run with billing disabled; only the
workspaces that the preview account creates start on Team.
