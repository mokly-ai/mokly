# Frame Access

Status: Mokly does not write the start page or the access worker yet, the frame probe has no access relay, and `postMessageAdapter` takes no access options. The [Mokly start page, worker and relay milestone](../../plans/private-catalogue-embedded-access.md#milestone-7-mokly-start-page-worker-and-relay) adds them.

This continues the [viewer frame adapter contract](./mokly-frame-adapter.md).
It defines the access route of `postMessageAdapter`. The route opens screens
from a frame host that needs a credential on every file, also in a browser
that refuses the cookie of that frame host inside a cross-site frame.

The host is the page that mounts the viewer and its frame adapter. The frame
host is the HTTP(S) server of `frameOrigin`. An access token is a credential
that the frame host issues for its own files. The host gets access tokens from
the frame host and gives them to the frames. A Mokly service worker on the
frame origin then adds the token to the requests of the frames.

The route works only when the host passes `access` to `postMessageAdapter`.
An adapter without `access` ignores every access message, so a frame that
shows the start page fails its handshake. The same-origin adapter has no
access route.

## Mokly Files

The static build writes two files of the
[frame package](./mokly-frame-package.md) into every output, beside the frame
probe:

| Path                                    | File                                                 |
| --------------------------------------- | ---------------------------------------------------- |
| `mokly-viewer/client/access-start.html` | The start page: one HTML document with inline script |
| `mokly-viewer/client/access-worker.js`  | The access worker: a service worker script           |

Both files have the same bytes in every output of one Mokly release. They hold
no catalogue data, no consumer code and no host-specific code. The start page
loads no script, style, image or font. It requests only its own URL, for the
cookie check below, and the access worker. It draws nothing. Decision: the
start page shows no text, because Mokly would otherwise show product copy
inside the frame of a host.

## Frame Host Requirements

A frame host that needs a credential supports the route when it obeys all of
these rules:

- It accepts `Authorization: Bearer {token}` with one of its access tokens on
  every request, as an alternative to its cookie.
- It answers 401 to a request for a file that needs a credential when the
  request has no valid credential.
- It answers a `GET` request without a valid credential whose
  `Sec-Fetch-Mode` is `navigate` and whose `Sec-Fetch-Dest` is `iframe` with
  the start page, for every path, with status 401 and
  `Cache-Control: no-store`.
- It serves the two Mokly files without a credential, from the same output as
  the documents, so that the start page, the worker and the relay come from
  one release.
- It sends `Service-Worker-Allowed: /` with the access worker, and with no
  other file.
- Its Content Security Policy lets the start page run its inline script,
  register the worker from its own origin and request its own origin.
- Its `frame-ancestors` policy admits only the hosts that may embed its
  frames.

## Start Page

The start page reads the `mokly-host` parameter of its own URL under the
[handshake rule](./mokly-frame-probe-wire.md#cross-origin-mount-and-handshake)
of the frame probe. Without exactly one valid HTTP(S) origin that differs from
its own origin, the start page stays inert. Otherwise it does these steps:

1. It sends one `request` message to `window.parent`.
2. It accepts the first valid `token` message, as the
   [access channel](#access-channel) defines.
3. It requests its own URL from its own origin with the cookies of the browser
   and without the token. When the answer is successful, it sends `reload`
   and reloads its document. It registers no worker.
4. Otherwise it registers the access worker with the scope `/`, gives the
   worker the token, and waits until the worker holds the token. Then it sends
   `reload` and reloads its document.
5. When it cannot register the worker or give the worker the token, it sends
   `unavailable` and stops.

Decision: the cookie first, then the worker, because a browser whose cookie
works then keeps the `HttpOnly` cookie and stores no token that scripts can
read.

A registration stays after its frames close. Later documents of the same frame
origin load through the worker without the start page. So a reader sees one
reload on the first screen of each frame origin.

## Access Worker

The access worker obeys these rules:

- It accepts a token only in a valid `token` message from a document of its
  own origin. The start page and the relay send it the same `token` message
  that they got from the host.
- It keeps the token with the latest `expiresAt` in storage that survives a
  restart of the worker.
- It adds `Authorization: Bearer {token}` to each request that its documents
  make to its own exact origin, and to no other request.
- It keeps an `Authorization` header that a request already has, and the
  cookies that the browser sends with the request.
- It answers a navigation whose answer is 401 with the start page, so that the
  frame asks for a new token.
- It stores no response, and it sends the token to no other place.

Decision: the header goes only to the exact origin of the worker, because the
frame host of another catalogue is another origin with other tokens.

Decision: the worker answers an expired navigation itself, because a
navigation that the worker requests carries `Sec-Fetch-Dest: empty`. The start
page rule of the frame host cannot match it.

The worker takes the scope `/`. A service worker of the catalogue's own
scripts takes the documents of its own scope, which is narrower than `/`,
because the frame host grants `/` only to the access worker. Those documents
get no token, so their frames fail where the frame host's cookie is refused.
Decision: the scope `/`, not `/static/` or `/static/mokly-generated/`, because
one registration then covers every document of the frame host. A second Mokly
registration, a build warning and a refusal of authored worker scripts were
rejected, because a catalogue with its own service worker is rare.

## Access Channel

Every access message is a JSON string of at most 8,192 UTF-8 bytes. A receiver
rejects a value that is not a string, or a longer string, before it parses
JSON. The exact envelope is
`{ channel: "mokly-frame-access", version: 1, type, ...fields }`. A receiver
rejects unknown keys, another channel, another version, an unknown type and an
invalid field value. It ignores a rejected message and sends no reply. Each
`window.postMessage` call names the exact target origin, never `"*"`. `H` is
the adapter of the host, and `F` is the start page or the relay in the frame.

| Type          | Direction | Fields               |
| ------------- | --------- | -------------------- |
| `request`     | F → H     | none                 |
| `token`       | H → F     | `token`, `expiresAt` |
| `reload`      | F → H     | none                 |
| `unavailable` | F → H     | none                 |

`token` is a string of 1 to 4,096 characters that matches
`/^[A-Za-z0-9._~+\/-]+=*$/`, the `token68` form of an HTTP credential.
`expiresAt` is a positive safe integer: the expiry in milliseconds since the
Unix epoch, as `Date.now()` counts.

The adapter accepts an access message only when `event.source` is the
`contentWindow` of its frame and `event.origin` is `frameOrigin`. The start
page and the relay accept a `token` message only when `event.source` is
`window.parent` and `event.origin` is the `mokly-host` origin. Only the start
page sends `request`, `reload` and `unavailable`. Access messages carry no
session nonce, because the start page runs before a session exists.

Decision: a channel of its own, not new types of the probe wire, because the
probe wire rejects unknown types and versions, and pages of earlier releases
keep their inspection with a newer adapter.

## Adapter Options

The [public interface](./mokly-frame-adapter.md#public-interface) declares the
two optional callbacks of `postMessageAdapter`.

`access` answers with an access token of the frame host and its `expiresAt`.
The adapter can call `access` for several frames at once, so a host shares
one token between those calls. The adapter keeps the token in memory only, and
it sends the token only to `frameOrigin`. An answer whose token breaks the
grammar above, or whose `expiresAt` has passed, counts as a rejected call.

`onAccessFailure` reports that a frame of the adapter can open no access
route. The adapter calls it at most once for each mount.

## Access Phase

An access phase starts when the frame sends `request` while its mount waits
for its document. The adapter answers at most one `request` in each mount. It
stops the handshake with the start page, calls `access`, and sends the answer
as a `token` message. The 5,000 ms limit of the
[mount rules](./mokly-frame-adapter.md#public-interface) does not apply to the
start page. After `reload`, the adapter waits for the next document of the
frame without a time limit. Then it sends `hello` under the
[handshake rules](./mokly-frame-probe-wire.md#cross-origin-mount-and-handshake).
The phase ends when the frame probe of that document answers `ready`. The
adapter ignores a `request` after `ready`.

The access phase fails, and the mount rejects with `unavailable`, when one of
these events occurs:

- The frame sends a second `request` in the same mount.
- The frame sends `unavailable`.
- The frame sends neither `reload` nor `unavailable` within 10 seconds after
  the adapter sent the token.
- The document after `reload` fails its handshake.
- The `access` call rejects.

For each of these failures except a rejected `access` call, the adapter calls
`onAccessFailure` for that mount. A rejected call sends no report, because the
host knows its own failure. Disposal ends an access phase and sends no report.

Decision: the adapter keeps this loop guard itself, for each mount, not as a
marker in the storage of the frame origin, because the frames of one catalogue
load the start page together, and a shared marker would fail the other frames.

## Renewal

While the adapter holds a token and has a mounted frame, it renews the token.
A renewal calls `access` and sends the answer as a `token` message to each
frame whose handshake completed. A renewal starts when 60 seconds remain
before `expiresAt`, but no sooner than 10 seconds after the previous `access`
call. Only one renewal runs at a time. A failed renewal sends nothing and runs
again at the next renewal time. On each `visibilitychange` to a visible page
and on each `pageshow`, a renewal whose time has passed runs at once.

Decision: renewal also on `visibilitychange` and `pageshow`, because iOS
pauses the timers of background tabs.

## Access Relay

The [frame probe](./mokly-frame-probe.md) holds the relay. After its
handshake, the frame probe accepts a `token` message as the access channel
defines. It forwards the message to the access worker of its own origin when
that worker controls its document, and otherwise it drops the token. The relay
sends no message to the host.

Decision: the relay lives in the frame probe, not in a second script in every
screen, because it uses the trust check of the frame probe and adds no script
to the documents.

## Browser Reach

The route needs a browser that sends `Sec-Fetch-Dest` and runs service
workers in cross-site frames. A browser without `Sec-Fetch-Dest`, such as
Safari before 16.4, gets the ordinary 401 answer of the frame host. A browser
that runs no service worker in the frame, and a reader who blocks all data of
the frame origin, get no route either.

## Related Docs

- [Viewer frame adapter](./mokly-frame-adapter.md)
- [Frame probe handshake and wire protocol](./mokly-frame-probe-wire.md)
- [Frame probe](./mokly-frame-probe.md)
- [Frame package](./mokly-frame-package.md)
- [Static build browser and identity](./mokly-export-browser.md)
