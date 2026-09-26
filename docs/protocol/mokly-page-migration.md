# Breaking Page Migration

## Delivery Status

The breaking page API is implemented. This supplements
[Pages in the catalogue](./mokly-pages.md). Consumers must register complete
documents and rebuild before adopting the new package; historical comparisons
remain supported. The [implementation plan](../../plans/unified-catalogue-pages.md)
records verification and the isolated consumer rehearsal. Pages are attributed
to any repository-owned defining module, as delivered by the
[co-located entry discovery plan](../../plans/co-located-entry-discovery.md).

## Required Upgrade

Remove the `legacy` configuration and its discovery/rendering API, including
`pagesDir`, comment-component expansion, route aliases, exclusions, and legacy
lint settings. Do not implement `legacy.entries`, a registration adapter,
automatic conversion, an opt-out flag, or a deprecation period. Configuration
validation rejects the obsolete `legacy` key, even when set to `undefined`,
before bundling or writing and directs the author to `definePage` and this
migration procedure.

Every whole-document page must be a `definePage` or nested `page` entry in a
resolved entry module or a repository-owned helper it imports, with an explicit
ID, render callback, and metadata; its route derives from the ID under the
[derived route rule](./mokly-authoring.md#derived-routes).
An authored or tree-derived `navPath` places it in navigation. Existing `.source.ts`/`.source.tsx` modules may
remain as ordinary imported render helpers; their filename has no discovery
meaning. The compiler never scans them into a second inventory. Consumers with
only structured entries need no screen API rewrite but must rebuild v7 output.

Consumers replace `.source.html` comment templates with ordinary TSX/function
composition returning complete HTML. Preserve the rendered component content
and portable links. Legacy route aliases have no successor: a migrated page is
addressed by its ID, and any external link to an old route must be updated.
Retain screen-count, stage-ID, allowlist, and source-content requirements as
consumer source-policy tests. Shared package HTML, resource, link, metadata,
ownership, and sandbox checks continue to apply to all pages.

Only historical manifest parsing remains for old Git comparisons, as defined
below. The existing unrelated document-transformer API retains its contract;
it cannot accept obsolete `legacy` configuration or restore legacy discovery.

## Consumer Migration And Output Ownership

Before changing the dependency or config, record the old manifest, generated
page bytes, source/route inventory, anchors, and resources in a clean, recoverable
checkout. Add a normal page definition for every retained document and give
it the intended `navPath`. Import its existing `source()` callback
where possible, with the source in its declared dependencies. Remove `legacy`
configuration and replace consumer rules that depend on its discovery model.

New page ownership headers name the repository-owned defining module, which
is an inventoried source: a resolved entry module or a helper it imports.
An old page header can name a helper beneath the removed `legacy.pagesDir`,
which is no longer an authorized output owner. The upgraded writer must
continue refusing that overwrite; do not add a permissive owner fallback or a
permanent legacy root to make rebuilding succeed.

During the consumer migration, verify each old generated page against the
saved validated manifest and old config: exact route and source/header match,
regular file, in-root path, no symlink escape, and no authored-source collision.
Archive its bytes, then remove only those verified generated files before
rebuilding at the new derived routes. This is a consumer migration step, not
an automatic runtime cleanup command. Unowned or mismatched files require
manual resolution and must not be deleted. Never remove source files, static
assets, whole output directories, or generated files outside the recorded
inventory.

On failure, restore the previous dependency/config, authoring tree, and artifacts;
do not commit a half-migrated catalogue. On success, compare old and new route,
anchor, resource, and rendered-content inventories. Derived mode keeps the
regenerated pages and v7 manifest as ignored local artifacts and commits the
authored migration; committed mode commits the regenerated pages with their new
ownership headers and v7 manifest. A missing document is a migration failure even
when the remaining catalogue builds successfully.

Follow the [source-protection contract](./mokly-source-protection.md): record
the complete config and consumer authoring graphs, validate inventory freshness,
and protect reserved source basenames even when unimported. Give retained
unimported helpers a reserved source name or a public exclusion. Removing
`legacy.pagesDir` must not make authoring inputs public or stop watching imports.

## Manifest Readers And Git Baselines

New successful builds emit only schema v7. In committed mode, `check` recomputes
that output without rewriting files and reports an older manifest as stale. In
derived mode, `check` validates the current compilation and rejects a tracked
manifest without comparing local artifact bytes. A current Browse or publication
reader requires v7; encountering v2 through v6 reports that the catalogue must
be rebuilt before serving. Watched Serve retains its last-good child if a
candidate migration fails validation.

Historical v3 manifests remain valid Git baselines; v2 keeps its existing
`compatibility.readManifestV2` opt-in and filename fallback. A present malformed
canonical manifest never falls back to the older filename. Build a dedicated,
typed historical reader so current-v7 validation cannot reject an otherwise
valid screen comparison against a v2/v3 base or silently accept legacy current
navigation. Parse and validate historical source/route/artifact fields before
using them; never rewrite the Git baseline or synthesize a current legacy tree.
The historical reader normalizes every baseline entry into one internal shape
whose artifact paths are read from the stored v3–v6 route and fragment fields
or derived for v7, so stored routes never leave that boundary.

The typed page-baseline index maps each current ID to a validated historical
document: v5, v6, v7, and page-v4 match by ID. Legacy records in v2/v3 or
component-v4 have no IDs and match nothing; a current page without an ID match
is an added page. The index feeds the existing paired-ignore/material
comparison and rendered-resource traversal. Historical source paths retain
the baseline's own source-protection policy; document reads still require
public, regular Git files. The adapter executes no historical source code and
creates no page visual-comparison snapshots. New explicit metadata/ancestry
can mark migrated pages changed; there is no promise of a zero Changes count
during adoption.

Unmatched legacy records have no catalogue IDs and remain historical
artifact records; they never become synthetic removed-page entries. Normal v5+
page removals have real IDs and open their
[previous version](./mokly-removed-previews.md) through the page contract and
its [shared metadata](./mokly-catalogue-changes.md) wherever Changes is
enabled. Ordinary publication omits removed pages;
the [publication option](./mokly-publication.md) explicitly enables review.
Keep all existing screen/base asset-copying, ignored-region, resource
confinement, cancellation, and publication safeguards through schema changes.

## Verification And Delivery Boundary

Mokly owns the API, schema/readers, shell, generic regression fixtures, packed
consumers, and this generic migration procedure. Concrete application IDs,
counts, source policies, and adoption commands belong in the owning
repositories. Retain multiple-consumer packed coverage.

Before the feature branch is ready, pack the candidate and verify the API,
obsolete-config rejection, mixed hierarchy, and migration against generic and
representative packed consumers. Rehearse the identified downstream migration
in an isolated recoverable checkout using the exact tarball. Record the chosen
consumer revision, manifest digest, package identity, patch, and complete
pre/post source, route, anchor, resource, and artifact inventories. Run that
consumer's required build/check/test/typecheck, browser, and repository gates,
and smoke-test the real catalogue at mobile and desktop widths.

The implementation commit and release notes must identify the removal of the
legacy authoring/discovery API as a breaking change, with upgrade instructions.
Use the repository's Conventional Commits breaking-change notation and release
workflow. Do not publish a release that implies unchanged consumer compatibility.

Actual npm publication and durable consumer adoption remain coordinated
follow-ups after an available package version is selected. Deliver consumer
changes through that repository's commit/push/review workflow, including
generated output only when the consumer explicitly uses committed mode. Package
completion and a disposable rehearsal do not prove that an existing consumer
catalogue has been updated.
