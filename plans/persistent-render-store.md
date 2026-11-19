# Reuse rendered documents after Serve restarts

Status: Active. On branch `calummoore/mokly-first-changes-5-render-store-p3o6`, no pull request yet. The pull request that completes the work deletes this plan.

Mokly renders every view again after a Serve restart. The first Changes on
`mokly-cloud` takes about 12 to 14 seconds. The head usage pass renders 1,508
views and takes 7.35 seconds. This change retains complete rendered documents
in the existing Mokly cache directory. The process cache keeps its current
256 MiB bound and its current eviction rules.

On 2026-11-19, the user chose step 5 of the stacked first-Changes series.
The chosen approach is a persistent render store. The user accepted stale
results across restarts for unsupported render inputs: files, environment
variables, the clock, and random values. The watch contract already excludes
these inputs. Stored descriptions remain excluded.

The performance orchestrator's calls of 2026-11-19 are the starting design:

- Use a new kind of the existing cache. Keep its location, ownership,
  durability, receipt, and corruption rules. Every rejected entry is a miss.
- Key documents by their document key, Node version, platform, Mokly version,
  and the `jsconfig.json` chain. Do not key by the whole JavaScript bundle.
- Read after a process-cache miss and before composition. Run each side's
  closure walk, link checks, and usage recording on stored reads.
- Write outside the render and publication path. Use a bounded queue.
  Drop an offered write when the queue has no room.
- Bound retained disk bytes. Evict by access order. Add no setting.
- Measure two real restarts, including one with a changed line. Measure hits,
  write cost, first Changes, published bytes, and whole-tree memory.
- Add tests first. Prove restart reuse, key misses, corruption misses,
  eviction, and a full queue that cannot block a render.

Contract owners:

- [Cache storage](../docs/protocol/mokly-base-cache.md).
- [Runtime and memory](../docs/protocol/mokly-runtime.md).
- [Watch inputs](../docs/protocol/mokly-watch.md).
- [Format versions](../docs/protocol/mokly-format-versions.md).
- [Timing and budgets](../docs/protocol/mokly-timings.md).
- [Graph boundary](../crates/mokly-graph/README.md).
- [Cache implementation](../crates/mokly-compare/README.md).

## Design calls

### 1. Store documents through the existing cache

- **Severity:** High. **Effort:** Large.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `crates/mokly-graph` and `crates/mokly-compare`.
- **Terms:**
  - **Document key:** The hash of supported inputs for one rendered view.
  - **Receipt:** The cache record that marks durable data as complete.
- **Background:** The graph retains documents in process memory. The cache
  implementation already owns durable files, leases, and byte accounting.
- **Problem:** A restart loses the rendered documents and repeats sidecar work.
- **Impact if no action:** Warm restarts keep the 7.35-second head render pass.
- **Root question:** How can a restart reuse unchanged documents with equal output and bounded memory?
- **Options:**
  - **A.** Retain complete documents as a new existing-cache kind. Inject a
    store boundary into the graph. Reuse the lossless document representation
    and the durable cache rules. Give this kind an indexed access path rather
    than scanning all receipts on each read or write. Persist all metadata
    outside the existing compressed tree payload too. Effort: Large.
  - **D.** Pack documents and an index into durable segment entries of the
    same kind. Publish one receipt for each segment. Evict whole segments
    by access order. This reduces files and flushes but coarsens eviction.
    Effort: Large.
  - **E.** Apply A with the compiled toolchain identity, the compilation
    identity inputs absent from document keys, and the native core build
    identity. Include the platform. This covers Node, Mokly, configuration
    chains, extends targets, and applicable peer manifests. Do not include
    the complete compilation identity or ordinary JavaScript source bytes.
    A native executable digest can supply the core build identity without
    another process. HTML-only documents need no sidecar identity.
    Effort: Large.
  - **F.** Apply A without durability flushes. Publish digest-checked files
    by rename and treat torn files as misses. A crash can lose recent entries.
    This changes the required durability rule. Effort: Large.
- **Left out:** Process-only reuse cannot survive a restart. Stored
  descriptions fail the accepted description rule. A whole-bundle identity
  invalidates unchanged views after one source edit. B is an independent
  single-file store with another ownership, receipt, and eviction system.
  D is better on the points the options check found. C stores sidecar
  fragments and fails the complete-document read path. F cannot be selected
  while the task requires the bundle kind's durability rule.
- **Assumptions:** Complete documents and one cache are requirements of the
  task. Equal bytes and supported-input freshness are requirements of the
  task and runtime contract. Unsupported-input persistence has user approval.
- **Wider fix:** E. Existing toolchain and compilation evidence closes the
  identity gaps without another exhaustive configuration list.
- **Previous examples:** The bundle kind of the cache uses the same separation.
- **Recommendation:** D with E's identity, changed from A through E after the
  options check and storage measurement. Individual durable writes reached
  about 144 documents per second. Segment batches reached about 707. The
  writer retained 99.2% of a 1,508-document synthetic pass. These development
  measurements select batching, not the final startup acceptance result.
- **Action:** fix now, apply D and E. The store is the performance orchestrator's
  call of 2026-11-19. This workspace's orchestrator adds the identity coverage
  on the same date to preserve output across local rebuilds and restarts.

This restart step activates the store in Serve only. The build and publish
commands keep their current source-render path. This clarifies the scope of
call 1 on 2026-11-19 and preserves behavior outside the requested Serve change.

The timing counts keep store hits, misses, faults, writes, and drops separate
from memory-cache hits. Cold measurements empty only the render store. The
cache warning texts name documents and keep the bundle cache's cadence. These
details apply the existing measurement and common-cache requirements.

### 2. Bound storage and queued work by bytes

- **Severity:** High. **Effort:** Medium.
- **Source:** Design.
- **Category:** Performance.
- **Location:** The new render store and its writer boundary.
- **Background:** Documents average about 11.3 KB on `mokly-cloud`. The
  comparison capture encodes 1,508 views into about 17 MB. Both startup and
  ten-edit memory peaks must stay within 2% of main.
- **Problem:** An unbounded writer or store can exhaust memory or disk.
- **Impact if no action:** Persistence can violate the user's memory requirement.
- **Root question:** How can retained renders fit fixed resources without delaying publication?
- **Options:**
  - **A.** Use a fixed disk-byte bound with LRU eviction and one writer.
    Admit queued artifacts under both byte and count bounds. Drop work when
    admission fails. Select final constants from measured sizes and cost.
    Start evaluation at 128 MiB of disk and 8 MiB of queued retained memory.
    Include in-flight work and codec workspace in memory accounting.
    Effort: Medium.
  - **D.** Queue a bounded set of document keys. Read documents without
    promotion from the process cache on the writer. Charge active documents
    and encoding to its existing transit headroom and encoder leases. Reuse
    compact payloads when possible. Drop a key whose document left the cache.
    This keeps one owner of retained document memory. Effort: Medium.
- **Left out:** B keeps only a fixed count and fails the fixed-byte and
  memory requirements. C writes synchronously and fails the
  requirement that writes never delay renders or publication. An unlimited
  queue fails the memory requirement. A new setting breaks the no-setting rule.
- **Assumptions:** Fixed byte bounds, nonblocking offers, and no new setting
  are requirements of the task. The proposed constant values are provisional
  implementation choices, not new product requirements.
- **Wider fix:** D. The process cache remains the document-memory owner.
- **Previous examples:** The process cache accounts for encoding in transit.
- **Recommendation:** D, changed from A after the options check. It keeps
  offers nonblocking without a second queue of retained documents. A remains
  the fallback if the non-promoting read or shared encoding admission is
  unsafe. Any fallback must pass the same measured memory limits.
- **Action:** fix now, apply D. This workspace's orchestrator makes this call
  on 2026-11-19 under the performance orchestrator's resource requirements.

Options-check evidence: `.context/persistent-render-store/plan-options-check.md`.

Implementation details of the checked calls, recorded on 2026-11-19:

- Call 1 E uses the actual Linux running image through `/proc/self/exe`.
  Other targets use an embedded native build nonce. A missing invocation
  marker makes each non-Linux native build refresh that nonce, including
  a dependency-feature rebuild. This requires a CLI relink on a non-Linux
  no-op native build. It preserves native identity without a new process.
- Call 2 D prepares identity and the disk index on the existing writer.
  Encoding waits until the first completed Changes publication, ready or
  unavailable, after head validation. This keeps writes off the cold
  publication path. Stored reads remain available during that interval.
- The store publishes separate cumulative `render.store` state events.
  A sequence orders events from different threads. The process-cache
  counts keep their existing meaning.

## Milestone 1: Documentation and protocol

Depends on: none

State the accepted persistent-render rules before implementation. Add a
linked status line until the implementation meets those rules.

- [x] Update the cache, runtime, format, and timing contracts. Keep the watch
      input list unchanged. Explain unsupported-input reuse across restarts.
- [x] Update the architecture and affected crate READMEs for the new boundary.

Evidence: `.context/persistent-render-store/docs-report.md`.

## Milestone 2: Durable store and bounded writer

Depends on: 1

Retain lossless complete documents under the common cache rules. Keep failures
optional and preserve the process-cache bound.

- [x] Read relevant crate READMEs and Rust reference rules.
- [x] Add assertion-red tests through real public boundaries for durable
      restart bytes, changed-key misses, damaged and foreign-entry misses,
      access-order eviction, and full-queue drops without a time assertion.
- [x] Implement the versioned payload and fixed-byte render cache kind.
- [x] Implement bounded writer admission and off-path writes. Check writer
      lifetime, cancellation, durable publication, and concurrent readers.
- [x] Measure stored fraction and durable write throughput after one complete
      cold pass. Avoid per-document namespace scans. Evaluate batched segment
      publication if individual durable writes cannot retain that pass.
- [x] Record measured sizes, queue behavior, and write cost under `.context/`.
- [x] Measure encoder-lease contention with the writer active. Keep its
      export reservations inside the existing process-cache headroom.

Evidence: `.context/persistent-render-store/milestone-2-report.md` and the
final root checks in `m2-root-clippy.log` and `m2-root-repeats.json` there.

## Milestone 3: Render integration and freshness

Depends on: 2

Use stored compositions without bypassing validation or changing output.

- [x] Key stored documents with all required runtime, build, and configuration inputs.
      Test the `jsconfig.json` chain, including changed and missing candidates.
- [x] Inject the shared store into head and base graph runtimes. Read after a
      memory miss. Offer fresh documents without blocking publication.
- [x] Prove that stored reads repeat closure, link, and usage work for their
      current side. Preserve root scheduling and memory admission.
- [x] Run targeted tests. Run each new asynchronous test ten times. Record
      assertion-red evidence, run times, and test counts under `.context/`.
- [x] Remove documentation status lines when the implementation meets them.
- [x] Check the upgrade guide against implemented behavior. Correct the cache
      deletion wording for the accepted unsupported-input rule.

## Milestone 3a: Store-cold benchmark preparation

Depends on: 2

The benchmark reset is independent of graph wiring. It uses the CLI's cache
announcement and the `renders` kind, without copying platform cache paths.
Any discovery Serve invocation is unmeasured benchmark preparation. The
product starts no new process for this helper.

- [x] Make the official large-fixture cold path empty only the render kind
      before every measured cold start. Keep the other cache kinds and warm
      writes. Keep the existing scenario results and timeouts.
- [x] Prove reset behavior red first, then green. Check the new asynchronous
      test ten times. Align the large-fixture README.

Evidence: `.context/persistent-render-store/official-large-cold-report.md`.

## Milestone 3b: Complete the warm measurement seed

Depends on: 3 and 3a

The cold benchmark can finish before Changes completes. Optional writes wait
for that completion. Keep the cold process alive outside its measured window,
so its warm restart can reuse the documents that the writer retains.

- [x] Wait for completed Changes and the writer's idle state after the measured
      cold phase. Use existing wait limits. Record this preparation separately.
- [x] Prove the cold-to-warm seed and retained measured result count through
      targeted tests and a real official benchmark smoke.
- [x] Align the recipe field contract and the unsupported-input authoring guide.

Evidence: `.context/persistent-render-store/official-large-warm-seed-report.md`,
`release-smoke.log`, and the official HTML release smoke records there.

## Milestone 3c: Validate the store timing event

Depends on: 3b

The complete gate found an existing test reader that recognizes only the
three older timing event kinds. Extend that reader for the accepted store
state event. Keep all existing envelope, span, and count assertions.

- [x] Validate the new store state fields and require the event in the
      existing Serve timing test. Rerun the affected test and viewer suite.

Evidence: `.context/persistent-render-store/timing-validator-report.md` and
`viewer-gate-fixed.log`.

## Milestone 4: Measurements and verification

Depends on: 3c

Measure release builds against the last merged main in separate checkouts and
target directories. Run Cargo builds one at a time. Check disk and memory first.

- [ ] Measure at least six interleaved cold and warm rounds on `examples/basic`
      and large HTML and React fixtures. Include unchanged and one-line-edit
      restarts. Compare Changes and published bytes. Measure ten-edit memory.
- [ ] Send the pushed implementation SHA and dist build commit to the
      performance orchestrator for `mokly-cloud` measurement immediately.
- [ ] Commit and push a measurement candidate after its targeted and required
      gate checks. This lets the cloud measurement run before final acceptance.
- [ ] Confirm the cloud goals: at least four seconds sooner on warm restart,
      cold startup no more than 2% slower, memory peak no more than 2% higher.
- [x] Run the strict example build and Serve smoke check.
- [x] Run `cargo xtask check --suite repository` and `cargo xtask check` with
      Git 2.45 or later, git-lfs, pinned Bun, and locked Cargo dependencies.
      Record any machine blocker and each suite that ran.

Evidence: `.context/persistent-render-store/` holds all logs and reports.

## Milestone 5: Commit, review, and pull request

Depends on: 4

- [ ] Commit the final implementation with Conventional Commits and push.
      Watch CI with `scripts/ci-wait.sh`.
- [ ] Review the complete local diff against `origin/main` after the push,
      with the `implementation-review` skill. Check findings with fresh
      second-pass reviewers. Apply up to two fix rounds and re-review.
      Record deferred work as follow-up items.
- [ ] Integrate current main and the highest lower step that has a pull request,
      under the stacking rule and the `git-merge` skill. Verify the combined tree.
- [ ] Delete this plan under the `plans` skill after its required work completes.
- [ ] Open the stacked pull request. Keep every dated decision and design call
      in its description. Wait for CI. Report to the sending session. Do not merge.
