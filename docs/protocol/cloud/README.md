# Protocol Docs

These docs hold the requirements and the decisions in force for Mokly Cloud:
the behavior that must stay aligned across the Rust services, the Postgres
schema, the web app, the mockups, the open-source `@mokly/mokly` artifacts,
and the deployment workflows.

Each doc states observable behavior at a boundary and the decisions that
explain it. A doc is complete when a reader can tell, for every behavior at
its boundary, whether the code meets it; it does not say how the code meets
it. Code entry points live in the owning `README.md` under `### Key Code`.
Components and their boundaries live in the [architecture doc](../../architecture/cloud.md).
Keep each doc near 250 lines. Split a longer doc when a change touches it.
Change a doc only when a requirement or a decision changes.

## Index

- [Repository layout](./repository-layout.md) — directories, pinned
  toolchains and the verification entry; the
  [Rust workspace](./repository-rust-workspace.md) owns crate naming and
  ownership, the pinned dependencies and the migration lock, the
  [TypeScript layout](./repository-typescript.md) the npm packages, pins and
  tooling rules, [verification](./repository-verification.md) the cloud suite
  rules, the app shards and the image build runtime, and
  [generated files](./repository-generated-files.md) the ignore rules,
  untracked output trees and committed golden files.
- [Publication upload](./publication-upload.md) — the exchange, envelope
  versions, limits, errors and publication idempotency; the
  [upload exchange](./publication-upload-exchange.md) owns the plan, blob and
  completion wire contract and
  [upload validation](./publication-upload-validation.md) the plan archive,
  ownership marker and comparison checks, with the
  [catalogue index](./publication-review.md) versions, entry paths, Changes
  count and screens.
- [Mokly artifact compatibility](./mokly-artifact-compatibility.md) — published
  package boundary and drift checks;
  [fixture regeneration](./mokly-fixture-regeneration.md) defines fixture
  ownership, reproducible output, the moves and index corpus and the CLI
  failure codes.
- [Deployment smoke checks](./deployment-smoke-checks.md) — health, build revision,
  migration readiness, app serving and catalogue isolation after every rollout.
- [Infrastructure promotion](./infrastructure-promotion.md) — the promotion
  sequence, exact-plan apply, destructive-action approval and single-use
  cleanup and recovery;
  [foundation promotion](./foundation-promotion.md) owns the Foundation
  workflow, its identities, the Deploy wait and the trust set.
- [PR preview environments](./pr-preview-environments.md) — namespace/data/host
  contracts, [shared platform](./preview-platform.md),
  [script interfaces](./preview-scripts.md) and the
  [seed data](./preview-seed.md) account, sign-in link and sample project;
  the [seed Job](./preview-seed-job.md) owns its template and release script,
  [local seed](./preview-seed-local.md) owns the local seed command, and
  [catalogue capture](./preview-capture.md) owns the producer command and failures.
- [Origin router](./origin-router.md) — shared app/site origin, preview label
  grammar, internal-host mapping and Worker response behavior.
- Operations: [environments](../../ops/environment.md), [deploy](../../ops/deploy.md),
  [foundation](../../ops/foundation.md),
  [previews](../../ops/preview.md), [secrets](../../ops/secrets.md) and
  [infrastructure](../../../infra/README.md).
- [Platform model](./platform-model.md) — entities, slugs, roles and project
  visibility, and [invitations and deletion](./platform-invitations-and-deletion.md)
  the invitation lifecycle and the deletion rules.
- [Billing](./billing.md) — plan catalogue, seat kinds, roles and product
  copy; [plan gates](./billing-plan-gates.md) owns the plan-gated writes and
  the downgrade, and [subscriptions](./billing-subscriptions.md) the
  subscription shape, trial, Stripe Checkout, Portal and configuration.
- [Stripe billing catalogue](./billing-catalogue.md) — Stripe identity,
  reconciliation, idempotency and runtime price resolution contracts.
- [Stripe billing catalogue operations](./billing-catalogue-operations.md) —
  command, deployment, credential, failure and operator contracts.
- [Billing workers](./billing-workers.md) — Stripe webhooks, retries, seat
  reconciliation and the workers' use of verified prices.
- [Authentication and sessions](./auth-sessions.md) — links, cookies, rotation and CSRF.
- [Authentication callbacks](./auth-callbacks.md) — provider-scoped browser
  landings, tab state, cleanup, recovery and resume behavior.
- [Email](./email.md) — the sign-in and invitation messages: typed content,
  copy, the delivered document and hosted delivery;
  [authoring](./email-authoring.md) owns the catalogue source, generation,
  committed templates and checks.
- [Postmark template synchronization](./email-postmark-sync.md) — trusted
  deployment, server comparison, create/update and credential scope.
- [GitHub App](./github-app.md) — provider contracts, installations and durable webhooks.
- [GitHub sign-in](./github-sign-in.md) — PKCE, verified identity linking and sessions.
- [REST API](./rest-api.md) — the Rust contract source and the reason
  catalogue; the [API surface](./rest-api-surface.md) owns the operations and
  their responses, [transport](./rest-transport.md) the request and response
  rules, limits, pagination, versions and the error envelope, and
  [trusted proxies](./rest-proxies.md) the verified client-IP selection and
  hop configuration.
- [Persistence boundaries](./persistence-boundaries.md) — table ownership,
  atomic work, migration lifecycle, and authentication and GitHub record
  retention, and [publication storage](./persistence-publication-storage.md)
  the publication transaction boundary, the lock orders and object prefixes.
- [Product copy](./product-copy.md) — user-facing text rules for the product,
  marketing site, and mockups.
- [Mockup catalogue](./mockups.md) — public package boundary, registration,
  hierarchy and rendering;
  [links and flows](./mockup-links-and-flows.md) owns mock links, slug
  fixtures and use-case flows;
  [tooling](./mockup-tooling.md) owns configuration, commands and build output;
  [comparison base](./mockup-baselines.md) owns base selection and rendering,
  base dependencies, cache limits and trust;
  [verification](./mockup-verification.md) owns policy and browser checks;
  [source policy](./mockup-source-policy.md) owns the deterministic source
  rules.
- [Design tokens](./design-tokens.md) — shared light/dark visual values and
  accessibility constraints; [colors](./design-tokens-color.md) owns the color
  tables, the accent family and the surface families.
- [Shared controls](./shared-controls.md) — Firna package/peer pins, token
  mapping and ownership;
  [registrations](./shared-control-registrations.md) owns wrapper props and density;
  [rendering](./shared-control-rendering.md) owns the static document, link
  adaptation and module resolution;
  [overlays](./shared-control-overlays.md) owns static frames and viewer slots.
- [Folio chrome](./folio-chrome.md) — the product compositions: section,
  record row, form, state, wait, write in progress, write failure and
  selection;
  [viewer compositions](./folio-viewer.md) owns the stage, top bar, panels,
  publication rows, build card, dialog and layer, and
  [account entry](./folio-chrome-account.md) the one account panel.
- [Public site](./site.md) — public routes, approved copy, real-content sources
  and ahead-of-release pages.
- [Site home copy](./site-copy.md) — approved hero, real stage, features and closing.
- [Site legal](./site-legal.md) — legal-document sources, operator facts,
  providers, retention, complaints and claim boundaries.
- [Site design](./site-design.md) — Folio token mapping, responsive layout,
  components and owning mockups.
- [Site mockups](./site-mockups.md) — site screen paths, tour and parity checks.
- [Site docs](./site-docs.md) — package/cloud content ownership, merged page
  model, navigation and verification.
- [Site delivery](./site-delivery.md) — static build, checks and direct-upload
  Cloudflare Pages workflow.
- [Site deployment](./site-deployment.md) — Pages workflow, PR cleanup and legacy redirects.
- [Marketing boundary](./marketing-site.md) — route ownership and
  cross-origin links between `apps/site` and `apps/app`.

- [Product navigation](./product-navigation.md) — routes, resolution and
  fallbacks, and the navigation shell;
  [accounts and roles](./product-accounts-and-roles.md) owns account entry,
  onboarding, roles, slugs and screen states.
- [Web application](./web-app.md) — the Expo app: pins, document and
  styling, routes and accessibility; the [API client](./web-api-client.md)
  owns the session, requests and the generated client.
- [Web product shell](./web-product-shell.md) — settings history, viewer host
  composition and outbound links.
- [Desktop distribution and verification](./desktop-distribution.md) — packaging,
  updates and the Electron smoke contract.
- [Desktop application](./desktop-app.md) — the Electron shell: the bundled
  export and its origin, API and catalogue admission, navigation, the scheme
  sign-in handoff, distribution, updates and the deferred local mode;
  [bundle and origin](./desktop-bundle.md) owns the privileged scheme, the
  desktop origin, the renderer settings and the window lifecycle.
- [Settings dialog](./settings-dialog.md) — settings panes over the working page, URL grammar, mobile routes;
  [states](./settings-dialog-states.md) owns pane loading, writes, failures and address editing;
  [GitHub accounts](./settings-dialog-github.md) owns the workspace account pane.
- [Settings mockups](./settings-mockups.md) — pane paths, states and modal/layer drawings.
- [Viewer](./viewer.md) — the viewer as the application, the private artifact
  limit and catalogue isolation; [Viewer host](./viewer-host.md) owns the
  `@mokly/viewer` host boundary and the version failure.
- [Viewer catalogue](./viewer-catalogue.md) — index and entry detail fetch,
  version gate, the package-owned read model and snapshot selection.
- [Viewer chrome](./viewer-chrome.md) — slots, overlays, publication context and mockups.
- [Viewer address state](./viewer-address-state.md) — controlled selection,
  query grammar, alias round trips, panels and browser history.
- [Viewer read model](./viewer-read-model.md) — visibility, branch/PR/history reads,
  comparison-backed screen projection and canonical sharing.
- [Screen comments](./screen-comments.md) — review-phase draft: anchors, lifecycle, permissions and GitHub sync.
- [Approvals](./approvals.md) — review-phase draft: identity, staleness, optional gate and audit.
- [Product mockups](./product-mockups.md) — complete screen/state inventory and journeys.
- Product inventories: [account](./product-mockups-account.md),
  [settings](./product-mockups-settings.md) and [viewer](./product-mockups-viewer.md)
  with its [builds](./product-mockups-viewer-builds.md).
- [Product API](../../api/README.md) — the OpenAPI document generated from the
  Rust contract, and its conventions.

- [Publication ingest](./publication-ingest.md) — authorization, attempt
  states and authorization; [upload lifecycle](./publication-ingest-lifecycle.md)
  owns the delta exchange and build uploads;
  [blob durability](./publication-blob-durability.md) owns durability markers
  and parallel storage writes.
- [Catalogue hosting](./catalogue-hosting.md) — isolated origins, private access and static delivery.
- [Catalogue delivery](./catalogue-delivery.md) — headers, ranges, compression and cache.
- [Changes check](./changes-check.md) — immutable check results and rerequests,
  and [build checks](./changes-check-builds.md) the check of each cloud build.
- [Cloud builds](./cloud-builds.md) — triggers, the build lifecycle, leases,
  supersession and retention, with [records and leases](./cloud-build-lifecycle.md),
  the [runner](./cloud-build-runner.md) and its
  [sandbox](./cloud-build-sandbox.md), the
  [build API](./cloud-build-api.md), [viewer cards and output](./viewer-builds.md)
  and [viewer build navigation](./viewer-build-navigation.md).
- [Retention](./retention.md) — successful publications kept until parent deletion, attempt and grant cleanup, and fenced content collection.

## Boundary With The Open-Source Protocol

The Mokly protocol docs under [`docs/protocol/`](../README.md) own the
contracts for the CLI and its configuration, the build output, the artifact
inventory, the `mokly-upload.json` envelope, the catalogue index and the entry
details, and the `@mokly/viewer` and `@mokly/ui` package APIs. Docs here link
to those contracts and never restate them as if they were owned here. When the
cloud needs a change to any of them, the change updates the Mokly contract
first, in the same change or an earlier one, as the
[repository boundary](../repository-layout.md#boundary) defines.
