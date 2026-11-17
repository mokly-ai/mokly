# Mockup Tooling Package

This npm workspace owns the exact-pinned `@mokly/mokly`, `@mokly/viewer` and
`@mokly/ui` 0.19.0 packages, their React peers, and the scripts that build and
verify Mokly Cloud's design catalogue. The catalogue source lives under
`docs/mockups/src`; this package holds the pins, the test configuration and the
runners. Depend on it through the root `npm run mockups:*` and
`npm run emails:*` scripts, never by importing it.

## Responsibilities

- Pin `@mokly/mokly`, `@mokly/viewer`, `@mokly/ui`, `@firna/ui` and their peers
  at exact versions, resolved once in the npm workspace lockfile with the app
  and the site.
- Run the installed `mokly` binary against the root `mokly.config.json` for
  build, check and serve, always with `--strict` for build and check.
- Run the catalogue's determinism, policy and browser tests, and the served
  test server over a comparison base that does not exist.
- Render the two delivered emails into the committed Postmark templates and
  check them byte for byte.

## What This Package Does

`mockups:build` runs `build --strict --no-changes` and writes the static
catalogue to `mokly-static/` at the repository root: the catalogue index at
`mokly-viewer/index.json`, one entry detail per entry under
`mokly-viewer/entries/`, and every view at
`static/mokly-generated/<path>/index.<viewport>[.dark].html` with its bundled
styles and assets. Git ignores the output and the `.mokly-export-reservations/`
directory that Mokly keeps beside it. `mockups:check` runs the same strict
build into `.context/mockups-check`, so validation never replaces the output
that the tests read.

`mockups:test` first requires the catalogue index and every document that it
lists in `mokly-static/`, and compares every file with an independent strict
build; missing output fails with
`Mockup output is missing. Run npm run mockups:build from the repository root.`
It then runs the Node policy tests, the disk browser tests, and the HTTP tests
against the package's Serve command on the mockup test port. `MKC_MOCKUPS_PORT`
sets that port. Without it, the port is `MKC_APP_PORT + 4`, after the app
suite's catalogue, Stripe and GitHub ports, so 8085 with the default app port
of 8081. A worktree that moves `MKC_APP_PORT` therefore moves its mockup test
port too. The disk tests also run the
[catalogue focus policy](../../docs/protocol/cloud/mockup-verification.md#disk-and-http-smoke)
on every page, and `focus.spec.ts` holds its fixtures. The disk tests open every
document that the catalogue index lists. They serve Mokly's frame probe script
from the output and fail on every other request outside the output. The served tests start
Serve with the canonical `mokly.config.json` and `--base` naming a ref that
does not exist, so Changes stay unavailable and Serve extracts and installs no
base; Serve has no `--no-changes` option. Before startup, the server launcher
records the paths, bytes and times of the build output, and a stamp of the
checkout. The checkout stamp holds the bytes and time of each tracked file and
each untracked file that Git does not ignore, marks a tracked file that is gone
as missing, and lists the ignored paths. It lists an ignored directory, such
as `node_modules/`, as one entry and reads none of its files. The suite
compares both records while Serve runs, and its teardown compares them after
the suite, stops Serve and compares them again. So a write to an authored
drawing or to `mokly.config.json` fails the suite, even when it keeps the
bytes. Do not change the checkout while the served suite runs. The
`mockups:check` test compares the same stamp of its fixture checkout before
and after the check, which may add only the ignored `.context/` directory.

The email scripts render the sign-in and invitation definitions into six
committed Postmark files under `crates/mkc-email-templates/templates/`.
The shared email style table converts `rem` lengths to equivalent pixels at a
16px root before rendering catalogue screens, inline styles, and overrides.
The check compares them byte for byte and also runs in the `cloud-emails`
suite of `cargo xtask check`.
The [Postmark sync contract](../../docs/protocol/cloud/email-postmark-sync.md)
describes deployment to the stable servers.

## Quick Start

Run from the repository root:

```sh
npm ci
npm exec --workspace @mokly-cloud/mockups -- playwright install chromium
npm run mockups:build
npm run mockups:check
npm run mockups:test
npm run mockups:typecheck
npm run mockups:serve
npm run emails:build
npm run emails:check
npm run emails:test
```

CI installs Chromium with `--with-deps` on Ubuntu before the `cloud-mockups`
suite.

## Development

Build before the check, test and typecheck commands; each declared document is
inspected from fresh output. Stop an interactive server before the browser
suites, and run the disk and served suites one after the other. The served
suite logs one `git-failed` line for its missing base ref, which is expected.
Each test process first removes every inherited `GIT_*` variable, so a test
run inside a Git hook never reaches the hook's index. The processes that a
test runs in a fixture checkout also ignore the global and system Git
configuration.
Playwright failure traces stay under `.context/mockups-playwright` and its
`-serve` sibling; full-page captures stay under `.context/mockups-smoke`, as
the [authoring guide](../../docs/mockups/README.md) explains.

Typechecking covers the renderer, entries, screens, scripts and tests outside
this npm workspace through the installed packages' public declaration
entrypoints. The policy tests type-check the drawings again with the options of
`tsconfig.json` and React's types only, so a drawing that uses a Node global
fails, and the source policy test reads the same program, as the
[source policy](../../docs/protocol/cloud/mockup-source-policy.md) states. Only this npm workspace skips dependency declaration checks,
because React Native's ambient globals conflict with DOM globals; source
checks stay strict and test both renderers. Responsive tests cover 320px with
200% text, and header children must stay inside their content gutters even
when a system serif fallback changes the wordmark's width.

If build output is ever indexed, remove that output root from the index before
committing authored source:

```sh
git rm -r --cached -- <repository-relative-output-root>
```

The files stay on disk and ignored. The tracking policy test requires zero
indexed paths below `mokly-static/`, below a `.mokly-export-reservations/`
directory or below a `mokly-generated/` directory at any depth, so never use
`git add -f` for output. Prettier reads only the root `.gitignore` and
`.prettierignore`. The root keeps the `mokly-generated/` and `.mokly-cache/`
rules of earlier releases, whose cache carried only a nested `.gitignore`, so
their leftovers in a checkout stay ignored;
[Repository generated files](../../docs/protocol/cloud/repository-generated-files.md)
owns these rules.

Comparisons use `origin/main`. Mokly renders the base from the base commit's
sources with the installed release, and installs the base's locked
dependencies into its cache outside the repository only when they differ from
the working tree's. A base runs that commit's renderer and entry modules, so
run comparisons only against trusted history with npm registry access; see
[Mockup baselines](../../docs/protocol/cloud/mockup-baselines.md) for selection, the
served-test exception, the cache and limits.

### Key Code

- `package.json` — the exact pins and the scripts that the root `mockups:*` and `emails:*` commands run.
- `scripts/check-determinism.mjs` and `scripts/determinism.mjs` — the determinism guard behind `test:determinism`, and its comparison of two independent builds.
- `scripts/emails.ts` and `scripts/emails.test.ts` — the generator behind `npm run emails:build` and `npm run emails:check`, and its tests.
- `playwright.config.ts` and `playwright.serve.config.ts` — the disk suite over every generated document and the served suite that starts the test server, with its global teardown.
- `src/_tests_/serve-fixture.ts`, `src/_tests_/served-files.ts` and `src/_tests_/serve-teardown.ts` — the served test server launcher, the recorded state of the build output and the checkout, and the served suite's global teardown.
- `src/_tests_/origins.ts` — `mockupsPort` and `mockupsOrigin`, the one port and origin of the served suite.
- `src/_tests_/register-web.mjs` — the Node resolve hook that the policy runner preloads.
- `src/_tests_/git-environment.mjs` and `src/_tests_/clear-git-environment.mjs` — `fixtureGitEnvironment`, the Git environment of each process in a fixture checkout, and the module that clears inherited `GIT_*` variables.
- `tsconfig.json` — the typecheck of the renderer, entries, screens, scripts and tests, with `paths` resolved to the installed packages' public declarations.
- `tsconfig.runtime.json` — the same `paths` resolved to the packages' public JavaScript entry points and the react-native-web runtime, for tsx and Playwright.
- `src/styles.d.ts` — the declaration of the side-effect stylesheet imports.
- `../../mokly.config.json` — the data-only Mokly configuration that every command and the served tests use.

### Related Docs

- [Mockup catalogue contract](../../docs/protocol/cloud/mockups.md), with
  [tooling](../../docs/protocol/cloud/mockup-tooling.md),
  [verification](../../docs/protocol/cloud/mockup-verification.md) and
  [baselines](../../docs/protocol/cloud/mockup-baselines.md).
- [Shared controls](../../docs/protocol/cloud/shared-controls.md), which pins
  `@firna/ui` 4.0.0 and its peers, and
  [shared control rendering](../../docs/protocol/cloud/shared-control-rendering.md)
  for the module resolution the loader, the resolve hook and both tsconfigs
  mirror.
- [Repository generated files](../../docs/protocol/cloud/repository-generated-files.md)
  and [Email](../../docs/protocol/cloud/email.md).
- [Authoring guide](../../docs/mockups/README.md), the
  [npm workspace guide](../README.md) and the
  [architecture doc](../../docs/architecture/cloud.md).
