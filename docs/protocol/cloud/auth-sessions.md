# Authentication And Sessions

Email sign-in and sign-up share one flow. [GitHub sign-in](./github-sign-in.md)
links by verified primary email and uses the same session policy. Previews add
one [shared sign-in link](#preview-sign-in). The
[API document](../../api/openapi.json) owns transport shapes.

## Magic Links

`POST /v1/auth/magic-links` accepts a normalized email and optional `returnTo`.
It always follows the same storage and delivery path for existing and new
addresses. A successful request returns 202 with a fresh request ID and
`resendAfter`; it never returns an account-existence flag. Provider failure
returns a safe 500 `internal-error` for either kind of address. No user is created at issue.

Generate 32 cryptographically random bytes, encode as 64 lowercase hex digits,
and store only the SHA-256 digest. The link expires after 15 minutes. Issuing a
new link does not extend older links; each is independently single-use.
Admission uses persistent fixed windows: at most one request per email per
60 seconds and 20 per peer IP per 60 seconds. Rejected admissions return 429
and a positive `Retry-After` in seconds, without inspecting account existence.
The API selects the client address using the trusted-proxy contract in
[REST](./rest-proxies.md#trusted-proxies); its default ignores forwarded headers.
Rate keys are hashed; counters are
updated atomically in the same transaction as link creation. Failed delivery
does not refund admission, and retry is available after the reported delay.

The email URL is `<app-origin>/auth/email/callback#token=<secret>`. A link
requested with the desktop Origin of
[Desktop application](./desktop-app.md#api-and-catalogue-admission) is
`<app-origin>/auth/email/callback?client=desktop#token=<secret>`: the query
carries only `client`, and the mail copy does not change. The landing outside
the shell offers the handoff instead of exchanging the token on arrival. Its
fragment keeps the credential out of HTTP access logs and referrers. The
application removes it from the address before its router starts, and the
provider-scoped landing exchanges it using `POST /v1/auth/callback`, as defined in
[Authentication callbacks](./auth-callbacks.md).
The exchange requires an admitted Origin; GET never consumes a
link, so mail scanners cannot sign in. Consumption, user creation and session
issue are one transaction. Unknown or malformed links return `magic-link-invalid`;
unused expired links return `magic-link-expired`; consumed links return
`magic-link-used`, even after expiry. Retain the digest and consumption time
so concurrent exchanges yield one session and one typed used-link response.
The authentication pruning job removes links seven days after expiry by
default, after which their credentials become unknown. Used links follow the
same window so replay stays distinguishable during that period.

## Preview Sign-In

A preview signs one shared account in with a per-namespace secret instead of
email, as the [preview seed](./preview-seed.md) describes. The preview
[seed command](./preview-seed.md#seed-command) also finds or creates the
configured account, under the same settings and capability, and it issues no
session.
`MKC_PREVIEW_SIGN_IN_SECRET` (64 lowercase hex digits) and
`MKC_PREVIEW_SIGN_IN_EMAIL` (validated and normalized like any account email)
are both set or both absent. They require the named `preview_sign_in`
capability, which `MKC_ENV=preview` and `development` grant and production
never does. Setting only one, a malformed value, or either without the
capability fails startup with a typed configuration error. Stable environments
run with `MKC_ENV=production`, so no stable API can accept a secret.

`MKC_PREVIEW_SIGN_IN_PLAN` is optional: `free` (the default when absent) or
`team`. It requires both settings above and the same `preview_sign_in`
capability. A plan without the pair, a plan without the capability, or an
unknown value fails startup with a typed error that names the configuration
key and never a secret. At workspace creation the API compares the creator's
normalized email, read in that same transaction, with the configured email.
A match uses the configured initial plan; every other creator uses `free`.
This setting never changes an existing workspace's plan. See
[Billing](./billing.md#plan-catalogue) for the consequences.

`POST /v1/auth/preview` accepts `{secret}` and requires an admitted
Origin; like the magic-link exchange, it cannot require a session CSRF
token. The shared optional-operation gate runs before Origin or body
validation. Without configuration it returns 503 `operation-unavailable`, as
unconfigured GitHub operations do, even when both the Origin and body are
invalid. Once configured, the endpoint validates Origin first, then its JSON
body, then admission. Every attempt that passes the Origin and body checks
consumes admission: at most 20 per selected peer IP per 60 seconds in a
persistent fixed window. An unavailable, wrong-Origin or invalid JSON/body-shape
attempt consumes none. A body with a malformed or different secret has passed
those checks, consumes admission and returns `magic-link-invalid`. The API
compares SHA-256 digests in constant time; the submitted value is never logged.

On success one transaction finds or creates the user with the configured
email, revokes a supplied existing session and issues a session exactly as the
magic-link exchange does: the same cookie, deadlines, CSRF token and
`SessionIssued` response, with `returnTo` `/dashboard` and
`Cache-Control: no-store`. This is the only account created without email
verification; possession of the namespace secret replaces it, and only under
the capability. The secret stays valid until its namespace is deleted and
leaves no expiry, consumption or replay records; its sessions follow the
ordinary lifetimes.

## Sessions

The response sets `mkc_session=<random secret>; Path=/; Secure; HttpOnly;
SameSite=Lax; Max-Age=2592000`. There is no Domain attribute. An exchange
whose Origin is the desktop origin receives `SameSite=None` in place of `Lax`
with every other attribute unchanged, because the desktop page is cross-site
to the API. All magic-link, preview and GitHub exchanges, rotation with
`POST /v1/session`, and clearing with `DELETE /v1/session` select `SameSite`
from that request's Origin. The credential
has 256 random bits; only its SHA-256 digest is stored. Cookies stay Secure
in development too.
The absolute lifetime is 30 days; idle lifetime is seven days. Successful
authentication writes nothing unless the session's last recorded activity is
older than five minutes; then it records the new activity. Idle expiry is the
last recorded activity plus seven days; five-minute activity granularity is
accepted and never extends the absolute deadline.
At either boundary (`now >= deadline`) authentication fails with 401 `session-expired`. Unknown or revoked credentials
return 401 `unauthenticated`.

`GET /v1/session` returns the user, workspace IDs and a session-bound CSRF
token. Its response and every auth/token response use `Cache-Control: no-store`.
`POST /v1/session` rotates the credential and CSRF token, preserving the
absolute deadline, invalidating the old credential atomically. Rotation selects
`SameSite` from that request's Origin, exactly as the exchanges do. A successful
magic-link, preview or GitHub exchange also revokes a supplied existing
session before issue.
`DELETE /v1/session` revokes it and clears the cookie using the same attributes.
Invalid credentials never create a replacement session.

## CSRF, Origins And Redirects

Every authenticated mutation requires both `Origin` equal to the configured
app origin (scheme, host and port), or to the desktop origin when
`MKC_DESKTOP_CLIENT` is `true`, and `X-CSRF-Token` equal to the stored token.
Token comparison is constant time. Missing/mismatched values
return `csrf-rejected` (403). Public magic-link issue and callback require Origin
but cannot require a session CSRF token. CORS permits credentials only for
those explicit origins, echoing the matching one with `Vary: Origin`, with
the supported methods and CSRF/content-type headers. Never reflect arbitrary
origins. Bearer project-token publishing uses a separate
transport and cannot authenticate account or workspace routes.

`mkc_domain::client_origins::AdmittedOrigins` owns that exact set for both
servers. `MKC_DESKTOP_CLIENT` accepts only `true` or `false`; absence means
`false`, and any other value stops startup with a typed configuration error.

`returnTo` follows [Navigation](./product-navigation.md). The domain validator
receives the string after JSON has decoded the request body; canonical input is
already a `/`-prefixed path with an optional query whose own percent escapes
remain intact. It never decodes the complete canonical value. A wholly encoded
legacy value beginning `%2F` may receive one compatibility decode before the
same validation; no other outer encoding is accepted.

Validation removes a literal fragment, checks a decoded copy of the path for
route safety, and preserves the accepted path and query text unchanged.
It rejects malformed escapes, invalid UTF-8, controls, unsafe or double-encoded
path delimiters and dot segments, site routes, account-entry and callback loops,
and credential query keys (`token`, `secret`, `code`, `session`) after strict
form decoding of each key. Query values are not decoded or serialized for
storage, so accepted query text survives the issue and exchange round trip
byte for byte. Invalid, absent or rejected values become `/dashboard`. The
normalized destination is stored with the magic link or GitHub flow and
returned by the exchange; no caller-supplied callback redirect overrides it.
API authorization still applies after navigation. The site and app share one
public origin in production; main-preview uses a separate app host. The API
has its own configured origin.

## Tokens And Email Delivery

Publishing secrets are `mkc_` plus 64 random lowercase hex digits. The visible
prefix is `mkc_` plus its first eight hex digits. Hash the entire secret using
SHA-256; random 256-bit credentials do not need a password stretching scheme.
The same rationale applies to magic links and sessions. Human passwords are
not accepted. Hashes never appear in resource DTOs; production diagnostics
never log credentials, cookies, CSRF tokens or email bodies.

Sign-in mail crosses the shared mail boundary as a typed message: the
recipient, the link and the same 15-minute validity as the stored link, never a
rendered body. `mkc-email-postmark` sends the committed sign-in template by alias
with a typed model, CSS inlining disabled and tracking disabled; Postmark
renders the subject, plain-text body and HTML body. The message's copy,
document and generation are the [Email](./email.md) contract. Failures keep
internal provider details behind the typed error contract.
The explicitly selected `log` mailer emits only the recipient and the
callback link to the process log; it needs no SMTP server. `MKC_ENV=preview`
permits log delivery and preview sign-in but requires HTTPS origins;
`development` permits both and loopback HTTP. These are separate named config
capabilities: a development exception must opt in explicitly and must not
silently affect previews. Restrict preview log access because callback links
grant access. Production config requires Postmark, which the adapter reaches
through the [published Postmark Templates API](https://postmarkapp.com/developer/api/templates-api).

Related: [Platform](./platform-model.md), [REST](./rest-api.md).
