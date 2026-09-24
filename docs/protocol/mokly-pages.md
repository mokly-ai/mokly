# Pages In The Catalogue

## Delivery Status

All routed entries use section-scoped folder paths,
and current builds emit schema v6. [Page migration](./mokly-page-migration.md)
defines the required breaking consumer upgrade and historical comparison
support. Verification is tracked in
[Unified Catalogue Pages](../../plans/unified-catalogue-pages.md). The
[removed content previews plan](../../plans/removed-content-previews.md)
implements the page-only historical capture and delivery boundary.

## Purpose And Boundary

Every browsable document belongs to the same catalogue as screens and use
cases. Entries own `navPath` labels, which create shared folders within each
section. Source directories, route directories, and leaf titles never
create folders.
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
`description`, `dependencies`, `relatedDocs`, optional `rationale`) follows
`EntryInput`. Routes and IDs use the existing validation grammars. Page tags
use the existing optional, unique kebab-case tag contract.

```tsx
import { definePage } from "@mokly/mokly";
import { source } from "../documents/statement.source.js";

export const mockups = [
  definePage({
    id: "account-statement",
    title: "Account statement",
    description: "The printable account statement.",
    navPath: ["Documents"],
    route: "documents/statement.html",
    render: source,
    relatedDocs: [],
    dependencies: ["documents/statement.source.tsx"],
  }),
];
```

The example assumes an existing `source(): string` export. A nested `page`
accepts the same metadata and callback, replaces `route` with `slug`, and
inherits only `dependencies` and `relatedDocs`. Its root `navPath` and ancestor
folder titles derive the leaf's `navPath`; folder `segment`s, not titles,
contribute route segments.
It does not inherit screen addresses, tags, viewports, or color schemes.

Pages reject `mobile`, `desktop`, `colorSchemes`, `address`, `useCaseIds`,
`steps`, `variants`, and `variantOf`, including keys whose value
is `undefined`. Untyped
JavaScript receives the same validation as typed authoring. A use-case
`screenId` cannot name a page. Duplicate IDs and invalid/conflicting path
labels fail registry validation. Pages with `navPath: []` are top-level leaves;
nested `page()` rejects any authored `navPath` key, even `undefined`.

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
Imported sources participate in watched rebuilds. Declared dependencies retain
their metadata and evidence role; an input edit alone does not add a page whose
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
paths never imply folder ancestry.

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

`ManifestEntry` includes pages, screens, use cases and components, and its
base `kind` union includes `page`. All existing common fields remain,
including authored or tree-derived `navPath` and required `declaredDependencies`. Pages have no fragments,
viewport arrays, callbacks, or screen-only fields in the manifest. Schema v6
rejects a top-level `legacyPages` field. Preserve existing deterministic
entry sorting, dependency normalization, and serialization conventions.

`sourceFiles` follows the [source-protection contract](./mokly-source-protection.md):
the complete config/consumer authoring graph, validated against current inputs.
Reserved source basenames stay protected even when unimported. Serving, resource
validation, Review, and publication share that policy without legacy roots.

Only the historical comparison reader may handle earlier shapes. Catalogue lookup,
the cached hierarchy, navigation, breadcrumbs, details, search, route targets,
and static publication consume one validated current entry model. Page leaves
use `entry:<id>`; folders use `folder:<path key>`. Remove runtime
directory-tree building, `legacy:` disclosure keys, route-derived Overview
folding, and the parallel legacy route-target/detail variants. A real Overview
page can be explicitly registered and named by its author.

Sibling titles may still match when their IDs differ. Do not merge, reparent,
rename, or hide entries merely because their labels match. This fixes invented
legacy groups; only folders with byte-identical labels under one parent merge.

## Browse And Navigation

A page appears once at its `navPath`, using the existing page
icon. The heading uses its title; breadcrumbs use those folder labels;
the ID chip, search by ID/title/route/tags, tag picker, details, and home counts
include pages. Details show authored description, rationale, dependencies,
related docs, and the generated page path. No migration explanation or legacy
badge appears in a product view.

Reuse the complete-document frame, responsive shell, expansion control,
ownership authentication, and script-free sandbox. Do not add device chrome
around chrome already authored in the document. Hide controls implying screen
viewport variants, page color variants, or page comparisons; remember the
user's screen choices when navigating back to a screen. Mobile drawer and
desktop navigation show the same path-derived folders.

`/view/<route>`, `/id/<id>`, and `/static/<route>` resolve a page with the
existing GET/HEAD behavior. `MockLink` and `mockLink` accept its ID. Their
portable target is its single generated file with the validated optional
anchor; Browse opens the canonical page and reveals its ancestor folders.
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
stable page metadata, its `navPath`, the generated document, and its
rendered local resources against the Git branch point. Apply the shared
[material-change rules](./mokly-changes.md), including paired ignore regions;
source/dependency changes alone do not affect membership. Renaming
or reparenting a page marks that entry changed. A flat `definePage` keeps its
explicit `route`; title and `navPath` never rewrite it. A nested
`page` derives its route from the root path, folder segments, and its slug,
so changing those path inputs changes its URL; changing titles alone does not.
Moving unrelated source composition without changing those inputs does not
mark every page in that module changed. Regression coverage must distinguish
change attribution from URL derivation for both authoring forms.
Compare `navPath` directly with the baseline: changing it marks the page changed.

Screen comparison generation and use-case impact propagation retain their
screen-only boundary. Adding page support must not make those paths assume
every non-use-case entry has screen fragments. Pages expose
Current only and never fabricate comparisons; the only historical capture for a
page is its [removed page preview](./mokly-removed-previews.md).
The [catalogue-change contract](./mokly-catalogue-changes.md) owns the shared
typed impact/removal snapshot, route/ID precedence, and flat removed-page rows
in Changes. Baseline ancestry stays in details even when every ancestor is
deleted; no historical folder tree is synthesized.

Watch rebuilds imported sources, recomputes page impact before notification,
and restores disclosures by section and folder path key. `navPath` changes update
both navigation and breadcrumbs after reload. Obsolete `collection:` and
`legacy:` keys are ignored, not migrated to folder keys.
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
Use a shared folder containing a screen, page, and use case; a top-level
page; matching folder paths across sections; and a document whose route
disagrees with its `navPath`. Verify output determinism and every existing
screen safety boundary. [Migration](./mokly-page-migration.md) owns generic
release acceptance; consumer-specific inventory belongs in migration notes.
