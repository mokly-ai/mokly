# Mokly Cloud npm Projects

This README covers the npm projects of Mokly Cloud. `apps/` holds the public
site, the origin router, and the mockup tooling. `packages/app/`,
`packages/desktop/`, and `packages/tokens/` hold the application, the desktop
shell, and the design tokens. All six are workspaces of the root npm workspace
of this repository, and they share its one `package-lock.json`. The root
`package.json` holds their shared scripts.

## Responsibilities

- Hold the public site, the origin router and the mockup tooling. With the
  application, the desktop shell and the shared design tokens under
  `packages/`, they install as one workspace with one hoisted React runtime.
- Use the workspace `@mokly/mokly`, `@mokly/viewer` and `@mokly/ui` packages of
  this repository, not published releases. Pin every published dependency
  exactly, including `@firna/ui`, in the project files and the lockfile.
- Provide the type checks, the tests and the mockup, email and site commands
  that the cloud suites of `cargo xtask check` run.

## What These Projects Do

- `packages/app` (`@mokly-cloud/app`) is the Expo application: account entry and the
  logged-in product through the workspace viewer.
- `packages/desktop` (`@mokly-cloud/desktop`) is the Electron shell that bundles the
  app's web export and serves it offline from its own origin.
- `mockups` (`@mokly-cloud/mockups`) authors and verifies the dogfood
  catalogue under `docs/mockups` with the workspace Mokly CLI and generates the
  email templates.
- `site` (`@mokly-cloud/site`) is the static Astro site: marketing,
  documentation, pricing, changelog and legal routes.
- `worker` (`@mokly-cloud/worker`) is the Cloudflare origin router that sends
  the site's declared paths to Pages and every other path to the app origin;
  the main workflow deploys it with Wrangler.
- `packages/tokens` (`@mokly-cloud/tokens`) is the one source of the token
  tables, palettes, token CSS and the Firna theme that the other surfaces
  import.

`npm run cloud:test` runs the tests of every cloud project. The application's
browser tests start the real API and print a skip reason when Postgres is
unreachable; the site stays static, and its home draws its demo app at build
time.

## Quick Start

From the repository root:

```sh
npm ci
npm run build
npm run cloud:typecheck
npm run lint
npm run format:check
npm run cloud:test
```

`npm run build` builds the workspace Mokly packages that the cloud projects
use. Install Chromium once before the mockup, site and app browser checks:

```sh
npm exec --workspace @mokly-cloud/mockups -- playwright install chromium
```

## Development

- `cargo xtask check` performs the install itself before any npm-backed
  suite, and its
  [cloud suites](../docs/protocol/ci-verification.md#cloud-suites) run these
  checks. `npm run format` formats the repository, and `npm run lint` lints all
  of its JavaScript and TypeScript, except the files that
  [Repository TypeScript layout](../docs/protocol/cloud/repository-typescript.md#tooling)
  excludes.
- Dependencies and their exact resolutions live in the project `package.json`
  files and the single root `package-lock.json`. React and React DOM are pinned
  to 19.2.3 at the repository root as well as in the projects, so every peer
  and the renderer share one hoisted runtime; policy tests reject duplicate
  runtime copies and mismatched lockfile versions.
- Build the mockups before mockup tests or disk inspection.
  [Mockup tooling](../docs/protocol/cloud/mockup-tooling.md) owns the commands
  and the output rules, and
  [Repository generated files](../docs/protocol/cloud/repository-generated-files.md)
  the ignore rules. `npm run mockups:serve` serves the catalogue locally.

### Key Code

- `../package.json` — the npm workspace list, the cloud scripts `cloud:typecheck`, `cloud:test`, `mockups:*`, `emails:*` and `site:*`, and the root pins: React, `tar`, TypeScript, Prettier, ESLint, ast-grep and Wrangler.
- `../package-lock.json` — the one lockfile; `npm ci` installs exactly what it records.
- `../packages/app/package.json`, `../packages/desktop/package.json`, `mockups/package.json` and `site/package.json` — the workspace `@mokly/*` versions and the exact `@firna/ui`, React Native, Electron and Playwright pins of each project.
- `mockups/`, `site/` and `worker/` — three projects, each with its own README; `../packages/app/`, `../packages/desktop/` and `../packages/tokens/` hold the other three.
- `../rules/eslint/cloud-rules.mjs` — the ESLint rules of the cloud projects, which the root `eslint.config.js` applies after the repository-wide rules.
- `tsconfig.json` — the shared TypeScript compiler options that the project configurations extend.
- `_tests_/scratch.mjs` — `scratchDirectory`, which creates an owned temporary directory for a repository-local test even when the scratch parent is absent, as on a fresh CI runner.

### Related Docs

- [Repository layout](../docs/protocol/repository-layout.md) — the paths, the licenses and the boundary of Mokly and Mokly Cloud.
- [Repository TypeScript layout](../docs/protocol/cloud/repository-typescript.md) — the packages, their pins and the tooling rules.
- [App package](../packages/app/README.md), [Desktop package](../packages/desktop/README.md), [Mockups package](./mockups/README.md), [Site package](./site/README.md), [Tokens package](../packages/tokens/README.md) and [Origin-router package](./worker/README.md).
- [Web application](../docs/protocol/cloud/web-app.md), [Desktop application](../docs/protocol/cloud/desktop-app.md), [Public site](../docs/protocol/cloud/site.md) and [Origin router](../docs/protocol/cloud/origin-router.md).
- [Verification commands](../xtask/README.md).
- [Architecture](../docs/architecture/cloud.md) — the components, their boundaries, and the data flows these packages take part in.
