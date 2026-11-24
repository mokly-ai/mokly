# Each rebuild hashes unchanged resources again

- **Severity:** Low. **Effort:** Large. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-23, from the branch
  `calummoore/mokly-viewer-live-update-lpaj`, implementation review round 2:
  the wider fix that the branch split off finding 10, "Served stylesheets
  bypass the render cache limit".
- **Location:** `crates/mokly-server/src/backend.rs` (`GraphDocuments` and
  its `StylesheetSlot` records), `crates/mokly-server/src/authored_assets.rs`
  (the authored records), `crates/mokly-server/src/snapshot.rs`
  (`SnapshotFactory::replace` for `Projector`),
  `crates/mokly-cli/src/serve_state.rs` (a new `GraphDocuments` for each
  installed generation), `crates/mokly-graph/src/evaluation.rs`
  (`Session::resource`), `crates/mokly-graph/src/resource_access.rs`
  (`Session::digest_resource`), and maybe
  `crates/mokly-render/src/stylesheet_store.rs`.
- **Reason:** The fix reaches `crates/mokly-graph`, and maybe
  `crates/mokly-render/src/stylesheet_store.rs`, for which the user wants the
  list of files before any change.

- **Source:** Review.
- **Category:** Performance.
- **Terms:**
  - **Render generation:** the render plans and the resource rules that Serve
    installs together after a rebuild.
  - **Validator record:** the fixed-size record that Serve keeps for each
    route of a generated stylesheet or an authored file: the length, the
    XXH3-128 digest, and the SHA-256 tag of its bytes.
  - **Stylesheet artifact:** the compiled CSS of one stylesheet route that the
    graph keeps in its byte-bounded render cache.
- **Background:**
  - The user's condition of 2026-11-22 for the validators: "Compute each ETag
    once for each resource version, not on every request." The branch reads
    it as once for each version and render generation.
  - Each generated stylesheet and authored asset carries a strong `ETag`, the
    SHA-256 of its bytes, under the Routes section of
    `docs/protocol/mokly-runtime.md`. The test
    `changed_stylesheet_at_same_url_rejects_old_etag` in
    `crates/mokly-server/tests/shared_assets/cache_tests.rs` shows that a
    changed stylesheet never gets a 304 for its old tag.
  - Before the review fix of 2026-11-23, Serve kept the first copy of each
    served stylesheet for the rest of its generation. The graph could evict
    its own copy while Serve still held the clone. The kept copies totalled at
    most 132 KB on `examples/basic`. The official check of `c1dc3126c`, which
    had them, passed memory and CPU: +1.1% whole-tree peak and +0.08% core
    CPU.
  - Now Serve keeps no stylesheet body. `StylesheetSlot` in
    `crates/mokly-server/src/backend.rs` keeps one validator record for each
    route for the generation. Each request reads the graph's bytes, as on
    `origin/main`, and computes their length and XXH3-128 digest. A match
    reuses the tag, and a change computes one new SHA-256 tag.
  - The authored records follow the same rule, and they also drop with their
    generation. Each installed generation gets a new `GraphDocuments` in
    `crates/mokly-cli/src/serve_state.rs`. So after each rebuild, the first
    request for each unchanged stylesheet and authored file computes its
    SHA-256 tag again.
  - Generated assets already take their tag from the digest that the graph
    recorded, so their tags survive a rebuild with no hash. So B needs only
    the stylesheet half of the graph change.
  - `Session::resource` in `crates/mokly-graph/src/evaluation.rs` returns an
    owned copy of the cached stylesheet bytes, or compiles the bundle and
    caches it. `Session::digest_resource` in
    `crates/mokly-graph/src/resource_access.rs` returns the recorded digest of
    a generated asset with no read, but it reads and hashes a generated
    stylesheet on each call. So Serve, build, and comparison reads each hash
    the same stylesheet bytes on their own.
  - A shared handle to the artifact of the graph needs a change in
    `crates/mokly-graph`: `ResourcePlan` is private to that crate, and
    `raw_lookup` rejects routes that are not documents. `origin/main` copied
    the bytes for each request, and the largest example stylesheet has
    15 KB.
  - `SnapshotFactory::replace` for `Projector` in
    `crates/mokly-server/src/snapshot.rs` already receives the previous
    snapshot, so Serve can hand records to the next generation there.
- **Problem:** Each rebuild drops the validator records, so the first request
  for each unchanged stylesheet and authored file hashes its bytes again.
  Serve, build, and comparison reads have no common source for the bytes and
  the digest of one stylesheet version.
- **Impact if no action:** After each rebuild, Serve repeats one SHA-256 pass
  for each served stylesheet and authored file, at most 132 KB on
  `examples/basic`. Each stylesheet request also copies the CSS out of the
  graph and runs one XXH3 pass.
- **Root question:** How can Serve revalidate stylesheets and authored files
  without keeping response bytes outside every byte bound, and compute each
  tag once for each resource version?
- **Options:**
  - **A.** Serve stylesheets through shared handles to the artifacts of the
    graph. Carry only validator metadata across rebuilds, with proof that the
    delivered bytes match. For authored files, reuse the metadata after the
    fresh confined read confirms the same bytes. Effort: Medium.
  - **B.** Make the versioned stylesheet artifact of the graph the common
    source of the stylesheet bytes and digest for Serve, build, and
    comparison reads. Give the validator records an owner that survives a
    rebuild, bounded by the routes of the current generation. Effort: Large.
  - **C.** Use a separate byte-bounded store for delivered resources, with
    verified version identities. The store needs its own eviction policy and
    byte accounting. Effort: Large.
  - **D.** The Serve half of B, inside `crates/mokly-server`. Keep the
    validator records for the life of the Serve process. Each stylesheet
    request reads the bytes of the graph and computes their length and
    XXH3-128 digest. A match reuses the tag of the route, and a change
    computes one new tag. The authored records move to the same store.
    `SnapshotFactory::replace` passes the store to the new `GraphDocuments`
    through a new `Documents` method, and keeps only the routes of the new
    generation. Cost: each request still copies the CSS and runs one XXH3
    pass. The store survives a rebuild, so the orchestrator can ask for new
    cold pairs. `backend.rs` and `snapshot.rs` were near the 300-line cap of
    the Rust file length lint on 2026-11-23. Effort: Medium.
  - **E.** Keep the records of the branch: one record for each route for one
    generation. This is the state after the review fix of 2026-11-23.
    Effort: Small.
- **Shared assumptions:**
  - The tag is the SHA-256 of the sent bytes, and a changed resource never
    gets a 304 for its old tag. Source: the strong `ETag` rule of
    `docs/protocol/mokly-runtime.md` and the test
    `changed_stylesheet_at_same_url_rejects_old_etag`. It stays.
  - The bound for the memory of Serve is the whole-tree peak within 2% of
    `main`, not the render cache. Source: the bars of the official check. No
    protocol page bounds the stylesheet copy of Serve. It stays.
  - An unchanged resource keeps its tag across a rebuild. Source: the strict
    reading of the user's condition. A, B, C, and D take the strict reading.
    E drops it, as the branch does.
- **Left out:**
  - A tag from the stylesheet key of the graph. A key is not the digest of
    the sent bytes, so it breaks the strong `ETag` rule. It also needs
    `crates/mokly-graph`.
  - Content-addressed URLs. The user rejected them on 2026-11-22.
  - A larger render cache limit. The copy of Serve would stay outside it.
  - A tag from the URL or from a timestamp. A file can change at the same URL
    and keep its timestamp.
- **Wider fix:** B. One bounded owner of the bytes and a validator tied to
  the version of the resource stop two copies from diverging.
- **Previous examples:** `ee7d8ea73` shares stylesheet records across rebuilds
  through bounded stores. `c42755bcd` keeps the retained render artifacts
  inside the byte accounting of the graph cache. Since the review fix of
  2026-11-22, generated assets take their tags from the recorded digest of
  the graph.
- **Related:**
  - `plans/follow-ups/authored-requests-need-temporary-space.md`, the same
    authored record. When B or D keeps the authored records across a rebuild,
    the digest pass of that item can match a record of the previous
    generation. Apply that authored half and option B of that item in one
    change.
  - `plans/follow-ups/stylesheet-cache-across-restarts.md` and
    `plans/follow-ups/certified-core-stylesheet-records.md` change
    `crates/mokly-render/src/stylesheet_store.rs`. When B reaches that file,
    design it with those items.
- **Recommendation:** B. It gives Serve, build, and comparison one source of
  the bytes and the digest of each stylesheet version, and it keeps each tag
  across a rebuild, so each tag is computed once for each version. D is the
  part of B that stays inside `crates/mokly-server`.
- **Action:** fix after merge, apply B, because it reaches
  `crates/mokly-graph` and maybe `crates/mokly-render/src/stylesheet_store.rs`,
  outside the scope of the branch. Give the user the list of files before a
  change in `crates/mokly-render/src/stylesheet_store.rs`.
