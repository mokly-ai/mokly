# Browser fixtures

Specs import `test` from `browser_test.ts` or one of its host fixtures. The
automatic fixture fails on unexpected console and page errors. Expected
resource failures need an exact message and URL allowance.

Global setup starts the worker Serve hosts and two copied builds together.
The shared Serve example uses the unresolved base `refs/mokly/browser-suite-no-base`.
It waits for settled usage and unavailable Changes, with one Git diagnostic.
Real Changes specs use their own Git fixtures.
Every host uses a free loopback port. Setup cancels and drains all work on
failure. Teardown closes hosts before it removes their output.

## Current-only copy

`static_test.ts` supplies `test`, `copiedStaticUrl()`, and
`copiedStaticDirectory()`. The URL becomes `baseURL` after global setup.
The directory holds an isolated build of `examples/basic` with Changes
disabled. `MOKLY_PLAYWRIGHT_STATIC_DIR` or `MOKLY_PLAYWRIGHT_FILE_DIR` can
supply that current-only input. Setup rejects an index whose
`changesStatus` is not `disabled`.

## Native comparison copy

`comparison_test.ts` supplies `test`, `copiedComparisonUrl()`,
`copiedComparisonDirectory()`, and `comparisonPaths`. Import its `test` to
use the comparison copy as `baseURL`. Import the URL function when one test
needs both copies. Resolve these functions in a test or hook, after setup.
Tests can read the shared directories but must not change their bytes.

`tests/helpers/comparison_catalogue.ts` writes an isolated repository with
exactly two commits and a `fixture-base` branch. `comparison_entry_groups.ts` adds
entry groups that it writes once per commit; the second commit also edits
`notes.txt`, which no entry references. The fixture builds through
the real shim with `--base fixture-base --strict`. It needs no repository
history, network dependency install, or sidecar. The host receives only the
copied output; the source repository and first output are removed.

| `comparisonPaths` key  | Entry and evidence                                                                                                                                                                                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `changed`              | `screens/changed`: changed text and CSS; a form field at the top right, outside the page flow; an unresolved `:root` rule and outside `.accent` matches; a canvas colour on the Before page only; a component consumer; a catalogue link; a shorter Before page and inner scroll panel; a focusable panel link; an anchor whose target reaches the top |
| `unchanged`            | `screens/stable`: light only, unchanged, and outside Changed membership; its one changed stylesheet is excluded                                                                                                                                                                                                                                        |
| `consumer`             | `screens/consumer`: changes only through `ui-card`, so it is an affected consumer outside Changes                                                                                                                                                                                                                                                      |
| `added`                | `screens/added`: added by the second commit                                                                                                                                                                                                                                                                                                            |
| `darkOnly`             | `screens/dusk`: a change to a dark-only stylesheet; its Light views stay unmodified                                                                                                                                                                                                                                                                    |
| `lightOnly`            | `screens/daylight`: a changed screen with Light views only                                                                                                                                                                                                                                                                                             |
| `removedLightOnly`     | `screens/former`: a removed screen with Light views only that consumed `ui-card`                                                                                                                                                                                                                                                                       |
| `screenParent`         | `screens/workspace`: an unmodified screen parent with screen variants                                                                                                                                                                                                                                                                                  |
| `screenVariant`        | `screens/workspace/error`: a changed screen variant                                                                                                                                                                                                                                                                                                    |
| `screenSibling`        | `screens/workspace/empty`: an unmodified screen variant                                                                                                                                                                                                                                                                                                |
| `screenRemovedVariant` | `screens/workspace/gone`: a removed variant of the surviving screen parent                                                                                                                                                                                                                                                                             |
| `folderIndex`          | `account`: an unmodified screen index that names `guides/terms` as a related document                                                                                                                                                                                                                                                                  |
| `folderChanged`        | `account/security`: a changed member of the `account` folder                                                                                                                                                                                                                                                                                           |
| `folderQuiet`          | `account/alerts`: an unmodified member of the `account` folder                                                                                                                                                                                                                                                                                         |
| `currentDocument`      | `guides/terms`: a current Markdown document with a catalogue link and an `Overview` heading below the fold                                                                                                                                                                                                                                             |
| `plainScreen`          | `screens/plain`: an unmodified screen whose only stylesheet, `plain.css`, stays the same                                                                                                                                                                                                                                                               |
| `plainComponent`       | `components/plain`: an unmodified component with the same unchanged stylesheet                                                                                                                                                                                                                                                                         |
| `lightOnlyParent`      | `components/lamp`: an unmodified component with Light views only                                                                                                                                                                                                                                                                                       |
| `lightOnlyVariant`     | `components/lamp/on`: its changed variant                                                                                                                                                                                                                                                                                                              |
| `atRuleChange`         | `screens/fade`: its only stylesheet change is a selector-less `@keyframes` rule                                                                                                                                                                                                                                                                        |
| `mobileOnlyChange`     | `screens/compact`: its changed `.auth` rule matches only the mobile view                                                                                                                                                                                                                                                                               |
| `tall`                 | `screens/tall`: a sticky header, a viewport-height hero, a late image (`alignment-late.svg`), and a fixed bar                                                                                                                                                                                                                                          |
| `appShell`             | `screens/app-shell`: a page that never scrolls around an inner region                                                                                                                                                                                                                                                                                  |
| `regionsShell`         | `screens/regions`: an app shell with a named horizontal timeline and one panel for each pairing rule, plus ambiguous, off, and new panels                                                                                                                                                                                                              |
| `regionsPage`          | `screens/regions-page`: a scrolling page with a focusable code panel, a right-to-left strip, and a two-axis grid                                                                                                                                                                                                                                       |
| `taskList`             | `components/tasks`: an unmodified parent whose list scrolls inside its box                                                                                                                                                                                                                                                                             |
| `taskListVariant`      | `components/tasks/list`: a changed variant of that parent                                                                                                                                                                                                                                                                                              |
| `component`            | `components/card`: CSS change; Usage lists both consumer screens and the removed `screens/former` as affected                                                                                                                                                                                                                                          |
| `changedVariant`       | `components/card/featured`: a surviving variant whose props changed                                                                                                                                                                                                                                                                                    |
| `addedVariant`         | `components/card/fresh`: a variant added by the second commit                                                                                                                                                                                                                                                                                          |
| `quietParent`          | `components/tag`: an unmodified parent; every tag view is taller than its frame                                                                                                                                                                                                                                                                        |
| `quietSibling`         | `components/tag/plain`: an unmodified variant                                                                                                                                                                                                                                                                                                          |
| `quietVariant`         | `components/tag/bold`: a changed variant of the unmodified parent                                                                                                                                                                                                                                                                                      |
| `quietRemoved`         | `components/tag/old`: a removed variant of the unmodified parent                                                                                                                                                                                                                                                                                       |
| `removedScreen`        | `screens/retired`: historical screen in both viewports and schemes                                                                                                                                                                                                                                                                                     |
| `removedPage`          | `pages/retired`: historical full HTML page with links, a form, and a tall body                                                                                                                                                                                                                                                                         |
| `removedDocument`      | `notes/retired`: historical Markdown document                                                                                                                                                                                                                                                                                                          |
| `removedComponent`     | `components/retired`: removed component parent                                                                                                                                                                                                                                                                                                         |
| `removedVariant`       | `components/card/archived`: removed variant of a surviving component                                                                                                                                                                                                                                                                                   |

## Embedded comparison viewer

`comparison_viewer_host.ts` mounts the public `MoklyViewer` over the native
comparison copy through both frame adapters. It copies the output into its own
directory, adds the host page of `comparison_viewer_entry.tsx`, and serves
that directory on three origins: the artifact origin, the host origin, and the
host origin behind a strict Content Security Policy. `/viewer.html` takes
`adapter=same-origin` or `adapter=cross`, and optionally `entry`, `snapshot`,
`view`, `viewport`, `base=none` (an index without `base`), and
`responsive=1`. The host page records `frameMessages`, `viewerErrors`, and
`viewerNavigations`, and `replaceSource()` renders an equal copy of the index.

The `comparison_ui.ts` and `comparison_scroll.ts` helpers read the index,
switch filters and modes, and measure pane, viewport, and region offsets.

Read `mokly-viewer/index.json` to get the immutable `comparisonUrl` and each
removed record's `snapshotId`. Use the canonical `/view/{path}/` route and
`snapshot` query when selecting a historical record. The fixture provides
native comparison data for comparison modes, removed previews, Changed
membership, navigation disclosure, focus, scrolling, and stylesheet Details.
Each spec owns its browser state and assertions; the fixture does not mock
read models or alter responses.

## Watched catalogue cases

`watch_fixture.ts` extends the automatic console-error fixture. Each test owns
a small native catalogue through `serveCatalogue(..., { watch: true })` and
uses the isolated setup budget. Each edit waits for a higher published revision
and the expected catalogue state through `settleLive`. Document keys and DOM
marks distinguish changed previews from retained ones without a shell reload.
The browser leaves the page before the fixture closes its process and directory.
`watch_updates`, `watch_moves`, `watch_folders`, and `watch_shutdown` cover the
watched publication and disclosure cases.

## Native team example

The `team_screens`, `team_components`, `team_links`, `team_pages`, and `team_flow`
specs read the shared Serve example. They do not edit its files. They cover the
HTML team screens, slot components, saved variants, canonical invitation page,
Markdown role guide, YAML flow, and native links in Browse and direct documents.
Each file has at most four cases so Playwright can balance whole files.
