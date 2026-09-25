# Static Export Delivery

## Delivery Status

Implemented. This document completes the
[consumer export contract](./mokly-export.md). It defines portable serving
and browser behavior for the consumer command, with Cloudflare normalization
kept in the repository adapter. Delivery is tracked in the
[consumer static export plan](../../plans/consumer-static-export.md).

The public catalogue, cross-origin inspector and viewer package are implemented
by the completed [viewer library plan](../../plans/mokly-viewer-library.md).
Removed page and screen previous versions are packaged and rendered by the
[removed content previews plan](../../plans/removed-content-previews.md).
Scoped live-capture comparison with byte-identical static output is an approved
target tracked by the
[route-scoped bootstrap plan](../../plans/route-scoped-shell-bootstrap.md).

## Hosting Contract

Deploy the export directory's contents as the HTTP(S) origin's document root.
The host must serve ordinary files with their correct MIME types, index.html
directory indexes, query-insensitive file lookup, and normal missing-file
responses. It must serve the double-underscore package asset directories.
No SPA fallback, extension-removal rule, redirect interpreter, worker, API,
or server-side rendering is required for catalogue functionality.

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
`__mokly/catalogue.json`, `static/**`, `__mokly/client/**`, `__mokly/shell.css`,
`__mokly/fonts/**` and `__mokly/diffs/__generations/**`. Send correct MIME types,
`Access-Control-Allow-Origin: <exact app origin>` and
`X-Content-Type-Options: nosniff`, including GET/HEAD and error responses. Use
`Vary: Origin` when dynamically selecting an allowed origin. No wildcard CORS,
cookies, authorization headers or credentials are used; clients fetch with
`credentials: "omit"`. CORS is unnecessary for same-origin reads. Existing
revalidation and comparison no-store policies apply; see the
[catalogue fetch rules](./mokly-catalogue.md#serve-and-fetch-rules).
Historical HTML beneath an advertised generation's `snapshots/before/`
directory is fetched and validated by the viewer rather than loaded as the
frame URL. It therefore needs the same CORS and `nosniff` headers and must be
served with a `text/html` MIME type.

The default iframe sandbox stays `allow-same-origin`. Cross-origin hosts must
explicitly use the [postMessage adapter](./mokly-frame-adapter.md), a distinct
real `frameOrigin`, and `sandbox="allow-same-origin allow-scripts"`. Opaque
`null` origins are rejected. Query-insensitive hosting preserves the adapter's
`mokly-host` parameter. This exception enables document scripts on the isolated
origin; it adds no script permission locally, nor forms, popups, downloads or
top-navigation permission. The adapter policy applies to current documents;
removed historical previews use viewer-owned, script-disabled `srcdoc` frames.
Comparison panes keep their existing sandbox and direct snapshot URLs.

## Artifact Routes

Paths below are relative to the export directory. URL path segments use the
existing validated route grammar and are encoded once when written into URLs.

| Path                          | Meaning                                                               |
| ----------------------------- | --------------------------------------------------------------------- |
| `index.html`                  | Full catalogue home                                                   |
| `view/<route>`                | Full shell for current routed entries and removed screens/pages       |
| `id/<id>/index.html`          | Static alias showing the same shell as the canonical route            |
| `static/<public-path>`        | Adapted current fragments and public consumer resources               |
| `__mokly/`                    | Required shell CSS, fonts, browser modules, and comparison generation |
| `__mokly/catalogue.json`      | Public catalogue read model v1                                        |
| `__mokly/client/inspector.js` | Inert cross-origin frame inspector                                    |
| `404.html`                    | Existing catalogue not-found view                                     |
| `.mokly-export-artifact`      | Public-safe versioned ownership inventory                             |

Catalogue routes retain their validated `.html` suffixes; additional public
`.htm` documents retain their filenames too. Do not
apply the preview script's Cloudflare-specific extension stripping. Generated
resource references must address actual exported files. Hosts that normalize
HTML URLs remain compatible provided their redirects preserve the query and
resolve to the same page; Cloudflare tests protect this existing deployment.

Collections remain navigation folders, not new routed pages. Include use cases
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
Reject incompatible duplicate routes, aliases, or reserved paths before
installation. Shared byte-identical resources may be deduplicated. Current-id
precedence for renamed/reused ids follows the Changes contract.

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
not consumer documents. It supplies the canonical route for the current page,
the id-to-route map, and the generation-specific comparison URL. Validate it
against the catalogue while exporting and at the client boundary. All targets
must stay same-origin under the expected Mokly prefixes. Consumer markup
cannot supply or override this descriptor; serialize it safely in HTML.
The root `html` element carries `data-mokly-static=""` and an escaped
`data-mokly-delivery` JSON attribute with `schemaVersion: 2`, `canonicalPath`,
`idRoutes`, `comparisonUrl`, and `deploymentId`. Static mode with missing,
malformed, or older metadata fails closed instead of requesting a development
endpoint. Both identity values use 64 lowercase SHA-256 hex characters.
Repository previews without Changes explicitly set `comparisonUrl: null`; id
routes and deployment identity remain required. Null disables comparison requests
and never falls back to a development endpoint. Consumer CLI exports always
include their validated generation URL.

Both renderer and parent navigation use a shared delivery-aware route resolver.
Development retains its `/id/<id>` HTTP redirect behavior. Static frame-link
enhancement resolves a validated logical id directly to its exported canonical
`/view/<route>` URL before fetching or opening a browsing context. This applies
to primary/keyboard clicks, modifier clicks, middle-clicks, and named targets.
Do not follow a JS redirect document inside a fetch and mistake it for a page.

Static id aliases contain the real canonical page, not an empty redirect screen.
`/id/<id>/index.html` therefore works without host redirect support. Directory
indexes also support `/id/<id>/`; hosts with normal directory redirects accept
`/id/<id>`. The hydrated shell normalizes an alias history entry to the canonical
route without a fetch, retaining the single validated `fragment` query.
Without JavaScript the same screen remains visible at the alias URL.

Every alias and canonical page embeds consistent shell metadata. In-shell
navigation, reload, Back/Forward, new tabs, and browser-normalized response URLs
retain the same route identity and existing scroll/disclosure behavior. Unknown
ids are unavailable; the shell renders only routes present in its catalogue
read model and never invents a catch-all route.

Provider-normalized extensionless `/view/<route>` URLs resolve against exact
accepted catalogue routes. Current routes remain constrained by `idRoutes`;
retained historical routes resolve from `removedEntries` because a reused id's
alias intentionally names current content. Historical links keep their exact
published `snapshot` query while the preview adapter removes `.html`. Unknown,
stale, current-route, and route/snapshot mismatches remain unavailable.

An exported page embeds a compact shell bootstrap containing its route, shell
context, catalogue identity, and content/evidence revisions. It references the
single owned `/__mokly/catalogue.json`; it does not repeat the catalogue read
model in every HTML document. Before hydration, the standalone entry first
validates the root delivery descriptor, then fetches that exact same-origin path
with `cache: no-store` and omitted credentials. The response must remain on that
path, pass the public catalogue reader, carry the finalized deployment identity,
and match both bootstrap revisions and the catalogue identity. Only then may
React hydrate the existing server tree. A missing, redirected, malformed, or
mismatched catalogue leaves the complete server-rendered page and its ordinary
links in place without installing partial interaction. Serve instead retains a
self-contained inline
[route-scoped projection](./mokly-shell-bootstrap.md) of its read model and
performs no initial catalogue fetch. The bootstrap-only `omitted` usage state
never enters the shared static catalogue.

The pre-hydration disclosure and navigation-width handoff remains active until
the asynchronous static catalogue resolution reaches the actual hydration
boundary. A native choice made after `load` but before that resolution wins over
stored state and hydrates without a mismatch. Static destination-page evidence
resolves the compact destination bootstrap against the already installed
catalogue after deployment fencing; it does not issue another catalogue fetch.

Each exported screen and component page also embeds its route-scoped workspace
evidence as inert JSON. After an in-shell route transition, React may read the
destination's canonical shell page to recover evidence that is intentionally
absent from the public catalogue, including affected consumers, related
components, supplied-input changes, and resource evidence. This read never
swaps or executes fetched markup. Accept only one shell bootstrap and one
workspace payload from a successful same-origin response whose final `.html`
or provider-normalized extensionless path identifies the requested route. The
root delivery descriptor must retain the mounted deployment, comparison URL,
and id map; the bootstrap must retain the catalogue identity, revisions, base,
and exact destination route; and the workspace entry must match that route's
id and kind. Abort the read when navigation replaces the route. A rejected,
failed, or obsolete read leaves the already-committed public workspace in
place and never falls back to a live endpoint.

Export and repository preview capture validate the complete published model
once, then validate each captured Serve bootstrap and compare it with the
same route-scoped projection of that model. The comparison remains exact for
everything the page carries and rejects leaked or missing usage. Only after it
passes does capture replace the inline projection with the existing compact
external reference. For identical inputs, that conversion must leave the
catalogue, canonical and alias shells, workspace JSON, ownership inventory,
comparison files, and deployment identity byte-identical to delivery before
Serve bootstraps became scoped.

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
__mokly/diffs/__generations/<generation>/review.json
```

Retain the engine's JSON and document bytes and relative snapshot paths.
Do not change the review schema or rebase only some of its resource references.

The static descriptor points directly to this immutable JSON URL. `diffs.ts`
uses it only when a diff is selected and resolves snapshot paths relative to
the actual response URL, as today. The generic export does not require a
redirect from `/__mokly/diffs/review.json`. Development keeps its existing
stable endpoint; the repository's Cloudflare adapter keeps its existing stable
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

## Browser Modules

The standalone browser inventory under `__mokly/client/` is the hydrated shell:
the documented standalone hydration entry, which bundles React and React DOM
with the shell tree, plus the transport, geometry and protocol modules it
imports (frame adapters, message transport, geometry, catalogue revision
adoption). Export delivers the viewer-owned inventory from the generated manifest
of the completed package build outputs; Serve also delivers the CLI-owned live
host modules. Each manifest must match its directory files exactly. Static mode
never activates live host capabilities or starts update requests. Its separate
static evidence reader can issue only the same-origin destination-shell read
defined above and receives no host token or behavior. `navigation-resize.js` retains its delivery name
as the pre-hydration script that synchronously captures early native disclosure
choices without mutating React-owned DOM. The hydrated shell reads those choices
for its initial render so they win over stored preferences and the reload
snapshot; capture listeners and transient out-of-tree state are removed on load
or page exit. The inspector remains
`client/inspector.js`, React-free, at the 9,216-byte cap; it runs inside
consumer documents and shares nothing with the shell bundle.
The removed-content request lifecycle is part of `react-shell.js`; it reuses the
same typed review and removed-page validators as the rest of the viewer. Static
requests are limited to preview descriptors in the accepted public catalogue
and their referenced historical documents beneath that advertised generation's
`snapshots/before/`; live requests use the selected on-demand route and its
resulting generation. There is no parallel vanilla Browse or preview runtime.

The Node-only server renderer and the embedding-only scoped stylesheet are
excluded from the standalone browser inventory. Standalone `shell.css` and font
bytes are unchanged by hydration. Module changes alter deployment identity as
required below, so the transition to the hydrated shell changes the identity
of every export exactly once. An export from a changed workspace also records
its new `changedPaths` in `review.json`, which changes that generation's hash;
snapshot and comparison resource bytes remain unchanged. The
[React Browse shell plan](../../plans/react-browse-shell.md) records the runtime
replacement and its compatibility checks.

## Deployment Identity

Comparison generations identify only the comparison JSON and snapshot inventory.
The separate `deploymentId` identifies the entire installed artifact, including
shell pages, navigation metadata, public files, CSS, client/navigation modules,
fonts, provider files, ownership inventory, and alias-to-file mappings. An export
with unchanged comparisons but changed deployment content must get a different
deployment identity. Identical content and aliases retain the same identity,
independent of file/alias insertion order or the output directory.

Finalize identity after the provider adapter and ownership inventory are complete.
Only exporter-owned shell roots may carry the stamped descriptor. Require every
such shell page to retain its original canonical path, id map, comparison URL,
and one valid root descriptor; adapters cannot remove or rewrite that contract.
Normalize each owned root descriptor to its canonical JSON serialization with
`deploymentId` set to 64 zeroes. Hash each resulting file's exact bytes, sort
the `[path, contentHash]` pairs by JavaScript string order, sort alias pairs by
alias path, and SHA-256 the JSON encoding of `[filePairs, aliasPairs]`.
Do not normalize lookalike metadata inside consumer documents, scripts, or other
non-shell files. Their bytes participate unchanged, except for the explicitly
owned catalogue field below.

Finalization includes the exporter-owned
`__mokly/catalogue.json`: canonicalize its JSON with only its top-level
`deploymentId` set to 64 zeroes for the file hash, then stamp the same resulting
artifact identity there and in every owned shell descriptor. Its other bytes,
the inspector script and inert per-document maps participate normally. Validate
the catalogue's owned identity field before finalization and replace its staging
placeholder before installation. This prevents self-reference without changing
delivery descriptor v2, ownership v1, upload v1 or the review schema.

Stamp the resulting identity into those owned root descriptors and the owned
catalogue field, changing no other bytes.
No adapter or inventory mutation may follow finalization.
Every owned root's staging placeholder is replaced before installation. This avoids a
self-referential hash while covering every deployed byte except the derived
identity field itself. The comparison generation keeps its separate URL/hash.

In-shell navigation requires both deployment identity and comparison URL to
match; otherwise it performs a full document load before adopting any new view.
Old descriptor versions also trigger that fallback. Within one deployment,
ordinary in-shell navigation and browser state preservation remain unchanged.

## Browser Acceptance

Use a basic HTTP fixture that serves exact files and directory indexes, handles
GET/HEAD with proper MIME types, and supplies no Mokly or provider rewrites.
Copy only the export to a separate directory before serving; its requests must
not reach the consumer project, `.git`, Node modules, or a live Mokly process.

Verify direct and reloaded nested pages, aliases with/without enhancement,
collection navigation, search/tags/Changes, details, both viewports and schemes,
use cases, ordinary fallback links, all logical-link activation modes, fragments,
Back/Forward, and removed/renamed screens. Assert that every local request
resolves and that Current makes no comparison or event-stream requests.

Exercise all three diff modes, explicit missing sides, ignored/shared impacts,
refresh, errors, interrupted navigation, and resource isolation after the source
tree changes or disappears. Retain browser coverage under the actual Cloudflare
Pages local runtime for normalized URLs, stable redirects, headers, and the
repository preview's existing public URLs. New delivery plumbing does not add
or redesign a screen; visual smoke tests reuse the owning mobile/desktop mocks.
