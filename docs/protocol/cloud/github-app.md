# GitHub App

The GitHub App gives Mokly Cloud sign-in identity, installation linking,
repository state, webhooks and check runs. The [architecture](../../architecture/cloud.md)
places the provider and delivery components. [Changes check](./changes-check.md)
consumes the check-run and repository-state contracts below.

## Registration And Permissions

Register one App per deployment. Repository permissions are Checks **write**,
Contents **read**, Metadata **read**, and Pull requests **write**. Organization
Members **read** verifies that the connecting user administers the GitHub
organization. Account Email addresses **read** supplies verified primary email
for [sign-in](./github-sign-in.md). Subscribe to `installation`,
`installation_repositories`, `repository`, `pull_request`, `push`, `check_suite`,
`check_run`. Repository events use the existing Metadata read permission.
Reviews and review comments are provider operations only; no product feature
uses them.

Set the user callback to `<app-origin>/auth/github/callback`, setup URL to
`<app-origin>/auth/github/install`, and webhook URL to
`<api-origin>/v1/github/webhooks`. `/install` is the signed-in screen that
starts installation; it is not a provider return. The landing behavior is
defined in [Authentication callbacks](./auth-callbacks.md).
Enable Redirect on update in the App registration. Configure on GitHub then
returns the reader to the setup URL.
Use a strong independent webhook secret, a generated RSA private key, and the
App's client ID, client secret, numeric App ID and slug. User-token expiry is
enabled. Disable authorization during installation: setup completes with an
explicit authorization step so installation state and PKCE stay bound.

Configuration uses `MKC_GITHUB_APP_ID`, `MKC_GITHUB_CLIENT_ID`,
`MKC_GITHUB_CLIENT_SECRET`, `MKC_GITHUB_APP_SLUG`, `MKC_GITHUB_PRIVATE_KEY`
(PEM text) and `MKC_GITHUB_WEBHOOK_SECRET`. Either all are supplied or none;
partial configuration fails startup. Without them GitHub operations return
`operation-unavailable`. Credentials are never logged or serialized as resource
DTOs. HTTP base URLs are fixed to GitHub in production. Under
`MKC_ENV=development` only, `MKC_GITHUB_API_ORIGIN` and `MKC_GITHUB_WEB_ORIGIN`
point the API and OAuth transports and the authorize and install URLs at a
loopback origin. Both must be set together, and any other environment refuses
them at startup. Deployment's `github.enabled` switch supplies all six settings
or none; the [environment inventory](../../ops/environment.md) records
each environment's state.

## Installation And Authorization

1. A signed-in workspace owner/admin visits `/install` and sends
   `POST /v1/github/installations` with `workspaceId`, optional `returnTo` and
   optional positive `installationId`.
   Origin and session CSRF are required. Store a ten-minute, one-use flow bound
   to the user and session. Without `installationId`, return the App installation
   URL, state and PKCE verifier. With `installationId`, record the candidate at
   flow start and return the OAuth authorization URL, state and verifier. The
   browser stores the first path as `install-setup` and the candidate path as
   `install-authorize`. Admission, owner/admin access, session binding and expiry
   apply to both paths. A suspended binding does not prevent flow start.
2. A normal GitHub setup redirects to `/auth/github/install` with
   `installation_id`, `state` and advisory `setup_action`. The app sends the
   first two and its verifier to `POST /v1/github/installations/callback` using
   the same session and CSRF. The response supplies the OAuth authorization URL
   and the landing follows it in the same window. A stateless arrival has
   `installation_id` without `state` and without `setup_action=request`; it replaces its address with
   `/install?installationId=<id>` without adding a history entry. It comes from
   Redirect on update or from an installation started on GitHub. An arrival with
   `setup_action=request` draws **Installation requested**, the line "An owner
   of the GitHub organization approves it on GitHub.", and **Back to install**.
   Callback query parameters grant no authority.
3. The OAuth callback verifies the GitHub user, checks the selected installation
   belongs to this App, and proves account administration with the user token:
   personal account IDs must match; GitHub organization membership must be `active`
   with role `admin`. Decode GitHub `Enterprise` owners, but reject them and `Bot`
   owners with `permission-denied`; Mokly binds personal accounts and GitHub organizations.
   The installation must also appear in `/user/installations`.
   Fetch the installation's current repositories using its installation token.
4. In one transaction, recheck local owner/admin permission and the flow's
   original session. Bind an unbound installation to the flow's workspace, or
   refresh an installation already bound to that workspace. Synchronize its
   current repositories in either case. An installation bound to another
   workspace returns `github-installation-conflict`. Its description is
   "Installation already belongs to another workspace". A workspace may hold
   several installations, but an installation belongs to at most one workspace.
   The organization-kind `integrations` row is no longer written or read. The
   user-kind row written by GitHub sign-in is unchanged. Provider tokens are
   discarded after use.

Workspace reads expose the installation summary defined in
[Platform model](./platform-model.md#entities). Reads require a session and
active workspace membership. Nonmember workspace lookups return `not-found`.
Direct project grants and public visibility do not grant this access. These
reads use stored observations even without GitHub runtime configuration.

`GET /v1/github/installations` lists connected installations bound to workspaces
where the caller has active membership, including suspended installations.
Rows carry `workspaceId` and `accountKind` as `user` or `organization`.
Their `state` is `connected` when active and `suspended` when inactive.
Each row includes its account name and provider manage URL. An optional
`workspaceId` filters to one workspace the caller belongs to.
An unknown or inaccessible workspace returns `not-found`. Without the filter,
the list spans the caller's workspaces.

Repository listing returns active repositories of active, connected
installations within the same membership scope. Both lists use UUID cursors.
Mokly's installation and repository IDs are UUID v7. GitHub's positive integer
IDs identify provider installations. Guessed UUIDs never disclose private
installations.

Project creation with `repositoryId` checks the installation's workspace and
active access, then stores the provider's canonical name and a repository link.
[Platform model](./platform-model.md#projects-and-visibility) defines creation
without a repository link. Repository selection and installation callbacks
never grant Mokly workspace membership.

`DELETE /v1/github/installations/{installationId}` requires local owner/admin
and CSRF. It disconnects locally and invalidates cached tokens; projects and
publication history remain. It does not remove the App on GitHub. Reconnecting
requires the full administration proof.
GitHub uninstall/suspension disables repository access and invalidates tokens.
Webhook reconciliation cannot undo a local disconnect. A callback snapshot
older than a recorded suspension or disconnect is rejected as unavailable; the
user restarts authorization. Workspace deletion detaches all installations
bound to the workspace before cascading local resources, preserving projects
in workspaces that previously disconnected from the same installation.
Repository removal disables new provider-backed operations without deleting
project history.

## Provider Requests And Token Cache

Requests use `Accept: application/vnd.github+json`, a Mokly User-Agent and
`X-GitHub-Api-Version: 2022-11-28`. REST paths escape individual segments;
pagination requests 100 rows and follows a bounded page count without following
untrusted absolute URLs. Responses are bounded to 8 MiB and requests to 30 seconds.

RS256 App JWTs use the configured client ID as issuer, `iat = now - 60 seconds`
and `exp = now + 9 minutes`. An installation token is reused until 60 seconds
before the provider's `expires_at`, and concurrent misses never issue duplicate
tokens. Failed/expired tokens are never cached. Uninstall, suspension and
disconnect invalidate the cached token. A provider 401 invalidates it and
retries once with a fresh token. Each build attempt requires a new installation
token with `repository_ids: [repository ID]` and
`permissions: {contents: "read"}`. It bypasses the cache and shared refresh lock.
GitHub adds Metadata read implicitly. No other repository permission is requested.

Primary exhaustion uses `X-RateLimit-Remaining: 0` and `X-RateLimit-Reset`.
Secondary 403/429 uses `Retry-After`; absent that header, wait at least 60
seconds. Permission 403 responses are distinguished from rate limits by the
documented response fields/headers, never string matching arbitrary errors.
Honor the later of reset and retry deadlines. Retry one explicit rate-limit
rejection when the delay is at most 60 seconds; otherwise return the typed
delay. Do not retry uncertain transport failures for create operations.
Durable handlers schedule their own bounded retries.

## Delivery Acceptance And Recovery

`POST /v1/github/webhooks` is session-independent. Require one delivery UUID,
one `X-GitHub-Event` and one `X-Hub-Signature-256: sha256=<64 hex digits>`.
Read at most 2 MiB and validate HMAC-SHA256 over the original bytes with a
constant-time verifier before decoding or writing anything. Invalid signatures
return `webhook-signature-invalid`; malformed headers return `validation-failed`.
Use the configured secret; never trust source-IP or payload identity as a signature.

Commit the original body, delivery ID, event name and receive time before 202.
Deliveries are durable: duplicate IDs with identical bytes/event return 202
without duplicate effects; mismatched reuse returns `validation-failed`.
Unknown events and actions are stored and acknowledged, then marked ignored.
Malformed known events are retained and marked failed, not acknowledged as handled.
No webhook body, credential or provider response is written to diagnostics.

A worker in the API process applies committed deliveries. One worker at a time
applies a delivery; a delivery that a stopped worker left in progress becomes
available again within five minutes, and the stopped worker can no longer
complete it. A delivery's domain effects and its completion commit together.
Repository name/visibility refresh commits before provider reads and can
persist across handler retries. Handlers reconcile current provider state
outside the transaction, preventing delayed deliveries from resurrecting
uninstalled installations or replacing current branch/PR state with stale payloads.
An event for an unknown installation or repository retries until its selection
event is processed, within the normal attempt limit. A known inactive repository
is ignored. Metadata may reconcile before local linking; publication operations
must independently require the project workspace's active, connected installation.

Retry transient/provider/internal failures up to eight attempts with delays
`5, 10, 20, 40, 80, 160, 320` seconds, honoring longer provider retry delays.
Final failures stay inspectable by delivery ID with attempts and a typed
failure category. An unrepresentably long provider delay never schedules an
earlier retry. Signed redelivery of an exhausted delivery requeues it;
successful and ignored deliveries stay idempotent. Operators inspect only
restricted database records and use GitHub's redelivery UI for recovery.

## Event Handlers

| Event                     | Durable effect                                                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| installation              | Reconcile current installation, suspension/deletion and repository access; invalidate token                                       |
| installation_repositories | Reconcile the complete current installed repository set                                                                           |
| repository                | Reconcile the complete current installation snapshot on edited, renamed, transferred, privatized, publicized, deleted or archived |
| repository (created)      | Reconcile the current snapshot, including new repositories selected by an all-repositories installation                           |
| repository (unarchived)   | Reconcile the current snapshot after restoring an archived repository                                                             |
| pull_request              | Reconcile PR number, state, title, base/head branch, SHA and repository IDs; schedule eligible automatic builds                   |
| push                      | Reconcile the named branch tip, including deletion; schedule eligible default-branch builds; ignore tag refs                      |
| check_suite               | Mark existing Mokly checks on the suite head for rerun on requested/rerequested                                                   |
| check_run                 | Mark the exact known Mokly check for rerun on rerequested                                                                         |

`Checks` lists a head's `Mokly` runs for the
[check delivery loop](./changes-check.md#provider-delivery), using the App ID,
check name and `filter=all` to recover uncertain creates.
[Cloud builds](./cloud-builds.md#triggers) schedule in the `push` and
`pull_request` durable-effect transaction after reconciliation. The scheduler
reads the reference stored by that transaction, never payload head data.
`repository` `edited` reconciles the current installation snapshot, including
a changed default branch. PR reads retain nullable head and base repository
IDs; a deleted head repository stays null and fails the fork rule.

Repository-bearing deliveries carry the stable repository ID, `full_name` and
`private`. Before a branch, PR or check lookup, refresh changed name/visibility
fields in a transaction scoped to that installation and repository ID, without
an extra provider request. Preserve selection, local binding and project history.
A renamed push therefore uses its new owner/name immediately. Tag pushes and
ignored actions of repository-bearing event families also refresh metadata.
Repository lifecycle events fetch the current installation snapshot so delayed
creation/rename/transfer/visibility/deletion/archive/restore events reconcile
current selection rather than restoring an old payload. Archived repositories
keep access when GitHub still includes them in that selection.

Only events naming this App's installation and repository can affect that
repository. Check events must name this App ID; unknown check IDs are ignored.
A check record identifies its project, repository, head SHA, provider check ID
and external ID, and carries its rerun request. Webhook handlers only mark
rerun requests and never fabricate a check; [Changes check](./changes-check.md)
creates or recovers check records, consumes rerun requests and publishes
summaries. The API check loop runs publication and build delivery and
rerequest batches every five seconds, each bounded to 100 rows, only with
GitHub configuration. Provider requests run outside store transactions. Pull
request and branch query records support publication association. Check create
uses a caller-supplied stable external ID for recovery/reconciliation; GitHub
does not promise exactly-once creation after an ambiguous network failure.

Viewer reads keep PR author logins from `user.login`; an author login may be
null until reconciled. See [Viewer read model](./viewer-read-model.md).

## Sources

Automated tests never contact a real App; the
[manual smoke](../../ops/github-app-smoke.md) covers registration and a live test
repository.

Provider references: [JWTs](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app),
[rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api),
[webhook validation](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries),
[repository events](https://docs.github.com/en/webhooks/webhook-events-and-payloads#repository),
[GitHub organization membership](https://docs.github.com/en/rest/orgs/members#get-an-organization-membership-for-the-authenticated-user).
