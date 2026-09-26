# Public Catalogue Read Model

## Delivery Status

Implemented through [viewer library Milestone 3](../../plans/mokly-viewer-library.md).
Serve, export and repository preview share the public projection. The manifest
stays private; local Browse keeps its embedded data, appearance and behavior.
The additive removed-page and removed-screen preview descriptors are
implemented by the
[removed content previews plan](../../plans/removed-content-previews.md).
Read model v3, defined by the
[id-derived routes plan](../../plans/id-derived-routes.md), carries identity
only: every route and view path is derived from kind and id.

## Location And Types

Export writes `__mokly/catalogue.json` at the artifact root. Serve exposes
GET/HEAD `/__mokly/catalogue.json` with `application/json; charset=utf-8`.
Component value types follow the [manifest](./mokly-component-manifest.md),
[props](./mokly-component-props.md), [controls](./mokly-component-controls.md)
and [instance](./mokly-instances.md) contracts. The viewer exports these types
without a CLI dependency.

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
  schemaVersion: 3;
  identity: { id: string; title: string };
  deploymentId: string;
  revision: { content: number; evidence: number };
  changesStatus: ChangesStatus;
  comparisonUrl: PublicPath | null;
  tree: {
    pages: readonly CatalogueNode[];
    components: readonly CatalogueNode[];
  };
  screens: readonly CatalogueScreen[];
  pages: readonly CataloguePage[];
  useCases: readonly CatalogueUseCase[];
  components: readonly (CatalogueComponent | CatalogueComponentVariant)[];
  removedEntries: readonly {
    entry: CatalogueRecord;
    snapshotId?: string;
    preview?: { kind: "screen" } | { kind: "page" };
  }[];
}
type CatalogueRecord =
  | CatalogueScreen
  | CataloguePage
  | CatalogueUseCase
  | CatalogueComponent
  | CatalogueComponentVariant;
type CatalogueNode =
  | { kind: "folder"; label: string; children: readonly CatalogueNode[] }
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
  navPath: readonly string[];
  details: CatalogueDetails;
  changes: CatalogueChanges;
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
  usage: CatalogueUsage;
  comparison: ComparisonSelection;
}
interface CatalogueScreen extends CatalogueEntry {
  kind: "screen";
  address?: string;
  variantOf?: string; // Present exactly on variant screens.
  colorSchemes: readonly ColorScheme[];
  views: readonly CatalogueView[];
  useCaseIds: readonly string[];
}
interface CataloguePage extends CatalogueEntry {
  kind: "page";
}
interface CatalogueUseCase extends CatalogueEntry {
  kind: "use-case";
  steps: readonly { screenId: string; title?: string; description?: string }[];
}
interface CatalogueComponent extends CatalogueEntry {
  kind: "component";
  colorSchemes: readonly ColorScheme[];
  propSchema: ObjectPropSchema;
  slots: readonly string[];
  controls: Readonly<Record<string, ComponentControl>>;
}
interface CatalogueComponentVariant extends CatalogueEntry {
  kind: "component";
  variantOf: string; // Present exactly on variant entries.
  colorSchemes: readonly ColorScheme[];
  props: ComponentWireProps;
  suppliedSlots: readonly string[];
  views: readonly CatalogueView[];
  comparison: ComparisonSelection;
}
```

No record carries a route or a file path. A reader derives an entry's route
and view routes from its kind and id under the
[derived route rule](./mokly-authoring.md#derived-routes): a current screen or
component variant view is served at `static/<view route>`, a current page at
`static/<route>`, and the shell page at `/view/<route>`. Removed entries have
no current files; their historical documents come only from their `preview`
descriptor. `PublicPath` is an artifact-root-relative POSIX file path, without
a leading slash, origin, query or hash; resolve it against the source's origin
root, not the JSON directory or host app URL. Encode validated path segments
once for a request. A component parent has no views; its page shows its first
variant entry, which follows it in the `components` array.

`identity.id` is lowercase SHA-256 of UTF-8 JSON, without LF, for
`["mokly-catalogue-v1", repoRelativeConfigPath]`, scoped to the source origin.
`mokly-catalogue-v1` is the permanent identity-hash namespace, not the read
model `schemaVersion`; changing it would change published catalogue ids.
`identity.title` is `Mokly`; host slots own branding. No account data is inferred.

## Projection And Privacy

Construct an explicit allowlist projection from validated manifest v7, the
validated per-section folder trees, and the accepted Changes/comparison snapshot.
Do not spread a manifest, entry, or internal evidence object into public JSON.

- Screens and component variants copy their effective `colorSchemes` and
  emit one view per effective viewport and scheme, sorted mobile/light,
  mobile/dark, desktop/light, desktop/dark; light-only fallback stays in the
  viewer.
- Pages have no viewport/usage. Use cases keep ordered standalone-screen steps;
  reused frames add no screen uses or duplicate instance records.
- Component parents retain schemas, read-only control descriptions, and
  declared slot names. Their variant entries follow them in authored order with
  validated wire props and supplied slot names; the first is the default, and
  ready usage copies only instances/slots/ranges.
- Derive the [section trees](./mokly-nav-paths.md#sections-and-path-derivation)
  from current entries. Variant grouping follows the
  [variant contract](./mokly-variants.md).
- Details retain authored display metadata already exposed by the inspector.
  `details.dependencies` lists the entry's source path and declared paths as
  repository-relative display labels only. `sourcePath`, optional invocation
  `source.path`, and local related-doc paths stay repository-relative
  metadata. They never become source-serving URLs.

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

Per-entry Changes comes from the existing entry attribution, not a count of
visual comparisons. `included` is membership in Changes; affected consumers
can have eligible comparisons while `included` is false. Folder visibility
aggregates descendants without extra counts. Unknown, preparing, pending and
disabled states never imply unmodified or a zero count. The
[path contract](./mokly-nav-paths.md#variants-and-historical-paths) owns
removed-entry ancestry. Removal is keyed by id: a baseline entry is removed
when no current entry has its id. A current entry therefore excludes
historical content with its id unless the request names a matching
`snapshotId`; id-only lookup always chooses current content. Each newly
projected removed record carries an opaque `snapshotId` when real immutable
identity is available, distinguishing it from current content and other
catalogues. A removed variant of either kind is an ordinary removed entry
carrying `variantOf`. The optional `preview` field is the additive descriptor
defined by [removed previews](./mokly-removed-previews.md); readers tolerate
its absence. Historical missing usage is unavailable. Historical usage is also
unavailable when any referenced component's metadata is omitted under
current-id precedence. The shared projection checks the components actually
published in the model; it never publishes dangling references or weakens
reader validation. Proven empty usage is ready with empty arrays, never
inferred from a failed or incomplete render.

`comparisonUrl` is null or `__mokly/diffs/__generations/<generation>/review.json`,
pinned to this content's evidence. Resolve snapshots against that JSON response
URL. Null forbids fallback requests to `/__mokly/diffs/review.json`.
Comparison files load only on selection.

## Serialization, Identity And Versions

Sort object keys recursively by UTF-16 code units; preserve authored steps and
tags. Entry arrays sort by kind name in UTF-16 order (`component`, `page`,
`screen`, `use-case`) and then id. The variants of one parent are the
exception: emit them in authored order directly after their parent and before
the next entry in kind-then-id order. That sibling order is the order
`variantsById`, the navigation list, the details `Variants` row, and the
public tree's entry-node `children` present. Apply the exception independently
to `removedEntries`; when a variant's parent is absent from that array, the
variant stays in its ordinary kind-then-id position. Sort all other removed
entries by kind then id, instances/slots by key, and ranges by DOM start
order. Tree siblings follow the
[shared comparator](./mokly-nav-paths.md#order-and-keys); entry-node variant
children retain authored order. Emit required empties, omit absent optionals,
use two-space indentation and a final LF. Identical inputs produce identical
bytes regardless of enumeration, time or output location.

`snapshotId` is lowercase SHA-256 of UTF-8 JSON, without LF, for
`["mokly-historical-snapshot-v2", catalogueIdentity, sourceKind,
sourceIdentity, entryKind, entryId]`. `sourceKind` is `baseline`
when accepted evidence names one unambiguous baseline commit; that commit is the
`sourceIdentity`. Projection requires every available evidence/comparison
baseline commit to agree. This baseline identity takes precedence even after a
live immutable comparison becomes available, so an evidence-only refresh does
not invalidate selection. When no baseline identity exists, an exact 64-hex
generation from `comparisonUrl` may supply `sourceKind: "generation"`. With
neither real source, projection omits the field instead of deriving it from
revisions, `deploymentId`, metadata, time, or randomness.

Readers validate supplied snapshot ids and require them to be unique. For a
catalogue that omits the field but advertises one immutable comparison
generation, the reader derives a generation-backed per-record identity. An
id-only selection of one uniquely identified removed record remains compatible
and normalizes to its safe published identity; current content still wins when
both current and removed records use that id. Identity-less history also
remains readable while its id is unique, but a current/removed id collision is
unavailable. A baseline or generation change produces different ids, so an
unknown, stale, or cross-catalogue selection fails closed rather than
retargeting current content.

`deploymentId` is the artifact's 64-hex identity. The
[delivery hashing rule](./mokly-export-delivery.md#deployment-identity) additionally
normalizes this owned JSON's top-level `deploymentId` to 64 zeroes before hashing
and stamps it afterward, alongside shell descriptors. Other catalogue bytes
participate unchanged. Export revisions are `{ content: 0, evidence: 0 }`.

Readers require `schemaVersion: 3` and reject older and unknown versions; writers
remain allowlisted. The [path contract](./mokly-nav-paths.md#order-and-keys)
owns the intentional change from v1's authored tree order. Version 3 removes
every route and path field, makes component variants entries, and keys removal
by id. Optional fields are additive; removals, required additions, changed
meaning, new union discriminants or incompatible paths require a new version.
This file and the inspector asset are additive inventory entries: ownership v1
and upload v1 remain unchanged; the review result and delivery descriptor
follow the [Changes](./mokly-changes.md) and
[static delivery](./mokly-export-delivery.md) contracts.

The [public v3 fixture](./fixtures/catalogue-v3.json) ships in the npm package
and is checked by the reader/projection conformance tests.

The reader requires both `tree.pages` and `tree.components` arrays; `[]` is
valid when a section has no current entries, even if it has removed entries.
Nonempty trees must follow the [path contract](./mokly-nav-paths.md): every
current non-variant id appears exactly once at its path; no empty folders,
missing or duplicate references, or removed entries occur. Entry-node
`children` holds exactly a parent's variants in authored order, with paths
equal to that parent, and exists only for a screen or component with variants.
Historical paths follow the
[historical rules](./mokly-nav-paths.md#variants-and-historical-paths).
Unknown fields follow the existing reader policy for public JSON.

## Serve And Fetch Rules

Serve uses `Cache-Control: no-store` and live-index metadata, with pending usage
until real view/background records arrive. GET never triggers Git or rendering.
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
