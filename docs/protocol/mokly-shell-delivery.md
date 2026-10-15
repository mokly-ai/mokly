# Shell Delivery And Read Model Routes

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Purpose And Boundary

The Browse shell is a browser application. Serve and `build` deliver a shell
stub, a catalogue index that holds what every page needs, and one detail per
entry that holds what that entry needs. The shell renders itself from them and
fetches the next detail on navigation; no process renders shell HTML.

## Routes

Serve answers these routes over HTTP. `build` writes them as files under the
output directory with the same relative paths, so a static host needs no
rewrite rules.

| Route                                                                                        | Serve     | `build`                                 | Content                                                    |
| -------------------------------------------------------------------------------------------- | --------- | --------------------------------------- | ---------------------------------------------------------- |
| `/`, `/index.html`, `/view/<route>`                                                          | 200       | `index.html`, `view/<route>/index.html` | the shell stub, identical for every route                  |
| `/404.html`, `/view/`                                                                        | 200 / 404 | `404.html`                              | the same stub; `/view/` has no entry and returns 404       |
| `/mokly-viewer/index.json`                                                                   | live      | file                                    | the catalogue index v7                                     |
| `/mokly-viewer/entries/<entry path>.json`                                                    | live      | one file per current entry              | the entry detail v1                                        |
| `/mokly-viewer/diffs/generations/<generation>/review.json`                                   | live      | file                                    | review result v8, under the comparison contract            |
| `/mokly-viewer/diffs/generations/<generation>/entries/<entry path>.json`                     | live      | one file per removed entry              | the entry detail v1 of a removed entry's historical record |
| `/mokly-viewer/live.json`                                                                    | live      | absent                                  | the live descriptor v3: the render capability              |
| `/mokly-viewer/events`                                                                       | live      | absent                                  | the event stream: one message per publication              |
| `/static/**`, `/mokly-viewer/client/**`, `/mokly-viewer/shell.css`, `/mokly-viewer/fonts/**` | live      | files                                   | documents, the shell bundle, styles, and fonts             |

`<route>` is the entry route of the [path contract](./mokly-paths.md).
`<entry path>` is the entry's path with `.json` appended; a path segment never
contains `..`, and the file for `a/b` and the directory for `a/b/c` coexist.
The routes under `diffs/` belong to the
[comparison serving contract](./mokly-comparison-serving.md), those under
`components/` to the [component controls contract](./mokly-component-controls.md),
and rendering on first request to the [on-demand contract](./mokly-on-demand.md).
Every JSON route answers GET and HEAD with `application/json; charset=utf-8`
and `X-Content-Type-Options: nosniff`. Serve sends no
`Access-Control-Allow-Origin` header on any route; a host that serves the
static output to another origin applies the
[cross-origin rules](./mokly-export-delivery.md#headers-caching-and-revalidation)
to the public paths of the [viewer namespace](./mokly-viewer-namespace.md#public-paths), which never include the live descriptor or the event stream.

## The Stub

The stub is one HTML document, written once per shell route by `build` and
returned for every shell route by Serve, with identical bytes for every route
of one deployment: the document type, `lang="en"`, a `<title>` with the
catalogue title, the `/mokly-viewer/shell.css` stylesheet link, one
`<div data-mokly-shell>` mount element, a `<noscript>` sentence that says the
catalogue needs JavaScript, and one
`<script type="module" src="/mokly-viewer/client/shell.js">`. It embeds no
catalogue data, no descriptor, and no route; the shell reads the route from
`location` and applies the stored or system appearance before its first
render. The in-frame inspector script is the [frame adapter's](./mokly-frame-adapter.md).

## Catalogue Index

The index is the read model v7 of the
[catalogue contract](./mokly-catalogue.md), which owns its fields and the tree
rules: `schemaVersion: 7`, `identity`, `deploymentId`, one integer `revision`,
the `base` ref when Changes is configured, `changesStatus`, `comparisonUrl`,
`tree`, every current entry record, and `removedEntries`. Each view of a
screen or component carries `viewport`, `colorScheme`, `comparison`, and
`documentKey`; a page record carries one `documentKey`, a document record one
per colour scheme. `documentKey` is the document node's key in the
[render graph](../architecture/rust-core.md#render-graph), the hash of the
document's inputs: it exists before the render and changes exactly when an
input changes. No record carries `usage` or `resourceEvidence`; the reader
rejects either anywhere. In Serve the index carries `live: { generation }`,
the render generation: the hash of every input a live prop render depends on,
the config, the stylesheet bundles, the HTML component sources, and the
consumer bundle generation when the catalogue has JavaScript. A static build
has no `live` field. The index is canonical JSON.

## Entry Detail

One detail exists per entry: under `mokly-viewer/entries/` for a current
entry, and under the comparison generation that records a removed entry.

```ts
interface EntryDetailV1 {
  schemaVersion: 1;
  identity: { id: string; title: string };
  deploymentId?: string; // current entries: equal to the index
  revision?: number; // current entries: equal to the index
  generation?: string; // removed entries: the comparison generation
  entry: { path: string; kind: CatalogueRecord["kind"]; snapshotId?: string };
  views: readonly DetailView[]; // empty for pages, documents, and use cases
  resourceEvidence?: ViewEvidence; // pages only; present when ready
  workspace?: Workspace; // screens and components, when all list inputs are proven
}
interface DetailView {
  viewport: Viewport;
  colorScheme: ColorScheme;
  usage: CatalogueUsage;
  resourceEvidence?: ViewEvidence; // present on every ready view
}
interface ViewEvidence {
  rules: readonly RuleEvidence[]; // review v8 with owners; [] when it omits the list
  resources: readonly ResourceEvidence[]; // review v8 with owners; [] when omitted
}
interface Workspace {
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
`generation`; a removed entry's detail carries `generation` and `snapshotId`
and neither of the other two, so a generation's files never change.
`RuleEvidence` and `ResourceEvidence` are the per-view records of the
[comparison contract](./mokly-comparison.md#review-result-v8-and-snapshot-v4),
present only while Changes is `ready` under
[CSS attribution membership](./mokly-css-attribution-membership.md);
`CatalogueUsage` and `ComponentWireProps` are the catalogue contract's shapes.
`usedBy` lists the current uses of a component, `affected` the consumers a
changed component affects, `relatedComponents` the changed components that
affect a screen, and `inputChanges` the instances whose props differ from the
base render; the entry's change state is the index's `changes.kind`. The
generated TypeScript types are normative, and a detail is canonical JSON. In
Serve a view's usage is `pending` until its first render completes and the
next publication replaces the detail; `build` renders every view before it
writes, so a built detail carries no `pending` view.

A screen or component detail omits `workspace` until every input of its lists
is proven. Pending or unavailable consumer usage cannot prove a complete list.

## Live Descriptor

```ts
interface LiveDescriptorV3 {
  schemaVersion: 3;
  generation: string; // equal to the index's live.generation
  render: { url: "/mokly-viewer/components/render"; token: string };
}
```

Serve answers `/mokly-viewer/live.json` with the render generation and the
temporary-render capability of the component controls contract. The shell
fetches it whenever the index carries `live`, at start and when
`live.generation` changes; a catalogue without JavaScript has one too, because
the Rust core renders an HTML entry with edited props itself. When the fetch
fails, browsing works, live prop editing is unavailable with a browser
warning, and the shell retries on the next publication message. A static
build has none.

## Fetch And Fences

At start the shell fetches the index, then the detail of the routed entry and,
for a use case, the detail of each step screen whose views its frames show; it
renders the navigation when the index arrives and the frames when those
details arrive. On navigation inside the shell it commits the route from the
index at once and fetches the destination's details. It accepts a current entry's
detail only when `identity`, `deploymentId`, and `revision` equal the
installed index. On a revision mismatch it refetches the index once; if the
pair still disagrees, the entry shows its unavailable state with retry. A
different `deploymentId` means another deployment replaced the files: the
standalone shell performs a full page load of the requested URL, and an
embedded React host receives one `onError` and keeps its state. It accepts a
removed entry's detail only when `identity` equals the index, `generation`
equals the generation that the index's `comparisonUrl` names, and
`snapshotId` equals the index's removed record for that path.

Every fetch is an ordinary GET without custom headers, uses
`credentials: "omit"`, stays same-origin, and rejects a redirect outside the
origin; a URL source is HTTP(S) without userinfo or fragment. Serve sends `Cache-Control: no-store` on every
JSON route. The index and the details of one build are immutable: a static
host may cache them under the static delivery contract's revalidation rules,
and the shell keeps them for the page's lifetime.

## Updates In Serve

Serve publishes one state per completed action: a rebuild after a source
change, a Changes completion or status move, a bundle change, or a completed
on-demand render, and may combine several completions into one publication. A GET of the index
or a detail starts no render and no Git command, and a failed candidate
leaves the last published state in place.
Each publication replaces the index and the details in one step and raises
`revision` by one. The event stream writes one message per publication whose
`id` is the new revision and whose `data` is the server's `deploymentId`, and
one message with the current values on every new connection.

On a message whose `data` differs from the installed `deploymentId`, another
server process answers, and the standalone shell performs a full page load of
the current URL. On a message whose id is above the installed revision, the
shell cancels a refresh still in flight, fetches the index and the current
route's details, requires one `revision` on all of them at or above the message id,
and adopts them in one store commit: the navigation, the Changes marks,
Usage, and the details panel update in place, and only the mounted frames
whose `documentKey` in the refreshed index changed reload, whether a frame
shows a screen or component view, a page, a document, or a use-case step.
When `live.generation` changed, the shell refetches the live descriptor and
replaces the render capability; when the current entry is no longer in the
index, it shows the missing state and keeps the URL; no other update reloads
the page. When a fetch fails or the pair disagrees after one more index fetch,
the shell keeps its state, shows the entry as unavailable with retry, and
waits for the next message.

## Identity

`build` computes `deploymentId` as the hash of every installed file of the
output under the [static export browser contract](./mokly-export-browser.md),
with the `deploymentId` field of the index and the details set to 64 zeros
while hashing; generation files carry no deployment id, so one comparison
gives the same bytes in every build. Serve chooses one `deploymentId` for the
life of the server process, for example the hash of the catalogue identity and
a start value, so a different id always means another build or server process.
`revision` orders the states of one Serve process from `1`; a build writes `0`.

## Embedded Viewer

`MoklyViewer` takes an `index` source, an object or a URL, and a `detail`
source, a function from an entry path and an optional snapshot id to an
object, a URL, or a promise of either; a React host renders it in the browser
with its own React. The `@mokly/viewer/browser` entry mounts the standalone
shell into the stub's mount element. The
[embeddable viewer contract](./mokly-viewer.md) owns the props.

## Fail-Closed Rules

| Condition                                                                                                                                                                                                                                                               | Shell behaviour                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| an index, detail, or live descriptor with another `schemaVersion` of the [format inventory](./mokly-format-versions.md)                                                                                                                                                 | the version error state of the [viewer namespace](./mokly-viewer-namespace.md) contract |
| a detail, an index, or an event message with another `deploymentId`                                                                                                                                                                                                     | a full page load in the standalone shell; one `onError` in an embedded host             |
| a live descriptor that fails while the index carries `live`                                                                                                                                                                                                             | browsing works; live prop editing is unavailable with a browser warning                 |
| a current entry's detail whose identity or revision differs from the index after one refetch, a removed entry's detail whose identity, generation, or snapshot id differs from the index, or a JSON route that redirects outside the origin, has another type, or fails | the entry's unavailable state with retry                                                |
