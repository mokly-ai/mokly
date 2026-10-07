<p align="center">
  <img src="https://mokly.ai/brand/mokly-logo.svg" alt="Mokly" width="360">
</p>

<p align="center">
  <strong>
    Build browsable, reviewable mockup catalogues from real React components.
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

Mokly is an open-source TypeScript toolkit for turning React-authored product
screens into a searchable static catalogue. It renders the components and themes
from your repository, presents every screen at mobile and desktop sizes, and
shows which screens changed from a Git baseline.

Run Mokly locally while you build, export the same catalogue as static files, or
embed its viewer in another React application. Local Serve and static exports
share the standalone presentation, whose single Auto/Light/Dark Appearance
selector changes the interface and previews together. Embedded hosts render the
same shell but choose its interface appearance independently with `theme`. The
Dark interface uses warm neutral surfaces aligned with Mokly Cloud. Mokly owns
the catalogue; your repository keeps ownership of its UI, data, styling, and
rendering context.

> Mokly is pre-1.0. The package is
> [`@mokly/mokly`](https://www.npmjs.com/package/@mokly/mokly) and the
> executable is `mokly`.

## Why Mokly

- **Use real product UI.** Screens are React nodes composed from the same
  components, providers, styles, and assets as the product.
- **See the whole product in one place.** Folders that mirror your spec tree,
  search, tags, mobile and desktop views, color schemes, pages, Markdown documents, components, screen and component variants, and user flows share
  one catalogue. Variants remain grouped beneath their parent while keeping
  their own path and address.
- **Review outcomes, not file lists.** The Changes view compares rendered
  screens and their reachable resources with the branch point of your Git base,
  while removed screens, pages and documents retain a read-only previous version.
- **Inspect reusable components.** Register typed props, variants, slots, and
  local controls, then see where each component is used.
- **Keep delivery simple.** A catalogue can be exported as static files and
  hosted without a Mokly server, source checkout, or Git installation.
- **Stay app-independent.** Plain React, React Native Web, design systems, and
  custom themes connect through a consumer-owned renderer and explicit module
  resolution.

## Quick start

### 1. Install

Mokly requires Node.js 22.14 or newer, except Node 24.14 through 24.18. The
supported range is `>=22.14.0 <24.14.0 || >=24.19.0`. You also need npm 11 and
React 19 or newer.

```bash
npm install --save-dev @mokly/mokly react react-dom
```

### 2. Configure the catalogue

Create `mokly.config.ts` in your repository root:

```ts
import { defineConfig } from "@mokly/mokly";

export default defineConfig({
  mockupsDir: "specs/generated",
});
```

Paths are relative to the config file. Mokly reads the `specs` directory
beside the config by default: every `.mockup.ts` or `.mockup.tsx` file in it
is an entry module and every `.md` file is a document. A file's location
in that tree is its place in the catalogue. List `roots` to read other
directories, such as a component library with
`{ dir: "packages/ui/src", path: "components" }`. The co-located alternative
uses `{ dir: "src/features", transparent: ["__mockups__"] }`, so
`src/features/checkout/__mockups__/summary.mockup.tsx` becomes
`checkout/summary`. Every root must match at least one file.

The default renderer is deliberately neutral; point `renderer` at your own
module when screens need product theme providers, custom document markup, or
React Native Web style collection. See the
[configuration guide](./docs/guides/start/configure.md).

### 3. Add a screen

Create `specs/account/account-home.mockup.tsx`:

```tsx
import { defineScreen } from "@mokly/mokly";

export default defineScreen({
  title: "Account home",
  description: "The account landing screen.",
  mobile: <main>Account on mobile</main>,
  desktop: <main>Account on desktop</main>,
  relatedDocs: [],
});
```

Replace the example `<main>` nodes with your product components. Rendered
resources and output determine Changes. Components declare public CSS with
`stylesheets`. An entry file ends in
`.mockup.ts` or `.mockup.tsx` and exports its definitions from any export,
default or named. Mokly derives everything else from the file's place: this
screen is `account/account-home`, it lives at `/view/account/account-home/`,
and its views are written under `mockupsDir/mokly-generated/` as
`account/account-home/index.mobile.html` and `index.desktop.html`, one file
per viewport and color scheme. Serve exposes them below `/static/mokly-generated/`; export
writes them below `static/mokly-generated/`. The `account`
directory is a folder in the catalogue; a `_folder.json` file or a
`defineFolder` export gives it a title and an order.

Keep generated output local by ignoring its dedicated directory and cache:

```gitignore
.mokly-cache/
/specs/generated/mokly-generated/
```

For this configuration, `build` writes only under `specs/generated/mokly-generated/`; referenced authored
assets stay under `specs/generated/` and are served and exported in place. To
commit generated output instead, commit every generated file. `check`
compares compiled output only when the generated tree is indexed; a partial
index fails with both remedies. A committed baseline's v9 inventory must
match its Git blobs; otherwise the baseline is rebuilt.
Build and Serve do not inspect head tracking: a new route builds successfully,
and `check` then lists it under `untracked:` until staged. Only `check` rejects
an indexed `.mokly-cache/` path.
Current output uses manifest v9. The manifest records the referenced asset closure and Git blob-hash
inventory. Earlier baseline formats make Changes unavailable under
[baseline compatibility](./docs/protocol/mokly-baseline-compatibility.md).

Add `specs/account/README.md` to give Account its own Overview row:

```markdown
# Account

Manage account details and billing.

[Open account home](mock:./account-home)
```

Folder rows expand without changing the content area. The Overview row opens
the document at `/view/account/`. Specs contains screens, pages, documents and
flows; Components contains registered components.

For an existing catalogue, follow the
[path identity migration note](./docs/protocol/npm-release-notes.md#breaking-path-identity-release-note).

### 4. Open the catalogue

```bash
npx --no-install mokly --open
```

The development server prints its URL, renders previews on demand, watches
authored inputs, and prepares Git change evidence in the background. The default
port is `4173`; use `--port 0` to choose any available port.

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
| `mokly build --watch`       | Write after each successful compilation while watching       |
| `mokly serve --build`       | Browse and write complete output after successful compiles   |
| `mokly check`               | Validate; compare disk when Git tracks generated output      |
| `mokly export --out <path>` | Compile and export without writing catalogue output          |
| `mokly publish`             | Export and upload to a compatible catalogue service          |
| `mokly --help`              | Show every command and option                                |

The CLI uses stable plain output in CI and a richer interactive display in a
terminal. During watched Serve, press `h` to see shortcuts for opening,
rebuilding, clearing, and quitting. Build warnings print on standard error
without changing the exit status; `--strict` turns them into a failed command.
Publish requires a clean Git checkout. It ignores Git-ignored files, its own
output directory, and Mokly caches and temporary files. Committed generated
files must match the build; derived generated output must be ignored by Git.

Ignored-input warnings use the same channel as link-control warnings. They
name the affected page or authored input. `--strict` counts every warning
before Build, Check, export or publish can write or upload output.

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

| Concept          | Use it for                                                                                | Guide                                                               |
| ---------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Screens          | Product states, view renders, and full-screen variants                                    | [Screens](./docs/guides/authoring/screens.md)                       |
| Folders and tags | Folders from file paths, titles and order from `_folder.json` or `defineFolder`, and tags | [Folders and tags](./docs/guides/authoring/collections-and-tags.md) |
| Components       | Typed props, variants, controls, and usage inspection                                     | [Components](./docs/guides/authoring/components.md)                 |
| Use-case flows   | Ordered journeys composed from existing screens                                           | [Use-case flows](./docs/guides/authoring/use-case-flows.md)         |
| Pages            | Existing complete HTML documents without device variants                                  | [Pages and documents](./docs/guides/authoring/pages.md)             |
| Documents        | Markdown files rendered as catalogue documents, including a folder's README               | [Pages and documents](./docs/guides/authoring/pages.md)             |
| `MockLink`       | Portable links between catalogue entries by path                                          | [Links](./docs/guides/authoring/links.md)                           |
| Styles           | Imported CSS, modules, assets and optional PostCSS                                        | [Styles](./docs/guides/authoring/styles.md)                         |

A custom renderer is the integration boundary for product providers, themes,
stylesheets, fonts, and full-document markup. Mokly resolves React from the
consumer repository and bundles all authoring inputs into one build-time graph,
so component trees use one React runtime.
Use `stylesheets` for separately authored public CSS. [Imported CSS delivery](./docs/protocol/mokly-imported-styles.md)
compiles CSS Modules, per-root stylesheets and assets. Fragment renderers
receive links under the [renderer stylesheet contract](./docs/protocol/mokly-rendering.md#renderer-stylesheets),
which owns the complete list and its order. Pages link their own CSS explicitly.
An optional consumer PostCSS module processes imported CSS; see the Styles guide
for plugin setup.
The basic consumer example imports a CSS Module, a PNG-backed stylesheet, and
preflight-free Tailwind v4 utilities to exercise this delivery end to end.

## Delivery Status

The [implementation plans](./plans/) lists active and completed work.

Removal of baseline compatibility below is implemented in
[M23B](./plans/remove-source-path-evidence.md#milestone-23b-remove-baseline-compatibility).

Uniform CSS attribution is implemented in Milestone 19 of the
[source-path removal plan](./plans/remove-source-path-evidence.md); comparison
details for screens and saved views are implemented in Milestone 20, and for
whole-document pages in Milestone 20B. Configured, declared and imported stylesheets
use the same [CSS rule contract](./docs/protocol/mokly-css-attribution-rules.md).
Components change through own-page matches kept after nested filtering. Outside matches
and unresolved rules give a page its own row. Stylesheet owner records have no
role in that decision.

## Review and share

The local **Changes** view compares the working tree with the merge base of
`HEAD` and `origin/main` by default. It accounts for generated documents,
reachable resources, catalogue metadata, registered components, and applicable
stylesheet changes. Changed screens, screen variants, and component variants
generate comparisons only when an eligible shown view is opened. Per-view
evidence keeps known unchanged views marked Unmodified without offering a
comparison. A light-only screen or component variant uses its effective Light
view for status and marks even while Dark stays selected for the rest of the
catalogue. Missing per-view evidence preserves the selected entry's existing
comparison eligibility. Removed screens, pages and documents load their read-only
[previous version](./docs/protocol/mokly-removed-previews.md) from the branch
point. Changes pairs a moved entry with its earlier version when the evidence
is unique, labels its row Moved, and names the previous path in Details. Use
`movedFrom` to declare the previous path when needed. Pure moves stay included
without counting as output changes; see the
[move contract](./docs/protocol/mokly-moves.md).

Read [how Changes works](./docs/guides/catalogue/changes.md), then export a
standalone site:

```bash
npx --no-install mokly export --out .context/mokly-site
```

The export contains the catalogue, its assets, navigation, available Git
comparisons, and previous versions for removed screens, pages and documents. Serve the
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
authentication, or discussion experience. Embedded viewer roots accept `theme`
independently from `selection.colorScheme`, so hosts can pair any interface
appearance with any preview scheme. See the
[viewer appearance contract](./docs/protocol/mokly-viewer-appearance.md) and
[semantic palette](./docs/protocol/mokly-viewer-palette.md).

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
- [Changelog](./CHANGELOG.md)

The guides are user-facing and ship with the npm package. The protocol documents
are the detailed implementation contracts used to keep the CLI, viewer,
generated output, and tests aligned.

The [path/output contract](./docs/protocol/mokly-path-output-integration.md) defines
one [unified layout](./docs/protocol/mokly-unified-output.md) for generated pages,
imported styles and assets. The portable
[viewer namespace](./docs/protocol/mokly-viewer-namespace.md) is `mokly-viewer/`.
Older receivers reject the new upload format. Mokly Cloud needs the documented
receiver and viewer update before publication.

## Develop Mokly

For repository development, use the tested Node.js version in
[`.nvmrc`](./.nvmrc), npm 11.21.0 (the `packageManager` version in
`package.json`), Rust 1.95, and Chromium for the browser suite. With nvm, run
`nvm install` in the repository to install and use that Node.js version. Use
the pinned npm version for dependency changes.

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
renderer, and stylesheets. Changes to Mokly's own `src/` files require
restarting the command so the CLI is rebuilt.

Run tests that cover the change while you develop:

```bash
npm test -- tests/ci_workflow.test.ts
npm run test:unit -- tests/ci_workflow.test.ts --test-name-pattern="CI shards complete verification"
npm run test:browser -- tests/browser/pages.spec.ts -g "retain metadata"
```

Put every test argument after `--`. npm consumes flags before that separator.
The developer runner rejects consumed name-pattern and shard flags.

`npm test`, `npm run test:unit`, and `npm run test:browser` always prepare
package and example output, so they test the current `src/`. The raw commands
`node --import tsx --test <file>` and `npx playwright test <spec>` use the last
build; run `npm run prepare:verification` after a `src/` change before using
them. Browser tests reject `.only`; select by path and `-g`. These selected runs
are partial verification. See [developer test commands](./docs/protocol/developer-test-commands.md)
for the argument and report rules.
Selected unit runs print the number of tests that ran. They print a warning
for each named file that reports zero tests; skipped and todo tests count
as reported tests. A pattern-only run warns once if no file reports a test.
Argument errors and selected-run failures print a short
report without a stack trace. Internal faults keep the full error report.

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

Large ordinary-preview browser fixtures build in an owned Node child, then
serve that real artifact in the worker. This keeps Playwright's diagnostic
stack capture out of the build while retaining the same catalogue and checks.

ESLint requires shared directory constants, locale-independent source ordering,
and unique imports. Tests probe every covered source folder through the real
flat config. See the [lint contract](./docs/protocol/mokly-directory-lint.md).

Browser global setup prepares one real example baseline and cache. Ordinary
export fixtures use isolated, validated copies; dedicated tests retain cold
baseline and preview builds. See [fixture preparation](./docs/protocol/ci-fixture-preparation.md).

The [remote verification contract](./docs/protocol/remote-verification.md)
defines the Testbox gate. Push your branch before an explicit remote check:

```bash
cargo xtask check --executor remote
```

Warmup uses the Testbox workflow from `main`.
Set `MOKLY_TESTBOX_REF=<pushed branch>` only to test a changed Testbox workflow
before it merges. This variable does not change the source commit under test.

Install `blacksmith`, `rsync` and `ssh`. Set `BLACKSMITH_ORG_TOKEN` for org-key
login, or use the current CLI login. The remote gate runs 11 commands in parallel.
Login saves the key in `~/.blacksmith/credentials`.
It replaces any saved login for the same organization.
Warmup uses a 30-minute idle timeout. Readiness still uses `10m`.
Each ended command downloads its report and cleans up its box at once.
The gate requires nine reports. It skips stop and cancellation for a status
table row that proves the box is completed. A failed stop gets retries after
5 seconds and 10 more seconds. A recovered stop does not fail the gate.
Final cleanup counts each box once if it is neither stopped nor proven completed.
A nonzero count fails the gate. Interrupts report the same count.
Warnings name each remaining box's manual stop command and its idle timeout.
Cleanup uses run IDs from warmup or probe output when status names no run.
A failed GitHub cancellation checks the run state. An ended run gets an
information line. Logs stay under `.context/`.
Availability checks name all missing programs with install hints.
Every xtask child removes `BLACKSMITH_ORG_TOKEN` from its environment.
The source check names any unsupported nested repository or worktree path.
Ignore or remove that path before retrying. The repository ignores agent
worktrees under `.claude/worktrees/`.
`--executor local` skips remote checks. The default `auto` selects remote mode
when an org key and all availability checks pass. It otherwise runs locally.
Run `cargo xtask executor` to print `<executor>: <reason>` without warming boxes.
Automatic fallback runs the full local gate only before a remote suite starts.
An interrupt never starts local fallback.
`MOKLY_CHECK_EXECUTOR` sets the default mode. The CLI flag overrides it.
A selected `--suite` stays local.
Explicit `remote` with `--suite` fails before work starts.

Local test runs scale with the machine. Unit tests run half the available CPUs'
worth of test files at once, never fewer than two, and the hydration suite uses
half the CPUs as Playwright workers. Other browser runs use one worker. Set
`MOKLY_UNIT_CONCURRENCY` or `MOKLY_PLAYWRIGHT_WORKERS` to a positive integer to
choose a different value. Playwright worker N serves the example on port
`MOKLY_PLAYWRIGHT_PORT` + N, and `MOKLY_PLAYWRIGHT_PORT` defaults to 4517:

```bash
MOKLY_PLAYWRIGHT_WORKERS=3 npm run test:browser
```

Required tests follow [CI test timing](./docs/protocol/ci-test-timing.md).
Use the shared helpers in `tests/helpers/operation_counts.ts` and
`tests/helpers/durations.ts` for operation counts and duration text.

Pull request titles use Conventional Commits and at most 72 Unicode code points.
The separate title check runs when a PR opens, changes, or receives a push; see
the [title contract](./docs/protocol/ci-verification.md#pull-request-title-contract).

`npm run dependencies:check` runs the strict live audit of every workspace
dependency category from the lockfile. It fails on uncovered Low-or-higher
advisories and invalid exception records. Use
`npm run dependencies:check -- --baseline` to report issues already present at
the comparison commit as notices and fail on new issues. The
[baseline audit contract](./docs/protocol/dependency-audit-baseline.md) defines
byte comparison and inheritance. Baseline mode is the default for
`cargo xtask check`, ordinary pull requests, and pushes. Select strict local
verification with `cargo xtask check --dependency-audit strict`.
Either mode can write a JSON summary with `--report <file>`.

Release Please and dependency update pull requests, release publishing, and
the daily `main` audit stay strict. The scheduled workflow creates or refreshes
the [dependency update pull request](./docs/protocol/dependency-audit-update-pr.md)
for findings and exception issues. It preserves human commits and closes the
update pull request when `main` passes. It needs no installed dependencies for
the audit or script load; only the failure path installs and updates packages.
Reviewed exceptions keep their exact dev-only path, inclusive UTC end date,
and maximum 31-day window. The packed ESM consumer's production audit stays
strict with no exceptions. See [dependency security](./docs/protocol/dependency-security.md)
for the review rules and temporary Braces exception.

### Key code

- [`src/index.ts`](./src/index.ts) — supported public authoring exports.
- [`src/config`](./src/config) — config discovery, loading, and path policy.
- [`src/build`](./src/build) — bundling, rendering, validation, and generated
  output transactions; see the [imported CSS contract](./docs/protocol/mokly-imported-styles.md)
  for the stylesheet pass and binary output boundary.
- [`src/build/mock_link_routes.ts`](./src/build/mock_link_routes.ts) —
  identity-derived logical-link targets and portable artifact URLs.
- [`src/components/manifest_entry_validation.ts`](./src/components/manifest_entry_validation.ts)
  — manifest-v9 component-entry validation.
- [`src/registry/changed_paths.ts`](./src/registry/changed_paths.ts) and
  [`manifest_validation.ts`](./src/registry/manifest_validation.ts) —
  identity-keyed change membership and the strict baseline-v9 boundary.
- [`src/baseline/compatibility.ts`](./src/baseline/compatibility.ts) and
  [`src/server/classification_result.ts`](./src/server/classification_result.ts)
  — the typed earlier-baseline outcome from admission through Serve.
- [`src/cli`](./src/cli/README.md) — command parsing, reporting, and
  composition.
- [`src/server`](./src/server/README.md) — local HTTP server and watched
  runtime.
- [`src/server/http_request_handler.ts`](./src/server/http_request_handler.ts) —
  request dispatch against the server's current accepted snapshot.
- [`src/review`](./src/review/README.md) — Git baselines, comparison, and change
  attribution.
- [`src/review/component_variant_classification.ts`](./src/review/component_variant_classification.ts)
  and
  [`component_classification_sources.ts`](./src/review/component_classification_sources.ts)
  — flat variant classification and review-result assembly.
- [`src/review/artifact_files.ts`](./src/review/artifact_files.ts) and
  [`component_classification_entries.ts`](./src/review/component_classification_entries.ts)
  — collision-safe artifact writes and per-entry comparison preparation.
- [`src/review/deleted_resource.ts`](./src/review/deleted_resource.ts) — the
  shared verified-deletion and byte-comparison decision used by both Changes
  classifiers.
- [`src/export`](./src/export/README.md) — static catalogue export.
- [`src/publication`](./src/publication/README.md) — shared static shell and
  previous-version publication.
- [`src/publish`](./src/publish/README.md) — content-addressed publication exchange.
- [`packages/viewer`](./packages/viewer/README.md) — React shell, catalogue read
  model, navigation, frames, and inspection.
- [`scripts/preview/baseline.mjs`](./scripts/preview/baseline.mjs) and
  [`html_paths.mjs`](./scripts/preview/html_paths.mjs) — preview publication's
  baseline-availability and provider-path adapters.
- [`scripts/verification/source-tree.mjs`](./scripts/verification/source-tree.mjs)
  computes the source fingerprint, including uncommitted changes.
- [`scripts/verification/testbox-suite.mjs`](./scripts/verification/testbox-suite.mjs)
  checks that fingerprint and prepares one suite through injected commands.
- [`xtask/src/remote`](./xtask/src/remote) runs the complete Testbox gate and
  owns report downloads, logs and interrupt cleanup.
- [`examples/basic`](./examples/basic/README.md) — reference consumer and design
  catalogue.

## License

Mokly is available under the [MIT License](./LICENSE).
