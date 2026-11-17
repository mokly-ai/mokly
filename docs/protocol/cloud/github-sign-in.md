# GitHub Sign-In

GitHub and magic links authenticate the same Mokly user. GitHub installation
authorization is separate from account authentication; see [GitHub App](./github-app.md).
The [session](./auth-sessions.md) cookie, expiry, rotation and CSRF contracts
apply to both providers.

## Web Flow

`POST /v1/auth/github` accepts optional `returnTo`, requires an admitted
Origin and returns `authorizeUrl`, `state` and `codeVerifier` under `no-store`.
The [Origin policy](./auth-sessions.md#csrf-origins-and-redirects) includes the
desktop origin when enabled.
Generate independent 256-bit state and verifier values. Persist only their
SHA-256 digests, the validated destination, purpose, optional initiating user
and session hashes, and ten-minute expiry. Do not store an OAuth
code, user access/refresh token or plaintext verifier. The browser keeps state
and verifier in session storage for that tab and removes them after exchange.
Persistent admission is limited to 20 starts per socket peer per minute.
A generated state-hash collision aborts issuance as `internal-error` with a typed
entropy-failure cause; it does not overwrite a flow or request client correction.

Redirect to `https://github.com/login/oauth/authorize` with the configured
client ID, exact `<app-origin>/auth/github/callback`, state, `code_challenge_method=S256`
and base64url-without-padding SHA-256 challenge of the verifier. GitHub Apps
support PKCE. No OAuth scope string is sent: the registered App permissions
include account Email addresses read. The user explicitly authorizes the App.

The `/auth/github/callback` landing compares callback state to its tab's stored
purpose-scoped state, then sends
`POST /v1/auth/github/callback` with `code`, `state`, `codeVerifier`. The API
requires Origin, verifies state/verifier digests and expiry and consumes the
flow atomically **before** exchanging the code. Unknown, expired, consumed or
mismatched values return `github-auth-invalid`. Concurrent callbacks have one
winner. Provider failures require starting a new flow; no used flow is restored.
Denied authorization follows the same recovery and never issues a session.

Exchange at `/login/oauth/access_token` with client ID/secret, code, verifier
and exact redirect URI; request JSON. Fetch `/user` and `/user/emails` using
the resulting short-lived user token. Use only an email whose `primary` and
`verified` fields are both true; profile `email` and GitHub login are not
verification evidence. Missing proof returns `github-email-unverified`.
Normalize with the same email validation as magic links. Discard all provider
credentials after the callback, including refresh tokens.

## Identity And Session Transaction

The stable numeric GitHub user ID is unique, and each Mokly user may link one
GitHub identity. For a returning identity, keep its existing Mokly user even
if GitHub email or login changes; update the displayed GitHub login only.
For an unlinked identity signing in without an authenticated actor, match the
verified primary normalized email to the existing magic-link user or create
that user. Email uniqueness, identity insert and session issue commit
atomically; concurrent first sign-ins of one email yield one account.
Never move an identity between accounts because of an email change.

`POST /v1/github/connection` starts the same flow for a signed-in user, with
Origin and CSRF. Bind it to the initiating session and user. Callback must use
that same authenticated session and its CSRF token. A new link still requires a
verified primary GitHub email, which may differ from the Mokly account email.
The bound session, CSRF and callback binding prove which account receives the
link; email equality is unnecessary for an authenticated connect or install.
An identity already linked to another user,
or an actor already linked to a different GitHub identity, returns
`github-identity-conflict`. Both guards prevent silent account switching.
Installation flows share this binding.

On success write the user's GitHub integration and issue a normal Mokly
session, revoking any supplied prior session atomically. The HTTP response
sets the cookie under the shared [session rule](./auth-sessions.md#sessions),
including its current-request Origin selection, and returns the ordinary
`SessionIssued` object with the stored `returnTo`. Signed-in linking and
installation also rotate the session. No provider credential appears in a
resource DTO or cookie.

`DELETE /v1/github/connection` requires session, Origin and CSRF. It removes
the identity and user integration; email sign-in stays usable and workspace
installations stay independently authorized. Subsequent GitHub sign-in must
prove its current verified primary email again. It never transfers an identity
or changes the Mokly account's email address.

## Navigation And Recovery

Normalize `returnTo` as [Product navigation](./product-navigation.md) defines:
accept a safe same-origin relative product destination, decode once, and
reject hosts/schemes, double slashes, backslashes, controls, dot segments and
credentials. Reject the marketing home and site-owned first segments, plus
`sign-in`, `sign-up` and `auth`, including trailing slashes and descendants;
invalid input becomes `/dashboard`. Store it through setup and OAuth; callback
query/body values cannot override it. Authorization is rechecked at the
destination. The application removes the code and state from the address
before its router starts or any third-party resource loads. Referrer policy is
`no-referrer` there.
Storage purposes, signed-in header selection, installation-flow handoff and
recovery copy are defined in
[Authentication callbacks](./auth-callbacks.md).

Use normal sign-in recovery for expired/invalid flow or provider outage;
offer email sign-in when GitHub cannot verify the primary address. There is no
API-hosted sign-in page; these endpoints define the transport contract of the
app's sign-in routes.

## Sources

Automated tests never contact GitHub; live authorization is checked by the
manual [smoke procedure](../../ops/github-app-smoke.md).

Provider references: [user token web flow](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app),
[PKCE support](https://github.blog/changelog/2025-07-14-pkce-support-for-oauth-and-github-app-authentication/),
[email endpoint](https://docs.github.com/en/rest/users/emails#list-email-addresses-for-the-authenticated-user).
