# Catalogue Delivery

Status: CORS does not admit the `authorization` header or send `Access-Control-Max-Age` yet, and `Vary` does not name `Authorization` and `Sec-Fetch-Dest` yet. The [catalogue server bearer and start page milestone](../../../plans/private-catalogue-embedded-access.md#milestone-6-catalogue-server-bearer-and-start-page) adds them.

This is the header, range, compression and cache sub-contract of
[Catalogue hosting](./catalogue-hosting.md).

## Headers And Cache

Every response includes `X-Content-Type-Options: nosniff`,
`Referrer-Policy: no-referrer` and a restrictive Permissions-Policy. Catalogue
HTML has CSP:

```text
default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; media-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self' <exact app origin>
```

Inline script/style support is required by published authored exports; external
scripts, network calls, forms, objects and embedding by other origins are
blocked. `'self'` lets the standalone shell load its bundle, read the index,
the entry details, the deployment file and comparison documents, and frame
screen documents from that same publication origin. It does not
authorize another publication host: every publication has a distinct origin.
The only
cross-origin ancestor is the exact app origin, joined by the desktop origin
of [Desktop application](./desktop-app.md#api-and-catalogue-admission) when
`MKC_DESKTOP_CLIENT` is `true`. Wildcard catalogue origins, the
API origin and unrelated publication origins are forbidden. Frame embedding
follows [Viewer](./viewer.md#catalogue-isolation).
The app's iframe adds its own `sandbox` restriction. CORS allows credentials
only for the exact app origin, and the admitted desktop origin, and never `*`.
For those origins CORS also admits the `authorization` request header of the
[bearer token](./catalogue-private-access.md#credentials), and each preflight
answer to them carries `Access-Control-Max-Age: 600`, so that a reader on the
bearer route does not repeat the preflight of a file for ten minutes. Every response, including errors,
redirects, HEAD and preflight, carries the canonical field `Vary: Origin,
Cookie, Authorization, Sec-Fetch-Dest, Accept-Encoding` because those request
headers affect authorization, response headers or representation. Preflight is answered before host
routing, so an unknown host still receives a preflight answer.

Comparison files under `mokly-viewer/diffs/**` use `no-store`, including
when reached through a public immutable blob URL. The released delivery
contract permits `no-store` for a comparison generation.
Private responses, comparison resources, grant exchange, errors and aliases
use `Cache-Control: no-store`. The start page answer and the two Mokly files
that a private publication serves without a credential are private responses.
Public shell stubs, the index, the entry
details, the deployment file and ordinary assets use `no-cache`.
Only public `/__blobs/` URLs use `public, max-age=31536000, immutable`.
Previously public cached bytes cannot be recalled by a visibility change;
every subsequent network request checks current visibility and membership.
No CDN may bypass that check. ETags identify exact bytes; private responses
never become unauthenticated 304 responses.

Every indexed file response identifies its stored bytes with weak
`ETag: W/"<lowercase SHA-256>"`. Weak validators are required because one
stored identity can have identity, gzip and Brotli representations. For a GET
or HEAD whose otherwise successful response is a public `no-cache` or immutable
200, the origin evaluates `If-None-Match` before `Range`. `*` matches any
existing file; an entity-tag list uses weak comparison, so either weak or
strong syntax with the same opaque hash matches. A match produces 304 with no
body and the same selected content coding, `ETag`, `Cache-Control` and `Vary`
values as the corresponding 200. A 304 never carries `Content-Length`. All
security, CORS and isolation headers still apply. Malformed conditionals are ignored.
`no-store` responses ignore `If-None-Match`: this includes private catalogues,
comparison resources, errors, the 404 fallback, grant exchange, aliases and
any response that clears a cookie.

### Byte Ranges

After authorization and exact path lookup, an otherwise 200 file response
accepts one byte range in one of three forms: `bytes=a-b`, `bytes=a-` or
`bytes=-n`, with unsigned base-10 integers. A closed range with `a > b`, a
start at or beyond the representation length, suffix length zero, or any range
over an empty representation is unsatisfiable. A final offset beyond the end is
clamped; a suffix at least as large as a nonempty file selects the whole file.

A satisfiable request is 206 with `Content-Range: bytes a-b/len` and a
`Content-Length` equal to the selected length. An unsatisfiable single range is
416 with `Content-Range: bytes */len`, an empty body and the error-class
`no-store` cache policy. A comma (multiple ranges), an unknown unit, integer
overflow or any other unparseable value is ignored and the full 200
representation is sent. If `If-Range` is present, the origin also sends the
full 200 representation because a weak ETag can never satisfy that header's
strong comparison.

Ranges apply to indexed file responses, including authorized `no-store` files,
but never to redirects, errors or the 404 fallback. File responses advertise
`Accept-Ranges: bytes`; 416 does too. A 206 is never content-coded. HEAD follows
the same selection and returns the GET status and headers without a body.

### Origin Compression

The origin selects identity, `gzip` or `br` from `Accept-Encoding` using RFC
9110 quality values, explicit codings and the wildcard. Identity is acceptable
by default unless explicitly excluded; Brotli wins an equal positive
preference, followed by gzip and identity. If the request refuses every
supported coding, including `identity;q=0` or `*;q=0` without another accepted
coding, the origin sends identity rather than 406. This RFC 9110-permitted
fallback keeps negotiation from changing the status or semantics of files,
redirects, errors and `/_access`.

Coding is eligible only for the full public representation whose stored length
is greater than 1,024 bytes, cache class is not `no-store` and MIME matches the
predicate below. The one negotiation result frames GET, HEAD and 304. A coded
GET streams through the origin encoder and carries `Content-Encoding` without
`Content-Length`; its HEAD carries the same fields and no body. An identity 200
or HEAD carries the stored length. A 206 always carries its selected range
length and `Content-Range` and is identity. A 304 carries its selected
`Content-Encoding` when coded, plus `ETag`, `Cache-Control` and `Vary`, but no
`Content-Length`. The server never infers framing from an empty HEAD or 304
body.

Ignoring MIME parameters and ASCII case, the exact compressible predicate is:

- any `text/*` type;
- `application/json`, `application/javascript` and `application/xml`;
- any `application/*+json` or `application/*+xml` structured-syntax type; and
- `image/svg+xml` and `application/manifest+json` explicitly.

Everything else, including archive, image other than SVG, audio, video and font
types, stays identity encoded. A coded body streams through the origin
encoder with backpressure to storage; the origin never buffers the whole
representation. Decision: the encoders use Brotli quality 4 and gzip level 4
rather than the dependency defaults, so that a dependency update cannot
change origin cost.

### Bounded Hot Cache

The catalogue process may keep one bounded cache of verified full objects.
It is consulted only after host resolution, current publication
visibility/authorization and exact path lookup have produced a stored
identity. A hit can therefore bypass storage, never policy, existence checks
or path-specific MIME selection. A cached full object may satisfy a full or a
ranged body.

`MKC_CATALOGUE_HOT_CACHE_BYTES` bounds every byte the cache owns: in-flight
fills, retained entries and evicted entries still referenced by responses.
Each entry is charged its full object length plus a fixed 512-byte overhead,
so at most capacity ÷ 512 entries exist whatever the object sizes, and a
budget below 512 bytes admits nothing. The charge is reserved before the
object is buffered and released only when the last cache or response owner
drops it; eviction alone does not release it. Before refusing a reservation,
the cache evicts unreferenced entries. When in-use bytes still occupy the
budget, the object exceeds 8 MiB, its charge exceeds capacity or capacity is
zero, delivery streams from storage without a fill buffer. Zero disables the
cache.

At most one fill runs for a key; concurrent misses wait and then share the
verified entry. A provider or verification failure admits nothing, and its
waiters stream from storage rather than starting another buffered fill. A
ranged miss opens only the requested storage range and never admits it. HEAD
and 304 responses do not consult cache bytes. Info-level tracing reports
monotonic hit, miss, eviction and refused-reservation counters, without
paths, keys, sizes or body bytes.
