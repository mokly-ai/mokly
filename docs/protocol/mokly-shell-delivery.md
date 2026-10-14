# Shell Delivery And Read Model Routes

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Purpose And Boundary

The Browse shell is a browser application. Serve and `build` deliver the same
three things: a shell stub, a catalogue index, and one detail document per
entry. The shell renders itself from the index and the current entry's detail,
resolves routes against the index, and fetches the next entry's detail on
navigation. No process renders shell HTML. A catalogue without JavaScript
starts no sidecar, and the Rust core never produces shell markup. The index
holds what every page needs. The detail holds what one entry needs.

## Routes

Serve answers these routes over HTTP. `build` writes them as files under the
output directory with the same relative paths, so a static host needs no
rewrite rules.

| Route                                                                                        | Serve | `build`                                 | Content                                                    |
| -------------------------------------------------------------------------------------------- | ----- | --------------------------------------- | ---------------------------------------------------------- |
| `/`, `/view/<route>`                                                                         | stub  | `index.html`, `view/<route>/index.html` | the shell stub, identical for every route                  |
| `/404.html`                                                                                  | stub  | `404.html`                              | the same stub                                              |
| `/mokly-viewer/index.json`                                                                   | live  | file                                    | the catalogue index v7                                     |
| `/mokly-viewer/entries/<entry path>.json`                                                    | live  | one file per current entry              | the entry detail v1                                        |
| `/mokly-viewer/diffs/generations/<generation>/review.json`                                   | live  | file                                    | review result v8, under the comparison contract            |
| `/mokly-viewer/diffs/generations/<generation>/entries/<entry path>.json`                     | live  | one file per removed entry              | the entry detail v1 of a removed entry's historical record |
| `/mokly-viewer/live.json`                                                                    | live  | absent                                  | the live descriptor v3: the render capability              |
| `/mokly-viewer/events`                                                                       | live  | absent                                  | the event stream: one message per publication              |
| `/static/**`, `/mokly-viewer/client/**`, `/mokly-viewer/shell.css`, `/mokly-viewer/fonts/**` | live  | files                                   | documents, the shell bundle, styles, and fonts, unchanged  |

`<route>` is the entry route of the [path contract](./mokly-paths.md).
`<entry path>` is the entry's path with `.json` appended; a path segment never
contains `..`, and the file for `a/b` and the directory for `a/b/c` coexist.
The comparison routes under `diffs/` keep the owners that the
[changes serving contract](./mokly-changes-serving.md) names. The Serve-only
routes of the [component controls](./mokly-component-controls.md) and
[on-demand](./mokly-on-demand.md) contracts are unchanged in purpose and owned
by those pages. Every JSON route answers GET and HEAD with
`application/json; charset=utf-8` and `X-Content-Type-Options: nosniff`.

## The Stub

The stub is one HTML document. `build` writes it once per shell route, and
Serve returns it for every shell route. Its bytes are identical for every
route of one deployment. It contains the document type, `lang="en"`, a
`<title>` with the catalogue title, the `/mokly-viewer/shell.css` stylesheet
link, one `<div data-mokly-shell>` mount element, a `<noscript>` sentence that
says the catalogue needs JavaScript, and one
`<script type="module" src="/mokly-viewer/client/shell.js">`. It embeds no
catalogue data, no descriptor, and no route; the shell reads the route from
`location`. The bundle applies the stored or system appearance before the
first shell render, so no pre-paint script exists. The in-frame inspector
script of the [frame adapter contract](./mokly-frame-adapter.md) is unchanged.

## Catalogue Index

The index is the read model v7 of the
[catalogue contract](./mokly-catalogue.md), which owns its fields and the tree
rules. It carries `schemaVersion: 7`, `identity`, `deploymentId`, one integer
`revision`, the `base` ref when Changes is configured, `changesStatus`,
`comparisonUrl`, `tree`, every current entry record, and `removedEntries`.
Each view keeps `viewport`, `colorScheme`, and `comparison` and has no `usage`
and no `resourceEvidence`; the index reader rejects either field anywhere. In
Serve the index carries `live: { generation }`, where `generation` is the
bundle generation of the consumer JavaScript or `null` when the catalogue has
none; a static build has no `live` field. The index is canonical JSON.

## Entry Detail

One detail document exists per entry: under `mokly-viewer/entries/` for a
current entry, and under the comparison generation that records it for a
removed entry.

```ts
interface EntryDetailV1 {
  schemaVersion: 1;
  identity: { id: string; title: string };
  deploymentId?: string; // current entries: equal to the index
  revision?: number; // current entries: equal to the index
  generation?: string; // removed entries: the comparison generation
  entry: { path: string; kind: CatalogueRecord["kind"]; snapshotId?: string };
  views: readonly DetailView[]; // empty for pages, documents, and use cases
  resourceEvidence?: ResourceEvidence; // pages only
  workspace?: Workspace; // screens and components only
}
interface DetailView {
  viewport: Viewport;
  colorScheme: ColorScheme;
  documentKey: string; // SHA-256 of the rendered document's bytes
  usage: CatalogueUsage;
  resourceEvidence?: ResourceEvidence;
}
interface Workspace {
  status?: "Added" | "Changed" | "Removed" | "Unmodified";
  comparisonEligible: boolean;
  usedBy: readonly UsageLink[];
  affected: readonly UsageLink[];
  relatedComponents: readonly { path: string; title: string }[];
  inputChanges: readonly InputChange[];
}
interface UsageLink {
  entryPath: string;
  entryKind: "screen" | "component";
  title: string;
  viewport: Viewport;
  colorScheme: ColorScheme;
  instanceKey: string;
  direct: boolean;
  removed: boolean;
  comparisonEligible: boolean;
}
interface InputChange {
  instanceId: string;
  title: string;
  viewport: Viewport;
  colorScheme: ColorScheme;
  variantPath?: string;
  before: ComponentWireProps;
  after: ComponentWireProps;
}
```

A current entry's detail carries `deploymentId` and `revision` and no
`generation`. A removed entry's detail carries `generation` and `snapshotId`
and neither of the other two, so a generation's files never change.
`CatalogueUsage`, `ResourceEvidence`, and `ComponentWireProps` keep the shapes
of the catalogue contract. `documentKey` changes exactly when the rendered
document's bytes change. `usedBy` lists the current uses of a component,
`affected` the consumers that a changed component affects, `relatedComponents`
the changed components that affect a screen, and `inputChanges` the instances
whose props differ from the base render; `status` is absent while Changes is
unknown. The generated TypeScript types are the normative shapes. A detail is
canonical JSON. One build writes every detail, so a view's usage is `ready`,
`pending`, or `unavailable` and never omitted.

## Live Descriptor

Serve answers `/mokly-viewer/live.json` with the live descriptor v3:
`schemaVersion: 3`, the bundle `generation`, and the temporary-render
capability of the component controls contract. The shell fetches it when the
index carries a `live.generation` string, at start and again when that value
changes. When the fetch fails, browsing works and live prop editing is
unavailable with a browser warning. A static build has no live descriptor.

## Fetch And Fences

At start the shell fetches the index, then the detail of the routed entry. It
renders the navigation when the index arrives and the frames when the detail
arrives. On navigation inside the shell it commits the route from the index
at once and fetches the destination's detail. It accepts a current entry's
detail only when `identity`, `deploymentId`, and `revision` equal the
installed index. On a revision mismatch it refetches the index once; if the
pair still disagrees, the entry shows its unavailable state with a retry
control. A different `deploymentId` means another deployment replaced the
files: the standalone shell performs a full page load of the requested URL
instead of mixing deployments, and an embedded React host receives one
`onError` and keeps its state. It accepts a removed entry's detail only when
`identity` equals the index, `generation` equals the generation that the
index's `comparisonUrl` names, and `snapshotId` equals the index's removed
record for that path.

Every fetch uses `credentials: "omit"`, stays same-origin, and rejects a
redirect outside the origin. Serve sends `Cache-Control: no-store` on every
JSON route. The index and the details of one build are immutable, so a static
host may cache them under the revalidation rules of the static delivery
contract, and the shell keeps them for the page's lifetime.

## Updates In Serve

Serve publishes one state per completed action: a rebuild after a source
change, a Changes completion or status move, a bundle change, or a completed
on-demand render; the server may combine several completions into one
publication. Each publication replaces the index and the details in one step
and raises `revision` by one. The event stream writes one message per
publication whose `id` is the new revision and whose `data` field is empty;
on every new connection the server writes one message with the current
revision at once.

On a message whose id is above the installed revision, the shell cancels a
refresh still in flight, fetches the index and the current entry's detail,
requires one `revision` on both at or above the message id, and adopts them
in one store commit. The navigation, the Changes marks, Usage, and the details
panel update in place. The shell reloads only the mounted frames whose
`documentKey` changed. When `live.generation` changed, it refetches the live
descriptor and replaces the render capability. When the current entry is no
longer in the index, it shows the missing state and keeps the URL. The page
never reloads. When a fetch fails or the pair disagrees after one more index fetch,
the shell keeps its installed state and shows the entry as unavailable with
retry; the next message starts a fresh refresh.

## Identity

`build` computes `deploymentId` as the hash of every installed file of the
output under the [static export browser contract](./mokly-export-browser.md),
with the `deploymentId` field of the index and the details set to 64 zeros
while hashing; generation files carry no deployment id, so one comparison
gives the same bytes in every build. Serve chooses one `deploymentId` for the
life of the server process, for example the hash of the catalogue identity and
a start value, so a different id always means another build or another server
process. `revision` orders the states of one Serve process, which publishes
its first state as `1`; a build writes `revision: 0`.

## Embedded Viewer

`MoklyViewer` takes an `index` source and a `detail` source instead of one
catalogue source: the index as an object or a URL, and the detail as a
function from an entry path and an optional snapshot id to an object, a URL,
or a promise of either. There is no `@mokly/viewer/server` entry and no `renderViewer`; a React host
renders the viewer in the browser. The
`@mokly/viewer/browser` entry mounts the standalone shell into the stub's
mount element. The [embeddable viewer contract](./mokly-viewer.md) owns the
props.

## Fail-Closed Rules

| Condition                                                                                    | Shell behaviour                                                                         |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| an index, detail, or live descriptor with another `schemaVersion`                            | the version error state of the [viewer namespace](./mokly-viewer-namespace.md) contract |
| a current entry's detail whose identity or revision differs from the index after one refetch | the entry's unavailable state with retry                                                |
| a detail or index with another `deploymentId`                                                | a full page load in the standalone shell; one `onError` in an embedded host             |
| a removed entry's detail whose identity, generation, or snapshot id differs from the index   | the entry's unavailable state with retry                                                |
| a live descriptor that fails while the index names a generation                              | browsing works; live prop editing is unavailable with a browser warning                 |
| a JSON route that redirects outside the origin, has another type, or fails                   | the entry's unavailable state with retry                                                |

## Related Docs

- [Rust core architecture](../architecture/rust-core.md)
- [Public catalogue read model](./mokly-catalogue.md)
- [Live viewer capabilities](./mokly-live-capabilities.md)
- [Static export delivery](./mokly-export-delivery.md)
- [Embeddable Mokly viewer](./mokly-viewer.md)
- [Format inventory](./mokly-format-versions.md)
