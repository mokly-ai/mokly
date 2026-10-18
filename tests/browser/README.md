# Browser fixtures

Specs import `test` from `browser_test.ts` or one of its host fixtures. The
automatic fixture fails on unexpected console and page errors. Expected
resource failures need an exact message and URL allowance.

Global setup starts the worker Serve hosts and two copied builds together.
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
exactly two commits and a `fixture-base` branch. The fixture builds through
the real shim with `--base fixture-base --strict`. It needs no repository
history, network dependency install, or sidecar. The host receives only the
copied output; the source repository and first output are removed.

| `comparisonPaths` key | Entry and evidence                                                                                                                                                                                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `changed`             | `screens/changed`: changed text and CSS; an unresolved `:root` rule and outside `.accent` matches; a canvas colour on the Before page only; a component consumer; a catalogue link; a shorter Before page and inner scroll panel; a focusable panel link; an anchor whose target reaches the top |
| `unchanged`           | `screens/stable`: light only, unchanged, and outside Changed membership; its one changed stylesheet is excluded                                                                                                                                                                                  |
| `consumer`            | `screens/consumer`: changes only through `ui-card`, so it is an affected consumer outside Changes                                                                                                                                                                                                |
| `added`               | `screens/added`: added by the second commit                                                                                                                                                                                                                                                      |
| `darkOnly`            | `screens/dusk`: a change to a dark-only stylesheet; its Light views stay unmodified                                                                                                                                                                                                              |
| `component`           | `components/card`: CSS change; Usage lists both consumer screens as affected                                                                                                                                                                                                                     |
| `changedVariant`      | `components/card/featured`: a surviving variant whose props changed                                                                                                                                                                                                                              |
| `addedVariant`        | `components/card/fresh`: a variant added by the second commit                                                                                                                                                                                                                                    |
| `quietParent`         | `components/tag`: an unmodified parent; every tag view is taller than its frame                                                                                                                                                                                                                  |
| `quietSibling`        | `components/tag/plain`: an unmodified variant                                                                                                                                                                                                                                                    |
| `quietVariant`        | `components/tag/bold`: a changed variant of the unmodified parent                                                                                                                                                                                                                                |
| `quietRemoved`        | `components/tag/old`: a removed variant of the unmodified parent                                                                                                                                                                                                                                 |
| `removedScreen`       | `screens/retired`: historical screen in both viewports and schemes                                                                                                                                                                                                                               |
| `removedPage`         | `pages/retired`: historical full HTML page with links, a form, and a tall body                                                                                                                                                                                                                   |
| `removedDocument`     | `notes/retired`: historical Markdown document                                                                                                                                                                                                                                                    |
| `removedComponent`    | `components/retired`: removed component parent                                                                                                                                                                                                                                                   |
| `removedVariant`      | `components/card/archived`: removed variant of a surviving component                                                                                                                                                                                                                             |

The `comparison_ui.ts` and `comparison_scroll.ts` helpers read the index,
switch filters and modes, and measure pane, viewport, and region offsets.

Read `mokly-viewer/index.json` to get the immutable `comparisonUrl` and each
removed record's `snapshotId`. Use the canonical `/view/{path}/` route and
`snapshot` query when selecting a historical record. The fixture provides
native comparison data for comparison modes, removed previews, Changed
membership, navigation disclosure, focus, scrolling, and stylesheet Details.
Each spec owns its browser state and assertions; the fixture does not mock
read models or alter responses.
