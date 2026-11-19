# REST API

The REST API serves the [OpenAPI 3.1 operations](../../api/openapi.json) under `/v1`.
The application and published catalogues are served by other origins; this
API never serves publication HTML.

## Contract Source

Rust owns every API boundary type and each operation's contract. `utoipa`
derives the OpenAPI document from those declarations. Hand-written YAML
checked against serialized views is rejected because two contract sources can
drift.

The generated document is JSON at `docs/api/openapi.json`. JSON is chosen over
YAML because `utoipa` emits it without another dependency, and both the client
generator and OpenAPI validator accept it.

The running router serves exactly the document's methods, paths and operation
IDs, including deferred operations. The document is the route registry;
a separate registry is rejected because it can disagree with the contract.
Anonymous-read capabilities agree with the document's security requirements.

Schema names, wire shapes, required fields, nullability and finite values
match the API's serialized data. A field that is always present stays required
even when its value can be null. IDs use UUID strings, timestamps use RFC 3339
UTC strings, and 64-bit integers use JSON numbers below 2^53.

## Implemented Surface

[REST API surface](./rest-api-surface.md) defines operation availability and
resource response requirements.

## Requests And Responses

[REST transport](./rest-transport.md) defines JSON/body limits, validation,
cursors, optimistic versions, error envelopes, cache headers and request IDs.

Submitted slugs are preserved exactly: the API does not trim or lowercase
them. Values outside the documented grammar or length, including UUID-shaped
values, return `validation-failed`. Workspace reserved words return
`slug-reserved`; a claim held by another live subject returns `slug-taken`.
Project slugs have no reserved-word outcome. Both slug refusals carry
`{field: "slug", suggestedSlug: string}` without identifying the conflicting
subject. A subject may reclaim its own retired claim; rename keeps the old
claim so existing addresses continue to resolve.

A submitted config path must be a repository-relative path that ends in
`.json`. Project creation and the project slug suggestion
return `validation-failed` for any other config path, including a path that
ends in `.ts`.
[Platform model](./platform-model.md#projects-and-visibility) defines the
config path grammar.

## Trusted Proxies

[REST trusted proxies](./rest-proxies.md) defines verified client-IP selection,
stable and PR hop counts and CIDR validation.

## Reason Catalogue

This table is the authoritative machine-readable catalogue. Each data shape
is an object; `—` means `data` is omitted. `Plan` is `"free"` or `"team"`, and
`IneligibleCause` is `"closed-pull-request"` or `"fork-pull-request"`. Reasons
marked deferred are reserved for future handlers and are not emitted by any
implemented operation.

| Reason                         | Code                  | HTTP | When returned                                                                                                                    | Data                                     |
| ------------------------------ | --------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `validation-failed`            | `bad-request`         | 400  | Invalid JSON, content type, field, ID or cursor                                                                                  | —                                        |
| `unauthenticated`              | `unauthenticated`     | 401  | Missing, unknown or revoked session                                                                                              | —                                        |
| `permission-denied`            | `permission-denied`   | 403  | Authenticated action lacks permission                                                                                            | —                                        |
| `not-found`                    | `not-found`           | 404  | Unknown route, absent or inaccessible resource                                                                                   | —                                        |
| `version-conflict`             | `failed-precondition` | 400  | Supplied resource version is stale                                                                                               | `{currentVersion: integer}`              |
| `head-changed`                 | `failed-precondition` | 400  | Deferred: publication head changed                                                                                               | —                                        |
| `rate-limited`                 | `resource-exhausted`  | 429  | Email, preview, desktop grant or OAuth admission, or a GitHub or Stripe provider rate limit; positive Retry-After seconds        | —                                        |
| `unavailable`                  | `unavailable`         | 503  | Explicitly retryable dependency outage                                                                                           | —                                        |
| `duplicate-project`            | `already-exists`      | 409  | Repository/config already belongs to a project                                                                                   | `{existingProjectId: UUID}`              |
| `slug-taken`                   | `already-exists`      | 409  | Submitted workspace or project slug is claimed by another live subject                                                           | `{field: "slug", suggestedSlug: string}` |
| `slug-reserved`                | `bad-request`         | 400  | Submitted workspace slug is reserved                                                                                             | `{field: "slug", suggestedSlug: string}` |
| `last-owner`                   | `failed-precondition` | 400  | Mutation would remove the last workspace owner                                                                                   | —                                        |
| `csrf-rejected`                | `permission-denied`   | 403  | Missing or mismatched Origin or CSRF token                                                                                       | —                                        |
| `magic-link-invalid`           | `bad-request`         | 400  | Malformed or unknown magic-link or preview sign-in credential                                                                    | —                                        |
| `magic-link-expired`           | `failed-precondition` | 400  | Unused link reached its expiry deadline                                                                                          | —                                        |
| `magic-link-used`              | `failed-precondition` | 400  | Previously consumed magic link, including a concurrent loser                                                                     | —                                        |
| `desktop-grant-invalid`        | `bad-request`         | 400  | Desktop grant, challenge or verifier is malformed, unknown, expired, used or mismatched                                          | —                                        |
| `session-expired`              | `unauthenticated`     | 401  | Stored session reached its absolute or idle deadline                                                                             | —                                        |
| `token-revoked`                | `unauthenticated`     | 401  | Deferred: publishing bearer credential was revoked                                                                               | —                                        |
| `invitation-expired`           | `failed-precondition` | 400  | Invitation reached its acceptance deadline                                                                                       | —                                        |
| `already-member`               | `already-exists`      | 409  | Active membership, pending invitation or direct grant already exists                                                             | —                                        |
| `operation-unavailable`        | `unavailable`         | 503  | Operation is deferred, required catalogue metadata is unavailable, or GitHub, preview sign-in or billing configuration is absent | —                                        |
| `migrations-pending`           | `unavailable`         | 503  | Database has unapplied migrations embedded in the running API                                                                    | —                                        |
| `method-not-allowed`           | `bad-request`         | 400  | HTTP method unsupported on a registered path                                                                                     | —                                        |
| `payload-too-large`            | `payload-too-large`   | 413  | Request body exceeds its operation limit                                                                                         | —                                        |
| `internal-error`               | `internal`            | 500  | Unhandled dependency, storage or runtime failure                                                                                 | —                                        |
| `invalid-anchor`               | `bad-request`         | 400  | Deferred: comment anchor is invalid                                                                                              | —                                        |
| `review-closed`                | `failed-precondition` | 400  | Deferred: review no longer accepts changes                                                                                       | —                                        |
| `github-auth-invalid`          | `bad-request`         | 400  | GitHub OAuth state, verifier or code is invalid, expired or consumed                                                             | —                                        |
| `github-email-unverified`      | `permission-denied`   | 403  | GitHub supplies no verified primary email                                                                                        | —                                        |
| `github-identity-conflict`     | `already-exists`      | 409  | GitHub identity or verified email conflicts with an existing account link                                                        | —                                        |
| `github-installation-conflict` | `already-exists`      | 409  | Installation already belongs to another workspace                                                                                | —                                        |
| `webhook-signature-invalid`    | `unauthenticated`     | 401  | Returned when a GitHub or Stripe delivery signature is malformed, stale or does not verify                                       | —                                        |
| `plan-required`                | `failed-precondition` | 400  | Private visibility change or `requestBuild` for a private project on Free                                                        | `{requiredPlan: Plan, feature: string}`  |
| `subscription-active`          | `failed-precondition` | 400  | Returned by Checkout while the workspace's subscription is live                                                                  | —                                        |
| `upload-unsupported-version`   | `failed-precondition` | 426  | Unsupported upload envelope, ownership marker or catalogue index version                                                         | —                                        |
| `upload-invalid-bundle`        | `bad-request`         | 400  | Invalid upload framing, artifacts, type or request metadata                                                                      | —                                        |
| `upload-unauthorized`          | `unauthenticated`     | 401  | Missing, unknown, malformed or revoked publishing bearer                                                                         | —                                        |
| `upload-forbidden`             | `permission-denied`   | 403  | Bearer or uploaded repository/config belongs elsewhere                                                                           | —                                        |
| `builds-unavailable`           | `failed-precondition` | 400  | Build request or enabling Automatic builds without configured builds and installation access                                     | —                                        |
| `build-ineligible`             | `failed-precondition` | 400  | Requested pull request is closed or comes from a fork                                                                            | `{cause: IneligibleCause}`               |
| `build-already-active`         | `already-exists`      | 409  | Active build exists for the requested head                                                                                       | `{buildId: UUID}`                        |
| `build-already-published`      | `already-exists`      | 409  | Ready publication exists for the requested head and config                                                                       | `{publicationId: UUID}`                  |
| `upload-plan-required`         | `permission-denied`   | 403  | Upload to a private project whose workspace is on the free plan                                                                  | —                                        |
| `upload-too-large`             | `payload-too-large`   | 413  | Any publication upload ceiling exceeded                                                                                          | —                                        |
| `upload-unavailable`           | `unavailable`         | 503  | Upload admission exhausted or content being collected                                                                            | —                                        |
| `upload-timeout`               | `deadline-exceeded`   | 408  | Plan or blob body reception timed out                                                                                            | —                                        |
| `upload-blob-mismatch`         | `bad-request`         | 400  | Blob body digest or declared length differs from its reservation                                                                 | —                                        |
| `upload-unknown-blob`          | `not-found`           | 404  | Blob hash not reserved by the owned upload attempt                                                                               | —                                        |
| `upload-incomplete`            | `aborted`             | 409  | Upload completion while reserved files are not yet stored                                                                        | —                                        |
| `upload-expired`               | `failed-precondition` | 410  | Upload attempt expired, failed or superseded without a ready publication                                                         | —                                        |
| `upload-failed`                | `internal`            | 500  | Unhandled ingest or file-store failure                                                                                           | —                                        |

Standard codes fix statuses: in particular, `failed-precondition` is 400, not
409, and there are no standard 405/501 codes. Deferred handlers therefore use
503 `operation-unavailable`; unsupported methods use 400 `method-not-allowed`.
Comments and approvals are registered, documented and unavailable.
The document marks every deferred operation with `x-deferred: true` and omits
the marker on implemented operations.
Inaccessible reads return 404 even when the ID exists. Authentication precedes
private store access. Publishing bearer authentication is implemented only on
the plan, blob and completion upload routes. The three upload reasons
`upload-unsupported-version`, `upload-timeout` and `upload-expired` carry
HTTP 426, 408 and 410 in place of their code's status; every other reason
uses the standard code status. The envelope is the `rpc-error` envelope that
[REST transport](./rest-transport.md) defines.

Each operation declares its reasons in Rust, which generates its OpenAPI
`x-reasons` sequence. Explicit per-operation declarations are retained instead
of inferred reasons because the types alone cannot identify every possible
failure. Each implemented operation supplies its exact list, including shared
transport and authentication failures.

Every declared reason agrees with the `rpc-error` reason catalogue and this
REST catalogue. The generated error schema enumerates the `rpc-error` reason
catalogue. Reason uniqueness and catalogue agreement are checked. Prose refers
to this inventory instead of introducing reasons. `cargo xtask openapi-lint`
checks the document against this table and rejects uncatalogued reason
mentions in descriptions and protocol prose.

The generated error schema gives each reason the data type of this table: one
closed variant for each data type, keyed by `reason`, and one variant without
`data` for every other reason. One open `data` object for every reason was
rejected, because a client could not narrow `data` by `reason`, and a renamed
data field would pass every check.

## Local Operation

`serve` applies pending migrations before it binds; `migrate` applies them and
exits; the maintenance commands need database settings only. A CLI error
never prints a secret.

The [API guide](../../../crates/mkc-api/README.md#quick-start) documents commands,
configuration and local development. Its
[development guide](../../../crates/mkc-api/README.md#development) covers integration tests.

Related: [Auth](./auth-sessions.md), [Persistence](./persistence-boundaries.md).
