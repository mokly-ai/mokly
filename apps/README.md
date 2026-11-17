# TypeScript npm Workspace

`ts/` is the private npm workspace of Mokly Cloud: one `package.json`, one
lockfile and six packages. The repository-root `package.json` only forwards
commands into it.

## Responsibilities

- Hold the application, the desktop shell, the public site, the origin
  router, the mockup tooling and the shared design tokens as one install with
  one hoisted React runtime.
- Pin every published dependency exactly, including `@mokly/mokly`,
  `@mokly/viewer` and `@firna/ui`, in the package files and the lockfile.
- Provide the Prettier, ESLint, ast-grep, TypeScript and Playwright tools
  that `cargo xtask check` runs.

## What This npm Workspace Does

- `app` (`@mokly-cloud/app`) is the Expo application: account entry and the
  logged-in product through the published viewer.
- `desktop` (`@mokly-cloud/desktop`) is the Electron shell that bundles the
  app's web export and serves it offline from its own origin.
- `mockups` (`@mokly-cloud/mockups`) authors and verifies the dogfood
  catalogue under `docs/mockups` with the pinned Mokly CLI and generates the
  email templates.
- `site` (`@mokly-cloud/site`) is the static Astro site: marketing,
  documentation, pricing, changelog and legal routes.
- `tokens` (`@mokly-cloud/tokens`) is the one source of the token tables,
  palettes, token CSS and the Firna theme that the other surfaces import.
- `worker` (`@mokly-cloud/worker`) is the Cloudflare origin router that sends
  the site's declared paths to Pages and every other path to the app origin;
  the main workflow deploys it with Wrangler.

`npm test` runs every npm workspace's tests. The application's browser
tests start the real API and print a skip reason when Postgres is unreachable;
the site stays static and stages a built dogfood screen.

## Quick Start

From the repository root:

```sh
npm run ci:install
npm run typecheck
npm run lint
npm run format:check
npm test
```

Install Chromium once before the mockup, site and app browser checks:

```sh
npm exec --workspace @mokly-cloud/mockups -- playwright install chromium
```

## Development

- `cargo xtask check` performs the install itself before any npm-backed
  stage. `npm run format` formats the repository, and `npm run lint` lints
  its JavaScript and TypeScript, not only `ts/`, except the files that
  [Repository TypeScript layout](../docs/protocol/cloud/repository-typescript.md#tooling)
  excludes.
- Dependencies and their exact resolutions live in `package.json` and the
  single `package-lock.json` here. React and React DOM are pinned to 19.2.3
  at this root as well as in the packages, so every peer and the renderer
  share one hoisted runtime; policy tests reject duplicate runtime copies and
  mismatched lockfile versions.
- Build the mockups before mockup tests, disk inspection or site commands.
  [Mockup tooling](../docs/protocol/cloud/mockup-tooling.md) owns the commands and
  the output rules, and
  [Repository generated files](../docs/protocol/cloud/repository-generated-files.md)
  the ignore rules. `npm run mockups:serve` serves the catalogue locally.

### Key Code

- `package.json` — the npm workspace list, the forwarded `site:*`, `typecheck`, `lint`, `format` and `test` scripts, and the root pins: `@mokly/mokly`, React, `tar`, TypeScript, Prettier, ESLint, ast-grep and the Workers test pool.
- `package-lock.json` — the one lockfile; `npm ci` installs exactly what it records.
- `app/package.json`, `desktop/package.json`, `mockups/package.json` and `site/package.json` — the exact `@mokly/mokly`, `@mokly/viewer`, `@firna/ui`, React Native, Electron and Playwright pins of each package.
- `app/`, `desktop/`, `mockups/`, `site/`, `tokens/` and `worker/` — the six packages, each with its own README.
- `_tests_/scratch.mjs` — `scratchDirectory`, which creates an owned temporary directory for a repository-local test even when the scratch parent is absent, as on a fresh CI runner.

### Related Docs

- [Repository TypeScript layout](../docs/protocol/cloud/repository-typescript.md) — the packages, their exact pins and the tooling rules.
- [App package](./app/README.md), [Desktop package](./desktop/README.md), [Mockups package](./mockups/README.md), [Site package](./site/README.md), [Tokens package](../packages/tokens/README.md) and [Origin-router package](./worker/README.md).
- [Web application](../docs/protocol/cloud/web-app.md), [Desktop application](../docs/protocol/cloud/desktop-app.md), [Public site](../docs/protocol/cloud/site.md) and [Origin router](../docs/protocol/cloud/origin-router.md).
- [Verification commands](../xtask/README.md).
- [Architecture](../docs/architecture/cloud.md) — the components, their boundaries, and the data flows these packages take part in.
