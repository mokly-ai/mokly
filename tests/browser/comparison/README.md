# Comparison browser fixtures

These helpers build the copied catalogues for comparison journeys. Helper
names are relative to `tests/browser/`. See the [browser fixture guide](../README.md)
for how to run a spec, current-only delivery, and watched Serve fixtures.

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

`comparisonPaths` in
[`comparison_catalogue.ts`](../../helpers/comparison_catalogue.ts) names every
entry of the copy. That file and the entry groups of
[`comparison_entry_groups.ts`](../../helpers/comparison_entry_groups.ts),
[`comparison_evidence_groups.ts`](../../helpers/comparison_evidence_groups.ts),
and [`comparison_scroll_groups.ts`](../../helpers/comparison_scroll_groups.ts)
write the sources of each entry on both commits.
[`comparison_fixture_membership.ts`](../comparison_fixture_membership.ts)
pins the expected Changes state of each entry, the moved pairs, and the
removed paths.

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

These suites cover the comparison panes, scrolling, and region pairing
contracts on the native comparison copy and in the embedded comparison viewer.
The shared alignment, input, and Scroll together cases also run on Serve, as
listed in [Viewer journeys on Serve](../README.md#viewer-journeys-on-serve).
The browser cases live in the `comparison_alignment*.spec.ts` and
`comparison_regions*.spec.ts` specs, `removed_previews.spec.ts`, and
`serve_changes_comparison.spec.ts`, which runs on the smaller Serve Changes
fixture. `comparison_frames.ts` checks every pane frame attribute against the
accepted generation on each host. The `comparison_region_*.test.ts` unit tests
in `packages/viewer/tests/` cover region identity, pairing, and mirroring.

## Branch-point delivery copy

`branch_point_test.ts` supplies `test` and the worker fixture `branchCopy`.
Its `baseURL` serves a separate comparison copy. Use `branchCopy.directory`
for byte assertions. The source repository is removed before requests start.
The copy is read-only. Import the named case paths, `branchPointPaths`, from
`tests/helpers/branch_point_sources.ts`.

`createComparisonCatalogue(root, additions?)` calls the optional source hook
before each of its two commits. The default catalogue has no extra entries.
`addBranchPointSources` adds the shared branch-point cases of
[`tests/fixtures/branch_point_cases.json`](../../fixtures/branch_point_cases.json)
under `branch/`. `crates/mokly-compare/tests/branch_point_cases_tests.rs` runs
the same cases, each in its own repository. `addComparisonFixtureSources`
composes `addBranchPointSources` with `addMovedFixtureSources`, which adds the
`branch/moves/` entries of
[`moved_fixture_sources.ts`](../../helpers/moved_fixture_sources.ts). The branch
copy and Serve use this composition. The default copy uses no hook.
[`comparison_fixture_membership.ts`](../comparison_fixture_membership.ts)
pins the expected Changes state and the previous path of every branch entry.

Viewer journeys on this copy register shared case modules.
`static_moved_entries.spec.ts` uses the `moved_*_cases.ts` modules that
Serve also runs. `viewer_moved_entries.spec.ts` runs them in an embedded
viewer over this copy through both frame adapters. Each host passes a
`MovedHost` from `moved_rows.ts`, which extends the `EntryHost` of
`entry_hosts.ts`. An `EntryHost` says how the host opens an entry and which
page path it shows for that entry.
`static_development_mount.spec.ts` serves the `development_shell.ts` bundle
with React's development build.

`BRANCH_POINT_CHECKS` in `branch_point_checks.ts` holds the checks of each
shared case. `branch_point_cases.ts` registers them at desktop and mobile
widths on three hosts: `branch_point_comparison_ui.spec.ts` on this copy,
`viewer_branch_point_comparison_ui.spec.ts` in an embedded viewer over it
through both frame adapters, and `serve_branch_point_comparison_ui.spec.ts`
on one Serve per worker over the shared Serve comparison fixture. Each passes
a `MovedHost`. The checks read its `BranchPointHost` part, which keeps the
`EntryHost` path check and says when comparisons are captured.
`branch_viewer_test.ts` serves the embedded viewer to both embedded specs.

## Small comparison copies

`additions_copy_test.ts` supplies `additionsCopyTest(name, additions?, base?)`.
The returned `test` builds its own comparison copy once per worker: the default
catalogue with the source hook, compared with `base` (`fixture-base` unless
given). Its `baseURL` serves that copy, and the worker fixture
`additionsCopy` holds its read-only `directory`. Setup uses the isolated setup
budget. The default and branch copies keep their membership. A copy built with
base `HEAD` and no hook publishes ready Changes with no change.

The source hooks live in `tests/helpers/`:
[`implementation_sources.ts`](../../helpers/implementation_sources.ts),
[`light_only_sources.ts`](../../helpers/light_only_sources.ts),
[`imported_css_sources.ts`](../../helpers/imported_css_sources.ts), and
[`react_evidence_sources.ts`](../../helpers/react_evidence_sources.ts). The
imported CSS and React evidence hooks link the repository's `node_modules`,
which Git ignores.
