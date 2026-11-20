# Parallel class-map stylesheet roots

Status: Active. On branch `calummoore/mokly-parallel-class-map-stylesheets-mqju`, no pull request yet.
The pull request that completes the work deletes this plan.

Mokly compiles stylesheet roots before it sends CSS Modules maps to its Node sidecar.
The first loop of `class_maps` compiles those roots in series.
The user requests bounded parallel compilation with equal maps, errors, evidence, cache records, render keys, and published bytes.
The performance parent owns the Mokly Cloud measurements and every merge.

Contract owners:

- [CSS Modules](../docs/protocol/mokly-imported-styles-modules.md).
- [PostCSS](../docs/protocol/mokly-imported-styles-postcss.md).
- [Render store](../docs/protocol/mokly-render-store.md).
- [Timing records](../docs/protocol/mokly-timings.md).
- [Render crate](../crates/mokly-render/README.md).

## Design

User calls, 2026-11-20:

- Change only class-map root scheduling in `mokly-render`.
- Bound concurrency by available parallelism, four, and the number of roots.
- Merge maps and select the first error in root order.
- Keep the uncovered `.module.css` loop and cache rules.
- Keep the timing schema and code. Read-span parentage and running byte totals may follow actual compile overlap.
- Stop before implementation if completion order can change the required results.
- Freeze base `3e09c6150` for the first gate, byte proof, and performance measurements.
- After cloud acceptance, merge `origin/main` once. Rerun the gate. Redo byte proof if stylesheet code changes.
- Open the reviewed PR into `main`. Do not merge the PR.

Design calls, 2026-11-20, checked by the fresh options review:

- Use scoped standard threads in chunks of at most the worker bound. This needs no dependency or persistent pool.
- Keep the one-root path in the calling thread. Empty roots need no threads.
- Keep each worker's tracing dispatcher and parent span from the calling thread.
- Hold indexed results for one chunk. Join the chunk, then record, insert, and deliver in root order.
- Let the current chunk finish after an error. Commit only the successful prefix and start no later chunk.
- Keep threads inside the scope so success, errors, cancellation, and unwind cannot detach them.
- Hold the shared store lock from the eligibility check through the final ordered commit. Keep at most four pending bundles.

Alternatives include a local Rayon pool and the existing graph worker interface.
A local Rayon pool adds a crate dependency for one loop.
The graph interface couples catalogue preparation to graph scheduling and touches the excluded area.
All options assume the thread-safe traits reported by the user.
The current implementation confirms those traits.

## 1. Completion order can change cache records

- **Severity:** High. **Effort:** Medium.
- **Source:** Implementation.
- **Category:** Performance.
- **Location:** `crates/mokly-render/src/stylesheet_cache.rs:193` and `crates/mokly-render/src/stylesheet_store.rs:117`.
- **Terms:**
  - **Stylesheet record:** one cached root bundle with its captured inputs and evidence.
  - **PostCSS context:** one plugin process reused by the roots of a preparation.
- **Background:** Each root compiles through its own recording tree.
  A successful bundle inserts its record into shared and attempt-local stores before it returns.
  Each store has a byte limit.
- **Problem:** An insertion that exceeds the limit clears the store before retaining the new record.
  Parallel completion can therefore change the retained records and later cache misses.
  A PostCSS result also contains cumulative module evidence that depends on request order.
- **Impact if no action:** The requested unconditional cache-record and evidence proof is false.
  Fixture output equality alone cannot prove that invariant.
- **Root question:** Which roots can compile together while the required state equals serial order?
- **Options:**
  - **A.** Limit strict equality to the four acceptance fixtures.
    Permit existing cache retention and cumulative evidence order to vary elsewhere.
    Keep the cache implementation unchanged. Effort: Medium.
  - **B.** Separate parallel compilation from ordered cache delivery and evidence capture.
    Expand the scope to the required cache and PostCSS boundaries. Effort: Large.
  - **C.** Keep serial compilation when these order-sensitive effects can occur.
    Establish which safe cases still meet the performance goal. Effort: Medium.
  - **D.** Compile plain-CSS batches only when both stores are empty, the head store is gone, and keys are unique.
    Hold the shared store lock. Compile bounded chunks, then commit through the serial path's commit function in root order.
    Run every other case serially. Effort: Medium.
- **Left out:** A fails the parent's equality requirement. B's PostCSS part conflicts with the parent's serial PostCSS call.
  C remains D's fallback. Speculative cache lookups can observe different hits or miss reasons after earlier evictions.
  Accepting the risk without a user decision is also excluded.
  The task explicitly requires a stop when these results can change.
- **Wider fix:** D provides the ordering boundary within this scope. PostCSS stays serial.
- **Previous examples:** `plans/follow-ups/postcss-request-order-varies.md` records cumulative evidence and stateful plugin order after parallel graph preparation.
- **Assumptions:** Every option preserves published bytes and render keys on the acceptance fixtures, as the task requires.
  The unconditional evidence and record requirement needs clarification or a wider implementation.
- **Recommendation:** D, changed from C after the options check. It defines a safe case and keeps C as the fallback.
- **Action:** The parent authorized ordered commit and serial PostCSS on 2026-11-20.
  The parent accepted R1 and conditionally accepted R2 on 2026-11-20. The base-selection audit selects R2 option B.

### Residual decisions from the options check

- **R1 = A, accepted 2026-11-20:** Read spans and running byte totals follow the actual overlap. Record changed parentage in the PR.
- **R2 = B, selected 2026-11-20:** Buffer usage per parallel root and replay only the serial prefix, including the failing root's own reads.
- The parent required B if extra failed-root usage can change later base selection. The runtime shares usage across attempts.
- Base dependency selection reads those sets and changes fallback for an unmapped or missing directory. This activates the B condition.
- Keep ordinary serial compilation unchanged. The parallel result retains its usage even when compilation fails.
- Test successful usage equality and failed-attempt prefix usage. Record bounded speculative work in the PR and at ordered commit.
- The options report proves plain compilation reads no cache state created by earlier inserts.
- The report found no protocol requirement for serial roots. No protocol change is needed.
- Exact store retention follows equal record charges, equal insertion order, and the held shared-store lock.
- The raw compiler creates no PostCSS context evidence on the eligible path.
- Successful shared imports incur no extra parse work. Failed chunks can compile up to three extra roots.

Evidence: `.context/parallel-class-map-stylesheets/options-check.md`.

## Milestone 1: Documentation and safety audit

Depends on: none

- [x] Check protocol text for a requirement to compile roots in series.
- [x] Audit captured reads, watch inputs, evidence, cache records, render keys, and published output for completion-order effects.
- [x] Run the fresh read-only options check and incorporate its report.
- [x] Send confirmed order-sensitive evidence and the recommended D path to the performance parent before implementation.
- [x] Resolve residual decisions R1 and R2 before implementation.
- [x] Validate Markdown, commit the plan, and push.

Evidence: `.context/parallel-class-map-stylesheets/`.

## Milestone 2: Red tests and bounded parallel roots

Depends on: Milestone 1

- [x] Delegate implementation to the non-ui implementor after the safety requirement is resolved.
- [x] Write tests first and observe assertion failures.
- [x] Prove root-order merging and first-error selection with reversed completion.
- [x] Prove failed roots return the existing error and no worker outlives the call.
- [x] Cover cancellation and the unchanged uncovered-module rule.
- [x] Prove exact successful dependency usage and failed-root usage prefix with deferred per-root usage.
- [x] Implement bounded root concurrency with tracing context propagation.
- [x] Run targeted tests and each new concurrent test ten times.
- [x] Report extra work for concurrent roots that share an uncached import.
- [x] Add the final shared-cache miss-vector assertions and repeat their focused case ten times.

## Milestone 3: Verification and performance evidence

Depends on: Milestone 2

- [ ] Run the repository suite and complete gate from `AGENTS.md`.
- [ ] Run the strict example build and renderer smoke check.
- [ ] Measure cold and warm `serve.ready` and first Changes on `examples/basic` and the large React fixture.
- [x] Compare every published byte and render key against main on all four fixtures.
- [ ] Send the candidate SHA immediately after the four-fixture proof for the parent's Cloud latency, store-hit, and memory measurements.
      The parent authorized cloud suites to finish while it measures on another machine.

## Milestone 4: Commit, review, and pull request

Depends on: Milestone 3

- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete diff against `origin/main` with the `implementation-review` skill after the push.
      Fix confirmed findings under its two-round rule and record follow-ups.
- [ ] Incorporate the parent's acceptance results before opening the pull request.
- [ ] Merge current `origin/main` once after cloud acceptance. Audit preservation and rerun the complete gate.
- [ ] Redo the byte proof if that merge changes stylesheet code.
- [ ] Delete this plan under the `plans` skill.
- [ ] Open the pull request into `main` with dated decisions and the plan permalink.
      Wait for final CI with `scripts/ci-wait.sh`. Fix branch-caused failures. Do not merge.
