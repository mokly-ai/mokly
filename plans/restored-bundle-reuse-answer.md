# Return a reference after restored bundle reuse

Status: Active. On branch `calummoore/mokly-restored-bundle-reuse-answer-pspj`, no pull request yet. The pull request that completes this work deletes this plan. The design awaits the user's answer before implementation.

Mokly's core restores a stored JavaScript compilation into a Node sidecar.
The next bundle request checks its inputs and can reuse that compilation.
The sidecar then sends the same large recipe and module graph back to the core.
This change removes that return transfer for a proven restored reuse.

The performance orchestrator owns official measurements and every merge.
This branch targets `origin/main`. Its initial measurement base is `beb87a53a`.
It integrated `793d0c77d` before implementation with a fast-forward merge.
The requested fixture is `mokly-cloud` at `194fdb78`, with its own installation
of this branch's release core and built Mokly packages.

Contract owners:

- [Render sidecar](../docs/protocol/mokly-sidecar.md).
- [Compiled recipes and release](../docs/protocol/mokly-sidecar-recipes.md).
- [Base preparation cache](../docs/protocol/mokly-base-cache.md).
- The [Rust sidecar README](../crates/mokly-sidecar/README.md).
- The [Node sidecar README](../packages/mokly/src/sidecar/README.md).
- The [comparison README](../crates/mokly-compare/README.md).

## Acceptance

- A warm unchanged `mokly-cloud` restart reaches `serve.ready` at least 100 ms sooner.
- First Changes and edits do not become slower in interleaved means against main.
- Published bytes, warnings, and diagnostics stay equal on cloud, basic, large HTML, and large React fixtures.
- Whole-tree memory peaks stay within 2% of main for warm restarts and cold ten-edit sessions.
- Targeted tests, the repository suite, the complete gate, review rounds, and Required CI pass.
- The pull request opens into `main`. The performance orchestrator merges it.

## Design decision

### 1. Avoid returning the restored compilation

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `packages/mokly/src/sidecar/session.ts`, `packages/mokly/src/sidecar/compiled.ts`, and `crates/mokly-sidecar/src/client.rs`.
- **Terms:**
  - **Core:** Mokly's Rust process, which owns catalogue state and caches.
  - **Sidecar:** The Node process that bundles and evaluates JavaScript.
  - **Recipe:** The immutable compilation and ordered module graph that the core can restore.
  - **Restore:** A successful `restoreGeneration` request that installs a named recipe in one sidecar process.
- **Background:** A stored recipe already belongs to the core when it sends a restore. The sidecar checks current inputs before reuse. It then returns the same recipe in a large bundle response.
- **Problem:** Repeated recipe encoding, transfer, and decoding delay warm readiness. The response returns data that the core already owns.
- **Impact if no action:** Warm restarts keep this redundant work. The requested 100 ms gain remains unproved.
- **Root question:** How can warm restarts skip repeated compilation data with equal output, rejections, recovery, and memory, without slower first Changes or edits?
- **Options:**
  - **A.** Return a typed reference to the successful restore, plus the new generation id. Mirror loaded origins in the client. Share restored module graphs through `Arc`. Keep full answers for fresh compiles, sidecar-compiled reuse, and size-check changes. Effort: Medium.
  - **B.** Keep full answers and encode the shared members more cheaply. This keeps their transfer and core decode costs. It overlaps the separate bundle-tail work. Effort: Medium.
  - **C.** Move stored-input validation into the core and avoid the bundle exchange. Restore on demand for evaluation. This needs a wider proof of validation and lifecycle behavior. Effort: Large.
  - **D.** Limit the reference to restores named by one bundle request. Keep their rebuild data with that request. This avoids a registry, but adds request hints and pool plumbing. A reuse of an earlier rendering restore keeps its full reply. Effort: Medium.
- **Left out:** Change nothing fails the speed goal. Compression alone keeps JSON encoding and decoding, while the measured pipe write is too small to supply 100 ms. Removing the frame check breaks rejection rules. Runtime-key lookup still needs A's exact index. Combining restore and reuse validation changes damaged-entry rules.
- **Wider fix:** A. A typed reference represents data already owned by both processes. It avoids another recipe copy for every restored reuse.
- **Previous examples:** `plans/follow-ups/bundle-response-single-encoding.md` records repeated recipe encoding. `plans/follow-ups/bundle-cache-request-cost.md` records unprofiled cache-path costs. Commit `a16a623e6` classifies reuse from observed compiles.
- **Recommendation:** A, with the loaded-origin mirror and shared graph. The final options check returns to the initial A after considering D. A keeps the existing request shape and covers every restored compilation without graph copies.
- **Action:** ask the user, because the user requested the design before implementation and must choose the protocol change.

All options share the task's output, warning, diagnostic, frame-limit, and
memory requirements. The sidecar remains responsible for the reuse proof in
A, B, and D. C drops that implementation assumption. The current protocol states
that every bundle result carries a recipe. The user permits a protocol change
when output and rejection rules stay equal.

The fresh options check added D on 2026-11-21. It first preferred D to avoid
copies made by A's original registry. Its final follow-up preferred A after
the origin mirror and shared graph removed those costs and lifecycle gaps.
Reports: `.context/restored-bundle-reuse/options-check-report.md` and
`options-check-followup.md` beside it.

## Proposed protocol and field proof

The full result keeps its current shape. The short result is
`{ generation, restoredGeneration }`. Rust owns both wire forms and generates
the TypeScript declarations. The new generation id can differ from the restore
id because evaluation settings can differ. The restore id identifies the
actual candidate that passed the reuse proof.

| Full result member              | Exact source after restored reuse                                        |
| ------------------------------- | ------------------------------------------------------------------------ |
| `generation`                    | Carry the sidecar's new id in the short result.                          |
| `compiled`                      | Share the exact `CompiledGeneration` from the named restore.             |
| `modules`                       | Reuse that restore's ordered graph, digests, and import lists.           |
| `unmappedDependencyDirectories` | Use the restored compilation's value, or an explicit empty list.         |
| `plan`                          | Absent from sidecar reuse. Keep the pool's existing disk-plan injection. |
| `epoch`                         | Keep the pool's existing allocation after reconstruction.                |
| `cache`                         | Keep the pool's runtime-key and operation-count classification.          |
| `compile_count`                 | Keep the worker's observed esbuild count.                                |

The last three members never cross the wire. Compilation and graph values
contain strings, booleans, nulls, lists, and maps. Their JSON round trip loses
no data. The client reconstructs the result before the worker and pool process
the bundle. No output field or reuse evidence is
recomputed from current files. The existing input proof still runs in full.

The sidecar records restore provenance separately from compiled code. Only an
installed restore can supply a short result. Fresh compiles and reuse of code
compiled by that sidecar keep full results. A new lifetime does not acquire
restore provenance merely because it shares code. Two installed restores
remain distinct, and each result names the one actually used.

The core mirrors each loaded id as `Compiled` or `Restored` in the client.
Only `Restored` retains rebuild data. Compiled data shares its existing `Arc`.
The module graph shares an `Arc` with the pool and the restore request.
Successful restores of absent ids install `Restored`. A restore of any loaded
id changes nothing, including an id installed by a bundle.
Each successful bundle reply resolves its restore reference before replacing
its returned id with `Compiled`. The two ids can be equal.
A successful dispose removes its id. Failed requests change no record.
Process loss drops all records. Direct pool shutdown can bypass the client,
so those records end with the process and client rather than a shutdown reply.
A reference to an unknown restore is malformed private protocol traffic.
It keeps the existing protocol fault class and process replacement path.

Evidence: `.context/restored-bundle-reuse/field-proof.md`.

## Design calls

- **Agent call, 2026-11-21:** Keep the full recipe-size check before selecting
  the short form. A restore alone does not prove both later full envelopes fit.
  The response repeats unmapped directories, and evaluation settings can grow.
  The check can replace reuse evidence or raise the current size diagnostic.
  Return the full result if it changes evidence. This preserves every limit
  rejection and evidence reduction without a second size policy.
- **Agent call, 2026-11-21:** Keep registry lifetime equal to the corresponding
  sidecar's loaded origins. Share compilation and module-graph storage rather
  than create a second recipe cache. Keep only an origin marker for bundle
  lifetimes. This removes copies from render replays and warm-ups too.
- **Agent call, 2026-11-21:** Decode both result forms in one pass over typed
  fields. Do not derive an internally tagged or untagged serde decoder that
  buffers every full result. Keep the existing exceptional decode fallback.
  Full answers and edits must not pay another generic-tree allocation.
- **Agent call, 2026-11-21:** Evaluate the small cache-reader cut in the same
  path. Keep its header gate, hash pass, seek, and bounded second read.
  Decode the second read with `serde_json::from_slice` instead of `from_reader`.
  Keep IO and data fault classes, including their precedence in a combined
  fault. The options check found that plain buffering can change the private
  cause, although both causes have equal public effects. Keep the stricter
  fault requirement from the task. Do not combine the hash pass and decode.
  Retain the cut only when fault, timing, and memory evidence support it.
- **Agent call, 2026-11-21:** Keep sidecar edits in reuse provenance and request
  dispatch. The separate bundle-tail workspace owns recipe-size and transport
  encoding. Keep PostCSS preparation and Serve scheduling outside this change.

## Milestone 1: Documentation and protocol

Depends on: none

State the approved wire contract and its preservation requirements.

- [ ] Record the user's answer and the options-check result.
- [ ] Update both sidecar protocol pages with the short form and size rules.
- [ ] Keep protocol pages within their caps. Preserve existing rules and links.
- [ ] Update the affected area READMEs with current entry points and behavior.

## Milestone 2: Restored reuse response

Depends on: 1

Implement the typed response and exact client reconstruction as one working change.

- [ ] Add red boundary tests for the short form and exact reconstruction.
- [ ] Cover stored head and base reuse, equal state, output, and warnings.
- [ ] Cover changed inputs and the unchanged full fresh answer.
- [ ] Cover damaged entries, crash recovery, and stop during reuse.
- [ ] Cover two restores, each reused correctly, duplicate ids, and disposal.
- [ ] Cover frame-limit evidence reduction and the full-answer fallback.
- [ ] Add restore provenance and the short response without changing the reuse proof.
- [ ] Share the pool and restore module graph through `Arc`, with unchanged serialized data.
- [ ] Add the process-local loaded-origin mirror and exact reconstruction before replacement.
- [ ] Decode full and short replies without an extra tree or parse pass on full results.
- [ ] Keep the full wire result for fresh compiles and sidecar-compiled reuse.
- [ ] Regenerate shared types with `cargo xtask generate-types`.
- [ ] Run focused Node, client, pool, and real-sidecar integration tests.
- [ ] Run each new asynchronous test ten times and record its red failure and cost.

## Milestone 3: Bounded cache payload decoding

Depends on: 2

Evaluate the smaller cache-reader cut without changing cache semantics.

- [ ] Confirm the hot caller in `bundle_codec_read.rs` with local evidence.
- [ ] Use a bounded temporary byte buffer for the existing second read.
- [ ] Keep all fault classes, version gates, digests, size limits, and cache bytes.
- [ ] Run existing codec fault and real bundle-store integration tests.
- [ ] Compare timing and memory. Keep the cut only when it meets acceptance.

## Milestone 4: Verification and performance evidence

Depends on: 2, 3

Prove preservation and supply a measured branch to the performance orchestrator.

- [ ] Run targeted tests, the repository suite, and the complete `cargo xtask check` gate.
- [ ] Smoke-test cloud and basic with this branch's release core and dist.
- [ ] Ask the performance orchestrator for workspace 206's four-fixture proof helper.
- [ ] Compare local warm restarts, first Changes, and edits in interleaved rounds against main.
- [ ] Prove exact published bytes, Changes state, warnings, and diagnostics on all four fixtures.
- [ ] Check local whole-tree memory for warm restarts and cold ten-edit sessions.
- [ ] Commit and push. Send the SHA for the official restart and memory pairs.
- [ ] Record the performance orchestrator's acceptance or resolve each regression.

Baseline evidence and setup failures stay under
`.context/restored-bundle-reuse/measurements/` and in `ledger.md` beside it.
No measurement timer or generated build output enters the commit.

## Milestone 5: Review and pull request

Depends on: 4

Finish this branch without merging it.

- [ ] Fetch and merge moved `origin/main` with the `git-merge` preservation audit.
- [ ] Commit with Conventional Commits and push the verified branch.
- [ ] Review the complete diff against `origin/main` with `implementation-review` after the push.
      Check each finding, fix the `fix now` items, record follow-ups, and re-review once.
- [ ] Delete this plan under the `plans` skill after required work and review finish.
- [ ] Open the pull request into `main`. Preserve dated decisions and this plan's permalink in its description.
      Watch `scripts/ci-wait.sh`, fix branch-caused failures, and report the PR and SHA.
      Record an unrelated Site Lighthouse failure without rerunning it. Leave the merge to the performance orchestrator.
