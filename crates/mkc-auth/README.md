# mkc-auth

Magic-link, preview, desktop grant and session authentication for Mokly Cloud. The crate
owns the sign-in policy: it decides who is admitted, what a link or a session
means and when it expires. It depends on the `mkc-store-interface` queries,
the `mkc-email-interface` mailer and `mkc-domain` only; `mkc-api` constructs it,
maps its outcomes to HTTP and owns the cookie transport. Depend on
`Authenticator` from an API or application service.

## Responsibilities

Admit email, preview and desktop sign-in requests, issue and consume single-use credentials,
manage sessions, verify browser request binding and prune expired
authentication records.

## What This Crate Does

`AuthService` implements `Authenticator` with injected `dyn Store`,
`dyn Mailer` and `dyn Runtime`. Its methods are synchronous; call them on a
blocking worker. Credentials are 256-bit values from operating-system entropy
and are stored only as SHA-256 digests.

`issue` admits a request against the per-email and per-peer windows, stores
the link with its 15-minute expiry and the domain-validated `returnTo`, and
sends `Content::SignIn` through the mailer after the transaction commits; the
link lands at `/auth/email/callback#token=<secret>` on the configured app
origin, and the app owns the browser-history cleanup. `verify` consumes the
link once and issues the session atomically; `LinkVerified` returns the stored
destination unchanged, and a rejected or absent destination resolves to
`/dashboard`. A first-time verified email creates the account.

`authenticate` enforces the 30-day absolute and seven-day idle expiry and
refreshes activity at most every five minutes; `rotate` replaces the
credential and the CSRF token and keeps the absolute expiry; `sign_out`
revokes at once; `csrf` and `origin` bind browser requests to an admitted
origin and compare tokens in constant time. `session_policy` shares session
construction and the expiry boundaries with GitHub sign-in in `mkc-api`.

`AuthService::origins` takes the shared `AdmittedOrigins` policy. `origin` and
`csrf` return the admitted `ClientOrigin`; all other origins fail with
`CsrfFailed`. The caller passes that value to `issue`. Every admitted Origin
receives the same email landing on the public app origin. The API uses the same admitted client value
to select the session cookie's `SameSite` attribute for issue, rotation and
sign-out.

`preview` is available only when a `PreviewSignIn` is configured, which
`preview_sign_in_available` reports for the API's optional-operation gate. It
admits the peer before every credential outcome, checks the typed preview
password against the optional scrypt verifier and compares the hashes in
constant time, finds or creates the configured account and issues a session
like a link exchange. Without a verifier every password is refused, and an
unconfigured call returns `Error::PreviewSignInUnavailable`.

`preview_account` finds or creates that configured account for the API's
one-time preview seed. It shares the account policy with sign-in. It issues
no session, sends no email and creates no credential. It returns
`Error::PreviewSignInUnavailable` when preview sign-in is not configured.

`error::Error` distinguishes invalid input, invalid, expired and used links,
an unauthenticated or expired session, CSRF rejection and a rate limit with
its retry delay, without HTTP codes; `Internal` keeps a query failure's
source. Absence is a service decision: an unknown link is `InvalidLink` and a
missing session or user is `Unauthenticated`.

`prune::Pruner` deletes expired links, desktop grants, sessions and
rate-limit windows older than the configured retention. `AuthPruner` reads the
wall clock once to derive all cutoffs. Each transaction then deletes at most
1,000 rows of one kind, and the four kinds take turns until each is drained.
No batch or retry starts after a 480-second monotonic budget. Each delete
receives a statement timeout of at most five seconds, reduced to the remaining
budget before each attempt. The call returns the committed counts, so rows
left at the end of the budget wait for the next run. A database timeout or a
query error returns an error, and the earlier batches stay committed. The
API's `prune` command runs it with the `mkc-config` maintenance settings.

## Quick Start

```rust
use std::sync::Arc;

use mkc_email_interface::mail::Mailer;
use mkc_auth::error::Result;
use mkc_auth::runtime::SystemRuntime;
use mkc_auth::service::{AuthService, Authenticator, LinkIssued, PreviewSignIn};
use mkc_domain::client_origins::AdmittedOrigins;
use mkc_store_interface::store::Store;
use mkc_store_interface::user::User;

/// Compose the authenticator once at the composition root.
fn authenticator(
    store: Arc<dyn Store>,
    mailer: Arc<dyn Mailer>,
    app_origin: String,
    desktop_client: bool,
    preview_sign_in: Option<PreviewSignIn>,
) -> Arc<dyn Authenticator> {
    Arc::new(AuthService {
        store,
        mailer,
        runtime: Arc::new(SystemRuntime),
        origins: AdmittedOrigins::new(app_origin, desktop_client),
        preview_sign_in,
    })
}

/// Admit the request's Origin and send a sign-in link; the API maps the outcome to HTTP.
fn request_link(
    auth: &dyn Authenticator,
    origin: Option<&str>,
    email: &str,
    peer: &str,
) -> Result<LinkIssued> {
    let client = auth.origin(origin)?;
    auth.issue(email, Some("/dashboard"), peer, client)
}

/// Find the seed account after configuring PreviewSignIn at the composition root.
fn seed_account(auth: &dyn Authenticator) -> Result<User> {
    auth.preview_account()
}
```

## Development

```sh
cargo test -p mkc-auth
cargo clippy -p mkc-auth --all-targets -- -D warnings
```

Unit tests inject the store, the mailer and the runtime through their unimock
APIs, so no database or mail server is needed. Keep every query inside the
transaction callback and every policy decision in this crate: the store
returns `Option` for absence, and this crate decides what absence means.

### Key Code

- [service.rs](./src/service.rs) — `Authenticator`, the trait the API calls; `AuthService`, its implementation with the injected store, mailer, runtime and admitted origins; `PreviewSignIn`, the preview configuration with its optional verifier; and the results `LinkIssued`, `LinkVerified`, `SessionIssued` and `Identity`.
- [error.rs](./src/error.rs) — the authentication outcome contract: invalid, expired and used links, expired sessions, CSRF rejection and rate limits, with `Internal` keeping a query failure's source.
- [links.rs](./src/links.rs) — magic-link issue and exchange with one public app landing for every admitted Origin; `LINK_LIFETIME_MINUTES` names the 15-minute lifetime once for the stored link and the email copy.
- [preview.rs](./src/preview.rs) — preview sign-in and the seed account method; both reuse the account policy, and only sign-in admits a peer, checks the password and issues a session.
- [preview_verifier.rs](./src/preview_verifier.rs) — `PreviewVerifier` reads the scrypt parameters at startup and checks the password on a blocking worker.
- [desktop_grant.rs](./src/desktop_grant.rs) — desktop grant issue and exchange, separate persistent peer admission for each endpoint, constant-time challenge comparison under the grant lock, and session replacement with the stored absolute deadline.
- [desktop_grant_policy.rs](./src/desktop_grant_policy.rs) — desktop credential forms and the unpadded base64url S256 challenge of the verifier's text.
- [sessions.rs](./src/sessions.rs) — session authentication, rotation and revocation, and the Origin and CSRF checks, which return the admitted `ClientOrigin` and compare tokens in constant time with `subtle::ConstantTimeEq`.
- [session_policy.rs](./src/session_policy.rs) — `new_session`, `new_session_until`, `expired` and `IDLE_LIFETIME`, the ordinary and inherited session construction paths and the expiry rules shared with GitHub sign-in.
- [prune.rs](./src/prune.rs) — `Pruner`, `AuthPruner`, `Retention` and `PruneReport`, the batched cleanup behind the `prune` command, bounded by a row limit, a time budget and statement timeouts.
- [runtime.rs](./src/runtime.rs) — `Runtime` and `SystemRuntime`, the wall and monotonic clocks, the identifier and credential sources, and `hash`, the SHA-256 digest of a credential.

### Related Docs

- [Authentication](../../docs/protocol/cloud/auth-sessions.md)
- [Preview sign-in](../../docs/protocol/cloud/preview-sign-in.md)
- [Authentication callback landings](../../docs/protocol/cloud/auth-callbacks.md)
- [GitHub sign-in](../../docs/protocol/cloud/github-sign-in.md)
- [Desktop application](../../docs/protocol/cloud/desktop-app.md)
- [Email](../../docs/protocol/cloud/email.md)
- [Platform model](../../docs/protocol/cloud/platform-model.md)
- [Persistence boundaries](../../docs/protocol/cloud/persistence-boundaries.md)
- [Persistence transactions, migrations and retention](../../docs/protocol/cloud/persistence-transactions.md)
- [Architecture](../../docs/architecture/cloud.md) — the components, their boundaries, and the data flows this crate takes part in.
