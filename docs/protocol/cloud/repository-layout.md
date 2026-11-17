# Repository Layout

This contract defines where code lives, how it is named, which toolchains are
pinned, and what `cargo xtask check` verifies. The components, their
boundaries, and the data flows between them are in the
[architecture doc](../../architecture/cloud.md).

## Directories

| Path                           | Owns                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| `AGENTS.md`                    | Repository agent rules and the shared skills they name; `CLAUDE.md` links to it             |
| `crates/`                      | Rust workspace crates, one directory per crate, each with a `README.md`                     |
| `crates/mkc-api/src/contract/` | Rust API operation contracts and the OpenAPI document root                                  |
| `xtask/`                       | Cargo workspace automation binary; `cargo xtask check` is the single verification entry     |
| `ts/`                          | npm workspace root for `app`, `desktop`, `mockups`, `tokens`, `site` and `worker`           |
| `apps/app/`                    | Expo app: sign-in, sign-up and the logged-in product on the web                             |
| `apps/desktop/`                | Electron desktop shell serving the bundled web export                                       |
| `apps/mockups/`                | Pinned `@mokly/mokly` dependency, React peers, Playwright, and the mockup scripts           |
| `packages/tokens/`             | `@mokly-cloud/tokens`: token tables, palettes, token CSS and the Firna theme                |
| `apps/site/`                   | Static Astro marketing, docs, changelog and legal site                                      |
| `apps/worker/`                 | Cloudflare origin-router source, Wrangler config, types and tests                           |
| `docs/`                        | Docs index, protocol docs, mockups, and operations runbooks                                 |
| `docs/architecture/cloud.md`   | The system architecture doc: components, their responsibilities, boundaries, and data flows |
| `docs/protocol/cloud/`         | Protocol docs: the requirements and the decisions in force for each area                    |
| `docs/mockups/`                | Dogfood catalogue source, styles and assets; no build output                                |
| `docs/ops/`                    | Environment, deployment, secrets, and smoke-test runbooks                                   |
| `docs/api/`                    | Committed `openapi.json` generated from the Rust API contract, and the API guide            |
| `plans/`                       | Implementation plans, each with its status below its title                                  |
| `infra/`                       | Terraform, container images, Helm, deployment scripts and infrastructure tests              |
| `scripts/`                     | Developer scripts that are not part of `xtask`                                              |
| `fixtures/`                    | Shared Rust/API smoke inputs, with ownership and provenance in their README                 |
| `rules/`                       | ast-grep rules for Rust and the app, with their cases under `rules/_tests_/`                |
| `.github/workflows/`           | CI, deploy, and preview workflows                                                           |
| `.context/`                    | Git-ignored scratch space for agents, review output, and local build artifacts              |
| `mokly-static/`                | Git-ignored output of `npm run mockups:build`, the static dogfood catalogue                 |
| `mokly.config.json`            | Data-only Mokly configuration for the dogfood catalogue                                     |

Build sandbox templates have a local verification suite and an opt-in live
probe. Both verify the same environment contract through the pinned provider
boundary. The [template guide](../../ops/build-template.md) documents their use.

## Rust Workspace

The Cargo workspace, crate naming, what each crate owns, the pinned public
dependencies and the migration lock are in
[Repository Rust workspace](./repository-rust-workspace.md).

## TypeScript npm Workspace

The npm workspace, its packages and their exact pins, the generated API
client, the app layout, and the formatting, lint and import rules are in
[Repository TypeScript layout](./repository-typescript.md).

## Pinned Toolchains

The API contract pins are `utoipa` 6.0.0 in the Cargo workspace,
`openapi-typescript` 7.13.0 and `openapi-fetch` 0.17.0 in the app npm workspace.
The [API contract guide](../../api/README.md) documents regeneration.

| Tool                | Version                                                                                                           | Pin                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Rust                | 1.98.1                                                                                                            | `rust-toolchain.toml` (`channel = "1.98.1"`, components `rustfmt`, `clippy`)      |
| Node                | 24.21.0                                                                                                           | `.nvmrc`; `engines.node` in root and `ts/` `package.json` is `>=24.21.0 <25`      |
| npm                 | 11.11.0                                                                                                           | `packageManager = "npm@11.11.0"` in root and `ts/` `package.json`                 |
| tar                 | 7.5.22                                                                                                            | Fixture packer in `package.json` `devDependencies` and the npm lockfile           |
| Terraform           | 1.16.2                                                                                                            | `infra/toolchains.json`; every Terraform root/module requires this version        |
| Helm                | 4.3.0                                                                                                             | `infra/toolchains.json`; native golden tests, no plugin                           |
| ingress-nginx chart | 4.15.1                                                                                                            | `infra/toolchains.json` → `ingress_nginx_chart`                                   |
| cert-manager chart  | v1.21.2                                                                                                           | `infra/toolchains.json` → `cert_manager_chart`                                    |
| Postgres image      | docker.io/library/postgres:16.15-bookworm@sha256:efedf3595f1d6f415c08568ba171029bf54052e754cc9f030e3f2412b21f3d67 | `infra/toolchains.json` → `postgres_image`                                        |
| Chromium            | —                                                                                                                 | Installed once at the Playwright version pinned by the TypeScript lockfile        |
| Electron            | 44.7.2                                                                                                            | `apps/desktop/package.json`; bundles Node 24.21.0, the Node pin, and Chromium 152 |

CI installs the active toolchains at exactly these versions; local development
should match them. The table is the source of truth; update matching pin files
in the same change. The toolchain-pins stage rejects disagreement between the
Rust, Node, npm, tar, Terraform and Helm rows, their pin files and the
installed tools. The chart and image rows must equal the matching
`infra/toolchains.json` values, which the preview platform scripts and the
Helm tests read; no floating image or chart tag is permitted. Image digests
are the registry manifest-list SHA-256 values for `linux/amd64`. Git and a
native linker remain prerequisites; no Docker daemon is needed.

Image jobs pin BuildKit 0.33.0, crane 0.22.1 and Google Cloud SDK 585.0.0 in
the same JSON file. The BuildKit runtime and capacity requirements are in
[Repository verification](./repository-verification.md#image-build-runtime).
Provider versions and checksums are committed in Terraform dependency locks.
Chromium is installed at the Playwright version the lockfile pins before the
mockup, site and app stages run; the
[get started guide](../../development/cloud.md#developer-get-started) gives the
commands, and CI installs the browser's operating-system libraries too.

The preview platform keeps ingress-nginx chart 4.15.1, the final stable chart
of a controller that
[upstream retired in March 2026](https://kubernetes.io/blog/2025/11/11/ingress-nginx-retirement/).
Replacing the controller is a separate decision; until it is made, the pin
does not move and receives no upstream security updates, and the preview
platform must not rely on them.

### Build Toolchain Checks

The unsupported-version message in the viewer contract, app and mockups must
name the runner's minimum supported Mokly version. The toolchain check rejects
any difference.

Each build template base image must use
`e2bdev/base:<tag>@sha256:<64 lowercase hex>`. The tag records the digest's
source. Missing tags and malformed or absent digests fail, under the
[template pin rule](./cloud-build-runner.md#template). The
[verification guide](../../../xtask/README.md) names the checked files and constants.

## Verification: `cargo xtask check`

The complete 25-stage sequence, hosted partitions and image runtime requirements
are in [Repository verification](./repository-verification.md). Preview
contracts are in [PR preview environments](./pr-preview-environments.md).
Only stable environments have Terraform environment states; PR resources are
created and deleted by the preview workflow.

`xtask` also exposes the `stripe-catalogue` command, whose `sync` subcommand
stable promotion jobs and operators run and whose `archive` subcommand only an
operator runs; neither is one of the 25 check stages, and deployment jobs do
not invoke `archive`. For it, `xtask` depends on `mkc-domain`,
`mkc-billing-interface` and `mkc-billing-stripe`; application crates do not
depend on `xtask`.
