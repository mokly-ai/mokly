# Static Delivery

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Hosting Contract

Deploy the output directory's contents as the HTTP(S) origin's document root.
The host must serve ordinary files with their correct MIME types, `index.html`
directory indexes, query-insensitive file lookup, and normal missing-file
responses. Serve `mokly-viewer/` and `static/` under the
[portable-name rules](./mokly-viewer-namespace.md#names-and-acceptance). No
SPA fallback, URL rewriting, worker, API, or server-side rendering is required;
no process renders shell HTML, so the host runs nothing.

The output includes a `404.html` stub. Hosts may configure it as their error
document; producing the HTTP 404 status for arbitrary unknown URLs is host
configuration, not something static HTML can guarantee. The consumer publishes
atomically or as an immutable host deployment to avoid serving a mix of
builds; the shell's deployment fence turns a mixed read into a full page load.
`build` adds no host configuration file such as `_headers` or `_redirects`; a
deployment step may add one beside the output, and correctness never depends
on a generic static server interpreting it. Generic deployments document the
header requirements below.

The default iframe sandbox stays `allow-same-origin`. Cross-origin hosts must
explicitly use the [postMessage adapter](./mokly-frame-adapter.md), a distinct
real `frameOrigin`, and `sandbox="allow-same-origin allow-scripts"`. Opaque
`null` origins are rejected. Query-insensitive hosting preserves the adapter's
`mokly-host` parameter. This exception enables document scripts on the isolated
origin; it adds no script permission locally, nor forms, popups, downloads, or
top-navigation permission. The adapter policy applies to current documents;
removed previews and comparison panes use viewer-owned, script-disabled
`srcdoc` frames under their linked contracts.

## Routes

Paths are relative to the output directory and match the Serve routes of the
[shell delivery contract](./mokly-shell-delivery.md#routes), so a static host
needs no rewrite rules. Every rendered file name derives from its entry's path
under the [artifact path contract](./mokly-artifact-paths.md) and keeps the
authored case of each segment when written into URLs.

| Path                                                                        | Content                                                |
| --------------------------------------------------------------------------- | ------------------------------------------------------ |
| `index.html`                                                                | the shell stub                                         |
| `view/<path>/index.html`                                                    | the same stub, one per current and removed entry       |
| `404.html`                                                                  | the same stub                                          |
| `mokly-viewer/index.json`                                                   | the catalogue index v7                                 |
| `mokly-viewer/entries/<entry path>.json`                                    | one entry detail v1 per current entry                  |
| `mokly-viewer/diffs/generations/<generation>/**`                            | the comparison generation                              |
| `static/mokly-generated/<route>`                                            | rendered views and documents                           |
| `static/<closure path>`                                                     | referenced authored resources                          |
| `mokly-viewer/client/**`, `mokly-viewer/shell.css`, `mokly-viewer/fonts/**` | the shell bundle, the inspector, styles, and fonts     |
| `.mokly-export-artifact`                                                    | the [ownership marker v3](./mokly-export-ownership.md) |

Shell documents are `index.html` files, so `/view/<path>/` needs no rewrite.
A host serving `view/<path>/index.html` for `/view/<path>`, `/view/<path>/`,
or `/view/<path>/index.html` needs no adapter: `parseViewHref` accepts all
three forms and `providerNormalizedHtmlPath` names the form a host serves.
`static/` views and documents keep their `.html` suffixes, and public `.htm`
documents keep their filenames. Rendered resource references address actual
written files. Hosts that normalize HTML URLs stay compatible when their
redirects preserve the query and resolve to the same page.

Folders are not routed pages; an index entry is its folder's page. Use cases,
whole-document pages, and Markdown documents are included. An empty catalogue
fails the build and preserves the earlier output. Missing views stay explicit
in added and removed comparison data; nothing is synthesized. The shell keeps
Added entries in Current without comparison modes. Removed screens show a
Removed badge without comparison modes and open the packaged base views under
[removed previews](./mokly-removed-previews.md). Removed component variants
stay eligible for comparison.

Every rendered, copied, and Mokly-written path enters one collision-checked
inventory, including file and directory prefix collisions, compared after case
folding. Duplicate, colliding, and reserved paths are rejected before
installation, and any earlier output is preserved. Byte-identical resources
may be deduplicated. A current and a removed entry never share a path within a
kind under the Changes contract.

## Headers, Caching, And Revalidation

Every JSON file is served as `application/json; charset=utf-8`, and every
`mokly-viewer/` and `static/` response carries `X-Content-Type-Options: nosniff`.

A new deployment replaces the stubs, the index, the details, the documents,
the resources, the bundle, the styles, and the fonts at the same paths.
Serve those paths with revalidation, `Cache-Control: no-cache` or an
equivalent validator policy, so the next navigation sees the new deployment.
The index and the details of one deployment never change, so a validator
answers `304` until the next deployment; the shell keeps them for the page's
lifetime and fetches them with `credentials: "omit"`. A comparison generation
is immutable at its content-addressed path: a host may cache its files for the
deployment's lifetime or serve them with `Cache-Control: no-store`, and it
must not rewrite one generation's URL to another generation.

For cross-origin catalogue and viewer consumers, the public fetch paths are
`mokly-viewer/index.json`, `mokly-viewer/entries/**`,
`static/mokly-generated/<route>`, `static/<referenced closure path>`,
`mokly-viewer/client/**`, `mokly-viewer/shell.css`, `mokly-viewer/fonts/**`,
and `mokly-viewer/diffs/generations/**`. Send correct MIME types,
`Access-Control-Allow-Origin: <exact app origin>`, and
`X-Content-Type-Options: nosniff`, including on GET, HEAD, and error
responses. Use `Vary: Origin` when selecting an allowed origin dynamically. No
wildcard CORS, cookies, authorization headers, or credentials are used; clients
fetch with `credentials: "omit"`. CORS is unnecessary for same-origin reads.
The [catalogue fetch rules](./mokly-catalogue-fetch.md#serve-and-fetch-rules)
own the client side. Removed-preview and comparison HTML beneath a
generation's `snapshots/before/` and `snapshots/after/` trees is fetched and
validated by the viewer rather than loaded as a frame URL; it needs the same
CORS and `nosniff` headers and a `text/html` MIME type.

## Static Navigation

No page carries a delivery descriptor, a bootstrap, or workspace evidence.
The stub is identical for every route; the shell reads the route from
`location`, fetches `mokly-viewer/index.json`, resolves the route against the
index, and fetches the routed entry's detail under the
[fetch rules](./mokly-shell-delivery.md#fetch-and-fences). The detail carries
the workspace lists, so no route reads another page. Static mode with a
missing, malformed, or other-version index or detail fails closed instead of
requesting a development endpoint. A static build never falls back to a live
endpoint for any request.

In-shell navigation commits the destination from the index at once and fetches
its detail. A detail with another `deploymentId` means another deployment
replaced the files, so the shell performs a full page load of the requested
URL rather than mixing deployments. An open tab keeps its loaded deployment
for the page's lifetime; reload the page to adopt a newer one. In-shell
navigation, reload, Back/Forward, new tabs, and browser-normalized response
URLs keep the same entry identity and the existing scroll and disclosure
behaviour. Unknown paths are unavailable: the shell renders only entries
present in its index and never invents a catch-all route.

A removed entry resolves from the index's `removedEntries`; it needs no query
when its path is unique, and a present `snapshot` must match the published
record. Its detail is fetched from the generation that `comparisonUrl` names
and accepted only under the removed-entry fence. Unknown, stale, and
mismatched identities stay unavailable.

Static frame-link enhancement uses the same canonical path and activation
rules as [Browse navigation](./mokly-navigation.md#browse-presentation).
Canonical `/view/<path>/` pages need no alias or redirect. The
[navigation contract](./mokly-navigation.md) applies unchanged: trusted
ownership-checked link markers only, immediate-frame parent enhancement,
portable fallback hrefs, sandbox restrictions, latest-wins cancellation, focus,
announcements, active-tree visibility, search and filter state, and the
fragment grammar. The static fragment handler applies a single validated
`fragment` query to all current light and dark sources; a use case applies it
only to its first step. Invalid or duplicate fragment values are not injected,
and a direct URL with a syntactically valid missing anchor keeps the static
fallback.

## Static Comparisons

Each build with Changes packages one complete comparison, with every
referenced before and after document, the removed entries' details, the
removed previews, and the transitive resources under one generation root:

```text
mokly-viewer/diffs/generations/<generation>/review.json
```

Keep the engine's JSON and document bytes and its relative snapshot paths. Do
not change the review schema or rebase only some of its resource references.

The index's `comparisonUrl` names this immutable JSON file directly. The shell
requests it only for a selected diff or an opened removed entry and resolves
snapshots from the actual response URL. A static build needs no redirect from
`/mokly-viewer/diffs/review.json`; Serve keeps its stable endpoint.

Current is the default after navigation and reload. Browsing, Changes
filtering, and scheme or viewport switches request no comparison JSON and no
snapshot file. A build with Changes carries the same per-view states as Serve,
so its shell marks hidden changed views and lists them in Details without
fetching that JSON. Added entries keep their current preview without
comparison modes. Removed screens and pages have no comparison modes;
selecting one requests the packaged historical version under removed previews.
Side by side, Overlay, and Difference keep the existing UI and the
missing-current state for removed component variants. Refresh and retry reload
the same generation; only another build and deployment produce new comparison
content. Hosts may keep prior generations for old tabs; if they remove them,
the existing comparison failure state applies until the page reloads.
Cancellation and failure keep the catalogue usable and cannot replace a
different screen.

The output excludes the watcher, the event stream, the live descriptor, the
control routes, and every server module; on a static host
`/mokly-viewer/events` and `/mokly-viewer/live.json` are ordinary missing
files. All product data, counts, and comparison results come from the real
catalogue and Git inputs. No publishing, sandbox, or environment label is added
to product screens. The light and dark, mobile and desktop shell design
applies unchanged.

A current-only build has no generation and `comparisonUrl: null`. A base whose
sources fail the current validation leaves `comparisonUrl: null` and
`changesStatus: "unavailable"` while the build completes, under the
[publication contract](./mokly-publication.md).

## Browser Runtime And Deployment Identity

The browser module inventory and the deployment identity algorithm follow the
separate [static build browser contract](./mokly-export-browser.md).

## Browser Acceptance

Use a basic HTTP fixture that serves exact files and directory indexes,
handles GET and HEAD with proper MIME types, and supplies no Mokly or provider
rewrites. Copy only the output to a separate directory before serving; its
requests must not reach the consumer project, `.git`, Node modules, or a Mokly
process.

Verify direct and reloaded nested pages, host-normalized URLs, folder
navigation, search, tags, and Changes, details, both viewports and schemes,
use cases, component variants, ordinary fallback links, every logical-link
activation mode, fragments, Back/Forward, and removed screens. Assert that
every local request resolves and that Current makes no comparison, live
descriptor, or event-stream request.

Exercise all three diff modes, missing sides, ignored regions, rule and
resource evidence, refresh, errors, interrupted navigation, and resource
isolation after the source tree changes or disappears. Keep browser coverage
under the Cloudflare Pages local runtime for the repository preview's
normalized URLs, headers, and public URLs. Delivery adds no screen; visual
smoke tests reuse the owning mobile and desktop mockups.
