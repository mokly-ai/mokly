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

A build captures one validated in-memory render: every view, page, and
document, the bundled CSS, the opaque assets, the catalogue model, and the
authored closure, all from the render cache. Nothing on disk is read back. The
stylesheet freshness pass and the scoped npm URL checks apply.

Fingerprint the [inventoried](./mokly-source-protection.md#complete-source-inventory) inputs before rendering: the sources, the
configuration, the renderer module, the configured stylesheets, and the
authored closure, including every inventoried helper even beneath an otherwise
excluded `.context` directory. Use the shared confined file enumeration for
that fingerprint, not public copying. Resolve each logical path inside the
real repository before reading target bytes or traversing a linked directory.
Hash symlink text; unrelated escaping, dangling, and cyclic links contribute
only that metadata and do not abort the build. Explicit authoring inputs must
resolve to confined regular files before their bytes are read. Directory walks
end when a target repeats in the current ancestor chain; independent aliases
to the same directory still contribute their own logical fingerprint paths.

Exclude the active stage and the destination from input enumeration by their
canonical paths as well as by the usual output rules. This keeps the build's
own writes out of its input digest when `.context` or a parent directory is an
in-repository symlink. Explicit inventoried authoring inputs stay included
even when directory enumeration excludes their location.

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

Fingerprint again after rendering, comparison, and resource capture and before
installing the stage. A changed fingerprint fails the build and preserves the
earlier output. Default publication performs the same filesystem consistency
checks without consulting Git.

Changes-enabled publication continues in
[Publication Changes And Acceptance](./mokly-publication-changes.md);
imported CSS capture follows the
[imported-styles contract](./mokly-imported-styles.md).
