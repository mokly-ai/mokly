# Bundle cache request cost has no profile

- **Severity:** Medium. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-18, from the options check of design call 32 of the
  bundle disk cache plan, on branch `calummoore/lisbon-h906`. That check
  reviewed the reopened design of the synchronous bundle cache write.
  Narrowed on 2026-11-21 by `calummoore/mokly-restored-bundle-reuse-answer-pspj`,
  which shares each module list through an `Arc`.
- **Location:** `crates/mokly-sidecar/src/pool_bundle_cache.rs:178` to line
  185, `crates/mokly-compare/src/bundle_codec_write.rs:75`,
  `crates/mokly-sidecar/src/pool_bundle_cache.rs:116`, and
  `crates/mokly-compare/src/bundle_cache_write.rs:44`.
- **Reason:** No run has split the cost of these stages. The warm-restart
  goal passes, and this profile can keep every response, timing, and warning
  contract.

- **Source:** Review.
- **Category:** Performance.
- **Terms:**
  - **Bundle cache:** the optional OS cache kind that keeps the latest
    compiled JavaScript bundle of each set of bundle settings, in
    `crates/mokly-compare`.
  - **Recipe snapshot:** a `DurableRecipe`, in
    `crates/mokly-sidecar/src/durable_recipe.rs`. It holds the settings, the
    module list, and one immutable compilation of a served bundle.
  - **Offer:** the call of the bundle store's `save` with the recipe snapshot
    of a served compilation, after a successful `bundle` request.
  - **Receipt check:** the first step of a save. It reads the receipt of the
    entry, and it ends the save when the receipt names the served compilation.
  - **`syncfs`:** a Linux call that waits until every changed page of one
    whole filesystem reaches the disk.
- **Background:**
  - The pool of `crates/mokly-sidecar` sends each `bundle` request to a Node
    sidecar. After each successful request in the `full` capture mode,
    `complete_bundle` at `crates/mokly-sidecar/src/pool_bundle_cache.rs:153`
    makes the offer. Since the capture decision C1 of 2026-11-18, a
    `serveEdit` request of a Serve head makes none.
    `crates/mokly-sidecar/src/pool_requests.rs:144` to line 145 runs it
    before the request returns. So the store call is part of the bundle
    response.
  - `CachedBundles::save` at `crates/mokly-compare/src/bundle_store.rs:138`
    runs the receipt check at lines 146 to 157. When the receipt names the
    served compilation, the save ends as `Unchanged`. Otherwise it encodes
    the entry and replaces it, at lines 158 to 162.
  - A disk hit restores the stored compilation. So its offer finds that
    compilation in the receipt and writes nothing.
  - On 2026-10-30, the design put the write inside the bundle response, so
    that tests stay deterministic and no write stays in flight at exit. It
    named a measured save above 100 ms as a trigger for a new review, not
    as a gate.
  - On 2026-11-16, a decision chose the `catalogue.bundle` span: the
    lookup, the restore, the sidecar request, and the write. The row at
    `docs/protocol/mokly-timings.md:42` says that the span holds "the bundle
    cache write". The variant with nested store read and write spans was
    not chosen.
  - On 2026-11-18, after a save sample of 122.441 ms, the review kept the
    synchronous write. The warm-restart goal holds: all nine warm commands of
    that day ran no compile and no esbuild operation. The same save code gave
    every sample.
  - Four sources of request cost have no profile:
    - The offer copy: `pool_bundle_cache.rs:178` to line 185 copies the
      settings of the result for each offer. Since the `Arc` change of
      2026-11-18, the offer shares the compilation through an `Arc`, and
      since 2026-11-21 it also shares the module list through an `Arc`.
      Before those changes, it also deep-copied both. The
      copy comes before the receipt check, so a disk hit or a memory reuse
      that writes nothing also pays it. It also comes before the type checks
      that reject a compilation without complete and durable evidence.
    - The frame count: after `encode` serializes the entry, it builds the
      `restoreGeneration` request with `disk_seed_request`, at
      `crates/mokly-compare/src/bundle_codec_write.rs:75`. That function
      copies the settings, and it shares the module list and the
      compilation through an `Arc`, at
      `crates/mokly-sidecar/src/reusable_recipe.rs:69` to line 71, in
      `disk_seed_request`. Before the `Arc` changes, it also deep-copied
      the module list and the compilation. `encode`
      serializes this request a second time only to count its bytes against
      the 64 MiB frame limit.
    - The restore copy: on a disk hit, the store returns an owned recipe
      snapshot. `pool_bundle_cache.rs:116` builds the `restoreGeneration`
      request from it with `disk_seed_request`, so it copies the settings
      again and shares the module list and the compilation. The bundle
      attempt then keeps the whole loaded recipe until the request ends. A
      short sidecar reply can name that restore, and the core then rebuilds
      the result from that storage. The attempt also reads the runtime key
      and the plan of the recipe.
    - The Linux flush: `bundle_replace` flushes the stage data at
      `crates/mokly-compare/src/bundle_cache_write.rs:44`, through `sync_tree`
      at `crates/mokly-compare/src/durability.rs:98`. On Linux, line 104 calls
      `Flush::filesystem`, and `crates/mokly-platform/src/flush.rs:31` to line
      38 runs one `syncfs`. So the write also waits for unrelated changed data
      of the same filesystem, for example after a large checkout or install.
  - The flush code is already on `origin/main`. The source and dependency
    kinds use it for their entries, which are large file trees. A bundle
    entry is one data file. Other platforms flush each file and directory of
    the stage, at `durability.rs:107` to line 133.
  - One write into an existing namespace also makes 12 `sync_all` calls on
    Unix: for the two new stage directories and their parents, both durable
    receipts, and the publication rename. On macOS, `sync_all` uses
    `F_FULLFSYNC`, which also flushes the drive cache, as the comment at
    `flush.rs:12` to line 16 says.
  - Two one-time probes measured the store on one Linux machine with four
    CPUs, while no other build or test ran. They called `CachedBundles::save`
    directly with the real recipe of `examples/basic`. Its stored file has
    6,313,039 bytes. Its restore request has 6,312,936 bytes of the
    67,108,864-byte frame limit.
  - Each probe sample saved into a new, empty store root. So each save also
    created and flushed the five directories of the bundle namespace, and no
    save replaced an old entry. A save after an edit replaces the old entry
    instead.
  - On 2026-11-17, with the change at `f032dd04c`, the saves took 35.492,
    25.674, and 27.109 ms. A receipt check of the same compilation took
    0.143, 0.074, and 0.067 ms. A load took 36.214, 29.181, and 26.937 ms.
  - On 2026-11-18, with the change at `1c3545ddf`, the saves took 122.441,
    63.431, and 83.137 ms. The receipt checks took 0.097, 0.088, and
    0.095 ms. The loads took 33.320, 32.627, and 28.541 ms.
  - `git diff f032dd04c 1c3545ddf` shows no change in
    `crates/mokly-sidecar/src`, `crates/mokly-platform`, `Cargo.lock`, or the
    bundle store, codec, cache, storage, and durability files of
    `crates/mokly-compare`. Both probes used the same probe source. So the six
    saves, 25.674 to 122.441 ms, show run-to-run variance of the same code.
  - The probe times leave out the pool. They hold the receipt check, the
    encode with its frame count, the locks, the staging, the flushes, and the
    publication. The receipt-check times hold only the store call, not the
    offer copy.
  - Final measurements of 2026-11-18, on the same machine, against `main` at
    `bc4f4cc40`, with the change at `3d55fdbd1`:
    - A third one-time probe used the same probe source, method, and recipe
      size. Each sample again saved into a new, empty store root.
    - The saves took 31.528317, 23.400493, and 24.850042 ms, with a median of
      24.850042 ms. Each save wrote the entry.
    - The receipt checks took 0.071, 0.142, and 0.065 ms, and each found the
      same compilation. The loads took 26.841, 30.885, and 26.139 ms. The Rust
      check of the 14,928 recorded physical inputs took 16.591, 13.839, and
      13.264 ms, and each found every input unchanged.
    - No save exceeded 100 ms, so the raw review-trigger flag of this set is
      false. The set at `1c3545ddf` keeps its 122.441157 ms sample and its
      true flag. The review of 2026-11-18 stays closed, and the write stays
      synchronous.
    - Since `1c3545ddf`, `crates/mokly-sidecar/src`, `crates/mokly-platform`,
      and the bundle store, codec, cache, storage, and durability files of
      `crates/mokly-compare` did not change. `Cargo.lock` gained one
      dependency line of `mokly-graph`.
    - These samples split no stage. They include no replacement write and no
      macOS or Windows sample.
  - The product timing records of 2026-11-18 give estimates. The time from
    the end of `sidecar.bundle` to the end of its `catalogue.bundle` span
    holds the result transfer, the parse, the offer copy, and the store call:
    - For 8 compiling requests, which needed a write, it was 99.6 to
      334.4 ms, with a median of about 156 ms.
    - For 21 disk hits, which wrote nothing, it was 33.9 to 279.5 ms, with a
      median of 61.7 ms.
    - The difference of the medians, about 94 ms, estimates one save. A
      compiling `catalogue.bundle` span took 2,745 to 4,896 ms. The review
      estimated that a save was about 1 to 7 percent of a compiling request.
    - These are estimates. The gaps do not isolate the save or any copy.
      The samples are small, the core records whole milliseconds, and each
      process has its own clock.
  - No save sample exists for macOS or Windows, for a busy filesystem, for a
    replacement write, or for a recipe near the frame limit. Nobody timed the
    offer copy, the frame count, or the restore copy on its own.
  - Every option must keep these requirements. E is the one exception for the
    response and span rule, and that exception blocks it.
    - Recipe snapshot ownership: each holder owns its recipe snapshot. A
      shared compilation stays behind an immutable `Arc`, as
      `crates/mokly-sidecar/src/reusable_recipe.rs:17` keeps it. The offer
      stays the compilation that the request served. The pool calls the
      store outside its mutex.
    - Restored reuse: a short sidecar reply can name any restore of its
      process, so each bundle request keeps the storage of each restored
      seed until it ends. The "Restored reuse" section of
      `docs/protocol/mokly-sidecar-recipes.md` gives the reply rules.
    - Only complete and durable evidence reaches the disk, through
      `ReusableRecipe::new` at `reusable_recipe.rs:22` and
      `DurableRecipe::new` at `crates/mokly-sidecar/src/durable_recipe.rs:13`.
    - In the `full` capture mode, every served compilation with complete and
      stable evidence is offered, also one served from memory. Since
      2026-11-18, a Serve head preparation in the `serveEdit` mode offers
      nothing. The receipt check decides whether to write.
      `docs/protocol/mokly-base-cache.md:121` to line 142 rejects a table of
      earlier offers.
    - Data and directory metadata are durable before the receipt, at
      `mokly-base-cache.md:29`. Publication stays atomic, and a hit still
      checks the payload digest.
    - The 512 MiB namespace bound of `docs/protocol/mokly-timings.md:192` and
      the 64 MiB frame limit of `docs/protocol/mokly-sidecar.md:38` stay.
    - No bundle cache operation waits for a lock, at
      `mokly-base-cache.md:145`.
    - The warning behaviour stays. `mokly-base-cache.md:84` to line 91 gives
      the fault classes and their output. `Reported` at
      `crates/mokly-cli/src/bundle_runtime.rs:129` emits the warnings of each
      save. A save fault sets the `cache` value of the request, at
      `pool_bundle_cache.rs:186` to line 190.
    - The write stays inside the bundle response and its `catalogue.bundle`
      span. The span set does not change.
    - No write runs after the pool stops. Each write ends inside its request,
      and `served` offers nothing after a stop, at `pool_bundle_cache.rs:198`
      to line 207.
    - No time gate and no new runtime setting are added. Every existing test
      and assertion stays.
- **Problem:** A bundle request runs optional bundle cache work that nobody
  profiled. Each offer copies the settings, the frame count copies them and
  serializes the recipe again, and each disk hit copies them for the
  restore. On Linux, each write also flushes the whole
  filesystem.
- **Impact if no action:** Each compiling request keeps its synchronous save.
  The probes measured 23.400 to 122.441 ms for a first write, and the product
  spans estimate about 1 to 7 percent of a compiling request. Each disk hit
  and memory reuse keeps the untimed copies. On Linux, a write can also
  wait for unrelated changed data, and no sample
  shows that cost or the macOS cost. No sample proves a causal slowdown, and
  warm restarts keep their gain.
- **Root question:** How does optional bundle cache work bound its cost on a
  bundle request, while it keeps recipe snapshot ownership, durability, and
  the current response, timing, and warning contracts?
- **Options:**
  - **A.** Change nothing. Each compiling request keeps its save, and each
    request keeps the copies. Effort: Small.
  - **B.** Remove the recipe copies and the second serialization:
    - Make the offer without a settings copy, at `pool_bundle_cache.rs:178`
      to line 185. For example, run the receipt check before any copy, or let
      the result and the offer share one immutable `Arc` of the served
      compilation.
    - Count the frame bytes at `bundle_codec_write.rs:75` without a copy. For
      example, serialize a borrowed view of the restore request. Or compute
      the count from the payload length and the fixed wrapper lengths, with a
      test that compares it with a real serialization.
    - Build the restore request at `pool_bundle_cache.rs:116` from the owned
      recipe of the disk hit, in place of a settings copy. The bundle attempt
      must keep the storage of that recipe, its runtime key, and its plan
      until the request ends, because a short sidecar reply can name the
      restore.
    - Each change keeps the bytes of each stored entry and each request.
    - It changes types of `crates/mokly-sidecar`, for example the `compiled`
      field of `results::Bundle`, and their test literals. No run has
      measured its gain.
    - Since the `Arc` change of 2026-11-18, the result, the offer, and the
      restore request already share the compilation, and `results::Bundle`
      holds it in an `Arc`. Since 2026-11-21, they also share the module
      list. Only the copies of the settings remain.
    - Effort: Medium.
  - **C.** Flush only the bundle entry on Linux:
    - In `bundle_replace`, at `bundle_cache_write.rs:44`, flush the one data
      file and its stage directories with the per-file path that `sync_tree`
      already uses on other platforms.
    - Keep both durable receipts, the publication rename, and every directory
      flush. The source and dependency kinds keep `syncfs`.
    - The requested flush then covers only the entry's data and directories.
    - It adds a second flush path on Linux, and a regression test with the
      existing `FlushMock` of `flush.rs:17`. No run has measured its gain.
    - Effort: Medium.
  - **D.** Profile, then apply only measured changes:
    - Profile the CPU and IO stages of the request path: the offer copy, the
      receipt check, the encode, the frame count, the reservation, the data
      write, the flush, the receipts, and the publication. Also profile the
      store read, the restore copy, and the restore request.
    - Repeat each run and keep every sample. Cover a replacement write in an
      existing namespace, a first write into a new namespace, a filesystem
      with unrelated changed data, and a recipe near the 64 MiB frame limit.
    - Add macOS and Windows samples when someone authorizes that runner work.
      The Linux part can run on any Linux machine.
    - Apply B, C, or both only when repeated measurements show a gain and
      every requirement holds.
    - When the measurements change the comparison of these options, the
      review of the synchronous write opens again.
    - The profile is a one-time proof, not a test or a gate.
    - Effort: Medium.
  - **E.** Move the write out of the bundle response:
    - One form is one bounded writer for each pool. It keeps at most one
      pending recipe for each set of bundle settings, and a newer recipe
      replaces it. It bounds the bytes that it holds, and it runs the receipt
      check again before it writes.
    - The other form defers writes to named points of each command: after
      `serve.ready`, after each watch action publishes its reload, and before
      `build` and `publish` exit. Serve shutdown cancels a pending write as a
      normal event. This form needs wiring in each command, and it gains
      nothing for `build`.
    - It removes the write from every compiling response, whatever makes the
      write slow.
    - It is blocked. The write, the `cache` value of a save fault, and its
      warnings leave the bundle response. That changes the `catalogue.bundle`
      row and the decision of 2026-11-16, so it needs a recorded decision.
    - It also needs rules for its warnings, cancellation, shutdown, abort,
      and test barriers, so that tests stay deterministic and the next start
      keeps the last write.
    - Effort: Large.
- **Left out:**
  - A detached writer that no owner waits for. An exit can cut the last
    write, so the next command compiles again. Warm-restart tests then depend
    on thread timing. It also changes the timing row, as E does.
  - An unbounded queue. It breaks the memory bound of pending recipes.
  - Fewer flushes, digests, receipt checks, or bounds. Each breaks a
    durability or bound requirement above. C is not in this group, because
    it keeps durability and changes only what the flush covers.
  - A time gate, a longer timeout, a skip of slow writes, or a new runtime
    setting. Each adds a gate or a setting, and none makes a write cheaper.
  - A nested span for the store write. It measures the write but does not
    make it faster. The decision of 2026-11-16 left it out, and D measures
    the stages once.
  - A smaller payload, for example compression. It changes the entry format
    and adds a dependency, and no sample shows that the data size is the
    main cost.
  - The sidecar as the writer. `docs/protocol/mokly-sidecar-recipes.md:169`
    to line 173 rejects it, because the sidecar performs no file writes.
  - A writer daemon. The pool writer of E is better on every point.
  - A repeat of the probe until each value is below 100 ms. Dropped samples
    hide evidence. D keeps every sample.
- **Wider fix:** E. It removes the optional store work from every bundle
  response, whatever makes the write slow. It is blocked, because the write,
  its `cache` value, and its warnings belong to the bundle response under
  the decision of 2026-11-16. B and C are direct fixes of single causes.
- **Previous examples:**
  - `docs/protocol/mokly-base-cache.md:136` to line 142 records an earlier
    bound of this class: the receipt check replaced a full write after each
    hit.
  - `mokly-base-cache.md:145` to line 154 records another: no bundle cache
    operation waits for a lock.
  - `plans/follow-ups/sequential-evidence-capture-cost.md` records a cost of
    the same change on the compile path. Its trims also keep only measured
    gains.
- **Related:** `plans/follow-ups/sequential-evidence-capture-cost.md`, a
  shared wider fix. Its option C moves the physical finish check and the
  recipe save off the critical path of the bundle result. For the save, it
  uses option E of this item and does not design a second writer. Apply E
  with that option C. The decision of 2026-11-16 that blocks E also applies
  to that save. This item keeps the profile, the copies, and the flush of
  the save path.
  `plans/follow-ups/serve-plan-record-start-cost.md` profiles the added plan
  counts, encoding, and restore in these same cache stages. One stage profile
  can serve both items.
- **Recommendation:** D. It keeps every requirement, and it changes a copy, a
  serialization, or a flush only after repeated measurements show a gain. E
  best protects the codebase from this class, but it stays blocked until a
  recorded decision changes the `catalogue.bundle` span.
- **Action:** fix after merge, apply D, because no run has split the cost of
  these stages and the warm-restart goal passes. The profile can keep every
  contract.
