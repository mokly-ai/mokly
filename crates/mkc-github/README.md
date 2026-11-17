# mkc-github

The GitHub App HTTP implementation for Mokly Cloud. It implements the
`mkc-github-interface` traits over reqwest: App JWT signing, installation
token caching, webhook signature verification and the typed REST and OAuth
requests. Construct the adapters at a composition root and inject the trait
objects into the GitHub services in `mkc-api`; the crate implements the
`Checks` trait that the `mkc-publications` check adapter delivers check runs
through, and the services never depend on this crate.

## Responsibilities

Sign App JWTs, cache installation tokens, verify webhook signatures and execute
typed GitHub REST and OAuth requests through reqwest.

## What This Crate Does

`GitHub` is one struct that implements `Repositories`, `Checks`,
`PullRequests` and `Identities` from injected `Http`, `Tokens` and `AppJwt`
trait objects. `ReqwestFactory`, `RsaSignerFactory` and `CachedTokensFactory`
return those trait objects, and `SystemClock` and `ThreadSleeper` are the
native `Clock` and `Sleeper`. Methods are synchronous; call them from a
blocking worker. `SystemGitHubProviderFactory` in `mkc-api` supplies the
composition; its API and web origins are GitHub's own unless a development
deployment points them at [`mkc-github-double`](../mkc-github-double/README.md).

The transport bounds a response to 8 MiB, a request to 30 seconds and
pagination to 100 pages, refuses paths outside the configured origins and
does not follow redirects. `RetryingHttp` honors a primary or secondary
rate-limit rejection by waiting once for a delay of at most 60 seconds, then
returns `Error::RateLimited`; an uncertain network failure is never replayed.
Installation tokens are reused until 60 seconds before expiry and refreshed
after one 401, and the refresh is serialized so that concurrent callers share
one fill. `Tokens::repository_read` mints a fresh single-repository
Contents-read token for each build attempt. It bypasses cache reads, writes
and refresh locking. PR references retain nullable repository IDs for fork
checks. Credentials have a redacted `Debug`.

Check recovery reads all Mokly runs for the configured App and head SHA,
paging up to 100 pages of 100 rows. It fails on an incomplete list instead of
returning partial input for a create. Check updates can replace the details URL.
Other client HTTP rejections retain their status, including 422; the publication
adapter applies the check retry contract.

`HmacVerifier` authenticates the original webhook bytes. API policy, durable
delivery storage, account linking and the delivery worker live in `mkc-api`;
this crate has no database dependency and returns the interface error contract
directly. An Enterprise installation owner decodes as typed account data, and
`mkc-api` decides which owner kinds may connect to a Mokly organization.

## Quick Start

```rust
use std::sync::Arc;

use mkc_github::client::{GitHub, OAuthSettings};
use mkc_github::runtime::{SystemClock, ThreadSleeper};
use mkc_github::signing::{RsaSignerFactory, SignerFactory};
use mkc_github::tokens::{
    CachedTokensFactory, InstallationTokenIssuer, MemoryTokenCache, TokensFactory,
};
use mkc_github::transport::{HttpFactory, ReqwestFactory, RetryingHttp};
use mkc_github_interface::credentials::{Clock, Secret};
use mkc_github_interface::error::Result;
use mkc_github_interface::http::Http;

/// Compose one `GitHub` adapter; it implements every provider trait.
fn github(
    client_id: String,
    client_secret: String,
    private_key_pem: &str,
    redirect_uri: String,
) -> Result<Arc<GitHub>> {
    let clock: Arc<dyn Clock> = Arc::new(SystemClock);
    let http: Arc<dyn Http> = Arc::new(RetryingHttp {
        http: ReqwestFactory.build("https://api.github.com", "https://github.com")?,
        clock: clock.clone(),
        sleeper: Arc::new(ThreadSleeper),
    });
    let jwt = RsaSignerFactory.build(client_id.clone(), private_key_pem, clock.clone())?;
    let tokens = CachedTokensFactory.build(
        Arc::new(MemoryTokenCache::default()),
        Arc::new(InstallationTokenIssuer {
            jwt: jwt.clone(),
            http: http.clone(),
        }),
        clock,
    );
    Ok(Arc::new(GitHub {
        http,
        tokens,
        jwt,
        oauth: OAuthSettings {
            client_id,
            client_secret: Secret::new(client_secret),
            redirect_uri,
        },
    }))
}
```

The returned `GitHub` serves as `Arc<dyn Repositories>`, `Arc<dyn Checks>`,
`Arc<dyn PullRequests>` and `Arc<dyn Identities>`; pair it with
`HmacVerifier { secret }` for webhook acceptance. Register the App and its
callback as the [manual smoke](../../docs/ops/github-app-smoke.md) describes.

## Development

```sh
cargo test -p mkc-github
cargo clippy -p mkc-github --all-targets -- -D warnings
MKC_TEST_DATABASE_URL=postgres://postgres:postgres@localhost/mkc_test \
  cargo test -p mkc-api --test github_tests -- --nocapture
```

Unit tests script the `Http` trait with the sanitized response records under
`fixtures/`; their [provenance](./fixtures/README.md) distinguishes fixtures
from live captures. The end-to-end GitHub scenarios run in `mkc-api` against
[`mkc-github-double`](../mkc-github-double/README.md), which replays those same
records over loopback HTTP.

### Key Code

- [client.rs](./src/client.rs) — `GitHub` and `OAuthSettings`, the composed adapter and the authenticated request path that retries once with a fresh installation token after a 401.
- [checks.rs](./src/checks.rs) — the `GitHub` implementation of `Checks`: the App-filtered recovery list of a head's Mokly runs and the check mutations.
- [repositories.rs](./src/repositories.rs), [pull_requests.rs](./src/pull_requests.rs) and [identity.rs](./src/identity.rs) — the `GitHub` implementations of `Repositories`, `PullRequests` and `Identities`.
- [tokens.rs](./src/tokens.rs) — `CachedTokensFactory`, `MemoryTokenCache` and `InstallationTokenIssuer`: the installation token cache with one refresh lock, reuse until 60 seconds before expiry, and invalidation on uninstall, suspension, disconnect or a 401, and the uncached single-repository token a build attempt mints.
- [transport.rs](./src/transport.rs) — `ReqwestFactory`, the bounded transport, and `RetryingHttp`, which waits once for a rate-limit delay of at most 60 seconds.
- [signing.rs](./src/signing.rs) — `RsaSignerFactory`, the RS256 App JWT signer with injected time.
- [security.rs](./src/security.rs) — `HmacVerifier`, the raw-body HMAC check, and `pkce_challenge`, the S256 encoding.
- [runtime.rs](./src/runtime.rs) — `SystemClock` and `ThreadSleeper`, the native clock and blocking sleeper.
- [response.rs](./src/response.rs) — the status classification into the interface errors and the typed JSON decoding.

### Related Docs

- [GitHub App](../../docs/protocol/cloud/github-app.md)
- [GitHub sign-in](../../docs/protocol/cloud/github-sign-in.md)
- [Changes check](../../docs/protocol/cloud/changes-check.md)
- [GitHub App manual smoke](../../docs/ops/github-app-smoke.md)
- [Architecture](../../docs/architecture/cloud.md) — the components, their boundaries, and the data flows this crate takes part in.
