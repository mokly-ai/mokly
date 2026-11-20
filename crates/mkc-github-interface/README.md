# mkc-github-interface

Typed GitHub App provider contracts for Mokly Cloud. The GitHub services in
`mkc-api` and the publication and build check workers in `mkc-publications`
depend on these traits. `mkc-github` implements every trait except `CheckRuns`
over HTTP, and `mkc-publications` implements `CheckRuns` over `Checks`. Depend
on this crate from a service that needs GitHub behavior and inject the traits,
so the service never depends on the HTTP implementation.

## Responsibilities

Own the App authentication, installation credential, repository, check, pull
request and user identity contracts, the HTTP and webhook-verification seams,
and the narrow idempotent check-run contract the publication and build check
workers deliver through.

## What This Crate Does

`AppJwt`, `Tokens`, `Repositories`, `Checks`, `PullRequests` and `Identities`
are synchronous, thread-safe behavior contracts; call them on a blocking
worker. `Clock`, `Sleeper`, `TokenCache`, `TokenIssuer`, `Http` and
`WebhookVerifier` are the replaceable seams an adapter composes. Every trait
has a unimock API.

`error::Error` exposes the handled outcomes `InvalidRequest`, `Unauthorized`,
`Forbidden`, `NotFound`, `InvalidCode`, `RateLimited { retry_after }`,
`Unavailable` and `Http { status }`, which keeps any other client HTTP status;
unhandled provider and transport failures keep their typed sources in
`Internal`. `Secret` redacts `Debug` and has no serialization. Installation
IDs and provider record IDs are GitHub integers; product UUIDs belong to
`mkc-domain`. `Tokens::repository_read` and `TokenIssuer::issue_repository`
define uncached single-repository Contents-read credential minting for a build
attempt. An installation owner is a `User`, `Organization`, `Bot` or
`Enterprise` account, and which of them may connect to a Mokly organization is
the caller's policy.

`checks::Checks` lists a head's Mokly runs for one App, and creates, updates
and rerequests check runs. The list includes all runs so callers can reconcile
a lost create response; callers supply a stable external ID and own
reconciliation after an uncertain write. `check::CheckRuns::upsert` is the
boundary of the publication and build check workers: it accepts the project
ID, the lifecycle status and a conclusion exactly when completed, and
reconciles by repository, head SHA and stable external ID, so repeated calls
update the same check after a lost response or a worker crash.
`check::Error::is_permanent` separates validation failures and non-transient
client responses from timeouts, transport failures, 5xx, HTTP 408 and 429 and
provider-confirmed rate limits; only permanent errors consume the worker's
dead-letter budget.

Pull request metadata includes the merged state and the nullable author login
from both detail and list responses; a missing provider user stays null, and
callers never invent an author. Head and base refs also carry nullable
repository IDs; a deleted repository stays absent. Reviews and review comments
are provider operations only; no product feature uses them. Account linking
and organization authorization belong to `mkc-api`, and persistence to
`mkc-store-interface`.

## Quick Start

```rust
use mkc_github_interface::checks::{Checks, Create};
use mkc_github_interface::error::Result;

fn publish(checks: &dyn Checks, installation: i64, input: &Create) -> Result<i64> {
    Ok(checks.create(installation, "owner/repository", input)?.id)
}
```

## Development

```sh
cargo test -p mkc-github-interface
cargo clippy -p mkc-github-interface --all-targets -- -D warnings
```

Test a service against the exported unimock APIs; only `mkc-github` reaches
live GitHub.

### Key Code

- [credentials.rs](./src/credentials.rs) — `Secret`, `InstallationToken` and the `Clock`, `Sleeper`, `AppJwt`, `TokenIssuer`, `TokenCache` and `Tokens` seams, including the uncached single-repository `Tokens::repository_read` a build attempt uses.
- [check.rs](./src/check.rs) — `CheckRuns::upsert`, the idempotent check-run boundary of the publication and build check workers, with its `CheckRun`, `Conclusion` and `Error::is_permanent`.
- [checks.rs](./src/checks.rs) — `Checks`, the provider list, create, update and rerequest contract, and its `Create`, `Update`, `Output`, `Status` and `Conclusion` values.
- [repositories.rs](./src/repositories.rs) — `Repositories`, the installation, repository list and branch reads, and the `Installation`, `Account` and `AccountKind` values.
- [pull_requests.rs](./src/pull_requests.rs) — `PullRequests`, the detail and list reads and the review and comment operations, and `PullRequest` with its nullable author.
- [identity.rs](./src/identity.rs) — `Identities`, the OAuth code exchange and the user, email, installation and membership evidence read during a callback.
- [http.rs](./src/http.rs) — `Http`, `Request`, `Response`, `Method` and `Endpoint`, the recorded HTTP boundary that keeps consumers independent of reqwest.
- [webhooks.rs](./src/webhooks.rs) — `WebhookVerifier`, the raw-body signature check.
- [error.rs](./src/error.rs) — `Error`, the shared provider outcomes, and `Result`.

### Related Docs

- [GitHub App](../../docs/protocol/cloud/github-app.md)
- [GitHub sign-in](../../docs/protocol/cloud/github-sign-in.md)
- [Changes check](../../docs/protocol/cloud/changes-check.md)
- [Architecture](../../docs/architecture/cloud.md) — the components, their boundaries, and the data flows this crate takes part in.
