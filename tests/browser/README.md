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

## Deployment replacement

`static_deployment.spec.ts` hosts two immutable copies. The static host's root
callback selects the published copy once per request, before filesystem work.
Publication changes that selection in one synchronous step. Pending requests
keep their selected copy until teardown. The deployment test keeps its reload,
history, frame-content, request-status, and browser-error assertions.

`tests/static_server_deployment.test.ts` holds an old request while a request
for the replacement copy completes. Both must return their selected file.

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

## Branch-point delivery copy

`branch_point_test.ts` supplies `test`, the worker fixture `branchCopy`, and
`branchPointPaths`. Its `baseURL` serves a separate comparison copy. Use
`branchCopy.directory` for byte assertions. The source repository is removed
before requests start. The copy is read-only.

`createComparisonCatalogue(root, additions?)` calls the optional source hook
before each of its two commits. The default catalogue has no extra entries.
`addBranchPointSources` adds five namespaced cases under `branch/`: moved
screen and component consumers, a moved parent with a removed sibling, a
transferred variant, case-only renames, and a document that reuses a removed
component's path. The moved consumers also retain distinct base and head SVG
bytes. The case-only entries use no changed styles. Both hosts below use the
same authored sources.

`addComparisonFixtureSources` composes `addBranchPointSources` with
`addMovedFixtureSources`. The second hook adds the `branch/moves/` entries:
a pure-moved screen, a moved component with distinct variant states and
nested slot inputs, a moved screen with a removed variant, and a moved page.
The branch copy and Serve use this composition. The default copy uses no hook.

The table pins every branch entry at the original fixture base. Both path
columns are relative to `branch/`. Each row has Changes status `ready`.
A pure move is included even when its kind is `unmodified`.

| Path                               | Previous path                    | Changes kind | Included | Evidence                                         |
| ---------------------------------- | -------------------------------- | ------------ | -------- | ------------------------------------------------ |
| `consumers/badge`                  | —                                | changed      | yes      | Changed component text and SVG resource          |
| `consumers/badge/default`          | —                                | changed      | yes      | Same implementation change in a saved variant    |
| `consumers/archive/status`         | `consumers/status`               | changed      | yes      | Moved component consumer                         |
| `consumers/archive/status/default` | `consumers/status/default`       | changed      | yes      | Moved saved consumer                             |
| `consumers/archive/receipt`        | `consumers/receipt`              | changed      | yes      | Moved screen consumer                            |
| `parent/archive/action`            | `parent/action`                  | unmodified   | yes      | Moved parent with its own unchanged view         |
| `parent/archive/action/primary`    | `parent/action/primary`          | changed      | yes      | Continue becomes Submit                          |
| `parent/action/secondary`          | —                                | removed      | yes      | Former parent title Action                       |
| `variant/donor`                    | —                                | unmodified   | no       | Surviving donor parent                           |
| `variant/donor/spare`              | —                                | unmodified   | no       | Retained donor variant                           |
| `variant/receiver`                 | —                                | unmodified   | no       | Surviving receiver parent                        |
| `variant/receiver/default`         | —                                | unmodified   | no       | Retained receiver variant                        |
| `variant/receiver/primary`         | `variant/donor/primary`          | changed      | yes      | Transferred variant with changed props           |
| `case/receipt`                     | —                                | changed      | yes      | Case-only screen rename                          |
| `case/action`                      | —                                | changed      | yes      | Case-only parent rename                          |
| `case/action/primary`              | —                                | changed      | yes      | Case-only variant rename with changed props      |
| `case/Action/secondary`            | —                                | removed      | yes      | Former parent title Case action                  |
| `reused/action`                    | —                                | added        | yes      | Document replaces the component path             |
| `reused/action/default`            | —                                | removed      | yes      | Former parent title Former action                |
| `moves/current/receipt`            | `moves/previous/receipt`         | unmodified   | yes      | Pure-moved screen                                |
| `moves/current/action`             | `moves/previous/action`          | unmodified   | yes      | Moved component parent                           |
| `moves/current/action/primary`     | `moves/previous/action/primary`  | unmodified   | yes      | Unmodified moved variant                         |
| `moves/current/action/ghost`       | `moves/previous/action/ghost`    | changed      | yes      | Description-only variant change                  |
| `moves/current/action/iconic`      | `moves/previous/action/iconic`   | changed      | yes      | Nested glyph input changes from arrow to chevron |
| `moves/previous/action/secondary`  | —                                | removed      | yes      | Former parent title Action                       |
| `moves/current/invoice`            | `moves/previous/invoice`         | changed      | yes      | Changed due text after a screen move             |
| `moves/current/invoice/overdue`    | `moves/previous/invoice/overdue` | unmodified   | yes      | Retained screen variant                          |
| `moves/previous/invoice/paid`      | —                                | removed      | yes      | Former parent title Invoice                      |
| `moves/current/guide`              | `moves/previous/guide`           | unmodified   | yes      | Pure-moved full HTML page                        |
| `moves/icon`                       | —                                | unmodified   | no       | Shared nested input target                       |
| `moves/ring`                       | —                                | unmodified   | no       | Slot container for the glyph                     |

## Shared Serve comparison fixture

Import `test` from `serve_comparison_test.ts` for viewer Changes journeys.
Each test gets a private `changes` fixture and its URL as `baseURL`. It owns
a two-commit Git repository, a `fixture-base` branch, a watcher, and real
comparison generations. It waits for ready Changes at the pinned base.
The `comparisonPaths` entries and both additive source hooks are available.
The existing `serve_changes_fixture.ts` remains the smaller engine fixture.

| API                                                              | Purpose                                                                               |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `changes.paths`                                                  | Named paths from `comparisonPaths`, `branchPointPaths`, and `movedFixturePaths`       |
| `changes.url`, `changes.root`                                    | Loopback origin and private source directory                                          |
| `changes.baseCommit`, `changes.headCommit`                       | Independent base and head commit IDs                                                  |
| `await changes.index()`                                          | Read and validate the current catalogue index                                         |
| `await changes.ready(afterRevision?, expectedBase?, predicate?)` | Wait for a newer ready publication and the optional semantic predicate                |
| `await changes.edit(relativeFile, text, predicate?)`             | Atomically replace one source and wait for its accepted semantic state                |
| `await changes.commitBase(files, parent = "base")`               | Create a commit through a temporary index; values are text or `null` to remove a file |
| `await changes.moveBase("head" \| "base" \| commit)`             | Switch the private ref to a fixture alias or commit and wait for its merge base       |
| `await changes.close()`                                          | Drain Serve before removing the repository; safe to repeat                            |

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

The `changed` screen has a matched `.accent` rule from `theme.css`, an
unresolved root rule, and native component usage. Read `comparisonUrl` from
the index for removed records. Use `/mokly-viewer/diffs/review.json?path={path}`
for live selected comparisons, and add `&refresh=1` for an explicit refresh.
The test fixture closes automatically. It permits watched edits and base-ref
moves without sharing writable state with another test.

Branch-point copy setup and Serve comparison setup use the isolated
180,000 ms fixture budget. Test bodies keep the normal 60,000 ms timeout.

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
