# Repository TypeScript Layout

This is the TypeScript npm workspace sub-contract of
[Repository layout](./repository-layout.md): the npm workspace, its packages
and their exact pins, the generated API client, the app layout, and the
formatting, lint and import rules.

## Packages

- `package.json` declares npm workspaces `app`, `desktop`, `mockups`, `tokens`,
  `site` and `worker`, with a single lockfile at `package-lock.json`. The root
  `package.json` only forwards scripts into `ts/`.
- `apps/worker` is `@mokly-cloud/worker`, the Cloudflare origin router.
  Wrangler owns the script and its two whole-origin routes; Terraform does
  not. Its zone-specific Wrangler configuration is rendered at deploy time
  and git-ignored. Its contract is [Origin router](./origin-router.md), and
  the [worker guide](../../../apps/worker/README.md) documents its configuration
  and tests.
- `packages/tokens` is `@mokly-cloud/tokens`, the one source of the typed token
  tables, the palette scopes, the generated token CSS and the `@firna/ui`
  theme mapping. `docs/mockups`, `apps/app` and `apps/site` import it through its
  subpath entry points (`/tokens`, `/palettes`, `/token-css`,
  `/shared-ui-theme`); none keeps a copy. It is private to the npm workspace,
  so consuming it adds no separately published dependency. Its contract is
  [Design tokens](./design-tokens.md).
- `package.json`, `apps/mockups/package.json` and `apps/site/package.json` pin
  the published `@mokly/mokly` `0.19.0` release, so the two consumers,
  `apps/mockups` and `apps/site`, use one hoisted registry copy. A
  cloud build uses this same pin when a repository installs no Mokly package.
  The fallback version must meet the runner's minimum supported version.
  The fallback is 0.19.0 and the minimum is 0.18.0. A version bump reviews
  that minimum. The receiver
  accepts only upload envelope 3, ownership marker 3 and catalogue index 9.
  The [verification guide](../../../xtask/README.md) documents the
  constants and their toolchain check.
- `@mokly/viewer` `0.19.0` is the app's only direct Mokly dependency;
  `apps/mockups` and `apps/site` pin the same release. The app uses
  only the package's public root entry and stylesheet, and it passes the viewer
  the catalogue index and the entry details that it reads itself.
  No consumer imports internals. The
  [viewer contract](./viewer.md#private-artifact-limit) records the release's
  private-artifact limit.
- `apps/mockups/package.json` pins the published `@mokly/ui` `0.19.0` release
  exactly, because the viewer drawings in `docs/mockups` compose its public
  parts. The three Mokly packages publish at one version, the CLI pins the
  viewer exactly, and the viewer pins `@mokly/ui` exactly, so a version bump
  moves all three.
- The shared controls use `@firna/ui` 4.0.0 and the exact peer set in
  [Shared controls](./shared-controls.md#published-dependencies), including
  React/React DOM 19.2.3, RN 0.85.3, and RNW 0.21.2. React pins also live
  at the npm workspace root to keep every peer on one hoisted runtime. The
  lockfile records them; there is no separate install root, and the Electron
  shell under `apps/desktop` adds no React or React Native dependency of its own.
- `apps/desktop` is `@mokly-cloud/desktop`, the Electron shell that ships the
  application's web export and serves it from `mokly-app://desktop` on macOS
  and Linux, so the product opens offline. Its exact pins are in
  [`apps/desktop/package.json`](../../../apps/desktop/package.json). It holds no
  product screen and no viewer code; its contract is
  [Desktop application](./desktop-app.md). The shell uses Electron.
  Tauri was rejected because WebKit blocks the catalogue grant cookie across
  sites. Electron's Chromium accepts that cookie. The browser suite also uses
  Chromium. Electron bundles the repository's Node pin for local CLI execution.

## Application

- `apps/app` is an Expo application (SDK 56, the release whose peer set matches
  the pins in [Shared controls](./shared-controls.md#published-dependencies))
  with Expo Router and a typed API client generated from
  `docs/api/openapi.json`. It targets the web: its screens are DOM
  compositions over `@firna/ui` controls, and iOS and Android host the web
  build in a web view rather than reusing them. It serves no marketing or docs
  routes; those belong to `apps/site`, as the
  [marketing boundary](./marketing-site.md) defines. Its exact pins are:

  | Package                               | Version |
  | ------------------------------------- | ------- |
  | `expo`, `@expo/metro-runtime`         | 56.0.21 |
  | `expo-router`                         | 56.2.20 |
  | `expo-constants`                      | 56.0.25 |
  | `expo-linking`                        | 56.0.17 |
  | `expo-status-bar`                     | 56.0.4  |
  | `react-native-screens`                | 4.26.2  |
  | `@firna/ui`                           | 4.0.0   |
  | `@gorhom/bottom-sheet`                | 5.2.8   |
  | `lucide-react`, `lucide-react-native` | 0.561.0 |
  | `openapi-fetch`                       | 0.17.0  |
  | `@mokly/viewer`                       | 0.19.0  |
  | `openapi-typescript` (dev)            | 7.13.0  |
  | `@playwright/test` (dev)              | 1.63.0  |
  | `tsx` (dev)                           | 4.23.13 |

  The shared React, React Native and React Native Web runtime set is pinned
  as [Shared controls](./shared-controls.md#published-dependencies) lists it.
  The application contract is [Web application](./web-app.md). Design tokens
  come from `@mokly-cloud/tokens`, and the Folio stylesheets have one
  authored source, `docs/mockups/styles`; the app's generated copy stays
  git-ignored, so the app keeps no second source. The
  [app guide](../../../apps/app/README.md) documents compiler selection and
  stylesheet preparation.

- Expo Router paths are root-relative; the app sets no base URL and has no
  nested route directory. Static segments take precedence over dynamic
  segments. The routes are in [Product navigation](./product-navigation.md).

## Site

- `apps/site` is static Astro output. It reads guides, reference documents,
  version and changelog from the installed `@mokly/mokly` package and reads
  Cloud/Review Markdown from this repository. It depends directly on the token
  npm workspace, uses the dogfood catalogue for its stage and has no runtime API,
  cookies or third-party scripts. Its contract is [Site](./site.md).

## Tooling

- Prettier (including the Astro plugin) and ESLint are dev dependencies of
  `package.json`, so `npm ci` is the only install step.
  Prettier formats every Markdown, TypeScript, JSON, and YAML file from the
  root configuration. ESLint lints every JavaScript and TypeScript file in the
  repository with the root `eslint.config.js`, so a new package, catalogue or
  script directory is covered without a configuration change; a fixed list of
  linted directories was rejected because a directory missing from it goes
  unlinted without a warning. ESLint skips the files that Git ignores,
  scratch `.context/` directories at any depth, the generated API client,
  and the frozen contract-fixture catalogues, which change only with a
  deliberate package or contract change. It applies the
  `typescript-eslint` recommended rules and enables
  `eslint-plugin-react-hooks` as an error over the application's own sources,
  so a dependency array that stops matching what an effect reads fails the
  build. ESLint does not parse Astro components: Prettier formats them and
  `astro check` checks them, and an Astro ESLint parser was rejected because
  it adds a dependency. Every npm workspace typechecks with
  strict, no-emit TypeScript through the one compiler pinned at the
  npm workspace root. Mockup typechecks include `docs/mockups/src` and use only
  public package entrypoints from the single `ts/` installation. The
  configuration is data-only JSON, which Mokly validates against its shipped
  schema, so no typecheck includes it. The
  [mockups tooling guide](../../../apps/mockups/README.md) documents resolution.
- Rust import style is enforced by ast-grep rules under `rules/rust/`
  (`no-inline-use`, `prefer-imports-over-crate-paths`, and `no-late-use`)
  with `sgconfig.yml` at the root; the pinned `@ast-grep/cli` is a `ts/` dev
  dependency. `rules/typescript/` holds the same kind of rule for the app:
  `derive-disabled-from-write` keeps a settings control from answering "can I
  be pressed" for itself when the write behind it already answers that, and
  `one-form-words-its-own-field` and `write-failure-through-the-fragment`
  hold the form and write-failure shapes. Rule cases live in
  `rules/_tests_/`, and the scan covers `crates`, `xtask` and `apps/app/src`.
  ESLint owns the navigation rules of settings panes: a pane uses no `href`,
  opens each `ExternalLink` with `newTab`, and imports nothing from
  `expo-router`. The ast-grep rules own the write and form shapes.
- Rust owns the API contract. The generated OpenAPI document and TypeScript
  client stay committed, as
  [Repository generated files](./repository-generated-files.md) requires. The
  [API guide](../../api/README.md) documents regeneration and the drift check.
- The mockup root uses explicit `files` globs and path-derived entries.
  [Repository generated files](./repository-generated-files.md) defines the
  build output, the ignore rules and the committed golden files.
  [Mockup tooling](./mockup-tooling.md) defines commands and asset delivery.
