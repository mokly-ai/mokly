# Catalogue Hosting

The catalogue server serves user-authored catalogues from a wildcard
catalogue domain, never from the API or app origin. It serves the exact
indexed bytes of an authorized ready publication and neither evaluates nor
rewrites HTML. The [architecture doc](../../architecture/cloud.md) places it among the
other components.

`GET /_health` is reserved for ingress/readiness probes on every host. It returns
200 `ok`, `Cache-Control: no-store` and the normal isolation headers without
looking up a publication, reading cookies or setting one. It proves process
readiness after startup migrations, not ongoing database/storage health.
This route takes precedence over publication files named `_health`.

## Origins And Routes

Canonical hosts are `p-<publication UUID>.<catalogue domain>`. Configuration
specifies the domain, scheme and optional development port separately from the
app origin. The environment-specific configured suffix is:

| Environment    | Catalogue domain                | Canonical host                           |
| -------------- | ------------------------------- | ---------------------------------------- |
| `production`   | `<base domain>`                 | `p-<uuid>.<base domain>`                 |
| `main-preview` | `br-main.preview.<base domain>` | `p-<uuid>.br-main.preview.<base domain>` |
| `preview-pr-N` | `pr-N.preview.<base domain>`    | `p-<uuid>.pr-N.preview.<base domain>`    |

`C` in the infrastructure docs means `<base domain>` above. Stable catalogue
hosts are proxied records for which Cloudflare provides DNS and TLS transport
only. PR `*.pr-N.preview.C` is a DNS-only record whose certificate the
cluster issues for that wildcard; each publication is one label below it, so
the wildcard covers every publication host. The record, certificate and
token ownership of every environment is in the
[environment inventory](../../ops/environment.md#dns-certificates-and-worker);
PR hosts follow [PR previews](./pr-preview-environments.md). Every
origin-side access, cookie, CSP and cache rule below applies on the direct
DNS-only path too; no Cloudflare proxy or cache rule replaces it.

Long-lived branch environments derive `br-<branch>` by removing the
`-preview` suffix from their environment name. Pull-request environments keep
their `preview-pr-N` deployment name while the host label is `pr-N`. Reject
unknown host suffixes, malformed labels, duplicate Host
headers and forwarded-host overrides. Production requires HTTPS and a domain
separate from the app/API. The catalogue domain cannot equal, contain or be
nested under the app host. Their registrable domains must differ under the
ICANN and private sections of the Public Suffix List. For example
`app.example.co.uk` and `catalogues.example.co.uk` are rejected; independent
sites under a private suffix such as `github.io` are distinct.
IP literals and bare public suffixes cannot be catalogue domains. Trailing DNS
dots are ignored for separation checks. Explicit development uses `*.localhost`
with loopback ports and bypasses this production separation check. This
development exception requires the catalogue domain to be `localhost`; every
other domain is validated as production, even with `MKC_ENV=development`.
A localhost app paired with a real catalogue domain therefore fails validation.

Branch aliases are `b-<first 40 hex SHA-256(project UUID + NUL + branch)>` under
the same domain. A database alias resolves to the newest ready publication by
server creation time and ID, never exported time. It returns 307 to that
publication's host, preserving path and query, with `no-store`. Aliases serve
no publication bytes and hold no authentication cookie. Failed uploads do not
advance aliases; expired publications cannot be alias targets.

Application links returned for a publication use the current workspace and
project slugs: `/:workspace/:project/publications/:publicationId`. This includes
links back from unavailable or expired catalogue content. Retired slug claims
keep previously minted links resolving. Slugs never change the UUID-derived
catalogue host or move publication bytes onto the app or API origin.

Follow the published
[delivery contract](../mokly-export-delivery.md).
Every stored file keeps its export-relative path from the
[artifact path table](./mokly-artifact-compatibility.md#stored-and-served-paths):

| Request class                                                                  | Result                                                                  |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `/`, `/index.html`                                                             | Exact shell stub                                                        |
| `/view/<path>/`                                                                | `view/<path>/index.html`                                                |
| `/view/<path>`                                                                 | 308 to `/view/<path>/`, preserving query                                |
| `/view/<path>/index.html`                                                      | Exact shell file, retaining extension                                   |
| `/static/mokly-generated/**`                                                   | Current generated documents, styles and resources                       |
| `/static/**`                                                                   | Exact indexed authored asset closure                                    |
| `/mokly-viewer/index.json`, `/mokly-viewer/entries/**`                         | Exact indexed catalogue index and current entry details                 |
| `/mokly-viewer/deployment.json`                                                | Exact indexed deployment file                                           |
| `/mokly-viewer/client/**`, `/mokly-viewer/shell.css`, `/mokly-viewer/fonts/**` | Exact indexed shell bundle, frame probe, styles and fonts               |
| `/mokly-viewer/diffs/generations/<generation>/**`                              | Exact indexed comparison file, `no-store`; never rewrite its generation |
| Other `.html` or `.htm` file                                                   | Exact indexed file, retaining extension                                 |
| Other directory ending `/`                                                     | Directory `index.html`                                                  |
| Other existing directory without final `/`                                     | 308 to final slash, retaining query                                     |
| Unknown entry or missing asset                                                 | Exact `404.html`, HTTP 404                                              |
| `/__mokly`, `/__mokly/**`                                                      | Exact `404.html`, HTTP 404, `no-store`                                  |
| `mokly-upload.json`, `.mokly-export-artifact`                                  | HTTP 404; never disclose bytes                                          |
| `/__blobs/<hash>/<indexed path>`                                               | File only if this publication owns that path/hash                       |

After ordinary host/access checks, refuse decoded paths whose first segment
is `__mokly`, matched without ASCII case sensitivity. Include the slashless
`/__mokly`, its trailing-slash form and every descendant; serve the indexed
`404.html` with HTTP 404 and `Cache-Control: no-store`. HEAD sends the same
metadata without bytes. No namespace redirect or rewrite is allowed. Apply
the same refusal to an indexed path reached through `/__blobs/`.

The entry `<path>` follows the [entry path grammar](./publication-review.md#versions-and-entry-paths).
Do not map old `/view/screens/<id>.html` URLs to entries. A publication
serves no live Serve route: `mokly-viewer/live.json`, `mokly-viewer/events`,
`mokly-viewer/diffs/selection` and `mokly-viewer/components/**` are ordinary
missing files.

Only GET and HEAD serve files; HEAD returns identical metadata without bytes.
Query parameters never participate in file lookup. Decode each path segment
once; reject invalid UTF-8/escapes, decoded slash/backslash, dot segments,
controls and absolute-path tricks. Residual percent sequences are literal
filename characters; lookup never decodes again or touches filesystem paths. Do not strip HTML
extensions, implement a SPA fallback or interpret `_headers`/`_redirects`.
MIME comes from the indexed path, with octet-stream as the unknown default;
identical bytes at paths with different extensions keep distinct MIME types.
Blob URLs also require publication access; hashes are never capabilities.

## Headers And Cache

[Catalogue delivery](./catalogue-delivery.md) defines the exact CSP, CORS,
`nosniff`, `Vary`, ETag, range, compression and bounded-cache rules.
Comparison resources under `mokly-viewer/diffs/**` use `no-store` on every URL.

## Viewer Resource Reads

The app fetches `mokly-viewer/index.json` and each entry detail it needs.
A current entry's detail is `mokly-viewer/entries/<path>.json`.
Index 9 `comparisonUrl` is null or
`mokly-viewer/diffs/generations/<64 lowercase hex>/`, without a leading slash;
resolve it from the catalogue origin root. A removed entry's
detail is `entries/<path>.json` inside that generation.
Comparison panes and removed screen previews read
`snapshots/<side>/mokly-generated/<path>/index.<viewport>[.dark].html`
inside that generation. The before side of a move uses the detail's `before`
path, which names the previous path. Removed pages and documents
fetch `previews/<path>/index.json` there, with `schemaVersion: 3`, `baseRef`,
`baseCommit` and `path`, then their historical
`snapshots/before/mokly-generated/<path>/index[.dark].html` and referenced
resources. The standalone shell reads the index, the details and
`mokly-viewer/deployment.json` from the same origin. These are
exact indexed files from the catalogue origin. No live Serve endpoint becomes
a publication resource.

## Private Access

`POST /v1/projects/{projectId}/publications/{publicationId}/access-grants`
requires the normal session, an admitted Origin, CSRF token, project read access
and a ready unexpired publication. It returns an opaque 256-bit grant and its
exchange URL. Store only the grant SHA-256, publication, user and a 60-second
expiry; responses are `no-store`. Never put the grant in a query or redirect.

The app POSTs `{ "grant": "..." }` as JSON to `/_access` on the exact
publication host with its own admitted Origin and credentials enabled. Limit this body
to 1 KiB with a ten-second reception deadline. Atomically consume the grant once, checking audience, expiry and
current user/project access. Return 204 and a host-only cookie:
`__Host-mkc_catalogue=<signed capability>; Path=/; Secure; HttpOnly;
SameSite=None; Max-Age=300; Partitioned`. No Domain attribute is allowed.

A browser with partitioned cookies keeps the cookie in a partition for the
app's top-level site, also where it blocks other third-party cookies. A
browser that blocks third-party cookies but has no partitioned cookies refuses
the cookie. A reader whose browser refuses the cookie gets the final message
of [Viewer](./viewer.md#catalogue-isolation). There is no new-tab recovery and
no query-token fallback. Decision: the cookie is partitioned, rather than
replaced by a secret hostname for each grant. The cookie then works inside the
app in current Chrome, Edge, Firefox and Safari 26.2 and later, and DNS, TLS
and requests to other servers would leak a secret hostname.

The HMAC-SHA-256 capability binds publication ID, user ID and expiry. Verify
the MAC in constant time, then audience, time and current project membership
on every private request, including assets and blob URLs. Grant replay,
wrong-host use and expired credentials grant no identity. Invalid, expired,
wrong-audience or old-key cookies continue anonymously; visibility policy
allows public catalogues and denies private ones. Responses clear invalid
cookies with the same host-only attributes, `Partitioned` included, and
`Max-Age=0`, even on denial.
Cookie-clearing responses use `no-store`, including public blob URLs. Revoking membership or
deleting the project takes effect on the next request; signing out alone
leaves the capability usable for at most its five-minute lifetime. Rotate the
shared signing key to revoke all outstanding capabilities. Credentials and
request bodies are never logged. An existing private catalogue returns 401
without access while a nonexistent publication returns 404. Decision: that
existence oracle is deliberate, because the viewer uses 401 to start the
grant exchange.

Only the app's `POST /_access` sets the catalogue cookie. The app sends it on
its own index and detail reads, and the browser sends it on current screen
frames. The embedded viewer's comparison and removed-preview reads
send no credentials, so they return 401 for a private catalogue.
The standalone shell sends same-origin cookies and needs an existing
catalogue cookie in its own browser store. A browser with partitioned cookies
keeps the app's cookie out of that store. A private-comparison error shows an
overlay without an action, and the app offers no new-tab link.
This makes no file public. The
[private artifact limit](./mokly-artifact-compatibility.md#private-artifact-limit)
gives the reads and the decision.

## Storage Boundary

Blob identity is per project, and an object key carries the content hash and
an incarnation that fences its lifetime, so a later reincarnation uses a new
key and a delayed deletion cannot remove fresh content.
[Publication storage](./persistence-publication-storage.md)
defines the identity and the exact maintenance lookup. Object keys are
storage names, never product URLs.

A stream open returns the total length of the object and the selected range,
or the complete object when no range was requested. A range is a pair of
inclusive offsets validated against the total length, so an adapter never
receives an unsatisfiable selection, and an adapter rejects an object whose
actual length differs from the indexed length. Viewer artifact reads use the
bounded whole-object read and verify every byte before use.

A full response hashes the body as it flows and never releases a complete
representation whose digest differs from the index: a client may receive a
prefix, never a complete corrupt body. Decision: a ranged read is not
re-hashed, because a range cannot recompute the whole digest; it relies on
the authenticated provider transport and the hash-named immutable object.
The origin streams every body from storage and never buffers a whole
representation. A storage read error is logged once and ends the response
body without a second HTTP status.

Streamed GCS media uses a ten-second connect timeout, a 60-second limit on
header receipt and a 60-second provider idle limit that counts only time
spent waiting on the provider; time during which the client leaves the body
unpolled never counts, so a slow reader cannot lose a healthy response by
pausing. No deadline spans the complete response body. Buffered JSON
operations keep finite whole-operation timeouts.

The GCS bucket is private. An optional `MKC_GCS_PREFIX` scopes the physical
name to `<prefix>/sha256/<hash>/<incarnation>` without changing logical keys
or public URLs; see
[object prefixes](./persistence-publication-storage.md#object-prefixes). The local
adapter uses an exclusively owned directory and publishes immutable files
atomically. Both verify supplied bytes before a write.
[Retention](./retention.md) owns reference accounting, failed-attempt
recovery and orphan cleanup.
