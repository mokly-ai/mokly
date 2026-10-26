# Optional Changes In Published Catalogues

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Publication Option

A published catalogue is the output of `mokly build`, deployed by the consumer
or uploaded by `mokly publish`. Changes is part of it unless the build is
current-only:

```bash
npx mokly build
npx mokly build --no-changes
npx mokly build --base origin/main
npx mokly publish --no-changes
```

`build` and `publish` include Changes by default. `--no-changes` writes a
current-only build. `--base <ref>` overrides `review.base`, whose default is
`origin/main`. Options are accepted in any order; an unknown or repeated
option, a missing value, and `--base` together with `--no-changes` fail as
`cli-invalid` before consumer code is loaded or the output is touched. Git
availability, branch names, and a configured review base never make a build
current-only by themselves, and a build with Changes requires a Git checkout
with `HEAD`, the base, and their merge base under the
[static build contract](./mokly-export.md#changes-in-the-output). A source
archive without `.git` builds with `--no-changes`. The output directory
follows the `--out` rules of that contract, and `publish` builds into its own
private directory outside the repository.

The repository preview deployment uses the same option: the `main` deployment
builds current-only, and a pull request preview builds with Changes against
`origin/main`, under the [preview deployment contract](./npm-preview-deployments.md).

## Current-Only Builds

A current-only build writes the home, every catalogue route, the resources,
metadata, search, tags, the folder hierarchy, and the not-found stub, and
keeps screen viewport and colour-scheme selection and page rendering.

It omits the All/Changes controls and counts, the screen comparison controls,
removed-entry rows and their historical views, the comparison generation, and
every base snapshot and resource. The index carries
`changesStatus: "disabled"`, `comparisonUrl: null`, no `base`, and an empty
`removedEntries`; every view's `comparison` has `status: "disabled"`. The
build resolves no Git history, computes no changes, renders no base side, and
starts no comparison. It succeeds from a valid source archive without `.git`
and without a configured base ref.

The shell derives its capability from the index, so no development default can
re-enable review. Stored preferences and direct links that request Changes or
a comparison fall back to All and Current while preserving the valid route,
viewport, colour scheme, and fragment. The browser sends no change or
comparison request, and there is no comparison URL to request.

In both options the output has no event stream, no live descriptor, and no
control route, and the stub is the same document. The shell never starts an
`EventSource`, never polls for development updates, and never requests
`/mokly-viewer/events` or `/mokly-viewer/live.json`; on static hosting those
URLs are ordinary missing files. This holds for the home, the missing-route,
and the removed-entry routes alike.

Building over an earlier output that holds a comparison replaces the complete
owned output transactionally and removes the obsolete generation files; they
are never left reachable through an earlier generation or a stale copy.

Both options use the shared output transaction, the deployment identity over
every non-marker file other than declared publication metadata, the finalized
ownership inventory, and reference validation. The destination must keep its
captured identity until installation; an unowned replacement is preserved,
including one introduced during capture. The writer reservation, the
OS-enforced non-replacing moves, and the safe backup recovery follow the
[recovery contract](./mokly-export-recovery.md). The
[output inventory rule](./mokly-export-public-files.md#output-inventory) keeps
exact rendered routes public while protected source names stay denied. The
owned reservation namespace stays after cleanup, with no active lock. Each
entry's stub is written once at `view/<path>/index.html`.

## Consistent Publication Snapshot

A build captures one validated immutable render: every view, page, and
document, the bundled CSS, the opaque assets, the catalogue model, and the
authored closure. Generated resources follow the shared
[delivery contract](./mokly-imported-styles-assets.md#validation-and-the-render-cache).
Installed output is never read back. The stylesheet freshness pass and the
scoped npm URL checks apply.

The fingerprint boundary, source capture, and final live recheck follow
step 3 of the [Output Transaction](./mokly-export.md#output-transaction).

Construct one catalogue model from that fingerprinted input set and use it for
the index, the details, the route list, and resource selection. When Changes
is included, compute its changed-entry impact and removed-entry metadata from
that exact model and the pinned merge base; the comparison never reloads the
model independently.

Write rendered documents under `static/mokly-generated/` and exactly the
referenced authored closure under `static/` as regular files; never publish a
directory merely because it is under a configured root. Each selected closure file
must be a confined regular file, not a symlink or a protected input; apply the
stage and destination exclusions to both logical and resolved identities.
Validate the presence of every current page, document, and light and dark view
that the index names. Validate every written HTML and CSS resource reference
against confined regular files in the staged `static/` tree, including
transitive references. An unavailable resource fails before installation and
preserves the earlier output. Discovery can skip dependency and build
directories for inputs; the build never uses a directory-based public walk.
Git administrative directories, protected inputs, and the stage and
destination paths stay excluded.

Imported CSS capture follows the
[imported-styles contract](./mokly-imported-styles.md).

## Builds With Changes

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
the working tree, which `publish` requires to be a clean checkout of
`headSha`, and the base side from the base commit under
[Sides](./mokly-comparison.md#sides); base dependencies follow the three
tiers. One generation renders every view of both sides and compares them
under the [Output Transaction](./mokly-export.md#output-transaction). The index records the base ref in `base` and the pinned merge base in
`baseCommit`. `publish` requires the clean checkout of the
[upload contract](./mokly-upload.md).

Missing history, including a shallow clone without the merge base, fails the
build before any output is written. Historical failures follow the
[base failure policy](./mokly-base-preparation.md#shared-render-runtime).
Recoverable failures complete with Changes unavailable, `comparisonUrl: null`,
no removed entries, and their diagnostics. A render or
comparison failure on the current side fails the build. It keeps the installed
output under the
[static build contract](./mokly-export.md). Both options apply the
[source protection](./mokly-source-protection.md) rules and the output safety
rules of the static build contract.

The shell enables the controls from the index's data, never from an
environment label or a separate shell; the design mockups cover the
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
