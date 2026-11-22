# File delivery work delays Serve shutdown

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-22, from the branch
  `calummoore/mokly-viewer-live-update-lpaj`, implementation review round 1,
  finding 2, "Authored file copies delay shutdown". The check of that day
  confirmed it with the severity Medium, not High.
- **Location:** `crates/mokly-server/src/authored_assets.rs`
  (`AuthoredAssets::open` and `AuthoredRecord::gzip`),
  `crates/mokly-server/src/work_delivery.rs` (`Workers::file_delivery` and
  `Workers::asset_delivery`), `crates/mokly-server/src/work.rs`
  (`Workers::stop` and `Work::authored`),
  `crates/mokly-server/src/json_delivery.rs` (`Gzip::get`),
  `crates/mokly-server/src/asset_streams.rs` (`AssetVersion::gzip`),
  `crates/mokly-server/src/runtime.rs` (`BoundServer::run` for `Listener`),
  and `crates/mokly-cli/src/serve_lifecycle.rs` (`runtime`).
- **Reason:** The fix rule gives `fix after merge` to a Medium product bug
  with the likelihood Rare.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Authored asset:** a repository file of the public closure that a mockup
    references. Serve answers it at `/static/` followed by its closure path.
  - **Authored capture:** the work of an authored GET or HEAD before its
    headers: the read of the source into a temporary copy, the XXH3-128
    digest, and the SHA-256 tag of a changed version.
  - **Route record:** the fixed-size record that Serve keeps for each
    authored route of a render generation: the length, the XXH3-128 digest,
    and the SHA-256 tag of the identity form, and the gzip length and tag
    once Serve encodes that form.
  - **Worker permit:** one permit of the semaphore in `Workers`. The permits
    bound the blocking Serve jobs to the core count of the machine, up to
    eight.
  - **Detached encode:** a gzip encode in a blocking job that holds no worker
    permit and outlives its request.
- **Background:**
  - Shutdown follows the Shutdown section of `docs/protocol/mokly-runtime.md`.
    `BoundServer::run` for `Listener` in `crates/mokly-server/src/runtime.rs`
    first closes the client connections. Then it stops the watcher, cancels
    the renders, and waits for `HttpApplication::stop_renders`, which waits
    for `Workers::stop`. Only after that does it cancel Git, stop the
    sidecars, and release the port.
  - `Workers::stop` in `crates/mokly-server/src/work.rs` sets `Workers.closed`
    before it waits. Then it takes back every worker permit, so it waits for
    each blocking job that holds one.
  - `Workers::file_delivery` in `crates/mokly-server/src/work_delivery.rs`
    runs `Work::authored`, `Work::generated`, and `Work::stylesheet` in a
    `spawn_blocking` job that holds a worker permit. `Workers::asset_delivery`
    does the same for generated assets.
  - `HttpClients::shutdown` in `crates/mokly-server/src/clients.rs` gives
    event streams a grace period of 250 ms, then aborts every other client
    connection. The abort drops the request future, but a blocking job that
    started runs to its end.
  - Before the branch, an authored `HEAD` request opened the source and sent
    its metadata. Now `AuthoredAssets::open` in
    `crates/mokly-server/src/authored_assets.rs` reads the source of each
    authored GET and HEAD once into a temporary copy, and computes the
    XXH3-128 digest of those bytes, before the headers. A changed version also
    gets a new SHA-256 tag: Serve hashes during the copy when it already knows
    the version changed, and it hashes the copy in a second pass otherwise. A
    304 discards the copy, and a 200 streams it. The route record lets a
    request reuse the tag of an unchanged version.
  - `AuthoredAssets::open` holds the lock of its route for the whole capture.
    So concurrent requests for one route run their captures one after
    another, and each waiting request already holds a worker permit.
  - The opened length bounds each pass, so shutdown waits only until the file
    work ends. The check graded the finding Medium for this reason: a visible
    defect, not wrong output or blocked work.
  - The gzip encode of a JSON file asset is a detached encode.
    `AuthoredRecord::gzip` and `AssetVersion::gzip` start it through
    `Gzip::get` in `crates/mokly-server/src/json_delivery.rs`, which runs it in
    a `spawn_blocking` job. `Workers::stop` does not wait for it, but the drop
    of the tokio runtime waits for each blocking task. The CLI builds the
    Serve runtime in `runtime` in `crates/mokly-cli/src/serve_lifecycle.rs`.
    It drops the runtime at the end of the Serve entry in
    `crates/mokly-cli/src/entry_serve.rs`.
  - Generated asset delivery already stops its verified copy on an explicit
    command cancellation. `CancellableStream` in
    `crates/mokly-cli/src/cancelled_stream.rs` checks the cancellation between
    chunks. `ServeLifecycle::cancel_renders` sets the cancellation before the
    worker drain, and the server sees it through
    `RenderGeneration::check_cancelled`. The authored capture and the
    detached encode check no stop signal.
  - A stopped pass must free its partial copy. It must also keep the route
    record unchanged, so that no later request reuses a tag of partial bytes.
  - The task that found this item forbade a timeout, a retry, or a sleep in
    product code and in tests.
- **Problem:** An authored GET or HEAD reads a whole large file into a copy,
  and hashes it, before it sends headers. Closing the connection does not
  stop that blocking job, and the job holds its worker permit until the file
  work ends. A detached encode of a large JSON file asset also runs to its
  end before the process exits.
- **Impact if no action:** An interrupt during the capture of a large authored
  file makes Serve wait for the rest of that file, and for each capture of
  the same route that waits for its lock. Only then can Serve cancel Git,
  stop the sidecars, release the port, and exit.
- **Root question:** How can Serve finish its shutdown promptly while a
  request still prepares a large file?
- **Options:**
  - **A.** Check the shutdown signal between reads and during hashing. Drop
    the partial copy on shutdown. Test the stop with a reader that pauses
    between chunks. Effort: Small.
  - **B.** Run file preparation through one delivery job that owns the
    shutdown signal. Use it for copying, hashing, and file compression. Its
    owner can pass `Workers.closed`, which `Workers::stop` sets before it
    waits, so the CLI needs no change. Shared compression still continues
    when only one client disconnects. Effort: Medium.
  - **C.** Drive authored capture with asynchronous chunk reads that stop
    when shutdown starts. Keep a blocking operation to one chunk at a time.
    C stops no sooner than A or B, and it adds a task hop for each chunk.
    Effort: Large.
  - **D.** Stop waiting for abandoned file work. Authored and generated-asset
    captures take their own admission, which `Workers::stop` does not drain.
    The CLI ends the Serve runtime with `Runtime::shutdown_background`, so no
    blocking file job holds the exit, and the OS frees its temporary files.
    Stylesheet and document jobs stay in the drained admission, because they
    can call the sidecar. D drops the assumption that shutdown waits for each
    file job. Risk: the exit abandons every blocking job that still runs, so
    each owner that relies on the runtime drain needs a check. Cost: a change
    in `crates/mokly-cli/src/entry_serve.rs`, which has 300 lines on
    2026-11-22, the cap of the Rust file length lint. Effort: Medium.
  - **E.** Stop an authored capture when its request ends. A drop guard in
    `Workers::file_delivery` sets a flag when the request future drops, and
    the capture checks the flag at each chunk. Shutdown aborts every
    connection first, so the capture stops then too, and a normal disconnect
    frees its worker sooner. E drops the assumption that only shutdown stops
    the work. Risk: shared work cannot use it. It covers only authored
    captures, and it conflicts with a later fix that lets concurrent requests
    share one capture. Effort: Small.
- **Shared assumptions:**
  - Every authored GET and HEAD reads the whole file before its headers.
    Source: the strong `ETag` rule and the HEAD rule of the Routes section of
    `docs/protocol/mokly-runtime.md`, which need the tag before the headers.
    It stays. The copy of each request is a choice of the code, so that a 200
    streams the bytes that its tag describes.
  - Each request compares the live bytes and trusts no file metadata. Source:
    the code, `crates/mokly-server/delivery.md`, and the test
    `same_size_authored_edit_with_preserved_mtime_revalidates_against_new_bytes`
    in `crates/mokly-server/tests/shared_assets/cache_tests.rs`. It stays.
  - Shutdown waits for each file job, so the job itself must end. Source: the
    code: `Workers::stop` takes back every worker permit, and the runtime drop
    waits for each blocking task. It is not a requirement, because the
    Shutdown section names only render, background, and comparison work. D
    drops it.
  - Only shutdown stops the work, not the end of its request. Source: the
    text of option B. It holds for shared work. It does not hold for an
    authored capture, which serves only its own request. E drops it.
- **Left out:**
  - A file-size limit. It adds a rejection, which needs the user, and it
    could reject a valid file in normal use.
  - A deadline. The task that found this item forbade a timeout in product
    code.
  - A first response without an `ETag`. It breaks the strong `ETag` rule of
    the Routes section of `docs/protocol/mokly-runtime.md`.
  - Reuse that file metadata or watcher events decide. It breaks exact
    revalidation.
  - A copy that hashes in the same pass. It shortens a capture, but it does
    not bound it.
- **Wider fix:** B, when the stop check lives in the shared reader of every
  whole-file pass: the source read, the compare, the hash, and the gzip
  input. Then a new pass stops without its own check.
- **Previous examples:** Generated asset delivery already requires an
  explicit command cancellation to stop its verified copy. The section
  "Validation And The Render Cache" of
  `docs/protocol/mokly-imported-styles-assets.md` says "Explicit command
  cancellation stops the copy with the cancellation diagnostic."
  `CancellableStream` in `crates/mokly-cli/src/cancelled_stream.rs`
  implements it. The test
  `cancellation_between_chunks_stops_copying_with_an_explicit_error` in
  `crates/mokly-cli/src/_tests_/cancelled_stream_tests.rs` proves it with no
  timer: its cancellation turns true after the first chunk.
- **Related:**
  - `plans/follow-ups/json-gzip-route-test-gaps.md`, the same code. Option B
    can move the gzip encode of file assets into one delivery job and change
    `Gzip::get`. Then each direct caller of `Gzip::get` must use the changed
    call: `AuthoredRecord::gzip`, `AssetVersion::gzip`,
    `JsonBody::temporary_response`, and the unit test
    `overlapping_and_later_gzip_callers_start_one_encode` in
    `crates/mokly-server/src/_tests_/json_delivery_tests.rs`. The route-level
    count of that item stays valid.
  - `plans/follow-ups/render-store-idle-work-owners.md`, the same code. That
    item carries the write-activity lease of a finite file response until its
    body ends. `Workers::file_delivery` and `Workers::asset_delivery` take
    that lease, and option B rebuilds these jobs. Design the two owners
    together. Neither fix replaces the other.
- **Recommendation:** B. It covers the full job, including the detached gzip
  encode that the runtime drop waits for, and its owner can pass
  `Workers.closed`, so no CLI change is needed. A regression test can pass a
  stop check that turns true after the first chunk, as
  `cancelled_stream_tests.rs` does, with no pausing reader and no timer.
- **Action:** fix after merge, apply B, because a Medium product bug with the
  likelihood Rare gets `fix after merge` under the fix rule.
