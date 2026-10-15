<p align="center">
  <img src="https://mokly.ai/brand/mokly-logo.svg" alt="Mokly" width="360">
</p>

<p align="center">
  <strong>
    Build browsable, reviewable mockup catalogues from HTML, React, and Storybook.
  </strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@mokly/mokly"><img src="https://img.shields.io/npm/v/%40mokly%2Fmokly?color=4f7864&amp;label=npm" alt="npm version"></a>
  <a href="https://github.com/mokly-ai/mokly/actions/workflows/ci.yml"><img src="https://github.com/mokly-ai/mokly/actions/workflows/ci.yml/badge.svg" alt="CI status"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-4f7864" alt="MIT license"></a>
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#command-line">CLI</a> ·
  <a href="#authoring">Authoring</a> ·
  <a href="./packages/viewer/README.md">React viewer</a> ·
  <a href="./docs/protocol/README.md">Protocols</a>
</p>

Mokly is an open-source toolkit for turning product screens into a searchable
static catalogue. A screen is an HTML file with YAML front matter, a React
component, or a Storybook story. Mokly renders every screen at mobile and
desktop sizes, in light and dark, and shows which screens changed between two
Git commits.

Status: In progress under the [Rust rebuild plan](./plans/rust-rebuild.md).

Run Mokly locally while you build, write the same catalogue as static files,
or embed its viewer in another React application. Mokly owns the catalogue;
your repository keeps ownership of its UI, data, styling, and rendering
context.

> Mokly is pre-1.0. The package is
> [`@mokly/mokly`](https://www.npmjs.com/package/@mokly/mokly) and the
> executable is `mokly`.

## Why Mokly

- **Author in HTML or in code.** An HTML screen is a file with front matter
  and a body that uses your components by element name. A React screen or a
  Storybook story renders through your own components and providers.
- **See the whole product in one place.** Folders that mirror your spec tree,
  search, tags, mobile and desktop views, colour schemes, pages, Markdown
  documents, components, variants, and user flows share one catalogue.
- **Review outcomes, not file lists.** The Changes view renders both commits
  from their sources and compares the rendered screens and the CSS rules that
  reach them. Removed screens, pages, and documents keep a read-only previous
  version.
- **Inspect reusable components.** Declare a prop schema, saved variants, and
  slots, edit props live, and see where each component is used.
- **Keep delivery simple.** `build` writes a static site that any host serves
  without a Mokly server, a source checkout, or a Git installation. Nothing is
  written into your repository.
- **Stay app-independent.** A Rust core renders HTML; JavaScript runs only in
  a sidecar that bundles your components with your module resolution and your
  React.

## Quick start

### 1. Install

Mokly needs Node.js `>=22.14.0 <24.14.0 || >=24.19.0`: 22.14 or newer, except 24.14 through 24.18. The `mokly` binary ships for Linux x64 and
arm64 with glibc, macOS x64 and arm64, and Windows x64. React 19 or newer is
needed only when screens or components are written in React.

```bash
npm install --save-dev @mokly/mokly
```

### 2. Configure the catalogue

Create `mokly.config.json` in your repository root:

```json
{ "$schema": "./node_modules/@mokly/mokly/config.schema.json" }
```

Paths are relative to the configuration file. Mokly reads the `specs`
directory beside it by default: every `.screen.html`, `.component.html`,
`.page.html`, `.use-case.yaml`, `.mockup.tsx`, and `.stories.tsx` file is an
entry, and every `.md` file is a document. A file's place in that tree is its
place in the catalogue. List `roots` to read other directories, such as a
component library with `{ dir: "packages/ui/src", path: "components" }`.
Point `renderer` at your own module when React screens need product theme
providers or React Native Web style collection. See the
[configuration guide](./docs/guides/start/configure.md).

### 3. Add a screen

Create `specs/account/home.screen.html`:

```html
---
title: Account home
description: The account landing screen.
props:
  user: { name: Ada, plan: pro }
  renews: true
variants:
  - slug: free
    title: Account home, free plan
    props: { user: { name: Ada, plan: free }, renews: false }
---

<ui-header user="$user"></ui-header>
<main class="account">
  <h1>Welcome back, {{user.name}}</h1>
  <ui-button label="Manage billing" to="account/billing"></ui-button>
  <ui-card tone="info" mokly-if="$renews">
    <p>Your plan renews on 1 November.</p>
  </ui-card>
</main>
```

`ui-header`, `ui-button`, and `ui-card` are components: `.component.html`
files with a prop schema and a body, or React components registered with
`defineComponent`. The screen is `account/home`, it lives at
`/view/account/home/`, and `account/home/free` is its variant. A React screen
is a `.mockup.tsx` file that exports `defineScreen({ title, render })`. The
`account` directory is a folder; a `_folder.json` file gives it a title and
an order, and a `README.md` gives it an Overview row.

### 4. Open the catalogue

```bash
npx --no-install mokly serve --open
```

The development server prints its URL, renders screens on request, watches
the sources, and prepares Git change evidence in the background. The default
port is `4173`; use `--port 0` to choose any available port.

When the first screen is working, continue with the guides for
[screen authoring](./docs/guides/authoring/screens.md),
[components](./docs/guides/authoring/components.md), and
[viewports and color schemes](./docs/guides/authoring/viewports-and-color-schemes.md).

## Command line

Run the repository-local executable with `npx --no-install mokly`. Options
follow the command, for example `mokly build --config tools/mokly.config.json`.

| Command                    | What it does                                                       |
| -------------------------- | ------------------------------------------------------------------ |
| `mokly serve`              | Serve the catalogue, render on demand, and watch for changes       |
| `mokly serve --open`       | Serve and open the local URL in a browser                          |
| `mokly serve --base <ref>` | Serve with Changes against another Git base                        |
| `mokly build`              | Validate, render every view, and write the static site             |
| `mokly build --out <path>` | Write the static site to `path` instead of `mokly-static/`         |
| `mokly build --strict`     | Fail on warnings as well as on errors                              |
| `mokly build --base <ref>` | Compare against another Git base; `--no-changes` writes no Changes |
| `mokly publish`            | Build into a private directory and upload to a catalogue service   |
| `mokly --help`             | Show every command and option                                      |

The CLI uses stable plain output in CI and a richer interactive display in a
terminal. Warnings print on standard error without changing the exit status;
`--strict` turns them into a failed command. No command writes into the
repository: `build` writes its output directory, which Git must ignore, and
the caches live in the operating system's cache directory. `publish` requires
a clean Git checkout.

Detailed command references:

- [`serve`](./docs/guides/cli/serve.md)
- [`build`](./docs/guides/cli/build.md)
- [`publish`](./docs/guides/cli/publish.md)
- [Options and exit status](./docs/guides/cli/options-and-exit-status.md)

## Authoring

Mokly's authoring model is declarative. A file describes what belongs in the
catalogue; your components still own what each screen looks like.

| Concept          | Use it for                                                                            | Guide                                                               |
| ---------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Screens          | Product states as HTML files or React renders, with props and variants                | [Screens](./docs/guides/authoring/screens.md)                       |
| Components       | HTML or React components with a prop schema, saved variants, slots, and live controls | [Components](./docs/guides/authoring/components.md)                 |
| Stories          | Existing Storybook stories, rendered as component variants                            | [Components](./docs/guides/authoring/components.md)                 |
| Folders and tags | Folders from file paths, titles and order from `_folder.json`, and tags               | [Folders and tags](./docs/guides/authoring/collections-and-tags.md) |
| Use-case flows   | Ordered journeys composed from existing screens                                       | [Use-case flows](./docs/guides/authoring/use-case-flows.md)         |
| Pages            | Complete HTML documents without device variants                                       | [Pages and documents](./docs/guides/authoring/pages.md)             |
| Documents        | Markdown files rendered as catalogue documents, including a folder's README           | [Pages and documents](./docs/guides/authoring/pages.md)             |
| Links            | Portable `mock:` links between catalogue entries by path                              | [Links](./docs/guides/authoring/links.md)                           |
| Styles           | Configured stylesheets, imported CSS, assets, and optional PostCSS                    | [Styles](./docs/guides/authoring/styles.md)                         |

Every screen and component is a render over props: a variant changes the
props, not the render. The prop schema is a JSON Schema object under the
[entry props contract](./docs/protocol/mokly-entry-props.md), declared for
components and inferred from the saved props for screens and stories. The
[HTML screens contract](./docs/protocol/mokly-html-screens.md) defines the
file kinds, the front matter, and the template language. A custom renderer
module is the integration boundary for product providers, themes, and fonts
around React renders; the sidecar resolves React from your repository and
bundles every JavaScript input into one graph.

## Review and share

The local **Changes** view compares the working tree with the merge base of
`HEAD` and `origin/main` by default. Both sides render from their sources with
the same Mokly version, so a Mokly upgrade alone changes nothing. Changes lists
added, removed, moved, and changed screens, pages, and documents, and the
screens that a changed component affects. Removed screens, pages, and documents
load their read-only [previous version](./docs/protocol/mokly-removed-previews.md)
from the base commit. Changes pairs a moved entry with its earlier version
when the evidence is unique, labels its row Moved, and names the previous
path; declare `movedFrom` when needed, under the
[move contract](./docs/protocol/mokly-moves.md).

Read [how Changes works](./docs/guides/catalogue/changes.md), then write a
standalone site:

```bash
npx --no-install mokly build --out .context/mokly-site
```

The site contains the catalogue, its assets, navigation, the available Git
comparison, and the previous versions of removed entries. Serve the directory
at the root of an HTTP origin. The
[export and hosting guide](./docs/guides/catalogue/export-and-host.md) covers
the required headers and the deployment model.

For automated uploads, Mokly provides a
[public composite GitHub Action](./.github/actions/publish/README.md) and a
documented [upload protocol](./docs/protocol/mokly-upload.md) for hosted or
self-hosted receivers.

## Packages

| Package                                                      | Purpose                                                                                           |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| [`@mokly/mokly`](https://www.npmjs.com/package/@mokly/mokly) | The `mokly` command, the authoring API, the render sidecar, and the guides                        |
| `@mokly/native-<target>`                                     | The Rust binary for one platform; `@mokly/mokly` installs the one that matches                    |
| [`@mokly/viewer`](./packages/viewer/README.md)               | Embeddable React catalogue viewer with navigation, inspection, markers, slots, and frame adapters |

Use `@mokly/mokly` to create and deliver a catalogue. Use `@mokly/viewer` when
another React application owns the surrounding navigation, branding,
authentication, or discussion experience. Embedded viewer roots accept `theme`
independently from the preview colour scheme; see the
[viewer appearance contract](./docs/protocol/mokly-viewer-appearance.md).

## Documentation

- [Getting started](./docs/guides/start/install.md)
- [Browsing the catalogue](./docs/guides/catalogue/browse.md)
- [Configuration reference](./docs/guides/authoring/config.md)
- [Protocol and specification index](./docs/protocol/README.md)
- [HTML screens, pages, and use cases](./docs/protocol/mokly-html-screens.md)
- [Paths, roots, and identity](./docs/protocol/mokly-paths.md)
- [Variants](./docs/protocol/mokly-variants.md)
- [Rust core architecture](./docs/architecture/rust-core.md)
- [Render pipeline](./docs/architecture/build-pipeline.md)
- [Package and consumer boundary](./docs/architecture/package-boundary.md)
- [Implementation plans](./plans/)
- [Agent and contributor rules](./AGENTS.md), which name the shared skills that hold the detailed procedures
- [Changelog](./CHANGELOG.md)

The CLI package ships the complete guide and protocol trees, including the
receiver fixtures, and a copy of the root changelog. The protocol documents
keep the Rust core, the sidecar, the viewer, and the tests aligned. Release
Please maintains the changelog history in the root `CHANGELOG.md`.

## Develop Mokly

For repository development, use the tested Node.js version in
[`.nvmrc`](./.nvmrc), npm 11.21.0 (the `packageManager` version in
`package.json`), the Rust toolchain in
[`rust-toolchain.toml`](./rust-toolchain.toml) (Rust 1.95.0 with rustfmt and
Clippy), and Chromium for the browser suite. With nvm, run `nvm install` in
the repository before the npm commands below. rustup reads the toolchain file
and installs the pinned Rust the first time `cargo` runs in the repository.

```bash
git clone https://github.com/mokly-ai/mokly.git
cd mokly
npm install --global npm@11.21.0
npm ci
npm run build
cargo xtask check
```

The Rust core lives in a Cargo workspace under `crates/`, one crate per
subsystem, with the viewer under `packages/viewer`, the verification task
runner under `xtask/`, and the reference consumer under
[`examples/basic`](./examples/basic/README.md). The
[Rust core architecture](./docs/architecture/rust-core.md) is the map of the
crates and the npm packages.

Run the tests that cover a change while you develop:

```bash
npm test -- tests/markdown_links.test.ts
npm run test:browser -- tests/browser/pages.spec.ts -g "retain metadata"
cargo test -p mokly-html
```

Put every npm test argument after `--`. Selected runs are partial
verification; `cargo xtask check` is the complete gate. It runs formatting,
linting, type checks, the Rust and viewer suites, the browser suite,
dependency checks, and the length audits. See
[developer test commands](./docs/protocol/developer-test-commands.md) for the
argument and report rules, the [xtask README](./xtask/README.md) for focused
suites, and [CI test timing](./docs/protocol/ci-test-timing.md) for the rule
that tests never assert elapsed time.

The [remote verification contract](./docs/protocol/remote-verification.md)
defines the Testbox gate, which runs the same suites on Blacksmith boxes:

```bash
cargo xtask check --executor remote
```

It needs `blacksmith`, `rsync`, and `ssh`, and `BLACKSMITH_ORG_TOKEN` or the
current CLI login. The default `auto` executor selects remote mode when the
token and every availability check pass; `--executor local` and a selected
`--suite` stay local. The
[base sync](./docs/protocol/remote-verification-base.md) and
[cleanup](./docs/protocol/remote-verification-cleanup.md) contracts define
checkout preservation, run identity, and the box lifecycle.

`npm run dependencies:check` runs the strict audit of every workspace
dependency category from the lockfile, and `--baseline` reports issues already
present at the comparison commit as notices. Baseline mode is the default for
`cargo xtask check`, ordinary pull requests, and pushes; Release Please,
dependency update pull requests, release publishing, and the daily `main`
audit stay strict. See the
[baseline audit](./docs/protocol/dependency-audit-baseline.md),
[dependency update pull request](./docs/protocol/dependency-audit-update-pr.md),
and [dependency security](./docs/protocol/dependency-security.md) contracts.

Pull request titles use Conventional Commits and at most 72 Unicode code
points; see the
[title contract](./docs/protocol/ci-verification.md#pull-request-title-contract).

### Key code

- `crates/mokly-model` — every shared shape, the prop schema profile, and the
  generated TypeScript types.
- `crates/mokly-catalogue` and `crates/mokly-html` — discovery, the catalogue
  model, HTML screens and components, and document composition.
- `crates/mokly-sidecar` and `packages/mokly/sidecar` — the render sidecar
  protocol and the Node process that runs React, pages, and stories.
- `crates/mokly-css`, `crates/mokly-graph`, and `crates/mokly-compare` —
  stylesheets and attribution, the render graph and cache, and comparison.
- `crates/mokly-server`, `crates/mokly-watch`, `crates/mokly-static`, and
  `crates/mokly-publish` — Serve, the watcher, the static build, and the
  upload exchange.
- `crates/mokly-cli` — the `mokly` binary and its terminal output.
- [`packages/viewer`](./packages/viewer/README.md) — the React shell, the
  index and detail readers, navigation, frames, and inspection.
- [`xtask/src/remote`](./xtask/src/remote) — the Testbox gate, report
  downloads, logs, and interrupt cleanup.
- [`scripts/verification`](./scripts/verification) — the verification scripts
  that CI and the gate share.
- [`examples/basic`](./examples/basic/README.md) — the reference consumer and
  design catalogue.

## License

Mokly is available under the [MIT License](./LICENSE).
