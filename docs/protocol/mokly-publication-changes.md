# Publication Changes And Acceptance

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

Continuation of [Optional Changes In Publication](./mokly-publication.md).

## Explicitly Include Changes

A static build that includes Changes delivers the All/Changes navigation and
the comparison controls, including a zero changed count, from the data of
the [catalogue index](./mokly-shell-delivery.md#catalogue-index):
`changesStatus`, `comparisonUrl`, each entry's `changes`, and
`removedEntries`. Current and removed entries never share a path; an entry
the [move contract](./mokly-moves.md) pairs stays current, labelled Moved,
with no removed row. Removed screens show their Removed badge and no
comparison controls and open their previous version under
[removed previews](./mokly-removed-previews.md); removed component entries
open their comparison with an explicit missing current side. Removed pages
and documents keep their flat Changes rows and previous versions from the
[catalogue change snapshot](./mokly-catalogue-changes.md), including after
their parents were deleted. Pages and documents have no visual comparisons.

The build resolves the effective base and `HEAD` once and pins their merge
base for both entry impact and view comparisons. The head side renders from
the working tree, or from the tracked files of the checked-out commit for
`publish`, and the base side from the base commit under
[Sides](./mokly-comparison.md#sides); base dependencies follow the three
tiers. One generation renders every view of both sides and compares them; a
source change during the build fails the build instead of mixing
generations. The index records the base ref in `base` and the review result
its `baseCommit`. `publish` requires the clean checkout of the
[upload contract](./mokly-upload.md).

The build packages the generation under its immutable path:

```text
mokly-viewer/diffs/generations/<generation>/review.json
mokly-viewer/diffs/generations/<generation>/entries/<path>.json
```

It holds the review result v8, one detail per removed entry, the documents of
both sides of every compared view, each removed entry's documents, and their
transitive resource closure. The index's `comparisonUrl` names
`review.json`. A diff selection in the browser loads the packaged result;
refresh and retry reuse it. Later commits or a changed base ref do not update
a published artifact; only a new build replaces it. Generation files carry no
deployment id, so one comparison gives the same bytes in every build.

Missing history, including a shallow clone without the merge base, fails the
build before any output is written. A base whose sources fail current
validation completes the build with Changes unavailable,
`comparisonUrl: null`, no removed entries, and those diagnostics. A render or
comparison failure fails the build and keeps the installed output under the
[static build contract](./mokly-export.md). Both options apply the
[source protection](./mokly-source-protection.md) rules and the output safety
rules of the static build contract.

## Workflows And Presentation

The option is chosen when the build runs; a visitor cannot turn omitted
review data on, and a build without Changes carries `comparisonUrl: null`,
`changesStatus: "disabled"`, and no generation. The repository's preview
deployments choose the option per job under the
[preview deployment contract](./npm-preview-deployments.md). Serve keeps its
Git-aware Changes and on-demand comparisons. The shell is the same component
tree in every host; it enables the controls from the index's data, never
from an environment label or a separate shell. The design mockups cover the
catalogue with review omitted and with review included at mobile and desktop
widths.

## Acceptance

Test the default and explicit options through the CLI, including invalid
arguments and configured, default, and overridden bases. Prove that a build
without Changes performs no Git or comparison work and succeeds without
comparison history, while `publish` still checks the checkout state and needs
a committed `HEAD`.

Test removed-entry absence without Changes, excluded stale comparison files
when a build with Changes replaces one without and the reverse, rollback,
unavailable and advancing bases, a base whose sources fail validation, a
source change during the build, and comparisons that stay unchanged after
publication.
Browser tests cover the controls, persisted preferences, direct links, search
and tags, anchors, Back/Forward, zero-change review, and no comparison
request by default, at mobile and desktop widths. Parameterize static tests
over both options: no live descriptor, no event stream connection or polling
request, and no events route. Test the home, current, not-found, and
removed-entry routes while proving that ordinary navigation and comparison
loading work. Verify that the index, the details, and the generation agree,
and that a failed build keeps the installed output.
