# Reduce JavaScript work in sidecar bundles

Status: Active. On branch `calummoore/mokly-bundle-hot-path-2-1bc5`, no pull request yet. The completion pull request deletes this plan.

The sidecar compiles catalogue JavaScript before Changes can become ready.
The performance orchestrator measured 2,048 ms per bundle on `mokly-cloud`.
Three combined changes saved 322 ms in its standalone probe.
This change keeps compiled bytes, recorded inputs, errors, and transport limits.
It adds no setting or state that survives a bundle call.

The performance orchestrator chose the design below on 2026-11-18.
The user delegated these calls after requesting faster and more reliable Changes on 2026-11-16.
The user also required bounded memory and separate pull requests without another approval request.
The task authorizes this plan and its implementation.

On 2026-11-18, `main` advanced to `e60c16532` with the bundle disk cache of #312.
The performance orchestrator then made these coordination calls:

- This branch merges `main` before its pull request.
- One byte-count implementation stays in `recipe-size.ts`. This change keeps the size cut of #312 where it covers the call, and adds only what is missing, with exactness tests.
- The read changes build on the attempt structure of #312. The byte sharing follows the per-call scope of its one evidence owner.
- The branch `calummoore/mokly-sidecar-plan-reuse-srh7` can start an edit compile with a planned attempt. The byte sharing stays correct for a call without a native attempt.

Contract owners:

- [Sidecar boundary](../docs/protocol/mokly-sidecar.md).
- [Module inputs](../docs/protocol/mokly-sidecar-modules.md) and [compiled recipes](../docs/protocol/mokly-sidecar-recipes.md).
- [Package entry points](../packages/mokly/README.md).

## Design and options

Shared assumptions come from the task: preserve output bytes, final consumed inputs, errors, the transport limit, and peak memory within measurement noise.
The task also forbids state across calls and a new setting.
The code at `e60c16532` supports all three cuts.
The measurements of item 2 are in `.context/sidecar-bundle-javascript-work/bench/`.

### 1. Reduce consumer file read overhead

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `packages/mokly/src/sidecar/plugins.ts`.
- **Background:** Each compiler load in the `file` namespace calls the callback form of `readFile` through a promise. That form makes four thread-pool round trips for each file, each with a callback on the main thread. The evidence plugin of #312 runs first, but it reads only metadata files.
- **Problem:** Thousands of callbacks consume main-thread time in every bundle. The `mokly-cloud` head bundle has 4,441 such loads.
- **Impact if no action:** Each edit keeps this measured source of delay.
- **Root question:** How can each bundle read its consumer files with less JavaScript work?
- **Options:**
  - **A.** Use one synchronous read for each consumer load. Keep the failure-only stack capture and the same error text. Effort: Small.
  - **B.** Prefetch consumer files asynchronously before compilation. This needs graph discovery and more coordination. Effort: Medium.
  - **C.** Move compilation and file reads into a worker. This adds transport and worker ownership. Effort: Large.
  - **D.** Move only the reads to one reader worker thread, which transfers the bytes back. Reads stay parallel on a cold disk, but each file costs two messages, and the worker needs a lifecycle and error copies with the same text. Effort: Medium.
- **Left out:** Keeping the callback reads misses the measured saving. A new cross-call cache breaks the task constraints. esbuild cannot read the files itself, because it gives plugins no bytes, and the recipe must digest the compiled bytes.
- **Wider fix:** None. The change removes callbacks at the existing load boundary. The same class of per-file callbacks remains in `ModulePaths.resolve`, which a follow-up item records.
- **Previous examples:** `bc4f4cc40` reduced resolver work in each compile.
- **Recommendation:** A. The orchestrator measured a 252 ms saving with this local change. The options check kept A and corrected its failure path, as the text below says.
- **Action:** Apply A. This is the performance orchestrator's call of 2026-11-18, under the delegated speed and reliability work.

esbuild selects the diagnostic location of a load failure from the error stack.
Today the stack is captured after the awaited callback read, so it holds only asynchronous frames.
A synchronous failure shows other frames, and esbuild then reports another column.
A wait on a resolved promise also changes the location when `Error.stackTraceLimit` is 3.

Design call of this workspace's orchestrator, 2026-11-18, after the options check: when the synchronous read fails, the load reads the file again with today's callback read and failure path.
The failure then keeps today's error object, stack, and text at every stack limit and on every platform.
A fallback read that succeeds returns its bytes, as any read of a changed file does.
The success path makes one synchronous read and no callback.
The whole error text must equal the text from the saved `main` package, also at stack limits 2 and 3 with several failing loads.

Design call of this workspace's orchestrator, 2026-11-18: the CSS module load keeps its asynchronous `fs/promises` read.
A synchronous read there would also move its error location, and CSS loads are few.
Call A names the `file` namespace load.

### 2. Count transport bytes without envelope texts

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `packages/mokly/src/sidecar/recipe-size.ts`.
- **Background:** Both the bundle response and the restore request must fit the 64 MiB frame limit. The transport encodes frames with `jsonText`. The cut of #312 replaced the sorted `jsonText` copies in the check with `JSON.stringify`. The check still builds both complete envelope texts, and each holds the compiled code and the module graph.
- **Problem:** The check builds about 6 MB of text twice only to count bytes. On a synthetic result with the `mokly-cloud` shape, it takes 39 ms for a Serve edit bundle and 43 ms with full reuse evidence.
- **Impact if no action:** Every bundle and every reuse keeps this work and its temporary allocation.
- **Root question:** How can the sidecar keep its size rejection with less serialization work?
- **Options:**
  - **A.** Walk the values once and count the exact UTF-8 bytes of `jsonText`. Count the shared compiled recipe and module graph once for both envelopes. Keep the evidence fallback of #312 and the error text. Effort: Small.
  - **B.** Serialize each shared member once with `JSON.stringify` and add the envelope bytes. This still builds one text of each member, and it keeps the rule that recipes hold no numbers. Effort: Small.
  - **C.** Serialize once and share the text with the transport. This changes response ownership and still needs restore sizing. Effort: Medium.
  - **D.** Keep the check of #312 and add only exactness tests. This keeps about 25 ms of work in each bundle. Effort: Small.
  - **E.** Serialize the shared members once, count both envelopes from those texts, and send the same texts in the response frame. The transport then encodes the recipe once. Bundle frames lose the sorted key order of the transport, and the texts must follow the recipe to the send, also on reuse. Effort: Medium.
  - **F.** Prove the fit first with a cheap upper bound of six bytes for each UTF-16 code unit, and count exactly only above the limit. The bound measured 1.6 ms and 5.5 ms, but it adds a second code path. Effort: Small.
- **Left out:** Removing the check changes errors and can install an unusable generation. Approximate counts change the accepted limit. A counting sink inside the transport is worse than C on every point, because C shares the text itself.
- **Wider fix:** C. It counts the text that the transport sends, so the count cannot drift from the encoder. E is its faster form. The first recommendation named A.
- **Previous examples:** The size cut of #312 removed the sorted copies.
- **Recommendation:** B. It measured as fast as A or faster, keeps the `JSON.stringify` count of #312, and needs no second encoder. The options check changed the recommendation from A.
- **Action:** Apply B. The performance orchestrator's call of 2026-11-18 asks for exact counts without the two envelope texts. Choosing B within that call is the design call of this workspace's orchestrator, 2026-11-18, because the coordination call keeps the count of #312 where it covers the call.

The check serializes the compiled recipe and the module graph once each.
It measures the rest of each envelope with `null` in their places, and adds the two member counts to both envelopes.
The recipe types hold no numbers, so this count equals the byte length of the `jsonText` frame.
Each check counts afresh, also after the evidence fallback of #312 replaces the reuse evidence.
Tests use string escapes, control characters, multibyte and lone-surrogate text, and an omitted optional member.
Tests take the expected count from the transport encoder and exercise rejection at the exact limit and one byte below it.
Item 2 leaves the second encoding pass of the transport to a follow-up item.

### 3. Share consumer bytes within one call

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `packages/mokly/src/sidecar/bundle.ts` and `plugins.ts`.
- **Background:** A bundle first attempts native resolution. It can then compile with a resolution plan or the full resolver. #312 gives all attempts of one call one capture state, and a `full` call one evidence owner.
- **Problem:** Each attempt has a new file map and reads every shared file again.
- **Impact if no action:** A second attempt repeats the same input reads.
- **Root question:** How can one bundle call read each consumer file only once, while its recipe records only the final compile's inputs?
- **Options:**
  - **A.** Share one read map within each `bundle()` call, in the per-call capture state that both capture modes create. Each attempt keeps its own loaded-file and CSS-module records. Effort: Small.
  - **B.** Retain the complete native input map as the final records. This includes files the final attempt did not consume. Effort: Small.
  - **C.** Reuse an esbuild context within the call. This adds context lifetime handling and does not remove all JavaScript work. Effort: Medium.
- **Left out:** B fails the final-input requirement through the CSS-module records and the guard against unrecorded bytes. A native-only JavaScript record alone reaches no result field. One map that serves as both the bytes and the final records is worse than A on every point. A cache across calls breaks the task constraints. Re-reading files misses the goal. A shared `ModulePaths` would also share its dependency-usage records, which feed the final recipe.
- **Wider fix:** A. Separate byte reuse from final-attempt records at the existing boundary.
- **Previous examples:** Existing bundle snapshot tests require digests of the bytes actually compiled.
- **Recommendation:** A. It removes duplicate reads while keeping final-attempt records precise.
- **Action:** Apply A. This is the performance orchestrator's call of 2026-11-18, under the delegated speed and reliability work.

The map holds the consumer JavaScript, loader asset, and CSS bytes that the call read.
Only successful reads enter it.
A later attempt compiles the bytes that the first read of the call returned.
A file removed between attempts therefore compiles from that first read, and the watcher bundles again.
A call that starts with a planned attempt reads through the same map.
A direct `bundleWith()` call owns a fresh map.
Neither the returned generation nor a module-global object retains the map.

Replaced ways:

- Consumer callback reads become synchronous reads. Consumers: the `file` namespace loader, `tests/sidecar_source_reads.test.ts`, and the read interception of `tests/sidecar_bundle_snapshot.test.ts`. Move all three in Milestone 2.
- Envelope texts for sizing become member counts. Consumers: `checkRecipeSize`, and the frame-bound fallback test of `tests/sidecar_reuse_capture.test.ts`, whose `Buffer.byteLength` double recognized only complete envelope texts. Move both in Milestone 2. The test keeps every assertion, and its double recognizes the compiled member text.
- Independent attempt reads become per-call byte reuse. Consumers: the native, planned, and full attempts. Replace them in Milestone 2.

## Milestone 1: Contract and options check

Depends on: none

The observable contract stays the same, so protocol edits are not required.

- [x] Check the design against `e60c16532`, the sidecar protocol, and current callers.
- [x] Run a fresh read-only second-pass options check. Merge its result here before the plan commit.
- [x] Validate Markdown, audit deletions, commit the plan, and push it.

Evidence: `.context/sidecar-bundle-javascript-work/options-check.md`.

## Milestone 2: Local implementation and regression checks

Depends on: 1

- [x] Delegate implementation and tests to the `non-ui implementor`.
- [x] Prove new read-reuse and size-count behaviour red first.
- [x] Keep every existing assertion when moving the read interceptions.
- [ ] Prove missing and unreadable files keep their whole diagnostic text against the saved `main` package, also at stack limits 2 and 3 with several failing loads.
- [x] Prove final records exclude a CSS module that only the native attempt loaded, and use compiled bytes.
- [ ] Compare `main` and branch compiled output and input bytes for native, planned, and full paths.
- [x] Update the `bundle.ts` entry of the package README for the per-call reads.
- [x] Run existing sidecar tests and repeat each new asynchronous test ten times.
- [x] Check the combined change against the design and repository rules.

Evidence belongs under `.context/sidecar-bundle-javascript-work/`.

## Milestone 3: Measurements, gate, review, and pull request

Depends on: 2

- [ ] Run the targeted checks and the early repository suite with the required tool versions.
- [ ] Commit with Conventional Commits and push. Send the implementation SHA to the performance orchestrator immediately.
- [ ] Measure `main` and branch Serve edit cycles on `examples/basic` and the default large HTML and React fixtures.
- [ ] Record `sidecar.bundle`, edit-to-Changes readiness, and peak memory. Measure one cold-cache start if the machine allows it.
- [ ] Run the complete gate with the required tool versions.
- [ ] Review the complete diff against `origin/main` with the `implementation-review` skill after the push. Fix confirmed fix-now findings, record follow-ups, and re-review once.
- [ ] Delete this plan under the `plans` skill after all preceding work completes.
- [ ] Open the pull request into `main`. Keep the dated decisions and plan permalink in its description. Wait for final CI and send the report. Do not merge.
