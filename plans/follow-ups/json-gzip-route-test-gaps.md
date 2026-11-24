# Gzip route tests miss encode, release, and failure

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-22, from the branch
  `calummoore/mokly-viewer-live-update-lpaj`, implementation review round 1:
  the wider fix that the branch split off finding 5, "Gzip test misses
  duplicate encodes", and two test gaps that its check found.
- **Location:** `crates/mokly-server/src/json_delivery.rs` (`Gzip::get`,
  `GzipFiles::response`, and `JsonBody::compress`),
  `crates/mokly-server/src/application.rs` (`Application`,
  `Application::new`, and the two publication JSON branches of `route`),
  `crates/mokly-server/src/publication.rs` (`Delivery` and `State::publish`),
  `crates/mokly-server/src/_tests_/json_delivery_tests.rs`, and the section
  "JSON compression" of `crates/mokly-server/delivery.md`.
- **Reason:** The wider fix adds an injection seam to `Application` whose
  only consumer is this test, for a Low finding, so the branch applied only
  the direct fix.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Publication:** the catalogue index and the entry details of one Serve
    revision. `Delivery` in `crates/mokly-server/src/publication.rs` holds a
    publication and the gzip slots of its JSON files.
  - **Once-guard:** `Gzip::get` in `crates/mokly-server/src/json_delivery.rs`.
    It starts one encode for its slot and shares the bytes with each caller.
  - **Encoder callback:** the closure that a caller passes to `Gzip::get`.
    The once-guard runs it at most once, in a detached blocking job.
  - **Identity request:** a request whose `Accept-Encoding` does not accept
    gzip. It gets the canonical bytes.
  - **Seam:** a field or a parameter that lets a test replace a real
    collaborator, here the gzip encoder.
- **Background:**
  - The user decided on 2026-11-22 that Serve sends JSON with gzip when the
    request accepts it, with this condition, verbatim: "compress at most once
    for each publication, off the publication path (on the first request that
    accepts gzip, then reuse the bytes until the publication is replaced), at
    a fast level; treat `gzip;q=0` as not accepted; free the compressed bytes
    with their publication."
  - On the same day, the user chose that gzip covers the body of a successful
    GET or HEAD answer of a JSON route, and that an error answer keeps the
    identity encoding. The Routes section of
    `docs/protocol/mokly-shell-delivery.md` states that rule. The section
    "JSON compression" of `crates/mokly-server/delivery.md` states the
    one-encode rule and says "A failed encoding sends the identity body."
  - Each publication owns its gzip slots. `GzipFiles::response` makes a slot
    only for a request that accepts gzip, and `Gzip::get` encodes once for
    that slot. `State::publish` installs a new `Delivery` with new slots. The
    old bytes drop after the last response that holds them.
  - The route test `concurrent_gzip_requests_share_one_body_per_publication`
    in `crates/mokly-server/src/_tests_/json_delivery_tests.rs` checks that
    two concurrent gzip requests share one allocation. It also checks the
    decoded revision, and a new allocation after a replaced publication. The
    test `publication_json_negotiates_gzip_and_preserves_head_headers` checks
    the headers and the bodies of identity and gzip GET and HEAD. Neither
    test counts an encode.
  - The review found that two requests could each encode a file and both
    return the first stored result, and the route test would still pass. The
    check confirmed this with the severity Low, because the missed regression
    only repeats a fast encode and changes no response byte.
  - The branch applied the direct fix. The unit test
    `overlapping_and_later_gzip_callers_start_one_encode`, in the same file,
    tests the once-guard. It counts encode starts through its encoder
    callback. It holds the first encode while a second caller arrives, and it
    makes a later call after the encode ends. It asserts one encode.
  - After the review fixes of 2026-11-22, each comparison, temporary preview,
    and authored JSON response uses its own encoding. So a one-encode count
    applies only to the JSON files of a publication.
  - No single JSON response entry point exists. The review proposed one for
    the render route, but that proposal was removed on 2026-11-22, because
    the gzip rule covers GET and HEAD only, and the render route accepts only
    POST.
  - On the publication route, no await comes before the gzip slot, and the
    first poll of `tokio::join!` follows the declaration order. So an encoder
    that holds its first call forces the overlap without a sleep.
- **Problem:** The tests miss three breaks of the condition:
  - A route can bypass the once-guard. The route tests still pass when an
    identity GET or HEAD starts an encode, when Serve encodes a file before
    the first gzip request, or when a route encodes a file twice and keeps
    the first result.
  - No test shows that a replaced publication frees its gzip bytes.
  - No test covers a failed encode.
- **Impact if no action:** A later change can add encodes for identity
  requests, repeat encodes, or keep the bytes of replaced publications, and
  every test still passes. A later change can also lose the identity body
  after a failed encode without a failing test.
- **Root question:** How can the route tests fail for each break of the
  user's gzip condition that the unit test of the once-guard cannot see?
- **Options:**
  - **A.** Change nothing more. Keep the unit test of the once-guard that the
    branch applied. The three breaks stay untested. Effort: Small.
  - **B.** Test the two gaps without a seam. Take a weak reference to the
    gzip slots of a publication, replace the publication, let its responses
    end, and assert that the reference no longer upgrades. Pass a failing
    encoder callback to `Gzip::get`, and assert that it returns no bytes.
    Cost: the route-level encode count stays untested, and the failed-encode
    test stops at the once-guard. Effort: Small.
  - **C.** Inject a counting encoder into the HTTP delivery boundary of the
    JSON routes, for example one encoder field of `Application` with the fast
    gzip encoder as its default. A route-level test then asserts that
    identity GET and HEAD start no encode, that two overlapping gzip requests
    and a later one start one encode, and that a replaced publication starts
    one more. An encoder that fails shows the identity body after a failed
    encode, and the weak reference of B shows the release. Cost: one field
    and its default in `Application::new`, and the encoder passed to each
    publication JSON call, because no single JSON response entry point
    exists. Effort: Medium.
- **Shared assumptions:**
  - The evidence is a count of encode starts, with a held encode in place of
    a sleep. Source: the operation counts and the event order of the
    `testing` skill, and the task rules. It stays.
  - The pointer and body assertions of the current tests stay. Source: the
    task rule that forbids a weaker assertion. It stays.
  - The once-guard stays the closure of `Gzip::get` with a detached blocking
    job. Source: the code. It is weak, because a fix of
    `plans/follow-ups/serve-file-delivery-shutdown.md` can change that job.
    C drops it, because it counts at the route.
- **Left out:**
  - More pointer comparisons. They show shared output and still allow
    duplicate work.
  - A sleep, a timeout, or a retry. The task that found this item forbade
    them, and the `testing` skill gives event order in their place.
  - A process-wide or `cfg(test)` counter of the real encoder. Parallel tests
    share it, and the `testing` skill flags `cfg!(test)`. An observer for
    each application is C.
  - A seam inside `GzipFiles`. It is C at a lower level.
  - Runtime counts of blocking work. Tokio blocking metrics need
    `tokio_unstable`, and they also count asset reads.
  - An injected encoder in a single JSON response entry point. That entry
    point does not exist, and the proposal to build it was removed. Without
    it, this approach is C.
- **Wider fix:** C. It is the wider fix that the branch split off. The
  `testing` skill already gives operation counts and event order for this
  class of test, so the class needs no other fix.
- **Previous examples:** `eight_get_and_head_requests_share_one_verified_copy`
  in `crates/mokly-server/tests/shared_assets/delivery_tests.rs` counts
  verified copies separately from its body assertions. It counts them
  through `CountedAssets`, an `AssetStreams` implementation that the test
  injects into one application.
- **Related:** `plans/follow-ups/serve-file-delivery-shutdown.md`, the same
  code. Its option B can move the gzip encode of file assets into one
  delivery job and change `Gzip::get`. The unit test of the once-guard calls
  `Gzip::get` directly, so it may have to change with it. Option C here
  counts at the route, so it stays valid.
- **Recommendation:** C. It tests each part of the user's gzip condition at
  the route, through one seam that stays valid when the once-guard or its
  detached job changes. B is the smaller choice when only the two gaps get a
  test.
- **Action:** fix after merge, apply C, because it adds an injection seam to
  `Application` whose only consumer is this test, for a Low finding.
