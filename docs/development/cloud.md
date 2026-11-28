# Mokly Cloud

Mokly Cloud is the hosted companion to the open-source
[`@mokly/mokly`](https://www.npmjs.com/package/@mokly/mokly) mockup catalogue
CLI. Teams keep authoring React mockups in their own repository. The cloud
publishes each branch's exported catalogue, posts a GitHub check with the
Changes count, and gives every project a hosted viewer for its branches and
pull requests. This repository also builds the static public website and
documentation, rendering CLI guides from the workspace Mokly package. Where
this leads (review, editing, native apps) is in
[Product direction](../product-direction.md).

## Key Features

- **Per-branch published catalogues.** `mokly publish` from CI sends only the
  files the project has not stored yet; every publication gets a permanent URL
  and each branch an alias to its latest publication.
- **Cloud builds.** With the GitHub App installed, Mokly Cloud schedules
  default-branch and same-repository pull request builds. The worker runs the
  repository's own `mokly publish` in a one-shot sandbox and delivers build
  checks. Its upload exchange commits a ready publication with the build
  association. In the viewer, members publish a branch or pull request with
  one press, watch its build's steps and live output, cancel or retry it, and
  see builds in history and the switcher; administrators turn Automatic builds
  on or off in the project pane. Stable deployments can enable builds through
  the chart after an operator verifies the
  [build template](../ops/build-template.md). The contract is
  [Cloud builds](../protocol/cloud/cloud-builds.md). Builds require Mokly 0.18.0
  or later, a `mokly.config.json` configuration and a clean checkout.
- **Changes check on the pull request.** A `Mokly` check reports how many
  entries changed, were added, or removed, with links straight into the
  hosted Changes view. Installation-linked projects receive the check from the
  API worker. Publication Re-run delivers the same result. Build Re-run retries
  an eligible current head after a failure, timeout or cancellation.
- **Hosted viewer.** The app hosts the viewer surface with branch and pull
  request switching, publication history and sharing in its cloud chrome.
- **Standalone workspace.** Sign up, connect a GitHub organization, and browse
  any project's branches and pull requests without arriving from a link.
- **Desktop app.** An Electron app for macOS and Linux opens the same product
  from its bundled web export, also without the network.

## Relationship To The Open-Source Package

The cloud uses the workspace `@mokly/mokly`, `@mokly/viewer` and `@mokly/ui`
packages of this repository directly, not published npm releases, as
[Repository layout](../protocol/repository-layout.md#boundary) defines. It uses
only their documented exports and the documented file artifacts they produce:
the build output, its ownership marker, the catalogue index and entry details,
and the upload envelope and exchange used by `mokly publish`.
The cloud never imports Mokly internals. A field that the cloud needs lands
first in the Mokly protocol docs.

## Using Mokly Cloud

- **Publish.** Create a publishing token in the project's Tokens settings
  pane, store it as a CI secret, and run `mokly publish` from a clean checkout.
  The CLI builds the catalogue, sends the plan, uploads only the files the
  project has not stored yet, and completes the upload; the branch alias then
  points at the ready publication.
  [Publication upload](../protocol/cloud/publication-upload.md) defines the receiver.
- **Cloud builds.** With the GitHub App installed and Automatic builds on, a
  push to the default branch or a same-repository pull request builds and
  publishes in a one-shot sandbox, and the viewer can publish a branch or pull
  request by hand. [Cloud builds](../protocol/cloud/cloud-builds.md) defines the
  lifecycle and [Cloud build API](../protocol/cloud/cloud-build-api.md) the
  build operations.
- **Changes check.** A `Mokly` check run on the pull request reports the
  Changes count of each ready publication, and its details link opens the
  publication with Changes selected. With GitHub configured, the API delivers
  it for installation-linked projects.
  [Changes check](../protocol/cloud/changes-check.md) defines the result.
- **Hosted viewer.** `/<workspace>/<project>` opens the default branch's
  latest ready publication, branch and pull request routes resolve to theirs,
  and `/<workspace>/<project>/publications/<id>` is the permanent address
  that a share link pins. [Product navigation](../protocol/cloud/product-navigation.md)
  defines the routes and [Viewer](../protocol/cloud/viewer.md) the viewer.
- **Desktop app.** The Electron shell for macOS and Linux serves the bundled
  web export from its own origin, so the product opens without the network,
  and signs in through the browser with a desktop grant returned through the
  `mokly` scheme. The
  [desktop release workflow](../../.github/workflows/desktop-release.yml)
  packages previews without release signing. A merged desktop release pull
  request starts a release that signs and notarizes the macOS packages. The
  Linux `AppImage` and `deb` are unsigned. Both platforms fill one draft,
  which becomes the latest release only after the check of all its assets.
  [Desktop application](../protocol/cloud/desktop-app.md) defines the shell and
  [Desktop distribution](../protocol/cloud/desktop-distribution.md) its releases.
- **REST API.** The API serves `/v1` on the API origin for the app and for
  `mokly publish`, with a session cookie for browsers and a publishing token
  for CI. [REST API](../protocol/cloud/rest-api.md) defines the running
  boundary and the [API reference](../api/README.md) describes the OpenAPI
  document that the Rust contract generates.

## Domain Layout

Production shares `https://<domain>` between the static site and the product.
The site owns `/`, `/docs/…`, `/changelog`, `/terms`, `/privacy`,
`/complaints`, `/security` and its declared assets. Product addresses are
`/<workspace>/<project>`, with `/dashboard` reopening the last-used project
and `/sign-in` and `/sign-up` for account entry. Workspace actions use
`/<workspace>/-/…`. UUID permalinks and retired slugs resolve to the
current address and keep the viewer selection.

The origin router, a Cloudflare Worker, handles the whole public origin: it
passes site paths through to Pages and proxies product paths to the private
app workload. Preview hosts `https://<label>.preview.<domain>` serve the app
at every path. The API origin is `api.<domain>` in production and
`<label>.preview.api.<domain>` in previews. Published catalogues are served
only from their own sandbox origin, one host per publication. See the
[origin router](../protocol/cloud/origin-router.md),
[product navigation](../protocol/cloud/product-navigation.md) and the
[environment inventory](../ops/environment.md).

## Developer Get Started

### Toolchains

Install Rust **1.98.1** with rustfmt and clippy, Node **24.21.0**, npm
**11.21.0**, Terraform **1.16.2** and Helm **4.3.0**, plus Git and a native C
linker. The [pin table](../protocol/cloud/repository-layout.md#pinned-toolchains)
is the source of truth. On Linux amd64, `bash infra/scripts/install-tools.sh`
installs Terraform and Helm after the clone; on other platforms, install the
same releases by hand. The workspace Mokly CLI is a native binary for Linux x64
or ARM64 with glibc 2.28 or newer, or macOS 11 or newer, which `npm run build`
builds for the host. It is an npm optional dependency, so keep optional
dependencies enabled.

### Clone And Check

With network access to GitHub and the package registries:

```bash
git clone https://github.com/mokly-ai/mokly.git
cd mokly
bash infra/scripts/install-tools.sh  # Linux amd64 only
npm ci
npm exec --workspace @mokly-cloud/mockups -- playwright install chromium
cargo xtask check                    # the complete gate
```

The check installs the npm dependencies from the lockfile and runs every
suite, the Mokly suites included; the [Mokly developer guide](./README.md)
lists the tools that those suites need. Run `npm run build` before a cloud
build, a cloud test or a local server, because the cloud uses the built
workspace packages. `origin/main` must be available; after a shallow or
single-branch clone, run `git fetch origin main:refs/remotes/origin/main`.
Chromium is required for the catalogue, site and app browser tests; on
supported Linux hosts, add `--with-deps` to its install command to install the
system libraries too. The `cloud-desktop` suite also needs Electron's GTK 3,
NSS and ALSA libraries and `xvfb-run` on Linux; see the
[desktop development guide](../../packages/desktop/README.md#development). The platform
integration tests use Postgres 16, Python 3 and `psql`, and read
`MKC_TEST_DATABASE_URL` to select the database. An unreachable database fails
the run when `MKC_TEST_DATABASE_URL` or `CI` is set; an unconfigured
developer machine skips it with a printed reason. The
[xtask guide](../../xtask/README.md) lists every suite and its prerequisites.

### Local Servers

`npm run dev:cloud` starts the whole local stack with one command. It installs
the npm dependencies when they are missing or out of date and always runs the
incremental `npm run build`. It uses the Postgres server that answers on the
`MKC_DATABASE_URL` host and port, and otherwise starts the Compose `postgres`
service. It builds the API and the catalogue server, starts both, and starts
the app on `:8081` once both answer their health checks. Each output line
carries the `[api]`, `[catalogue]` or `[app]` prefix. Ctrl+C stops the API,
the catalogue server and the app, and a second Ctrl+C forces them to stop and
ends the command.
When one of them exits, the command stops the others and fails. A Compose
Postgres that the command started keeps running with its data, and
`docker compose stop postgres` stops it. The command needs Bash, so it runs
on Linux and macOS. The steps below start the same servers one at a time.

`docker compose up -d` starts Postgres 16 with the `mkc_test` database and an
optional Mailpit. With a native Postgres 16, use a cluster with the UTF8
server encoding, for example one created with
`initdb -E UTF8 --locale=C.UTF-8`, and create `mkc_test` in it for the
`postgres` role with the password `postgres`. Then run `scripts/cloud/dev-api.sh`:
the API applies the migrations and listens on `127.0.0.1:8080`, and the
development mailer writes sign-in links to the log. In a second terminal,
`scripts/cloud/dev-catalogue.sh` serves publications at
`p-<publication-id>.localhost:8082`. Both servers share the private blob
directory and signing key under `.context/`. Both scripts default
`MKC_DESKTOP_CLIENT` to `true` to admit the installed shell's origin beside
the public app origin. Reset `.context/blobs` and the development database
together; keeping one alone leaves the storage durability markers out of step
with their bytes. `scripts/cloud/dev-api.sh` also
creates the persistent mode-0600 `.context/preview-password`, the local
preview password, and runs the API with its verifier. The
[API guide](../../crates/mkc-api/README.md) documents the commands and the
configuration; the [publish smoke guide](../ops/publish-smoke.md)
exercises the published CLI with real project tokens.

### Local Preview Stack

The capture and seed commands create the same private **Mokly Cloud** sample
project as a PR preview;
[Local preview seed](../protocol/cloud/preview-seed-local.md) defines the
local commands. Run from the repository root. Each comment marks a separate
terminal; leave the three server commands running:

```sh
# Run once
python3 infra/scripts/capture-catalogue.py --local --checkout . --repository mokly-ai/mokly
# Terminal 1
scripts/cloud/dev-api.sh
# Terminal 2
scripts/cloud/dev-catalogue.sh
# Run once from another terminal after both services are ready
scripts/cloud/dev-api.sh preview-seed
# Terminal 3
npm run start --workspace @mokly-cloud/app
```

Add `--debug-timings` to the capture command to print Mokly's timing events
and the capture summary. Sign in on `http://localhost:8081/sign-in`: type the
password from `.context/preview-password` in **Password** and select
**Continue as preview@mokly.ai**. The project is private, and the viewer
cannot load its private comparison, so Changes show an overlay without an
action.

### API Contract

Rust owns every API boundary type. After a change to one, run
`cargo xtask openapi` to regenerate `docs/api/openapi.json` and the app's
generated client; `cargo xtask openapi --check` reports drift, as the
`cloud-openapi` suite of the gate does. The
[API reference](../api/README.md) gives the conventions.

### Mockups And Emails

`npm run mockups:serve` browses the dogfood catalogue. Build before disk
inspection or tests with `npm run mockups:build`, which writes the ignored
`mokly-static/`. Then run `npm run mockups:check`, a strict build
into an ignored `.context` directory, `npm run mockups:test` and
`npm run mockups:typecheck`. Commit the authored source, styles and assets;
Mokly writes nothing else into the repository and keeps its caches outside it.
The tests compare two independent builds. Changes render the
`origin/main` merge base from its sources, so they need trusted history and
registry access; [Mockup comparison base](../protocol/cloud/mockup-baselines.md)
defines the base. The [mockup catalogue guide](../mockups/README.md)
explains how to add or change a screen.

The sign-in and invitation emails are authored in the same catalogue.
`npm run emails:build` generates the committed templates and
`npm run emails:check` reports drift; deployment uploads changed templates to
the stable Postmark servers before the API rollout. See
[Email](../protocol/cloud/email.md),
[Email authoring](../protocol/cloud/email-authoring.md) and
[Postmark sync](../protocol/cloud/email-postmark-sync.md).

## Key Code

Each entry links the README that names the entry points of that area;
[Repository layout](../protocol/cloud/repository-layout.md) defines the
directories and the [architecture doc](../architecture/cloud.md) the components.

### Rust Workspace

| Crate                                                                             | Owns                                                                                                       |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [mkc-api](../../crates/mkc-api/README.md)                                         | The REST API binary and the composition root that also runs the workers                                    |
| [mkc-catalogue-server](../../crates/mkc-catalogue-server/README.md)               | The isolated host that serves ready publications on the catalogue domain                                   |
| [mkc-domain](../../crates/mkc-domain/README.md)                                   | Pure identity, permission and validation types with no runtime dependency                                  |
| [mkc-config](../../crates/mkc-config/README.md)                                   | Typed environment configuration for the two binaries                                                       |
| [mkc-db](../../crates/mkc-db/README.md)                                           | The Diesel migrations, the generated schema and the migration runner                                       |
| [mkc-auth](../../crates/mkc-auth/README.md)                                       | The magic-link, preview and session authentication policy                                                  |
| [mkc-publications](../../crates/mkc-publications/README.md)                       | Publication ingest, catalogue access, cloud build scheduling, check delivery and retention                 |
| [mkc-build-interface](../../crates/mkc-build-interface/README.md)                 | The contracts for one cloud build attempt: runner, steps, outcomes, redacted output                        |
| [mkc-build-sandbox](../../crates/mkc-build-sandbox/README.md)                     | The runner that executes one build in a one-shot sandbox                                                   |
| [mkc-mokly-contract](../../crates/mkc-mokly-contract/README.md)                   | Validation of the Mokly upload artifacts within fixed limits                                               |
| [mkc-billing](../../crates/mkc-billing/README.md)                                 | Billing policy, plan gates, and the Stripe webhook and seat workers                                        |
| [mkc-billing-interface](../../crates/mkc-billing-interface/README.md)             | The typed billing-provider traits that the services depend on                                              |
| [mkc-billing-stripe](../../crates/mkc-billing-stripe/README.md)                   | The Stripe HTTP implementation of those traits                                                             |
| [mkc-store-interface](../../crates/mkc-store-interface/README.md)                 | The transactional persistence contracts that the services query through                                    |
| [mkc-store-pg](../../crates/mkc-store-pg/README.md)                               | The Postgres implementation of the persistence contracts                                                   |
| [mkc-file-store-interface](../../crates/mkc-file-store-interface/README.md)       | The immutable content storage contract                                                                     |
| [mkc-file-store-gcs](../../crates/mkc-file-store-gcs/README.md)                   | The Google Cloud Storage implementation of the file store                                                  |
| [mkc-file-store-local](../../crates/mkc-file-store-local/README.md)               | The local directory file store for development and tests                                                   |
| [mkc-github-interface](../../crates/mkc-github-interface/README.md)               | The typed GitHub App provider traits                                                                       |
| [mkc-github](../../crates/mkc-github/README.md)                                   | The GitHub App HTTP implementation: JWT signing, token cache, webhooks                                     |
| [mkc-github-double](../../crates/mkc-github-double/README.md)                     | The recorded GitHub that development and the test suites install and authorize against                     |
| [mkc-upload-memory-interface](../../crates/mkc-upload-memory-interface/README.md) | The upload-memory admission contract shared by every upload body                                           |
| [mkc-upload-memory](../../crates/mkc-upload-memory/README.md)                     | The process-wide upload byte budget that implements it                                                     |
| [mkc-email-interface](../../crates/mkc-email-interface/README.md)                 | The single-recipient mail boundary that the services send through                                          |
| [mkc-email-postmark](../../crates/mkc-email-postmark/README.md)                   | The Postmark and development-log mailers                                                                   |
| [mkc-email-templates](../../crates/mkc-email-templates/README.md)                 | The committed sign-in and invitation templates generated from the mockups                                  |
| [mkc-test-pg](../../crates/mkc-test-pg/README.md)                                 | Disposable Postgres schemas for integration tests                                                          |
| [mkc-test-support](../../crates/mkc-test-support/README.md)                       | Pure fixture builders shared by tests                                                                      |
| [xtask](../../xtask/README.md)                                                    | The verification binary behind `cargo xtask check`, `cargo xtask openapi` and the Stripe catalogue command |

### TypeScript, Mockups And Infrastructure

The [cloud npm projects README](../../apps/README.md) describes the cloud
projects of the root npm workspace and their shared scripts.

| Area                                                 | Owns                                                                                    |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------- |
| [packages/app](../../packages/app/README.md)         | The Expo application: account entry, onboarding, settings and the hosted viewer         |
| [packages/desktop](../../packages/desktop/README.md) | The Electron desktop shell: the bundled web export, the sign-in handoff and the updater |
| [apps/mockups](../../apps/mockups/README.md)         | The workspace Mokly packages and the scripts that build and verify the catalogue        |
| [apps/site](../../apps/site/README.md)               | The static Astro marketing, documentation, changelog and legal site                     |
| [packages/tokens](../../packages/tokens/README.md)   | The design tokens, surface families, CSS custom properties and control theme            |
| [apps/worker](../../apps/worker/README.md)           | The Cloudflare Worker that routes the shared public origin                              |
| [docs/mockups](../mockups/README.md)                 | The design specification: the dogfood catalogue of design material and screens          |
| [infra](../../infra/README.md)                       | Terraform, the workload images, Helm, the deployment scripts and their tests            |

## Related Docs

- [Architecture](../architecture/cloud.md) — the components, their
  responsibilities, the boundaries and the data flows.
- [Protocol docs](../protocol/cloud/README.md) — the requirements and the
  decisions in force that the code must meet.
- [Docs index](../README.md) — the doc areas and where content lives.
- [Plans](../../plans/README.md) — the index of plan files; each plan holds the
  design and the dated history of its change and records its status below its
  title.
- [Operations runbooks](../ops/README.md) — environments, deployment,
  previews, secrets and recovery.
- [Product direction](../product-direction.md) — the phases beyond the
  initial scope and what it must not preclude.
- [Agent rules](../../AGENTS.md) — the repository rules and the shared skills.
