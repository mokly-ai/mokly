# mkc-domain

Pure identity, permission and validation types for Mokly Cloud. The service,
API, store, and contract crates depend on it and it depends on nothing in the
Cargo workspace: it generates no IDs, reads no clock and performs no IO. Depend on it when a boundary needs
typed platform values without runtime dependencies; runtime generation lives
in `mkc-auth` and the persisted records in `mkc-store-interface`.

## Responsibilities

Own opaque entity IDs, typed readable slugs and reserved route data, canonical
application paths, the admitted client origins, roles, visibility, the typed
billing catalogue and plan/seat-kind values, email/name/config validation and
safe return destinations, SHA-256 blob hashes and fenced object keys, and
validated entry paths.

## What This Crate Does

`ids` holds one opaque UUID newtype per entity; installation and repository
UUIDs stay distinct from GitHub's numeric provider IDs. `BuildId`
distinguishes a cloud build from its publication and repository. `values`
holds the finite `Role`, `Visibility`, `Plan` and `SeatKind` vocabularies, and
`SeatKind::of_role` derives the Editor and Collaborator seat kinds from a role
instead of storing them on users. `Plan::allows_publication` is the shared
public/private publication gate for project capabilities, uploads and builds.
`billing::CATALOGUE` is the typed plan catalogue with the Stripe product and
lookup-key identity, prices, nicknames, tax behavior, trial, recurrence and
API version that the billing services consume, and
`Catalogue::identity_violations` performs the same offline identity check as
the catalogue tooling.

`pull_request::PullRequestRepositories::is_fork` compares retained head and
base GitHub IDs with the project's bound repository. A foreign or missing ID
is a fork. Reference reads and both build scheduling paths use this same rule.

`slug` owns the validated workspace and project address segments, the
reserved names shared with the site and the app (the site's first segments,
the static Expo routes including `/_sitemap`, and the GitHub reserved-name
list under `data/`) and deterministic candidate derivation; UUIDs remain the
identity that authorization and the API operations use. `app_paths` builds the
root-relative account, callback landing, workspace, project and
publication addresses. `validation` normalizes emails and names. It validates
GitHub repository names and repository-relative config paths ending in `.json`.
Config validation refuses `.ts` paths. `repository::RepositoryIdentity` validates portable
CLI repository identities and produces their canonical stored spelling.
`return_to` accepts a safe root-relative product path
and falls back to `/dashboard`: it validates a decoded copy of the path and
query keys while the accepted destination keeps its query escapes, Unicode,
`+` characters and repeated-key order, and a value beginning with `%2F` is
decoded once before validation.

`client_origins::AdmittedOrigins` classifies exact public-app and optional
desktop origins and enumerates the same set for CORS and framing.
`client_origins::DESKTOP_ORIGIN` owns `mokly-app://desktop`.
Its Rust test reads [desktop-origin.json](../../fixtures/desktop-origin.json),
the shared fixture for the web-app and shell readers. `app_paths` owns
`EMAIL_DESKTOP_CALLBACK`, the public email landing with `?client=desktop`.

`entry_path` owns the portable Mokly entry grammar. `entry_path::entry_path`
checks the grammar without a byte or segment quota, for the contract receiver
with its own artifact limits, and `EntryPath` applies the 2048-byte cloud
selection limit to API values, cursor keys and admission observations, with
checked JSON decoding and string serialization. `blob` holds `BlobHash`, the
SHA-256 content identity, and `BlobKey`, the hash plus incarnation whose
`object_name` is the canonical private object name of every file store.

## Quick Start

```rust
use mkc_domain::billing::CATALOGUE;
use mkc_domain::entry_path::EntryPath;
use mkc_domain::slug::WorkspaceSlug;
use mkc_domain::validation;

assert_eq!(CATALOGUE.product.lookup_key, "mokly_team");
assert!(CATALOGUE.identity_violations().is_empty());
assert!("Product/Welcome_1".parse::<EntryPath>().is_ok());
assert!("acme".parse::<WorkspaceSlug>().is_ok());
assert_eq!(validation::return_to(Some("https://evil.example")), "/dashboard");
```

## Development

Enable the optional `openapi` feature to derive `utoipa::ToSchema` for entity
identifiers, slugs, entry paths and the finite permission and billing values.
`mkc-api` enables it. The default build has no `utoipa` dependency.

```sh
cargo test -p mkc-domain
cargo clippy -p mkc-domain --all-targets -- -D warnings
```

Keep the crate pure: no clock, no entropy, no IO and no Cargo workspace dependency.
Add a new reserved route to `slug`; the route reservation test compares the
site's and the app's route sources with it.

### Key Code

- [ids.rs](./src/ids.rs) — the opaque UUID identifiers `UserId`, `OrganizationId`, `MemberId`, `ProjectId`, `GrantId`, `TokenId`, `InstallationId`, `RepositoryId`, `BuildId` and `PublicationId`. `OrganizationId` identifies a workspace: the API and the product say workspace, and the identifier keeps the persistence name.
- [values.rs](./src/values.rs) — `Role`, `Visibility`, `Plan` and `SeatKind`, the finite permission, visibility and billing values with their stable string forms and `Role::can_admin`.
- [slug.rs](./src/slug.rs) — `WorkspaceSlug` and `ProjectSlug`, the validated address segments; the reserved first-segment lists shared with the site and the app; `is_reserved`, `slugify` and `with_numeric_suffix`, the deterministic candidate derivation.
- [data/github-reserved-names.txt](./data/github-reserved-names.txt) — the attributed GitHub reserved-name list that `slug::github_reserved_slugs` reads; [data/README.md](./data/README.md) records its source and license.
- [app_paths.rs](./src/app_paths.rs) — the root-relative account and callback landing paths the API issues and the app routes, including `EMAIL_DESKTOP_CALLBACK`, and the slug-based workspace, project and publication addresses.
- [client_origins.rs](./src/client_origins.rs) — `AdmittedOrigins`, which classifies an exact `Origin` as the app or the desktop shell and lists the same origins for CORS and framing, and `DESKTOP_ORIGIN`.
- [billing.rs](./src/billing.rs) — `CATALOGUE`, the typed plan catalogue, with `SeatKind::of_role`, `Plan::allows_private_projects` and `Plan::allows_publication`, the public/private publication gate; `src/_tests_/billing_tests.rs` parses the `billing.md` and `billing-catalogue.md` tables against it.
- [pull_request.rs](./src/pull_request.rs) — `PullRequestRepositories`, the bound, head and base GitHub repository IDs of a pull request, and `is_fork`, the shared fork rule.
- [repository.rs](./src/repository.rs) — `RepositoryIdentity`, the CLI grammar, default GitHub host, single `.git` suffix removal and lowercase stored identity shared by project creation and upload authorization.
- [validation.rs](./src/validation.rs) — email, config path and repository validation, `name` (1–80 characters, no control characters, the rule the stored workspace and user names and the email copy share), and `return_to`, which validates a decoded copy of the path and query keys while keeping the accepted destination's bytes unchanged.
- [entry_path.rs](./src/entry_path.rs) — `entry_path`, the portable grammar check without a byte quota; `EntryPath`, the checked 2048-byte API selection value with `FromStr`, `Display` and checked `Deserialize`; and `MAX_ENTRY_PATH_BYTES`.
- [blob.rs](./src/blob.rs) — `BlobHash`, the lowercase SHA-256 content identity, and `BlobKey`, the hash plus incarnation whose `object_name` and `from_object_name` define the canonical private object name.

### Related Docs

- [Platform model](../../docs/protocol/cloud/platform-model.md)
- [Authentication](../../docs/protocol/cloud/auth-sessions.md)
- [Authentication callback landings](../../docs/protocol/cloud/auth-callbacks.md)
- [Desktop application](../../docs/protocol/cloud/desktop-app.md)
- [Stripe billing catalogue](../../docs/protocol/cloud/billing-catalogue.md)
- [Persistence boundaries](../../docs/protocol/cloud/persistence-boundaries.md)
- [Architecture](../../docs/architecture/cloud.md) — the components, their boundaries, and the data flows this crate takes part in.
