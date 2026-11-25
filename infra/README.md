# Infrastructure

Mokly Cloud's infrastructure targets GCP project `mokly-508518`: regional GKE
Autopilot, stable private Cloud SQL Postgres, namespace Postgres for PRs, GCS blobs, Secret Manager and GitHub
workload identity. Cloudflare owns DNS/TLS transport for the shared public
app/site origin, the public API, the internal app origin and isolated catalogue
origins. PR catalogue records are DNS-only and use cert-manager TLS. The
[architecture doc](../docs/architecture/cloud.md) places these components; this
guide covers the files under `infra/` and how to operate and check them.

The chart's optional GitHub App integration is explicit: disabled releases
render no GitHub settings; enabled releases combine three reviewed identifiers
from the environment's app-config JSON with three API-only CSI mounts. See
[Secrets](../docs/ops/secrets.md).

Billing follows the same explicit boundary for stable environments: app-config
JSON carries only `billing.enabled`; the API resolves catalogue prices by
lookup key, receives CSI-mounted `stripe-secret-key` and
`stripe-webhook-secret` values, and Terraform provides a billing-delivery
alert. PR releases cannot enable it. See
[Billing smoke](../docs/ops/billing-smoke.md).
Stable promotion reads a separate environment `stripe-catalogue-key` only when
billing is enabled, reconciles Stripe before rollout, and never mounts that key
into a workload.

Cloud builds use an explicit `builds.enabled` group beside GitHub in stable
app-config JSON. The API alone receives the E2B key through CSI. The chart
requires GitHub and at least two API replicas. PR releases and unprovisioned
stable releases keep builds disabled. Prune receives build retention in every
environment without a build credential. See
[Build template](../docs/ops/build-template.md) for publishing, verification,
foundation imports, enablement and rotation.

## Layout And Operation

- [Terraform](./terraform/README.md): state bootstrap; foundation and stable-environment
  roots; shared resource naming and modules for network, GKE, SQL, storage,
  DNS, shared app/API edge TLS, stable catalogue TLS, identity and secret IDs.
- [Origin router](../apps/worker/README.md): the `apps/worker` Cloudflare Worker,
  its Wrangler configuration and Workers test-pool suite.
- `docker/`: API/catalogue Rust images and the Node-served Expo single-page
  app. The images run as UID/GID 65532. Public app/API origins, the catalogue
  base domain and revision are baked into one build manifest.
  The image install sets `ELECTRON_SKIP_BINARY_DOWNLOAD=1` because it runs no
  Electron process. The static server uses the manifest for CSP, serves the export and assets at `/`, keeps
  `/_health` and `/_config` at the root, and marks every app document `noindex`.
- [Helm chart](./helm/mokly-cloud/README.md): `database.mode` selects stable
  Cloud SQL or namespace Postgres, migration/init behavior, identity, billing
  and publication maintenance, and ingress.
- `helm/platform/`: exact cert-manager and ingress-nginx values plus the
  catalogue DNS-01 `ClusterIssuer` template for the shared preview namespace.
- `scripts/`: pinned tools, local checks, image build/push, stable rollout,
  shared preview-platform installation/readiness, PR deploy/destroy/seed/link
  entrypoints, unprivileged catalogue capture, root-layout HTTP smoke, the
  foundation and environment Terraform wrappers, the Deploy wait for the
  Foundation run and the exact destructive-plan policy. Provider errors
  propagate; scripts never infer success from a failed command or fabricate
  missing secrets. The entry points are listed under [Key Code](#key-code).
- `helm/tests/`: checked-in golden renders and failing template cases.
- `e2b/build/`: credential-free build Dockerfile and versioned template definition.
  Its base image uses a tagged SHA-256 digest. The candidate assertion requires
  glibc 2.28 or newer. Toolchain and infrastructure
  tests reject a missing or malformed pin.
- `e2b/tests/`: candidate assertion; local regressions run with infrastructure contracts.
- `tests/`: smoke/cleanup contracts and real CLI-output provenance.

Rollout smoke receives `MKC_DESKTOP_CLIENT` from the same Helm environment
value as the API and catalogue server. It reads the desktop origin fixture
and checks exact frame ancestors plus credentialed CORS reads and
preflights. Infrastructure tests compare every environment with the real
catalogue server; they need Rust, Postgres and `psql`. See the
[smoke contract](../docs/protocol/cloud/deployment-smoke-checks.md).

Stable deployment [synchronizes Postmark templates](../docs/protocol/cloud/email-postmark-sync.md)
from the committed email files before each API rollout. The sync compares live
state on each run and sends method-specific create or edit fields when content
differs.

Read [Environments](../docs/ops/environment.md), [Deployment](../docs/ops/deploy.md),
[Previews](../docs/ops/preview.md), [Secrets](../docs/ops/secrets.md) and the
[infrastructure-promotion](../docs/protocol/cloud/infrastructure-promotion.md) and
[smoke](../docs/protocol/cloud/deployment-smoke-checks.md) contracts before applying.

## Development

Create credentials by hand before Terraform runs only when the setup needs
it, then import the cloud resources into Terraform state before the first
apply. Reconciliation test doubles reproduce the real output, identifiers,
warnings, and exit behaviour of the provider CLI.

```sh
bash infra/scripts/install-tools.sh
cargo xtask check --suite cloud-terraform
cargo xtask check --suite cloud-helm
cargo xtask check --suite cloud-infrastructure
cargo xtask check
```

The `cloud-infrastructure` suite also builds the workload images. Use
`cargo xtask check --suite cloud-origin-router` for the standalone Worker
typecheck and tests.

The domain-layout tests discover Expo's static root routes with the same rules
as the Rust reservation drift test: route groups are flattened, platform file
suffixes are removed, and layouts, dynamic roots and `+` special routes do not
become URL segments. Static directories count only when they contain a route.

Terraform initialization downloads the pinned providers; format, validation and
mock-provider tests need network access but no cloud identity. No mock plan is
called a deployment. Helm tests use `helm template` golden files rather than an
unversioned plugin. Regenerate intentionally with
`python3 infra/helm/tests/check.py --update`, then inspect every golden diff.
The preview-platform contract test pulls the two pinned charts into `.context/`
and renders those local archives; it reports an explicit skip if the first pull
cannot reach the chart repositories. Platform scripts also require OpenSSL for
the certificate checks and the system `libpsl` runtime for the ICANN/private
suffix validation, which finishes before any provider call. Run
`python3 infra/scripts/run-infrastructure-tests.py contracts` to replay the
preview lifecycle's recorded Cloudflare, gcloud, Helm, kubectl and API-log
fixtures and the workspace Mokly CLI's recorded capture output without cloud
credentials.

Build all three images with `bash infra/scripts/check-image.sh` after
installing and starting standalone BuildKit with `start-buildkit.sh`. The
launcher uses the pinned `buildkit-runc` and requires a layered snapshotter by
default; a machine deliberately provisioned with enough space for full parent
copies can set `MKC_BUILDKIT_REQUIRE_LAYERED=false`. On a startup failure it
prints the worker probe, the retained daemon log at `/tmp/mkc-buildkit.log`
and the filesystem capacity, and the image gate repeats the capacity
diagnostics around each image because earlier checks also consume the
runner filesystem. `check-image.sh` uses explicit nonproduction build origins;
`build-release.sh ENVIRONMENT...` requires `MKC_DOMAIN` and
`MKC_CATALOGUE_BASE_DOMAIN`, derives the public app and API origins from the
environment naming contract and builds the three product images for stable
and PR environments alike. When BuildKit is installed, the storage smoke also
requires `mkfs.ext4` from e2fsprogs, mount/umount and passwordless sudo; CI
installs the package explicitly.
The `cloud-infrastructure` suite runs these contracts, the storage smoke and
the three image builds. The other
[cloud suites](../docs/protocol/ci-verification.md#cloud-suites) run the
Terraform, Helm and origin-router checks. Required CI rejects a failed,
cancelled or skipped cloud job. Local `cargo xtask check` is the complete
gate, including the origin router.
With a disposable native Postgres database and Linux/passwordless sudo, run:

```sh
MKC_TEST_DATABASE_URL=postgres://postgres:postgres@localhost/mkc_test \
  python3 infra/scripts/smoke-images.py
```

The smoke executes product image filesystems in chroot as UID/GID 65532,
using real migrations, random signing material, private catalogue access and
app SPA/asset requests. It is a local runtime test, not OCI/GKE isolation
proof. `check-image.sh` builds the three archives and needs neither Postgres
nor cloud credentials. Neither local verification nor the image build requires
a Docker daemon.

Stable Cloud SQL grants and provider reconciliation are recorded in the
[production deployment record](../docs/ops/production.md) and main-preview
runbook. PR shared-platform readiness and certificate lifecycle are
credentialed integration checks outside the local gate. The chart requires all
three digests for a complete release. It schedules auth and build pruning,
dead-letter observation and daily GitHub record pruning in every environment,
and daily publication cleanup and garbage collection in production and main
preview. Successful publications keep their objects until their project or
workspace is deleted.

The Foundation workflow plans foundation with the read-only identity and applies
that exact saved plan with the dedicated foundation identity on every `main`
push and accepted dispatch; see
[foundation promotion](../docs/protocol/cloud/foundation-promotion.md). The Deploy
workflow waits for the Foundation run of its own commit before any credentialed
job. CI then deploys the shared Worker and preview platform, plans/applies each
exact saved stable-environment plan and rolls workloads. Protected-main pushes
and manual Deploy dispatches from `main` use the same promotion chain. The
Worker credential comes from Secret Manager only after the main-ref-bound GCP
OIDC exchange; the checked-in Deploy workflow contains no repository-scoped
provider credential. The dispatch's optional `reset` checkbox stops the stable
workloads, recreates `mokly` through the Cloud SQL Admin API under the dedicated
reset identity, migrates it from empty and restores catalogue grants in
main-preview (`br-main`) and, when enabled, production. It
preserves the Cloud SQL instances, blob objects, secrets and other
infrastructure. A foundation permission change, such as the Logging
notification-rule permissions required by log-based alerts, takes effect when
the Foundation run of its merge applies it; see the
[permission repair steps](../docs/ops/deploy.md#log-based-alert-permission-repair).
PR lifecycle needs no environment state. The preview workflow
creates namespace resources, catalogue DNS and the two conditional bucket IAM
bindings and smokes the deployment, then removes those PR resources on
unlabel/close; see [deployment](../docs/ops/deploy.md) for promotion
through main-preview and production. The Worker is mandatory for a configured
cloud deployment, and destructive stable actions require an exact committed
approval under the
[infrastructure-promotion contract](../docs/protocol/cloud/infrastructure-promotion.md).
Production promotion
requires repository variable `MKC_PRODUCTION_ENABLED=true` after its
infrastructure, ingress address and secrets are ready. A push or accepted
manual dispatch on `main` authorizes the infrastructure apply and rollout; CI
does not wait for a second production review.
Until then, the deployment check requires main-preview rollout and smoke success
and reports production promotion as disabled. Image builds
run in CI and locally when standalone BuildKit and crane are available.

The [preview contracts](../docs/protocol/cloud/pr-preview-environments.md) describe
the platform. Foundation owns the regional address, shared preview bucket, two
wildcard A records and four shared Secret Manager IDs, the preview password's
verifier among them. Deploy gains
`roles/storage.admin` only on that bucket and secretAccessor only on the named
preview IDs; PR Kubernetes identities get prefix conditions. The renderer,
Helm and Worker use `app-origin-pr-N.preview.D` for PRs. The stable
Terraform/rollout wrappers reject PR inputs. The main deploy runs
`preview-platform.sh` and `preview-platform-ready.sh` with the checked-in
platform values before planning main-preview; the installer inventories and
authorizes every cluster-scoped chart object before its idempotent upgrades.
`preview-deploy.sh` creates and validates generated Secrets and reconciles
DNS and IAM. It syncs the preview verifier before Helm and passes its rollout
marker to the chart. Helm replaces the API pod when the marker changes. The
deploy waits for TLS and runs smoke checks. `preview-destroy.sh` deletes the namespace before
external state. `preview-link.py` reads exact-address links from API logs.
The parallel, credential-free capture job checks out the
PR with full history and runs the PR's own `capture-catalogue.py`,
which installs the PR's locked packages, runs the PR's workspace Mokly
`mokly publish --strict` on the clean committed checkout, receives its upload
exchange on a loopback receiver, keeps the plan archive and every requested
blob in `.context/seed/catalogue`, and validates its branch, revision, pull
request and comparison envelope before artifact transfer. The workflow passes
`github.repository` through `--repository`. Capture uses that identity for
both publish and envelope validation. Local startup runs
`scripts/cloud/dev-publication-env.sh`, which ensures `.context` exists with mode
0700 before it checks for an exported `MKC_CATALOGUE_SIGNING_KEY`; a fresh
checkout therefore works with either an existing or a generated signing key.

After deploy evidence, the trusted `release` job runs `preview-seed-job.py`
from `main`. The script writes the seed request to the run's seed folder in
the PR's bucket prefix. When capture succeeded, it also copies the captured
plan and blobs there unopened. It then runs the PR's API image as a Job from
the chart's suspended `preview-seed` CronJob. It prints the Job's log and
collects the seed status and proof.
[Preview seed Job](../docs/protocol/cloud/preview-seed-job.md) defines the steps,
the cleanup and the failure messages.

An installed local checkout can capture and seed its own private sample
project. `scripts/cloud/dev-api.sh preview-seed` stages the captured catalogue in
the local store and runs the API's seed command. The
[workspace README](../docs/development/cloud.md#local-preview-stack) gives the commands. The
[runbook](../docs/ops/preview.md) covers the preview password, sign-in links,
the PR comment, evidence, costs and cleanup.

### Key Code

- `toolchains.json` — the pinned versions of Terraform, Helm, BuildKit, crane, gcloud, the cert-manager and ingress-nginx charts and the Postgres image digest that every script and chart reads.
- `docker/mkc-api.Dockerfile`, `docker/mkc-catalogue-server.Dockerfile` and `docker/app.Dockerfile` — the three workload images. The `MKC_BUILD_SHA` build argument bakes the revision. `docker/entrypoint.sh` and `docker/catalogue-entrypoint.sh` load mounted secrets before they exec the binary. The API entrypoint accepts a mounted preview verifier with the `$scrypt$` prefix and warns when it ignores another format.
- `docker/app-server.mjs` and `docker/app-build-config.mjs` — the Node server for the Expo export, which asserts the baked origins, serves `/`, `/_health` and `/_config`, marks every document `noindex` and sends the Content Security Policy whose catalogue sources come from the `MKC_CATALOGUE_BASE_DOMAIN` that the build configuration records beside the baked origins.
- `e2b/build/e2b.Dockerfile` and `e2b/build/e2b.toml` — the credential-free cloud build sandbox image and its versioned template definition.
- [e2b/build/build-template.mjs](./e2b/build/build-template.mjs) — the operator script that builds one template release through the E2B SDK with the team key and writes its local `e2b.toml`.
- `e2b/tests/assert_build_template.py` — the candidate assertion that checks a fresh build template through the workload's streaming-process boundary.
- `scripts/environment.sh` — the stable environment names: the namespace, hosts and Terraform variables of `production` and `main-preview`.
- `scripts/render-values.py` — validates release inputs and writes the nonsecret Helm values; `--origins` and `--domain-layout` print the derived hosts.
- `scripts/build_values.py` — validates the nonsecret cloud build group before `render-values.py` writes it into the release values.
- `scripts/rollout.sh` — the stable Helm rollout and smoke; `RESET_RELEASE=true` stops the workloads, recreates the database under the reset identity and migrates it from empty before the release.
- `scripts/terraform-environment.sh`, `scripts/terraform-foundation.sh` and `scripts/terraform-root.sh` — the stable-environment and foundation plan, check and apply wrappers, and the shared body that both source.
- `scripts/terraform-plan-policy.py`, `scripts/terraform_plan_roots.py` and `scripts/terraform_approval_format.py` — the destructive-action policy whose `approval` command generates the committed document, the Terraform roots and foundation trust set that it checks, and the module that formats the generated approval JSON for the repository's Prettier check.
- `scripts/foundation-gate.py` — the Deploy wait for the Foundation run of the same commit.
- `scripts/smoke.py` — the post-rollout HTTP checks and their redacted JSON report.
- `scripts/check-image.sh`, `scripts/build-release.sh`, `scripts/push-images.sh` and `scripts/smoke-images.py` — the local image gate, the release image builds, the push that writes the image references, and the chroot image smoke.
- `scripts/start-buildkit.sh` and `scripts/report-buildkit-capacity.sh` — the standalone BuildKit launcher and its capacity diagnostics.
- `scripts/deploy-origin-router.sh` — reads the Worker token from Secret Manager into a private file and runs Wrangler.
- `scripts/credential-gate.sh` — decides whether a workflow's cloud identity and preview configuration are complete, partial or wholly absent.
- `scripts/preview-platform.sh`, `scripts/preview-platform-ready.sh` and `scripts/preview-platform-common.sh` — the shared platform installer, the read-only readiness gate and their shared shell helpers. The helpers hold the one origin certificate validator that installation and readiness use.
- `scripts/preview-platform-helper.py` — validates the platform inputs, reads the Cloudflare CIDR list from the workload chart, inventories the rendered cluster-scoped objects and checks the Origin CA SANs. Its `tls-secret` command decodes the cluster TLS Secret into private files for the shared validator.
- `helm/platform/cert-manager-values.yaml`, `helm/platform/ingress-nginx-values.yaml` and `helm/platform/cluster-issuer.yaml` — the static platform chart values and the issuer template with its one catalogue-domain placeholder.
- `scripts/preview-common.sh`, `scripts/preview-deploy.sh` and `scripts/preview-destroy.sh` — the PR shell helpers for generated Secrets, the DNS token and the preview verifier, and the deploy and cleanup entry points.
- `scripts/preview-lifecycle.py` — namespace Secret validation and cloud lifecycle commands. `preview-verifier` generates the verifier. `prepare-preview-secret` validates it, stages changes to the namespace Secret and prints the rollout marker. `preview_lifecycle_core.py` holds `preview_parts()` and `PreviewInputError`. `preview_lifecycle_cloud.py` updates and deletes the Cloudflare record. `preview_lifecycle_gcp.py` manages conditional bucket IAM with etag retries and removes objects in batches.
- `scripts/preview-link.py` and `scripts/preview_link_sources.py` — the sign-in log reader and its kubectl pod-log source.
- `scripts/capture-catalogue.py` — the unprivileged catalogue capture; `catalogue_capture_endpoint.py` is the loopback receiver, `catalogue_capture_plan.py` the gzip framing check and bounded plan reader, and `catalogue_capture_state.py` the exchange state.
- `scripts/record-catalogue-capture.py` — rebuilds the isolated smoke fixture and records the real workspace CLI outcomes. Its `--check` mode compares raw streams while reading variable paths and timing values separately. `catalogue_recording_cases.py` owns the real receiver cases, and `catalogue_recording_streams.py` owns the comparison.
- `scripts/preview-seed-job.py` — the trusted PR seed runner and its `--validate-evidence` check, which reuses the evidence validation in `preview_seed_types.py`. `preview_seed_job_run.py` creates the Job from the `preview-seed` CronJob, waits for it, and runs the log, collection and cleanup steps after any outcome. `preview_seed_job_storage.py` stages the request and the unopened catalogue, downloads the status and the proof, and removes earlier runs. `preview_seed_job_cluster.py` validates the common inputs and selects the cluster with the preview shell helpers.
- `scripts/preview_seed_types.py` — the shared preview settings, JSON reader and atomic writer, and seed evidence validation.
- `scripts/preview-comment.py` and `scripts/preview-event.py` — the credential-free PR comment renderer and the pure event policy.
- [`../scripts/cloud/site/cleanup.sh`](../scripts/cloud/site/cleanup.sh) — the site workflow's Pages cleanup: lists every deployment page, deletes only the closed pull request's `pr-<number>` deployments, and reports every failure as retained.
- [scripts/sync-postmark-templates.mjs](./scripts/sync-postmark-templates.mjs) and `scripts/sync-postmark-environment.sh` — the trusted deploy job that reads each managed Postmark alias, validates and creates or updates a changed template, and verifies the read-back, and the shell wrapper that runs it for one stable environment.
- `scripts/install-tools.sh`, `scripts/install-build-tools.sh`, `scripts/check-terraform.sh` and `scripts/run-infrastructure-tests.py` — the pinned tool installers, the Terraform format, validate and test runner, and the Python test partition runner.
- `helm/tests/check.py` — the Helm lint, golden renders and rejected-input cases.
- `tests/fixtures/README.md` — the provenance of every recorded CLI output that the contract tests replay.

### Related Docs

- [Architecture](../docs/architecture/cloud.md)
- [Deployment smoke checks](../docs/protocol/cloud/deployment-smoke-checks.md)
- [Infrastructure promotion](../docs/protocol/cloud/infrastructure-promotion.md)
- [Foundation promotion](../docs/protocol/cloud/foundation-promotion.md) and [Foundation apply](../docs/ops/foundation.md)
- [Origin router](../docs/protocol/cloud/origin-router.md)
- [PR preview environments](../docs/protocol/cloud/pr-preview-environments.md), [Preview platform](../docs/protocol/cloud/preview-platform.md), [Preview script interfaces](../docs/protocol/cloud/preview-scripts.md), [Preview seed](../docs/protocol/cloud/preview-seed.md), [Preview seed Job](../docs/protocol/cloud/preview-seed-job.md) and [Preview catalogue capture](../docs/protocol/cloud/preview-capture.md)
- [Postmark template synchronization](../docs/protocol/cloud/email-postmark-sync.md)
- [Cloud build runner](../docs/protocol/cloud/cloud-build-runner.md) and [Build template](../docs/ops/build-template.md)
- [Environments](../docs/ops/environment.md), [Deployment](../docs/ops/deploy.md), [Previews](../docs/ops/preview.md), [Secrets](../docs/ops/secrets.md) and [Production](../docs/ops/production.md)
