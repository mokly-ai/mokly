# Pages In The Catalogue

## Delivery Status

Implemented in this branch. All routed entries use one collection hierarchy,
and current builds emit schema v6. [Page migration](./mokly-page-migration.md)
defines the required breaking consumer upgrade and historical comparison
support. Verification is tracked in
[Unified Catalogue Pages](../../plans/unified-catalogue-pages.md). The
[removed content previews plan](../../plans/removed-content-previews.md)
implements the page-only historical capture and delivery boundary.
Removal of page `dependencies` and manifest-v6 output was planned by
[remove-source-path-evidence](../../plans/remove-source-path-evidence.md),
implemented in Milestone 6. Milestone 7 removed the public details field;
the current public writer omits dependency lists.

## Purpose And Boundary

Every browsable document belongs to the same catalogue as screens and use
cases. Collections own navigation through `childIds`; source directories,
route directories, and displayed titles never create or merge collections.
Whole-document rendering remains supported independently of navigation.

This is a breaking upgrade: remove legacy source discovery and configuration.
All pages use `definePage` or nested `page`; no source-registration adapter or
compatibility mode accepts the old authoring API. Consumers must update their
definitions/configuration and rebuild the catalogue before using the new version.

A page is one complete authored HTML document, such as a printable document
or an existing multi-state reference page. It does not require invented
mobile/desktop variants. Screens continue to own their real viewport and
color-scheme fragments; use-case steps continue to reference screens only.
This change adds no PDF parser, browser scripting privilege, or page comparison
engine. A page callback always returns HTML, including printable documents.

## Public Authoring

The root package exports `definePage`, nested `page`, and their public input
and definition types. The additional flat input is:

```ts
interface PageInput extends RoutedEntryInput {
  render: () => string;
  tags?: readonly string[];
}
```

`PageDefinition` adds `kind: "page"` and the same private definition brand and
module attribution as other definitions. Common metadata (`id`, `title`,
`description`, `relatedDocs`, optional `rationale`) follows
`EntryInput`. Routes and IDs use the existing validation grammars. Page tags
use the existing optional, unique kebab-case tag contract.

```tsx
import { defineCollection, definePage } from "@mokly/mokly";
import { source } from "../documents/statement.source.js";

export const mockups = [
  defineCollection({
    id: "documents",
    title: "Documents",
    description: "Account documents.",
    childIds: ["account-statement"],
    relatedDocs: [],
  }),
  definePage({
    id: "account-statement",
    title: "Account statement",
    description: "The printable account statement.",
    route: "documents/statement.html",
    render: source,
    relatedDocs: [],
  }),
];
```

The example assumes an existing `source(): string` export. A nested `page`
accepts the same metadata and callback, replaces `route` with `slug`, and
inherits only `relatedDocs`. Its surrounding collections
contribute route segments and real membership, exactly as for nested screens.
It does not inherit screen addresses, tags, viewports, or color schemes.

Pages reject `mobile`, `desktop`, `colorSchemes`, `address`, `useCaseIds`,
`steps`, `childIds`, `variants`, and `variantOf`, including keys whose value
is `undefined`. Untyped
JavaScript receives the same validation as typed authoring. A collection can
claim a page ID; a use-case `screenId` cannot name a page. Duplicate IDs,
multiple parents, missing children, duplicate child references, and collection
cycles retain their existing failures. Unclaimed pages are root leaves.

## Build And Output

Render screen views first, then complete pages, with deterministic catalogue
ordering within each kind. This preserves existing consumer document helpers
that collect a shared stylesheet after screen rendering.

The compiler calls each page callback once per compilation, synchronously,
after registry validation. Non-functions, promises, non-string return values,
throws, and incomplete HTML fail with the page ID and source location before
any output changes. Callbacks must be deterministic and return complete HTML;
they must not write output themselves.

A page generates exactly one file at `mockupsDir/<route>`. Its route is both
its logical catalogue destination and its artifact path. The screen renderer
does not wrap it, inject stylesheets, or generate extra variants. The consumer
continues to own the document's styles, responsive markup, and render context.
Pages are one light document regardless of the catalogue color-scheme setting.

Registry imports, page callbacks, imported document modules, and screen rendering
share the existing consumer bundle and React runtime.
Imported sources participate in watched rebuilds; an input edit alone does not add a page whose
document, rendered resources, and reviewable metadata remain unchanged.

The complete output passes the shared child-control adapter, logical-link and
fragment validation, compatibility transformer, final metadata/ownership checks,
HTML/CSS/resource validation, and Review-ignore validation. The existing
transaction protects all output, including collision, orphan, rollback,
source-path, symlink, and foreign-file safeguards. Page routes cannot collide
with any other logical route or generated fragment. One owner may use its own
page route as its output; this is not treated as a self-collision.

Ownership headers identify the definition's registry module. Consumer migration
must explicitly regenerate old artifacts whose previous source is no longer an
authorized owner, as specified in the migration contract. Retain strict source
protection for imported render helpers and all overwrite safeguards. Generated
paths never imply collection ancestry.

## Manifest And Runtime Model

New builds write schema v6 at the existing `mokly-manifest.json` filename:

```ts
interface ManifestPage extends ManifestEntryBase {
  kind: "page";
  route: string;
  tags?: readonly string[];
}

interface ManifestV6 {
  entries: readonly ManifestEntry[];
  generatedBy: "mokly";
  schemaVersion: 6;
  sourceFiles: readonly string[];
}
```

`ManifestEntry` includes pages, screens, collections, use cases and components, and its
base `kind` union includes `page`. All existing common fields remain,
including derived `navPath` compatibility output. Pages have no fragments,
viewport arrays, callbacks, or screen-only fields in the manifest. Schema v5
rejects a top-level `legacyPages` field. Preserve existing deterministic
entry sorting and serialization conventions. The current v6 validator rejects
the removed path-declaration fields on every entry.

`sourceFiles` follows the [source-protection contract](./mokly-source-protection.md):
the complete config/consumer authoring graph, validated against current inputs.
Reserved source basenames stay protected even when unimported. Serving, resource
validation, Review, and publication share that policy without legacy roots.

Only the historical comparison reader may handle earlier shapes. Catalogue lookup,
the cached hierarchy, navigation, breadcrumbs, details, search, route targets,
and static publication consume one validated current entry model. Page leaves
use `entry:<id>`; collections retain `collection:<id>`. Remove runtime
directory-tree building, `legacy:` disclosure keys, route-derived Overview
folding, and the parallel legacy route-target/detail variants. A real Overview
page can be explicitly registered and named by its author.

Sibling titles may still match when their IDs differ. Do not merge, reparent,
rename, or hide entries merely because their labels match. This fixes invented
legacy groups without changing the existing independent-collection contract.

## Browse And Navigation

A page appears once under its declared collection, using the existing page
icon. The heading uses its title; breadcrumbs use its real collection ancestry;
the ID chip, search by ID/title/route/tags, tag picker, details, and home counts
include pages. Details show authored description, rationale,
related docs, and the generated page path. No migration explanation or legacy
badge appears in a product view.

Reuse the complete-document frame, responsive shell, expansion control,
ownership authentication, and script-free sandbox. Do not add device chrome
around chrome already authored in the document. Hide controls implying screen
viewport variants, page color variants, or page comparisons; remember the
user's screen choices when navigating back to a screen. Mobile drawer and
desktop navigation show the same collection ownership.

`/view/<route>`, `/id/<id>`, and `/static/<route>` resolve a page with the
existing GET/HEAD behavior. `MockLink` and `mockLink` accept its ID. Their
portable target is its single generated file with the validated optional
anchor; Browse opens the canonical page and reveals its collection ancestors.
Page-to-screen logical links resolve to the desktop/light fragment; a page has
no per-viewport render context. Screen-to-page links target the same document
from every screen viewport and scheme. Use-case links still resolve through
their first screen.

Validate page anchors against the final single document, including after
compatibility transforms. Preserve the existing fragment grammar, duplicate
query rejection, invalid-anchor behavior, safe URL handling, link-owner
authentication, and exclusion of unowned public HTML. Served and published
pages must handle direct URLs, in-frame navigation, Back/Forward, and fragment
restoration identically. Old portable artifact links remain valid.

## Changes, Watch, And Publishing

Pages participate in the All/Changes filter wherever review is enabled. Compare
stable page metadata, real ancestor IDs/titles, the generated document, and its
rendered local resources against the Git branch point. Apply the shared
[material-change rules](./mokly-changes.md), including paired ignore regions;
source/dependency changes alone do not affect membership. Renaming
or reparenting a page marks that entry changed. A flat `definePage` keeps its
explicit `route`; title and collection membership never rewrite it. A nested
`page` derives its route from the root path, collection segments, and its slug,
so changing those path inputs changes its URL; changing titles alone does not.
Moving unrelated source composition without changing those inputs does not
mark every page in that module changed. Regression coverage must distinguish
change attribution from URL derivation for both authoring forms.
Do not use the serialized `navPath` as independent impact evidence.

Screen comparison generation and use-case impact propagation retain their
screen-only boundary. Adding page support must not make those paths assume
every non-collection/non-use-case entry has screen fragments. Pages expose
Current only and never fabricate comparisons; the only historical capture for a
page is its [removed page preview](./mokly-removed-previews.md).
The [catalogue-change contract](./mokly-catalogue-changes.md) owns the shared
typed impact/removal snapshot, route/ID precedence, and flat removed-page rows
in Changes. Baseline ancestry stays in details even when every ancestor is
deleted; no historical collection tree is synthesized.

Watch rebuilds imported sources, recomputes page impact before notification,
and restores disclosures by entry/collection identity. Parent changes update
both navigation and breadcrumbs after reload. Existing unsectioned saved
`collection:` keys migrate to the matching Pages or Components projection; old
`legacy:` keys are ignored, never applied to a collection with the same title.
Active sections and ancestors open through the existing reveal logic.

Static publishing includes each page route, generated document and resources,
ID redirect, validated anchor navigation, metadata, search/filter behavior,
and the current hierarchy. The [publication option](./mokly-publication.md)
defaults to the current catalogue; only an explicit opt-in includes Changes,
removed registered-page state, and screen comparison artifacts. Removed pages are absent
from ordinary publication. Preserve transactional publication and generate no
page comparisons. Local development retains its Git-aware Changes behavior.

## Acceptance

Authoring, schema, build, links, server, browser, watcher, comparison-regression,
and packed-consumer tests cover normal pages and mandatory consumer migration,
including obsolete-config rejection and safe old-artifact regeneration.
Use a mixed collection containing a screen, page, and use case; an unclaimed
page; distinct same-title collections; and a document whose route disagrees
with its collection ancestry. Verify output determinism and every existing
screen safety boundary. [Migration](./mokly-page-migration.md) owns generic
release acceptance; consumer-specific inventory belongs in migration notes.
