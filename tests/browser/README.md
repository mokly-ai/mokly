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

### Viewer journeys on Serve

`serve_comparison_ui.ts` holds the shared viewer actions. Its waits follow a
selected comparison request through the redirect to its generation before UI
deadlines apply. It also records requests to the stable endpoint and holds
the HEAD renewal of a selected generation. `serve_changes_emulation.ts`
rewrites the index body into a pending, preparing, or unavailable Changes
state, the shape Serve writes before classification completes. Each step
still arrives as a real watched publication, and Serve keeps no test seam.
Specs that run the same comparison checks on the copied output and on Serve
register them from a `*_cases.ts` module.

A spec adds its own sources to both commits with
`test.use({ comparisonSources: { add: hook } })`. The hook runs after the
shared hooks; the option is unset by default. The object wrapper is needed
because `test.use` reads a function value as a fixture.
`tests/helpers/viewer_state_sources.ts` supplies `addViewerStateSources` and
`viewerStatePaths` for the viewer-state journeys:

| `viewerStatePaths` key | Entry and evidence                                                      |
| ---------------------- | ----------------------------------------------------------------------- |
| `variantParent`        | `viewer/home`: unmodified screen parent with variants                   |
| `quietScreenVariant`   | `viewer/home/empty`: unmodified screen variant                          |
| `changedScreenVariant` | `viewer/home/error`: screen variant whose props changed                 |
| `removedScreenVariant` | `viewer/home/gone`: removed screen variant of the unmodified parent     |
| `chip`                 | `viewer/chip`: unmodified component parent                              |
| `plainChip`            | `viewer/chip/plain`: unmodified component variant                       |
| `nightChip`            | `viewer/chip/night`: only its Dark views change, through a dark sheet   |
| `removedConsumer`      | `viewer/legacy`: removed screen that used Card, an affected consumer    |
| `lightOnlyChanged`     | `viewer/pale`: light-only screen whose body changed                     |
| `lightOnlyRemoved`     | `viewer/faded`: light-only removed screen                               |
| `fragmentPage`         | `viewer/handbook`: unchanged page with an `#overview` anchor and a link |

Branch-point copy setup and Serve comparison setup use the isolated
180,000 ms fixture budget. Test bodies keep the normal 60,000 ms timeout.
