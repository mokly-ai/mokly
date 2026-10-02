# Optional Changes In Published Catalogues

## Delivery Status

The repository preview builder publishes current content by default; an option
adds a pinned comparison. [Optional Published Changes](../../plans/optional-published-changes.md)
records verification, and [removed previews](./mokly-removed-previews.md) owns
packaged history. The npm CLI is unchanged. Shell and preview file names follow
the path-derived layout of the
[path identity plan](../../plans/path-identity.md); the current builder derives
them from kind and id.

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
Only the repository adapter may migrate the prior preview ownership marker.
Migration retains valid public routes beneath build-directory names such as
`target` and `node_modules`, while private/source names remain disallowed.
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

## Explicitly Include Changes

With `--include-changes`, publish the existing All/Changes navigation and screen
comparison controls, including a zero changed count. Retain removed-screen
metadata, previous-version pages, and comparisons. Current and removed entries
never share a path; an entry the [move contract](./mokly-moves.md) pairs stays
current, labelled Moved, with no removed row.
Render those removed screens with their Removed badge and no comparison
controls. Publication packages their baseline views and advertises the
descriptor defined by [removed previews](./mokly-removed-previews.md), which the
shell resolves into the previous version.
Include page and document impact and removed page and document states from the
[shared catalogue snapshot](./mokly-catalogue-changes.md), including flat
Changes rows after deleting their parents and each removed page's or
document's packaged preview. Pages and documents have no visual comparisons;
screen metadata remains supported.

Resolve the effective base and HEAD once, then pin their merge-base commit for
both entry impact and screen comparisons. Capture the current catalogue,
generated documents, and resources consistently for that build; fail if inputs
change during capture rather than mix revisions. Record the resolved comparison
baseline with the exported review metadata. The artifact represents the files
captured at publication time, including any permitted uncommitted input, rather
than claiming that HEAD alone identifies those bytes.

Package validated comparison data and isolated resources under the existing
immutable generation path. Browser diff selection loads the packaged result;
refresh/retry uses that same result. Later Git commits or changes to the base
ref do not update a published artifact. Only a new publication replaces it.
After that generation path is known, repository publication uses the consumer
exporter's typed removed-preview descriptor builder and adds each descriptor to
the matching captured static shell. This artifact-only step does not advertise
page paths from the development server used during capture.

Missing history, an invalid v8 baseline, capture inconsistency, or comparison
failure aborts publication and preserves previous output. Recognized earlier
output instead completes with Changes unavailable under the
[baseline compatibility contract](./mokly-baseline-compatibility.md). Preserve
source protection, snapshot isolation, resource confinement, and sandbox rules.
Both options apply the
[shared source policy](./mokly-source-protection.md), including unimported
reserved files and complete config/consumer input inventories.

## Workflows And Presentation

The existing `main` preview job uses the default command. The PR preview job
explicitly passes `--include-changes --base origin/main`, retaining its current
review purpose and full-history checkout. Deployment aliases, credentials,
ownership checks, cleanup, and npm publication remain unchanged.

The option is selected at build time. A visitor cannot toggle omitted review
data on. Local development keeps its existing Git-aware Changes and on-demand
comparison behavior. Reuse the same shell components, enabling controls from
the explicit capability rather than an environment label or separate shell.
Before UI implementation, add mobile and desktop mockups of the current
catalogue with review omitted and the same catalogue with review included.

## Acceptance

Test default and explicit options through the script and internal boundary,
including invalid arguments and configured/default/overridden bases. Prove
default publication performs no Git/review calls and works without history.
Opt existing comparison tests and PR workflow fixtures in explicitly.

Test archive inputs, removed-entry absence, excluded stale comparison assets,
review-to-default replacement, rollback, unavailable/advancing bases, input
changes during capture, and frozen comparisons after publication. Browser tests
cover controls, persisted preferences, direct links, search/tags, anchors,
Back/Forward, zero-change review, and no comparison network requests by default
at mobile and desktop widths. Preserve existing comparison and safety tests.
Parameterize static-export tests over both options: no live-update entrypoint,
no EventSource or polling request, and no events endpoint or redirect. Test
home, current, not-found, and supported removed-entry routes while proving
normal navigation and opted-in comparison loading still work.
For both options, reject escaping context, parent, and output symlinks without
changing the outside target. Prove valid in-repository symlinks and a symlinked
repository root still support publication.
Test a rebuild immediately before the first input scan and a manifest mutation
after its initial read. Verify navigation, captured pages, and opted-in change
metadata agree, and failed capture preserves the previous output.
Cover safe file/directory aliases in both options, target-only edits, private
aliases, unrelated outside/dangling/cyclic links, and an escaping manifest before
any target read. Remove a copied resource during staging to prove validation
checks exported bytes and preserves the previous artifact.
