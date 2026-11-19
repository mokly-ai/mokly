# App Package

`@mokly-cloud/app` is the Mokly Cloud application: account entry, onboarding,
settings and the hosted viewer that is the product, built with Expo Router
against the real platform API. It targets the web; native surfaces on iOS and
Android host this web build in a web view with native chrome around it and do
not reuse its screens, and the [desktop shell](../desktop/README.md) serves the
same export from its own origin. The requirements it implements are in
[Web application](../../docs/protocol/cloud/web-app.md) and the other protocol docs
under [Related Docs](#related-docs).

## Responsibilities

- Account entry, the magic-link, preview, desktop and GitHub landings, the
  page that signs the desktop app in from the browser, invitation acceptance
  and onboarding, as the only full pages outside the viewer.
- The viewer route: resolving a readable address to one publication or build,
  mounting the workspace `@mokly/viewer`, composing the cloud chrome into its
  slots, and drawing and following cloud builds in its stage.
- Settings as panes of one dialog over the working page on desktop and as
  full-screen routes below the breakpoint, with unsaved work guarded on every
  way out.
- The typed API client, the session and its CSRF token, and the error states
  every screen draws.
- The single-page web build, its document and stylesheets, and the static
  server that serves the export.

It serves no marketing content or documentation (that is `apps/site`), it never
serves publication files (that is the catalogue server on its own origin), and
it imports no Mokly internals: only the workspace `@mokly/viewer` entry, its
public index and detail readers, stylesheet and frame adapter.

## What This Package Does

The viewer is the application. Once signed in with a project, the reader is
inside the hosted viewer; workspace and project switching, branch and pull
request selection, publication history, share, settings and the account menu
are the cloud chrome in its slots, and project and workspace lists are
panels opened from that chrome. The account and settings surfaces are DOM
compositions over the exact-pinned `@firna/ui` controls, rendered through the
same theme mapping and the same Folio stylesheets as the mockup catalogue.

Addresses are readable. Workspace, project, publication, branch,
pull-request and settings paths are built from server-returned slugs, while
UUIDs stay the API's identities and the stored last-opened project key.
Retired slugs and UUID permalinks resolve to the current address with their
tail and query preserved, a rename keeps old links resolving, and a direct
project guest navigates without workspace membership. The route contract
is [Product navigation](../../docs/protocol/cloud/product-navigation.md).

Sign-in is one magic-link process for new and returning readers; GitHub
sign-in, connection and App installation each land on their own route. A
credential leaves the address before the router records it, and an accepted
`returnTo` destination survives email, GitHub and desktop grant sign-in byte
for byte or becomes `/dashboard`. Inside the desktop shell, sign in and sign
up open the browser instead: the entry keeps a verifier in its tab and opens
`/connect/desktop` for the verifier's challenge, that page names the
browser's account and after **Open Mokly** hands the app a one-use grant
through `mokly://auth/desktop/callback`, and `/auth/desktop/callback` in the
window exchanges the grant with the verifier. In the shell the GitHub actions
open their own routes on the web, and the window reads the session and the
open screen's GitHub accounts again when it gets focus back. The rules are
[Desktop sign-in](../../docs/protocol/cloud/desktop-sign-in.md) and
[web setup](../../docs/protocol/cloud/desktop-app.md#web-setup). An invitation link carries its route through sign-in,
accepts with the invited account's session, and distinguishes an acceptance
that succeeded from a workspace read that failed afterwards. After
acceptance succeeds, the invitation screen keeps that success while it opens
the workspace. A failed workspace read retries that read alone, with the
pending label naming the operation. An acceptance failure keeps one visible
outcome and retry action, with a screen reader announcement. The landing
rules are [Authentication callbacks](../../docs/protocol/cloud/auth-callbacks.md).

Onboarding is three steps, Workspace, Install and Repository, and the install
step draws for the reader's role: an owner or admin installs the App, a member
is told who can, and a reviewer is told the workspace has no projects yet.
Every role that can create a project also gets **Publish with the CLI
instead**, which opens the CLI form at `/:workspace/-/new/cli`: a project from
a repository the Mokly CLI names on any Git host, with no repository link. An
installation GitHub returns with no flow behind it, from Configure on GitHub or
an install started there, leaves its landing for the connect situation at
`/install?installationId=`, which starts the candidate flow for the workspace
the reader chooses. The repository step groups its select by GitHub account
when the workspace connects several, and the `github` settings pane lists,
removes and adds the workspace's accounts. The step rules are
[Product accounts and roles](../../docs/protocol/cloud/product-accounts-and-roles.md)
and the pane's are [GitHub accounts](../../docs/protocol/cloud/settings-dialog-github.md).

Origins come from the environment, each with a local default:

| Variable                     | Default                                                                           | Used for                            |
| ---------------------------- | --------------------------------------------------------------------------------- | ----------------------------------- |
| `EXPO_PUBLIC_MKC_API_ORIGIN` | `http://localhost:8080`                                                           | Every `/v1` request                 |
| `EXPO_PUBLIC_MKC_APP_ORIGIN` | See [origin rules](../../docs/protocol/cloud/web-product-shell.md#outbound-links) | Public app addresses and site links |

Expo bakes both into the export, so CI builds one image per environment with
[the app Dockerfile](../../infra/docker/app.Dockerfile), and the runtime
`MKC_APP_CONFIG` only asserts that the origins match. The Node server serves
the export at `/` with root-relative assets, an extensionless single-page
fallback, `/_health` and `/_config`, a `noindex` document, and the Content
Security Policy that [Viewer](../../docs/protocol/cloud/viewer.md#catalogue-isolation)
defines. [Outbound links](../../docs/protocol/cloud/web-product-shell.md#outbound-links)
defines the site-link origins and the app-origin fallback for browser tabs,
native surfaces and the desktop shell. See
[deployment](../../docs/ops/deploy.md).

## Quick Start

```sh
npm ci                                      # install the npm workspace
scripts/cloud/dev-api.sh                                      # the API on :8080
npm run start --workspace @mokly-cloud/app  # build and serve on :8081
```

Open `http://localhost:8081/sign-up`, submit an address, and read the sign-in
link from the API's log: the development mailer prints it rather than sending
mail. `scripts/cloud/dev-catalogue.sh` runs the catalogue server that serves
published files on their own origin.

Run a package script as `npm run <script> --workspace @mokly-cloud/app`:

| Script         | Does                                                          |
| -------------- | ------------------------------------------------------------- |
| `start`        | Build the verified export and serve it on `:8081`             |
| `build:web`    | Export and verify the single-page web build in `dist`         |
| `verify:web`   | Verify the viewer bundle, stylesheet and font bytes           |
| `sync:styles`  | Copy the Folio and viewer stylesheets into `public/`          |
| `typecheck`    | Strict TypeScript over the routes, sources and tests          |
| `test:logic`   | The logic tests and the script tests                          |
| `test:browser` | The Playwright suite against the exported build               |
| `test`         | Logic tests, the web build, then the browser tests            |
| `api:generate` | Regenerate only the client types from `docs/api/openapi.json` |
| `api:print`    | Print the client types from the generated JSON document       |

`cargo xtask check --suite cloud-app` runs `test` as a gate suite. From the
repository root, `cargo xtask openapi` regenerates the OpenAPI JSON document
and the typed client, and `cargo xtask openapi --check` and the
`cloud-openapi` suite check both committed generated files for drift. The suite reads these variables:

| Variable                        | Moves                                                      |
| ------------------------------- | ---------------------------------------------------------- |
| `MKC_API_PORT` / `MKC_APP_PORT` | The suite and its build off the default ports              |
| `MKC_CATALOGUE_PORT`            | The suite's catalogue server off `MKC_APP_PORT + 1`        |
| `MKC_STRIPE_PORT`               | The suite's billing provider double off `MKC_APP_PORT + 2` |
| `MKC_GITHUB_PORT`               | The suite's recorded GitHub off `MKC_APP_PORT + 3`         |

`MKC_APP_SHARD=<n>/<total>` runs only shard `n` of the browser suite. Without
it, or with an empty value, the suite runs every test. A malformed value fails
the run. CI runs the suite as four shards, each in its own job with its own
API and database, as
[App shards](../../docs/protocol/cloud/repository-verification.md#app-shards)
defines. To repeat one shard, run
`cargo xtask check --suite cloud-app --shard 2/4` from the repository root.
It builds the web app before the shard runs.
`cargo xtask check --suite cloud-app` without `--shard` runs the whole suite.

## Development

- Check `@firna/ui` first for a control: buttons, inputs, textareas, badges,
  avatars, status dots, dropdowns, segmented controls, switches, modals,
  toasts, skeletons, tables, and typography. Theme it through the token
  mapping in [Design tokens](../../docs/protocol/cloud/design-tokens.md).
  When it has no matching component, check `src/components` and
  `docs/mockups/src/components` before you create one, and keep the two
  aligned. Never restyle a `@firna/ui` control with ad hoc CSS. Change the
  theme mapping instead.
- Rust owns every API boundary type. `utoipa` 6.0.0 derives
  `docs/api/openapi.json`, and `openapi-typescript` 7.13.0 generates
  `src/api/generated/schema.ts` from it. `openapi-fetch` 0.17.0 uses those
  types. Import generated types for backend data. Never hand-write equivalent
  types or edit either generated file. Run `cargo xtask openapi` after a Rust
  contract change and commit both outputs.
- `public/folio` and `public/mokly-viewer` are copies that `sync:styles` makes
  before every start, build and test. Never edit the copy: change
  `docs/mockups/styles` or bump the viewer pin instead.
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
  rendered in Node, because no browser test can load the shell's origin.
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
- `react-hooks/exhaustive-deps` is an error over `src` and `app`, and the
  ast-grep rules under `rules/typescript/` hold the settings write and the
  write-failure fragment shapes over the whole package.
- `typecheck` names `../../node_modules/.bin/tsc` so one compiler covers the
  npm workspace; `openapi-typescript` installs an older `typescript` inside this
  package that nothing may use.
- A wait draws the layout that it waits for, and a write waits on the control
  that sends it, as the **Wait** and **Write in progress** compositions of
  [Folio chrome](../../docs/protocol/cloud/folio-chrome.md#compositions) define. A
  screen and its wait render one layout component: the wait passes the parts
  of `src/components/placeholders.tsx` inside `Pending`. `RequireSession`,
  `WorkspaceRoute`, `ProjectRoute` and `PaneResource` require that waiting
  layout, so there is no generic block to fall back to. Draw a new wait in the
  catalogue first: the parity tests under `docs/mockups/src/_tests_/` compare
  each name that a drawing's waits and busy controls give, and whether a wait
  shows its name, with the app file that owns the drawing.
- Review every user-facing sentence against
  [Product copy](../../docs/protocol/cloud/product-copy.md).

### Cloud Builds

`/:workspace/:project/builds/:buildId` shows one build's card in the viewer
stage, as [Viewer builds](../../docs/protocol/cloud/viewer-builds.md) defines.
`src/data/builds.ts` holds the five build operations. `useBuildWatch` follows
the build through `build-follow.ts`: the first read, then the build and its log
every three seconds while the build works or its log is incomplete and the tab
is visible; a failed poll changes nothing on screen. A build read applies only
if it started after the last write answer the card applied, such as Cancel's,
and neither a read nor a write answer moves a finished build back to queued or
running. `build-log.ts` keeps the windows it has read, replaces an older
attempt's output, keeps no more output after the head than Mokly keeps, and
turns chunks into output lines.

A reference with no ready publication chooses its stage in the order
`reference-stage.ts` gives: a queued or running build for every plan, then a
closed pull request's card and a fork's card for every project and plan, then
the plan's Team card, a failed build newer than the newest publication, a
failed newest publication and the publishing card. While the plan refuses
publishing, `stage-view-decision.ts` gives an open pull request of the
project's repository the Team card a branch gets, under the workspace-role
rule; the pull request waiting card shows only while the plan allows
publishing. `entry.ts` reads an alias's reference row once. It redirects to the
row's `latestPublicationId` when it has one. Otherwise it gives the same row, or
none, to the stage order above. A pull request alias takes its row from the list
the route already read for the chrome, waiting for that read through
`data/use-settled.ts`, also when that list holds no row for it. A branch alias
reads its row through `readReferenceRow` in `data/publications.ts`, which stops
at the page that holds the row. A pull request alias reads its row the same way
only when the route read no list or that read failed. An alias whose build
publishes resolves again. `closedState` and `fromFork` in `resolution.ts`
read a pull request row's state and its fork fact, and the fork card is
`fork-card.tsx`. Switcher rows take their state from the newer of their newest
publication and newest build, and history reads `listHistory`.
`switcher-row.ts` chooses where a row leads: Details on a row with nothing
ready whose newest build failed opens that build's address, Details on a
failed publication opens its own details, and every other row opens the
reference. The project
pane's Automatic builds switch writes on its own through `settings/write.ts`,
and the finished project reads the default branch's row to say whether Mokly
is publishing it.

A failed build announces only its title and line. After Cancel, focus moves to
the card's title and a polite status reads the title the card shows. A
refused or failed Cancel keeps the label Cancel, because Try again on a build
card requests a new build: `request-controls.ts` lists every control that
sends a build request with what it reads after a refusal, and the publishing
card and the build card read their labels through it. While its request
runs, each of these controls is busy with its working word, and
`build-copy.ts` names the operation a screen reader hears. Keyboard
focus draws the token focus outline round the title and the output box, which
follows its newest line until the reader scrolls back. `build-ineligible`
refusals choose their sentence by the typed `cause` in `api/form-error.ts`,
keyed by the generated `IneligibleCause`, so a cause that the Rust contract
adds fails to compile until it has a sentence, and no refusal adds a guide.
The publishing card and the build card draw their control through
`control-guide.tsx`, so a refused publish request keeps Publish from CI beside
the control, inside the write-failure fragment and above Details.

`src/_tests_/viewer/stage-drawings.test.ts` maps every card the empty stage
chooses, for a branch and for a pull request, every build-card body — its
one action, the owner's action as a placeholder or none, and the kind of its
line — and every way each request control of `request-controls.ts` reads
after a refusal or a failure to its drawing. It checks each
drawing against the authored product inventory in
`docs/mockups/src/_tests_/product-inventory.ts`, so it reads no generated
output and runs before the mockups build; the mockups stage proves that the
built catalogue holds the inventory. Its cases live in
`src/_tests_/viewer/stage-cases.ts`, which enumerates the builds the lifecycle
allows, and its checks in `stage-problems.ts`. The closed pull request card
maps a closed and a merged pull request to their own drawings, and the fork
card has its own, and a plan-refused pull request's Team card maps to
`product/viewer/pull-request/plan` and its `reader` variant. Its maps are typed
by `UnpublishedStage`, `BuildAction`, `BuildLine` and `RequestControl`, so a
new card, action or request control fails to compile until it names a
drawing. Every reachable body has a drawing, with no exception list. A
reviewer's queued and running builds, which offer no Cancel, map to the
`queued` and `running` variants of `product/viewer/standalone/build/reader`,
and the plan refusal's wait for the workspace read maps to its `plan-loading`
variant. The inventory's modules type their
definitions with `@mokly/mokly`, so `tsconfig.json` maps that package's type
declarations; the test imports no Mokly code at run time.

The ordinary API, which the routed build specs reach, has the recorded GitHub
but no build configuration, so it reports builds unavailable and never creates
one. A double answers the build
operations, the project's build fields and the reference rows' newest builds
for one project, with bodies typed by the generated client:
`src/_tests_/build-double.ts` holds what it answers and the helpers that change
it as the worker would, `build-answers.ts` answers each operation from it, and
`build-routes.ts` routes one project's requests to those answers. Every other
read and write reaches the real API, and a project that cannot build is
tested against it unchanged. Tests change the double between polls and the
card follows on its next read, and `holdBuildReads` keeps a build read waiting
so it can answer after a write. `src/_tests_/build-refusals.ts` drives a
refused Try again and measures, in the page, where the refusal, the control,
the guide and Details sit in the build card or the publishing card and what
outline a focused title draws, for the desktop specs and the 390px, 320px and
200%-text phone specs. `src/_tests_/build-output.ts` reads what the output box
shows and the outline it draws. `src/_tests_/build-reader.ts` reads a build as
a reviewer, who may neither request nor cancel one.

`src/_tests_/build-states.ts` is the one table of build states the desktop and
phone browser tests read: every build state, card action and request
control's refusal and wait, the answers that open an active build or a published
publication, the reviewer's publishing card, and builds in History and the
switcher. Its records are keyed by `BuildState`, `BuildAction` and
`RequestControl`, so a new state, action or request control fails to compile
until a row shows it. The rows are in `build-state-cards.ts`,
`build-state-readers.ts`, `build-state-refusals.ts`, `build-state-busy.ts` and
`build-state-lists.ts`, with the two surfaces and the card's parts in
`build-state-parts.ts`.
`build-states.spec.ts` runs every row on the desktop and
`build-states-mobile.spec.ts` on a phone at 390px, with the page the row ends
on checked at 320px too.

`build-api.spec.ts` follows a real build instead of the double. It alone swaps
the ordinary API for the test-only `fake-build-api` example of `mkc-api`. The
example listens at the same origin, on the same database schema and blob
store. The recorded GitHub, the Stripe double and the catalogue server keep
running. `replaceApi` in `api-server.ts` makes each swap. The spec restores the
ordinary API in a `finally` block, so a failed assertion also restores it.

The example has builds configured. It composes the real API with the fake
runner of the API's GitHub integration tests in place of the sandbox, as the
[API guide](../../crates/mkc-api/README.md#development) describes. The runner
writes build output, then holds the upload until the spec releases that build.
The runner then uploads its fixture through the API's real upload exchange.

The spec requests a build in the App. While the upload waits, the spec checks
the running build without a sleep. It then releases the upload and follows the
card to published through the real build and log reads. Last, it opens the
published catalogue. The spec routes no build operation.

### Key Code

- `index.ts` — the entry, which takes an authentication landing's provider input off the address before `expo-router/entry` loads.
- `app.json` — the Expo configuration: the single-page web output, the disabled route sitemap and the `mokly` scheme through which the connect page hands the desktop app its grant.
- `app/` — the root-relative route tree: static account, callback and UUID resolver routes beside `[workspace]`, which holds the `-` sentinel for workspace actions and `[project]`.
- `app/_layout.tsx` — the document frame that mounts the theme, the toasts, the session, resource invalidation, the drafts, the catalogue source and the settings dialog host around every route.
- `app/+not-found.tsx` — the unmatched-route owner, which renders the recovery screen with one `/dashboard` action and reads no product data.
- `app/_sitemap.tsx` — the static route for the reserved `/_sitemap` address, which renders the same recovery screen because the dynamic workspace segment would otherwise claim it.
- `public/index.html` — the document shell: `noindex`, the viewer and Folio stylesheets, then `app.css`.
- `public/app.css` — the application's own stylesheet: the react-native-web root reset undone and the few compositions that exist only in the running product.
- `src/config.ts` — the API origin from `EXPO_PUBLIC_MKC_API_ORIGIN`, and `appOrigin`, the public app origin from `EXPO_PUBLIC_MKC_APP_ORIGIN`, else the tab's origin, else `http://localhost:8081`, which native surfaces and the desktop shell use for site links.
- `src/theme/provider.tsx` — `AppTheme`, which emits `responsiveTokenCss` into the document, sets `folio-scope` and `data-color-scheme` on the root, and provides the `@firna/ui` theme from `paletteUiTheme`.
- `src/theme/scheme.ts` — `useReaderScheme`, the one reading of the color scheme that the chrome, the hosted viewer's `theme` and the default preview scheme share.
- `src/layout/viewport.ts` — `useCompact`, the one breakpoint reading that chooses the compact composition for the whole application.
- `src/api/generated/schema.ts` — the paths and components generated from the Rust-derived `docs/api/openapi.json`, with local aliases in `src/api/types.ts`; regenerate them with `cargo xtask openapi`, never edit them.
- `src/api/client.ts` — the `openapi-fetch` client, the per-call `X-Request-ID`, the typed error conversion, and `mutationHeaders()`, which adds the CSRF token to every mutation while the browser supplies `Origin`.
- `src/api/errors.ts` — `ApiError`, the one typed failure with `code`, `reason`, `message`, `requestId`, the status and `Retry-After`, for envelopes, non-envelopes and transport failures alike; `dataFor(reason)` returns the typed `data` of that reason.
- `src/api/error-data.ts` — `ApiErrorData`, the generated type of each reason's `data`, keyed by reason, and `parseErrorData`, one parser per reason that keeps `data` only when it has that type, so a cause this build does not know is dropped, never assumed.
- `src/api/reasons.ts` — the reason union the UI branches on, checked against the OpenAPI inventory.
- `src/api/form-error.ts` — the copy and the owning field for each catalogued reason, the `build-ineligible` sentence for each typed `cause`, and `nonRetryable`, the refusals whose control keeps its resting label.
- `src/session/context.tsx` — the session state and its CSRF token, `adopt` for a landing's exchanged session and `reload` for a retry; every write carries a generation so a stale start-up read cannot sign a reader back out. In the desktop shell it reads the session again whenever the window gets focus, and `refresh.ts` decides what that quiet read changes.
- `src/session/guard.tsx` — `RequireSession`, which sends a signed-out reader to sign-in with the current address as `returnTo`, drawing the sign-in screen's wait while it does, which in the desktop shell is the window's entry, and draws the waiting layout that its caller must pass while the session read runs.
- `src/navigation/return-to.ts` — `validateReturnTo`, the one validator of a return destination, tested against the shared Rust fixture.
- `src/navigation/callback-input.ts` — captures a landing's provider input before the router starts, and replaces a stateless installation return with the connect situation; `provider-query.ts` parses exactly one value, `installation-id.ts` reads an installation id from an address, and `github-flow.ts` owns the tab-scoped GitHub flow keys.
- `src/navigation/paths.ts` — every workspace, project, publication, reference and settings path, built from slugs; `canonical.ts` replaces a retired slug and keeps the tail and query.
- `src/navigation/destinations.ts` — the terminal destination of `/dashboard` and of a workspace, and where a signed-out reader is sent; `last-opened.ts` keeps the reader's last project on the device.
- `src/navigation/address.ts` — `writeAddress`, the query-only push or replace that never routes, the wrapped history operations, and the address hooks every surface reads.
- `src/navigation/desktop-shell.ts` — `isDesktopShell()`, which recognizes the desktop shell by the page's `mokly-app:` protocol. A logic test pins its desktop origin literal to the shared fixture.
- `src/navigation/desktop-sign-in.ts` — the window's verifier, its S256 challenge and its tab storage, the connect page's address and challenge, the grant's `mokly://` scheme address and when a held grant is handed over again.
- `src/navigation/web-setup.ts` and `src/navigation/shell-focus.ts` — `openOnWeb`, which opens an application route on the public app origin as a popup that the shell sends to the system browser, and the shell's window focus, on which screens read again what the web may have changed.
- `src/navigation/follow.ts` — `follow()`, how an `Action` follows its `href`: an application route goes to the router, any other address opens in this tab, and one that would run in the page, such as `javascript:`, is never followed.
- `src/navigation/leave-page.ts` — `useLeavePage`, how a screen hands the tab to GitHub or Stripe at the end of a write: only while that screen is still shown, called off with `window.stop()` when the screen goes before the next page loads, and with a hook for the page coming back from the back-forward cache. `useWrite` and the GitHub install landing leave through it.
- `src/settings/panes.ts` — the pane registry and `availablePanes`, which requires the reader's role so Billing is never left visible to a member.
- `src/settings/routes.ts` — both settings address forms. `paneRoute` gives no address for a pane whose scope lacks a slug that the pane needs, and each caller says what stands in; `scope.ts` has `scopeSlugs`, the slugs that a read scope gives.
- `src/settings/context.tsx` — what a pane gets from its host: the four exits `close`, `leaveTo`, `leaveBy` and `leaveConfirmed`, `goToPane` and `replaceRoute`.
- `src/settings/dialog-host.tsx` — the desktop dialog host, which reads `?settings=`, resolves the scope, asks the unsaved-work question on every exit and hands over to the durable route below the breakpoint. The dialog is drawn from the session read on, and stays mounted from the session's wait and the scope's wait to their answers.
- `src/settings/layer-screen.tsx` — `SettingsRoute`, the durable routes: the full-screen layer on a compact surface and the redirect onto the page beneath the dialog on a wide one, which `layer-address.ts` makes. While the session and then the scope load, the layer's bar keeps the way back that its pane has. On a wide surface, `route-wait.tsx` draws the dialog's wait for the route's pane over the stage placeholder until the redirect lands, through the session read, the scope read and the read of the page to hand over to. Its rail leads to each pane's route by the address's slugs, then by the scope's once it is read; a pane with no address yet waits disabled, and a press on the drawn pane's own entry changes nothing, so the route keeps its query, such as a Checkout return's.
- `src/settings/scope-wait.tsx` — what the dialog and the layer draw while the session and then the settings scope load: `scopePanes`, the panes that the address's scope gives an owner, which the rail draws, and `ScopeWait`, the requested pane's own wait, named for screen readers. It takes an unknown session while the session read runs, and the Account pane's wait then draws the session's texts in their placeholder forms. Each pane module exports its waiting layout, which renders the pane's one layout component with placeholder parts; `row-placeholders.tsx` holds the row menu's and the status badge's placeholders.
- `src/settings/surface.tsx` — the dialog frame over `WebModalFrame` with the section rail, which draws an entry whose address the surface does not know yet disabled, with no link; `modal.tsx` and `row-menu.tsx` draw a pane's confirmation modal and its three-dot row menu.
- `src/settings/dirty.tsx` — the unsaved drafts, kept outside React state so the Escape after a keystroke still finds them; `back-guard.ts` stops in-document back gestures while a draft exists.
- `src/settings/write.ts` — `useWrite`, one write per control, from which the control's label, disabled state, busy state and failure derive: the `Action` that sends it reads `working`, and its call site passes `disabled`. `leave` ends a write by leaving the page: the write stays in flight, and its control busy, until the page has gone, and a page restored from the back-forward cache is at rest again.
- `src/settings/pane-link.tsx` and `src/settings/pane-rows.tsx` — reach or list other panes by pane, never by address.
- `src/settings/panes/billing-pane.tsx` — the Billing pane: the Checkout return's bounded confirmation reads, the delayed state and Check again; `billing-facts.ts` builds the fact rows from the API's counts and amounts. Upgrade to Team and Manage billing leave for the Stripe address `data/billing.ts` answers through their write's `leave`, and the load and the confirmation both draw `TeamPlanWait` from `billing-plans.tsx`, which names the read in the Plan value.
- `src/settings/panes/github-pane.tsx` — the GitHub accounts pane: one row per account the workspace binds, the row menu, Add GitHub account and the role rule; `github-remove.tsx` is the remove modal, and `workspace-github.tsx` is the Workspace pane's GitHub accounts fact.
- `src/settings/panes/project-builds.tsx` and `src/components/toggle.tsx` — the Automatic builds switch and the registered switch it is drawn with. While its write runs, the switch shows the value asked for, disabled, with its working word in its own row; `ToggleWait` is the setting while its value is read.
- `src/data/workspaces.ts`, `src/data/projects.ts`, `src/data/installations.ts`, `src/data/billing.ts`, `src/data/tokens.ts` and `src/data/auth.ts` — the workspace and member, project, installation and repository, slug, billing, token, account and sign-in reads and writes, each one API operation.
- `src/data/publications.ts` — `everyBranch`, `everyPullRequest` and `followPages`, which walk a cursor under `referencePageLimit` and report `truncated` when the cap stopped them. `readReferenceRow` walks the same pages of the branch or pull request list for one reference's row, and stops at the page that holds it, at the last page or at the cap. Alias resolution and the latest-publication poll share it. `ReferenceReads` is the pair of page reads it takes.
- `src/data/builds.ts` — the five build operations: `listHistory`, `getBuild`, `listBuildLog`, `requestBuild` and `cancelBuild`.
- `src/data/use-resource.ts` — the one loading hook with loading, ready and typed error states. Its state belongs to its request key: `resourceForKey` in `resource-key.ts` answers loading for a state that another key holds, so a new key starts from loading on its first render. A reload or an invalidation of the same key keeps the ready value, marked `refreshing`, so a settings write never unmounts the page beneath the dialog. `reloadOnEnable: false` lets a read whose answer cannot change keep its settled state when the caller enables it again with the same key. A reload or an invalidation still starts a new read. `resource-invalidation.tsx` holds the scopes a Team read bumps so every pane shows Team without a reload, and `use-settled.ts` waits for a read in flight, a refresh included.
- `src/components/page-parts.tsx` — `StateMessage` with the `ErrorStateCopy` union, `Pending`, and the shared empty, loading and error states. `Pending` is the waiting region: it draws the layout a read waits for, sets `aria-busy` and names the operation once, in a text place of that layout or for screen readers only. It has no form without a layout. A section's heading that a read decides waits as a bar after its known words.
- `src/components/placeholders.tsx` and `src/components/placeholder-rows.tsx` — the placeholder forms of the Wait composition, the same forms the catalogue draws: a text bar, a control, a fact, a select, the State card, and the member, note and content-list rows, each in its part's own frame. `WaitRegion` is the region that `Pending` draws. `field.tsx` is `Field` with its waiting form, `brand.tsx` holds the identity's placeholder, and `pending-name.tsx` is the operation's one name, which the waiting region and a busy `Action` both draw.
- `src/components/resource-state.tsx` — `PaneResource`, one read of a settings pane or a viewer panel: the waiting layout its caller must pass, the loaded value, or `PaneError`, which keeps the pane's frame and offers one Try again.
- `src/components/error-details.tsx` — `ErrorDetails`, one closed disclosure for the request reference and diagnostics, matched against the mockup component.
- `src/components/action.tsx` — `Action`, the one button composition, which follows its `href` through `follow()` because the package Button renders no anchor, with the 44px compact touch target, the pointer hit slop, and the whole accessible name a shortened label answers to. A control that sends a write takes it as `write`, with the operation's name as `operation`: while the write works, the control is busy, stays enabled so it keeps its focus, refuses the press, and a screen reader hears the operation; `disabled` holds only at rest. `touchTarget` is the box that a control's placeholder shares.
- `src/components/icons.tsx` — `icons` and `Icon`, the product chrome's glyph vocabulary, the same map the catalogue draws from `docs/mockups/src/screens/product/icons.tsx`.
- `src/components/write-failure.tsx` — the registered write-failure fragment, the only place a cause and a reference are assembled. It is one element at rest, refused and while a retry works, so the control inside it keeps its node and the reader's focus; at rest it draws no box.
- `src/components/plan-consequence.tsx` — the role rule for a refused plan gate: an owner opens Billing and everyone else asks an owner.
- `src/screens/account/` — sign in, sign up, the magic link, the callback landings, the desktop app's entry (`desktop-entry-screen.tsx`, with `DesktopSignInWait`, its wait), the browser page that signs it in (`connect-desktop-screen.tsx`, which draws its confirmation while the session read runs) and its landing (`desktop-callback-screen.tsx`), invitation acceptance and the three setup steps. The install and repository steps each draw only the reader's own situation and hand the other one on: `install-screen.tsx` draws the reader's role and replaces a reader whose workspace is connected with the repository step, and `choose-repository-screen.tsx` sends every other installation state back to the install step. `connect-screen.tsx` is the connect situation, `cli-form-screen.tsx` the CLI form, `repository-choices.ts` and `repository-field.tsx` the grouped select and the manage link's destination, `project-address.tsx` the slug and address both project forms share, and `project-name.ts` the display name both derive from the repository, cut to the API's display name limit. Each setup step and the finished project export their wait beside the screen, `CreateWorkspaceWait`, `InstallWait`, `ConnectWait`, `ChooseRepositoryWait`, `CliFormWait` and `ProjectCreatedWait`: the screen's own layout component with its parts in waiting form, which the session read, the route's read and the screen's own reads draw. `install-suspension.tsx` is the install step's suspension fact, `repository-form.tsx` the repository step's panel and form, `repository-project.ts` the project that step creates, and `cli-form-layout.tsx` the CLI form's panel and form.
- `src/screens/app/` — the resolver routes: `/dashboard`, a workspace, a UUID permalink, project setup and the not-found screen. `resolver-wait.tsx` is the resolvers' one wait, and `workspace-route.tsx` and `project-route.tsx` require the waiting layout of their destination, which `viewer-route.tsx` gives as the cloud frame.
- `src/screens/viewer/viewer-screen.tsx` — the viewer route; `address-state.ts` reads the selection, `viewer-catalogue.ts` pairs the access exchange with the catalogue source, `reference-redirect.ts` replaces a resolved alias with its publication's address, `slots.tsx` composes the six controls into two slots, with the reference trigger as its placeholder until the address or a read names the reference, `more-menu.tsx` draws the rows of More from the bar's placement, `carriers.ts` holds the slot refs and finds the control that carries an overlay's action now, `panel-host.tsx` draws the one open panel, and `body.tsx` is `ViewerMain`, the main landmark and its skip link, and `ViewerBody`, which keeps the stage mounted under an overlay. `frame-wait.tsx` is `ViewerFrameWait`, the cloud frame while the route reads the session or the project: one waiting region whose heading names the read for screen readers, over the bar's controls in their waiting forms and the stage's waiting card. It measures its own width as the viewer does, so its bar waits in the composition that the loaded bar draws.
- `src/viewer/host.ts` — `ViewerHostProps` and `ViewerSelection`, the controlled contract around `@mokly/viewer`.
- `src/viewer/published.web.tsx` — `ViewerHost`, which mounts `MoklyViewer` with the index and the detail source the host read for one origin and credential policy, and reports the package's errors to that source; `published.tsx` never mounts the package in a native tree.
- `src/viewer/selection.ts` — the URL keys to `ViewerSelection` and back, and `carriedQuery`, the query an alias resolution hands on minus `branch` and `screen`.
- `src/viewer/resolution.ts` and `src/viewer/entry.ts` — one address to one publication or build; `screens.ts` and `screen-path.ts` constrain the Share screen and the entry path grammar.
- `src/viewer/access.ts` — exchanges the catalogue grant at the publication's own host, keyed to the exact publication attempt; `renewCatalogueAccess` runs the exchange again for a private detail read that answered 401 and leaves the access state, whose retry remounts the viewer, alone.
- `src/viewer/latest.ts` — offers a newer publication on this reference without moving the reader. Each poll calls `readLatestPublication`, which reads the reference's row afresh through `readReferenceRow` and offers its `latestPublicationId` when that names another publication.
- `src/viewer/focus.ts`, `src/viewer/handoff.web.ts` and `src/viewer/slot-source.tsx` — focus return to the control that carries an overlay's opening action now, and the fallback-to-package slot handoff.
- `src/viewer/source-provider.web.tsx` and `src/viewer/source-store.ts` — `CatalogueSourceProvider` and the document's one catalogue source per origin and credential policy: its index read, its detail source and its latched version failure, which survive a query-only Back. `use-catalogue-source.ts` reads it for the stage once access is open.
- `src/viewer/catalogue-source.web.ts` — `catalogueReads`: `mokly-viewer/index.json` and each entry detail, read with the credential policy the exchange confirmed and passed through public `readCatalogueIndex` v9 and `readEntryDetail` v4. These readers check versions and copy content under the [reader contract](../../docs/protocol/cloud/mokly-artifact-compatibility.md#frame-boundary). A private detail read that answers 401 renews the exchange once and repeats the read once. The index and detail paths are restated here once, because `@mokly/viewer/data` exports no detail path function.
- `src/viewer/package-selection.ts` — `toPackageSelection` and `fromPackageSelection`, the lossless mapping to the package's selection.
- `src/viewer/share-selection.ts` — the API share selection, preserving the package-only Both viewport on the returned URL.
- `src/viewer/share-state.ts` — `shareLinkState`, the one Share request and display decision. It requests no link while the address resolves. For a publication with a comparison, it also requests none while the screen list loads and the address names a screen. It never shows a link held for another selection.
- `src/viewer/bar.tsx` — `barPlacement`, where each composition of the bar puts the six cloud actions. The bar's triggers, the rows of More and the focus return all read it. `packageSlots` puts those actions in the package's two top-bar slots; `chrome.tsx` draws the triggers and `panel.tsx` one panel's overlay frame. A `BarAction` that is `waiting` keeps its label and draws itself disabled, and `chrome-wait.tsx` holds the placeholders of the controls whose labels the project, the session or the entry decides.
- `src/viewer/stage.tsx`, `src/viewer/stage-view.tsx` and `src/viewer/version-failure.tsx` — the cloud stage cards, the one operation card a state draws, including the index read's failed card, and the version-failure card with Details and Reload, which passes the viewer's plain diagnostic to `ErrorDetails`.
- `src/viewer/stage-card.tsx` — `StageCard`, the one card a fallback state draws, and `StageWait`, the stage's waiting card that every stage read draws: the State card in its placeholder form, titled with the read.
- `src/viewer/build-card.tsx`, `src/viewer/build-stage.tsx` and `src/viewer/publish-card.tsx` — the build card and its one action, the owner's action as a placeholder while a plan refusal's workspace read runs (`awaitsOwnerAction`), the build address's read, unknown and unreadable states, and the publishing card; `build-copy.ts` holds every sentence they say.
- `src/viewer/build-action.ts` and `src/viewer/build-state.ts` — the pure choice of the build card's one action, and the pure step and row rules.
- `src/viewer/reference-stage.ts` — the stage order of a reference with nothing ready; `stage-view-decision.ts` gives a plan-refused open pull request the Team card a branch gets.
- `src/viewer/build-log.ts`, `src/viewer/build-follow.ts` and `src/viewer/build-watch.ts` — the log windows, the reads and their order, and the polling hook.
- `src/viewer/build-request.ts` and `src/viewer/build-target.ts` — the request that opens the build it starts, and where its answer leads.
- `src/viewer/request-controls.ts` — every control that sends a build request, with its label after a refusal.
- `src/viewer/switcher-row.ts` — where a switcher row leads.
- `src/viewer/control-guide.tsx` and `src/viewer/fork-card.tsx` — the shared control with its guide, and the fork card.
- `src/viewer/workspace-role.ts` — the one workspace-role rule that the empty stage's plan card and a build card's plan refusal both read: nothing owner-specific while the read runs, `not-found` as not an owner, and any other failure as the workspace's own Try again.
- `src/viewer/panels/` — the projects, switcher, history and share overlays. While its read runs, each panel draws its own groups with one placeholder row in each list, from the same group component as the loaded panel: `ref-group.tsx` is the switcher's group, and `share-link.tsx` the share panel's link, who can open it and Copy link.
- `src/_tests_/harness.ts` — the browser fixture: sign-in through the real magic link, the admission check and the shared page actions; `sign-in-links.ts` waits out the API's link admission window and reads the mailed link, `database-fixture.ts` writes provider observations and moves the recorded installation between the states GitHub alone puts it in — suspended, removed, or handed on to the next account — `members.ts` adds a second person through the API and returns that person's saved session, which `switchSession` restores without a second sign-in, `setup-walks.ts` holds the onboarding walks the connect, role, CLI form and two-account specs share, and `publish.ts` publishes the pinned fixture for the repository the project was created for. `writes.ts` holds `pressWrite`, which presses a write control and waits for the write's ok answer before a test reads stored state. The browser defers every read of a page whose navigation is pending, so a spec that checks a write that leaves the page answers the trip with 204 No Content, which keeps the page as it was while it left; `write-in-progress.spec.ts` does this. `setup-walks.ts` also holds `expectCompletedSteps`, which waits for the setup strip and its credited steps.
- `src/_tests_/desktop-sign-in.ts` — the desktop sign-in specs' support: a verifier and its challenge, the connect page's grant requests, scheme navigations, controls and confirmation, and the verifier a window keeps. `server-render.ts` renders a screen in Node for a logic test, with `press-doubles.ts` and `resource-doubles.ts` in place of the package Button, Expo Router and the resource hook, so the test can answer the screen's reads and take its presses.
- `src/_tests_/stripe-double.ts` — serves the loopback Stripe provider for browser tests. `stripe-state.ts` owns its objects, and `stripe-routes.ts` answers HTTP requests. `billing.ts` reports status changes while the real seat worker owns subscription items.
- `src/_tests_/build-api.spec.ts` — the one spec that follows a real build. `replaceApi` in `api-server.ts` swaps the ordinary API for the `fake-build-api` example and back, with the run's settings that `api-environment.ts` saved.
- `src/_tests_/settings/undoable-writes.ts` and `src/_tests_/settings/refusals.ts` — every undoable write and every refusable control, asserted from one table each; `busy-writes.ts` gives each write's working word and the operation a screen reader hears, which `writes.spec.ts` reads while each write is held.
- `src/_tests_/document-policy.ts` — the runtime state-copy checks both suites run on every rendered error alert.
- `src/_tests_/screen-policy.ts` — the landmark, heading, skip-link and title rules every registered screen meets; logic tests stand in for a page with `page-window.ts`.
- `src/_tests_/protocol-symbols.test.ts` — fails when a listed protocol doc names a `symbol()` this package does not declare.
- `src/_tests_/viewer/layout.spec.ts` — desktop and phone height checks, and bar checks at 768px and 1024px. It also narrows and widens the viewer inside a wide window. It opens History, moves the viewer's width across the bar's switch width, closes History and checks focus: History after widening, More after narrowing. `src/viewer/bar-width.tsx` chooses the bar layout from the one switch rule in the shared `docs/mockups/styles/product/viewer.css`, through a probe that only the full bar draws. Other views and touch targets keep `useCompact()`.
- `src/_tests_/data/resource-key.spec.ts` — the real React probe for the resource hook. It imports the `esbuild` API, which this package declares as an exact dev dependency.
- `scripts/build-web.mjs` and `scripts/serve-dist.mjs` — the verified export and the local static server; `sync-styles.mjs` copies the stylesheets and `verify-web-build.mjs` proves the stylesheet, font and bundle bytes.
- `metro.config.js` — Expo's resolver with the two npm workspace module roots and hierarchical lookup disabled.
- `playwright.config.ts` — the browser suite's one worker, ports, servers and global setup, and the shard that `MKC_APP_SHARD` selects; `src/_tests_/api-server.ts` is the shared app and desktop harness entry point, with `catalogue-server.ts`, `publication-runtime.ts` and `server-process.ts` for the catalogue process, the isolated database and blobs, and process shutdown.

### Related Docs

- [Architecture](../../docs/architecture/cloud.md) — the components and the three origins.
- [Web application](../../docs/protocol/cloud/web-app.md), [Web API client](../../docs/protocol/cloud/web-api-client.md), [Web product shell](../../docs/protocol/cloud/web-product-shell.md), [Settings dialog](../../docs/protocol/cloud/settings-dialog.md), [Product navigation](../../docs/protocol/cloud/product-navigation.md) and [Product accounts and roles](../../docs/protocol/cloud/product-accounts-and-roles.md).
- [Viewer](../../docs/protocol/cloud/viewer.md), [Viewer host](../../docs/protocol/cloud/viewer-host.md), [Viewer chrome](../../docs/protocol/cloud/viewer-chrome.md), [Viewer address state](../../docs/protocol/cloud/viewer-address-state.md), [Viewer catalogue](../../docs/protocol/cloud/viewer-catalogue.md) and [Viewer read model](../../docs/protocol/cloud/viewer-read-model.md).
- [Viewer builds](../../docs/protocol/cloud/viewer-builds.md), [Viewer build navigation](../../docs/protocol/cloud/viewer-build-navigation.md), [Cloud builds](../../docs/protocol/cloud/cloud-builds.md) and [Cloud build API](../../docs/protocol/cloud/cloud-build-api.md).
- [Authentication callbacks](../../docs/protocol/cloud/auth-callbacks.md), [Authentication and sessions](../../docs/protocol/cloud/auth-sessions.md) and [GitHub sign-in](../../docs/protocol/cloud/github-sign-in.md).
- [Desktop application](../../docs/protocol/cloud/desktop-app.md), [Desktop sign-in](../../docs/protocol/cloud/desktop-sign-in.md) and the [desktop shell](../desktop/README.md), which serves this export from its own origin.
- [Billing](../../docs/protocol/cloud/billing.md), [plan gates](../../docs/protocol/cloud/billing-plan-gates.md) and [subscriptions](../../docs/protocol/cloud/billing-subscriptions.md).
- [Shared controls](../../docs/protocol/cloud/shared-controls.md), [Design tokens](../../docs/protocol/cloud/design-tokens.md), [Design token colors](../../docs/protocol/cloud/design-tokens-color.md), [Folio chrome](../../docs/protocol/cloud/folio-chrome.md), [Folio viewer compositions](../../docs/protocol/cloud/folio-viewer.md), [Folio chrome: account entry](../../docs/protocol/cloud/folio-chrome-account.md) and [Product copy](../../docs/protocol/cloud/product-copy.md).
- [REST API](../../docs/protocol/cloud/rest-api.md), [REST API surface](../../docs/protocol/cloud/rest-api-surface.md) and [Marketing site](../../docs/protocol/cloud/marketing-site.md).
- [Tokens package](../../packages/tokens/README.md) and the [TypeScript npm workspace](../README.md).
