# Public Catalogue Read Model

## Delivery Status

Implemented through [viewer library Milestone 3](../../plans/mokly-viewer-library.md).
Serve, export and repository preview share the public projection. The manifest
stays private; local Browse keeps its embedded data, appearance and behavior.
The additive removed-page and removed-screen preview descriptors are
implemented by the
[removed content previews plan](../../plans/removed-content-previews.md).
The public model remains implemented and unchanged. The isolated route-scoped
shell model, projection and strict reader are implemented by Milestone 4 of the
[route-scoped bootstrap plan](../../plans/route-scoped-shell-bootstrap.md);
Serve continues to emit the complete model until the coordinated live switch
in Milestone 6.

## Location And Types

Export writes `__mokly/catalogue.json` at the artifact root. Serve exposes
GET/HEAD `/__mokly/catalogue.json` with `application/json; charset=utf-8`.
Component value types follow the [manifest](./mokly-component-manifest.md),
[props](./mokly-component-props.md), [controls](./mokly-component-controls.md)
and [instance](./mokly-instances.md) contracts. The viewer exports these types
without a CLI dependency.

This public artifact is always the complete v1 projection. Its
`CatalogueUsage` union is exactly `ready | pending | unavailable`; readers
reject the bootstrap-only `omitted` state anywhere in current or historical
views. Live shell pages separately embed the
[route-scoped bootstrap projection](./mokly-shell-bootstrap.md), whose runtime
type may replace only out-of-scope usage with `omitted`. That standalone
delivery optimization does not extend this schema or change this file's bytes.

```ts
import type {
  ComponentControl,
  ComponentInstanceRecord,
  ComponentRangeRecord,
  ComponentSlotRecord,
  ComponentWireProps,
  ObjectPropSchema,
} from "@mokly/viewer";

type Viewport = "mobile" | "desktop";
type ColorScheme = "light" | "dark";
type ChangesStatus =
  "preparing" | "pending" | "ready" | "unavailable" | "disabled";
type ChangeKind = "added" | "changed" | "removed" | "unmodified";
type PublicPath = string;

interface CatalogueReadModel {
  schemaVersion: 1;
  identity: { id: string; title: string };
  deploymentId: string;
  revision: { content: number; evidence: number };
  changesStatus: ChangesStatus;
  comparisonUrl: PublicPath | null;
  collections: readonly CatalogueCollection[];
  tree: {
    pages: readonly CatalogueNode[];
    components: readonly CatalogueNode[];
  };
  screens: readonly CatalogueScreen[];
  pages: readonly CataloguePage[];
  useCases: readonly CatalogueUseCase[];
  components: readonly CatalogueComponent[];
  removedEntries: readonly {
    entry: CatalogueRoutedEntry;
    ancestors: readonly { id: string; title: string }[];
    snapshotId?: string;
    preview?: { kind: "screen" } | { kind: "page"; path: PublicPath };
  }[];
}
type CatalogueRoutedEntry =
  CatalogueScreen | CataloguePage | CatalogueUseCase | CatalogueComponent;
type CatalogueNode =
  | { kind: "collection"; id: string; children: readonly CatalogueNode[] }
  | { kind: "entry"; id: string; children?: readonly CatalogueNode[] };
type CatalogueChanges =
  | { status: "ready"; kind: ChangeKind; included: boolean }
  | { status: Exclude<ChangesStatus, "ready"> };
type ComparisonSelection =
  | { status: "ready"; kind: ChangeKind; eligible: boolean }
  | { status: "pending" | "unavailable" | "disabled" };
interface CatalogueDetails {
  description: string;
  rationale?: string;
  relatedDocs: readonly string[];
  sourcePath: string;
  dependencies: readonly string[];
}
interface CatalogueEntry {
  id: string;
  title: string;
  tags: readonly string[];
  details: CatalogueDetails;
  changes: CatalogueChanges;
}
interface CatalogueCollection extends CatalogueEntry {
  kind: "collection";
  childIds: readonly string[];
}
type CatalogueUsage =
  | {
      status: "ready";
      instances: readonly ComponentInstanceRecord[];
      slots: readonly ComponentSlotRecord[];
      ranges: readonly ComponentRangeRecord[];
    }
  | { status: "pending" | "unavailable" };
interface CatalogueView {
  viewport: Viewport;
  colorScheme: ColorScheme;
  fragmentPath: PublicPath | null;
  usage: CatalogueUsage;
  comparison: ComparisonSelection;
}
interface CatalogueScreen extends CatalogueEntry {
  kind: "screen";
  route: string;
  address?: string;
  variantOf?: string; // Present exactly on variant screens.
  viewports: readonly Viewport[];
  colorSchemes: readonly ColorScheme[];
  views: readonly CatalogueView[];
  useCaseIds: readonly string[];
}
interface CataloguePage extends CatalogueEntry {
  kind: "page";
  route: string;
  documentPath: PublicPath | null;
}
interface CatalogueUseCase extends CatalogueEntry {
  kind: "use-case";
  route: string;
  steps: readonly { screenId: string; title?: string; description?: string }[];
}
interface CatalogueComponent extends CatalogueEntry {
  kind: "component";
  route: string;
  viewports: readonly Viewport[];
  colorSchemes: readonly ColorScheme[];
  propSchema: ObjectPropSchema;
  slots: readonly string[];
  controls: Readonly<Record<string, ComponentControl>>;
  variants: readonly CatalogueVariant[];
}
interface CatalogueVariant {
  id: string;
  title: string;
  description?: string;
  props: ComponentWireProps;
  suppliedSlots: readonly string[];
  views: readonly CatalogueView[];
  comparison: ComparisonSelection;
}
```

`PublicPath` is an artifact-root-relative POSIX file path, without a leading
slash, origin, query or hash; resolve it against the source's origin root, not
the JSON directory or host app URL. Encode validated path segments once for a
request. Routes retain their existing grammar and `.html` suffix. Current
fragment/document paths are `static/<manifest-public-path>`; removed current
views/documents use null, never baseline HTML disguised as current output.

`identity.id` is lowercase SHA-256 of UTF-8 JSON, without LF, for
`["mokly-catalogue-v1", repoRelativeConfigPath]`, scoped to the source origin.
`identity.title` is `Mokly`; host slots own branding. No account data is inferred.

## Projection And Privacy

Construct an explicit allowlist projection from validated manifest v5, the
validated collection forest, and the accepted Changes/comparison snapshot.
Do not spread a manifest, entry, or internal evidence object into public JSON.

- Screens derive schemes from real fragments. Views sort mobile/light,
  mobile/dark, desktop/light, desktop/dark; light-only fallback stays in the viewer.
- Pages have no viewport/usage. Use cases keep ordered standalone-screen steps;
  reused frames add no screen uses or duplicate instance records.
- Components retain schemas, read-only control descriptions, declared slot
  names, saved variants in authored order, their validated wire props and views.
  The first variant is default; ready usage copies only instances/slots/ranges.
- Collections retain authored `childIds`, including an empty array. Derive the Pages/Components tree and
  breadcrumbs from that forest, not `navPath` or source directories. Project
  mixed collections independently into both sections; unclaimed entries stay
  at the root. Collections have no route or tags; emit `tags: []`.
  Drop empty projections, except authored empty folders remain in Pages so a
  stable structural identity can survive temporary or deliberate membership
  changes. Public readers accept and preserve that empty collection.
  Under the implemented [screen variants contract](./mokly-screen-variants.md),
  a variant screen's entry node is a child of its parent screen's entry node
  in the Pages tree rather than a sibling. Entry-node `children` is present
  only for that screen-variant grouping, and `variantOf` is an additive field
  that v1 readers tolerate.
- Details retain authored display metadata already exposed by the inspector.
  `details.dependencies` contains repository-relative display labels only.
  `sourcePath`, optional invocation `source.path`, and local related-doc paths
  stay repository-relative metadata. They never become source-serving URLs.

Never emit `sourceFiles`, `declaredDependencies`, `ownedDependencies`, resolved
dependency evidence, changed-path inventories, source graphs, Git commands,
baseline manifest envelopes, content digests for source inputs, style offsets
(`startOffset`/`endOffset`), style/resource ownership tables, absolute filesystem
paths, credentials, render-capability tokens, or legacy manifests. No source
bytes, HTML, runtime React values, or source maps belong in this JSON. This
privacy rule applies recursively, including removed entries and extension fields.
`snapshotId` is a one-way digest, never a public commit, manifest, or generation
inventory.
Reject private filesystem paths in path fields; display strings/props are data.

Per-entry Changes comes from the existing route/component attribution, not a
count of visual comparisons. `included` is membership in Changes; affected
consumers can have eligible comparisons while `included` is false. Collection
inclusion aggregates descendants without extra counts. Unknown,
preparing, pending and disabled states never imply unmodified or a zero count.
Retain removed routed entries with baseline ancestor labels outside the current
ownership forest. A current route still excludes historical content at that
same route. For a retained removed record at a distinct route whose id is also
current, id-only lookup chooses current while an explicit matching snapshot
selects history. Each newly projected removed record carries an opaque
`snapshotId` when real immutable identity is available, distinguishing it from
current content and other catalogues.
Removed variants can remain on a surviving component. The optional `preview`
field is the additive descriptor defined by
[removed previews](./mokly-removed-previews.md); readers tolerate its absence.
Historical missing usage is unavailable. Historical screen or removed-variant usage is also unavailable
when any referenced component's metadata is omitted under current-id/route
precedence. The shared projection checks the components actually published in
the model; it never publishes dangling references or weakens reader validation.
Proven empty usage is ready with empty arrays, never inferred
from a failed or incomplete render.

The complete projection retains the real usage state for every published view.
Route scoping happens only after this model is accepted and only for a live
shell bootstrap; it never changes the retained public snapshot used by the
catalogue endpoint, export, upload, ownership inventory, or fixture.

`comparisonUrl` is null or `__mokly/diffs/__generations/<generation>/review.json`,
pinned to this content's evidence. Resolve snapshots against that JSON response
URL. Null forbids fallback requests to `/__mokly/diffs/review.json`.
Review v2/v3 bytes stay unchanged; comparison files load only on selection.

## Serialization, Identity And Versions

Sort object keys recursively by UTF-16 code units; preserve authored variants,
children, steps and tags. Entry arrays otherwise sort by route (empty for
collections), then id. The variant screens of one parent are the exception:
emit them in authored order directly after their parent and before the next
entry in route order. That sibling order is the order `variantsById`, the
navigation list, the details `Variants` row, and the public tree's entry-node
`children` present. Apply the exception independently to `removedEntries`;
when a variant's parent is absent from that array, the variant stays in its
ordinary route-then-id position. Sort all other removed entries by route/id,
instances/slots by key, and ranges by DOM start order. Tree roots sort by id;
non-variant children retain `childIds` order. The viewer applies existing
presentation sorting. Emit required empties, omit absent optionals, use
two-space indentation and a final LF. Identical inputs produce identical bytes
regardless of enumeration, time or output location.

`snapshotId` is lowercase SHA-256 of UTF-8 JSON, without LF, for
`["mokly-historical-snapshot-v1", catalogueIdentity, sourceKind,
sourceIdentity, entryKind, entryId, entryRoute]`. `sourceKind` is `baseline`
when accepted evidence names one unambiguous baseline commit; that commit is the
`sourceIdentity`. Projection requires every available evidence/comparison
baseline commit to agree. This baseline identity takes precedence even after a
live immutable comparison becomes available, so an evidence-only refresh does
not invalidate selection. When no baseline identity exists, an exact 64-hex
generation from `comparisonUrl` may supply `sourceKind: "generation"`. With
neither real source, projection omits the field instead of deriving it from
revisions, `deploymentId`, metadata, time, or randomness.

Readers validate supplied snapshot ids and require them to be unique. For an
older catalogue that omits the field but advertises one immutable comparison
generation, the reader derives a generation-backed per-record identity. An
id-only selection of one uniquely identified removed record remains compatible
and normalizes to its safe published identity; current content still wins when
both current and removed records use that id. Identity-less legacy history also
remains readable while its id is unique, but a current/removed id collision is
unavailable. A baseline or generation change produces different ids, so an
unknown, stale, or cross-catalogue selection fails closed rather than
retargeting current content.

`deploymentId` is the artifact's 64-hex identity. The
[delivery hashing rule](./mokly-export-delivery.md#deployment-identity) additionally
normalizes this owned JSON's top-level `deploymentId` to 64 zeroes before hashing
and stamps it afterward, alongside shell descriptors. Other catalogue bytes
participate unchanged. Export revisions are `{ content: 0, evidence: 0 }`.

Readers reject unsupported `schemaVersion`; compatible v1 readers tolerate
unknown additive fields but validate all known fields/references. Writers remain
allowlisted. Optional fields are additive; removals, required additions, changed
meaning, new union discriminants or incompatible paths require a new version.
This file and the inspector asset are additive inventory entries: ownership v1,
upload v1, review v2/v3 and delivery descriptor v2 remain unchanged.

The [public v1 fixture](./fixtures/catalogue-v1.json) ships in the npm package
and is checked by the reader/projection conformance tests.

## Serve And Fetch Rules

Serve uses `Cache-Control: no-store` and live-index metadata, with pending usage
until real view/background records arrive. GET returns this complete model even
though each Serve HTML page carries only its route-scoped shell projection.
GET never triggers Git or rendering.
Revisions are nonnegative safe integers: content
advances on accepted content, evidence on accepted usage/Changes updates. Each
response is one atomic snapshot; failed candidates retain the last good content.
Watched notifications refresh that snapshot. Evidence-only refresh preserves
frames, focus, valid snapshot selection, scrolling and local edits; a changed
baseline invalidates the selected snapshot without falling back to current
content. Content changes otherwise follow the existing reload lifecycle. Serve hashes the canonical public snapshot with its
`deploymentId` zeroed; it is not a static artifact attestation.
Live comparison URLs stay null until a matching immutable generation exists;
Serve's existing explicit comparison integration prepares it and refreshes the
model without moving that work onto catalogue GET or altering local controls.

Only a complete comparison can supply this catalogue-wide pointer; selected-only
generations leave it null. A matching complete live generation gains a
content-addressed alias while retaining its existing local URL. Public aliases
serve their retained generation directly, return 404 when unavailable, and never
redirect or generate work. Superseded completions cannot set the pointer.
Alias bookkeeping never renews a generation's idle retention window; only an
actual retained-generation read renews it. Unused generations expire even when
complete captures continue.

Public paths are `__mokly/catalogue.json`, `static/**`,
`__mokly/client/**`, `__mokly/shell.css`, `__mokly/fonts/**`, and immutable
comparison generations under `__mokly/diffs/__generations/**`. These retain
normal path confinement; this list grants no source, controls or watcher access.
When a removed entry is selected, the viewer fetches its validated historical
HTML beneath the advertised generation's `snapshots/before/` directory instead
of framing that artifact URL. Those document responses require `text/html` and
the same CORS and `nosniff` treatment as other generation files.
Same-origin clients need no CORS header. A cross-origin artifact host must send
`Access-Control-Allow-Origin: <exact app origin>` and
`X-Content-Type-Options: nosniff` on these responses (including errors and HEAD),
with correct MIME types. No wildcard origin, cookies, authorization headers or
credentials are used; fetch uses `credentials: "omit"`. Send `Vary: Origin`
when selecting an allowed origin dynamically. Hosts retain the revalidation and
comparison no-store rules in [static delivery](./mokly-export-delivery.md).
Use ordinary GET/HEAD without custom headers; reject redirects outside the
configured source origin. URL sources are HTTP(S), without userinfo or fragment.
Host header configuration is external; export cannot make a server enable CORS.
