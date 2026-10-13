# Shell Delivery And Read Model Routes

## Delivery Status

Approved target of the [Rust rebuild plan](../../plans/rust-rebuild.md),
Decision 21; not implemented. The frozen TypeScript backend renders the Browse
shell on the server and hydrates it in the browser under the
[viewer SSR contract](./mokly-viewer-ssr.md), embeds an
[entry-scoped bootstrap](./mokly-shell-bootstrap.md) in every page, serves one
complete `mokly-viewer/catalogue.json`, and marks static pages with the
delivery descriptor of the [static delivery contract](./mokly-export-delivery.md).
This page replaces all four for the Rust core: the shell renders in the
browser from JSON routes, and no page carries data.

## Purpose And Boundary

The Browse shell is a browser application. Serve and `build` deliver the same
three things: a shell stub, a catalogue index, and one detail document per
entry. The shell renders itself from the index and the current entry's detail,
resolves routes against the index, and fetches the next entry's detail on
navigation. No process renders shell HTML. A catalogue without JavaScript
starts no sidecar, and the Rust core never produces shell markup.

The index and the detail are the public read model, split by how the shell
uses them. The index holds what every page needs. The detail holds what one
entry needs.

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
| `/mokly-viewer/live.json`                                                                    | live  | absent                                  | the live descriptor v3                                     |
| `/mokly-viewer/events`                                                                       | live  | absent                                  | the update event stream, unchanged                         |
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
[catalogue contract](./mokly-catalogue.md) without per-view usage and without
resource evidence. It carries `schemaVersion: 7`, `identity`, `deploymentId`,
`revision`, `changesStatus`, `comparisonUrl`, `tree`, every current entry
record, and `removedEntries`. Each view keeps `viewport`, `colorScheme`, and
`comparison` and has no `usage` and no `resourceEvidence`; the index reader
rejects either field anywhere. The index is canonical JSON. The catalogue
contract owns every other field and the tree rules.

## Entry Detail

One detail document exists per entry: under `mokly-viewer/entries/` for a
current entry, and under the comparison generation that records it for a
removed entry. A detail carries:

- `schemaVersion: 1`;
- `identity`, `deploymentId`, and `revision`, equal to the index it belongs
  to;
- `entry`: the entry's `path` and `kind`, plus `snapshotId` for a removed
  entry's historical record;
- `views`: for each view of the entry, its `viewport`, `colorScheme`,
  `usage`, and optional `resourceEvidence`, with the shapes the catalogue
  contract gives those fields;
- `workspace`: for a screen or component, the Used by and Affected lists,
  the related components, and the input changes, with the `WorkspaceData`
  shape of the [live capabilities contract](./mokly-live-capabilities.md)
  without `renderCapability`; absent for pages, documents, and use cases.

A detail is canonical JSON. One build writes every detail of a deployment,
so a view's usage is `ready`, `pending`, or `unavailable` and never omitted.

## Live Descriptor

Serve answers `/mokly-viewer/live.json` with the live descriptor v3:
`schemaVersion: 3`, the base ref, the catalogue `identity`, the `revision`,
the `updateVersion`, the optional `previewGeneration`, and the optional
temporary-render capability of the component controls contract. It carries no
workspace; the detail does. The shell fetches it once at start and again after
every update event. Static output has no live descriptor, and the shell treats
its absence as the inert mode of the live capabilities contract.

## Fetch And Fences

At start the shell fetches the index, then the detail of the routed entry, and
in Serve the live descriptor. It renders the navigation when the index arrives
and the frames when the detail arrives. On navigation inside the shell it
commits the route from the index at once and fetches the destination's detail.
It accepts a detail only when the detail's `identity`, `deploymentId`, and
`revision` equal the installed index. On a mismatch it refetches the index
once; if the pair still disagrees, the entry shows its unavailable state with
a retry control. A detail or index from another deployment makes the shell
perform a full page load of the requested URL instead of mixing deployments.

On an update event with a newer version, the shell fetches the live
descriptor, the index, and the current entry's detail, requires one
`updateVersion`, `identity`, and `revision` across the three, and adopts them
in one store commit. No update reloads the page. A content revision change
reloads only the mounted frames; an evidence change updates Changes, Usage,
and marks in place. The one-shot reload recovery of the frozen backend is
retired. A render generation change replaces the temporary-render capability
under the component controls contract.

Every fetch uses `credentials: "omit"`, stays same-origin, and rejects a
redirect outside the origin. Serve sends `Cache-Control: no-store` on every
JSON route. The index and the details of one deployment are immutable, so a
static host may cache them under the revalidation rules of the static delivery
contract, and the shell keeps them for the page's lifetime.

## Identity

The deployment id is the hash of every installed file of the output under the
[static export browser contract](./mokly-export-browser.md): the stubs, the
index, the details, the documents, the comparison generation, the bundle, the
styles, and the fonts take part. The index carries it, and every detail
repeats it. Serve derives it from the canonical index with the id field
zeroed, as the frozen backend derives it from the canonical catalogue.

## Embedded Viewer

`MoklyViewer` takes an `index` source and a `detail` source instead of one
catalogue source: the index as an object or a URL, and the detail as a
function from an entry path and an optional snapshot id to an object, a URL,
or a promise of either. The `@mokly/viewer/server` entry and `renderViewer`
are retired; a React host renders the viewer in the browser. The
`@mokly/viewer/browser` entry mounts the standalone shell into the stub's
mount element. The [embeddable viewer contract](./mokly-viewer.md) owns the
props, and the plan's viewer milestone revises it.

## Fail-Closed Rules

| Condition                                                                    | Shell behaviour                                                                         |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| an index, detail, or live descriptor with another `schemaVersion`            | the version error state of the [viewer namespace](./mokly-viewer-namespace.md) contract |
| a detail whose identity or revision differs from the index after one refetch | the entry's unavailable state with retry                                                |
| a detail or index with another `deploymentId` during in-shell navigation     | a full page load of the requested URL                                                   |
| a live descriptor absent in Serve, or present in static output               | the version error state                                                                 |
| a JSON route that redirects outside the origin, has another type, or fails   | the entry's unavailable state with retry                                                |

## Related Docs

- [Rust core architecture](../architecture/rust-core.md)
- [Public catalogue read model](./mokly-catalogue.md)
- [Live viewer capabilities](./mokly-live-capabilities.md)
- [Static export delivery](./mokly-export-delivery.md)
- [Embeddable Mokly viewer](./mokly-viewer.md)
- [Format inventory](./mokly-format-versions.md)
