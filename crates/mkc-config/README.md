# mkc-config

Typed environment configuration for the Mokly Cloud API and catalogue
binaries. `EnvironmentConfig` reads the process environment through
`dyn Environment`, validates every value and returns typed settings that the
composition roots in `mkc-api` and `mkc-catalogue-server` pass on to their
services; no service reads the environment itself. Depend on it at process
startup only. [Environments](../../docs/ops/environment.md) owns the variable
inventory with each setting's deployment, default and limit.

## Responsibilities

Validate deployment origins, the listener, the Postgres URL, the optional
GitHub, billing, cloud build and preview sign-in settings, the desktop client
flag, the explicit mail delivery selection, the catalogue origin and storage,
trusted proxies and maintenance retention.

## What This Crate Does

`MKC_ENV` selects explicit capabilities. An absent value means production and
an unknown value fails startup.

| `MKC_ENV`              | Log mailer | HTTP loopback origins | Preview sign-in |
| ---------------------- | ---------- | --------------------- | --------------- |
| `production` (default) | Rejected   | Rejected              | Rejected        |
| `preview`              | Allowed    | Rejected              | Allowed         |
| `development`          | Allowed    | Allowed               | Allowed         |

Every mode accepts HTTPS origins and Postmark with its sender, token and
validated `MKC_SITE_ORIGIN`; the site origin may differ from `MKC_APP_ORIGIN`,
as it does on main-preview. Only development accepts HTTP, and only on
`localhost`, `127.0.0.1` or `[::1]`. Log delivery and preview sign-in are
separate named capabilities, and a future relaxation opts into its own.
`Settings`, `Mail` and every secret-bearing settings type omit `Debug`.

`Settings.app_origin` and `Settings.api_origin` are exact origins: HTTPS, or
loopback HTTP in development, with no path, query, fragment or credentials,
serialized as bare origins. The API origin starts every upload plan's blob and
completion URL. A missing, empty or invalid value fails startup with
`Error::Invalid` naming the key; a configuration error never includes a value.

Both `Settings` and `CatalogueSettings` read `MKC_DESKTOP_CLIENT` into
`desktop_client`. An absent setting or exact `false` disables desktop origin
admission. Exact `true` enables it. All other values, including empty strings
and whitespace, stop startup with `Error::Invalid("MKC_DESKTOP_CLIENT")`.
The process adapter keeps non-Unicode values present as empty input, so they
also fail strict flag validation instead of using the absent-value default.

Preview sign-in is optional: `MKC_PREVIEW_SIGN_IN_EMAIL` passes the shared
account email validator and configures the shared account. Optional
`MKC_PREVIEW_SIGN_IN_VERIFIER` holds the scrypt verifier of the preview
password, within the parameter bounds of
[Preview sign-in](../../docs/protocol/cloud/preview-sign-in.md#verifier).
Optional `MKC_PREVIEW_SIGN_IN_PLAN` accepts `free` (the absent default) or
`team`. The verifier and the plan each require the email and the capability.
Malformed values, a setting without the email, and forbidden environments
have distinct typed key-only failures, which never include a value.
`PreviewSignInSettings.plan` is the initial plan for organizations created by
the configured normalized email; existing plans do not change.
`GitHubConfigProvider` enables the App integration only when all six
`MKC_GITHUB_*` settings are present. Its
transport origins default to `https://api.github.com` and `https://github.com`.
`MKC_GITHUB_API_ORIGIN` and `MKC_GITHUB_WEB_ORIGIN` replace them only under the
HTTP-loopback capability: both must be set together, and either alone or
outside development fails startup naming the key.
`BillingConfigProvider` treats an absent or empty `MKC_BILLING` as disabled;
`stripe` requires the API key and the webhook secret, and an HTTP Stripe
origin is accepted only in development.

`BuildConfigProvider` reads the all-or-none `MKC_E2B_API_KEY`,
`MKC_E2B_BUILD_TEMPLATE` and `MKC_E2B_DEPLOYMENT_ID` group. It requires GitHub
configuration. The deployment ID accepts 1–63 lowercase letters, digits and
hyphens. Optional `MKC_BUILDS_PER_PROCESS` accepts 1–16 and defaults to 4.
Optional `MKC_E2B_DENIED_DESTINATIONS` accepts at most 32 comma-separated IPs
or CIDRs. Optional settings without the group also fail. Values have no
Debug or serialization implementation.

`PublicationSettings` validates the catalogue origin, which must not share a
registrable domain with the app origin (except `localhost` under the
development capability), the 256-bit signing key and the explicit storage:
GCS with a bucket and an optional `ObjectPrefix`, or a local directory in
development. It also carries the upload memory budget, the ingest worker
count, the strict `MKC_UPLOAD_BLOB_GZIP` Plan-advertisement flag, and the
catalogue hot-cache capacity. `CatalogueConfig` loads the
catalogue binary's settings without mail credentials, and `MaintenanceConfig`
loads the database URL and the retention windows of the maintenance commands,
including the build retention window, without build provider credentials.
`GitHubRetentionConfig` adds the database-only OAuth-flow and
terminal-delivery windows. `PublicationMaintenanceConfig` loads only the
database URL, `MKC_ENV` and the explicit file storage that publication cleanup
uses. Neither loads mail, GitHub or catalogue-signing credentials.
`TrustedProxies::client_ip` is pure: it returns the socket peer unless every
configured hop is in the allowlist.

## Quick Start

```rust
use std::sync::Arc;

use mkc_config::catalogue::{CatalogueConfig, CatalogueSettings};
use mkc_config::maintenance::{MaintenanceConfig, MaintenanceSettings};
use mkc_config::settings::{ConfigProvider, Environment, EnvironmentConfig, Result, Settings};

/// Load the API settings from the process environment at startup.
fn api_settings(environment: Arc<dyn Environment>) -> Result<Settings> {
    EnvironmentConfig { environment }.load()
}

/// Load the catalogue server settings; no mail credentials are read.
fn catalogue_settings(environment: Arc<dyn Environment>) -> Result<CatalogueSettings> {
    EnvironmentConfig { environment }.catalogue()
}

/// Load the database URL and retention windows for the `prune` command.
fn maintenance_settings(environment: Arc<dyn Environment>) -> Result<MaintenanceSettings> {
    EnvironmentConfig { environment }.maintenance()
}
```

Pass `Arc::new(ProcessEnvironment)` as the environment at a composition root.

## Development

```sh
cargo test -p mkc-config
cargo clippy -p mkc-config --all-targets -- -D warnings
```

Unit tests inject `Environment` through its unimock API, `EnvironmentMock`, so
no process environment is needed. Add a new setting to
[Environments](../../docs/ops/environment.md) in the same change; the Helm
check compares the documented and the rendered settings in both directions.

### Key Code

- [settings.rs](./src/settings.rs) — `Environment` and `ProcessEnvironment`, the environment seam; `EnvironmentConfig` and `ConfigProvider::load`, which return `Settings` with its `Mail` selection; `Error`, whose `Invalid` variant names only the key; and `validate_origin`, the exact-origin rule.
- [capabilities.rs](./src/capabilities.rs) — the `MKC_ENV` modes and the named capabilities each one grants.
- [preview.rs](./src/preview.rs) — `PreviewSignInSettings` loads the shared account's email, its optional `mkc-auth` verifier, and its initial workspace plan under the `preview_sign_in` capability.
- [desktop.rs](./src/desktop.rs) — `DesktopConfig`, the strict `MKC_DESKTOP_CLIENT` flag that both `Settings` and `CatalogueSettings` read.
- [github.rs](./src/github.rs) — `GitHubSettings`, `GitHubConfigProvider` and `GitHubEnvironmentConfig`, the all-or-none App integration.
- [billing.rs](./src/billing.rs) — `BillingSettings`, `BillingConfigProvider` and `BillingEnvironmentConfig`, the explicit Stripe selection and origin rule.
- [builds.rs](./src/builds.rs) — `BuildSettings`, `BuildConfigProvider` and `BuildEnvironmentConfig`, the all-or-none E2B build group, which requires the GitHub settings.
- [publications.rs](./src/publications.rs) — `PublicationSettings`, `FileStorage` and `PublicationConfig`, the catalogue origin isolation, signing key, storage and runtime bounds shared by both binaries.
- [catalogue.rs](./src/catalogue.rs) — `CatalogueSettings` and `CatalogueConfig`, the catalogue binary's loader without mail credentials.
- [proxy.rs](./src/proxy.rs) — `TrustedProxies`, `TrustedProxies::client_ip` and `ProxyConfig`, the bounded trusted-hop walk.
- [maintenance.rs](./src/maintenance.rs) — `MaintenanceSettings` and `MaintenanceConfig`, the database-only settings of the `prune` and `migrate` commands; `GitHubRetentionSettings` and `GitHubRetentionConfig` for `prune-github`; and `PublicationMaintenanceSettings` and `PublicationMaintenanceConfig`, the database and file-store settings of `maintain-publications`.

### Related Docs

- [Environments](../../docs/ops/environment.md) — the variable inventory, defaults and limits.
- [Preview sign-in](../../docs/protocol/cloud/preview-sign-in.md) — the shared account, the verifier and the plan.
- [Desktop application](../../docs/protocol/cloud/desktop-app.md#api-and-catalogue-admission) — the desktop origin that `MKC_DESKTOP_CLIENT` admits.
- [GitHub App](../../docs/protocol/cloud/github-app.md)
- [Billing](../../docs/protocol/cloud/billing.md)
- [Catalogue hosting](../../docs/protocol/cloud/catalogue-hosting.md)
- [REST trusted proxies](../../docs/protocol/cloud/rest-proxies.md)
- [Publication storage](../../docs/protocol/cloud/persistence-publication-storage.md#object-prefixes) — object prefixes.
- [Architecture](../../docs/architecture/cloud.md) — the components, their boundaries, and the data flows this crate takes part in.
