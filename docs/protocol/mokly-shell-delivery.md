# Shell Delivery And Read Model Routes

Status: In progress under the [shell views plan](../../plans/ui-package-shell-views.md).

## Purpose And Boundary

The browser renders Browse from a stub, an index, and entry details. The index
holds navigation and metadata. Details hold usage, comparison evidence and
workspaces. Serve and `build` deliver them. Navigation fetches the route's details.
No process renders shell HTML.

## Routes

Serve answers these routes over HTTP. `build` writes them as files under the
output directory with the same relative paths, so a static host needs no
rewrite rules.

| Route                                                                                        | Serve     | `build`                                 | Content                                                    |
| -------------------------------------------------------------------------------------------- | --------- | --------------------------------------- | ---------------------------------------------------------- |
| `/`, `/index.html`, `/view/<route>`                                                          | 200       | `index.html`, `view/<route>/index.html` | the shell stub, identical for every route                  |
| `/404.html`, `/view/`                                                                        | 200 / 404 | `404.html`                              | the same stub; `/view/` has no entry and returns 404       |
| `/mokly-viewer/index.json`                                                                   | live      | file                                    | the catalogue index v9                                     |
| `/mokly-viewer/deployment.json`                                                              | absent    | file                                    | the deployment file v1                                     |
| `/mokly-viewer/entries/<entry path>.json`                                                    | live      | one file per current entry              | the entry detail v4                                        |
| `/mokly-viewer/diffs/generations/<generation>/`                                              | live      | absent                                  | the generation root: 204 while Serve retains it            |
| `/mokly-viewer/diffs/generations/<generation>/entries/<entry path>.json`                     | live      | one file per removed entry              | the entry detail v4 of a removed entry's historical record |
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
of one deployment: the document type, an `<html>` element with `lang="en"` and
the shell's document class, a `<title>` with the catalogue title, the
`/mokly-viewer/shell.css` stylesheet link, an SVG icon link
to `/mokly-viewer/client/brand.svg` using the Browse brand mark, one
`<div data-mokly-shell>` mount element, a `<noscript>` sentence that says the
catalogue needs JavaScript, and one `<script type="module" src="/mokly-viewer/client/shell.js">`. It embeds no
catalogue data, no descriptor, and no route; the shell reads the route from
`location` and applies the stored or system appearance before its first
render. Before the bundle runs, the shell stylesheet gives the stub the Auto
interface appearance through the document class, under the
[appearance contract](./mokly-viewer-appearance.md#standalone-appearance-control).
The in-frame inspector script is the [frame adapter's](./mokly-frame-adapter.md).

## Catalogue Index

The index is the read model v9 of the
[catalogue contract](./mokly-catalogue.md), which owns its fields and the tree
rules: `schemaVersion: 8`, `identity`, `deploymentId`, one integer `revision`,
the `base` ref when Changes is configured, `baseCommit` while Changes is
ready, `changesStatus`, `comparisonUrl`, `tree`, every current entry record,
and `removedEntries`. Each current and removed record carries the `detailId`
of its detail. Each view of a screen
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

The [generated entry detail v4 type](../../packages/viewer/src/generated/catalogue/EntryDetailV4.ts)
defines the detail, view, evidence, and workspace shapes.
A screen or component detail includes `controlOrder`, listing every editable
property exactly once in the [control declaration order](./mokly-component-controls.md).
Other kinds omit it. Current and removed entries follow the same ordering rule.

A current entry's detail carries `detailId` and `revision` and no
`deploymentId` or `generation`; a removed entry's detail carries `detailId`
and `snapshotId` and no `revision`, `deploymentId`, or `generation`, so a
generation's files never change. The detail id is the content id from the
[catalogue serialization contract](./mokly-catalogue-serialization.md#detail-identity).
`RuleEvidence` and `ResourceEvidence` are the per-view records of the
[comparison contract](./mokly-comparison.md#review-result-v8-and-snapshot-v4),
present only while Changes is `ready` under
[CSS attribution membership](./mokly-css-attribution-membership.md);
`CatalogueUsage` has the shape of the
[usage records](./mokly-component-usage-records.md#record-shapes).
`ComponentWireProps` has the shape of the
[canonical wire props](./mokly-component-props.md#canonical-wire-props).
A screen or component view carries its review `state` and its sorted unique
`ignoredIds` exactly when it carries `resourceEvidence`. A ready current
screen or component that has a base side carries `before`, the base side's
path, title, saved props and, on a component, supplied slots, under the
[component comparison records](./mokly-component-comparison-records.md#sides-and-pairing).
The before side of a comparison uses that path, so a moved or case-renamed
entry finds its base documents.
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

The workspace of a current component variant omits `usedBy` and `affected`.
Its page reads both lists from its component parent's detail. Screens,
component parents, and removed entries keep both lists in their own workspaces.
Keeping copies on current variants was rejected because it repeats most of the
usage data. Moving `affected` in a later format change was rejected because
the same parent request carries both lists. The core rejects either list on a
current component variant under the
[misplaced-field rule](./mokly-catalogue-serialization.md#versions).
Checking this placement only in tests was rejected because a writer bug must
fail before a build or publication exposes it.

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

The [shell fetch and fence rules](./mokly-shell-fences.md) give how the shell
fetches the index, the details, and the deployment file, when it accepts a
detail, and how it answers each failed or mismatched response.

## Updates In Serve

Serve publishes one revision for a completion that changes the index or a
detail. This includes rebuilds, Changes status updates, bundle changes, and
on-demand renders. Serve may combine completions into one publication.
An index or detail GET starts no render or Git command. A failed candidate
leaves the last published state in place.
Each publication replaces the index and the details in one step and raises
`revision` by one. The index of each publication lists the `detailId` of each
of its details. A detail whose content does not change keeps its `detailId`
and its bytes, apart from `revision`. The event stream writes one message per
publication whose
`id` is the new revision and whose `data` is the server's `deploymentId`, and
one message with the current values on every new connection.

On a message whose `data` differs from the installed `deploymentId`, another
server process answers, and the standalone shell performs a full page load of
the current URL. On a message whose id is above the installed revision, the
shell cancels a refresh still in flight, fetches the index and the current
route's details, including a current component variant's parent detail,
requires one `revision` on all of them at or above the message id,
and adopts them in one store commit: the navigation, the Changes marks,
Usage, and the details panel update in place, and only the mounted frames
whose `documentKey` in the refreshed index changed reload, whether a frame
shows a screen or component view, a page, a document, or a use-case step.
When `live.generation` changed, the shell refetches the live descriptor and
replaces the render capability; a current entry the index no longer lists
shows the missing state under the kept URL until an index lists it again; no
other update reloads the page. When a fetch fails or the details disagree after
one more index fetch, the shell keeps its state, shows the entry as
unavailable with retry, and waits for the next message. That state waits until
each route detail, including a current component variant's parent detail, has
arrived, failed, or been replaced.

## Identity

`build` computes `deploymentId` as the hash of every identity-participating output file under the
[static export browser contract](./mokly-export-browser.md). It sets only the
index's `deploymentId` to 64 zeros for this hash; current detail ids are
content ids and the deployment file is excluded. Generation files carry no
deployment id, so one comparison gives the same bytes in every build. Serve
keeps one id per process. `build` writes the canonical
`mokly-viewer/deployment.json` object with `schemaVersion: 1` and that id.
A new id means another build or process.
`revision` orders the states of one Serve process from `1`; a build writes `0`.

## Embedded Viewer

`MoklyViewer` takes `index` as an object or URL and `detail` as a function from an
entry path and optional snapshot id to an object, URL, or promise of either. Hosts use their own
React. `@mokly/viewer/browser` mounts the standalone shell in the stub's mount element.
The [embeddable viewer contract](./mokly-viewer.md) owns the props.
