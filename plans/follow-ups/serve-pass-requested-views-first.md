# Requested views first needs a warm process

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-22, from the branch
  `calummoore/mokly-viewer-live-update-lpaj`. The performance orchestrator
  removed the requested-first order from the first pull request of that
  branch after its official check. This item also absorbs the item
  `pass-priority-skips-unchanged-generations.md` of the same branch.
- **Location:** `docs/protocol/mokly-on-demand-background.md` (section
  Window And Lookup), `docs/protocol/mokly-sidecar-root-scheduling.md`
  (section Generation Affinity), `crates/mokly-server/src/background.rs`
  (`UsagePass::fill_window`), `crates/mokly-server/src/background_batch.rs`
  (`Window`), `crates/mokly-server/src/publication.rs` (`SharedPublication`
  and `PublicationWriter::replace`), and the removed files
  `crates/mokly-server/src/requested_routes.rs` and
  `crates/mokly-server/src/_tests_/background_batch/request_order_tests.rs`
  at commit `28446a07e`.
- **Reason:** A return of the requested-first order needs the head preload,
  which only the user can reopen, or a change of the generation affinity
  decision, which also needs the user.

- **Source:** Implementation.
- **Category:** Performance.
- **Terms:**
  - **Background pass:** the Serve work after each rebuild that renders each
    changed view, a few at a time, on the sidecar processes.
  - **Requested-first order:** a start order of the background pass. The
    documents that a request asked for since the previous rebuild start
    first, the most recently requested first. The plan of the branch called
    it P4.
  - **Visible document:** a document that a frame of the open view page
    loads. Each probe page has two frames, for mobile and for desktop.
  - **Warm process:** a head sidecar process that already holds the new head
    generation, such as the process that bundled it. The second head process
    is cold until its first render after the rebuild.
  - **Head preload:** an attempt to prepare a new head generation on the idle
    head processes before their renders. The user rejected it on
    2026-11-21, after its third measured attempt.
- **Background:**
  - On `origin/main`, the section Window And Lookup of
    `docs/protocol/mokly-on-demand-background.md` says: "Views start in
    catalogue order: when several lookups wait for one free worker, the first
    in catalogue order starts."
  - On 2026-11-22, the plan of the branch recorded the requested-first order
    as a user decision, made by the performance orchestrator. The branch
    built it. On the same day, after its official check, the orchestrator
    removed it from the first pull request, and the protocol page went back
    to the text of `origin/main`. The section "The removed rule and its
    implementation" below holds the rule, its conditions, and its code.
  - The words of the orchestrator: "P4 helps only when the second visible
    document goes to a warm process, which needs either the rejected preload
    or a change of the affinity rule (both need the user)."
  - In the official check, the late-entry page showed its first frame
    24.7 ms sooner, but its last frame did not come 20 ms sooner. The slug
    page showed its last frame 21.2 ms later, 1.2 ms over its bar. The section
    "Measurements of 2026-11-22" holds the fixture and the numbers.
  - The cause: with the requested-first order, the two visible documents are
    the first two dispatches of the pass. So one of them always reaches the
    second head process, which loads the new generation at its first render
    after the rebuild. That render takes 130 to 230 ms, against 35 to 70 ms
    on the warm process. So the first frame paint comes sooner, and the last
    frame paint later.
  - The absorbed item found a gap in the rule: the record of requests started
    empty at each rebuild. The section "Design note for a return" keeps its
    facts and its options.
- **Problem:** The requested-first order cannot bring the last frame of an
  open view sooner, because one of its two visible documents always reaches
  the cold second process. Without the head preload or a change of the
  generation affinity, the order moves the first frame paint sooner and the
  last frame paint later.
- **Impact if no action:** The pass keeps the catalogue order of
  `origin/main`, so a frame of an open viewer can wait up to about 130 ms
  behind other views. On the late-entry page, the first frame paint stays
  about 25 ms later than with the requested-first order.
- **Root question:** How can the background pass make an open view page show
  an edit sooner, in its first and in its last frame?
- **Options:**
  - **A.** Keep the requested-first order out. This is the outcome of
    2026-11-22. Effort: Small.
  - **B.** Reopen the head preload with the user. When a preload meets its
    bars, bring the requested-first order back from commit `28446a07e`, and
    measure it on both probe pages. Cost: three attempts missed their bars,
    so a fourth attempt needs a new design. Effort: Large.
  - **C.** Change the generation affinity rule, so that the requested
    documents wait for the warm process. Then bring the requested-first
    order back, and measure it on both probe pages. Cost: it changes the
    decision that a request never waits for a busy process that holds its
    generation, and the pool must tell the renders of requested documents
    from the other renders. Effort: Large.
  - **D.** An unmeasured idea: start the requested documents one at a time,
    before any other view, so that both reach the warm process in turn. By
    the affinity rank, a lone request takes the warm process when it is idle,
    so D needs no preload and no change of that rank. Cost: the other head
    process waits at the start of the pass, so the pass throughput drops
    there, and the window rule of Window And Lookup changes. Effort: Medium.
- **Shared assumptions:**
  - The pass keeps every published byte and the set of rendered views. The
    warnings and the final publication stay in catalogue order, and the
    record of requests is bounded by the catalogue. Source: the conditions of
    the decision of 2026-11-22. They stay.
  - Serve learns the open views only from the document requests of the
    viewer. Source: the rejection, on 2026-11-22, of a viewer request that
    names its routes. It stays.
  - After a rebuild, one head process holds the new generation, and each
    other head process loads it at its first render. Source: the code and the
    frame measurement. B drops it.
- **Left out:**
  - The requested-first order with no change for the cold process. The
    official check of 2026-11-22 failed its bars on both probe pages.
  - A worker reserved for requests. The decision of 2026-11-22 rejected it,
    because it slows the pass and so the ready Changes.
  - A viewer request that names its routes. The decision of 2026-11-22
    rejected it, because it adds a new boundary.
  - A fixed time window of recent requests. The task rules forbid timers in
    product code.
- **Wider fix:** B, if a preload ever meets its bars. It takes the cold first
  render off every document, not only off the requested ones. C and D only
  move the requested documents away from the cold process.
- **Previous examples:** PR #315 ranks the idle processes by the loaded state
  that a call needs, and option C changes one decision of that rank.
  `plans/follow-ups/serve-head-generation-preload.md` records the three
  measured preload attempts that option B reopens.
- **Related:**
  - `plans/follow-ups/serve-head-generation-preload.md` holds the frame
    measurement of 2026-11-22 and the rejected preload. Option B here needs
    the user to reopen that item. Its frame measurement compared `main` with
    the core of commit `529039532`, which still had the requested-first
    order.
  - `plans/follow-ups/sidecar-loaded-state-selection.md` holds open options
    for the same section, Generation Affinity. Option C here changes a
    decision of that section, so design C together with that item.
- **Recommendation:** A, until the user decides B or C. The order alone
  failed its official check, and both fixes for the cold process need the
  user. D needs a measurement before anyone can rank it.
- **Action:** ask the user, because a return of the requested-first order
  needs a choice that only the user can make: B reopens the head preload that
  the user rejected on 2026-11-21, and C changes the generation affinity
  decision in force.

## The removed rule and its implementation

At commit `28446a07e`, the section Window And Lookup of
`docs/protocol/mokly-on-demand-background.md` said:

> Views start in request order, then in catalogue order. A view whose
> document a request asked for since the previous rebuild starts first, the
> most recently requested first. The other views follow in catalogue order.
> When several lookups wait for one free worker, the first in this order
> starts. Decision: an open viewer's documents start first, because its
> frames wait for them. A worker reserved for requests was rejected, because
> it slows the pass and so the ready Changes.

The decision of 2026-11-22 in the plan of the branch:

- The routes that a request asked for since the previous rebuild start
  first, the most recent first, and then the other routes in catalogue order.
- Rejected: a viewer request that names its routes, because it adds a new
  boundary. Rejected: a worker kept for requests, because it slows Changes.
- Conditions: the warnings stay in catalogue order. The set of rendered views
  and every published byte stay the same. The record of requested routes is
  bounded by the catalogue. A test shows that a requested view renders first
  and that the final publication equals catalogue order.
- Before the official check, the orchestrator kept the order, because late
  entries would lose its gain. It did not add a fix for the cold process to
  the change.

The implementation stays readable at commit
[`28446a07e9c1f12122245512bc0fd15ff6129d36`](https://github.com/mokly-ai/mokly/tree/28446a07e9c1f12122245512bc0fd15ff6129d36)
of the branch `calummoore/mokly-viewer-live-update-lpaj`:

- `crates/mokly-server/src/requested_routes.rs` holds `RequestedRoutes`, a
  record of requested document routes by name, most recent first, bounded by
  the catalogue. `record` moves a known route to the front. `rebuild` keeps
  the routes that still exist in the next catalogue, and `priority` gives
  their positions to the pass at each rebuild.
- `SharedPublication::delivery`, in
  `crates/mokly-server/src/shared_publication.rs`, calls `record` for each
  document request. `route` in `crates/mokly-server/src/application.rs`
  passes the document route to it.
- `PublicationWriter::replace` in `crates/mokly-server/src/publication.rs`
  rebuilds the record at each replaced publication.
- `Publications::background_priority` gives the pass the positions of the
  requested routes, while the origin of the pass is still the current
  backend.
- `UsagePass::fill_window` in `crates/mokly-server/src/background.rs` starts
  the requested positions first, and then the other positions in catalogue
  order.
- `Window` in `crates/mokly-server/src/background_batch.rs` reports the
  warnings in catalogue order. Its `settled` and `next_report` fields let
  `Window::settle` release a report only after every earlier catalogue
  position has settled.
- `crates/mokly-server/src/_tests_/background_batch/request_order_tests.rs`
  holds the tests
  `recent_document_requests_start_first_and_publish_in_catalogue_order` and
  `a_warning_waits_for_an_earlier_catalogue_route_that_has_not_started`.

The commit `3f1cfa401` of the same branch removed this code and its tests.

## Measurements of 2026-11-22

The fixture:

- The catalogue is `mokly-ai/mokly-cloud` at `194fdb78`, on 4 vCPU, with two
  head sidecar processes. Serve runs with `--base HEAD`.
- The slug page is `/view/product/settings/project/slug/`. Its edit changes
  the `title` on line 35 of
  `docs/mockups/src/screens/product/settings/slug-editor.tsx`. Its entry is
  the first of the 3 changed entries in catalogue order, and each edit
  renders 44 changed documents.
- The late-entry page is `/view/product/settings/workspace/slug-recovery/`.
  Its edit changes the `title` on line 26 of the same file, the workspace
  title. Its entry is the last changed entry.
- The paint times use the Chrome clock, from the first update event of the
  page. An update event is the message of the Serve event stream for one
  publication.

The branch series:

- It ran untimed on the slug page, with 4 sessions for each arm and 12 warm
  edits. Arm A was `main` at `3362e250d`. Arm B was the core of the branch
  at `529039532`.
- B − A: the first frame paint +11.9 ms, with the interval −24 to +48 ms. The
  last frame paint +20.5 ms, with the interval −23 to +64 ms.
- Frame documents that waited 50 ms or more: 6 of 28 on `main`, and 11 of 28
  on the branch. The frame measurement in
  `plans/follow-ups/serve-head-generation-preload.md` explains the 28.

The official check of the orchestrator:

- It compared `c1dc3126c` with `main`, with 6 slug and 6 late-entry view
  sessions for each arm. The numbers are B − A, with approximate 95%
  intervals.
- Late-entry page: the first frame paint −24.7 ms, from −43.0 to −6.5 ms. The
  last frame paint +10.4 ms, from −4.1 to +24.8 ms. The bar asked for a last
  frame paint at least 20 ms sooner on the mean, so the page failed.
- Slug page: the first frame paint −11.8 ms, from −28.3 to +4.6 ms. The last
  frame paint +21.2 ms, from +3.5 to +38.8 ms. The bar allowed at most +20 ms
  for the first and the last frame paint, so the page failed by 1.2 ms.

The cause:

- On `main`, the pass already starts the four documents of the slug entry
  first.
- With the requested-first order, the two visible documents are the first
  two dispatches. So one of them always reaches the second head process.
  That process runs `describe` at its first render after the rebuild, in 60
  to 101 ms in every edit. That render takes 130 to 230 ms, against 35 to
  70 ms on the warm process.
- So the first frame paint comes sooner, and the last frame paint later.

## Design note for a return

The absorbed item found a gap in the record of requests. Its facts and its
options are part of the design of a return, not a separate decision.

- The record started empty at each rebuild. A rebuild kept only the routes
  that a request asked for since the previous rebuild.
- The viewer requests a frame document again only when its `documentKey`
  changed. So during a generation in which the open view did not change, the
  viewer requests nothing.
- So after an edit that does not change the open view, the next edit of the
  open view got no priority. Its frames could wait behind other views again,
  up to about 130 ms, as without the order.
- On `main` at `3362e250d`, one frame document waited 72 to 131 ms for the
  pass in 8 of 24 warm edits of the open view.
- The record keeps route names, not catalogue positions. So a record that
  lives across a rebuild only filters the names that still exist.
- The options for the gap:
  - Keep the rule: the record starts empty at each rebuild. Effort: Small.
  - Keep the record across a rebuild in which no request arrived, still
    bounded by the catalogue and most recent first. The rule then says
    "since the last request" in place of "since the previous rebuild".
    Effort: Small.
  - The viewer tells Serve its mounted routes with a request after each
    refresh. It adds a request and a route. It is the viewer request that
    names its routes, which the decision of 2026-11-22 rejected. Effort:
    Medium.
- A fixed time window of recent requests stays out, because the task rules
  forbid timers in product code.
- The absorbed item recommended to keep the record across a rebuild in which
  no request arrived. It keeps the priority of an open viewer through
  unrelated edits, with the same bound and no new boundary.
