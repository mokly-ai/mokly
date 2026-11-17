# Repository Layout

Status: The move of Mokly Cloud into this layout is not complete, and no check enforces the boundary yet. The [combine plan](../../plans/combine-mokly-cloud.md) completes the move and adds the check.

This repository holds one product in two parts. Mokly is the open-source
toolkit: the Rust core, the `mokly` command, and the npm packages that build,
serve, and view mockup catalogues. Mokly Cloud is its hosted companion. It
publishes the catalogue of each branch, posts a GitHub check, and hosts the
viewer. This contract defines where each part lives, how the cloud crates are
named, which license covers each path, and the dependency boundary between
the two parts. The
[package and consumer boundary](../architecture/package-boundary.md) defines
the boundary between Mokly and every consumer, the cloud included.

## Directories

| Path                   | Owns                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| `crates/mokly-*/`      | The Mokly Rust core, one crate in each directory                                          |
| `crates/mkc-*/`        | The cloud Rust crates: the API, the catalogue server, the stores, and their adapters      |
| `xtask/`               | The task runner of both parts; `cargo xtask check` is the complete gate                   |
| `packages/`            | The Mokly npm packages: `mokly`, `viewer`, `ui`, `model`, `frame`, and the native targets |
| `packages/tokens/`     | `@mokly-cloud/tokens`, the private design tokens of the cloud projects                    |
| `apps/app/`            | The Expo app: account entry, onboarding, settings, and the hosted viewer                  |
| `apps/desktop/`        | The Electron desktop shell that serves the web export of the app                          |
| `apps/site/`           | The static Astro marketing, documentation, and legal site                                 |
| `apps/worker/`         | The Cloudflare Worker that routes the shared public origin                                |
| `apps/mockups/`        | The scripts that build and check the cloud mockup catalogue                               |
| `examples/basic/`      | The Mokly example catalogue and the design mockups of the Browse shell                    |
| `tests/`               | The Mokly tooling tests and browser specs                                                 |
| `docs/guides/`         | The Mokly user guides, which ship with `@mokly/mokly`                                     |
| `docs/protocol/`       | The Mokly protocol docs and this contract                                                 |
| `docs/protocol/cloud/` | The cloud protocol docs                                                                   |
| `docs/architecture/`   | The architecture docs; `cloud.md` describes the cloud                                     |
| `docs/development/`    | The developer guide                                                                       |
| `docs/api/`            | The OpenAPI document that the cloud API contract generates, and its guide                 |
| `docs/mockups/`        | The source, styles, and assets of the cloud mockup catalogue                              |
| `docs/ops/`            | The cloud operations runbooks                                                             |
| `infra/`               | Terraform, the workload images, Helm, the deployment scripts, and their tests             |
| `scripts/`             | The Mokly developer, verification, and release scripts                                    |
| `scripts/cloud/`       | The cloud developer and smoke scripts                                                     |
| `rules/`               | The ast-grep rules and their cases; `sgconfig.yml` configures them                        |
| `fixtures/`            | The shared smoke inputs of the cloud API                                                  |
| `plans/`               | The plans and follow-up items of both parts                                               |
| `.github/workflows/`   | The CI, release, preview, and deploy workflows of both parts                              |
| `mokly.config.json`    | The configuration of the cloud mockup catalogue                                           |
| `diesel.toml`          | The Diesel configuration of the cloud migrations                                          |
| `docker-compose.yml`   | The local Postgres and mail services of cloud development                                 |

Decision: the cloud protocol docs live under `docs/protocol/cloud/`, not beside
the Mokly docs, because names such as `viewer.md` are ambiguous there.

## Workspaces

One Cargo workspace at the root holds `xtask` and every crate under `crates/`.
It uses resolver 3. `rust-toolchain.toml` pins Rust 1.98.1, and 1.98.1 is the
`rust-version` of every crate. No crate of the workspace is published to
crates.io, so the minimum Rust version can rise without a cost to a consumer.

One npm workspace at the root holds the Mokly packages, `packages/tokens/`,
and the projects under `apps/`, with one lockfile, `package-lock.json`. The
`packageManager` field pins npm 11.21.0. One React version serves the viewer,
the UI package, and the cloud app, so that the app bundle holds one React
instance. Expo and React Native set the upper bound of that version.

## Crate Names

A Mokly crate is named `mokly-<area>`, and a cloud crate is named
`mkc-<area>`. Every cloud crate has the `mkc-` prefix, the mail crates
`mkc-email-interface` and `mkc-email-postmark` included. The task runner is
`xtask` and has no prefix. The prefix decides the license and the boundary
rule of a crate. The suffix rules of the cloud crates, such as `-interface`
and `-store-pg`, are in `docs/protocol/cloud/repository-rust-workspace.md`.

## License Scope

The root `LICENSE` holds the MIT License and names the AGPL paths. The AGPL
paths hold Mokly Cloud:

- `apps/`;
- every `mkc-` crate under `crates/`;
- `packages/tokens/`;
- `infra/`;
- `scripts/cloud/`.

The GNU Affero General Public License, version 3 only, covers the AGPL paths.
`LICENSES/AGPL-3.0-only.txt` holds the AGPL-3.0 text once for every AGPL
path. Each Cargo and
npm manifest under an AGPL path sets its license to `AGPL-3.0-only`. A new
`mkc-` crate and a new project under `apps/` follow the same rules. A
third-party file that names its own license, such as a notice under an AGPL
path, keeps that license.

The MIT License covers every other path: the Mokly crates and packages,
`xtask`, the docs, the cloud mockups under `docs/mockups/`, and the plans.

Decision: AGPL-3.0 for the cloud paths and MIT for the rest, so that a
competing host of the cloud must publish its changes. MIT for everything, MIT
with a trademark policy, a source-available license for the cloud paths, and
AGPL-3.0 for the whole repository were rejected. Decision: the `-only` form,
not `-or-later`, so that the terms stay under the control of this repository.
Decision: one shared AGPL text, not a copy in each AGPL path, because the
`mkc-` crates alone would need many copies.

## Boundary

Mokly is app-independent, and it never depends on the cloud:

- No `mokly-*` crate depends on an `mkc-` crate, as a normal, dev, or build
  dependency.
- No package under `packages/` imports a project under `apps/`.

The cloud may depend on Mokly. A check in the Repository suite of
[CI verification](./ci-verification.md#gate-ownership) enforces both rules.

The cloud uses the workspace `@mokly/*` packages and `mokly-*` crates
directly, not published npm releases. A Mokly change therefore reaches the
cloud without a release, and the cloud deploys unreleased Mokly code from
`main`. Decision: workspace use, not exact pins on published releases, so that
a change across both parts needs no release and no version bump.

`cargo xtask mokly-fixtures` regenerates the cloud contract fixtures from the
workspace build, not from installed npm releases. The drift check of the gate
fails when the committed fixtures differ from that build.

## Related Docs

- [Package and consumer boundary](../architecture/package-boundary.md)
- [CI verification](./ci-verification.md)
- [CI workflow graph](./ci-workflow.md)
- [Developer test commands](./developer-test-commands.md)
