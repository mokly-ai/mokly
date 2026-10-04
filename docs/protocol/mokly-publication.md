# Optional Changes In Published Catalogues

## Delivery Status

The repository preview builder publishes current content by default; an option
adds a pinned comparison. [Optional Published Changes](../../plans/optional-published-changes.md)
records verification, and [removed previews](./mokly-removed-previews.md) owns
packaged history. The npm CLI is unchanged.

## Publication Option

Extend the existing repository-only preview builder with these commands:

```bash
npm run preview:build
npm run preview:build -- --include-changes
npm run preview:build -- --include-changes --base origin/main
```

The existing `--out <path>` option, output default, and ownership restrictions
remain supported. Accept options in any order;
reject unknown or repeated options, missing values, and `--base` without
`--include-changes` before loading consumer code or changing output.

Output must be a strict descendant of `.context` both lexically and after
resolving symlinks. The resolved context directory and output must stay within
the real `repoRoot`, including existing ancestors of a new output path. Reject
escapes before creating staging directories or replacing output. In-repository
context and parent symlinks remain supported; an ownership marker never permits
an outside-root destination.

The internal `buildPreview(config, output, options)` boundary receives:

```ts
type PublicationOptions =
  | { includeChanges?: false; base?: never }
  | { includeChanges: true; base?: string };
```

Omitting options is equivalent to `{ includeChanges: false }`. Validate the
same contract for JavaScript callers. With changes enabled, `base` overrides
`config.review.base`, whose existing default is `origin/main`. Git availability,
branch names, and an existing review configuration never enable the option
implicitly. This extends the repository script, not the npm package CLI.

Publication capture compiles and validates in memory; it never writes the
consumer generated tree. The repository npm wrapper explicitly builds tooling
and the example before capture. Direct callers need no local generated tree;
source inventory and input stability are checked by the capture boundary.
Consumer `mokly export` also compiles in memory and includes Changes by default.

## Current Catalogue By Default

Publish the current home, catalogue routes, resources, metadata, search, tags,
folder hierarchy, and not-found page. Preserve screen viewport/color selection
and page rendering.

Omit All/Changes controls and counts, screen comparison controls, removed-entry
rows and previous-version pages, comparison JSON, and baseline
snapshots/resources. Do not resolve Git history, compute changes, read baseline
output, or initialize a comparison provider. Publication must succeed from a valid source archive
without `.git` or a configured base ref.

Pass an explicit publication capability to the capture server and shell so
their development defaults cannot re-enable review. Stored preferences and
direct links requesting Changes or a comparison fall back to All/Current while
preserving the valid route, viewport, color scheme, and fragment. Comparison
endpoints return the ordinary not-found response and never generate output.
The browser sends no change/comparison requests.

In both publication options, strip the watched-server live-update entrypoint
from every captured shell page and omit its watch-only assets. Keep the browser
modules needed for ordinary navigation and optional comparison controls. Never
start an EventSource, poll for development updates, or publish/redirect an
`/mokly-viewer/events` endpoint. On static hosting that URL has the ordinary
not-found response. This preserves the existing static-export invariant, also
for home, missing-route, and removed-entry pages.

Existing generated comparison directories, including configured review output,
must stay excluded from public asset copying. Building over a previous export
with comparisons replaces the complete owned artifact transactionally, removing
obsolete review files; never leave them reachable through a previous
generation or stale asset copy.

Both publication options use the consumer exporter's shared output transaction,
deployment identity over non-marker files other than declared publication
metadata, finalized ownership inventory, and alias/reference validation.
The destination must retain its captured identity until installation; an unowned
replacement is preserved, including one introduced during capture. Retain the
writer reservation, OS-enforced non-replacing moves, and safe backup recovery
defined by the [export recovery contract](./mokly-export-recovery.md).
Only the repository adapter may migrate the prior preview ownership marker.
Migration retains valid generated routes beneath names such as `target` and
`node_modules`, while private/source names remain disallowed. This does not
make other files under those directories public.
Its owned reservation namespace remains after cleanup, with no active locks.
Each entry's shell is written once at its derived `view/<route>`; current-only
shell metadata explicitly sets `comparisonUrl: null` and never requests a
development comparison endpoint.

Use the shared confined file enumeration for input fingerprints, not public
copying. Resolve each logical path inside the real repository before reading
target bytes or traversing a linked directory. Hash symlink text; unrelated
escaping, dangling, and cyclic links contribute only that metadata and do not
abort publication. Explicit manifest and authoring inputs must resolve to
confined regular files before their bytes are read. Directory walks terminate
when a target repeats in the current ancestor chain; independent aliases to
the same directory still contribute their own logical fingerprint paths.

Copy compiled current documents under `static/mokly-generated/` and exactly the
manifest's referenced authored closure under `static/` as regular files;
never publish a directory merely because it is under `mockupsDir`. Each
selected closure file must be a confined regular file outside `mokly-generated/`,
not a symlink or protected input; apply staging/destination exclusions to
both logical and resolved identities. Validate the presence of every current
page and light/dark screen fragment named by the manifest. Validate every
exported HTML/CSS resource reference against confined regular files in the
staged static tree, including transitive references. An unavailable resource
fails before installation and preserves the previous artifact. Repository
discovery can skip dependency/build directories for inputs; publication never
uses a directory-based public walk. Git administrative directories, protected
inputs, and confined staging/destination paths stay excluded.

## Consistent Publication Snapshot

Capture one validated in-memory compilation, including generated HTML, CSS,
opaque assets, manifest and authored closure. No local generated tree is read or
written. A missing accepted route fails even if disk output contains it.
The CSS/PostCSS inventory freshness pass and scoped npm URL checks remain required.
Fingerprint exact generated bytes and authored inputs; include every inventoried
helper even beneath otherwise excluded `.context` directories. Recompile and
fingerprint before installation; any input or byte drift aborts capture.

Both options begin input capture before loading the current catalogue. Use
the compilation's manifest bytes and hash them together with its inventoried
inputs and public resources. Include inventoried helpers even beneath otherwise
excluded `.context` directories. Construct one validated catalogue snapshot
from that captured manifest and use it for the capture server, page capture
list, and resource adaptation. When Changes is enabled, compute its
changed-entry impact and removed-entry metadata from that exact current
manifest and the pinned Git baseline. The
capture server must not independently reload the manifest.

Exclude the active staging directory and destination from input enumeration by
their canonical paths as well as the usual generated-artifact rules. This keeps
publication's own writes out of its input digest when `.context` or a parent
directory is an in-repository symlink. Explicit inventoried authoring inputs
remain included even when directory enumeration excludes their location.

Fingerprint again after capturing pages, comparisons, and public resources and
before installing the staged artifact. A changed fingerprint fails publication
and preserves the previous artifact. A completed rebuild before the initial
fingerprint belongs wholly to the new snapshot; a rebuild after it must not
produce mixed navigation, missing pages, or stale shell metadata. Default
publication performs the same filesystem consistency checks without consulting
Git.

Changes-enabled publication continues in
[Publication Changes And Acceptance](./mokly-publication-changes.md);
imported CSS capture follows the
[imported-styles contract](./mokly-imported-styles.md).
