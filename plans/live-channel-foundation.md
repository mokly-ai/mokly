# Live channel foundation

Status: Active. On branch `calummoore/live-channel-foundation-implementation-n1hi`, no pull request yet. The pull request that completes the work deletes this plan, as the `plans` skill says.

Mokly Cloud cannot push anything to a reader. The build card polls every 3
seconds, and comments, agent sessions and live cursors all need a push. This
change builds the shared live channel and nothing that only one feature
needs: one WebSocket for each open project in `mkc-api`, a hub on each API
replica, a Postgres `LISTEN`/`NOTIFY` relay between replicas, change notices
that Postgres sends at commit, and the app's live client. The build card is
its first user. Presence and cursors follow in
[live-presence-cursors](./live-presence-cursors.md). Comments and agent
sessions build on this channel in their own plans.

## Decisions

- **Scope, 2026-11-24, Cal.** Cal named comments, agents and cursor following
  as the three features to add soon. Postgres stays the record of every
  durable feature. Loss of presence and cursor state is harmless.
- **Approach, 2026-11-24, Cal.** Keep everything in Rust, Postgres and
  Kubernetes: a stateless channel in `mkc-api` with a Postgres relay.
  Alternatives:
  - Rivet Actors, self-hosted in GKE. Left out: Rivet 3 stores Actor data on
    its own disks and in a bucket, not in Postgres, and it adds a stateful
    control plane in each environment. Its Rust SDK was at `3.1.2-rc.7` on
    2026-11-24.
  - One Cloudflare Durable Object for each project, behind a new Worker. Left
    out: Cal chose to keep the system in Rust, Postgres and Kubernetes.
  - An actor cluster in `mkc-api` with a Postgres lease for each project.
    Left out: it adds failover and rebalancing that the features do not need.
  - Plane, Supabase Realtime, Electric, y-sweet and plain polling. Left out:
    Plane's company appears to have shut down, the next three are not Rust or
    do not use Postgres, and polling cannot carry cursors.
- **Stored changes, 2026-11-24, Cal: notices without content.** A trigger on
  each stored table calls `pg_notify` inside the write transaction, so every
  writer notifies, and only after commit. The socket carries
  `{kind, id, sequence}`. The reader reads the change through the REST read
  of that kind. Alternatives:
  - Separate long-polling REST endpoints for each feature. Left out: each
    still needs the relay to wake it, and each repeats the catch-up.
  - Change notices and agent text on the socket, sent by each writer's code.
    Left out: the hub would need an access rule for each kind, and a writer
    can forget its notice.
  - One event log table for each project, read by one long poll. Left out:
    double writes, retention, and member-only kinds next to public ones.
  - The second alternative with trigger-sent notices. Left out: it keeps the
    access rule for each kind in the hub.
  - Server-Sent Events, logical replication and short polling. Left out: the
    socket already exists, a replication slot left by a stopped pod keeps
    write log on the shared database, and a 3-second poll shows agent text in
    jumps.
- **Split, 2026-11-24, Cal.** The shared foundation merges into `main` first,
  so that comments, agents and presence can build on it in parallel.

### Design calls

My calls, 2026-11-24:

- **WebSocket, not long polling or Server-Sent Events.** Cursors send up to
  one move for each animation frame, so the channel must carry client events.
- **Auth uses the existing session cookie.** The socket is on the API origin,
  so the browser sends `mkc_session`. The upgrade checks the `Origin` header
  against the admitted Origins of the auth exchanges, then the reader's
  access to the project. A failure answers as a project read does. No new
  token or key exists.
- **Members only.** Only a signed-in member with access to the project gets a
  socket. Presence will show names. An anonymous reader of a public project
  keeps polling.
- **Access checks again every 30 seconds.** The protocol docs say that a
  removed member, a private transition and a sign-out take effect on the next
  request. A socket is one long request, so the hub checks the session and
  the project access of each connection every 30 seconds. It closes a
  connection that lost access with code 4403.
- **Route `GET /v1/live/projects/{projectId}`.** The `/v1/live/` prefix lets
  one GCE ingress path rule send the socket to its own Kubernetes Service.
- **A separate Service and `BackendConfig` for the socket.** The API's
  `BackendConfig` sets `timeoutSec: 30`, and on a GCP load balancer that value
  also ends a WebSocket. The live Service gets 3,600 seconds. The REST API
  keeps 30 seconds. Previews get a separate nginx Ingress for `/v1/live/` with
  3,600-second read and send timeouts.
- **Pings every 25 seconds.** Cloudflare closes a WebSocket after 100 idle
  seconds. The server closes a socket with no pong for 60 seconds.
- **Two kinds of traffic.** A notice comes from a database trigger and goes to
  every socket of its project. A client event comes from one socket and goes
  to the other sockets of its project. The foundation defines no client
  event kind. The presence plan adds the first ones.
- **Client events coalesce on a 50 ms tick.** A client event kind can name a
  coalesce key. The hub keeps only the last event of each connection and key
  in a tick, then sends the tick to its sockets and to the relay.
- **One relay transaction for each tick.** Each `NOTIFY` transaction uses a
  transaction ID and takes a lock that serializes every notifying commit. So
  each replica sends all client events of a tick in one transaction.
  Production Cloud SQL has 2 vCPUs.
- **Two channels.** Triggers notify on `mkc_live_notice`. Replicas relay
  client events on `mkc_live_relay`. A notice holds the project, the kind, the
  ID and the sequence. A relay message holds the replica ID, the project and
  the events, and stays under 7,900 bytes. A larger tick splits. A replica
  ignores its own relay messages.
- **One SQL function for every trigger.** A migration adds
  `mkc_live_notice(project, kind, id, sequence)`. Each feature's trigger calls
  it, so the notice shape lives in one place.
- **The relay connections.** Each replica holds two dedicated `tokio-postgres`
  connections through the Cloud SQL proxy sidecar: one listens on both
  channels and one sends. Diesel can read waiting notices but cannot wait for
  one in async code.
- **Read again after a gap.** After the listener reconnects, the hub sends
  `resync` to each of its sockets. The client then reads again each kind that
  it shows. A client does the same after its own reconnect.
- **Shutdown.** On SIGTERM a replica closes each socket with code 1001. The
  client reconnects after 0.5 seconds, doubling to 15 seconds, with jitter.
- **Limits.** A client frame holds at most 4 KiB. A connection that sends
  more than 120 messages a second loses the extra messages, and the server
  logs one warning for that connection.
- **Every message has a `type`.** Later kinds join without a new route.
- **Message types.** The messages are OpenAPI component schemas from the Rust
  types, so the app's generated client holds their TypeScript types.
- **Crates.** `mkc-live-interface` holds the message types and the
  `LiveRelay` trait. `mkc-live` holds the hub, the tick, the limits and an
  in-memory relay for tests. `mkc-live-pg` holds the Postgres relay. The route
  lives in `mkc-api`. The migration lives in `mkc-db`. The interface crate
  came on 2026-11-25, as the call below says.
- **The build card is the first user.** Builds and their log rows notify
  through triggers. The build card reads on each notice. It keeps today's
  3-second poll while the socket is down, and polls every 30 seconds while the
  socket is up, as a safety net. This proves the whole path in production
  before comments and agents use it.

My calls, 2026-11-25, after a check of the code:

- **SIGTERM starts the shutdown.** The API stops only on Ctrl-C today, and
  Kubernetes sends SIGTERM. The API also handles SIGTERM: the hub closes each
  socket with code 1001, then the existing graceful shutdown runs. Without
  this, a socket stays open until Kubernetes kills the pod.
- **Two build kinds with filtered triggers.** `build` notices come from an
  insert into `builds` and from an update that changes a column that a reader
  sees, with the row's `log_sequence` as the sequence. `build-log` notices
  come from an insert into `build_log_chunks`, with the row's `sequence`. A
  lease renewal and the `log_sequence` or `log_bytes` update of a log append
  send no `build` notice, because a lease renewal changes nothing that a
  reader sees and the `build-log` notice already covers the append.
- **The route is a documented operation.** The router builds every route from
  the OpenAPI document, so the live route is an operation with a 101 answer,
  and the router sends it to the live handler, as it sends the upload
  operations to the upload handler.
- **A slow socket gets a resync, not an unbounded queue.** Each connection has
  a bounded outbound queue. When the queue is full, the hub drops the message
  and marks the connection. When the queue has room again, the hub sends
  `resync` before the next message. So the hub never holds unbounded memory,
  and a reader never misses a notice without a resync. The queue holds 256
  messages (my call, 2026-11-25): far more than one tick sends to a socket,
  and a small bound for each connection's memory.
- **An interface crate for the trait and the messages.** The 2026-11-24 call
  put the `LiveRelay` trait in `mkc-live`, beside the hub. The crate layering
  of the [architecture doc](../docs/architecture/cloud.md) puts each trait
  that crosses a boundary in an `-interface` crate, and an adapter depends
  only on interfaces. So `mkc-live-interface` holds the trait and the message
  types, and both `mkc-live` and `mkc-live-pg` depend on it.
- **Every open counts as a resync.** The client reads again each kind that it
  shows each time its socket opens, the first open included. A change can
  commit between the first REST read and the first open, and its notice then
  reaches no socket. The cost is one more read for each page load.
- **Docs that the change makes stale.** The
  [viewer builds](../docs/protocol/cloud/viewer-builds.md) doc states the
  card's 3-second poll, and the [viewer](../docs/protocol/cloud/viewer.md) doc
  states the exact Content Security Policy. Both change with this work.

Contract owners:

- A new protocol doc, `docs/protocol/cloud/live-channel.md`.
- [REST API](../docs/protocol/cloud/rest-api.md) and
  [cloud build API](../docs/protocol/cloud/cloud-build-api.md).
- The [`mkc-api` README](../crates/mkc-api/README.md), the
  [`mkc-db` README](../crates/mkc-db/README.md), the
  [Helm chart README](../infra/helm/mokly-cloud/README.md) and the
  [architecture doc](../docs/architecture/cloud.md).

## Milestone 1: Documentation and protocol

Depends on: none

- [x] Write `docs/protocol/cloud/live-channel.md` with a status line: the
      route, the auth, the access checks, the message envelope, notices,
      client events, resync, the limits and the reconnect.
- [x] Add the route to `docs/protocol/cloud/rest-api.md`.
- [x] Add build notices and the poll rule to
      `docs/protocol/cloud/cloud-build-api.md`.
- [x] Add the live channel to `docs/architecture/cloud.md`.

## Milestone 2: Live hub

Depends on: 1

- [x] Create `mkc-live-interface` with the message envelope and the
      `LiveRelay` trait, and `mkc-live` with the hub, the tick with coalesce
      keys and the limits.
- [x] Add the in-memory relay and tests for notices, client events,
      coalescing, resync and limits.

## Milestone 3: Live route

Depends on: 2

- [x] Turn on the Axum `ws` feature in `mkc-api` and add the route with the
      cookie, Origin and member checks, the access check every 30 seconds,
      the pings and the shutdown.
- [x] Add the message schemas to the OpenAPI document and regenerate the
      app's client.
- [x] Test the route with one replica and the in-memory relay.

## Milestone 4: Postgres relay and notices

Depends on: 3

- [ ] Add the migration with `mkc_live_notice` and its `down.sql`.
- [ ] Create `mkc-live-pg` with the listen and send connections, both
      channels, one transaction for each tick, the split and the listener
      reconnect with resync.
- [ ] Test two hubs on the test Postgres: a trigger notice and a client event
      reach the sockets of the other hub.

## Milestone 5: Infrastructure

Depends on: 3

- [ ] Add the live Service and its `BackendConfig` with `timeoutSec: 3600`,
      and the ingress path `/v1/live/*`.
- [ ] Add the preview nginx Ingress for `/v1/live/` with 3,600-second
      timeouts.
- [ ] Add the `wss://` API origin to `connect-src` in
      `infra/docker/app-server.mjs`.
- [ ] Update the Helm golden renders and the chart README.

## Milestone 6: App live client and build notices

Depends on: 4

- [ ] Add the live client to `packages/app`: one socket for each open
      project, reconnect with backoff, resync, and subscribe by kind.
- [ ] Add the build and build log triggers in a migration with its
      `down.sql`.
- [ ] Make the build card read on each build notice, with the 3-second poll
      while the socket is down and the 30-second poll while it is up.

## Milestone 7: Verification, commit, review, and pull request

Depends on: every other milestone

- [ ] Smoke-test a build on a preview with two API replicas: its steps show
      without the 3-second wait, and a stopped socket falls back to polling.
- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record
      follow-up items under `plans/follow-ups/` for the rest, re-review
      once, and report.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request. Its description gives the decisions and the
      design calls of this plan with their dates, a permalink to this plan,
      and the follow-up items that the change adds.

## Post-merge follow-up (non-blocking)

- [ ] Watch the Cloud SQL notice rate and the connection count in production
      for a week after the merge.
