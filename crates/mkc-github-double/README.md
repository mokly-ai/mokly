# mkc-github-double

The recorded GitHub that Mokly Cloud develops and tests against. Depend on it
only from development and test wiring: the Rust integration harness starts it
in-process, and the browser suite runs it beside the API as a binary. Nothing
in production may depend on this crate.

## Responsibilities

Answer the exact GitHub API and OAuth requests `mkc-github` sends, from
recordings captured once from the provider, and make each scenario a
deliberate, inspectable choice.

## What This Crate Does

`RecordedGitHub::start` opens a real HTTP listener on a given address, answers
requests from a background thread, and stops when the value is dropped. Its
`origin` is what a deployment configures as both `MKC_GITHUB_API_ORIGIN` and
`MKC_GITHUB_WEB_ORIGIN`, so the App installs, authorizes, exchanges codes,
mints installation and repository-scoped tokens, lists repositories, reads
pull requests and branches, and creates, lists and updates check runs without
reaching GitHub.

`routes::route` is the whole table, a pure function over one `Received` request
and the shared `Mode`. It verifies the headers every GitHub client sends
(`X-GitHub-Api-Version`, `User-Agent`, `Accept`, and `Authorization` outside
the token exchange), then replays a `Recorded` answer. A request the table does
not cover is answered `501`, and a mismatched header or body field `400`, so
drift surfaces as a failing provider call instead of a silent success.

`Mode` holds both the scenario toggles and the App identity requests must
present: `app_origin`, `client_id` and `client_secret` for the token exchange,
and `app_id` for check-run lists. Defaults replay one installed public
repository for the fixture App at `https://app.example.com`; a browser suite
running the app on another origin passes its own. The remaining fields drive
suspension, uninstallation, repository renames, visibility and default
branches, exact or redirected branch reads and their failures, pull request
heads, forks and closure, lost check-run answers, the hooks a scenario runs
during one branch or pull request read, and the request counters scenarios
assert on. `second_installation` adds provider installation 2 on `fixture-org`,
an active administrator membership and one separately token-scoped repository.
Its suspension and repository rename have independent scenario fields. Check runs are stateful: a create is stored, listed on its commit
and updated in place.

Recordings are the sanitized JSON documents in `crates/mkc-github/fixtures`,
compiled in, so the double has no runtime files. Webhook deliveries are not
served here; the API's own integration suite posts those directly.

## Quick Start

Run it beside the API and point a development deployment at it:

```sh
cargo run -p mkc-github-double -- serve --bind 127.0.0.1:8090
# prints the origin on one line, then answers until terminated
MKC_ENV=development \
MKC_GITHUB_API_ORIGIN=http://127.0.0.1:8090 \
MKC_GITHUB_WEB_ORIGIN=http://127.0.0.1:8090 \
  cargo run -p mkc-api -- serve
```

`serve` takes `--bind` (port `0` chooses a free port), `--app-origin`,
`--client-id` and `--client-secret` for the credentials the token exchange must
present, and `--app-id` for the App whose check runs it lists. It exits on
`SIGTERM` or `SIGINT`.

Pass `--second-installation` to also serve provider installation 2 on
`fixture-org`, with its administrator membership and separate repository.
The flag is off by default. The app browser suite enables it for walks that
connect more than one account.

In Rust, start it in-process and drive the scenario through `mode`:

```rust
use std::sync::PoisonError;
use mkc_github_double::server::RecordedGitHub;

let github = RecordedGitHub::start("127.0.0.1:0".parse()?)?;
let origin = github.origin.clone();
github
    .mode
    .lock()
    .unwrap_or_else(PoisonError::into_inner)
    .suspended = true;
```

## Development

```sh
cargo test -p mkc-github-double
cargo clippy -p mkc-github-double --all-targets -- -D warnings
```

The recordings and their provenance live with
[mkc-github's fixtures](../mkc-github/fixtures/README.md). Adding a provider
call means adding its recording there and its arm in `routes.rs`; until then
the double reports the call as unrecorded.

### Key Code

- [routes.rs](src/routes.rs) — the complete recorded route table.
- [checks.rs](src/checks.rs) — stateful check-run create, list and update.
- [repos.rs](src/repos.rs) — pull request and branch reads.
- [installations.rs](src/installations.rs) — the second account, its administrator proof and its separate token and repository selection.
- [mode.rs](src/mode.rs) — scenario state and expected App credentials.
- [server.rs](src/server.rs) — the listener, its thread and its shutdown.
- [cli.rs](src/cli.rs) — the `serve` command.

### Related Docs

- [GitHub App](../../docs/protocol/cloud/github-app.md)
- [GitHub transport](../mkc-github/README.md)
- [API composition](../mkc-api/README.md)
- [Repository layout](../../docs/protocol/cloud/repository-layout.md)
