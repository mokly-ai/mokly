# Web API Client

This is the session and API client sub-contract of
[Web application](./web-app.md). The API boundary follows
[REST API](./rest-api.md).

## Session And Requests

`GET /v1/session` runs once at start-up and yields the user, the workspace
identifiers and the CSRF token. The token is held beside the client, and every
mutation sends it as `X-CSRF-Token` together with `Origin`. The `mkc_session`
cookie is the API's; every request uses `credentials: "include"` and never
reads or writes it. `Origin` is in the generated contract because the API
requires it, but the browser sets it and refuses a page that tries to, so only
the CSRF token is the application's to send. Both origins are `localhost` in
development so the `SameSite=Lax` cookie travels with the app's own requests.

Sign-in is one process for new and returning readers.
`POST /v1/auth/magic-links` sends the link; the mail carries `#token=` in the
fragment. Inside the desktop shell, which `src/navigation/desktop-shell.ts`
detects by the page's own `mokly-app:` location protocol, the request carries
the desktop Origin, so the API issues the link whose hosted landing offers
the handoff of [Desktop application](./desktop-app.md#sign-in-handoff)
instead of exchanging the token on arrival. The token leaves the address
before the app's router records it, and `/auth/email/callback` exchanges it
through `POST /v1/auth/callback` before resuming; a credential never stays in
the address. A preview's shared link carries `#secret=` instead, removed the
same way and exchanged by `/auth/preview/callback` through
`POST /v1/auth/preview`. `returnTo` is validated exactly as
[Navigation](./product-navigation.md#routes-and-entry) requires: an accepted
destination keeps its path and query bytes and their order through email and
GitHub sign-in, and an absent or rejected value becomes `/dashboard`.

A session state is `loading`, `signed-in`, `signed-out` or `error`. Only
`unauthenticated` and `session-expired` sign the reader out; any other failure
stays an error state with a retry, because a flaky network must not lose their
place. A start-up read that lands after a magic-link exchange has adopted a
session never sends the reader who just signed in back to the entry screen.

GitHub starts keep state and the PKCE verifier in tab-scoped session storage,
then the provider-specific landings compare and consume them before an
exchange, using the provider values the entry took off the address. Signed-in
connection and installation callbacks use the session's CSRF token; logged-out
sign-in does not invent one. Exact keys, flow transitions, cleanup, recovery
and resume behavior live in
[Authentication callbacks](./auth-callbacks.md).

## API Client

Rust owns every API boundary type, as [REST API](./rest-api.md#contract-source)
requires. `utoipa` derives the OpenAPI document at `docs/api/openapi.json`.
`openapi-typescript` generates `apps/app/src/api/generated/schema.ts` from that
document, and `openapi-fetch` uses its types. The frontend imports generated
types for backend data and never hand-writes equivalent types.
The [generator pins](./repository-layout.md#pinned-toolchains) are exact.

Both generated files stay committed. `cargo xtask openapi` regenerates them;
`cargo xtask openapi --check` and stage 17 `openapi-drift` reject drift in
either file. Never hand-edit the outputs. The
[generated-file contract](./repository-generated-files.md) records why both
outputs are committed and checked.

Every API call sends one UUID as `X-Request-ID`, and a request failure carries
that same identifier, so the reference an error state shows is always one the
API saw, including when no response arrives. A failure the application raises
itself carries no identifier and draws no reference.

Forms do not invent their own sentences. Each catalogued reason maps to the
copy the reader sees and, where a form says one owns it, to the field it
belongs to; an unrecognised reason falls back to the API's own client-safe
message. A failure never lands on a field that had nothing to do with it. A
refusal an unchanged request cannot overcome keeps the control's resting
operation label instead of saying Try again, while the shared failure fragment
still reports the cause and reference.

A client error carries the envelope's `code`, `reason`, `message`,
`request_id` and `data` from [REST](./rest-api.md), plus the HTTP status and
any `Retry-After`. The UI branches on `reason` and never on message text; a
reason this build does not know stays readable but matches nothing. A response
that is not the envelope, and a request that never reached the API, become the
same typed shape, so no screen handles two kinds of failure. One closed
Details disclosure holds the optional API request reference and plain
diagnostic details; both values share it, and an absent or empty pair draws
none. API surfaces supply the request identifier. Viewer version failures
supply only the viewer's plain diagnostics. This markup stays aligned with the
shared mockup component. These values are the developer's half of the message
and never the headline.

GitHub sign-in, the account pane's GitHub connect, App installation and
provider-backed repository selection are registered operations. The screens
call them for real and render the documented recovery when a provider
operation is unavailable: email sign-in beside GitHub sign-in, and on the
install and repository steps the refusal itself with Try again, because a
project is a repository the App can read and there is no path around it.
