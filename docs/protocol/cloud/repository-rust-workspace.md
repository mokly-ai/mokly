# Repository Rust Workspace

This is the Rust workspace sub-contract of
[Repository layout](./repository-layout.md): the Cargo workspace, crate
naming, what each crate owns, the pinned public dependencies, and the
migration lock. The layering between the crates, the dependency direction,
and the composition roots are in the
[architecture doc](../../architecture/cloud.md#crate-layering).

## Cargo Workspace

- One Cargo workspace at the root with `resolver = "2"`, edition 2024, and
  `version`, `license`, and `authors` at the Cargo workspace level.
- Every internal crate is listed under `[workspace.dependencies]` as
  `name = { path = "crates/name" }` and consumed with
  `name = { workspace = true }`.
- Crate names use the `mkc-` prefix. Suffixes carry meaning:
  - `-interface`: traits, DTOs, and error contracts shared across crates.
  - `-store-pg`: Diesel query implementations for a store interface, no
    business logic.
  - `-store-interface`: the store traits a `-store-pg` crate implements.
  - No suffix: a service, client, or domain crate.

## Crates

The crates and what each owns:

- `mkc-api`: the REST API binary and the in-process workers.
- `mkc-catalogue-server`: the binary that serves ready publications.
- `mkc-github-double`: the recorded GitHub described in
  [GitHub App](./github-app.md), a library the API's integration harness
  starts in-process and a development-only `serve` binary the browser suite
  runs beside the API. It appears only in `[dev-dependencies]`, and no
  production crate may depend on it.
- `mkc-config`: the typed environment configuration of both binaries.
- `mkc-domain`: typed ids, value types, validation, permissions, the
  plan, catalogue and seat kinds, and the portable entry-path grammar
  with the cloud selection bound.
- `mkc-db`: Diesel migrations, the generated schema, and the migration
  lock.
- `mkc-store-interface` and `mkc-store-pg`: the store traits and their
  Postgres queries, including the billing queries;
  [Persistence boundaries](./persistence-boundaries.md) assigns the tables.
- `mkc-auth`: magic links, preview sign-in, desktop grants, sessions and
  admission.
- `mkc-mokly-contract`: bounded gzip/tar decoding and the typed upload,
  ownership and review artifacts, returned as immutable validated bytes
  without HTTP, database or filesystem extraction; see
  [Publication upload](./publication-upload.md).
- `mkc-publications`: upload attempts, ready publications, branch
  aliases, catalogue grants, the Changes check delivery, retention and
  blob collection, cloud build scheduling and durable build attempts.
- `mkc-live-interface` defines the live channel messages and relay
  contract. `mkc-live` runs the hub on each replica. `mkc-live-pg` relays
  notices and client events over Postgres. See [Live channel](./live-channel.md).
- `mkc-file-store-interface`, `mkc-file-store-gcs` and
  `mkc-file-store-local`: the immutable content storage contract and its
  GCS and local-directory adapters.
- `mkc-github-interface` and `mkc-github`: the GitHub App provider
  contract and its HTTP adapter.
- `mkc-billing-interface`, `mkc-billing-stripe` and `mkc-billing`: the
  billing and catalogue provider contracts with the webhook verification
  contract, the Stripe adapter with its recorded fixtures, and the billing
  service with its two workers; see [Billing](./billing.md).
  `mkc-billing-stripe` reaches Stripe through its own typed reqwest
  transport, and the workspace adds no community Stripe SDK.
- `mkc-upload-memory-interface` and `mkc-upload-memory`: the shared
  nonblocking upload memory budget and its process-wide implementation.
  The seam sits below both `mkc-mokly-contract` and `mkc-publications`
  so that plan validation and blob handling share one budget without a
  dependency cycle.
- `mkc-email-interface`, `mkc-email-postmark` and `mkc-email-templates`: the mail
  contract, the Postmark and development mailers, and the generated
  sign-in and invitation template files that
  `cargo xtask email-templates` regenerates from the mockup email
  definitions. The [email tooling guide](../../../apps/mockups/README.md)
  describes the generator. See [Email](./email.md) and
  [Postmark sync](./email-postmark-sync.md).
- `mkc-build-interface` and `mkc-build-sandbox`: the cloud build runner
  contract and its sandbox implementation.
- The build runner interface separates execution requests, logs and outcomes
  from the sandbox implementation. The sandbox provider dependencies use one
  shared, fixed revision. Only the API composes the concrete E2B backend;
  the runner and publication reconciliation depend on the provider interface.
  See [Cloud build runner](./cloud-build-runner.md) and the
  [build interface guide](../../../crates/mkc-build-interface/README.md).
- `mkc-test-support` and `mkc-test-pg`: pure shared fixtures and
  disposable, verified Postgres scratch schemas; both are
  dev-dependencies only.

## Dependencies And Migrations

- `internal-error` and `rpc-error` are public Git dependencies pinned by
  `rev` in `[workspace.dependencies]`, so CI needs no credentials to fetch
  them.
- Migration lock: `crates/mkc-db/migration-lock.txt` lists one line per SQL
  file under `crates/mkc-db/migrations/` as `fnv1a64:<hex> <path>`, sorted by
  path, behind a comment header. Paths are repository-relative; checksums are
  sixteen lowercase hexadecimal digits over the exact file bytes. Directory
  names use twelve timestamp digits, an underscore, and a nonempty lowercase
  alphanumeric/underscore description. The immutability stage recomputes each
  tracked file's checksum, compares it with the lock, and reports a violation
  when a locked entry changes or disappears, when a migration directory does
  not match `<YYYYMMDDHHMM>_<description>` with both `up.sql` and `down.sql`,
  or when a new file has no entry. The comparison baseline is the lock file
  as committed on `origin/main`: a change may only append entries, never edit
  or remove one. New entries sort after the existing baseline entries;
  duplicate and unsorted entries are invalid. The checker accepts a tree with
  no migrations and requires `origin/main` even when its lock is absent
  there. There are no seed migrations.
- Rust source files are capped at 300 lines by the file-length lint. Tests
  live under `_tests_` directories beside the code they test.
