# Static Export Delivery

## Delivery Status

Implemented for [consumer export](./mokly-export.md). Catalogue v4, delivery v4
and bootstrap v1 share one shell per entry; provider normalization is an adapter concern.

## Hosting Contract

Deploy the export directory's contents as the HTTP(S) origin's document root.
The host must serve ordinary files with their correct MIME types, index.html
directory indexes, query-insensitive file lookup, and normal missing-file
responses. Serve `mokly-viewer/` and `static/` under the
[portable-name rules](./mokly-viewer-namespace.md#names-and-acceptance).
No SPA fallback, URL rewriting, worker, API or server-side rendering is required.

The artifact includes a `404.html` catalogue page. Hosts may configure it as
their error document; producing the HTTP 404 status for arbitrary unknown URLs
is host configuration, not something static HTML can guarantee.
The consumer publishes atomically or as an immutable host deployment to avoid
serving a mix of builds. Configure revalidation for shell HTML, mutable assets,
and aliases; comparison generation URLs must not be rewritten to another generation.
Serve comparison resources with `X-Content-Type-Options: nosniff` and the existing
no-store policy. Generic deployments document these header requirements;
provider adapters may emit the host's metadata files for them. Correctness must
not depend on a generic static server interpreting `_headers` or `_redirects`.

For cross-origin catalogue and viewer consumers, public fetch paths are
`mokly-viewer/catalogue.json`, `static/mokly-generated/<route>`,
`static/<referenced closure path>`,
`mokly-viewer/client/**`, `mokly-viewer/shell.css`,
`mokly-viewer/fonts/**` and `mokly-viewer/diffs/generations/**`. Send correct MIME types,
`Access-Control-Allow-Origin: <exact app origin>` and
`X-Content-Type-Options: nosniff`, including GET/HEAD and error responses. Use
`Vary: Origin` when dynamically selecting an allowed origin. No wildcard CORS,
cookies, authorization headers or credentials are used; clients fetch with
`credentials: "omit"`. CORS is unnecessary for same-origin reads. Existing
revalidation and comparison no-store policies apply; see the
[catalogue fetch rules](./mokly-catalogue.md#serve-and-fetch-rules).
Removed-preview and comparison HTML beneath an advertised generation's
`snapshots/before/` and `snapshots/after/` trees is fetched and validated by
the viewer rather than loaded as a frame URL. It needs the same CORS and
`nosniff` headers and a `text/html` MIME type.

The default iframe sandbox stays `allow-same-origin`. Cross-origin hosts must
explicitly use the [postMessage adapter](./mokly-frame-adapter.md), a distinct
real `frameOrigin`, and `sandbox="allow-same-origin allow-scripts"`. Opaque
`null` origins are rejected. Query-insensitive hosting preserves the adapter's
`mokly-host` parameter. This exception enables document scripts on the isolated
origin; it adds no script permission locally, nor forms, popups, downloads or
top-navigation permission. The adapter policy applies to current documents;
removed previews and comparison panes use viewer-owned, script-disabled
`srcdoc` frames under their linked contracts.

## Artifact Routes

Paths below are relative to the export directory. Every route derives from
its entry's kind and id under the
[derived route rule](./mokly-authoring.md#derived-routes) and is encoded once
when written into URLs.

| Path                               | Meaning                                                               |
| ---------------------------------- | --------------------------------------------------------------------- |
| `index.html`                       | Full catalogue home                                                   |
| `view/<route>`                     | Full shell for current and removed entries                            |
| `static/<public-path>`             | Adapted current fragments and public consumer resources               |
| `mokly-viewer/`                    | Required shell CSS, fonts, browser modules, and comparison generation |
| `mokly-viewer/catalogue.json`      | Public catalogue read model v4                                        |
| `mokly-viewer/client/inspector.js` | Inert cross-origin frame inspector                                    |
| `404.html`                         | Existing catalogue not-found view                                     |
| `.mokly-export-artifact`           | Public-safe versioned ownership inventory with per-file digests       |

Catalogue routes retain their validated `.html` suffixes; additional public
`.htm` documents retain their filenames too. Do not
apply the preview script's Cloudflare-specific extension stripping. Generated
resource references must address actual exported files. Hosts that normalize
HTML URLs remain compatible provided their redirects preserve the query and
resolve to the same page; Cloudflare tests protect this existing deployment.

Folders derived from `navPath` are not new routed pages. Include use cases
and registered whole-document pages. Empty registries remain invalid under the existing
build contract; exporting one preserves the previous artifact. Missing views
remain explicit in added/removed comparison data; never synthesize content.
The shell keeps Added entries in Current without exposing comparison modes.
Removed screens likewise show a Removed badge without comparison modes, opening
the packaged baseline views the shell resolves from that descriptor under
[removed previews](./mokly-removed-previews.md). Removed
component variants remain eligible for comparison.

Every manifest, generated, copied, and adapter-added path enters a single
collision-checked inventory, including file/directory prefix collisions.
Reject incompatible duplicate paths, aliases, or reserved paths before
installation. Shared byte-identical resources may be deduplicated. Current and
removed entries cannot share an id under the Changes contract.

Adapter aliases enter the same case-folded path namespace as files, including
the final ownership marker. Each alias is a safe relative, file-like route
whose target is an existing exported file, not another alias. Reject exact
alias/file matches even when their bytes would agree, case-folded matches, and
ancestor/descendant collisions between aliases or between aliases and files,
independent of insertion order. Distinct sibling aliases may share one target.
These checks happen before installation and preserve any previous export on
failure. They also apply to the preview adapter's extensionless HTML aliases;
ordinary consumer exports retain their real `.html` routes.

## Static Navigation

Embed a typed, versioned static-delivery descriptor in shell-owned metadata,
not consumer documents. It supplies the canonical path of the current page and
the generation-specific comparison URL. Validate it against the catalogue while
exporting and at the client boundary. All targets must stay same-origin under
the expected Mokly prefixes. Consumer markup cannot supply or override this
descriptor; serialize it safely in HTML. The root `html` element carries
`data-mokly-static=""` and an escaped `data-mokly-delivery` JSON attribute
with exactly `schemaVersion: 4`, `canonicalPath`, `comparisonUrl`, and
`deploymentId`. `canonicalPath` is `/`, `/404.html`, or the page's own
`/view/<route>`. Static mode with missing, malformed, or other-version
metadata fails closed instead of requesting a development endpoint. Both
identity values use 64 lowercase SHA-256 hex characters. Repository previews
without Changes explicitly set `comparisonUrl: null`; deployment identity
remains required. Null disables comparison requests and never falls back to a
development endpoint. Consumer CLI exports always include their validated
generation URL when Changes is ready; an incompatible base uses null. The
descriptor carries no id-to-route map: the shell derives
every URL from kind and id through the shared path module.

Static frame-link enhancement resolves a validated logical id through the
catalogue read model to its canonical `/view/<route>` URL before fetching or
opening a browsing context; development Browse resolves the same way. This
applies to primary/keyboard clicks, modifier clicks, middle-clicks, and named
targets. Do not follow a JS redirect document inside a fetch and mistake it for
a page. There is no `/id/<id>` alias page or redirect in either delivery; the
canonical `/view/<route>` URL is stable because nothing but the id can move it.

Every shell page embeds consistent shell metadata. In-shell navigation, reload,
Back/Forward, new tabs, and browser-normalized response URLs retain the same
entry identity and existing scroll/disclosure behavior. Unknown ids are
unavailable; the shell renders only entries present in its catalogue read
model and never invents a catch-all route.

Provider-normalized `/view/<kind-prefix>/<id>` is the extensionless form of
canonical `/view/<kind-prefix>/<id>.html`. The shared helper and parser in the
[artifact path contract](./mokly-artifact-paths.md) resolve its id to a current
or removed entry. A removed entry needs no query when its id is unique; if a
`snapshot` is present, it must match the published record. Unknown, stale, and
mismatched identities remain unavailable.

An exported page embeds a compact shell bootstrap containing its route, shell
context, catalogue identity, and content/evidence revisions. It references the
single owned `/mokly-viewer/catalogue.json`; it does not repeat the catalogue read
model in every HTML document. Before hydration, the standalone entry first
validates the root delivery descriptor, then fetches that exact same-origin path
with `cache: no-store` and omitted credentials. The response must remain on that
path, pass the public catalogue reader, carry the finalized deployment identity,
and match both bootstrap revisions and the catalogue identity. Only then may
React hydrate the existing server tree. A missing, redirected, malformed, or
mismatched catalogue leaves the complete server-rendered page and its ordinary
links in place without installing partial interaction. Serve retains its
self-contained [entry-scoped read model](./mokly-shell-bootstrap.md), performs
no initial catalogue fetch, and never puts `omitted` in the shared catalogue.

The pre-hydration disclosure and navigation-width handoff remains active until
the asynchronous static catalogue resolution reaches the actual hydration
boundary. A native choice made after `load` but before that resolution wins over
stored state and hydrates without a mismatch. Static destination-page evidence
resolves the compact destination bootstrap against the already installed
catalogue after deployment fencing; it does not issue another catalogue fetch.

Each exported workspace page embeds scoped evidence as inert JSON. After
navigation, React may read the destination shell page to recover evidence intentionally
absent from the public catalogue, including affected consumers, related
components, supplied-input changes, and resource evidence. This read never
swaps or executes fetched markup. Accept only one shell bootstrap and one
workspace payload from a successful same-origin response whose final `.html`
or provider-normalized extensionless path identifies the requested route. The
root delivery descriptor must retain the mounted deployment and comparison
URL; the bootstrap must retain the catalogue identity, revisions, base, and
exact destination route; and the workspace entry must match that route's id
and kind. Abort the read when navigation replaces the route. A rejected,
failed, or obsolete read leaves the already-committed public workspace in
place and never falls back to a live endpoint.

Preserve the existing [navigation contract](./mokly-navigation.md): trusted
ownership-checked link markers only, immediate-frame parent enhancement,
portable fallback hrefs, sandbox restrictions, latest-wins cancellation, focus,
announcements, active-tree visibility, search/filter state, and fragment grammar.
The static fragment handler applies a single validated `fragment` query to all
current light/dark sources; a use case applies it only to its first step.
Invalid/duplicate fragment values are not injected, and a direct URL with a
syntactically valid missing anchor retains the current static fallback.

## Static Comparisons

Each export packages one complete comparison, with all referenced before/after
documents and transitive resources under the same generation root:

```text
mokly-viewer/diffs/generations/<generation>/review.json
```

Retain the engine's JSON and document bytes and relative snapshot paths.
Do not change the review schema or rebase only some of its resource references.

The static descriptor points directly to this immutable JSON URL. Shell
[`diffs.tsx`](../../packages/viewer/src/shell/diffs.tsx) requests it only for a
selected diff and resolves snapshots from the actual response URL. Generic
export needs no redirect from `/mokly-viewer/diffs/review.json`. Development keeps
its stable endpoint; the repository's Cloudflare adapter keeps its stable
redirect for compatibility.

Current remains the default after navigation/reload. Browsing, Changes filtering,
and scheme/viewport switches do not request comparison JSON or snapshot files.
An export with Changes carries the same per-view states as Serve, so its shell
marks hidden changed views and lists them in Details without fetching that JSON.
Added entries retain their current preview without comparison modes. Removed
screens and pages retain no comparison modes; selecting one requests the
packaged previous version delivered under
[removed previews](./mokly-removed-previews.md). Side by side,
Overlay, and Difference retain the existing UI and missing-current state for
Removed component variants. Refresh/retry reload the same exported generation; only
another export and deployment produces new comparison content. An open tab
retains its loaded deployment's descriptor; reload the page to adopt a newer deployment. In-shell
navigation encountering a different deployment identity performs a full page load rather
than mixing its new route with the old catalogue navigation. Hosts may
retain prior generations for old tabs; if they remove them, the existing
comparison failure state applies until page reload. Cancellation and failure
keep the catalogue usable and cannot replace a different screen.

Exclude the watcher entrypoint, event stream connections, and all Node/server
modules. The browser graph must be complete without unused server dependencies.
All product data, counts, and comparison results come from the real captured
catalogue and Git inputs. No publishing, sandbox, or environment labels are added
to product screens. The existing light/dark, mobile/desktop shell design applies.

When the selected base was built by an earlier Mokly, export contains no
comparison generation, sets `comparisonUrl: null`, and advertises Changes as
unavailable while still completing successfully, exactly as defined by
[baseline compatibility](./mokly-baseline-compatibility.md).

## Browser Runtime And Deployment Identity

The browser module inventory and deployment identity algorithm follow the separate
[static export browser contract](./mokly-export-browser.md).

## Browser Acceptance

Use a basic HTTP fixture that serves exact files and directory indexes, handles
GET/HEAD with proper MIME types, and supplies no Mokly or provider rewrites.
Copy only the export to a separate directory before serving; its requests must
not reach the consumer project, `.git`, Node modules, or a live Mokly process.

Verify direct and reloaded nested pages with and without enhancement,
provider-normalized URLs, folder navigation, search/tags/Changes, details,
both viewports and schemes, use cases, component variants, ordinary fallback
links, all logical-link activation modes, fragments, Back/Forward, and removed
screens. Assert that every local request resolves and that Current makes no
comparison or event-stream requests.

Exercise all three diff modes, explicit missing sides, ignored/shared impacts,
refresh, errors, interrupted navigation, and resource isolation after the source
tree changes or disappears. Retain browser coverage under the actual Cloudflare
Pages local runtime for normalized URLs, stable redirects, headers, and the
repository preview's existing public URLs. New delivery plumbing does not add
or redesign a screen; visual smoke tests reuse the owning mobile/desktop mocks.
