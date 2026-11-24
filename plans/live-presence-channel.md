# Live presence and cursors over a Rust and Postgres channel

Status: Active. On branch `calummoore/rust-realtime-postgres-libraries-5fi6`, no pull request yet. The pull request that completes the work deletes this plan, as the `plans` skill says.

The viewer shows nobody else who looks at the same project. The Canvas
redesign of the site draws avatars in the viewer bar, readers on catalogue
rows and live cursors with name tags, and marks each drawing
`status: "ahead" (presence)`. This change adds a live channel to `mkc-api`:
one WebSocket for each open project, a hub on each API replica, and a relay
between replicas through Postgres `LISTEN`/`NOTIFY`. The first features on it
are presence and live cursors. Nothing that the channel carries is stored.

The change does not build comments or agent sessions. Their transport is the
open decision 8 below. Where an agent session runs is the follow-up item
[agent-session-runtime](./follow-ups/agent-session-runtime.md).

## Decisions

- **Scope of the channel, 2026-11-24, Cal.** The channel carries presence and
  cursors now. Comments and agent output will need live delivery later. Cal
  first scoped the channel to pointer following, then named comments, agents
  and cursor following as the three features to add soon. Loss of presence
  and cursor state is harmless. Postgres stays the record of every durable
  feature.
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
    Left out: it adds failover and rebalancing that presence does not need.
  - Plane, Supabase Realtime, Electric, y-sweet and plain polling. Left out:
    Plane's company appears to have shut down, the next three are not Rust or
    do not use Postgres, and polling cannot carry cursors.
- This plan replaces the follow-up item `viewer-live-presence`, which asked
  how the viewer learns who else looks at a project. Cal's answer is the
  real-time channel of that item's option B, built in Rust and Postgres.

### Design calls

My calls, 2026-11-24:

- **WebSocket, not long polling or Server-Sent Events.** One reader sends up
  to one move for each animation frame and receives the moves of everyone
  else. Long polling would cost a request and a session check for each batch.
- **Auth uses the existing session cookie.** The socket is on the API
  origin, so the browser sends `mkc_session`. The upgrade checks the `Origin`
  header against the admitted Origins of the auth exchanges, then the
  reader's read access to the project. A failure answers as a project read
  does. No new token or key exists.
- **Members only.** Only a signed-in member with access to the project joins
  the channel. Public visibility grants anonymous project reads, but presence
  shows names, so an anonymous reader or a signed-in non-member gets no
  socket.
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
- **Cursors anchor to a frame.** A cursor names the full identity of the
  nearest frame: the publication, the entry path, the viewport, the color
  scheme, and the variant or use-case step. It adds a point in that frame.
  Readers zoom, pan and filter differently, so canvas coordinates would not
  match. A reader of another publication sees the person in presence but
  not the cursor. A touch pointer sends no cursor. Presence still shows.
  Decision 11 says how the point handles a scrolled document.
- **Frames forward the pointer.** A frame is a cross-origin document, so the
  host page gets no pointer moves over it. A new canvas input event,
  `canvas-pointer`, forwards the pointer position at most once for each
  animation frame, like `canvas-wheel`. It joins frame wire version 4 when
  version 4 has not shipped at Milestone 3. Otherwise it starts version 5.
  Version 4 already fills the subscription cap of ten event names in
  `packages/frame/src/probe/schema.ts`, so the cap rises with the new event.
- **One tick of 50 ms.** Each replica keeps the last move of each connection
  and sends all moves of a project once each tick, to its own sockets and to
  the relay.
- **One relay transaction for each tick.** Each `NOTIFY` transaction uses a
  transaction ID and takes a lock that serializes every notifying commit. So
  each replica sends all notices of a tick in one transaction, about 20 a
  second for each replica, whatever the number of projects. Production Cloud
  SQL has 2 vCPUs.
- **The relay.** Each replica holds two dedicated `tokio-postgres`
  connections through the Cloud SQL proxy sidecar: one listens on the
  `mkc_live` channel and one sends. Diesel can read waiting notices but
  cannot wait for one in async code. A notice holds the replica ID, the
  project ID, the kind and the payload, and stays under 7,900 bytes. A larger
  batch splits. A replica ignores its own notices.
- **Presence expires by heartbeat.** Each replica sends the connections of
  each of its projects every 10 seconds. A remote connection without a
  heartbeat for 30 seconds leaves. A replica that gets the first connection
  of a project sends a sync request, and the others answer with a heartbeat
  at once. After its listener reconnects, a replica sends a sync request for
  each of its projects.
- **Shutdown.** On SIGTERM a replica sends a leave for each local connection
  and closes each socket with code 1001. The client reconnects after 0.5
  seconds, doubling to 15 seconds, with jitter.
- **Limits.** A client frame holds at most 4 KiB. A connection that sends
  more than 120 messages a second loses the extra messages, and the server
  logs one warning for that connection.
- **One person, many tabs.** Each socket is one connection with a random ID.
  The bar groups connections by user. A person's color comes from a hash of
  the user ID.
- **Participants have a kind.** A participant is a `person` or an `agent`.
  The site draws Claude and Codex beside people. This plan sends only
  `person`. Agent sessions add `agent` later without a new message type.
- **Crates.** `mkc-live` holds the message types, the hub, the presence
  state, a `LiveRelay` trait and an in-memory relay for tests. `mkc-live-pg`
  holds the Postgres relay. The route lives in `mkc-api`.
- **Message types.** The messages are OpenAPI component schemas from the
  Rust types, so the app's generated client holds their TypeScript types.
- **Every message has a `type`.** Later kinds can join without a new route.

## Open decisions

An options check by a fresh reviewer ran over these decisions on
2026-11-24. It added options D and E to decisions 8 and 10, changed both
recommendations, and found the problem of decision 11.

### 8. How readers learn of stored changes at once

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Code structure.
- **Location:** None.
- **Background:** Comments, drafted in `docs/protocol/cloud/screen-comments.md`,
  live in Postgres and have two writers: the REST API and the GitHub sync
  worker. Agent turns run for minutes and stream text. Build logs use rising
  sequence numbers, and the build card polls every 3 seconds
  (`packages/app/src/viewer/build-watch.ts`). Removed members, private
  transitions and member-only reads take effect on the next request, as
  `docs/protocol/cloud/platform-model.md` says.
- **Problem:** Each later feature could build its own push path, with its own
  access rule and catch-up.
- **Impact if no action:** Each feature repeats the access check, the
  reconnect and the catch-up. A writer can forget its notice.
- **Root question:** How does each reader with a project open learn at once
  of a change to stored data that they may read, such as a comment, an agent
  turn or a build, and catch up after a gap?
- **Options:**
  - **A.** Separate long-polling REST endpoints, one for each feature, with a
    sequence cursor. The live socket carries presence and cursors only. Each
    long poll needs the relay or a database poll to wake it for a write on
    another replica. Effort: Medium for each feature.
  - **B.** One live socket for each project carries presence, cursors, change
    notices with a sequence number, and agent output chunks. Each writer's
    code sends its notice. REST stays the catch-up. The hub then needs an
    access rule for each kind of content. Effort: Medium.
  - **C.** One project event log: a Postgres table holds every durable event
    with one rising sequence, and one long-polling endpoint reads it. The
    socket carries cursors and a hint that a new sequence exists. It needs
    double writes, retention, and member-only kinds next to public ones.
    Effort: Large.
  - **D.** Notices without content, sent at commit. A trigger on each stored
    table calls `pg_notify` inside the write transaction, so every writer
    notifies, and only after commit. The socket carries
    `{kind, id, sequence}`. The reader reads through the REST read of that
    kind, after its last sequence. After the relay listener reconnects, the
    hub tells its sockets to read again. Agent text shows one round trip
    after its notice. Effort: Medium.
  - **E.** B, with trigger-sent notices and agent chunks, and D's read-again.
    The hub needs an access rule for each kind that matches REST, and each
    chunk must stay under the notice size limit. Effort: Large.
- **Left out:**
  - One stateful actor that holds comments and agent state, because Cal chose
    Postgres as the record.
  - Server-Sent Events for stored changes, because D gives the same push
    over the socket that this plan builds.
  - Logical replication of the stored tables, because each replication slot
    has one reader, and a slot left behind by a stopped pod keeps the write
    log on the shared Cloud SQL instance.
  - Short polling every 3 seconds, because agent text then shows in jumps of
    3 seconds.
- **Wider fix:** D, because a new writer notifies through its trigger, and a
  new kind keeps its access rule in REST.
- **Previous examples:** The build log sequence in
  `docs/protocol/cloud/cloud-build-api.md`, and the build card poll.
- **Related:** This plan builds the socket of B, D and E either way. The
  answer does not block a milestone here. The follow-up item
  [agent-session-runtime](./follow-ups/agent-session-runtime.md) waits for it.
- **Recommendation:** D. The plan first recommended B. Notices without content
  keep every access rule in REST, and the trigger means that no writer can
  forget a notice. Agent text can join the socket later as one more kind.
- **Action:** Ask the user, because it sets the protocol of two later
  features.

### 10. What cursor following lets a reader do

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** Product bug.
- **Location:** None.
- **Background:** Cal first said "pointer following", then "cursor
  following". The site draws avatars, cursors with name tags, and the
  selections of Claude and Codex, as in
  `docs/mockups/src/screens/design/site/home/card-selection.tsx`. Design tools
  often also let a reader follow another person's view.
- **Problem:** No message or doc says what a reader can do with the other
  people.
- **Impact if no action:** The mockups and the message types can miss a
  feature that Cal expects.
- **Root question:** What can a reader do with the other people in a project?
- **Options:**
  - **A.** See who is here, on which screen, and their live cursors. Effort:
    Small, because the rest of this plan builds it.
  - **B.** A, and follow a person: a click on an avatar moves the reader's
    view to that person's screen, zoom and pan, until the reader moves. The
    viewer API exposes no zoom or pan, the canvas stage cannot set its pan,
    and the scroll inside a frame needs a new wire message. Effort: Large.
  - **C.** B, and a person can ask everyone in the project to follow them.
    Effort: Large.
  - **D.** A, and a click on an avatar opens, once, the branch or pull
    request, the screen and the viewport that the person looks at. The reader
    keeps their own zoom and pan. It needs no view message and works for an
    agent. Effort: Medium.
  - **E.** A, and each person's or agent's selected element shows on its
    frame as a box in their color, with their name. It needs a new viewer
    prop, a new message kind and a new mockup state. Effort: Medium.
- **Left out:** None.
- **Wider fix:** None.
- **Previous examples:** The site home drawings in
  `docs/mockups/src/screens/design/site/home/`.
- **Recommendation:** A. The plan first recommended B. Cal's words name the
  live cursors, the site draws no follow state, and B, D and E can each join
  later as one more message kind.
- **Action:** Ask the user, because it decides the product scope. The TODOs
  marked "only with decision 10" wait for the answer.

### 11. Where a cursor shows on a scrolled screen

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Product bug.
- **Location:** `docs/protocol/mokly-frame-canvas-input.md`
- **Background:** Each document scrolls inside its frame, as
  `docs/protocol/mokly-shell-device-chrome.md` says. Canvas input reports
  points in the frame's viewport. The host cannot read the scroll position
  of a cross-origin frame.
- **Problem:** When two readers scroll the same screen differently, a point
  in the viewport lands on different content.
- **Impact if no action:** A cursor can point at the wrong element.
- **Root question:** How does a remote cursor point at the same content for
  each reader?
- **Options:**
  - **A.** Send the point in viewport coordinates and accept the drift. The
    cursor is right when both readers have not scrolled. Effort: Small.
  - **B.** The probe sends the point in document coordinates, and also
    reports its own scroll position when it changes. The host turns the
    remote point into its own viewport and hides a cursor that falls outside
    it. It costs one more event and probe bytes. Effort: Medium.
  - **C.** The probe sends the point relative to the element under the
    pointer, by its instance key, and the host places it with the existing
    box measurement. It works across scrolls and window widths, but costs
    more probe bytes and a measure request for each move. Effort: Large.
- **Left out:** Drawing remote cursors inside the frame's document, because
  served documents stay unmodified.
- **Wider fix:** C, because it also holds when the frame widths differ.
- **Previous examples:** None found.
- **Recommendation:** B. It is exact for the same frame size, and the probe
  budget can hold one small event.
- **Action:** Ask the user, because it sets a frame wire message of the
  open-source package.

Contract owners:

- A new protocol doc, `docs/protocol/cloud/live-presence.md`.
- [REST API](../docs/protocol/cloud/rest-api.md).
- [Frame canvas input](../docs/protocol/mokly-frame-canvas-input.md) and the
  [frame probe wire](../docs/protocol/mokly-frame-probe-wire.md).
- [Embeddable viewer API](../docs/protocol/mokly-viewer-api.md).
- The [`mkc-api` README](../crates/mkc-api/README.md), the
  [Helm chart README](../infra/helm/mokly-cloud/README.md) and the
  [architecture doc](../docs/architecture/cloud.md).

## Milestone 1: Mockups

Tags: mockup

Depends on: none

The cloud viewer bar, the catalogue rows and the canvas stage show other
people. Draw every state: alone, two people, many people, a reconnect, and a
touch screen.

- [ ] Draw the avatar stack in the cloud viewer bar, with overflow, in
      `docs/mockups/src/screens/product/viewer/`.
- [ ] Draw the readers of each catalogue row.
- [ ] Draw remote cursors with name tags on the canvas stage, over a frame
      and between frames, in the design mockups under
      `examples/basic/specs/design`.
- [ ] Draw the state that the answer to decision 10 adds. Only with decision
      10 B, C, D or E.
- [ ] Run the mockup checks named in `AGENTS.md` and in
      `docs/mockups/README.md`. Smoke-test the changed pages.
- [ ] Update the design and the TODOs of this plan for each problem that the
      mockups show.

## Milestone 2: Documentation and protocol

Depends on: 1

- [ ] Write `docs/protocol/cloud/live-presence.md` with a status line: the
      route, the auth, the messages, the limits, presence expiry and the
      reconnect.
- [ ] Add the route to `docs/protocol/cloud/rest-api.md`.
- [ ] Add `canvas-pointer`, its coordinates and the raised subscription cap
      to the frame canvas input and wire docs.
- [ ] Add the cursor and presence props and the pointer callback to the
      viewer API doc.
- [ ] Add the live channel to `docs/architecture/cloud.md`.

## Milestone 3: Frame pointer input

Depends on: 2

- [ ] Forward `canvas-pointer` from the probe and the same-origin adapter in
      `packages/frame`, within the probe's 11,264-byte budget, in the
      coordinates that decision 11 chooses.
- [ ] Raise the subscription cap of ten event names in the probe, in the
      host check and in the wire doc.
- [ ] Give the viewer an `onStagePointer` callback with the frame anchor, or
      null when the pointer leaves the stage.

## Milestone 4: Viewer cursors and readers

Tags: ui

Depends on: 1, 3

- [ ] Add the cursor and avatar stack components to `packages/ui`.
- [ ] Render the `remoteCursors` and row reader props in `packages/viewer`.

## Milestone 5: Live hub

Depends on: 2

- [ ] Create `mkc-live` with the message types, the participant kind, the
      hub, the presence state, the tick, the limits and the `LiveRelay`
      trait.
- [ ] Add the in-memory relay and tests for join, leave, moves, expiry and
      limits.
- [ ] Add the message kind that the answer to decision 10 needs. Only with
      decision 10 B, C, D or E.

## Milestone 6: Live route

Depends on: 5

- [ ] Turn on the Axum `ws` feature in `mkc-api` and add the route with the
      cookie, Origin and member checks, the access check every 30 seconds,
      the pings and the shutdown.
- [ ] Add the message schemas to the OpenAPI document and regenerate the
      app's client.
- [ ] Test the route with one replica.

## Milestone 7: Postgres relay

Depends on: 6

- [ ] Create `mkc-live-pg` with the listen and send connections, one
      transaction for each tick, the batch split, the sync request and the
      listener reconnect.
- [ ] Test two hubs on the test Postgres. A move and a presence change
      reach the other hub.

## Milestone 8: Infrastructure

Depends on: 6

- [ ] Add the live Service and its `BackendConfig` with `timeoutSec: 3600`,
      and the ingress path `/v1/live/*`.
- [ ] Add the preview nginx Ingress for `/v1/live/` with 3,600-second
      timeouts.
- [ ] Add the `wss://` API origin to `connect-src` in
      `infra/docker/app-server.mjs`.
- [ ] Update the Helm golden renders and the chart README.

## Milestone 9: App client

Tags: ui

Depends on: 4, 6

- [ ] Add the live client to `packages/app`: connect, reconnect with
      backoff, one move for each animation frame.
- [ ] Pass presence and cursors to the viewer and the avatar stack to the
      bar slot.
- [ ] Add the client part of the answer to decision 10. Only with decision
      10 B, C, D or E.
- [ ] Remove `status: "ahead" (presence)` from each drawing that the product
      now matches, in the site and its mockups.

## Milestone 10: Verification, commit, review, and pull request

Depends on: every other milestone

- [ ] Smoke-test two browsers on a preview with two API replicas.
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

- [ ] Smoke-test presence in production with two people. Watch the Cloud
      SQL notice rate and the connection count for a week.
