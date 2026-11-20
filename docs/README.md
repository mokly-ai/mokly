# Docs

This directory holds the docs of Mokly and of Mokly Cloud.
[Repository layout](./protocol/repository-layout.md) defines the paths of both
parts.

For Mokly:

- [Protocol docs](./protocol/README.md) — the specification of the Rust core,
  the render sidecar, the Browse shell, and the release and verification
  tooling.
- [Rust core](./architecture/rust-core.md) and
  [package boundary](./architecture/package-boundary.md) — the architecture of
  Mokly and the boundary between Mokly and each consumer.
- [Developer guide](./development/README.md) — the tools and the commands for
  work on Mokly.
- `guides/` — the user guides that ship with `@mokly/mokly`.

For Mokly Cloud, the architecture doc, the protocol docs, the design mockups,
and the operational runbooks:

- [Architecture](./architecture/cloud.md) — the components, their responsibilities,
  the boundaries between them, and the data flows across those boundaries.
- [Protocol docs](./protocol/cloud/README.md) — the requirements and the decisions
  in force for product behavior, API resources, artifacts, and boundaries.
- [Mockup authoring guide](./mockups/README.md) — catalogue structure,
  scripts, and review policy for generated design and product screens.
- [Public site](./protocol/cloud/site.md) — marketing, documentation, changelog and
  legal routes, with [design](./protocol/cloud/site-design.md),
  [content](./protocol/cloud/site-docs.md) and
  [delivery](./protocol/cloud/site-delivery.md) contracts.
- [Marketing boundary](./protocol/cloud/marketing-site.md) — route ownership and
  links between the static site and product app.
- [Design tokens](./protocol/cloud/design-tokens.md) — the shared visual values of
  the Folio product and marketing system, with its
  [colors](./protocol/cloud/design-tokens-color.md).
- [Product direction](./product-direction.md) — the phases beyond the initial
  scope (review, editing, native) and what the initial scope must not preclude.
- [Cloud builds](./protocol/cloud/cloud-builds.md) — the contract for publishing
  branches and pull requests from Mokly Cloud's own sandboxes instead of the
  consumer's CI, with its runner, REST and viewer sub-contracts.
- Implementation review — the shared `implementation-review` skill runs the
  final review of each change. `AGENTS.md` lists this repository's
  [review focus](../AGENTS.md#review-focus). Reviews that use the
  [implementation review prompt](./implementation-review-prompt.md) follow its
  read-only, report-only instructions.
- [Product specification](./protocol/cloud/product-navigation.md) — the product
  routes, their resolution and the navigation shell, with
  [accounts and roles](./protocol/cloud/product-accounts-and-roles.md), the
  [settings dialog](./protocol/cloud/settings-dialog.md) and the
  [API reference](./api/README.md).
- [Billing](./protocol/cloud/billing.md) — plans, seats, roles and copy;
  [Billing plan gates](./protocol/cloud/billing-plan-gates.md) — the writes a plan
  gates and the downgrade;
  [Billing subscriptions](./protocol/cloud/billing-subscriptions.md) — the
  subscription shape, trial, Stripe flows and configuration.
- [Stripe billing catalogue](./protocol/cloud/billing-catalogue.md) — product and
  price identity, reconciliation and runtime lookup-key resolution.
- [Stripe billing catalogue operations](./protocol/cloud/billing-catalogue-operations.md)
  — command, deployment, credential, failure and operator contracts.
- [Billing workers](./protocol/cloud/billing-workers.md) — webhook acceptance, seat
  reconciliation and price integrity.
- [Operations runbooks](./ops/README.md) cover deployment, maintenance and recovery.

## Where Content Lives

Each fact has one home. Other docs link to it.

| Content                                                       | Home                                                                                                                   |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| A requirement: observable behavior at a boundary              | The protocol doc                                                                                                       |
| A decision in force, with the rejected alternative and reason | The protocol doc, next to its requirement                                                                              |
| Components, their responsibilities, and their boundaries      | The [architecture doc](./architecture/cloud.md)                                                                        |
| Entry points into the code: files, types, functions           | The crate or area `README.md`, under `### Key Code`                                                                    |
| How the code works: mechanics, call order, module layout      | The code and its doc comments                                                                                          |
| Cases and examples                                            | The tests                                                                                                              |
| An API surface, a schema, a type list                         | Generated reference, such as the OpenAPI document under [`docs/api`](./api/README.md) that the Rust contract generates |
| Operator procedures and environment records                   | The [operations runbooks](./ops/README.md)                                                                             |
