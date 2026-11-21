# Repository TypeScript Layout

Status: The site does not draw its home demos as static components yet; its home stage reads the dogfood catalogue. [Milestone 5](../../../plans/canvas-redesign.md#milestone-5-site-home) draws the demos and removes the stage.

This is the TypeScript npm workspace sub-contract of
[Repository layout](./repository-layout.md): the npm workspace, its packages
and their pins, the generated API client, the app layout, and the
formatting, lint and import rules.

## Packages

- The root `package.json` declares the cloud npm workspaces `packages/app`,
  `packages/desktop`, `apps/mockups`, `packages/tokens`, `apps/site` and
  `apps/worker` beside the Mokly packages, with the single root lockfile
  `package-lock.json`. Its `cloud:typecheck` and `cloud:test` scripts run
  every cloud workspace.
- `apps/worker` is `@mokly-cloud/worker`, the Cloudflare origin router.
  Wrangler owns the script and its two whole-origin routes; Terraform does
  not. Its zone-specific Wrangler configuration is rendered at deploy time
  and git-ignored. Its contract is [Origin router](./origin-router.md), and
  the [worker guide](../../../apps/worker/README.md) documents its configuration
  and tests.
- `packages/tokens` is `@mokly-cloud/tokens`, the one source of the typed token
  tables, the palette scopes, the generated token CSS and the `@firna/ui`
  theme mapping. `docs/mockups`, `packages/app` and `apps/site` import it through its
  subpath entry points (`/tokens`, `/palettes`, `/token-css`,
  `/shared-ui-theme`); none keeps a copy. It is private to the npm workspace,
  so consuming it adds no separately published dependency. Its contract is
  [Design tokens](./design-tokens.md).
- `apps/mockups` and `apps/site` use the workspace `@mokly/mokly` package.
  `packages/app`, `apps/mockups` and `apps/site` use the workspace
  `@mokly/viewer`, and `apps/mockups` uses the workspace `@mokly/ui`, because
  the viewer drawings in `docs/mockups` compose its public parts. The root
  lockfile links each of them to its path under `packages/`, so no cloud
  project installs a registry copy, and a Mokly change reaches the cloud
  without a release. The decision is in
  [Repository layout](../repository-layout.md#boundary).
- `@mokly/viewer` is the app's only direct Mokly dependency. The app uses
  only the package's public root entry and stylesheet, and it passes the viewer
  the catalogue index and the entry details that it reads itself.
  No consumer imports internals. The
  [viewer contract](./viewer.md#private-artifact-limit) records the viewer's
  private-artifact limit.
- A cloud build of a repository that installs no Mokly package runs the
  newest npm release, `@mokly/mokly@latest`.
  [Cloud build runner](./cloud-build-runner.md) defines that fallback and the
  runner's minimum supported version. The receiver accepts only upload
  envelope 3, ownership marker 3 and catalogue index 9. The
  [verification guide](../../../xtask/README.md) documents the minimum-version
  toolchain check.
- The shared controls use `@firna/ui` 4.0.0, the one `@firna/ui` version of
  the repository. Its peers and the React runtime install once, as
  [Shared controls](./shared-controls.md#dependencies) requires. React pins
  also live at the npm workspace root to keep every peer on one hoisted
  runtime. The lockfile records them; there is no separate install root, and
  the Electron shell under `packages/desktop` adds no React or React Native
  dependency of its own.
- `packages/desktop` is `@mokly-cloud/desktop`, the Electron shell that ships the
  application's web export and serves it from `mokly-app://desktop` on macOS
  and Linux, so the product opens offline. Its exact pins are in
  [`packages/desktop/package.json`](../../../packages/desktop/package.json). It holds no
  product screen and no viewer code; its contract is
  [Desktop application](./desktop-app.md). The shell uses Electron.
  Tauri was rejected because WebKit blocks the catalogue grant cookie across
  sites. Electron's Chromium accepts that cookie. The browser suite also uses
  Chromium. Electron bundles the repository's Node pin for local CLI execution.

## Application

- `packages/app` is an Expo application (SDK 56, the release whose peer set matches
  the runtime in [Shared controls](./shared-controls.md#dependencies))
  with Expo Router and a typed API client generated from
  `docs/api/openapi.json`. It targets the web: its screens are DOM
  compositions over `@firna/ui` controls, and iOS and Android host the web
  build in a web view rather than reusing them. It serves no marketing or docs
  routes; those belong to `apps/site`, as the
  [marketing boundary](./marketing-site.md) defines. Its exact pins are in
  [`packages/app/package.json`](../../../packages/app/package.json), and its viewer is
  the workspace `@mokly/viewer`.

  The shared React, React Native and React Native Web runtime installs once,
  as [Shared controls](./shared-controls.md#dependencies) requires.
  The application contract is [Web application](./web-app.md). Design tokens
  come from `@mokly-cloud/tokens`, and the product chrome stylesheets have one
  authored source, `docs/mockups/styles`; the app's generated copy stays
  git-ignored, so the app keeps no second source. The
  [app guide](../../../packages/app/README.md) documents compiler selection and
  stylesheet preparation.

- Expo Router paths are root-relative; the app sets no base URL and has no
  nested route directory. Static segments take precedence over dynamic
  segments. The routes are in [Product navigation](./product-navigation.md).

## Site

- `apps/site` is static Astro output. It reads guides, reference documents,
  version and changelog from the installed `@mokly/mokly` package and reads
  Cloud/Review Markdown from this repository. It depends directly on the token
  npm workspace, draws its [home demos](./site-delivery.md#home-stage) as
  static components and has no runtime API, cookies or third-party scripts.
  Its contract is [Site](./site.md).

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
  public package entrypoints from the single root installation. The
  configuration is data-only JSON, which Mokly validates against its shipped
  schema, so no typecheck includes it. The
  [mockups tooling guide](../../../apps/mockups/README.md) documents resolution.
- Rust import style is enforced by ast-grep rules under `rules/rust/`
  (`no-inline-use`, `prefer-imports-over-crate-paths`, and `no-late-use`)
  with `sgconfig.yml` at the root; the pinned `@ast-grep/cli` is a root dev
  dependency. `rules/typescript/` holds the same kind of rule for the app:
  `derive-disabled-from-write` keeps a settings control from answering "can I
  be pressed" for itself when the write behind it already answers that, and
  `one-form-words-its-own-field` and `write-failure-through-the-fragment`
  hold the form and write-failure shapes. Rule cases live in
  `rules/_tests_/`, and the scan covers `crates`, `xtask` and `packages/app/src`.
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
