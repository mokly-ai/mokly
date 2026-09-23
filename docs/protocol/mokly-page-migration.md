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
ID, route or slug, render callback, and metadata.
Collections own its membership. Existing `.source.ts`/`.source.tsx` modules may
remain as ordinary imported render helpers; their filename has no discovery
meaning. The compiler never scans them into a second inventory. Consumers with
only structured entries need no screen API rewrite but must rebuild v6 output.

Consumers replace `.source.html` comment templates with ordinary TSX/function
composition returning complete HTML. Preserve the rendered component content
and portable links. Translate each route alias into the new page's explicit
`route`, and retain screen-count, stage-ID, allowlist, and source-content
requirements as consumer source-policy tests. Shared package HTML, resource,
link, metadata, ownership, and sandbox checks continue to apply to all pages.

Only historical manifest parsing remains for old Git comparisons, as defined
below. The existing unrelated document-transformer API retains its contract;
it cannot accept obsolete `legacy` configuration or restore legacy discovery.

## Consumer Migration And Generated Output

Before changing the dependency or config, record the old manifest, generated
page bytes, source/route inventory, anchors, and resources in a clean, recoverable
checkout. Add a normal page definition for every retained document and claim
its ID from the intended collection. Import its existing `source()` callback
where possible, with the source in its declared dependencies. Remove `legacy`
configuration and replace consumer rules that depend on its discovery model.

Generated pages now live under `<mockupsDir>/.generated/`. Archive old generated
pages and the old manifest first if those bytes are needed for review. Do not
migrate a hand-written page into `.generated/`: register it with `definePage`
or nested `page`. Remove historical output only after verifying it is
generated; a new build replaces **only** `.generated/`, never authored source
or closure assets. No source-path header, owner proof, orphan discovery, or
overwrite refusal is part of the new writer. Its plain marker is not an
ownership claim.

On failure, restore the previous dependency/config, authoring tree, and artifacts;
do not commit a half-migrated catalogue. On success, compare old and new route,
anchor, resource, and rendered-content inventories. Ignore `.generated/` if
generated output is local-only; if Git tracks it, commit the entire regenerated
v6 tree with the authored migration. A missing document is a migration failure even
when the remaining catalogue builds successfully.

Follow the [source-protection contract](./mokly-source-protection.md): record
the complete config and consumer authoring graphs, validate inventory freshness,
and protect reserved source basenames even when unimported. Give retained
unimported helpers a reserved source name or register them as entries. Removing
`legacy.pagesDir` must not make authoring inputs public or stop watching imports.

## Manifest Readers And Git Baselines

New successful builds emit only schema v6. Tracked `check` recomputes the
entire tree without rewriting files and reports older output as stale;
untracked `check` validates without comparing local bytes. A current Browse
or publication reader requires v6; encountering v2/v3/v4/v5 reports that the catalogue must be
migrated and rebuilt before serving. Watched Serve retains its last-good child if
a candidate migration fails validation.

Historical v3 manifests remain valid Git baselines; v2 keeps its existing
`compatibility.readManifestV2` opt-in and filename fallback. A present malformed
canonical manifest never falls back to the older filename. Build a dedicated,
typed historical reader so current-v6 validation cannot reject an otherwise
valid screen comparison against a v2/v3 base or silently accept legacy current
navigation. Parse and validate historical source/route/artifact fields before
using them; never rewrite the Git baseline or synthesize a current legacy tree.

Match a historical legacy page to a current page by its exact preserved route,
whose uniqueness has been validated. Use the historical document/source for
artifact comparison and the current ID for attribution. This is a comparison
adapter only: it cannot assign a current collection or change a current title.
The typed page-baseline index maps each current ID to a validated historical
document: v5 and page-v4 match by ID; legacy records in v2/v3 or component-v4
match only by route. It feeds
the existing paired-ignore/material comparison and rendered-resource traversal.
Historical source paths retain the baseline's own source-protection policy;
document reads still require public, regular Git files. The adapter executes no
historical source code and creates no page visual-comparison snapshots.
New explicit metadata/ancestry can mark migration routes changed; there is no
promise of a zero Changes count during adoption. A changed historical route
without an explicit preserved match is treated as an added current page.

Unmatched legacy records have no catalogue IDs and remain historical
artifact records; they never become synthetic removed-page entries. Normal v5
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
routes, counts, source policies, and adoption commands belong in the owning
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
generated output only when the consumer tracks the entire `.generated/` tree. Package
completion and a disposable rehearsal do not prove that an existing consumer
catalogue has been updated.
