# Live presence and cursors

Status: Active. Not started. Milestones 1 to 5 do not need the foundation and can start at once. Milestones 6 to 8 wait for the merge of [live-channel-foundation](./live-channel-foundation.md). No branch or pull request yet. The pull request that completes the work deletes this plan, as the `plans` skill says.

The viewer shows nobody else who looks at the same project. The Canvas
redesign of the site draws avatars in the viewer bar, readers on catalogue
rows, live cursors with name tags and the selections of agents, and marks each
drawing `status: "ahead" (presence)`. This change adds presence, live
cursors, following, and live selections on top of the live channel that
[live-channel-foundation](./live-channel-foundation.md) builds. Nothing that
these features send is stored.

The change does not build comments or agent sessions. Agents join presence
later with the `agent` participant kind. Where an agent session runs is the
follow-up item [agent-session-runtime](./follow-ups/agent-session-runtime.md).

## Decisions

- **Approach and scope, 2026-11-24, Cal.** The foundation plan records the
  choice of Rust, Postgres and Kubernetes, and its alternatives.
- **What a reader can do with other people, 2026-11-24, Cal: B, D and E.**
  - See who is here, on which screen, and their live cursors.
  - Follow a person: the reader's view moves with that person's screen, zoom
    and pan, until the reader moves.
  - Go to a person once: open the branch or pull request, the screen and the
    viewport that the person looks at, and keep the reader's own zoom and pan.
  - See the element that each person or agent has selected, as a box in their
    color with their name.
  - Left out: asking everyone to follow one person, because Cal did not
    choose it.
- **Cursors on a scrolled screen, 2026-11-24, Cal: document coordinates
  and a scroll report.** The probe sends the pointer as a point in the
  document, and it reports its own scroll position when that changes. The
  host turns a remote point into its own viewport and hides a cursor that
  falls outside it. Following uses the same scroll report. Alternatives:
  - A point in the frame's viewport. Left out: the cursor drifts when two
    readers scroll differently.
  - A point relative to the element under the pointer, by its instance key.
    Left out: it costs the most probe bytes and a measure request for each
    move, although it also holds when frame widths differ.
  - Drawing cursors inside the frame's document. Left out: served documents
    stay unmodified.
- **Split, 2026-11-24, Cal.** The shared foundation merges into `main` first.
  This plan builds on it.
- This plan replaces the follow-up item `viewer-live-presence`, which asked
  how the viewer learns who else looks at a project. Cal's answer is the
  real-time channel of that item's option B, built in Rust and Postgres.

### Design calls

My calls, 2026-11-24:

- **Cursors anchor to a frame.** A cursor names the full identity of the
  nearest frame: the publication, the entry path, the viewport, the color
  scheme, and the variant or use-case step. It adds a point in that frame.
  Readers zoom, pan and filter differently, so canvas coordinates would not
  match. A reader of another publication sees the person in presence but not
  the cursor. A touch pointer sends no cursor. Presence still shows.
  The point is in document coordinates, as the decision on scrolled screens
  says.
- **Frames forward the pointer.** A frame is a cross-origin document, so the
  host page gets no pointer moves over it. A new canvas input event,
  `canvas-pointer`, forwards the pointer position at most once for each
  animation frame, like `canvas-wheel`. It joins frame wire version 4 when
  version 4 has not shipped at Milestone 3. Otherwise it starts version 5.
  Version 4 already fills the subscription cap of ten event names in
  `packages/frame/src/probe/schema.ts`, so the cap rises with the new event.
- **Client event kinds.** `location` gives the publication and screen,
  `cursor` the frame anchor, `view` the zoom and pan, and `selection` the
  selected instance. `cursor` and `view` coalesce on the 50 ms tick of the
  foundation.
- **Presence expires by heartbeat.** Each replica sends the connections of
  each of its projects every 10 seconds. A remote connection without a
  heartbeat for 30 seconds leaves. A replica that gets the first connection
  of a project sends a sync request, and the others answer with a heartbeat
  at once. A resync also sends a sync request.
- **One person, many tabs.** Each socket is one connection with a random ID.
  The bar groups connections by user. A person's color comes from a hash of
  the user ID.
- **Participants have a kind.** A participant is a `person` or an `agent`.
  The site draws Claude and Codex beside people. This plan sends only
  `person`.
- **A click on an avatar opens a menu with Go to and Follow.** Go to is the
  one-time move. Follow first goes to the person, then keeps the view in step.
  The mockups check this.
- **Following stops when the reader moves.** A pan, a zoom, a click on
  another screen, or a key press stops it. The bar shows whom the reader
  follows, with a control to stop.
- **Following keeps the reader's own scroll inside a frame.** The viewer can
  set the zoom and the pan, but a host cannot scroll a cross-origin document
  to a point. The leader's cursor hides when it falls outside the reader's
  part of the screen.
- **Selections use the existing selection box.** The viewer draws each remote
  selection with the `CanvasSelection` part of `packages/ui`.

Contract owners:

- A new protocol doc, `docs/protocol/cloud/live-presence.md`.
- [Frame canvas input](../docs/protocol/mokly-frame-canvas-input.md) and the
  [frame probe wire](../docs/protocol/mokly-frame-probe-wire.md).
- [Embeddable viewer API](../docs/protocol/mokly-viewer-api.md).
- The [`mkc-api` README](../crates/mkc-api/README.md) and the
  [architecture doc](../docs/architecture/cloud.md).

## Milestone 1: Mockups

Tags: mockup

Depends on: none

The cloud viewer bar, the catalogue rows and the canvas stage show other
people. Draw every state: alone, two people, many people, following, a
reconnect, and a touch screen.

- [ ] Draw the avatar stack in the cloud viewer bar, with overflow, and its
      menu with Go to and Follow, in `docs/mockups/src/screens/product/viewer/`.
- [ ] Draw the follow state in the bar, with the control that stops it.
- [ ] Draw the readers of each catalogue row.
- [ ] Draw remote cursors with name tags and remote selection boxes on the
      canvas stage, over a frame and between frames, in the design mockups
      under `examples/basic/specs/design`.
- [ ] Run the mockup checks named in `AGENTS.md` and in
      `docs/mockups/README.md`. Smoke-test the changed pages.
- [ ] Update the design and the TODOs of this plan for each problem that the
      mockups show.

## Milestone 2: Documentation and protocol

Depends on: 1

- [ ] Write `docs/protocol/cloud/live-presence.md` with a status line: the
      client event kinds, presence expiry, Go to, Follow and selections.
- [ ] Add `canvas-pointer`, its coordinates, the scroll report
      and the raised subscription cap to the frame canvas input and wire docs.
- [ ] Add the pointer callback, the remote cursor, reader and selection
      props, and the view controls for following to the viewer API doc.
- [ ] Add presence to `docs/architecture/cloud.md`.

## Milestone 3: Frame pointer input

Depends on: 2

- [ ] Forward `canvas-pointer` from the probe and the same-origin adapter in
      `packages/frame`, within the probe's 11,264-byte budget, in the
      document coordinates, and add the scroll report.
- [ ] Raise the subscription cap of ten event names in the probe, in the
      host check and in the wire doc.

## Milestone 4: Viewer API

Depends on: 3

- [ ] Give the viewer an `onStagePointer` callback with the frame anchor, or
      null when the pointer leaves the stage.
- [ ] Let a host read and set the canvas zoom and pan, and get an event when
      the reader moves the view.

## Milestone 5: Viewer components

Tags: ui

Depends on: 1, 4

- [ ] Add the cursor, avatar stack, avatar menu and follow bar components to
      `packages/ui`.
- [ ] Render the remote cursor, reader and selection props in
      `packages/viewer`.

## Milestone 6: Presence in the hub

Depends on: 2, and the merge of live-channel-foundation

- [ ] Add the participant kind, presence, the heartbeat, the expiry and the
      sync request to `mkc-live`.
- [ ] Add the `location`, `cursor`, `view` and `selection` client event
      kinds.
- [ ] Test presence across two hubs on the test Postgres, with expiry after a
      lost replica.

## Milestone 7: App presence

Tags: ui

Depends on: 5, 6

- [ ] Send location, cursor, view and selection events from `packages/app`,
      at most one cursor move for each animation frame.
- [ ] Pass presence, cursors and selections to the viewer, and the avatar
      stack to the bar slot.
- [ ] Add Go to and Follow, with the stop rules.
- [ ] Remove `status: "ahead" (presence)` from each drawing that the product
      now matches, in the site and its mockups.

## Milestone 8: Verification, commit, review, and pull request

Depends on: every other milestone

- [ ] Smoke-test two browsers on a preview with two API replicas: presence,
      cursors, Go to, Follow and selections.
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

- [ ] Smoke-test presence in production with two people.
