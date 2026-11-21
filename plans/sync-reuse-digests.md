# Synchronous bundle reuse reads

Status: Active. On branch `calummoore/mokly-sync-reuse-digests-8fcm`, no pull request yet. The completing pull request deletes this plan.

The Node sidecar checks a stored compilation before it reuses it. Per-file
asynchronous filesystem calls cost time on warm Serve restarts and edits.
Use synchronous file reads and directory lists with cooperative event-loop
yields. Keep all reuse results, evidence, identities, and publication bytes.

The task message of 2026-11-20 authorizes this plan and its implementation.
The performance orchestrator owns the six interleaved cloud measurements,
the ten-edit memory measurements, and the merge. This branch never merges.

Contract owners:

- [Compiled recipes](../docs/protocol/mokly-sidecar-recipes.md).
- [Sidecar README](../packages/mokly/src/sidecar/README.md).
- [Developer tests](../docs/protocol/developer-test-commands.md).
- [Large fixtures](../tests/fixtures/large/README.md).

Replaced ways:

- Per-file asynchronous open, stat, stream, and close become bounded
  synchronous operations. Reuse overlaps only the first read, under the
  later cold-read instruction. Consumers: reuse, metadata capture, and
  toolchain identity. Milestones 2 and 3 replace the old operations.
- Asynchronous directory iteration becomes `readdirSync` with typed entries.
  Consumers: reuse, resolution metadata capture, and toolchain inventory.
  Milestone 2 replaces it.

## Design

The task fixes the read flags as `O_RDONLY | O_NONBLOCK`, the regular-file
check, the 64 KiB buffer bound, the missing-file results, and error handling.
It fixes the directory filter, byte limit, sort, and missing-directory results.
It also fixes candidate order and the order of digests, lists, and evidence.
`currentEvidence` stays unchanged. No absent path comes from a directory list.

### 1. Read inputs faster without starving requests

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `packages/mokly/src/sidecar/file-digests.ts` and `resolution-inputs.ts`.
- **Background:** The sidecar proves a compilation current before it reuses it. It also digests installed program files once per process.
- **Problem:** Several asynchronous filesystem calls per input add overhead. Fully synchronous loops can delay event-loop callbacks.
- **Impact if no action:** Warm restarts keep the measured digest cost. Long synchronous loops can delay lifecycle callbacks.
- **Root question:** How can exact reuse, metadata, and toolchain reads finish sooner in short event-loop slices?
- **Options:**
  - **A.** Keep asynchronous signatures and use synchronous filesystem bodies. Share a cooperative yield budget across loops and file chunks. Effort: Medium.
  - **B.** Add synchronous digest and directory APIs. Move all internal consumers to batched coordinators with cooperative yields. More caller edits increase conflicts. Effort: Medium.
  - **C.** Move synchronous checks into a worker. This adds request and worker lifetimes for a small read change. Effort: Large.
- **Left out:** Unchanged asynchronous reads miss the speed goal. Whole-file reads break the memory bound. Directory-derived absence breaks exactness. Fully synchronous loops break the slice target. Stamp shortcuts break exact byte checks. Earlier checks change scheduling and can miss a later edit. Checks in Rust change the fixed protocol. D, the check's batched `opendirSync` reader, conflicts with the user's explicit `readdirSync` instruction.
- **Wider fix:** A. One cooperative yield mechanism serves all converted read loops.
- **Previous examples:** The existing evidence reader already uses synchronous bounded reads.
- **Recommendation:** A. It keeps callers small and allows large files to yield between fixed-size chunks.
- **Action:** Apply A as my design call, dated 2026-11-20, within the task's design calls.

The fresh options check confirms A after its amendment. Its first report
recommended D without the user's exact directory-reader instruction. The
amendment withdraws D. No user or protocol decision remains.

Shared assumptions come from the task: bytes and errors stay exact, memory
stays bounded, and synchronous slices target at most about 10 ms. Use a
smaller internal budget and measure actual slices. A synchronous OS call or
the unchanged evidence phase can exceed a cooperative budget. Record both.
One `readdirSync` call allocates the listing before the byte limit applies.
Its byte accounting and limit error stay unchanged. Protocol requests stay
serial, so the slice target does not bound the next request's latency.
Keep `metadataDigest` reuse of supplied bytes and consumed digests exact.
Audit toolchain inventory and capture callers for the same pattern. Convert
only equivalent reads and keep shared-file edits small.

### 2. Keep cold checks fast

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `packages/mokly/src/sidecar/file-digests.ts` and `compiled.ts`.
- **Background:** Cold operating-system caches make synchronous reads wait for disk one file at a time. The user's later instruction requires read parallelism if that check becomes slower.
- **Problem:** Three interleaved cold rounds gave medians of 193 ms for main and 359 ms for synchronous reads. Hot medians were 88 ms and 20 ms.
- **Impact if no action:** A cold check loses read overlap and violates the added requirement.
- **Root question:** How can the file phase retain main's cold read overlap and most of the synchronous hot gain?
- **Options:**
  - **A.** Start each digest with one asynchronous 64 KiB read. Keep synchronous open, stat, remaining reads, and close. Metadata and toolchain reads also pay the asynchronous turn. Effort: Small.
  - **B.** Use A only for reuse checks. Keep fully synchronous metadata and toolchain digests. Give the four reuse workers separate reusable 64 KiB buffers. Effort: Medium.
  - **C.** Use asynchronous bounded reads throughout each reuse digest. Large cold files retain overlap for every chunk. Scratch runs cost more for these inputs. Effort: Medium.
  - **D.** Run synchronous readers in worker threads. Threads add startup cost and memory against the two-percent limit. Effort: Large.
  - **E.** Overlap each full-size chunk until a short read, then read synchronously to EOF. Large cold files retain overlap. The sample has only two such files. Effort: Small.
  - **F.** Start synchronously and switch to overlap after a slow read. This keeps the best hot time but adds a machine-dependent threshold. Effort: Medium.
- **Left out:** Full synchronous reuse fails the conditional cold-read requirement. Stat shortcuts and directory-derived absence change exactness. The original asynchronous reader loses on every measured point. Asynchronous directory reads conflict with the fixed `readdirSync` requirement.
- **Wider fix:** B. The digest owner keeps exact hashing and error handling shared across both read strategies.
- **Previous examples:** The original four-worker reader overlaps disk reads. The first implementation retained workers but removed that overlap.
- **Recommendation:** B. It preserves the measured cold benefit of the first-read overlap and keeps capture and toolchain reads fast.
- **Action:** Apply B as my design call, dated 2026-11-20, under the user's conditional parallelism instruction.

All options keep exact digests, missing-file results, errors, FIFO rejection,
bounded buffers, check order, evidence, and protocol. Their source is the
task message and its cold-read addition. The original all-synchronous reuse
body is superseded only where read overlap requires it. A first asynchronous
read does not end at the stat size. Every reader continues to actual EOF.
Scratch comparisons of main, full sync, all asynchronous reads, and one
asynchronous first read checked every input exactly. The first-read reader
gave the best observed cold and hot balance. A fresh options check reviews
this call before the product revision.

The fresh check confirms B with buffers owned by the digest module for
each check. Every read uses a null position, so it advances the handle's
offset. The default digest stays synchronous. E lacks relevant measurement
evidence, and F risks the cold-read condition on other storage. The directory
reader stays fixed. No user or protocol decision remains.

Evidence: `.context/sync-reuse-digests/candidate-digest-report.md`.
Options: `.context/sync-reuse-digests/overlap-options-check.md`.

## Milestone 1: Contract and documentation audit

Depends on: none

- [x] Confirm the existing protocol covers the unchanged results.
- [x] Update the sidecar README for the changed read mechanics.
- [x] Run the fresh options check and record its result.

Evidence: `.context/sync-reuse-digests/options-check.md`.

## Milestone 2: Red tests and bounded synchronous reads

Depends on: 1

- [x] Write and run red tests before implementation.
- [x] Cover FIFO nonblocking rejection, missing input, directory rejection,
      large-file digest correctness, bounded buffer, and unchanged error propagation.
- [x] Cover event-loop progress with event order, not elapsed-time assertions.
- [x] Confirm reuse returns the same generation and rejects a changed input.
- [x] Implement synchronous digest and directory bodies with cooperative yields.
- [x] Audit metadata and toolchain capture paths and convert equivalent operations.
- [x] Run targeted tests and repeat each new asynchronous test ten times.

Evidence: `.context/sync-reuse-digests/implementation-report.md`.

## Milestone 3: Measurements and complete verification

Depends on: 2

- [x] Review the revised overlap options and record the result.
- [x] Write red overlap tests without weakening the existing assertions.
- [x] Implement the selected overlap path with reusable worker buffers.
- [x] Rerun targeted checks and ten repeats for new asynchronous tests.
- [ ] Record reuse and slice times locally.
- [ ] Compare whole cold-page-cache reuse checks with the four-worker baseline.
      Record file and directory phases apart. Keep the fixed directory reader.
- [ ] Measure warm restarts on the basic and large React catalogues.
- [ ] Compare edit `sidecar.bundle.resolution` and bundle-start to
      `sidecar.bundle.compile` start for main and branch.
- [ ] Compare edit compile times and explain any measured difference.
- [ ] Prove exact published bytes on basic, large HTML, large React, and cloud.
- [ ] Run the repository suite and the complete gate.
- [ ] Send the implementation SHA to the performance orchestrator for cloud
      warm restart, edit, and memory measurements.

Evidence: `.context/sync-reuse-digests/ledger.md` links the proof and measurement files.

## Milestone 4: Commit, review, and pull request

Depends on: 3

- [ ] Commit with Conventional Commits and push this branch.
- [ ] Review the complete diff against `origin/main` with `implementation-review`.
      Check findings, apply the fix rule, and run the required review fix rounds.
- [ ] Delete this plan after all required work and review rounds finish.
- [ ] Open the pull request into `main`. Watch final required CI with
      `scripts/ci-wait.sh`, fix branch-caused failures, and report its link and SHA.
