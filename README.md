<p align="center">
  <img src="https://mokly.ai/brand/mokly-logo.svg" alt="Mokly" width="360">
</p>

<p align="center">
  <strong>Build browsable, reviewable mockup catalogues from real React components.</strong>
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

Mokly is an open-source TypeScript toolkit for turning React-authored product
screens into a searchable static catalogue. It renders the components and
themes from your repository, presents every screen at mobile and desktop
sizes, and shows which screens changed from a Git baseline.

Run Mokly locally while you build, export the same catalogue as static files,
or embed its viewer in another React application. Local Serve and static exports
share the standalone presentation, whose single Auto/Light/Dark Appearance
selector changes the interface and previews together. Embedded hosts render the
same shell but choose its interface appearance independently with `theme`.
The Dark interface uses warm neutral surfaces aligned with Mokly Cloud.
Mokly owns the catalogue; your repository keeps ownership of its UI, data,
styling, and rendering context.

> Mokly is pre-1.0. The package is [`@mokly/mokly`](https://www.npmjs.com/package/@mokly/mokly)
> and the executable is `mokly`.

## Why Mokly

- **Use real product UI.** Screens are React nodes composed from the same
  components, providers, styles, and assets as the product.
- **See the whole product in one place.** Collections, search, tags, mobile and
  desktop views, color schemes, pages, components, and user flows share one
  catalogue.
- **Review outcomes, not file lists.** The Changes view compares rendered
  screens and their reachable resources with the branch point of your Git base,
  while removed screens and pages retain a read-only previous version.
- **Inspect reusable components.** Register typed props, saved variants, slots,
  and local controls, then see where each component is used.
- **Keep delivery simple.** A catalogue can be exported as static files and
  hosted without a Mokly server, source checkout, or Git installation.
- **Stay app-independent.** Plain React, React Native Web, design systems, and
  custom themes connect through a consumer-owned renderer and explicit module
  resolution.

## Quick start

### 1. Install

Mokly requires Node.js 22.14 or newer, except Node 24.14 through 24.18.
The supported range is `>=22.14.0 <24.14.0 || >=24.19.0`. You also need npm 11
and React 19 or newer.

```bash
npm install --save-dev @mokly/mokly react react-dom
```

### 2. Configure the catalogue

Create `mokly.config.ts` in your repository root:

```ts
import { defineConfig } from "@mokly/mokly";

export default defineConfig({
  entriesDir: "docs/mockups/entries",
  mockupsDir: "docs/mockups/generated",
});
```

Paths are relative to the config file. `entriesDir` is shorthand for the
recommended `<folder>/**/*.mockup.{ts,tsx}` pattern. To co-locate definitions
with product code, configure repository-relative `entries` globs such as
`["src/**/*.mockup.{ts,tsx}"]` instead; set exactly one of `entries` or
`entriesDir`, and ensure every configured glob matches an entry module.

The default renderer is deliberately neutral; point `renderer` at your own
module when screens need product theme providers, custom document markup, or
React Native Web style collection. See the
[configuration guide](./docs/guides/start/configure.md).

### 3. Add a screen

Create `docs/mockups/entries/account.mockup.tsx`:

```tsx
import { defineCollection, defineScreen } from "@mokly/mokly";

export const mockups = [
  defineCollection({
    id: "account",
    title: "Account",
    description: "Account product screens.",
    childIds: ["account-home"],
    dependencies: [],
    relatedDocs: [],
  }),
  defineScreen({
    id: "account-home",
    title: "Account home",
    description: "The account landing screen.",
    route: "account/home.html",
    mobile: <main>Account on mobile</main>,
    desktop: <main>Account on desktop</main>,
    dependencies: [],
    relatedDocs: [],
    useCaseIds: [],
  }),
];
```

Replace the example `<main>` nodes with your product components, then list their
source files or directories in `dependencies`. An entry file ends in
`.mockup.ts` or `.mockup.tsx` and exports a `mockups` array.

Mokly derives generated output by default. Keep its HTML, manifest, and cache
out of Git:

```gitignore
.mokly-cache/
docs/mockups/generated/**/*.html
docs/mockups/generated/mokly-manifest.json
```

Mokly's current output requires manifest v5; compatibility readers for older
formats are limited to historical Git baselines.

### 4. Open the catalogue

```bash
npx --no-install mokly --open
```

The development server prints its URL, renders previews on demand, watches
authored inputs, and prepares Git change evidence in the background. The
default port is `4173`; use `--port 0` to choose any available port.

When the first screen is working, continue with the guides for
[theming and configuration](./docs/guides/authoring/config.md),
[screen authoring](./docs/guides/authoring/screens.md), and
[viewports and color schemes](./docs/guides/authoring/viewports-and-color-schemes.md).

## Command line

Run the repository-local executable with `npx --no-install mokly`. Options
follow the command, for example `mokly build --config tools/mokly.config.ts`.

| Command                     | What it does                                                 |
| --------------------------- | ------------------------------------------------------------ |
| `mokly`                     | Serve the catalogue, render on demand, and watch for changes |
| `mokly serve --open`        | Serve and open the local URL in a browser                    |
| `mokly build`               | Validate and transactionally write generated output          |
| `mokly check`               | Validate the catalogue without writing output                |
| `mokly export --out <path>` | Build a complete static catalogue for hosting                |
| `mokly publish`             | Export and upload to a compatible catalogue service          |
| `mokly --help`              | Show every command and option                                |

The CLI uses stable plain output in CI and a richer interactive display in a
terminal. During watched Serve, press `h` to see shortcuts for opening,
rebuilding, clearing, and quitting.

Detailed command references:

- [`serve`](./docs/guides/cli/serve.md)
- [`build`](./docs/guides/cli/build.md) and
  [`check`](./docs/guides/cli/check.md)
- [`export`](./docs/guides/cli/export.md) and
  [`publish`](./docs/guides/cli/publish.md)
- [Options and exit status](./docs/guides/cli/options-and-exit-status.md)

## Authoring

Mokly's public API is declarative. Definitions describe what belongs in a
catalogue; your React tree still owns what each screen looks like.

| Concept              | Use it for                                                  | Guide                                                                   |
| -------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------- |
| Screens              | Product states, view renders, and full-screen variants      | [Screens](./docs/guides/authoring/screens.md)                           |
| Collections and tags | Navigation hierarchy and searchable vocabulary              | [Collections and tags](./docs/guides/authoring/collections-and-tags.md) |
| Components           | Typed props, saved variants, controls, and usage inspection | [Components](./docs/guides/authoring/components.md)                     |
| Use-case flows       | Ordered journeys composed from existing screens             | [Use-case flows](./docs/guides/authoring/use-case-flows.md)             |
| Pages                | Existing complete HTML documents without device variants    | [Pages](./docs/guides/authoring/pages.md)                               |
| Styles (target)      | Imported CSS, modules, assets and optional PostCSS          | [Styles](./docs/guides/authoring/styles.md)                             |
| `MockLink`           | Portable links between catalogue entries                    | [Links](./docs/guides/authoring/links.md)                               |

A custom renderer is the integration boundary for product providers, themes,
stylesheets, fonts, and full-document markup. Mokly resolves React from the
consumer repository and bundles all authoring inputs into one build-time graph,
so component trees use one React runtime.
Use `stylesheets` for separately authored public CSS. [Imported CSS delivery](./docs/protocol/mokly-imported-styles.md)
compiles CSS Modules, per-root stylesheets and assets; fragment renderers
receive ordered links for the renderer and exporting entry CSS after any
configured links. Pages link their own CSS. PostCSS processing is pending;
the Styles guide distinguishes the working flow from planned plugin support.

## Review and share

The local **Changes** view compares the working tree with the merge base of
`HEAD` and `origin/main` by default. It accounts for generated documents,
reachable resources, catalogue metadata, registered components, and applicable
stylesheet changes. Changed screens, screen variants, and saved component
variants generate comparisons only when an eligible shown view is opened.
Per-view evidence keeps known unchanged views marked Unmodified without offering
a comparison. Removed screens and pages load their read-only
[previous version](./docs/protocol/mokly-removed-previews.md) from the branch
point.

Read [how Changes works](./docs/guides/catalogue/changes.md), then export a
standalone site:

```bash
npx --no-install mokly export --out .context/mokly-site
```

The export contains the catalogue, its assets, navigation, available Git
comparisons, and previous versions for removed screens and pages. Serve the
directory at the root of an HTTP(S) origin. The
[export and hosting guide](./docs/guides/catalogue/export-and-host.md) covers
the required headers and deployment model.

For automated uploads, Mokly also provides a
[public composite GitHub Action](./.github/actions/publish/README.md) and a
documented [upload protocol](./docs/protocol/mokly-upload.md) for hosted or
self-hosted receivers.

## Packages

| Package                                                      | Purpose                                                                                           |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| [`@mokly/mokly`](https://www.npmjs.com/package/@mokly/mokly) | Authoring API, CLI, build, local server, comparisons, export, and publish                         |
| [`@mokly/viewer`](./packages/viewer/README.md)               | Embeddable React catalogue viewer with navigation, inspection, markers, slots, and frame adapters |

Use `@mokly/mokly` to create and deliver a catalogue. Use `@mokly/viewer` when
another React application owns the surrounding navigation, branding,
authentication, or discussion experience. Embedded viewer roots accept
`theme` independently from `selection.colorScheme`, so hosts can pair any
interface appearance with any preview scheme. See the
[viewer appearance contract](./docs/protocol/mokly-viewer-appearance.md) and
[semantic palette](./docs/protocol/mokly-viewer-palette.md).

## Documentation

- [Getting started](./docs/guides/start/install.md)
- [Browsing the catalogue](./docs/guides/catalogue/browse.md)
- [Configuration reference](./docs/guides/authoring/config.md)
- [Protocol and specification index](./docs/protocol/README.md)
- [Removed content previews](./docs/protocol/mokly-removed-previews.md)
- [Viewer appearance and preview schemes](./docs/protocol/mokly-viewer-appearance.md)
- [Screen variants](./docs/protocol/mokly-screen-variants.md)
- [Package ownership boundary](./docs/architecture/package-boundary.md)
- [React-to-static-HTML pipeline](./docs/architecture/build-pipeline.md)
- [Implementation plans](./plans/README.md)
- [Changelog](./CHANGELOG.md)

The guides are user-facing and ship with the npm package. The protocol
documents are the detailed implementation contracts used to keep the CLI,
viewer, generated output, and tests aligned.

## Develop Mokly

For repository development, use the tested Node.js version in
[`.node-version`](./.node-version), npm 11.7, Rust 1.95, and Chromium for the
browser suite.

```bash
git clone https://github.com/mokly-ai/mokly.git
cd mokly
npm ci
npm run build
npm run example:build
npm run dev
```

`npm run dev` serves the synthetic consumer in [`examples/basic`](./examples/basic/README.md)
and watches its entries, renderer, and stylesheets. Changes to Mokly's own
`src/` files require restarting the command so the CLI is rebuilt.

Run the complete repository gate before submitting a change:

```bash
cargo xtask check
```

That command runs formatting, linting, type checks, unit and integration tests,
packed-package smoke tests, browser tests, dependency checks, and Rust checks.
See the [xtask README](./xtask/README.md) for focused suites. Hosted CI runs the
functional suites on the minimum Node 22.14 runtime for ordinary changes and
adds Node 24 to the complete matrix before a Release Please pull request can
merge.

### Key code

- [`src/index.ts`](./src/index.ts) — supported public authoring exports.
- [`src/config`](./src/config) — config discovery, loading, and path policy.
- [`src/build`](./src/build) — bundling, rendering, validation, and generated
  output transactions; see the [imported CSS contract](./docs/protocol/mokly-imported-styles.md)
  for the stylesheet pass and binary output boundary.
- [`src/cli`](./src/cli/README.md) — command parsing, reporting, and composition.
- [`src/server`](./src/server/README.md) — local HTTP server and watched runtime.
- [`src/review`](./src/review/README.md) — Git baselines, comparison, and change
  attribution.
- [`src/export`](./src/export/README.md) — static catalogue export.
- [`src/publication`](./src/publication/README.md) — shared static shell and
  previous-version publication.
- [`src/publish`](./src/publish/README.md) — archive creation and upload.
- [`packages/viewer`](./packages/viewer/README.md) — React shell, catalogue read
  model, navigation, frames, and inspection.
- [`examples/basic`](./examples/basic/README.md) — reference consumer and design
  catalogue.

## License

Mokly is available under the [MIT License](./LICENSE).
