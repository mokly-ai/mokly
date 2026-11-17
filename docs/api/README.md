# Product API Contract

Rust defines the product-facing REST boundary for accounts, workspaces and
projects, GitHub integration, publication uploads and viewing, catalogue
access and billing. `utoipa` derives the
[OpenAPI 3.1 document](./openapi.json), and the app generates its TypeScript
client types from that document. The comment and approval paths are deferred
contracts whose registered routes return typed 503. Cloud builds have five
REST operations, member-only logs and project/reference capabilities. See
[Cloud build API](../protocol/cloud/cloud-build-api.md). The
[REST API](../protocol/cloud/rest-api.md) protocol defines the running boundary and
owns the error reason catalogue.

## Conventions

- All paths begin `/v1`; nonempty responses are JSON. IDs are UUID strings,
  timestamps RFC 3339 UTC, and finite statuses are enums. Lists return `items`
  and an opaque nullable `nextCursor`; default/max page size is 50/100. Build
  log windows use a sequence continuation and default to 100 chunks.
- Session authentication uses a secure HttpOnly `mkc_session` cookie. Browser
  mutations also require `X-CSRF-Token`, checked against the session and
  Origin. Callback, issuance, expiry and rotation follow
  [Authentication](../protocol/cloud/auth-sessions.md); catalogue grants follow
  [Hosting](../protocol/cloud/catalogue-hosting.md).
- All responses that set or clear `mkc_session` reference the shared
  `components.headers.SessionCookie` header. It states the current-request
  Origin rule for exchanges, rotation and sign-out: app `Lax`, admitted
  desktop `None`.
- Resource access is checked before returning metadata. The status of each
  outcome, the request-ID echo and the `rpc-error` envelope (`code`,
  `reason`, `message`, `request_id` and optional typed `data`) are defined in
  [REST API](../protocol/cloud/rest-api.md) and
  [REST transport](../protocol/cloud/rest-transport.md).
- Mutations that create comments or approvals accept an `Idempotency-Key`
  UUID; edit commands carry `version`, and approval commands also carry
  `expectedHeadSha`. [Screen comments](../protocol/cloud/screen-comments.md) and
  [Approvals](../protocol/cloud/approvals.md) own their semantics.
- Never return token hashes, session credentials or provider tokens in resource
  DTOs. A publishing token secret appears only in its creation response.

## Generation

The pinned generators are `utoipa` 6.0.0 and `openapi-typescript` 7.13.0.
The app uses `openapi-fetch` 0.17.0 with the generated types. Run these commands
from the repository root:

```sh
cargo run -p mkc-api -- openapi
cargo xtask openapi
cargo xtask openapi --check
cargo xtask openapi-lint
```

`mkc-api openapi` prints pretty JSON. `cargo xtask openapi` writes
`docs/api/openapi.json` and regenerates `apps/app/src/api/generated/schema.ts`.
Commit both files. Never hand-edit either output or hand-write frontend types
for backend data. The `--check` mode regenerates both without rewriting them
and reports the first differing line in either file. Stage 17 `openapi-drift`
runs that check.

The router registers the operations in the generated document. Root security
applies unless an operation explicitly sets
`security: []`. Schema examples are documentation only, not app fixtures.
The document marks deferred operations with `x-deferred: true`. A modifier
derives the marker from `Operation::implemented()` after merging the area
contracts. Implemented operations have no marker. The platform smoke reads
the document from the binary under test to find its deferred operations.

Stage 20 `openapi-lint` reads the JSON document and checks the error reason
rules below, using `x-deferred` for availability. It also requires delivery fixtures for the GitHub protocol's
subscriptions. Rust tests check operation coverage, security markers,
required fields, reason catalogues and serialized responses against their
schemas. Validate structural OpenAPI changes with
`npx @redocly/cli lint --extends minimal docs/api/openapi.json` too.

Related contracts: [Navigation](../protocol/cloud/product-navigation.md),
[Viewer](../protocol/cloud/viewer.md),
[Viewer read model](../protocol/cloud/viewer-read-model.md),
[Comments](../protocol/cloud/screen-comments.md) and
[Approvals](../protocol/cloud/approvals.md).

## Error reason inventory

Rust operation contracts declare the `x-reasons` arrays. The generated `Error`
schema lists the complete supported and reserved inventory from `rpc-error`;
every implemented operation must declare its exact `x-reasons` subset. Every
value must exist in the Reason Catalogue table in `docs/protocol/cloud/rest-api.md`.
A reason whose catalogue row begins `Reserved:` or `Deferred:` appears only in
the inventory and on deferred operations, never on an implemented one, until
the change that emits it rewrites its row. Descriptions that mention a reason
must quote it with backticks and include it in the inventory. The lint rejects
unknown values, malformed or empty inventories, uncatalogued backtick
identifiers in error reason descriptions, and reserved or deferred reasons
declared by an implemented route.

Protocol prose marks backticked error names with `reason`, `reasons`, `return`,
`returns` or `returned` immediately before the name. The lint checks these
mentions in `docs/protocol/*.md` against the REST catalogue, and rejects known
reason names misspelled with underscores anywhere in prose. Other code spans
(such as crate names, fields and mockup IDs) are identifiers, not error reasons.
The REST table's code column contains rpc-error standard codes, not reasons.

The anonymous-read capability of each operation must agree with the GET
operations' optional or empty security requirements in the document; Rust
tests check it. [Viewer read model](../protocol/cloud/viewer-read-model.md) owns the
visibility boundary of the viewer reads, and the GitHub and Stripe webhook
operations declare `security: []` without being anonymous reads.

## Error data

The `Error` schema's `error` object is a `oneOf` keyed by `reason`. Each
reason that carries `data` has a closed variant that requires it, typed by a
named Rust schema: `VersionConflict`, `DuplicateProject`, `PlanRequired`,
`SlugConflict`, `BuildIneligible`, `ActiveBuild` or `PublishedBuild`. The last
variant lists every other reason and has no `data`. Endpoint validation
therefore checks the `data` of every error body against its reason, and a Rust
contract test checks that every `ApiError` variant with data has its type in
the document. The generated client types `data` by reason, so the app narrows
it by `reason` and never hand-writes it. The
[REST catalogue](../protocol/cloud/rest-api.md#reason-catalogue) records the data of
each reason.

## Workspace Plan And Installation Context

The document defines `Workspace`, with its `plan` and
`githubInstallationState` fields, `Project`, with `publishingAllowed`, and
`Billing`, `CheckoutSession` and `PortalSession`, with the read, Checkout,
Portal and webhook operations; read their shapes in the
[OpenAPI document](./openapi.json). Their semantics are in
[Platform model](../protocol/cloud/platform-model.md),
[GitHub App](../protocol/cloud/github-app.md) and [Billing](../protocol/cloud/billing.md).

## Viewer Client Contract

Field shapes, nullability, enums and the shared `EntryPath` schema are read
from the [OpenAPI document](./openapi.json), not restated here.

Keep the typed client reason list in `apps/app/src/api/reasons.ts` aligned with
the generated `Error` inventory. The app logic tests compare these inventories
and check each reason against the REST catalogue. They also compare the
reasons that `apps/app/src/api/error-data.ts` parses `data` for with the
variants that carry it.

### Key Code

- `crates/mkc-api/src/contract/` holds one `#[utoipa::path]` stub per operation,
  grouped by area, and the root `ApiDoc` that combines their documents.
- `crates/mkc-api/src/contract/reason_data.rs` pairs each error data type with
  the reasons that carry it, and `contract/error.rs` builds the `Error`
  variants from that table.
- The Rust views and input types derive `ToSchema`; the
  [API crate guide](../../crates/mkc-api/README.md#key-code) names their entry points.
- `mkc-api openapi` prints the derived document for the
  [xtask generator](../../xtask/README.md#quick-start).
- `apps/app/src/api/generated/schema.ts` provides the generated paths and
  components consumed by the [app client](../../apps/app/README.md#key-code).
- `apps/app/src/api/error-data.ts` derives the app's `ApiErrorData` from the
  generated `Error` variants and parses the `data` of each reason.
