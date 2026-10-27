# Browser fixtures

`npm run test:browser` builds the workspace and runs the selected browser
specs. Select a spec file, and optionally a test name with `-g`:

```bash
npm run test:browser -- tests/browser/pages.spec.ts -g "retain metadata"
```

The [developer browser commands](../../docs/protocol/developer-browser-commands.md)
give the selection rules and the environment variables that supply prebuilt
output. Strict shards use [measured whole-file placement](../../scripts/verification/README.md#browser-partitioning).
Specs import `test` from `browser_test.ts` or one of its host fixtures. The
automatic fixture fails on unexpected console and page errors. Expected
resource failures need an exact message and URL allowance.

Global setup starts the worker Serve hosts and two copied builds together.
The shared Serve example uses the unresolved base `refs/mokly/browser-suite-no-base`.
It waits for settled usage and unavailable Changes, with one Git diagnostic.
Real Changes specs use their own Git fixtures.
Every host uses a free loopback port. Setup cancels and drains all work on
failure. Teardown closes hosts before it removes their output.

Setup publishes the server URLs in `MOKLY_PLAYWRIGHT_URLS`, and each worker
selects its own with `TEST_PARALLEL_INDEX`. `MOKLY_PLAYWRIGHT_COPIED_URL` and
`MOKLY_PLAYWRIGHT_COPIED_DIR` carry the copied build to specs, and
`MOKLY_PLAYWRIGHT_COMPARISON_URL` and `MOKLY_PLAYWRIGHT_COMPARISON_DIR` carry
the comparison build.

## Browser errors and waits

- The automatic error fixture in `browser_test.ts` applies the console rule of
  `console_notices.ts`. A test that causes another error declares its kind and
  exact message pattern with `allowBrowserError` or `expectedBrowserErrors`.
  Console resource failures also need the exact resource URL. Sandbox denials,
  synthetic console sentinels, and page errors can omit the URL when their
  location is unstable or absent; their exact message must identify the
  expected failure.
- Portable-document cases allow the absent root favicon on their own origin.
  Manual file delivery also allows the fixed HTTP-only inspector URL to be
  absent on disk. Private sandbox fixtures declare their exact denial notices.
  Test-owned host documents declare a favicon that loads, so they need no
  allowance: a `data:` favicon, or a served same-origin icon where a strict
  content security policy blocks data URLs.
- The fixture settles each open page before a context closes and before its
  error check, without wall-clock waits: two animation frames, or one protocol
  round trip when JavaScript is disabled. It tracks pauses on the shared
  context clock, including for new pages, and advances a paused clock by 32 ms
  instead of waiting for frames. No sleep synchronizes an assertion.
- An assertion that depends on a navigated preview's layout waits for the
  expected frame URL and the complete document state together. The outer Browse
  URL or an iframe `src` attribute alone is not enough.

## Current-only copy

`static_test.ts` supplies `test`, `copiedStaticUrl()`, and
`copiedStaticDirectory()`. The URL becomes `baseURL` after global setup.
The directory holds an isolated build of `examples/basic` with Changes
disabled. `MOKLY_PLAYWRIGHT_STATIC_DIR` or `MOKLY_PLAYWRIGHT_FILE_DIR` can
supply that current-only input. Setup rejects an index whose
`changesStatus` is not `disabled`. Most `static_*.spec.ts` specs,
`stage_centring.spec.ts`, `review_snapshot_links.spec.ts`, and the shared
`*_cases.ts` modules of the design journeys use this copy. The comparison
specs use the two-commit copies of the
[comparison fixture reference](comparison/README.md).

`npm run test:delivery:prepared` builds a fresh example with `--no-changes`.
It runs `playwright.delivery.config.ts` through static HTTP and `file://`.
The private slot and saved-variant fixture builds its own output, removes its
source, and checks every viewport and scheme through standalone links. Disk
mode requires `file://` navigation without HTTP requests. The delivery reporter
rejects skips, missing or duplicate results, and empty discovery. Reports live
under `.context/static-delivery`, outside the complete suite report directory.
The parent checks each saved report through
[`static-delivery-mode.mjs`](../../scripts/verification/static-delivery-mode.mjs).
A zero Playwright exit cannot hide a missing or invalid report.

### Delivery spec inventory

The `testMatch` list of
[`playwright.delivery.config.ts`](../../playwright.delivery.config.ts) names
the portable design journeys that run in both delivery modes, including
`component_fragments.spec.ts`.

## Deployment replacement

`static_deployment.spec.ts` hosts two immutable copies. The static host's root
callback selects the published copy once per request, before filesystem work.
Publication changes that selection in one synchronous step. Pending requests
keep their selected copy until teardown. This spec and
`static_deployment_flow.spec.ts` publish the next deployment while a page is
open, and they check that the shell never shows a stage that cannot be shown.
`tests/static_server_deployment.test.ts` checks that an old request and a
request for the replacement copy both return their selected file.

## Native comparison copy

The shared native copy supplies immutable comparison data and named paths.
See the [comparison fixture reference](comparison/README.md#native-comparison-copy).

## Embedded comparison viewer

The embedded viewer hosts copied comparisons through both frame adapters.
See the [comparison fixture reference](comparison/README.md#embedded-comparison-viewer).

## Comparison scrolling suites

The scrolling suites cover copied output, embedded viewers, and Serve.
See the [comparison fixture reference](comparison/README.md#comparison-scrolling-suites).

## Branch-point delivery copy

The branch-point copy covers moved entries and retained historical paths.
See the [comparison fixture reference](comparison/README.md#branch-point-delivery-copy).

## Small comparison copies

Small comparison copies add isolated sources without changing shared fixtures.
See the [comparison fixture reference](comparison/README.md#small-comparison-copies).

## Shared Serve comparison fixture

Import `test` from `serve_comparison_test.ts` for viewer Changes journeys.
Each test gets a private `changes` fixture and its URL as `baseURL`. It owns
a two-commit Git repository, a `fixture-base` branch, a watcher, and real
comparison generations. It waits for ready Changes at the pinned base.
`serveComparisonCatalogue` in
[`serve_comparison_fixture.ts`](./serve_comparison_fixture.ts) builds the
fixture object: the named paths, the URL and source root, the base and head
commits, and the `index`, `ready`, `edit`, `commitBase`, `moveBase`, and
`close` methods. The existing `serve_changes_fixture.ts` remains the smaller
engine fixture.

`expectedBase` is the expected pinned merge-base commit in `review.json`.
A `predicate` receives the accepted index and can return a boolean or a
promise. `ready` and `edit` wait for both a higher revision and that state.
Use a changed title, membership, or document key for the semantic condition.
`edit` rejects unchanged text. It writes a temporary file outside the
watched source root, then replaces the target with one rename.
`moveBase` resolves an arbitrary commit as well as the original fixture
aliases. Moving to the already selected ref returns its ready publication.
Moving a ref without changing its merge base also keeps that publication.

`commitBase` accepts `base`, `head`, or a commit as its parent. It leaves
HEAD, the working index, and watched files untouched. It returns a commit ID.
A new child of `base` is a sibling of HEAD, so selecting it still compares
against the original merge base. For changed historical content, explicitly
join it into the private test history before `moveBase`:

```ts
const third = await changes.commitBase({
  "specs/screens/retired.screen.html":
    "---\ntitle: Retired\n---\n<h1>Other base</h1>",
});
const head = await git(changes.root, "rev-parse", "HEAD");
const joined = await git(
  changes.root,
  "commit-tree",
  `${head}^{tree}`,
  "-p",
  head,
  "-p",
  third,
  "-m",
  "Join fixture base",
);
await git(changes.root, "update-ref", "HEAD", joined, head);
await changes.moveBase(third);
```

Import `git` from `tests/helpers/static_changes.ts` for this recipe. The
explicit join changes only private history. Current source and index bytes
stay fixed. Neither fixture method changes HEAD on the caller's behalf.

To stage a Changes completion for a Usage-focus check, first use
`await changes.moveBase("head")`, then `await changes.moveBase("base")`.
The ref changes preserve the current source and documents. A caller can
keep its browser page and focused link mounted during both publications.
`serve_usage_focus.spec.ts` follows this recipe.

The `changed` screen has a matched `.accent` rule from `theme.css`, an
unresolved root rule, and native component usage. Read `comparisonUrl` from
the index for removed records. Use `/mokly-viewer/diffs/review.json?path={path}`
for live selected comparisons, and add `&refresh=1` for an explicit refresh.
The test fixture closes automatically. It permits watched edits and base-ref
moves without sharing writable state with another test.

### Viewer journeys on Serve

`serve_comparison_ui.ts` holds the shared viewer actions, including the waits
for a selected comparison request and a held renewal of its generation.
`expectCardPane` checks one pane of a Card comparison by its heading and by
the `.accent` colour of its side, because Card's own heading is the same on
both sides. `serve_changes_emulation.ts` rewrites the index body into a pending,
preparing, or unavailable Changes state, the shape Serve writes before
classification completes. Each step still arrives as a real watched
publication, and Serve keeps no test seam. `serve_generation_removal.ts`
makes a generation gone once the documents of the given frames have loaded:
its first renewal answers 404, and every other request for its files answers
404 and is refused. For a selected generation this emulates Serve's collection
of an idle generation, and the comparison then gets a new generation. Serve
keeps an advertised classification generation's `review.json` and recaptures
its snapshots, so for that generation the failure only exercises the shell's
reacquire, and the generation returns when the shell reacquires its
`review.json` after the renewal. Specs that run the same comparison checks on
the copied output and on Serve register them from a `*_cases.ts` module. The
copied output registers the alignment, input, and Scroll together memory cases
in `comparison_alignment.spec.ts`, `comparison_alignment_input.spec.ts`, and
`comparison_regions_toggle.spec.ts`. Serve registers them in
`serve_comparison_alignment.spec.ts`,
`serve_comparison_alignment_input.spec.ts`, and
`serve_comparison_scroll_memory.spec.ts`. Checks that each host reaches
through its own setup are helpers instead. `light_only_band.ts` checks the
Light only band. `imported_css_panes.ts` checks the panes of the screen that
`tests/helpers/imported_css_sources.ts` adds. `serve_light_only_band.spec.ts`
drops Dark through a watched configuration edit.

A spec adds its own sources to both commits with
`test.use({ comparisonSources: { add: hook } })`. The hook runs after the
shared hooks; the option is unset by default. The object wrapper is needed
because `test.use` reads a function value as a fixture.
`tests/helpers/viewer_state_sources.ts` supplies `addViewerStateSources` and
`viewerStatePaths` for the one shape that the default catalogue lacks: an
unmodified component parent and variant beside a variant whose Dark views
alone change.

`serve_comparison_variant.spec.ts` opens Overlay for the Card family's
Featured variant and checks its parent-owned stylesheet evidence and both panes.
The selected comparison, expiry, and renewal-pane journeys also use this family.

Branch-point copy setup and Serve comparison setup use the isolated setup
budget, `ISOLATED_CATALOGUE_SETUP_TIMEOUT_MS` in
[`fixture_timing.ts`](../helpers/fixture_timing.ts). Test bodies keep the
timeout of [`playwright.config.ts`](../../playwright.config.ts).

## Watched catalogue cases

`watch_fixture.ts` extends the automatic console-error fixture. Each test owns
a small native catalogue through `serveCatalogue(..., { watch: true })` and
uses the isolated setup budget. Each edit waits for a higher published revision
and the expected catalogue state through `settleLive`. Document keys and DOM
marks distinguish changed previews from retained ones without a shell reload.
The browser leaves the page before the fixture closes its process and directory.
`watch_updates`, `watch_moves`, `watch_folders`, and `watch_shutdown` cover the
watched publication and disclosure cases.
`toggleFolder` waits for an unfiltered click's saved disclosure choice before
returning. Filtered clicks keep storage unchanged under the disclosure contract.
`disclosure_order.spec.ts` holds folder and section close events across search.
It checks mouse and keyboard activation, reveal, and baseline restoration.

`large_changes` and `large_watch` run the opt-in large-fixture harness with
small HTML and React inputs. They verify native base preparation, delivered
Changes, event identity, visible reloads, and restoration of edited sources.
They use the suite browser and assert outcomes without timing budgets.
`large_startup` checks real preview and prop behavior while Changes is
unavailable. The focused probe completes; the full Serve probe reports the
unavailable comparison. The test applies no elapsed-time budget.
`large_watch_failure` holds restoration pending after the owned server exits.
It requires the harness to close its context and finish restoration before return.

## Native team example

The `team_screens`, `team_components`, `team_links`, `team_pages`, and `team_flow`
specs read the shared Serve example. They do not edit its files. They cover the
HTML team screens, slot components, saved variants, canonical invitation page,
Markdown role guide, YAML flow, and native links in Browse and direct documents.
Each file has at most four cases so the scheduler can balance whole files.
