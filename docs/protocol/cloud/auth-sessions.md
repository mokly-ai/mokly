# Authentication And Sessions

Email sign-in and sign-up share one flow. [GitHub sign-in](./github-sign-in.md)
links by verified primary email and uses the same session policy. Previews add
one [shared password](./preview-sign-in.md). The desktop app signs in with a
[desktop grant](#desktop-grants) from a browser session. The
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

The email URL is `<app-origin>/auth/email/callback#token=<secret>` for every
admitted Origin. Its fragment keeps the credential out of HTTP access logs and
referrers. The application removes it from the address before its router
starts, and the
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

A preview signs one shared account in with a shared preview password, which
`POST /v1/auth/preview` checks against a slow verifier, only under the
`preview_sign_in` capability that production never grants.
[Preview sign-in](./preview-sign-in.md) defines the account settings, the
verifier, the exchange and the configuration answer. The exchange issues
sessions exactly as this page defines.

## Desktop Grants

A desktop grant signs the [desktop app](./desktop-app.md#sign-in) in to the
account of a browser session. [Desktop sign-in](./desktop-sign-in.md) defines
the page that requests it, and
[Authentication callbacks](./auth-callbacks.md#desktop-callback) the landing
that exchanges it.

The app holds a verifier of 32 cryptographically random bytes as 64 lowercase
hex digits. Its challenge is the S256 challenge: the base64url encoding,
without padding, of the SHA-256 digest of the verifier's text, 43 characters.

`POST /v1/auth/desktop/grants` accepts `challenge` and optional `returnTo`. It
requires the session, its CSRF token and an admitted Origin. A challenge that
is not 43 base64url characters returns `desktop-grant-invalid`. The grant is
32 cryptographically random bytes encoded as 64 lowercase hex digits. The API
stores only its SHA-256 digest, with the challenge, the issuing user, the
issuing session's absolute deadline and the normalized `returnTo`. A grant is
single use. It expires five minutes after issue, or at that deadline when it
is earlier. The response carries the grant and its expiry under
`Cache-Control: no-store` and sets no cookie.

`POST /v1/auth/desktop/callback` accepts `grant` and `verifier` and requires an
admitted Origin; like the magic-link exchange, it cannot require a session
CSRF token. One transaction consumes the grant only when it is unexpired,
unused and bound to the challenge of `verifier`. The same transaction revokes
a supplied existing session and issues a session for the grant's user.
Every other input returns `desktop-grant-invalid`: a malformed grant or
verifier, an unknown, expired or used grant, or a verifier that does not
match. One reason covers every invalid input, as `github-auth-invalid` does,
because the app recovers from each in the same way. Concurrent exchanges of
one grant yield one session. A program that receives a grant without its
verifier cannot exchange it.

The new session keeps the absolute deadline of the session that issued the
grant, and its cookie's `Max-Age` is the time left until that deadline. A
grant therefore never extends the 30-day limit from authentication. A fresh
30 days for each grant was rejected, because a session could then renew itself
through grants without end. The response sets the cookie by the
[session rule](#sessions), with `SameSite` from the request's Origin, and
returns the ordinary `SessionIssued` object with the stored `returnTo` and
`Cache-Control: no-store`.

Each endpoint admits at most 20 attempts per selected peer IP per 60 seconds
in a persistent fixed window. A rejected admission returns 429 `rate-limited`
with a positive `Retry-After` in seconds. An attempt consumes admission once
it passes the session, Origin, CSRF and body-shape checks that its endpoint
makes. The authentication pruning job removes grants on the magic-link
retention, `MKC_AUTH_LINK_RETENTION_SECONDS`: seven days after expiry by
default, used grants included.

## Sessions

The response sets `mkc_session=<random secret>; Path=/; Secure; HttpOnly;
SameSite=Lax; Max-Age=2592000`. There is no Domain attribute. An exchange
whose Origin is the desktop origin receives `SameSite=None` in place of `Lax`
with every other attribute unchanged, because the desktop page is cross-site
to the API. All desktop grant, magic-link, preview and GitHub exchanges,
rotation with `POST /v1/session`, and clearing with `DELETE /v1/session` select
`SameSite` from that request's Origin. The credential
has 256 random bits; only its SHA-256 digest is stored. Cookies stay Secure
in development too.
The absolute lifetime is 30 days; idle lifetime is seven days. A session from
a [desktop grant](#desktop-grants) keeps the absolute deadline of the session
that issued the grant. Successful
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
desktop grant, magic-link, preview or GitHub exchange also revokes a supplied
existing session before issue.
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

The API and the catalogue server share that exact set. `MKC_DESKTOP_CLIENT`
accepts only `true` or `false`; absence means `false`, and any other value
stops startup with a typed configuration error.

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
normalized destination is stored with the magic link, desktop grant or GitHub
flow and returned by the exchange; no caller-supplied callback redirect
overrides it.
API authorization still applies after navigation. The site and app share one
public origin in production; main-preview uses a separate app host. The API
has its own configured origin.

## Tokens And Email Delivery

Publishing secrets are `mkc_` plus 64 random lowercase hex digits. The visible
prefix is `mkc_` plus its first eight hex digits. Hash the entire secret using
SHA-256; random 256-bit credentials do not need a password stretching scheme.
The same rationale applies to magic links, desktop grants and sessions. Human
passwords are not accepted, except the
[preview password](./preview-sign-in.md#verifier), which only a preview
accepts and which a slow scrypt verifier checks. Hashes never appear in
resource DTOs; production diagnostics
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
