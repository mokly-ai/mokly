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
  synchronous reads. Consumers: reuse, metadata capture, and toolchain identity.
  Milestone 2 replaces the body and removes the old operations.
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

## Milestone 1: Contract and documentation audit

Depends on: none

- [ ] Confirm the existing protocol covers the unchanged results.
- [ ] Update the sidecar README for the changed read mechanics.
- [x] Run the fresh options check and record its result.

Evidence: `.context/sync-reuse-digests/options-check.md`.

## Milestone 2: Red tests and bounded synchronous reads

Depends on: 1

- [ ] Write and run red tests before implementation.
- [ ] Cover FIFO nonblocking rejection, missing input, directory rejection,
      large-file digest correctness, bounded buffer, and unchanged error propagation.
- [ ] Cover event-loop progress with event order, not elapsed-time assertions.
- [ ] Confirm reuse returns the same generation and rejects a changed input.
- [ ] Implement synchronous digest and directory bodies with cooperative yields.
- [ ] Audit metadata and toolchain capture paths and convert equivalent operations.
- [ ] Run targeted tests and repeat each new asynchronous test ten times.

## Milestone 3: Measurements and complete verification

Depends on: 2

- [ ] Record reuse and slice times locally.
- [ ] Measure warm restarts on the basic and large React catalogues.
- [ ] Compare edit `sidecar.bundle.resolution` and bundle-start to
      `sidecar.bundle.compile` start for main and branch.
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
