# Comparison browser fixtures

These helpers build the copied catalogues for comparison journeys. Helper
names are relative to `tests/browser/`. See the [browser fixture guide](../README.md)
for current-only delivery and watched Serve fixtures.

## Native comparison copy

`comparison_test.ts` supplies `test`, `copiedComparisonDirectory()`, and
`comparisonPaths`. Import its `test` to use the comparison copy as `baseURL`.
Resolve the directory function in a test or hook, after setup.
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
| `changedPage`          | `pages/handbook`: a changed page with an Action instance and its own `.action` element; it links `actions.css`, whose `.action` rule also changes `components/action`, and its own `styles/handbook.css` with a heading rule and an unresolved `:root` rule                                                                                            |
| `unchangedPage`        | `pages/notes`: an unmodified page whose own `styles/notes.css` changes a rule that matches nothing on it                                                                                                                                                                                                                                               |
| `similarTextPage`      | `pages/guidebook`: a changed page that pairs with `pages/manual` by similar text, so `pages/manual` has no removed record                                                                                                                                                                                                                              |
| `componentPage`        | `pages/catalog`: an unmodified page whose only changed style, `.accent`, reaches it through a `ui-card` instance; a page has no usage records, so Card does not list it                                                                                                                                                                                |
| `pageComponent`        | `components/action`: changed through `actions.css`, which its own documents also link                                                                                                                                                                                                                                                                  |
| `consumingComponent`   | `components/toolbar`: consumes `ui-card`, so it is an affected consumer outside Changes                                                                                                                                                                                                                                                                |
| `component`            | `components/card`: changes through `theme.css` and its own `card.css`, which also changes an unresolved `:root` rule; Usage lists both consumer screens, Toolbar, and the removed `screens/former` as affected                                                                                                                                         |
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

The `comparison_ui.ts` and `comparison_scroll.ts` helpers read the index,
switch filters and modes, and measure pane, viewport, and region offsets.
`comparison_evidence_page.ts` holds the Details copy and readers that the
stylesheet Details specs share. Its readers require one Comparison details
heading and exactly one changed-files list. `openEvidence` also requires the
branch-point sentence, or its absence when a spec passes `null` for an index
without a base. `expectExcludedOnly` checks Details that hold one examined
list and no changed-files list. `configuredStylesheets` and
`pageStylesheets` in `comparison_evidence_groups.ts` name the copy's
stylesheets as the shell shows them.
`comparison_frames.ts` checks every pane frame attribute that the comparison
panes contract requires, on the copied output and in an embedded viewer
through both frame adapters.

Read `mokly-viewer/index.json` to get the immutable `comparisonUrl` and each
removed record's `snapshotId`. Use the canonical `/view/{path}/` route and
`snapshot` query when selecting a historical record. The fixture provides
native comparison data for comparison modes, removed previews, Changed
membership, navigation disclosure, focus, scrolling, and stylesheet Details.
Each spec owns its browser state and assertions; the fixture does not mock
read models or alter responses.

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
`comparisonViewerHost(source)` mounts another copy instead, such as the
branch copy's `branchCopy.directory`.

## Comparison scrolling suites

These suites prove the comparison panes, scrolling, and region pairing
contracts on the native comparison copy and in the embedded comparison viewer.
The shared alignment, input, and Scroll together cases also run on Serve, as
listed in [Viewer journeys on Serve](../README.md#viewer-journeys-on-serve).
`comparison_frames.ts` checks every pane frame attribute against the accepted
generation on each host. `serve_changes_comparison.spec.ts` proves presentation
and renewal on the smaller Serve Changes fixture.

| Suite                                | Cases                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `comparison_alignment.spec.ts`       | Overlay and Difference stacks scroll as one for desktop, mobile, both viewports, and a component, and each pane frame carries the contract's attributes; a shorter document stays aligned past its end; an inner region scrolls every version while the page stays                                                                                                                                                            |
| `comparison_alignment_input.spec.ts` | Side by side mirrors both ways; scroll keys, same-document anchors, and scrolls the viewer did not make move every version; links stay inert while a version loads; smooth-scroll CSS still moves at once                                                                                                                                                                                                                     |
| `comparison_alignment_pages.spec.ts` | A viewport-height hero cannot grow its comparison, fixed bars and sticky headers stay on the viewport edges, and an app shell page moves only its inner region in every version                                                                                                                                                                                                                                               |
| `comparison_alignment_hosts.spec.ts` | In a static build, stacks align, each pane frame carries the contract's attributes, Side by side mirrors, panes stay read-only, and a pane that cannot be presented fails and recovers with Try again; in an embedded viewer through both frame adapters, stacks align, each pane frame carries the contract's attributes, and panes stay read-only, and through the cross-origin adapter a failing pane reports and recovers |
| `comparison_regions.spec.ts`         | Panels move together in Overlay, Difference, Side by side in both directions, and Both; a shorter panel stops at its end                                                                                                                                                                                                                                                                                                      |
| `comparison_regions_pairing.spec.ts` | A named horizontal timeline and the main and Projects panels move together in Overlay and Difference; each pairing rule pairs its panel; ambiguous, `off`, and new panels scroll alone; a component's scrolling list moves in every version                                                                                                                                                                                   |
| `comparison_regions_input.spec.ts`   | Every listed key after a pointer press, focus moving into a panel, a touch drag, a scroll the browser made in the lower version, and anchors through a panel and then the page                                                                                                                                                                                                                                                |
| `comparison_regions_keys.spec.ts`    | Keys from focus, a key falling back to the page at a region's end, right-to-left arrows, and instant two-axis writes under smooth-scroll CSS                                                                                                                                                                                                                                                                                  |
| `removed_previews.spec.ts`           | Space scrolls a previous version while a link holds focus                                                                                                                                                                                                                                                                                                                                                                     |
| `serve_changes_comparison.spec.ts`   | In Serve, a selected comparison presents both versions with their styles and renews them after a watched edit; a removed component opens with only its before side                                                                                                                                                                                                                                                            |

The Scroll together contract names its own suites. In
`packages/viewer/tests/`, `comparison_region_identity.test.ts` proves the
name grammar, roles, accessible names, and fingerprints;
`comparison_region_match.test.ts` proves every pairing rule in order,
uniqueness counts, ineligible picks, and each row of the pairing table; and
`comparison_region_mirror.test.ts` proves caching, reservations, the reverse
pair, and matching afresh after a measurement. The scroll controller unit
tests there prove measurement, key routing including right-to-left regions,
anchors, echoes, and the page mirror.

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
bytes. The case-only entries use no changed styles. The moved parent's folder
has its own page, an unchanged component index. Both hosts below use the
same authored sources. The cases come from `tests/fixtures/branch_point_cases.json`,
the shared set that `crates/mokly-compare/tests/branch_point_cases_tests.rs`
also runs, each case in its own repository.

`addComparisonFixtureSources` composes `addBranchPointSources` with
`addMovedFixtureSources`. The second hook adds the `branch/moves/` entries:
a pure-moved screen, a moved component with distinct variant states and
nested slot inputs, a moved screen with a removed variant, and a moved page.
The branch copy and Serve use this composition. The default copy uses no hook.

Viewer journeys on this copy register shared case modules.
`static_moved_entries.spec.ts` uses the `moved_*_cases.ts` modules that
Serve also runs. `viewer_moved_entries.spec.ts` runs them in an embedded
viewer over this copy through both frame adapters. Each host passes a
`MovedHost` from `moved_rows.ts`, which extends the `EntryHost` of
`entry_hosts.ts`. An `EntryHost` says how the host opens an entry and which
page path it shows for that entry. An embedded host keeps `/viewer.html`, so
a link that leaves the viewer for the standalone shell fails the case. Its
host page gives the viewer the window width. The `compactSearch` marker says
that a narrow window shows the compact search control in place of the field.
The branch-point checks expect the control or the field from that marker,
so a wide embedded viewer fails their mobile runs.
`static_development_mount.spec.ts` serves the `development_shell.ts` bundle
with React's development build.

`BRANCH_POINT_CHECKS` in `branch_point_checks.ts` holds the checks of each
shared case. `branch_point_cases.ts` registers them at desktop and mobile
widths on three hosts: `branch_point_comparison_ui.spec.ts` on this copy,
`viewer_branch_point_comparison_ui.spec.ts` in an embedded viewer over it
through both frame adapters, and `serve_branch_point_comparison_ui.spec.ts`
on one Serve per worker over the shared Serve comparison fixture. Each passes
a `MovedHost`. `branch_viewer_test.ts` serves the embedded viewer to both
embedded specs.

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
| `parent`                           | —                                | unmodified   | no       | The folder's own page, a component index         |
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

## Small comparison copies

`additions_copy_test.ts` supplies `additionsCopyTest(name, additions?, base?)`.
The returned `test` builds its own comparison copy once per worker: the default
catalogue with the source hook, compared with `base` (`fixture-base` unless
given). Its `baseURL` serves that copy, and the worker fixture
`additionsCopy` holds its read-only `directory`. Setup uses the isolated
180,000 ms budget. The default and branch copies keep their membership.
A copy built with base `HEAD` and no hook publishes ready Changes with no
change.

| Hook                         | Entries and evidence                                                                                                                                                                                                                                                                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `addImplementationSources`   | `impact/chip`: own views unchanged, included with the `implementation` reason; `impact/board` sets `urgent` and is only affected                                                                                                                                                                                                          |
| `addLightOnlyCurrentSources` | Light and Dark at the base, Light only now; `schemes/payment-terms` exists on both sides with a light page only                                                                                                                                                                                                                           |
| `addLightOnlyBaseSources`    | Light only at the base, Light and Dark now; `schemes/old-terms` is a removed document with a light page only                                                                                                                                                                                                                              |
| `addImportedCssSources`      | `imported/home`: a JavaScript screen whose CSS Module colour changes and loads a PNG through `url()`; links the repository's `node_modules`, which Git ignores                                                                                                                                                                            |
| `addReactEvidenceSources`    | `react/*`: one React module whose imported sheet changes a Button rule and Checkout's heading rule; a Badge and its consumer Badged in their own module, whose only change is a rule on the renderer's wrapper; a Home screen with nested, repeated and hidden Button instances; links the repository's `node_modules`, which Git ignores |
