<p align="center">
  <img src="https://mokly.ai/brand/mokly-logo.svg" alt="Mokly" width="360">
</p>

Mokly is an open-source TypeScript toolkit for turning real React components
into browsable mockup catalogues. It provides local development, Git change
comparisons, static export, publication, and an embeddable React viewer.
This repository is a private npm workspace for the CLI and viewer packages.

## Packages

| Package                                        | Purpose                                                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [`@mokly/mokly`](./packages/mokly/README.md)   | Authoring API, CLI, build, local server, comparisons, export, and publish                         |
| [`@mokly/viewer`](./packages/viewer/README.md) | Embeddable React catalogue viewer with navigation, inspection, markers, slots, and frame adapters |

Use `@mokly/mokly` to create and deliver a catalogue. Use `@mokly/viewer` when
another React application owns the surrounding navigation, branding,
authentication, or discussion experience. Embedded viewer roots accept `theme`
independently from `selection.colorScheme`, so hosts can pair any interface
appearance with any preview scheme. See the
[viewer appearance contract](./docs/protocol/mokly-viewer-appearance.md) and
[semantic palette](./docs/protocol/mokly-viewer-palette.md).

The CLI depends on the viewer's exact coordinated release version. The root
owns the shared toolchain, repository scripts, tests, docs, and examples.
Each package owns its public manifest, source, build output, and README.

## Documentation

- [Getting started](./docs/guides/start/install.md)
- [Browsing the catalogue](./docs/guides/catalogue/browse.md)
- [Configuration reference](./docs/guides/authoring/config.md)
- [Protocol and specification index](./docs/protocol/README.md)
- [Paths, roots, and identity](./docs/protocol/mokly-paths.md)
- [Removed content previews](./docs/protocol/mokly-removed-previews.md)
- [Viewer appearance and preview schemes](./docs/protocol/mokly-viewer-appearance.md)
- [Variants](./docs/protocol/mokly-variants.md)
- [Package ownership boundary](./docs/architecture/package-boundary.md)
- [React-to-static-HTML pipeline](./docs/architecture/build-pipeline.md)
- [Implementation plans](./plans/)
- [Changelog](./packages/mokly/CHANGELOG.md)

The guides are user-facing and ship with the npm package. The protocol documents
are the detailed implementation contracts used to keep the CLI, viewer,
generated output, and tests aligned.

## Develop Mokly

The supported Node.js range is `>=22.14.0 <24.14.0 || >=24.19.0`.

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

`npm run dev` serves the synthetic consumer in
[`examples/basic`](./examples/basic/README.md) and watches its entries,
renderer, and stylesheets. Changes to Mokly's own `packages/mokly/src/` files require
restarting the command so the CLI is rebuilt.

Repository scripts resolve the CLI package through
[`scripts/package/layout.mjs`](./scripts/package/layout.mjs). Test helpers
expose `packageRoot` and `cliBinPath` for package files and executable calls.
Use `repositoryRoot` for workspace tooling, shared docs, and examples.

The root build compiles the viewer before the CLI. It then uses npm to create
the local `mokly` executable link. Run `npm run build` after a clean install
before using `npx --no-install mokly`.

Run the complete repository gate before submitting a change:

```bash
cargo xtask check
```

That command runs formatting, linting, type checks, unit and integration tests,
packed-package smoke tests, sharded browser coverage, the separate hydration
suite, dependency checks, and Rust checks. See the
[xtask README](./xtask/README.md) for focused suites. Hosted CI runs the
functional suites on the minimum Node 22.14 runtime for ordinary changes and
adds Node 24 to the complete matrix before a Release Please pull request can
merge.

`npm run dependencies:check` audits every workspace dependency category against
the live registry. It fails on Low-or-higher advisories unless an active reviewed
exception covers the exact dev-only path. Exceptions expire on an inclusive UTC
date and cannot extend more than 31 days from the current date. The packed ESM
consumer's production audit stays strict and has no exceptions. See
[dependency security](./docs/protocol/dependency-security.md) for the data file,
review rules, and the temporary Braces exception.

## Key code

- [`packages/mokly/src/index.ts`](./packages/mokly/src/index.ts) — supported public authoring exports.
- [`packages/mokly/src/config`](./packages/mokly/src/config) — config discovery, loading, and path policy.
- [`packages/mokly/src/build`](./packages/mokly/src/build) — bundling, rendering, validation, and generated
  output transactions; see the [imported CSS contract](./docs/protocol/mokly-imported-styles.md)
  for the stylesheet pass and binary output boundary.
- [`packages/mokly/src/build/mock_link_routes.ts`](./packages/mokly/src/build/mock_link_routes.ts) —
  identity-derived logical-link targets and portable artifact URLs.
- [`packages/mokly/src/components/manifest_entry_validation.ts`](./packages/mokly/src/components/manifest_entry_validation.ts)
  — manifest-v8 component-entry validation.
- [`packages/mokly/src/registry/changed_paths.ts`](./packages/mokly/src/registry/changed_paths.ts) and
  [`manifest_validation.ts`](./packages/mokly/src/registry/manifest_validation.ts) —
  identity-keyed change membership and the strict baseline-v8 boundary.
- [`packages/mokly/src/baseline/compatibility.ts`](./packages/mokly/src/baseline/compatibility.ts) and
  [`packages/mokly/src/server/classification_result.ts`](./packages/mokly/src/server/classification_result.ts)
  — the typed earlier-baseline outcome from admission through Serve.
- [`packages/mokly/src/cli`](./packages/mokly/src/cli/README.md) — command parsing, reporting, and
  composition.
- [`packages/mokly/src/server`](./packages/mokly/src/server/README.md) — local HTTP server and watched
  runtime.
- [`packages/mokly/src/server/http_request_handler.ts`](./packages/mokly/src/server/http_request_handler.ts) —
  request dispatch against the server's current accepted snapshot.
- [`packages/mokly/src/review`](./packages/mokly/src/review/README.md) — Git baselines, comparison, and change
  attribution.
- [`packages/mokly/src/review/component_variant_classification.ts`](./packages/mokly/src/review/component_variant_classification.ts)
  and
  [`component_classification_sources.ts`](./packages/mokly/src/review/component_classification_sources.ts)
  — flat variant classification and review-result assembly.
- [`packages/mokly/src/review/artifact_files.ts`](./packages/mokly/src/review/artifact_files.ts) and
  [`component_classification_entries.ts`](./packages/mokly/src/review/component_classification_entries.ts)
  — collision-safe artifact writes and per-entry comparison preparation.
- [`packages/mokly/src/review/deleted_resource.ts`](./packages/mokly/src/review/deleted_resource.ts) — the
  shared verified-deletion and byte-comparison decision used by both Changes
  classifiers.
- [`packages/mokly/src/export`](./packages/mokly/src/export/README.md) — static catalogue export.
- [`packages/mokly/src/publication`](./packages/mokly/src/publication/README.md) — shared static shell and
  previous-version publication.
- [`packages/mokly/src/publish`](./packages/mokly/src/publish/README.md) — content-addressed publication exchange.
- [`packages/viewer`](./packages/viewer/README.md) — React shell, catalogue read
  model, navigation, frames, and inspection.
- [`scripts/preview/baseline.mjs`](./scripts/preview/baseline.mjs) and
  [`html_paths.mjs`](./scripts/preview/html_paths.mjs) — preview publication's
  baseline-availability and provider-path adapters.
- [`examples/basic`](./examples/basic/README.md) — reference consumer and design
  catalogue.

## Plans

[Implementation plans](./plans/) record their own status directly below the title.

## License

Mokly is available under the [MIT License](./LICENSE).
