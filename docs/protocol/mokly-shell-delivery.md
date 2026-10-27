# Shell Delivery And Read Model Routes

## Purpose And Boundary

The browser renders Browse from a stub, an index, and entry details. The index
holds navigation and metadata. Details hold usage, comparison evidence and
workspaces. Serve and `build` deliver them. Navigation fetches the next detail.
No process renders shell HTML.

## Routes

Serve answers these routes over HTTP. `build` writes them as files under the
output directory with the same relative paths, so a static host needs no
rewrite rules.

| Route                                                                                        | Serve     | `build`                                 | Content                                                    |
| -------------------------------------------------------------------------------------------- | --------- | --------------------------------------- | ---------------------------------------------------------- |
| `/`, `/index.html`, `/view/<route>`                                                          | 200       | `index.html`, `view/<route>/index.html` | the shell stub, identical for every route                  |
| `/404.html`, `/view/`                                                                        | 200 / 404 | `404.html`                              | the same stub; `/view/` has no entry and returns 404       |
| `/mokly-viewer/index.json`                                                                   | live      | file                                    | the catalogue index v7                                     |
| `/mokly-viewer/entries/<entry path>.json`                                                    | live      | one file per current entry              | the entry detail v2                                        |
| `/mokly-viewer/diffs/generations/<generation>/review.json`                                   | live      | file                                    | review result v8, under the comparison contract            |
| `/mokly-viewer/diffs/generations/<generation>/entries/<entry path>.json`                     | live      | one file per removed entry              | the entry detail v2 of a removed entry's historical record |
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
catalogue title, the `/mokly-viewer/shell.css` stylesheet link, an SVG icon link
to `/mokly-viewer/client/brand.svg` using the Browse brand mark, one
`<div data-mokly-shell>` mount element, a `<noscript>` sentence that says the
catalogue needs JavaScript, and one `<script type="module" src="/mokly-viewer/client/shell.js">`. It embeds no
catalogue data, no descriptor, and no route; the shell reads the route from
`location` and applies the stored or system appearance before its first
render. The in-frame inspector script is the [frame adapter's](./mokly-frame-adapter.md).

## Catalogue Index

The index is the read model v7 of the
[catalogue contract](./mokly-catalogue.md), which owns its fields and the tree
rules: `schemaVersion: 7`, `identity`, `deploymentId`, one integer `revision`,
the `base` ref when Changes is configured, `changesStatus`, `comparisonUrl`,
`tree`, every current entry record, and `removedEntries`. Each view of a screen
or component carries `viewport`, `colorScheme`, `comparison`, and `documentKey`;
a page record carries one `documentKey`, a document record one per colour
scheme. `documentKey` is the document node's key in the
[render graph](../architecture/rust-core.md#render-graph), the hash of the
document's inputs: it exists before the render and changes exactly when an input
changes. No record carries `usage` or `resourceEvidence`; the reader rejects
either anywhere. In Serve the index carries `live: { generation }`, the render
generation: the hash of the config, every `documentKey`, every stylesheet bundle
and its assets, and any consumer bundle generation. It is wider than a live prop
render needs, on purpose: a narrower hash could miss an input and keep a stale
descriptor. A static build has no `live` field. The index is canonical JSON.

## Entry Detail

One detail exists per entry: under `mokly-viewer/entries/` for a current
entry, and under the comparison generation that records a removed entry.

The [generated entry detail v2 type](../../packages/viewer/src/generated/catalogue/EntryDetailV2.ts)
defines the detail, view, evidence, and workspace shapes.
A screen or component detail includes `controlOrder`, listing every editable
property exactly once in the [control declaration order](./mokly-component-controls.md).
Other kinds omit it. Current and removed entries follow the same ordering rule.

A current entry's detail carries `deploymentId` and `revision` and no
`generation`; a removed entry's detail carries `generation` and `snapshotId`
and neither of the other two, so a generation's files never change.
`RuleEvidence` and `ResourceEvidence` are the per-view records of the
[comparison contract](./mokly-comparison.md#review-result-v8-and-snapshot-v4),
present only while Changes is `ready` under
[CSS attribution membership](./mokly-css-attribution-membership.md);
`CatalogueUsage` has the shape of the
[usage records](./mokly-component-usage-records.md#record-shapes).
`ComponentWireProps` has the shape of the
[canonical wire props](./mokly-component-props.md#canonical-wire-props).
`reasons` carries classification reasons in the review v8 `EntryChangeReason` shape and sorted unique order, under the same reason policy.
Pages and documents have no review record. Their details carry the classification's direct reasons under this policy.
Ready included current and removed entries carry `reasons`. A pure move carries `[]`. Other entries omit the field.
Reasons are independent of `workspace` and remain available before usage is proven.
`usedBy` lists the current uses of a component, `affected` the consumers a
changed component affects, `relatedComponents` the changed components that
affect the entry's own views, and `inputChanges` the instances whose props
differ from the base render. The affected evidence keys each changed component
by the entry whose views it names, so a component variant's detail names the
changed components that its own views use, and a parent's detail only those of
the parent's own views. That entry's detail is `comparisonEligible` when it can
be compared; the entry's change state is the index's `changes.kind`. The
generated TypeScript types are normative, and a detail is canonical JSON. In
Serve a view's usage is `pending` until its first render completes and the
next publication replaces the detail; `build` renders every view before it
writes, so a built detail carries no `pending` view.

A screen or component detail omits `workspace` until every input of its lists
is proven. Pending or unavailable consumer usage cannot prove a complete list.

## Live Descriptor

The [generated `LiveDescriptorV3` type](../../packages/viewer/src/generated/catalogue/LiveDescriptorV3.ts)
defines the descriptor. Its `generation` equals the index's `live.generation`.

Serve supplies the component controls contract's render generation and capability
at `/mokly-viewer/live.json`. The shell fetches it when the index carries
`live`, at start and when `live.generation` changes. Serve supports edited
props for HTML entries too. With no descriptor, Props shows
`Preparing to edit props…` and read-only fields. Refetch keeps the installed
capability until its replacement installs. On failure, browsing works; Props
shows `Editing could not start.` and `Try again` to fetch again. The shell also
retries on the next publication message. Static builds have no descriptor.

## Fetch And Fences

At start the shell fetches the index, then the detail of the routed entry and,
for a use case, the detail of each step screen whose views its frames show; it
renders the navigation when the index arrives and the frames when those
details arrive. On navigation inside the shell it commits the route from the
index at once and fetches the destination's details. It accepts a current entry's
detail only when `identity`, `deploymentId`, and `revision` equal the
installed index. On a revision mismatch it refetches the index once; if the
pair still disagrees, the entry shows its unavailable state with retry. A use
case shows its unavailable state only after each of its details has arrived,
failed, or been replaced; until then its stage keeps loading, and an embedded
host still receives the `onError` of each failure at once. A
different `deploymentId` means another deployment replaced the files: the
standalone shell performs a full page load of the requested URL, and an
embedded React host receives one `onError` and keeps its state. From then on
the shell loads no index or detail, closes the event stream, and reports no
later failure. A route that still
waits for a detail has the replaced delivery status: in both hosts its stage
keeps the loading state, never the unavailable state, until the new data
arrives with the full page load or the `index` that the host supplies. A route
whose details all arrived keeps them. It accepts a removed entry's
detail only when `identity` equals the index, `generation`
equals the generation that the index's `comparisonUrl` names, and
`snapshotId` equals the index's removed record for that path.

Every fetch uses ordinary GET without custom headers and `credentials: "omit"`.
URL sources use HTTP(S) without userinfo or fragments. Fetches stay same-origin
and reject cross-origin redirects. Serve JSON uses `Cache-Control: no-store`.
Static hosts may cache the immutable index and details under the [static revalidation rules](./mokly-export-delivery.md#headers-caching-and-revalidation).
The shell keeps the index and details for the page's lifetime.

## Updates In Serve

Serve publishes one revision for a completion that changes the index or a
detail. This includes rebuilds, Changes status updates, bundle changes, and
on-demand renders. Serve may combine completions into one publication.
An index or detail GET starts no render or Git command. A failed candidate
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
replaces the render capability; a current entry the index no longer lists
shows the missing state under the kept URL until an index lists it again; no
other update reloads the page. When a fetch fails or the pair disagrees after
one more index fetch, the shell keeps its state, shows the entry as
unavailable with retry, and waits for the next message; a use case shows that
state only after each of its details has arrived, failed, or been replaced.

## Identity

`build` computes `deploymentId` as the hash of every installed output file under the
[static export browser contract](./mokly-export-browser.md), with index and
detail `deploymentId` fields set to 64 zeros. Generation files carry no deployment id,
so one comparison gives the same bytes in every build. Serve keeps one id per process.
A new id means another build or process.
`revision` orders the states of one Serve process from `1`; a build writes `0`.

## Embedded Viewer

`MoklyViewer` takes `index` as an object or URL and `detail` as a function from an
entry path and optional snapshot id to an object, URL, or promise of either. Hosts use their own
React. `@mokly/viewer/browser` mounts the standalone shell in the stub's mount element.
The [embeddable viewer contract](./mokly-viewer.md) owns the props.

## Fail-Closed Rules

| Condition                                                                                                                                                                                                                                                               | Shell behaviour                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| an index, detail, or live descriptor with another `schemaVersion` of the [format inventory](./mokly-format-versions.md)                                                                                                                                                 | the version error state of the [viewer namespace](./mokly-viewer-namespace.md) contract                                 |
| a detail, an index, or an event message with another `deploymentId`                                                                                                                                                                                                     | a full page load in the standalone shell; one `onError` and a loading stage in an embedded host                         |
| a detail or a publication refresh that fails after another `deploymentId` answered                                                                                                                                                                                      | the replaced status: the stage keeps its loading state, and the failure is not reported                                 |
| a live descriptor that fails while the index carries `live`                                                                                                                                                                                                             | browsing works; live prop editing shows `Editing could not start.` with `Try again`, which fetches the descriptor again |
| a current entry's detail whose identity or revision differs from the index after one refetch, a removed entry's detail whose identity, generation, or snapshot id differs from the index, or a JSON route that redirects outside the origin, has another type, or fails | the entry's unavailable state with retry; for a use case, once each of its details arrived, failed, or was replaced     |
