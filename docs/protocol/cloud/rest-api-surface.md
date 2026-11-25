# REST API Surface

Status: The API gives no configuration answer yet, and the preview exchange does not check a password yet. [Milestone 4](../../../plans/preview-password-sign-in.md#milestone-4-configuration-answer) builds the answer, and [Milestone 3](../../../plans/preview-password-sign-in.md#milestone-3-api-password-exchange) the password exchange.

This is the operation and response sub-contract of [REST API](./rest-api.md).

## Implemented Surface

The API implements magic-link issue/exchange, desktop grant issue/exchange,
session read/rotation/sign-out, account name editing, personal workspace
creation/read/edit/deletion, members and invitations (including acceptance),
projects, additive project grants, and one-time publishing-token
creation/list/revocation.

`GET /v1/health` has explicit OpenAPI `security: []`; it needs no session or
token and never sets a session cookie. Its 200 JSON contains `status: "ok"`,
Cargo `version`, build `revision`, and `migrations: "current"`. Migration
readiness is read from Postgres at process startup and at most once every
five seconds; every caller within that interval sees the cached result,
including a cached failure. Responses use `Cache-Control: no-store`. Pending
migrations return 503 `unavailable` / `migrations-pending`; a failed database
check returns 500 `internal` / `internal-error`. See the
[rollout checks](./deployment-smoke-checks.md).

Every documented operation has a registered method, path and operation ID,
including publication, comment and approval operations. Deferred operations,
including every comment and approval route, return HTTP 503 `unavailable` /
`operation-unavailable`; no fake provider or publication data is returned.
GitHub App and sign-in operations follow [GitHub App](./github-app.md) and
[GitHub sign-in](./github-sign-in.md); GitHub configuration is optional, and
absent configuration returns the same unavailable response.
A callback for an installation that another workspace owns returns
`github-installation-conflict` with the description "Installation already
belongs to another workspace".
The [preview password exchange](./preview-sign-in.md#password-exchange)
returns HTTP 503 `operation-unavailable` without the shared account's
configuration. The three-request
[publication upload exchange](./publication-upload-exchange.md) and
authenticated one-use catalogue grants are implemented. The API also
implements the [viewer reads](./viewer-read-model.md). Current-only
`listScreens` and screen-specific Share return HTTP 503
`operation-unavailable`; publication-level Share is available.
`requireApproval: true` also returns HTTP 503 `operation-unavailable`.
Plan-based project creation, private visibility and private upload
enforcement are implemented. The four [billing](./billing.md) operations are
implemented; an unconfigured environment returns `operation-unavailable`. The
Stripe webhook has the same 2 MiB body limit as GitHub deliveries.

For preview sign-in and every implemented GitHub operation, absent runtime
configuration returns 503 `operation-unavailable` before operation-specific
Origin, CSRF or JSON-body validation, so malformed JSON and a missing or wrong
Origin or CSRF never mask absent configuration. A configured operation
performs required session authentication, validates Origin and CSRF before the
body, and consumes admission only after JSON decoding and body-shape checks
pass; an operation skips the steps it does not use. The preview, desktop grant
and GitHub authentication operations follow the same precedence.

The [cloud build API](./cloud-build-api.md) implements five operations,
project and reference fields, and four reasons. The generated document and
[REST catalogue](./rest-api.md#reason-catalogue) describe them.

The running router's methods, paths and operation IDs match the generated
document exactly, as [Contract source](./rest-api.md#contract-source) requires.
Every documented operation has one unique operation ID.

Workspace responses expose the current `plan` as `free` or `team`, and
`githubInstallationState` as the summary defined in
[Platform model](./platform-model.md#entities). All active workspace roles
receive the same fields in reads and list rows. Direct project grants and
public visibility do not authorize workspace reads. Account names and manage
URLs come from the [installation list](./github-app.md#installation-and-authorization),
which includes suspended bindings and accepts an optional `workspaceId` filter.
Workspace reads use stored data without GitHub runtime configuration.

Workspace and Project DTOs include their current `slug`; Project also
includes current `workspaceSlug` so any authorized project reader can mint
a route without a separate workspace read. Project additionally carries
`publishingAllowed`, a current-project capability that is always true for a
public project and, for a private project, is derived from the owning
workspace's current plan. It exposes no plan distinction for public
projects; it does not authorize or return workspace or billing data, and a
direct project grant still cannot read either. Create and full update commands
require `slug`. UUID paths are the identity boundary. The authenticated
`GET /v1/workspaces/by-slug/{workspaceSlug}` resolves a current or
retired claim and returns the ordinary Workspace fields plus required
`canonicalSlug`.
`GET /v1/workspaces/by-slug/{workspaceSlug}/projects/{projectSlug}`
applies the UUID project read's optional-session visibility boundary and
returns the ordinary Project fields plus required `canonicalSlug` and
`canonicalWorkspaceSlug`. The latter exposes only the route needed for an
otherwise readable project. Unknown and inaccessible private subjects both
return `not-found`; malformed slug segments return `validation-failed` before
store access.

Authenticated suggestion reads are advisory and reserve nothing.
`GET /v1/workspaces/slug-suggestion?name=…` authorizes like personal
workspace creation.
`GET /v1/workspaces/{workspaceId}/projects/slug-suggestion?repository=…&configPath=…`
authorizes like project creation. Each returns `{slug: string}` after checking
current and retired claims; missing, empty, overlong or invalid inputs return
`validation-failed`. Their deterministic derivation is defined in
[Platform model](./platform-model.md#slugs). A concurrent winner is still
reported by the create or update command.

Publication reads and history include nullable `pullRequest` context: admitted
number, observed title/author login and canonical GitHub URL. Association uses
the bound repository and stored upload PR number, never a branch or current
SHA. Missing observations produce null; historical author logins may be null.
Branch and PR list rows include nullable `newestPublication` (`id`, `state`,
`publishedAt`, `headSha`) from the newest eligible publication in any state, as
[Viewer read model](./viewer-read-model.md#branches--listbranches) defines; their
`latestPublicationId` selects the newest retained ready target. `listScreens`
returns the OpenAPI `Screen` schema; screen cursors and share lookup use the
screen path. A selection is at most 2048 UTF-8 bytes. `catalogueScreen`
contains one or more `/`-joined `^[A-Za-z0-9_-]+$` segments, preserving case.
Reject empty segments, dots, controls, case-insensitive Windows device names
(`aux`, `con`, `nul`, `prn`, `com1`–`com9`, `lpt1`–`lpt9`) and
case-insensitive first-segment `mokly-generated`. Invalid values return
`validation-failed`.

`Screen.path`, `catalogueScreen`, `Anchor.screenPath` and the deferred
`listThreads` `screenPath` filter reference one shared OpenAPI `EntryPath`
schema, whose length bounds and pattern are in the
[OpenAPI document](../../api/openapi.json). Share handlers also check device
names and the reserved first segment; the pattern does not encode those
exceptions.

`getShareLink` accepts and mints `catalogueScreen`, `viewport` and `scheme`;
its viewport input is `desktop|mobile`. A request without a viewport mints a
link without one, which the app opens on Both, its default. The app copies
the returned URL unchanged. A `screen` key is rejected. Values are encoded
once and sharing never issues an access grant. Provider check links use the
same screen key. This context follows project visibility, including direct
grantees and public anonymous readers. All authorized roles receive the same
fields; pending invitations alone disclose none on private projects. See
[Viewer read model](./viewer-read-model.md).

Upload completion receipts serialize the publication's actual state. The
attempt that became ready returns 201 on every completion, and an attempt
superseded by another ready publication returns 200. A ready publication
keeps same-head idempotency until its project or workspace is deleted; see
[Retention](./retention.md). Expired records do not win idempotency.
Republishing the same expired head creates a new ready publication and URL,
and the old record stays as expired history. See
[Lifecycle](./publication-ingest.md).

An unsupported artifact version returns HTTP 426 with the
`upload-unsupported-version` reason and omitted `data`. Its fixed message is
**Update Mokly to 0.18.0 and publish again.** The artifact kind
and the received version appear in internal diagnostics and logs, never in
the response text or `data`. There is no per-artifact response message.

## Configuration Answer

`GET /v1/configuration` says which optional configuration this API has, so
the app can draw a feature before a reader acts. Like `GET /v1/health`, it has
explicit OpenAPI `security: []`, needs no session or token and never sets a
session cookie. Its 200 JSON has one required field for each optional
configuration of the operation gate that answers 503 `operation-unavailable`:
`github` and `billing` are true when that configuration is present, and
`previewPassword` follows [Preview sign-in](./preview-sign-in.md#configuration-answer).
A PR preview with a verifier answers
`{"github": false, "billing": false, "previewPassword": {"account": "preview@mokly.ai"}}`.
Each field reads the same configuration as the gate, so the answer never
names a configuration that the gate refuses, and a new optional
configuration adds a field. The answer holds nothing secret. An untyped map
of flag names was rejected, because the generated types could not check a
name.
