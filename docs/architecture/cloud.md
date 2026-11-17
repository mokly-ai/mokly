# Architecture

Mokly Cloud is the hosted companion to the open-source `@mokly/mokly` mockup
catalogue CLI. Teams author React mockups in their own repository; the cloud
publishes each branch's exported catalogue, hosts the viewer, posts a GitHub
check with the Changes count, and can build the catalogue itself in a
one-shot sandbox. This doc describes the components, the responsibility of
each, the boundaries between them, and the flow of data across those
boundaries. It does not describe modules, files, or functions: those live in
each crate or package `README.md` under `### Key Code`. The requirements at
every boundary live in the [protocol docs](../protocol/cloud/README.md).

## Components

| Component        | Runs as                                                                                                         | Responsibility                                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Producer         | The `@mokly/mokly` CLI in the customer's CI or in a build sandbox                                               | Builds the catalogue, compares it with its base, and publishes the export through the upload exchange                       |
| Public site      | A static Astro build on Cloudflare Pages                                                                        | Marketing, documentation rendered from the installed Mokly package, changelog, and legal pages                              |
| Origin router    | A Cloudflare Worker on the public apex and preview hosts                                                        | Gives the site and the product one public origin and selects Pages or the app by path                                       |
| App              | The Expo web build, served by its own workload                                                                  | Account entry, onboarding, settings, and the viewer: the published `@mokly/viewer` with the cloud chrome in its slots       |
| Desktop app      | An Electron shell for macOS and Linux, released from a public releases repository                               | Ships the app's web export, serves it from its own origin, and adds the window, the sign-in handoff, and the updater        |
| API              | The `mkc-api` Rust binary                                                                                       | Accounts, sessions, workspaces, projects, GitHub integration, publication ingest, viewer reads, billing, and the workers    |
| Catalogue server | The `mkc-catalogue-server` Rust binary                                                                          | Serves the exact bytes of a ready publication on that publication's own host                                                |
| Build sandbox    | A one-shot E2B sandbox per build attempt, from the environment's released build template                        | Checks out the head commit and runs the consumer's own `mokly publish` with a build-scoped token                            |
| Database         | Postgres, one database per environment                                                                          | The platform, publication, GitHub, and billing records, and the durable queues the workers drain                            |
| Blob storage     | A GCS bucket per stable environment, a prefix of the shared preview bucket per PR preview, or a local directory | The content-addressed publication files, deduplicated within a project                                                      |
| Providers        | GitHub, Stripe, Postmark, E2B, Cloudflare, GCP                                                                  | Identity and check runs, payment, email delivery, build sandboxes, DNS and edge delivery, and the cluster and cloud storage |

The producer and the viewer are the open-source packages at their exact
pinned releases. The cloud uses only their documented exports and artifacts:
the build output and its ownership marker, the artifact inventory, the upload
envelope and exchange, and the catalogue index and entry details that the
viewer reads. A field or a behavior that the cloud needs lands
in the open repository's protocol docs and a released version first.

### The API

The API is one process. Its HTTP surface is the REST API that the app and
the producer call. The API's Rust types generate the OpenAPI document of that
surface; the API serves exactly the document's operations, and the app's
typed client is generated from it. Its services own the behavior of each
record: the account and platform services own users, workspaces,
projects, grants, slugs, and publishing tokens; the authentication service
owns magic links, sessions, and rate limits; the GitHub integration service
owns installations, repository state, and webhook deliveries; the
publication service owns upload attempts, ready publications, branch
aliases, access grants, retention, blob collection, the check outbox, and
cloud builds with their attempts, logs, and build-scoped tokens; the billing
service owns customers, subscriptions, seat commands, and plan entitlements.

The same process runs the workers that drain the durable queues in the
database: the GitHub delivery worker that applies webhook deliveries, the
billing delivery worker that applies Stripe events, and the seat reconciler
that keeps seat counts and Stripe quantities equal. With GitHub configured,
every replica also runs the check delivery loop that creates and updates the
`Mokly` check runs of publications and builds. With builds configured, every
replica also runs the build worker, which claims queued builds, runs each
attempt in a sandbox, and reconciles the environment's sandboxes. Publication
cleanup and blob collection are workers behind the same traits; the API binary
runs them as a daily maintenance command in each stable environment, using
only the database and the file store.

The API binary is a composition root. It constructs the concrete adapters
(Postgres, the file store, the GitHub, Stripe, and Postmark clients, the E2B
sandbox runner, and the upload memory budget) and injects them into the
services as trait objects. A service never names an adapter.

### The catalogue server

The catalogue server reads a ready publication's file index from the database
and its bytes from blob storage, and serves them unchanged with the isolation
headers that the hosting contract requires. It evaluates no HTML and holds no
publication state of its own. Private publications are reached through a
one-use grant that the API issues and the catalogue host exchanges for its own
access cookie.

### The app

The app is a browser application. The viewer is the application: the
published `@mokly/viewer` owns Browse, Changes, and the catalogue tree, and
the app composes workspace and project switching, branch switching,
history, sharing, settings, and the account menu into the viewer's slots.
Settings are panes of one dialog over the working page on desktop and
full-screen routes on mobile. The desktop app serves the same web export
from its own `mokly-app://desktop` origin, so the product opens without the
network; iOS and Android host the web build in a web view with native chrome
around it.

## Boundaries

### Three origins

| Origin           | Hosts                                                             | Serves                                                         |
| ---------------- | ----------------------------------------------------------------- | -------------------------------------------------------------- |
| Public origin    | `<domain>` in production; `<label>.preview.<domain>` in previews  | The site at its declared paths and the app at every other path |
| API origin       | `api.<domain>`; `<label>.preview.api.<domain>` in previews        | The REST API                                                   |
| Catalogue origin | `p-<publication id>.<catalogue domain>`, one host per publication | The publication's files                                        |

Published catalogues are user-authored HTML, so they are served only from
the catalogue origin. The app and the API never serve publication files, and
the viewer loads screen frames and catalogue data from the catalogue origin.
The router sits in front of the public origin only: it passes the site's
declared paths to Pages and proxies every other path to the app workload,
and it holds no state. The API and the catalogue origins are reached
directly. The desktop app's page is cross-site to both, so they admit the
desktop origin beside the app origin only where the deployment enables the
desktop client.

### Crate layering

Rust crates carry their role in their suffix, and all but the two email
crates use the `mkc-` prefix.
An `-interface` crate holds the traits, the data transfer objects, and the
error contract that cross a boundary. An adapter crate implements one
interface against one provider: the Postgres store, the GCS and local file
stores, the GitHub client, the Stripe client, and the Postmark mailer. A
service crate (`mkc-auth`, `mkc-publications`, `mkc-billing`) depends on
interfaces, on `mkc-domain`, on `mkc-mokly-contract`, and on other service
crates, never on an adapter. `mkc-domain` is pure: typed identifiers, value types, validation, permissions, and the entry
path grammar. `mkc-mokly-contract` decodes and validates the producer's
artifacts within fixed limits and never touches HTTP, the database, or the
filesystem. `mkc-db` owns the migrations, the generated schema, and the
migration lock. The two binaries are the composition roots.

The dependency direction is one way: binaries depend on services and
adapters; services depend on interfaces, the domain, the artifact contract
crate, and other services;
adapters depend on interfaces, the domain, and the shared crates they wrap,
such as the migrations crate under the Postgres store and the generated
templates under the Postmark mailer; and the domain depends on nothing in
the Cargo workspace. Only the API crate maps the authentication, platform, and store
error contracts to HTTP, through the shared `rpc-error` envelope.

### Persistence

The store crates contain queries and row mappings only; a store never sends
mail, calls a provider, or orchestrates a workflow. Each table has one query
owner and one behavior owner, listed in
[Persistence boundaries](../protocol/cloud/persistence-boundaries.md). A write that
must be atomic runs as one serializable transaction whose callback holds
queries and policy only; hashing, clocks, identifier generation, and provider
calls happen outside it. A side effect such as an email is recorded during
the transaction and executed only after the commit, so a rolled-back write
sends nothing.

Blob storage is content addressed within a project: a file is one object per
project and hash, reference counted from the publication files that use it,
and marked durable in the database only after its bytes are stored. The
database is the index of blob storage, so the two are reset together.

### Design system and mockups

The dogfood mockup catalogue under `docs/mockups` is the design
specification. The app, the catalogue, and the site import the same design
tokens and stylesheets from the tokens package, and both the mockups and the
app render the pinned `@firna/ui` controls through one theme mapping. The
viewer drawings compose the pinned open-source `@mokly/ui` parts, from which
the viewer renders its own shell. Mockups complete before the
matching product screens change.

## Data Flows

### Publishing

1. The producer runs `mokly publish`, in CI with a project publishing token
   or in a build sandbox with a build-scoped token. It builds the catalogue
   and sends the plan: the upload envelope, the ownership marker, and the
   catalogue index, whose records carry the Changes against the branch's base.
2. The API validates the plan within its limits, records the upload attempt,
   and reserves a blob reference for every file hash the project does not
   hold yet.
3. The producer uploads the missing blobs by hash; the API stores each one
   and marks it durable.
4. The producer completes the upload. The API verifies that every referenced
   blob is durable, makes the publication ready in one transaction, points
   the branch alias at it, and appends the ready event.
5. The check delivery loop reads the event and creates or updates the head
   commit's `Mokly` check run with the Changes count and links into the
   hosted viewer.
6. The ready publication stays until its project or workspace is deleted.
   Maintenance later closes abandoned attempts and removes old failed ones,
   and blob collection removes objects that no publication references.

A cloud build starts when a push to the default branch or a pull request
reaches a project linked to the GitHub App with Automatic builds on, or when
a reader requests or re-runs a build. An API replica's build worker claims
the build, mints its token, and runs the producer in a sandbox; the build's
check outbox posts the `Mokly` check for each build state.

### Viewing

1. The browser requests the public origin. The router hands the site's paths
   to Pages and every product path to the app.
2. The app resolves the readable address to a workspace, a project, and
   a selection, and reads branches, pull requests, history, and screens from
   the API with the session cookie.
3. The app reads the catalogue index and the entry details from the
   publication's host on the catalogue origin and passes them to the viewer.
   The viewer loads the screen frames from the same host. For a
   private project the app first obtains a one-use grant from the API, and the
   catalogue host exchanges it for its own cookie.
4. The viewer's chrome writes the selection back to the address, so a link
   or a browser history entry reopens the same view.

### Sign-in and accounts

A reader signs in with a magic link, sent through Postmark from a template
generated out of the mockup catalogue, or with GitHub OAuth. Either path
issues one session cookie; browser mutations also carry a CSRF token. A
magic link requested from the desktop app opens a browser landing that hands
the one-use token to the app through the `mokly` scheme. A
workspace connects a GitHub installation; its repositories become projects,
and the installation's webhooks keep branch and pull request state current
through the durable delivery queue.

### Billing

An owner starts Stripe Checkout or the Portal from the settings dialog. Stripe
reports the outcome through signed webhooks that land in the durable delivery
queue. The billing delivery worker derives the workspace's plan from the
subscription status, and the seat reconciler keeps the billed quantities equal
to the seats in use. Plan-gated writes check the stored plan inside their own
transaction.

### Deployment

The repository gate builds and verifies every push. A merge to `main` first
applies the saved foundation Terraform plan: the shared platform, its IAM and
the CI identities. The Deploy run of the same commit builds the three workload
images while it waits for that apply. It then deploys the Worker, applies the
saved Terraform plans for the stable environments, syncs the email templates to
Postmark, releases the Helm charts and runs the smoke checks against each
rollout. The site workflow deploys the site from the same merge without that
wait. A labelled pull request gets its own preview namespace with its own
Postgres and blob prefix on the shared preview platform, seeded with a sample
project, and cleaned up when the label or the pull request goes away.

## Environments

| Environment    | Public origin              | Database                  | Blob storage                  |
| -------------- | -------------------------- | ------------------------- | ----------------------------- |
| `production`   | `<domain>`                 | Cloud SQL                 | Its own bucket                |
| `main-preview` | `br-main.preview.<domain>` | Cloud SQL                 | Its own bucket                |
| `preview-pr-N` | `pr-N.preview.<domain>`    | Postgres in the namespace | A prefix in the shared bucket |

The [environment inventory](../ops/environment.md) records the concrete
resources, and [PR preview environments](../protocol/cloud/pr-preview-environments.md)
holds the preview lifecycle requirements.

## Related Docs

- [Repository layout](../protocol/cloud/repository-layout.md) and
  [Persistence boundaries](../protocol/cloud/persistence-boundaries.md).
- [Origin router](../protocol/cloud/origin-router.md),
  [Catalogue hosting](../protocol/cloud/catalogue-hosting.md), and
  [Viewer](../protocol/cloud/viewer.md).
- [Publication upload](../protocol/cloud/publication-upload.md),
  [Publication ingest](../protocol/cloud/publication-ingest.md),
  [Changes check](../protocol/cloud/changes-check.md), and
  [Retention](../protocol/cloud/retention.md).
- [Cloud builds](../protocol/cloud/cloud-builds.md),
  [Cloud build runner](../protocol/cloud/cloud-build-runner.md),
  [Cloud build sandbox](../protocol/cloud/cloud-build-sandbox.md), and
  [Cloud build API](../protocol/cloud/cloud-build-api.md).
- [REST API](../protocol/cloud/rest-api.md),
  [Platform model](../protocol/cloud/platform-model.md),
  [Authentication and sessions](../protocol/cloud/auth-sessions.md),
  [GitHub App](../protocol/cloud/github-app.md), [Email](../protocol/cloud/email.md), and
  [Billing](../protocol/cloud/billing.md).
- [Mokly artifact compatibility](../protocol/cloud/mokly-artifact-compatibility.md)
  and [Mockup catalogue](../protocol/cloud/mockups.md).
- [Infrastructure promotion](../protocol/cloud/infrastructure-promotion.md),
  [Foundation promotion](../protocol/cloud/foundation-promotion.md) and the
  [operations runbooks](../ops/README.md).
