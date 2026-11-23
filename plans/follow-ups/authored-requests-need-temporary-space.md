# Bodyless authored requests need temporary space

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-23, from the branch
  `calummoore/mokly-viewer-live-update-lpaj`, implementation review round 2,
  finding 11, "Bodyless asset requests require temporary disk space". On the
  same day, the problem of the error answer that the checks of findings 11
  and 13 found moved to its own item,
  `plans/follow-ups/authored-file-failure-answer.md`.
- **Location:** `crates/mokly-server/src/authored_assets.rs`
  (`AuthoredRequest::admit`, the capture that it runs, and
  `AuthoredRecord::gzip`), `crates/mokly-server/src/work_delivery.rs`
  (`Workers::authored_delivery`), `crates/mokly-server/src/asset_file.rs`
  (`CaptureWriter::new`), `crates/mokly-server/src/asset_response.rs`
  (`deliver`), and `crates/mokly-server/src/application.rs` (`dispatch`, and
  the `static/` branch of `route`).
- **Reason:** The fix rule gives `fix after merge` to a Medium product bug
  with the likelihood Rare.

- **Source:** Review.
- **Category:** Product bug.
- **Terms:**
  - **Authored asset:** a repository file of the public closure that a mockup
    references. Serve answers it at `/static/` followed by its closure path.
  - **Bodyless request:** a HEAD request, or a GET whose `If-None-Match`
    names the current tag, so that Serve answers 304 with no body.
  - **Validator record:** the record that Serve keeps for each authored route
    of a render generation: the length, the XXH3-128 digest, and the SHA-256
    tag of the identity form, and the gzip length and tag once Serve encodes
    that form.
- **Background:**
  - The worker job of each authored GET and HEAD reads the source once into a
    temporary copy, before the headers. `AuthoredRequest::admit` in
    `crates/mokly-server/src/authored_assets.rs` gives the worker that
    capture. `CaptureWriter::new` in `crates/mokly-server/src/asset_file.rs`
    makes the copy with `tempfile::tempfile()`. The worker job gets no method
    and no request headers.
  - `deliver` in `crates/mokly-server/src/asset_response.rs` decides on a 304
    only after the copy exists. `dispatch` in
    `crates/mokly-server/src/application.rs` drops the body of a HEAD only
    after the route answers. A gzip request for authored JSON also writes a
    gzip copy, unless the recorded gzip tag matches.
  - A failure to make or write the copy becomes `InternalError::Io`, and the
    `static/` branch of `route` in `crates/mokly-server/src/application.rs`
    then answers 500. The status, the reason, and the text of that answer,
    and its terminal line, are the subject of
    `plans/follow-ups/authored-file-failure-answer.md`.
  - On `origin/main`, `Work::authored` returned the confined handle, and the
    route streamed it. So no authored request wrote a temporary file, and the
    authored route answered only 200 or 404.
  - Each record pairs its digest with the SHA-256 tag of the same bytes.
    Without a copy, a change that keeps the length needs one more full read
    that computes both digests.
  - Since the review fix of 2026-11-23, an authored request waits for the
    gate of its route before it takes a worker permit:
    `Workers::authored_delivery` in `crates/mokly-server/src/work_delivery.rs`
    waits in `AuthoredRequest::admit` first. Each admitted request still makes
    its own capture.
  - No test sends an authored request when the temporary directory cannot
    hold a file. The test
    `a_large_authored_asset_streams_and_the_existing_preview_budget_still_applies`
    in `crates/mokly-server/tests/http/stream_tests.rs` passes only a
    successful copy.
- **Problem:** Every bodyless request for an authored asset writes a full
  copy before Serve picks its answer. When the temporary storage is full,
  Serve answers 500 also for a readable file whose request needs no body.
- **Impact if no action:** A developer with little temporary storage loses
  the metadata reads and the cache revalidation of a large asset.
- **Root question:** How can Serve answer bodyless requests for authored
  assets when temporary space is scarce?
- **Options:**
  - **A.** On a failure of the temporary storage, compute the needed headers
    without a file, and return that result when the request needs no body.
    Cost: it can repeat work after a partial write. Effort: Medium.
  - **B.** Compute the metadata of a HEAD and of a conditional answer without
    a staged body. Stage the bytes only for a GET that needs them, and
    compute the final tag from the bytes that Serve sends. Cost: a
    conditional miss and a change that keeps the length need a second read.
    A second read that runs as its own worker job must first pass the gate of
    its route. Effort: Medium.
  - **C.** Keep the single pass that stages and hashes. Give a source read
    failure and a temporary-file failure separate error kinds. On a
    temporary-file failure, drop the writer and finish both digests in the
    same read. Answer a HEAD or a matching conditional GET from those
    digests. Cost: a GET that needs a body still fails with 500, and each
    bodyless request still writes a full copy in normal use. Effort: Medium.
- **Shared assumptions:**
  - A bodyless answer reads the whole live file before its headers. Source:
    the strong `ETag` rule and the HEAD rule of the Routes section of
    `docs/protocol/mokly-runtime.md`, and the test
    `same_size_authored_edit_with_preserved_mtime_revalidates_against_new_bytes`.
    It stays.
  - A GET that sends a body stages a private copy. Source: the call of the
    first review round on 2026-11-22, and `crates/mokly-server/delivery.md`.
    It stays. Option D of
    `plans/follow-ups/runtime-write-rule-temporary-storage.md` drops it.
  - A bodyless gzip answer carries the gzip tag and the gzip length. Source:
    the HEAD rule, the gzip rule of `docs/protocol/mokly-shell-delivery.md`,
    and the test
    `authored_json_negotiates_gzip_and_validates_the_selected_bytes`. It
    stays. With no recorded gzip form, B encodes into a sink that counts
    and hashes, not into a file.
  - A reads the source again after a failed staging. Source: the text of A.
    That read is close to the retry that the task rules forbid. C drops it.
  - The records drop with their generation. Source: the code.
    `plans/follow-ups/rebuild-rehashes-unchanged-resources.md` owns that
    rule. It stays.
- **Left out:**
  - The whole file in memory. It fails for a large file.
  - File metadata. It misses an edit that keeps the size and the timestamp.
  - A copy in another directory, or a memory spool. B is better on every
    point.
  - A tag from watch events. It breaks exact revalidation, and `--no-watch`
    has no events.
  - A 304 from the record before the live read. It skips the live check of
    the strong `ETag` rule.
  - A HEAD without `ETag` or `Content-Length`. It breaks the HEAD rule.
  - Change nothing. It fails the goal.
- **Wider fix:** B, when its bodyless result is a type that holds no file.
  Then the response path needs temporary storage only for a private body.
- **Previous examples:** None found for a bodyless request that fails because
  the temporary storage is full.
- **Related:**
  - `plans/follow-ups/authored-file-failure-answer.md`, the same failure. That
    item decides the status, the reason, the text, and the terminal line of
    the answer when Serve cannot prepare an authored file. After B here, that
    answer remains for a GET that needs a body.
  - `plans/follow-ups/same-route-waits-hold-workers.md`, the same code. Under
    its option D, one capture serves several requests, and it knows before its
    read whether one of them needs a body. So B here composes with that
    option.
  - `plans/follow-ups/serve-file-delivery-shutdown.md`, the same code. It says
    that each authored GET and HEAD reads into a copy. B changes the passes
    that its stop checks must cover: a read with no copy, a second read on a
    conditional miss, and a gzip encode with no file. Neither item waits for
    the other, but B must update that item.
  - `plans/follow-ups/runtime-write-rule-temporary-storage.md`. Its option D
    keeps no authored copy at all, which also removes this failure. The write
    sentence of `docs/protocol/mokly-runtime.md` says that a copy goes away
    when the last request or response that holds it ends, so it stays true
    after B.
  - `plans/follow-ups/rebuild-rehashes-unchanged-resources.md`, the same
    record. When its fix keeps the authored records across a rebuild, apply
    that authored half and B here in one change.
- **Recommendation:** B. It removes the needless write from the bodyless path
  also in normal use, and it keeps the tag tied to the bytes of a GET. Each
  edit makes the reloaded frames revalidate their authored assets, so today
  each of those 304 answers writes a full copy. The regression test makes a
  missing temporary directory with `tempfile::env::override_temp_dir` in its
  own test binary, because only the first call of that function in a process
  succeeds. Today a HEAD and a matching conditional GET get 500 there. After
  B they get 200 and 304.
- **Action:** fix after merge, apply B, because a Medium product bug with the
  likelihood Rare gets `fix after merge` under the fix rule.
