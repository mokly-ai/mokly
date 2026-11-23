# Same-route waits hold workers or repeat work

- **Severity:** Medium. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-23, from the branch
  `calummoore/mokly-viewer-live-update-lpaj`, implementation review round 2:
  the wider fix that the branch split off finding 9, "Authored asset waits
  occupy render workers", with the join of the check's option D as its
  authored step, and a new problem that the check found.
- **Location:** `crates/mokly-server/src/work_delivery.rs`
  (`Workers::authored_delivery`, `Workers::prepared_file_delivery`,
  `Workers::file_delivery`, and `Workers::asset_delivery`),
  `crates/mokly-server/src/authored_assets.rs` (`AuthoredAssets::reserve`,
  `AuthoredRequest::admit`, and `AuthoredRecord::gzip`),
  `crates/mokly-server/src/backend.rs` (`GraphDocuments::render` and
  `GraphDocuments::read_stylesheet`),
  `crates/mokly-server/src/backend_assets.rs` (`Request::capture`), and the
  section "Serve Reads And The Static Output" of
  `docs/protocol/mokly-public-closure.md`.
- **Reason:** No review follows the last fix round of the branch, the applied
  route gate is the simpler change, and D adds only a join to that gate.

- **Source:** Review.
- **Category:** Performance.
- **Terms:**
  - **Worker permit:** one permit of the semaphore in `Workers`. The permits
    bound the blocking Serve jobs to the core count of the machine, up to
    eight. File jobs, frame documents, previews, and background renders share
    them.
  - **Route gate:** the async lock of one authored route.
    `AuthoredAssets::reserve` hands it out, and `AuthoredRequest::admit` waits
    for it before the request takes a worker permit.
  - **Authored capture:** the work of an authored request before its headers:
    the read of the source into a temporary copy, the XXH3-128 digest, and the
    SHA-256 tag of a changed version.
  - **Burst:** several requests for one route that arrive while one of them
    runs.
- **Background:**
  - On `origin/main`, the authored job only opened the file, with no route
    lock. The lock came with commit `529039532`. The review of 2026-11-23
    found that an authored request took its worker permit before it waited
    for that lock. With two workers, two requests for one file could hold
    both permits while only one copied bytes, and an unrelated frame document
    waited for a permit.
  - The branch applied option A on 2026-11-23. `Workers::authored_delivery`
    in `crates/mokly-server/src/work_delivery.rs` checks the closure
    membership on a blocking thread. Then it waits in
    `AuthoredRequest::admit` for the route gate, and only then
    `Workers::prepared_file_delivery` takes a worker permit. The gate drops
    when no request holds it. The test
    `a_waiting_authored_request_leaves_a_worker_for_a_frame` in
    `crates/mokly-server/src/_tests_/work/authored_tests.rs` shows that a
    waiting request leaves a worker for a frame.
  - Each admitted request still makes its own authored capture. So the last
    of n requests for one file waits for n full captures. A browser opens at
    most six HTTP/1.1 connections to one host.
  - The section "Serve Reads And The Static Output" of
    `docs/protocol/mokly-public-closure.md` says: "A served authored file is
    read from the working tree at request time". So each response must come
    from a read that starts after its request arrived.
  - Three other waits for the same route still sit inside a worker. Their
    waiters reuse the first result:
    - The document render lock. `GraphDocuments::render` in
      `crates/mokly-server/src/backend.rs` holds the lock of its route across
      the graph render. A second request for the same document waits inside
      its worker. This is also on `origin/main`.
    - The `OnceLock` of a generated asset. `GraphDocuments::asset_request`
      reserves one capture of a route before worker admission, so concurrent
      requests join it. But `Workers::asset_delivery` takes the worker permit
      first, and `Request::capture` in
      `crates/mokly-server/src/backend_assets.rs` then waits on the `OnceLock`
      inside that worker. This is also on `origin/main`.
    - The record slot of a generated stylesheet.
      `GraphDocuments::read_stylesheet` holds it while Serve computes the tag
      of a new version. The branch added it.
  - The new problem of the check: `AuthoredRecord::gzip` runs its encode in a
    detached blocking job, with no worker permit. The first gzip encode of an
    authored JSON version holds the gzip lock of the record for the whole
    encode. A concurrent gzip request waits for that encode, and then encodes
    its own copy again, unless its `If-None-Match` matches. Only that request
    is slower.
  - The task rules forbid a timeout, a retry, or a sleep in product code and
    in tests.
- **Problem:** Requests that wait for the work of another request on the same
  route still hold a worker permit, except the authored ones. The authored
  waiters hold no permit now, but each one repeats a full capture after the
  wait. A gzip request for authored JSON waits for the first encode and then
  repeats it.
- **Impact if no action:** In a burst for one large authored file, the last
  request waits for one full capture for each request before it. Requests
  that wait for a document render or a generated asset capture hold workers
  that unrelated frame documents need.
- **Root question:** How can requests that wait for work on the same route
  wait without a worker permit and reuse that work, while each authored
  response still comes from a read that starts after its request arrived?
- **Options:**
  - **A.** Keep the route gate that the branch applied. Change nothing more.
    Effort: Small.
  - **B.** Give authored file preparation its own bounded pool. This frees
    the render pool, but requests for one file can still fill the file pool.
    Effort: Medium.
  - **C.** One admission path for every file job that waits for the work of
    another job on the same route. The job waits before it takes a worker
    permit, and the same path owns its cancellation and its cleanup. The
    cancellation part is option B of
    `plans/follow-ups/serve-file-delivery-shutdown.md`. The route gate of the
    branch can be its authored case. Effort: Large.
  - **D.** The authored step of C: coalesce the requests that wait at an
    authored route gate into the next capture. One capture of a route runs at
    a time. A request that arrives during a capture waits without a worker,
    and it joins the next capture, which opens the file only after all of its
    requests arrived. They share its `SharedAsset`, so a burst costs at most
    two captures and one worker at a time. The same join can serve the first
    gzip encode of an authored JSON version, so that a waiting gzip request
    shares that encode. Cost: one failure reaches every request of a capture,
    so `Work::authored` needs a shared error type. Sentences of
    `crates/mokly-server/delivery.md` change. The new code goes into
    `work_delivery.rs` or `authored_assets.rs`, because `work.rs` is near the
    300-line cap. When the records survive a rebuild, as
    `plans/follow-ups/rebuild-rehashes-unchanged-resources.md` proposes, the
    record needs its own short lock. Effort: Medium.
- **Tests of D:** They use no timers, as in
  `crates/mokly-server/src/_tests_/work/limits_tests.rs`:
  - An unrelated document finishes while two asset requests wait.
  - Three overlapping requests open the source twice.
  - An edit after the first capture starts reaches the requests that joined
    the next capture.
- **Shared assumptions:**
  - One capture of a route runs at a time. Source: the code. The reasons
    hold: one SHA-256 tag for each version, and one worker for each route.
    It stays.
  - Serve reads the whole file before the headers. Source: the strong `ETag`
    rule and the HEAD rule of the Routes section of
    `docs/protocol/mokly-runtime.md`. It stays.
  - Each admitted request makes its own capture. Source: the code and the
    text of option A. The rule of the public closure page needs only a read
    that starts after the request arrived. D drops it.
  - An authored preparation takes a bounded worker. Source: the code and
    `crates/mokly-server/delivery.md`. It stays.
- **Left out:**
  - Share the live authored copies by path. A request that arrives after an
    edit must check the current file.
  - Join a capture that already runs. It breaks the request-time read rule of
    the public closure page.
  - Copy outside the route gate. The duplicate copies fill the pool.
  - More workers. They only move the point at which the requests fill the
    pool.
  - Give the worker back and ask again. That is a retry loop, which the task
    rules forbid.
  - Asynchronous chunk reads outside the pool. B is better on every point.
  - Validators from file metadata. They break exact revalidation.
- **Wider fix:** C. It makes a wait without a permit the default for every
  file job that waits for another job on the same route. D is its authored
  case, and its cancellation part is option B of the shutdown item.
- **Previous examples:** `d148edc50` reserves the captures of generated assets
  before worker admission, so that concurrent requests make no duplicate
  copies. The route gate of 2026-11-23 moved the authored wait before the
  worker permit.
- **Related:**
  - `plans/follow-ups/serve-file-delivery-shutdown.md`, the same code and a
    shared wider fix. The cancellation part of C is option B of that item,
    and option D of that item builds the same separate admission as option B
    here. Option E of that item cannot apply to the shared capture of D, but
    its option B can. The route gate and D shorten its shutdown wait.
  - `plans/follow-ups/authored-requests-need-temporary-space.md`, the same
    code. Under D, a capture knows before its read whether one of its
    requests needs a body, so option B of that item composes with D.
- **Recommendation:** C, with D as its authored step. C moves every wait for
  the same route before the worker permit, with one path for cancellation and
  cleanup. D lets a burst of authored requests share captures, at most two
  for a burst, and each response still comes from a read that starts after
  its request arrived.
- **Action:** fix after merge, apply C, with D as its authored step, because
  no review follows the last fix round of the branch, the applied route gate
  is the simpler change, and D adds only a join to that gate.
