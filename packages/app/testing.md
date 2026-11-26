# Testing

This is the testing guide for the [App package](./README.md).

- The logic suite is every `*.test.ts` under `src/_tests_`, at any depth, run
  with `node:test` through `tsx`; a test file mirrors the path of its subject.
  It covers the shared Rust/TypeScript `returnTo` fixture, the error decoder,
  its data parsers and form copy, session and CSRF handling, the settings
  registry and its two URL forms, the viewer selection and address grammar,
  and the contracts this package shares with the repository: the reason union
  and the parsed data reasons against the OpenAPI document, the icon
  vocabulary against the catalogue's, the desktop origin against the shared
  fixture and the grant's scheme address against the desktop shell's own
  check, one import group per module, the no-shared-selector rule between
  `public/app.css` and the catalogue stylesheets, and every `symbol()` a
  listed protocol doc names. The screens that only the desktop shell draws are
  rendered in Node, because no browser test can load the shell's origin, and
  so is each place that draws the write-failure fragment, with its writes
  refused.
- The browser suite is `src/_tests_/**/*.spec.ts`: Playwright in real Chromium
  against the exported build, the real API with `MKC_MAILER=log`, the real
  catalogue server, one fresh blob directory and one isolated Postgres schema
  per run, a loopback Stripe double and the recorded GitHub. The API and the catalogue server it
  starts admit the desktop origin (`MKC_DESKTOP_CLIENT=true`), as the desktop
  shell's Electron test, which reuses this harness, needs. Only the shell
  draws the window's entry, so the desktop sign-in specs keep a verifier in
  the tab themselves, request the grant on the connect page and exchange it on
  the landing from the app origin. Only an unconfigured, unreachable
  local Postgres may skip, and it says so; a port already held by another
  server fails the run. Every test signs in for itself and waits out the API's
  own `Retry-After` when the magic-link admission window closes. Playwright
  runs one test at a time against that API. For speed, CI splits the suite
  into [shards](../../docs/protocol/cloud/repository-verification.md#app-shards)
  and never adds workers. `test` rebuilds the baked origins; Playwright run
  alone against a stale `dist` tests the previous build. PR previews run
  deployment smoke checks, not this suite.
- The recorded GitHub is `mkc-github-double serve`, started before the API and
  configured as both `MKC_GITHUB_API_ORIGIN` and `MKC_GITHUB_WEB_ORIGIN` for the
  fixture App the recordings were captured for. It makes the installation real:
  a project linked to GitHub is a repository the App can read, so
  `createProject` presses Install on GitHub, and the API mints an installation
  token, reads the installation and its one repository, exchanges the
  authorization code and binds them. The connect situation, the Add GitHub
  account action and the conflict recovery run the same exchange through the
  candidate flow. The suite answers only the two pages GitHub itself would
  draw — the setup page and the authorization page — with the returns GitHub
  sends back to the real landing routes. The suite replays one person and two
  installations. A walk that is about to install hands `octocat`'s back first.
  The suite starts the double with `--second-installation`, so a walk can also
  install the organization `fixture-org`; a walk that binds it hands it back
  when it ends. `database-fixture.ts` owns both releases, and every project
  linked to GitHub in a run is created for `octocat/Hello-World`. A project
  from the CLI form needs no installation.
