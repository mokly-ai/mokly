# Optional Changes In Published Catalogues

## Delivery Status

The repository preview builder publishes current content by default; an option
adds a pinned comparison. [Optional Published Changes](../../plans/optional-published-changes.md)
records verification, and [removed previews](./mokly-removed-previews.md) owns
packaged history. The npm CLI is unchanged. Shell and preview file names use
the [path-derived artifact layout](./mokly-artifact-paths.md).

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

The npm command rebuilds; direct callers build/check first. Capture validates
inputs but does not render or repair output. `mokly export` builds and requests
Changes under [baseline compatibility](./mokly-baseline-compatibility.md).

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
`/__mokly/events` endpoint. On static hosting that URL has the ordinary
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
The repository adapter also rejects prior preview markers as replacement proof
under the [current ownership rule](./mokly-export-safety.md).
The [generated inventory rule](./mokly-export-public-files.md#generated-inventory)
keeps exact generated routes public while private/source names stay denied.
Its owned reservation namespace remains after cleanup, with no active locks.
Each entry's shell is written once at `view/<path>/index.html`; current-only
shell metadata explicitly sets `comparisonUrl: null` and never requests a
development comparison endpoint.

Use the shared confined file enumeration for input fingerprints and public
copying. Resolve each logical path inside the real repository before reading
target bytes or traversing a linked directory. Hash symlink text; unrelated
escaping, dangling, and cyclic links contribute only that metadata and do not
abort publication. Explicit manifest and authoring inputs must resolve to
confined regular files before their bytes are read. Directory walks terminate
when a target repeats in the current ancestor chain, while independent aliases
to the same directory retain their own logical routes.

Copy eligible public file and directory aliases as regular files at their
logical routes. Every copied target must also stay inside the real `mockupsDir`
and pass the shared source/internal-metadata policy. Apply generated-artifact
and staging/destination exclusions to both identities. After copying, validate
the presence of every current page, document, and light/dark screen view
derived from the manifest's paths, independently of the enumerated file list.
Validate every exported
HTML/CSS resource reference against confined regular files in
the staged static tree, including transitive references. An unavailable resource,
including a reference through a skipped cycle or excluded alias, fails before
installation and preserves the previous artifact.
Repository discovery may skip dependency/build directories, but the public walk
must retain valid catalogue routes under names such as `target` and
`node_modules`. Git administrative directories, generated artifacts, protected
inputs, and confined staging/destination paths remain excluded.

## Consistent Publication Snapshot

Include accepted `mokly-generated/styles/` and `mokly-generated/assets/`
routes in publication. Committed mode captures checked disk bytes; derived
mode captures validated compilation bytes, including binary images and fonts,
without enumerating the reserved output tree on disk. Private CSS and
PostCSS-scanned inputs never publish. The CSS/PostCSS inventory pass runs for
freshness before publication; generated links are validated against captured
bytes, including `%40`-encoded scoped asset links. Only the accepted
compilation's CSS and asset routes can enter `static/mokly-generated/` in
derived mode. A missing accepted route fails validation even when a stale disk
copy could satisfy the link. Committed capture uses checked bytes, not a
recompiled replacement.

The preview fingerprints authored inputs and the checked manifest. In derived
mode it compiles once, requires that compilation's manifest to match the
captured one, and uses its generated HTML, CSS and asset bytes for capture.
The fingerprint ignores generated fragments and the entire reserved tree in
derived mode. Before installation, fingerprint again and recompile to reject
changed accepted output bytes. Both passes use the captured manifest's pinned
`sourceFiles` for ownership filtering, even if freshness hydrates a mutable
configuration inventory between them. This does not turn preview into a repair
command for a stale manifest.

Both options begin input capture before loading the current catalogue. Read
the manifest bytes once and hash those exact bytes together with its inventoried
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
