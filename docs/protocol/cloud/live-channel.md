# Live Channel

Status: The app client and build triggers are planned in the [app live client and build notices](../../../plans/live-channel-foundation.md#milestone-6-app-live-client-and-build-notices) milestone.

The live channel pushes changes to the app. The live client of the app, the
client below, holds one WebSocket for each project that the app shows, on the
API origin. A socket carries two kinds of traffic. A notice tells the socket
that a stored record of its project changed, and it carries no content. A
client event comes from one socket and goes to the other sockets of its
project. Postgres stays the record of every stored change.

Decision: one WebSocket, not long polling or Server-Sent Events, because the
channel must carry frequent client events as well as server messages.
Decision: each API replica serves its own sockets, and Postgres relays
between the replicas. A separate real-time service was rejected, because the
system stays in Rust, Postgres and Kubernetes.

## Route

`GET /v1/live/projects/{projectId}`, operation `openLiveChannel`, upgrades the
request to a WebSocket. The client opens it on the API origin with the `wss`
scheme. A successful upgrade answers 101 Switching Protocols. The route is an
operation of the [OpenAPI document](../../api/openapi.json), as
[Contract source](./rest-api.md#contract-source) requires of every route, and
it requires the session. The `/v1/live/` prefix keeps every socket under one
path, so that the deployment can give sockets a longer idle timeout than REST
requests.

## Authentication And Access

The upgrade authenticates with the `mkc_session` cookie of
[Sessions](./auth-sessions.md#sessions). The browser sends the cookie with the
upgrade, as it does with every API request. No other token, key or query
credential exists. Decision: the session cookie, not a separate socket token,
because the browser already sends the cookie to the API origin.

An upgrade cannot carry a CSRF token, so its `Origin` header must be an
admitted Origin of
[CSRF, Origins and Redirects](./auth-sessions.md#csrf-origins-and-redirects):
the app origin, or the desktop origin when `MKC_DESKTOP_CLIENT` is `true`.

Only a signed-in reader with [member access](./cloud-build-api.md#access) to
the project gets a socket. For an anonymous reader of a public project, the
client opens no socket and keeps polling. Decision: members only, because a
notice can name a record that only members may read, such as a build, and
each client event reaches the other readers of the project.

The server checks an upgrade in the order below. The first check that fails
answers with the `rpc-error` envelope of [REST transport](./rest-transport.md),
and no socket opens.

| Check                                                               | Refusal                 |
| ------------------------------------------------------------------- | ----------------------- |
| The request asks for a WebSocket upgrade, and `projectId` is a UUID | 400 `validation-failed` |
| The `Origin` header is an admitted Origin                           | 403 `csrf-rejected`     |
| The cookie names an existing session                                | 401 `unauthenticated`   |
| The session has not reached its absolute or idle deadline           | 401 `session-expired`   |
| The reader has member access to the project                         | 404 `not-found`         |

Each refusal uses an existing reason of the
[REST catalogue](./rest-api.md#reason-catalogue), so the channel adds no
reason. A cookie that is present fails as it fails on a project read. A
missing cookie fails as on every operation that requires the session. Without
member access, the upgrade fails as the member-only build reads do, so it does
not tell an unknown project from an inaccessible one. The operation's
`x-reasons` lists these reasons and `internal-error`. A page cannot see the
status of a refused upgrade, so the client handles every failed open in the
same way, as [Shutdown and reconnect](#shutdown-and-reconnect) says.

## Access Checks

Elsewhere in the API, a removed member or a signed-out session loses access
on its next request. A socket is one long request, so every 30 seconds the
server checks again the session and the member access of each socket. A
socket loses access when one of these is true:

- The cookie that opened it no longer authenticates, for example after a
  sign-out, a session rotation or an expiry.
- Its reader no longer has member access to the project.

The server then closes the socket with code 4403. A check records no session
activity, so an open socket does not extend the idle deadline of its session.
A check that cannot read the database keeps the socket open, and the next
check runs 30 seconds later.

## Keepalive

The server sends a WebSocket ping frame on each socket every 25 seconds,
because Cloudflare closes a WebSocket after 100 idle seconds. A browser
answers each ping with a pong on its own, so the client sends no keepalive
message. The server closes a socket that has sent no pong for 60 seconds with
code 4408. Ping and pong frames are control frames, not messages.

## Messages

Every message is one JSON object with a string `type`, in a text frame. A
later kind of message joins as a new `type`, so it needs no new route. The
message types are component schemas of the OpenAPI document, generated from
the Rust types, so the TypeScript types that the app generates from the
document include them.

The server sends these messages:

| `type`              | Fields                   | Meaning                                                |
| ------------------- | ------------------------ | ------------------------------------------------------ |
| `notice`            | `kind`, `id`, `sequence` | A stored record of the project changed                 |
| `resync`            | None                     | The server can have missed notices, so read again      |
| A client event kind | The fields of that kind  | A client event from another socket of the same project |

The client sends only client events. The `type` of a client event is its
kind. Later plans add client event kinds.

The client ignores a server message with an unknown `type`. The server ignores
a client message that is not a JSON object with a known `type`, and it logs one
warning for that socket. Decision: an unknown message is ignored, not
refused, so that a client and a server of different versions keep working
during a rollout.

## Notices

A notice carries the `kind` of the changed record, its `id` and a `sequence`,
but none of its content. The client reads the change through the REST read of
that kind, so each read keeps its own access rule. Decision: notices without
content. Content on the socket, sent by the code of each writer, was rejected,
because the server would then need an access rule for each kind, and a writer
could forget its notice.

A trigger on each table that has a notice kind calls the SQL function
`mkc_live_notice(project, kind, id, sequence)` inside the write transaction.
Every trigger calls this one function, so the shape of a notice lives in one
place. The function notifies on the Postgres channel `mkc_live_notice` with
the project, the kind, the ID and the sequence. Because a trigger sends the
notice, every writer of the table notifies. Because Postgres delivers a
notification only after its transaction commits, a rolled-back write sends no
notice.

Each replica listens on `mkc_live_notice` and sends each notice to every
socket of its project. `id` is a UUID string, and `sequence` is an integer.
The protocol doc of each kind defines the writes that send it, its `id`, its
`sequence` and the reads that follow it:

- `build` and `build-log`: [Cloud build API](./cloud-build-api.md#live-notices).

While the client has no open socket, as for a reader without member access,
it polls each kind that the app shows by the poll rule of that kind.

## Client Events

A client event comes from one socket and goes to every other socket of its
project, on every replica. A client event kind can name a coalesce key. The
server collects client events in ticks of 50 ms. In each tick, it keeps only
the last event of each socket and coalesce key, and every event of a kind
without a key. At the end of the tick, it sends the kept events to its own
sockets of the project, except the socket that sent each event, and to the
relay. The server stores no client event, so a socket that is not open when a
tick goes out never gets the events of that tick.

The replicas relay client events through the Postgres channel
`mkc_live_relay`. A relay message holds the ID of the sending replica, the
project and the events. It stays under 7,900 bytes, because Postgres refuses
a payload of 8,000 bytes or more. A larger tick splits into more messages. A
replica sends all relay messages of one tick in one transaction, because each
notifying commit takes a lock that serializes every notifying commit of the
database. A replica ignores the relay messages with its own ID, because it
already sent those events to its own sockets.

## Resync

A replica that loses its subscription to the two channels can miss notices
and relay messages until it subscribes again. After it subscribes again, it
sends `resync` to each of its sockets. On `resync`, the client reads again
each kind that the app shows. The client does the same each time its socket
opens, the first open included, because a change can commit between its last
read and the open.

## Limits

A client message holds at most 4 KiB, 4,096 bytes. The server closes a socket
that sends a larger message with code 1009. A socket that sends more than 120
messages a second loses the extra messages, and the server logs one warning
for that socket.

## Shutdown And Reconnect

On SIGTERM, a replica closes each of its sockets with code 1001 before it
stops, so that their readers reconnect to another replica at once.

The client opens one socket for each project that the app shows to a reader
with member access, as the app infers that access for
[build cards](./viewer-builds.md). After every close and every failed open,
the client opens the socket again. The first wait is 0.5 seconds. Each later
wait doubles, up to 15 seconds, and each wait has a random jitter. The wait
goes back to 0.5 seconds after a socket opens.

## Close Codes

| Code | Sent when                                 |
| ---- | ----------------------------------------- |
| 1001 | The replica shuts down                    |
| 1009 | A client message holds more than 4 KiB    |
| 4403 | A check finds that the socket lost access |
| 4408 | No pong came for 60 seconds               |

Codes 4403 and 4408 follow the HTTP statuses 403 and 408.

Related: [REST API](./rest-api.md),
[Authentication and sessions](./auth-sessions.md) and
[Cloud build API](./cloud-build-api.md).
