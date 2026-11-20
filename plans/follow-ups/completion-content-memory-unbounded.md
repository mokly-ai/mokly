# Completion content check bypasses the memory budget

- **Severity:** High. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-20, from finding 2 of the fourth post-push review round
  of the branch `calummoore/fu-receiver-read-model-validation-prd6`, PR #379.
  The independent finding check of that round confirmed it.
- **Location:** `crates/mkc-publications/src/catalogue_content.rs:58` to
  line 68, `crates/mkc-publications/src/completion.rs:56`,
  `crates/mkc-api/src/upload_complete.rs:62`,
  `crates/mkc-api/src/publishing.rs:105` to line 117,
  `crates/mokly-model/src/readers.rs:132` to line 152,
  `crates/mokly-model/src/public_privacy.rs:61` and line 66,
  `docs/protocol/cloud/publication-ingest.md:53` to line 61, and
  `docs/ops/environment.md:318` to line 329.
- **Reason:** The recommended fix adds an admission rule, a 503 outcome, and
  a refusal at Complete, and no recorded decision covers them.

- **Source:** Review.
- **Category:** Security.
- **Terms:**
  - **Complete:** the last request of a `mokly publish` upload. It checks the
    stored content and makes the publication ready.
    `docs/protocol/cloud/publication-upload-exchange.md`, section Completion,
    gives its order.
  - **Content check:** the check of `docs/protocol/mokly-upload-validation.md`,
    section Catalogue Content. Complete reads the stored index and every
    declared entry detail with the lenient readers before it publishes.
  - **Entry detail:** the JSON file of one catalogue entry, under
    `mokly-viewer/entries/` or under a comparison generation. It reaches the
    receiver as a Blob of up to 64 MiB.
  - **Lenient readers:** `readers::index_lenient` and `readers::detail_lenient`
    in `crates/mokly-model/src/readers.rs`. They check the known fields and
    ignore additive unknown fields.
  - **Upload memory budget:** the process-wide byte budget
    `MKC_UPLOAD_MEMORY_BYTES`, 512 MiB by default. Plan and Blob requests
    reserve bytes from it before they buffer a body.
- **Background:**
  - On 2026-11-03 the user chose that a receiver checks the read model with
    the core's own Rust readers. `docs/protocol/mokly-upload-validation.md`,
    section Catalogue Content, records that decision. On 2026-11-20 the branch
    `calummoore/fu-receiver-read-model-validation-prd6` added the content
    check to Complete.
  - The code path, confirmed by a read of the code on 2026-11-20:
    - `ContentCheck::content` in
      `crates/mkc-publications/src/catalogue_content.rs` reads each declared
      detail whole with `FileStore::get`, which returns a `Vec<u8>`, at
      `crates/mkc-file-store-interface/src/store.rs:39`. A detail can hold up
      to 64 MiB, `MAX_FILE_BYTES` at line 12. The loop checks one detail at a
      time.
    - `decode_with_mode` in `crates/mokly-model/src/readers.rs` parses the
      whole text into a `serde_json::Value` tree at line 132. It runs the
      privacy walk at line 145, after the parse. At line 147 it decodes a
      clone of the whole tree.
    - In lenient mode the reader returns at line 152 and never uses the
      original tree again. So the clone is not needed. Until the decode ends,
      the stored bytes, the tree, and the clone are in memory together.
    - Only `crates/mkc-mokly-contract/src/content.rs` calls the lenient
      readers outside the tests. The strict readers need the original tree
      for their unknown-field comparison.
    - The privacy walk stops at 5,000,000 visited values or a depth of 128,
      at `crates/mokly-model/src/public_privacy.rs:61`. It checks these limits
      only when it takes an entry off its stack. At line 66 it puts every
      child of an array on the stack first. So the limits apply only after
      the whole tree exists.
    - No JSON node quota applies to a detail. The Plan bounds only the index,
      with its 8 MiB quota and the 262,144-node quota of
      `docs/protocol/cloud/publication-upload-validation.md:29`, as
      `docs/protocol/cloud/publication-review.md:16` states.
    - `crates/mokly-model/Cargo.toml:18` turns on the `preserve_order` feature
      of `serde_json`, and no other workspace manifest does. The new
      dependency of `mkc-mokly-contract` on `mokly-model` brings it into the
      API build, so each parsed JSON object is an `IndexMap`.
  - No admission covers Complete:
    - `crates/mkc-api/src/upload_complete.rs:62` runs `Ingest::complete` on
      the blocking pool and reserves no memory.
    - `PublicationIngest` holds no budget, at
      `crates/mkc-api/src/publishing.rs:105`. The only semaphore is the
      two-plan admission at line 117.
    - The runtime keeps the default tokio blocking pool of 512 threads, at
      `crates/mkc-api/src/cli.rs:133`.
    - `complete_upload` at `crates/mkc-publications/src/completion.rs:56`
      takes no lock. Overlapping Complete requests of one attempt each run
      the whole check. The ready transaction decides only which one
      publishes.
  - The memory contract:
    - `docs/protocol/cloud/publication-ingest.md:53` to line 61 charges plan
      entries and Blob bodies only. Exhaustion answers 503
      `upload-unavailable` at once.
    - `docs/ops/environment.md:318` to line 329 sizes the 1 GiB API workload:
      512 MiB for the budget and 512 MiB of headroom for listed buffers. It
      gives no share to a content check.
    - The chart sets `uploadMemoryBytes: 536870912` and a `1Gi` memory limit,
      at `infra/helm/mokly-cloud/values.yaml:63` and line 75.
    - The Completion order of
      `docs/protocol/cloud/publication-upload-exchange.md` lists no 503.
    - The CLI tries Complete up to five times. It retries 500, 502, 503, 504,
      and transport failures, at `docs/protocol/mokly-upload-exchange.md:171`
      to line 172. So one publish can repeat a failed check.
  - Sizing estimates. On 2026-11-20 a review agent calculated them from the
    source of `serde_json` 1.0.154, `indexmap` 2.14.2, and `hashbrown`
    0.17.1. Nobody compiled, ran, or measured them, and no load test
    reproduced the problem:
    - Each parsed value takes at least 72 bytes, because the object variant
      holds a 72-byte `IndexMap`. Each walk stack entry takes about 40 bytes.
    - A detail with one 60 MiB unknown string needs about 180 MiB at its
      peak: the bytes, the tree, and the clone. Six such checks at once pass
      the 1 GiB limit.
    - A 64 MiB detail of only `0,` values holds about 33.5 million values.
      Its parse alone writes at least 2.25 GiB before any check runs.
    - A detail of about 10 MB with 4.9 million values passes the walk limit.
      It needs about 680 MiB.
    - One check needs about 3 times the file size for long strings, and at
      least 36 times for dense numbers.
  - Every option keeps the completion outcomes of
    `docs/protocol/cloud/publication-ingest-lifecycle.md`, section
    Completion:
    - A missing detail defers to the ready transaction.
    - A failed read or a stored size mismatch is an internal failure that
      leaves the attempt open.
    - A new admission failure stays out of the cleanup list at
      `crates/mkc-publications/src/completion.rs:59` to line 67, so the
      attempt stays open for the CLI's retry.
  - No memory option is applied. The branch made no partial reader change,
    such as the clone removal of D, while this decision waits for the user.
- **Problem:** Complete loads and parses entry details outside the upload
  memory budget. Nothing bounds how many checks run at once, and overlapping
  requests of one attempt repeat the same check. One dense detail can need
  more memory than the API workload has, because the parse runs before any
  value limit.
- **Impact if no action:** An authorized publisher can exhaust the memory of
  an API replica with large details or with concurrent Complete requests. The
  replica then fails the requests of unrelated projects, and the CLI's
  retries can repeat the load.
- **Root question:** How does the API keep each content check, and all
  concurrent checks, inside its memory limit, and which uploads may it refuse
  for this reason?
- **Options:**
  - **A.** Extend the shared memory budget to Complete. Cover the stored
    bytes, the retained validation state, and the reader allocations before
    the content loads. Add a deterministic regression for overlapping
    completions. It changes service construction and memory accounting. It
    does not say how to charge the parse before the content loads: a charge
    equal to the stored size misses the tree, and a worst-case charge never
    fits the 512 MiB budget. Effort: Medium.
  - **B.** Move the content check into a process-wide worker queue with a
    fixed total memory allowance. Requests wait for the results. It adds
    scheduling and cancellation work. Effort: Large.
  - **C.** Run the native readers in isolated workers with enforced
    operating system memory limits. A worker that runs out of memory cannot
    stop the API process. It adds process management and result transport,
    and it needs a rule for content above the worker limit. Effort: Large.
  - **D.** Remove the clone in lenient mode, enforce the existing privacy
    limits during the parse, and bound the walk stack. The reader verdicts
    stay the same. It lowers memory, but concurrent checks stay unbounded,
    and one check at the walk limit still needs at least 5,000,000 × 72
    bytes, an estimate. The clone removal alone is Small. Effort: Medium.
  - **E.** Keep A's charge for retained validation state. Do the clone removal
    of D. Then scan each detail without a JSON tree to count its values and
    string bytes. Before the parse, reserve the
    stored bytes and a conservative allocation charge from the shared
    budget, and release that reservation after the detail. Share one check
    result for overlapping requests of one attempt. On a temporary
    exhaustion, answer the retryable 503 `upload-unavailable`, the reason at
    `docs/protocol/cloud/rest-api.md:114`. The user also chooses the answer
    for a detail that can never fit, such as 413 `upload-too-large`, which
    `docs/protocol/mokly-upload-validation.md:43` permits. Update
    `docs/protocol/cloud/publication-ingest.md`,
    `docs/protocol/cloud/publication-upload-exchange.md`, and
    `docs/ops/environment.md`. It adds a new Complete outcome, and the charge
    for each value must follow the reader's memory layout. Effort: Medium.
  - **F.** Make the core reader run the version and privacy checks on the
    token stream, and then decode the typed shape from the text. Unknown
    fields then need no tree. serde can still buffer untagged unions, so the
    gain is uncertain, and concurrent checks stay unbounded. Effort: Large.
  - **G.** Count the values of each detail with a streaming scan before the
    parse, and refuse a detail above a receiver value quota with 413
    `upload-too-large`. An example quota is the 262,144-node quota at
    `docs/protocol/cloud/publication-upload-validation.md:29`. Reserve one
    fixed charge for each admitted parse. It refuses details that the core
    readers accept today, and nobody has measured real detail sizes. Effort:
    Medium.
- **Left out:**
  - Change nothing. It leaves these allocations outside process admission,
    so it fails the goal.
  - Refuse unknown fields. It breaks the lenient rule that the user chose on
    2026-11-03.
  - Smaller byte limits alone. Bytes do not bound the parsed tree.
  - A limit on the worker count, or a limit for each project, alone. One
    check can pass the memory limit by itself.
  - Pod memory sizing alone, at `infra/helm/mokly-cloud/values.yaml:75`. The
    need of one check grows with the values of a detail. A larger limit can
    support D, E, or G.
  - A value quota is not left out. It is option G, because the user reserved
    that choice and did not rule it out.
- **Wider fix:** C. Only an operating system memory limit keeps the API safe
  when the allocation pattern of the reader changes. A and E must know that
  pattern, so they are direct fixes. C is blocked, because content above the
  worker limit could never publish, and that rule needs the user.
- **Previous examples:** Plan and Blob requests already reserve from the
  upload memory budget before they buffer bytes. The Blob handler at
  `crates/mkc-api/src/upload_blob.rs:89` to line 100 reserves the encoded and
  the decoded size, and it answers 503 `upload-unavailable` on exhaustion. No
  earlier completion case was found in the history or in `plans/`.
- **Related:**
  - [receiver-read-model-validation.md](./receiver-read-model-validation.md),
    the same code: it deploys and smoke-tests the content check that this
    item bounds. Its task stays the deploy and the smoke test.
  - [upload-quotas-not-revisited.md](./upload-quotas-not-revisited.md),
    linked work: it asks for measurements of real exports and receiver load.
    Option G needs such a measurement of real detail sizes.
- **Recommendation:** E. It bounds each check and all concurrent checks with
  the existing budget and the existing 503 reason, and it refuses only
  content that cannot fit in the process. The review first recommended A,
  which does not say how to charge the parse before the content loads. C,
  the wider fix, gives stronger isolation for more effort.
- **Action:** ask the user, because E adds an admission rule, a 503 outcome,
  and a refusal at Complete that the budget contract for Plan and Blob
  requests does not cover, and E, C, and G trade refusals against effort.
