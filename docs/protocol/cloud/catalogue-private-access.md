# Catalogue Private Access

Status: The app sends no bearer token yet. The [app access milestone](../../../plans/private-catalogue-embedded-access.md#milestone-8-app-access-through-the-bearer-token) adds it.

This is the private access sub-contract of [Catalogue hosting](./catalogue-hosting.md).
Every file of a private publication needs a credential except the start page
and worker of the [embedded access route](#embedded-access-route). The app
gets a credential through a one-use access grant. The publication host
exchanges the grant for a cookie and a bearer token that hold the same signed
capability.

## Access Grants

`POST /v1/projects/{projectId}/publications/{publicationId}/access-grants`
requires the normal session, an admitted Origin, CSRF token, project read access
and a ready unexpired publication. It returns an opaque 256-bit grant and its
exchange URL. Store only the grant SHA-256, publication, user and a 60-second
expiry; responses are `no-store`. Never put the grant in a query or redirect.

The app POSTs `{ "grant": "..." }` as JSON to `/_access` on the exact
publication host with its own admitted Origin and credentials enabled. Limit this body
to 1 KiB with a ten-second reception deadline. Atomically consume the grant once, checking audience, expiry and
current user/project access. Return 200 with `Cache-Control: no-store`, the
JSON body `{ "token": "<signed capability>", "expiresIn": 300 }` and a
host-only cookie that holds the same capability:
`__Host-mkc_catalogue=<signed capability>; Path=/; Secure; HttpOnly;
SameSite=None; Max-Age=300; Partitioned`. No Domain attribute is allowed.
`expiresIn` counts the seconds until the capability expires. The API and its
OpenAPI document do not change. Decision: the publication host returns the
token, not the API, so that the grant flow stays as it is and only the
publication host signs capabilities.

## Partitioned Cookie

A browser with partitioned cookies keeps the cookie in a partition for the
app's top-level site, also where it blocks other third-party cookies. A
browser that blocks third-party cookies but has no partitioned cookies refuses
the cookie. That browser opens frames through the
[embedded access route](#embedded-access-route), and the app sends the bearer
token on its own reads there. A reader for whom neither route works
gets the blocked stage of [Viewer](./viewer.md#catalogue-isolation). There is
no new-tab recovery and no query-token fallback. Decision: the cookie is
partitioned, rather than replaced by a secret hostname for each grant. The
cookie then works inside the app in current Chrome, Edge, Firefox and Safari
26.2 and later, and DNS, TLS and requests to other servers would leak a secret
hostname.

## Credentials

The HMAC-SHA-256 capability binds publication ID, user ID and expiry. The
bearer token is that same capability, so one publication, one user and 300
seconds bound both credentials. Decision: the token is the capability of the
cookie, not a separate token with a 120-second life, a token bound to
`Sec-Fetch-Site` and `Origin`, or a token bound to a browser key, because the
mockup scripts that can read the token can already read the same files, and a
shorter life adds failures after a tab sleeps.

The server reads `Authorization: Bearer <signed capability>` first. When that
header is missing or does not verify, the server reads the cookie. When the
bearer verifies, the server ignores the cookie. An invalid bearer clears no
cookie. Decision: the cookie after an invalid bearer, because an old stored
token must not hide a valid cookie.

Verify the MAC in constant time, then audience, time and current project membership
on every private request, including assets and blob URLs. Grant replay,
wrong-host use and expired credentials grant no identity. Invalid, expired,
wrong-audience or old-key credentials continue anonymously; visibility policy
allows public catalogues and denies private ones. Responses clear invalid
cookies with the same host-only attributes, `Partitioned` included, and
`Max-Age=0`, even on denial.
Cookie-clearing responses use `no-store`, including public blob URLs. Revoking membership or
deleting the project takes effect on the next request; signing out alone
leaves the capability usable for at most its five-minute lifetime. Rotate the
shared signing key to revoke all outstanding capabilities. Credentials, the
`Authorization` header included, and request bodies are never logged. An
existing private catalogue returns 401 without access except when it serves
one of the two public Mokly files. A nonexistent publication returns 404.
Decision: the existence oracle is deliberate, because the viewer uses 401 to
start the grant exchange. The start page answer to a frame navigation also
carries status 401, so it discloses nothing new.

## Embedded Access Route

A browser that refuses the cookie opens private screens through the Mokly
[frame access contract](../mokly-frame-access.md). A start page asks the app
for the bearer token, and a Mokly service worker adds the token to the
requests of the frame. Decision: the embedded route, not a first-party new tab
for each blocked reader, and not a workspace setting that switches to a secret
hostname for each grant, because readers then stay inside the app, and no
secret goes into a hostname or a URL.

For a private publication, a `GET` request without a valid credential, with
`Sec-Fetch-Mode: navigate` and `Sec-Fetch-Dest: iframe`, gets the start page
in place of the requested file, for every path. The server does not look the
path up first, so the answer discloses no file name. The answer carries the
bytes of the publication's own `mokly-viewer/client/access-start.html` as
`text/html; charset=utf-8`, with status 401 and `Cache-Control: no-store`. A
top-level navigation, a request without `Sec-Fetch-Dest`, and a publication
without that file get the ordinary 401 answer.

Without a credential, the server serves `mokly-viewer/client/access-start.html`
and `mokly-viewer/client/access-worker.js` of a private publication from its
own indexed bytes. The worker always carries `Service-Worker-Allowed: /`, and
no other response carries that header. Every other private file still needs a
credential. Decision: the server serves the publication's own CLI-written
files, not files that pass a hash check against known Mokly releases or Mokly
files built into the server, because the host name is a random ID, and a
writer can already copy the catalogue anywhere. Publications from a Mokly
release without these files rely on the partitioned cookie.

The route needs a browser that sends `Sec-Fetch-Dest` and runs service workers
in cross-site frames: Safari 16.4 and later, and current Chrome, Edge and
Firefox. iOS in-app browsers on WKWebView run no service workers without
App-Bound Domains, and a reader who blocks all data of the catalogue domain
gets no route either. Each publication host is its own origin, so a reader on
the route sees one reload on the first screen of each publication.

## App Reads

Only the app's `POST /_access` sets the catalogue cookie or issues the token.
The app sends the cookie on its own index and detail reads, and the browser
sends it on current screen frames. Where the browser refuses the cookie, the
app sends the bearer token on those reads, as
[Viewer](./viewer.md#catalogue-isolation) defines, and the CORS rules of
[Catalogue delivery](./catalogue-delivery.md#headers-and-cache) admit its
`authorization` header. The embedded viewer's comparison and removed-preview reads
send no credentials, so they return 401 for a private catalogue.
The standalone shell sends same-origin cookies and needs an existing
catalogue cookie in its own browser store. A browser with partitioned cookies
keeps the app's cookie out of that store. A private-comparison error shows an
overlay without an action, and the app offers no new-tab link.
This makes no file public. The
[private artifact limit](./mokly-artifact-compatibility.md#private-artifact-limit)
gives the reads and the decision.
