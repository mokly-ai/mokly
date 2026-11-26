# mkc-api

The Mokly Cloud platform REST API: the `mkc-api` binary and the application
factory behind it. The crate is the composition root of the platform. It wires
the services (`mkc-auth`, `mkc-publications`, `mkc-billing` and the platform,
GitHub, build and viewer services defined here) to the adapters
(`mkc-store-pg`, `mkc-email-postmark`, `mkc-github`, `mkc-billing-stripe`,
`mkc-build-sandbox` and the file stores), serves every `/v1` operation, maps
every outcome to HTTP, and runs the GitHub delivery, check delivery, build,
billing delivery and seat workers in the same process. Use the binary for
local development and deployments, or `ApplicationFactory` to embed the server
in a test. It serves no app pages and no publication HTML;
`mkc-catalogue-server` is the catalogue origin.

## Responsibilities

Serve authenticated accounts, preview sign-in, workspaces, invitations,
projects, grants, billing, publishing tokens, GitHub App integration,
publication uploads, viewer reads and cloud builds; deliver Changes checks;
and derive the OpenAPI document from the Rust boundary types.

## What This Crate Does

`preview-seed --run <run>` seeds one preview run through the authentication
service, platform actions and publication ingest. It loads the serving
settings and requires configured preview sign-in before any write. It reads
the captured catalogue from the run's seed folder. It reads envelope 3 and
seeds `mokly.config.json`. It always attempts token
revocation after token creation. After a valid request, it writes the final
status after success or failure. It writes proof only after publication
validation and revocation.
It starts no HTTP server or background worker. The
[preview seed contract](../../docs/protocol/cloud/preview-seed.md) defines the run
request, identities and exact result schemas.

Rust owns the API boundary types. `utoipa` derives the
[OpenAPI document](../../docs/api/openapi.json) from those types and the
operation contracts, and the Axum routes are built from the document's
methods, paths and operation IDs. Every documented operation has a route. A
deferred operation, and an optional operation (preview sign-in, GitHub,
billing) whose runtime configuration is incomplete, returns
`operation-unavailable` from the dispatcher before Origin, CSRF or body
validation. Synchronous services and Diesel queries run on the blocking pool.
`ApiError` is the one translation of authentication, platform policy, store,
upload, GitHub, build and billing outcomes into the pinned `rpc-error`
envelope; the reason catalogue in [REST API](../../docs/protocol/cloud/rest-api.md)
is the contract. Client failures (4xx) log at warn and internal or unavailable
failures (5xx) at error, each correlated with the echoed `X-Request-ID`.

The platform service runs each command in one transaction and executes its
recorded effects, such as the invitation mail, after the commit. Workspace
and project create and full-update commands take typed slugs; a conflict
returns `slug-taken`, or the workspace-only `slug-reserved`, with a safe
suggestion, and current and retired slug lookups resolve the stable UUID
before the ordinary authorization policy runs. Entitlements are
transactional: Free projects are created public and Team projects private, a
Free private transition is refused with `plan-required`, and a private upload
refusal maps to `upload-plan-required`. Project responses carry the current
workspace slug and `publishingAllowed`. Project creation and the project
slug suggestion require a repository-relative config path that ends in
`.json`. The API supplies no default. The slug suggestion removes the final
`.json` from the config filename when it needs the config stem.

Email, desktop grant and GitHub authentication persist the domain-validated `returnTo`
through issue and exchange; a rejected destination resolves to `/dashboard`.
`POST /v1/auth/preview` exists only when both preview sign-in settings
validate and returns the ordinary session payload and cookie. Optional
`MKC_PREVIEW_SIGN_IN_PLAN` accepts `free` (the absent default) or `team` under
the same pair and capability. Workspace creation compares the creator's
normalized email read in its own transaction with the configured preview
email. A match uses the configured initial plan; all other workspaces
start on Free. Existing plans do not change. Team defaults projects to private
and permits private uploads, without a subscription or a change to seat
counting. Unconfigured billing still shows “Billing opens soon”.

`MKC_DESKTOP_CLIENT=true` admits `mokly-app://desktop` beside the public app
origin for public authentication and authenticated mutations. Both origins
receive credentialed CORS with an exact echo and `Vary: Origin`. Every other
origin receives no CORS grant. Every admitted Origin receives the ordinary
email link on the public app origin. Desktop grant, magic-link, preview and
GitHub exchanges, session rotation and
sign-out choose `SameSite=None` for the admitted desktop request and `Lax`
for the app request. All other cookie attributes stay the same. The flag
defaults to `false`; `scripts/cloud/dev-api.sh` defaults it to `true`. Public share,
billing, GitHub and viewer addresses still use the configured public app
origin. The `desktop_origin_tests` integration suite checks both flag states
against the running binary, Postgres and log mailer. It also checks that an
invalid desktop grant returns `desktop-grant-invalid` with the desktop CORS echo.

The optional GitHub integration adds PKCE sign-in, installation linking and
listing, repository listing and signed webhook acceptance; the durable
delivery worker runs in the API process and coordinates across replicas
through fenced Postgres leases. A connection or installation keeps the
session's Mokly account even when GitHub's verified primary email differs,
and Enterprise and Bot owners are rejected with `permission-denied`. A workspace
can bind several installations. Candidate starts record an installation ID and
return OAuth authorization; the callback proves administration before binding
or refreshing it. An installation bound elsewhere returns
`github-installation-conflict`. Installation lists include suspended bindings
and accept a member-authorized `workspaceId` filter. Workspace reads summarize
all bindings through `githubInstallationState`. Account names and manage URLs
come from installation lists.
`SystemGitHubProviderFactory` uses the configured GitHub origins, which are
GitHub's own unless `MKC_ENV=development` sets `MKC_GITHUB_API_ORIGIN` and
`MKC_GITHUB_WEB_ORIGIN` together. Creating a project takes exactly one of
`repositoryId` and `repository`. The first resolves an active installed
repository in the workspace and keeps its provider spelling and link. The
second stores a canonical CLI identity from any Git host, with no repository
link and Automatic builds off.

The configured API also runs a trait-backed check loop every five seconds. Each
iteration processes at most 100 rows in each publication/build delivery and
rerequest batch.
Each event gets its own five-minute claim immediately before delivery. Claims
and outcome writes use the retry version to coordinate API replicas and recover
after a process stops. Provider requests run outside the claim transaction.
`mkc-publications` owns delivery, installation access and create recovery; the
API supplies the shared provider, storage and clock. Each batch continues after
another batch fails. Without GitHub configuration, the API starts no check delivery.

Optional cloud builds require the complete group in
[runner configuration](../../docs/protocol/cloud/cloud-build-runner.md#configuration).
Only this crate constructs `sandbox-e2b`: fixed HTTPS API, backend `e2b`,
public-egress `build` profile with the runner's deny rules and idle timeout 60.
`ConfiguredApplicationFactory` accepts a `BuildProviderFactory` for server
tests. Every replica claims attempts at a two-second idle interval, runs them
within its process limit and reconciles sandbox inventory every five minutes.
Postgres claims, leases and outcome fences coordinate replicas. With the group
absent, webhooks schedule no builds and no build worker runs.
Signed default-branch pushes and eligible PR actions schedule in the same
transaction as their stored observations. Webhook, request and setup triggers
share a guarded head-recording step. They capture time before the provider read
and schedule from the stored reference; duplicate refusals name that head.
The build REST API reads member-only
builds and log windows, combined publication/build history, and requests or
cancels builds. Project creation schedules the repository's default
branch after the project commits; provider failure leaves creation successful.
Project responses expose build availability and request capabilities.
Automatic builds updates preserve the stored value when the field is absent. Build-token uploads use the publication exchange.
Build failure views expose the 0.18.0 runner causes. Unrecognized CLI codes
use `exit` and keep the publish exit code when available.

Optional billing verifies both catalogue prices once at startup; when a price
fails verification the API keeps serving but refuses Checkout, omits the
unverified amount and starts no seat writer. Billing reads are available to
owners and admins, Checkout and the Customer Portal are owner-only, and the
webhook stores the verified bytes before it returns 202. Workspace
deletion cancels a live subscription before its transaction.

The publication upload exchange (plan, blob and completion), one-use
catalogue access grants and the six viewer reads are implemented over
`mkc-publications`: a failed attempt exposes its typed failure code, an
expired exact read returns 404, a share URL carries a validated
`catalogueScreen`, and an unsupported upload version returns HTTP 426 with the
message `Update Mokly to 0.18.0 and publish again.` PR rows also carry required
boolean `fork`, from the shared domain repository rule. Foreign or missing
head/base IDs make it true. All authorized readers receive this fact,
independently of role, plan and build availability. Build upload grants
authorize the plan, blob and completion routes. Each request checks
persistent grant and build state before reading bytes. The API records only
answered outcomes, with atomic ranking across replicas and parallel blobs.
Publication receipts and viewer reads include nullable `buildId`; app screens
use their existing behavior. `GET /v1/health` is public, sets
`Cache-Control: no-store`, never issues a session, and returns the Cargo
version, the build revision and live migration readiness; pending migrations
return 503 `migrations-pending`.

`ApplicationFactory::create` returns an `Application` with two entry points.
The `serve` command uses `Application::serve`, which binds the `bind` setting.
`Application::serve_on` serves a `tokio::net::TcpListener` that the caller
already bound, in place of the `bind` setting. An embedding caller can bind
port 0 and write the bound address into the `api_origin` setting. No other
socket can then take the port before the API serves. Both entry points serve
the same routes, run the same workers and stop in the same way.

## Quick Start

```sh
scripts/cloud/dev-api.sh        # exports the local defaults below, then runs serve
scripts/cloud/dev-catalogue.sh  # the catalogue origin, in a second terminal
cargo run -p mkc-api -- --help
cargo run -p mkc-api -- migrate
cargo run -p mkc-api -- preview-seed --run local
cargo run -p mkc-api -- openapi
cargo xtask openapi
cargo xtask openapi --check
```

The binary has twelve commands. `serve` applies pending migrations and listens
on `MKC_BIND`. `migrate` applies them and exits. `openapi` prints the complete
OpenAPI 3.1 document as pretty JSON with a trailing newline; it needs no
serving configuration and writes no log lines. `prune` deletes retained
expired authentication records in bounded batches and logs the committed
counts; one more transaction then removes up to 1,000 finished builds after
`MKC_BUILD_RETENTION_SECONDS` (default thirty days). `prune-github` deletes
OAuth flow hashes after `MKC_GITHUB_OAUTH_RETENTION_SECONDS` (default one day
after expiry) and terminal webhook deliveries after
`MKC_GITHUB_DELIVERY_RETENTION_SECONDS` (default 30 days after receipt), and
logs both counts. `maintain-publications` recovers abandoned uploads, prunes
old failed attempts, removes expired catalogue grants and collects
unreferenced objects. It keeps every ready publication and logs abandoned,
pruned, blob and orphan counts.
`publication-check-status` counts the publication and build check dead
letters and `billing-delivery-status` the failed billing deliveries.
`requeue-publication-check --event <event-uuid>`,
`requeue-build-check --build <uuid>` and
`requeue-billing-delivery --event <evt_…>` make one dead letter due again
without contacting the provider. `maintain-publications` also needs the
file-store settings; the other maintenance commands need database settings
only. No maintenance command loads mail, GitHub or catalogue-signing
credentials; see [Maintenance](../../docs/ops/maintenance.md) and
[Check recovery](../../docs/ops/check-recovery.md). Every command exits
nonzero on failure and never prints a secret.

Before `preview-seed`, stage `request.json`, `catalogue/plan.tar.gz` and the
catalogue blobs under `seed/<run>/` in the configured store. Use `local`
for a local run. Set the preview sign-in email, secret and plan as below.
Read `seed-status.json` and `seed-proof.json` in that folder for the result.
The command retries failed seed-folder requests for up to two minutes.

`cargo xtask openapi` writes `docs/api/openapi.json` and regenerates the app's
`packages/app/src/api/generated/schema.ts`. Commit both outputs. Never hand-edit
them. The `--check` mode compares regenerated bytes without rewriting either
file. The [API contract guide](../../docs/api/README.md) records the generator
pins and validation commands.

A local API needs Postgres 16 (the root `docker-compose.yml` or a native
instance) and these settings, which `scripts/cloud/dev-api.sh` exports with local
defaults:

- `MKC_ENV=development`, which allows the log mailer, loopback HTTP origins and preview sign-in.
- `MKC_DATABASE_URL`, `MKC_BIND`, `MKC_APP_ORIGIN` and `MKC_API_ORIGIN`, this API's own public origin, on which upload plans build their blob and completion URLs.
- `MKC_MAILER=log`; `postmark` needs `POSTMARK_FROM`, `POSTMARK_SERVER_TOKEN` and `MKC_SITE_ORIGIN`.
- `MKC_CATALOGUE_ORIGIN`, `MKC_CATALOGUE_SIGNING_KEY`, `MKC_FILE_STORE=local` and `MKC_FILE_STORE_ROOT`; the two launch scripts share the key in `.context/catalogue-signing-key` and the blob root in `.context/blobs`. Reset that directory and the development database together, because durability markers in one refer to objects in the other.
- `MKC_PREVIEW_SIGN_IN_SECRET` and `MKC_PREVIEW_SIGN_IN_EMAIL`, which the script generates for the shared preview sign-in link, and `MKC_PREVIEW_SIGN_IN_PLAN=team`.
- `MKC_DESKTOP_CLIENT=true`, which admits the desktop shell's `mokly-app://desktop` origin.
- Optional: the six `MKC_GITHUB_*` settings for the GitHub App, with `MKC_GITHUB_API_ORIGIN` and `MKC_GITHUB_WEB_ORIGIN` together pointing it at [`mkc-github-double`](../mkc-github-double/README.md) in development, `MKC_BILLING=stripe` with the Stripe secrets for billing, and the cloud build group in [runner configuration](../../docs/protocol/cloud/cloud-build-runner.md#configuration).

[Environments](../../docs/ops/environment.md) owns the complete inventory with
each setting's deployment, default and limit. All HTTP requests use `/v1`;
[REST API](../../docs/protocol/cloud/rest-api.md) and the
[OpenAPI document](../../docs/api/openapi.json) hold the request and response
shapes, and [Deployment smoke checks](../../docs/protocol/cloud/deployment-smoke-checks.md)
the health probes.

## Development

Error rules:

- HTTP boundaries render errors with the public `rpc-error` crate, pinned by
  `rev` in `[workspace.dependencies]` with the `derive` and `axum` features.
  Never write an error envelope by hand.
- Each API crate has one top-level error enum that derives `RpcError`. Each
  variant maps to one standard `code` and one stable kebab-case `reason`.
  The reason is recorded in
  [REST API](../../docs/protocol/cloud/rest-api.md), and a test runs
  `validate_unique_reasons`.
- Domain and store crates keep their `thiserror` enums and never depend on
  `rpc-error`. The API crate maps their errors.

```sh
cargo test -p mkc-api
cargo test -p mkc-api --test viewer_tests -- --nocapture
MKC_TEST_DATABASE_URL=postgres://postgres:postgres@localhost/mkc_test \
  cargo test -p mkc-api --test github_tests -- --nocapture
MKC_TEST_DATABASE_URL=postgres://postgres:postgres@localhost/mkc_test \
  cargo test -p mkc-api --test billing_tests -- --nocapture
cargo clippy -p mkc-api --all-targets -- -D warnings
```

Contract tests check operation coverage, deferred markers, anonymous-read security markers,
declared reasons and required nullable fields. They also check that every
`ApiError` variant with `data` has its data type in the error schema, under
its reason. Endpoint fixtures validate every JSON response, including the
`data` of each error, against the operation's response schema and status.
Router tests exercise every documented method and path, wrong-method and
unknown-path envelopes, and typed construction errors for malformed contracts.
Command tests prove that every implemented operation dispatches to a typed
command and every platform command reaches an implemented handler.

The GitHub suite starts [`mkc-github-double`](../mkc-github-double/README.md)
in-process and points the configured GitHub origins at it, so the production
provider composition runs against recorded answers over real HTTP.

The API's workers run beside each GitHub test and write the same rows as the
test's own transactions. A `Harness::queries` operation returns each store
error with `?`, as production callers do, so the store retries a
serialization failure. Do not unwrap a store result inside the operation: a
conflict with a worker then fails the test instead of retrying.

`github_tests` and `billing_tests` include the shared test server support,
`tests/support/server.rs`, with `#[path]`. Include it in the same way in each
new binary that runs a test server on a thread. The support binds the API
listener of each harness once. The harness reads the listener address for the
settings and hands the same socket to `Application::serve_on`.

The support runs each test server on its own thread. Before a test uses the
server, a ready check sends `GET /v1/session` through the contract client,
which validates the answer. When the server thread ends before the API
answers, the check fails with the server's own error. On drop, the support
signals stop and joins the thread. When the test thread already panics, the
drop reports a server panic without a second panic, so the test binary does
not abort. Otherwise, a server panic fails the test.

`RecordedStripe`, the billing suite's local Stripe double, stops and joins its
thread through the same support. The GitHub suite runs a second API replica in
a child process. The child binds its own listener. It writes the address to a
file in its temporary directory. The parent waits for that address before it
sends a request. The parent fails when the child exits before it is ready.

Integration tests read `MKC_TEST_DATABASE_URL`, default
`postgres://postgres:postgres@localhost/mkc_test`, and need Postgres 16, the
`psql` client and Python 3 for the smoke tests. Each test runs in its own
`mkc-test-pg` scratch schema with its own temporary local blob store. An
unreachable database fails when `MKC_TEST_DATABASE_URL` or `CI` is set; only
an unconfigured developer machine skips, with a printed reason. Fixtures use
unique identities and no seed migrations. `cargo xtask openapi-lint` requires
a delivery fixture for every documented GitHub subscription; see the
[fixture conventions](./tests/fixtures/github/README.md). Session cookies are
Secure in development too, so open the app on `localhost` or local HTTPS.

The `build_template_tests` integration target verifies the operator template
probe with unimock by default. The explicit `live-build-template` feature adds
the credentialed E2B probe. It uses the same build provider factory, stages
the assertion script, streams it with one added environment entry and destroys
the candidate on success or failure. It changes no API route or worker behavior.
Run it only under [Build template](../../docs/ops/build-template.md).

The App browser suite follows one real build through `fake-build-api`, a
test-only Cargo example in `tests/browser_build/`. The example loads the
serving settings from the environment as `serve` does, then adds build
settings with unused fixture values. It composes this API through
`ConfiguredApplicationFactory`, with `RecordedBuildProviders` from
`github_tests` as the `BuildProviderFactory`. That factory gives the fake
runner in place of E2B. The example includes the runner's files with
`#[path]`. It serves the API through `Application::serve_on`.

In the example, the runner writes build output, then holds the upload until a
`POST /publish/{build}` reaches a second loopback listener. The example writes
that listener's origin to the file that `--control-address-file` names. So a
test checks the running build without a sleep. Then `build_exchange.rs`
uploads the released fixture through the running API's plan, blob and
completion routes with the build's upload token. The `serve` command has no
setting or test detection that selects the fake runner. The
[App guide](../../packages/app/cloud-builds.md) describes the browser side.

### Key Code

- [main.rs](./src/main.rs) and [cli.rs](./src/cli.rs) — the executable and its twelve commands; `cli.rs` parses and dispatches them and runs `openapi`, `preview-seed` and `serve`. `openapi` prints the document, and the other commands load the `mkc-config` settings and construct their dependencies.
- [cli_maintenance.rs](./src/cli_maintenance.rs) — `prune`, `prune-github`, `migrate` and `maintain-publications`, each loading only its database or database and file-store settings.
- [cli_recovery.rs](./src/cli_recovery.rs) — `publication-check-status`, `billing-delivery-status` and the three requeue commands, using database settings only.
- [maintenance/github.rs](./src/maintenance/github.rs) and [maintenance/factory.rs](./src/maintenance/factory.rs) — the bounded GitHub record retention service, and `PublicationMaintenanceFactory`, which composes Postgres and the shared publishing file store into the publication maintenance cycle.
- [preview_seed/factory.rs](./src/preview_seed/factory.rs) and [preview_seed/service.rs](./src/preview_seed/service.rs) — `PreviewSeedFactory` and `PreviewSeeder`, the configuration guard, shared server composition and ordered one-time seed.
- [preview_seed/identity.rs](./src/preview_seed/identity.rs), [preview_seed/upload.rs](./src/preview_seed/upload.rs) and [preview_seed/retry.rs](./src/preview_seed/retry.rs) — sample identity actions, captured ingestion and the injected storage retry budget.
- [publishing_storage.rs](./src/publishing_storage.rs) — shared local and GCS composition for immutable content and replaceable seed objects.
- [application.rs](./src/application.rs) — `ApplicationFactory`, `SystemApplicationFactory` and `ConfiguredApplicationFactory`, the composition root that migrates, connects the store, selects the mailer, composes every service and worker and returns the `Application` that serves; the configured factory takes an injected `GitHubProviderFactory`, `BillingProviderFactory` and `BuildProviderFactory` for embedded use, and the `WorkerIntervals` of its worker loops.
- [application_server.rs](./src/application_server.rs) — the `Application` implementation, which serves the router and runs every worker. `serve` binds the `bind` setting. `serve_on` serves a listener that the caller bound.
- [contract/document.rs](./src/contract/document.rs) — `ApiDoc` merges the area contracts, schema adapters, security schemes and deferred types.
- [contract/parameters.rs](./src/contract/parameters.rs) — shared header and pagination parameters for the operation stubs.
- [contract/responses.rs](./src/contract/responses.rs) — the shared `ErrorResponse` component for standard operation failures.
- [contract/session_cookie.rs](./src/contract/session_cookie.rs) — `SessionCookie`, which points every declared `Set-Cookie` response header at one shared component that states the Origin-dependent `SameSite` rule.
- [contract/account.rs](./src/contract/account.rs) and [account/desktop_grant.rs](./src/contract/account/desktop_grant.rs) — account contracts, including authenticated desktop grant issue and public grant exchange with the inherited session deadline.
- [contract/metadata.rs](./src/contract/metadata.rs) — derives deferred operation markers from `Operation::implemented()` after the area merges.
- [contract/builds.rs](./src/contract/builds.rs) — the five cloud build contracts, including member-only reads with anonymous `not-found` transport.
- `src/contract/deferred/` — request and response types for comment and approval operations that return 503 until implemented.
- [contract/_tests_/response_validation.rs](./src/contract/_tests_/response_validation.rs) — the shared schema validator for unit and integration HTTP responses.
- [worker_intervals.rs](./src/worker_intervals.rs) — `WorkerIntervals`, the pause of each polling worker loop: the GitHub and billing webhook delivery loops, the check delivery loop and the build claim loop. The default holds the production pauses: one second, five seconds and two seconds. The billing harness sets 20 ms for its delivery loop, and the GitHub harness sets 20 ms for its delivery, check delivery and build claim loops.
- [views/](./src/views/) — response schema modules preserve component names and required nullable fields beside the serde wire types.
- [router.rs](./src/router.rs) — `RouterFactory::build` registers document paths and methods by their `Operation` IDs from one in-memory `ApiDoc`, and grants credentialed CORS to exactly the admitted app and desktop origins.
- [route_contract.rs](./src/route_contract.rs) — validates operation IDs, methods, duplicate routes and anonymous-read capabilities before registration.
- [operation.rs](./src/operation.rs) — `Operation`, the typed operation identifiers shared by the OpenAPI contract and dispatch.
- [operation_policy.rs](./src/operation_policy.rs) — implementation and authentication capabilities for the typed operation inventory; `Operation::anonymous_read()` names the reads that need no session, which the route contract compares with the document's GET security requirements.
- [dispatch.rs](./src/dispatch.rs) — `ApiDispatcher`; `dispatch_target` returns `operation-unavailable` for an unconfigured preview sign-in or GitHub operation and `dispatch_billing` in `billing_dispatch.rs` for unconfigured billing, both before Origin, CSRF or body validation; a deferred operation is refused by `Operation::implemented()`; `cookie` writes the session cookie with `SameSite=None` for the admitted desktop origin and `Lax` for the app.
- [desktop_grant_dispatch.rs](./src/desktop_grant_dispatch.rs) and [desktop_grant_input.rs](./src/desktop_grant_input.rs) — desktop request validation after session, Origin and CSRF admission, the grant response, and exchange cookies whose `Max-Age` follows the inherited deadline.
- [desktop_grant_tests.rs](./tests/desktop_grant_tests.rs) — the auth service against Postgres, including issuer sign-out, a wrong verifier that leaves the grant unused, concurrent exchange and atomic session replacement.
- [health.rs](./src/health.rs) — `DatabaseHealth`, the migration readiness read at startup and after a five-second cache expiry; concurrent callers share one refresh.
- [error.rs](./src/error.rs) — `ApiError`, the one point that maps authentication, platform, store, upload, GitHub and build outcomes to the `rpc-error` envelope, with the delegated [github_error.rs](./src/github_error.rs), [upload_error.rs](./src/upload_error.rs) and [build_error.rs](./src/build_error.rs) reason catalogues; `UploadError::UnsupportedVersion` carries the fixed 426 message.
- [error_data.rs](./src/error_data.rs) — the typed `data` of conflict and precondition refusals; [contract/reason_data.rs](./src/contract/reason_data.rs) pairs each type with the reasons that carry it, and [contract/error.rs](./src/contract/error.rs) documents the envelope as one closed variant per data type, keyed by `reason`.
- [response.rs](./src/response.rs) — renders a reply or an error; it overrides the rendered status for the three upload reasons that keep 426, 408 and 410.
- [platform/error.rs](./src/platform/error.rs) — the platform policy contract: authorization, lifecycle and validation outcomes, separate from the store's query failures.
- [platform/service.rs](./src/platform/service.rs) — runs each platform command in one transaction and executes the effects the command recorded, such as the invitation mail, only after the commit.
- [platform/initial_plan.rs](./src/platform/initial_plan.rs) — preview-account workspace defaults.
- [platform/projection.rs](./src/platform/projection.rs) — the pure projections of store rows to the API views; the API and the product say workspace, while the store, the domain identifiers and the database keep the organization persistence name, so this module maps the store's `Organization` row to the `Workspace` view.
- [platform/policy.rs](./src/platform/policy.rs) — the transactional role authorization shared by every platform command; `src/platform/_tests_/authorization_tests.rs` compares the executed matrix with the Roles table of `platform-model.md`.
- [platform/members.rs](./src/platform/members.rs) — membership and invitations; `INVITATION_LIFETIME_DAYS` names the seven-day lifetime once for the stored invitation and the email copy, and the invite command records the mail as a transaction effect.
- [project_input.rs](./src/project_input.rs) and [platform/project_creation.rs](./src/platform/project_creation.rs) — the closed creation alternatives, shared duplicate rule, and optional installed repository link.
- [github/listing.rs](./src/github/listing.rs) and [github/listing_input.rs](./src/github/listing_input.rs) — member-scoped installation lists with suspended rows and the optional workspace filter.
- [platform/slugs.rs](./src/platform/slugs.rs) — the available slug suggestions, derived without exposing the incumbent.
- [publishing.rs](./src/publishing.rs) — `SystemPublishingFactory`, which composes the file store, the contract validator, the upload memory budget, the ingest and access services and the viewer from `PublicationSettings`.
- [upload.rs](./src/upload.rs) with the [plan](./src/upload_plan.rs), [blob](./src/upload_blob.rs), [blob decoder](./src/upload_blob_decode.rs) and [completion](./src/upload_complete.rs) handlers — `UploadHandler` and `StreamingUpload`, the bearer-authenticated plan, raw or gzip Blob, and completion routes that verify bodies within the shared byte budget.
- [viewer/service.rs](./src/viewer/service.rs) — `ViewerService`, which runs each of the six reads, pages the rows and, after a stored-index read, reauthorizes the project and rechecks that the publication is still ready.
- [viewer/artifacts.rs](./src/viewer/artifacts.rs) — `StoredArtifacts`, which decodes the accepted catalogue index for the screen list.
- [viewer/snapshot.rs](./src/viewer/snapshot.rs) — the one read transaction: project access first, so a denied read performs no viewer query, then the typed rows with one lookahead row past the limit.
- [viewer/cursor.rs](./src/viewer/cursor.rs) — the opaque viewer cursor, versioned JSON encoded as lowercase hexadecimal, which binds the operation scope, project, publication and history filters to the last row's complete ordering key and is rejected on any mismatch.
- [viewer/input.rs](./src/viewer/input.rs) — strict per-operation query parsing: single keys only, the 2048-byte `branch` filter, `limit`, `cursor` and the `catalogueScreen`, `viewport` and `scheme` share selection as an `EntryPath` and two enums.
- [viewer/share_validation.rs](./src/viewer/share_validation.rs) — validates a share selection against the stored screen/view selections through the indexed existence query, without opening an artifact.
- [viewer/projection.rs](./src/viewer/projection.rs) — the pure projections of rows and index screens to the API views, including `failureCode`, the Changes state and the `catalogueScreen`, `viewport`, `scheme` key order of a share URL.
- [viewer/publication_state.rs](./src/viewer/publication_state.rs) — maps stored publication states and failures to API enums.
- [builds/service.rs](./src/builds/service.rs) — member-only build reads and scheduling.
- [builds/views.rs](./src/builds/views.rs), [builds/state.rs](./src/builds/state.rs) and [builds/step.rs](./src/builds/step.rs) — build schemas and API-owned value mappings, with a nullable `BuildStep`.
- [builds/history.rs](./src/builds/history.rs) — derives tagged history entries and closes their variant schemas without repeating their fields.
- [build_providers.rs](./src/build_providers.rs) and [build_runtime.rs](./src/build_runtime.rs) — build composition and loops.
- [check_runtime.rs](./src/check_runtime.rs) — check batches and their polling loop.
- [billing/service.rs](./src/billing/service.rs) — `BillingService` and `DatabaseBillingService`, the authorized billing read, the owner-only Checkout and Portal sessions and the durable webhook acceptance.
- [billing_providers.rs](./src/billing_providers.rs) — `BillingProviderFactory` and `SystemBillingProviderFactory`, the composition of the Stripe transport, the short-deadline verification transport and the signature verifier.
- [github_providers.rs](./src/github_providers.rs) — `GitHubProviderFactory` and `SystemGitHubProviderFactory`, the composition of the `mkc-github` adapters against GitHub's official origins.
- [github/policy.rs](./src/github/policy.rs) — flow-bound session rechecks for connected and installation flows; it compares the CSRF token in constant time with `subtle::ConstantTimeEq`.
- [github/reconciliation.rs](./src/github/reconciliation.rs) — `Snapshot`, the current installation state (`Available` or `Removed`) that lifecycle handlers fetch outside the delivery transaction and apply atomically; binding permits several accounts per workspace and rejects a different workspace's installation.
- [github_worker/worker.rs](./src/github_worker/worker.rs) — `DeliveryWorker` and `GitHubWorker`, which claim one due delivery under a five-minute lease, apply its prepared effects and schedule the retry; [github_runtime.rs](./src/github_runtime.rs) and [billing_runtime.rs](./src/billing_runtime.rs) are the in-process polling loops of the GitHub delivery, billing delivery and seat workers.
- [tests/support/server.rs](./tests/support/server.rs) — the shared test server support, which binds the API listener of each harness once and owns each test server thread through its ready check, stop and join.
- [tests/github/build_provider.rs](./tests/github/build_provider.rs) and [tests/github/build_exchange.rs](./tests/github/build_exchange.rs) — `RecordedBuildProviders`, the fake build runner that `github_tests` and `fake-build-api` share, with its optional per-build upload gate, and its upload of the released fixture through the running API's upload exchange.
- [tests/browser_build/example.rs](./tests/browser_build/example.rs) and [tests/browser_build/server.rs](./tests/browser_build/server.rs) — `fake-build-api`, the test-only Cargo example that serves this API with the shared fake runner for the App's real-build spec, and the loopback listener that releases each held upload.

### Related Docs

- [REST API](../../docs/protocol/cloud/rest-api.md), [REST API surface](../../docs/protocol/cloud/rest-api-surface.md), [REST requests and responses](../../docs/protocol/cloud/rest-transport.md) and [REST trusted proxies](../../docs/protocol/cloud/rest-proxies.md)
- [API contract guide](../../docs/api/README.md)
- [Platform model](../../docs/protocol/cloud/platform-model.md)
- [Authentication](../../docs/protocol/cloud/auth-sessions.md) and [callback landings](../../docs/protocol/cloud/auth-callbacks.md)
- [Desktop application](../../docs/protocol/cloud/desktop-app.md)
- [GitHub App](../../docs/protocol/cloud/github-app.md) and [GitHub sign-in](../../docs/protocol/cloud/github-sign-in.md)
- [Changes check](../../docs/protocol/cloud/changes-check.md)
- [Cloud builds](../../docs/protocol/cloud/cloud-builds.md), [Cloud build runner](../../docs/protocol/cloud/cloud-build-runner.md) and [Cloud build API](../../docs/protocol/cloud/cloud-build-api.md)
- [Billing](../../docs/protocol/cloud/billing.md) and [Billing workers](../../docs/protocol/cloud/billing-workers.md)
- [Publication ingest](../../docs/protocol/cloud/publication-ingest.md) and [Publication upload exchange](../../docs/protocol/cloud/publication-upload-exchange.md)
- [Viewer read model](../../docs/protocol/cloud/viewer-read-model.md)
- [Retention](../../docs/protocol/cloud/retention.md)
- [Persistence boundaries](../../docs/protocol/cloud/persistence-boundaries.md)
- [Deployment smoke checks](../../docs/protocol/cloud/deployment-smoke-checks.md)
- [GitHub App manual smoke](../../docs/ops/github-app-smoke.md), [Publish smoke](../../docs/ops/publish-smoke.md), [Build template](../../docs/ops/build-template.md), [Maintenance](../../docs/ops/maintenance.md) and [Check recovery](../../docs/ops/check-recovery.md)
- [Architecture](../../docs/architecture/cloud.md) — the components, their boundaries, and the data flows this crate takes part in.
