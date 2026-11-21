# Render store reads during index maintenance

Status: Active. On branch `calummoore/mokly-render-store-read-lock-rofg`, no pull request yet. The pull request that completes this work deletes this plan.

An ordinary render-store read can miss when another thread holds the index
mutex. This includes another ordinary read. The store then renders a document
that it already holds. This change separates the published read index from
maintenance ownership. It preserves complete-document validation and keeps
reads independent of a writer's disk work.

The user authorized planning, mechanism selection, implementation, local
proofs, review, and a pull request on 2026-11-20. The performance orchestrator
owns the cloud measurements, memory acceptance, and every merge. This
workspace must not merge the pull request.

The performance orchestrator accepted option C and the protocol amendment on
2026-11-21. Reads take no index lock. Existing disk stripe locks and brief
bookkeeping locks retain their rules. The orchestrator also requested the
large React index size, copies per update, and snapshot memory cost.

Contract owners:

- [Render store](../docs/protocol/mokly-render-store.md).
- [Common cache rules](../docs/protocol/mokly-base-cache.md).
- [Compare crate](../crates/mokly-compare/README.md).

## Design call 1: Reads during maintenance

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `crates/mokly-compare/src/render_store_read.rs`.
- **Terms:**
  - **Render store:** The durable cache of complete rendered documents across Serve restarts.
  - **Published index:** The complete mapping from document keys to validated segment positions that ordinary readers can see.
  - **Segment:** One durable cache entry that contains a bounded batch of documents.
- **Background:** Serve looks up each document before it renders that document. The current index mutex also protects startup, writer inspection, and replacement adoption.
- **Problem:** An ordinary read uses `try_lock` on that exclusive mutex. Contention returns a counted miss before any segment read.
- **Impact if no action:** Unchanged restarts render some stored documents again. Concurrent capture increases the opportunity for these false misses.
- **Root question:** How can an ordinary read always see a complete published index without waiting for another operation's segment IO or write?
- **Options:**
  - **A.** Use a shared read-write lock. It removes reader collisions, but a writer can still force a miss or block a read. Effort: Small.
  - **B.** Wait for the current mutex for a fixed bound. Contention can still exceed that bound, and its owner can perform segment IO. Effort: Small.
  - **C.** Publish immutable index snapshots with an atomic pointer. Keep one exclusive nonblocking maintenance owner for startup, writes, and adoption. Readers use the last complete snapshot. Effort: Medium.
  - **D.** Publish a persistent tree or segmented immutable index. It reduces metadata copying, but adds a larger index abstraction. Effort: Medium.
  - **E.** Separate maintenance from an in-memory read-write lock. Readers wait only for index changes, including a preempted updater. No map copy or dependency. Effort: Small.
  - **F.** Use a lock-free concurrent map with ordered maintenance. It avoids full map copies, but memory reclamation and table growth make memory less predictable. Effort: Medium.
- **Left out:** No change fails the requested hit guarantee. Options A and B alone cannot satisfy both guaranteed index access and no writer wait.
- **Wider fix:** C separates read visibility from maintenance ownership for every ordinary indexed read.
- **Previous examples:** PR #394 introduced the shared exclusive mutex and the explicit held-lock miss rule. The task supplies the concurrent-read failures.
- **Recommendation:** C, retained after the fresh options check. An ordinary read never needs an index or maintenance lock, even while maintenance performs disk IO. E is a fallback if measured snapshot memory fails acceptance.
- **Action:** Design call by the workspace orchestrator, 2026-11-21. The user's task authorizes this mechanism choice and the replacement of the held-index-lock miss rule.

Shared assumptions come from the task and the render-store protocol: preserve
keys, build identity, complete records, eviction, damage handling, leases,
receipts, the 128 MiB disk bound, and nonblocking store maintenance. The task
also requires memory within 2% of main. The existing code and compare README
bound the index at 16,384 keys. This implementation bound stays unchanged.

The fresh options check added E and F on 2026-11-21. It retained C because
read visibility no longer depends on any index lock. Its full report is
`.context/render-store-read-lock/options-check.md`.

The no-wait requirement covers another operation's segment IO and durable
write. Existing brief fault and counter bookkeeping locks stay. Ordinary
reads take no index lock. Common disk stripe locks still use one nonblocking
attempt. A held disk stripe can therefore cause a miss under the existing
common cache rules. This task changes only contention on the process index.

The no-index-lock rule covers the ordinary lookup. Replacement adoption
remains an optional nonblocking maintenance update under the same owner.
This wording follows the accepted requirement to keep adoption excluded
from startup and writer inspection.

### Original reason and preserved property

The protocol of PR #394 explicitly made a held lock a miss. Its writes and
reads must never hold up a render or publication. The mutex owners can read
segments and inspect durable publications. Replacing `try_lock` with an
unbounded blocking lock would therefore restore hits at the cost of that
property. The published snapshot lets a reader proceed while those owners
remain excluded from one another.

### Chosen structure

Use an atomic shared snapshot of the optional bounded document map. Retain a
separate nonblocking maintenance mutex. Startup builds its map privately and
publishes only a complete map. Writes inspect the completed publication before
they publish a new map. Adoption publishes validated replacement positions
under the same maintenance owner. A failed maintenance acquisition keeps its
current skip behavior.

Adoption updates the indexed positions of a validated replaced segment in one
snapshot copy. It does not overwrite positions that now name another segment.
The writer can still skip indexing a new batch while adoption owns
maintenance, as it can today. This existing optional maintenance behavior
stays outside the ordinary-read acquisition fix.

An ordinary read retains only its selected position before segment IO. It
does not retain a full map for the IO duration. The lease, publication token,
header digest, payload digest, requested key, and document decoding checks
remain in force. An old position can therefore give the exact requested
document or a miss, never a torn record. Snapshots hold metadata only. They
hold no rendered document outside the render cache.

Use the established atomic shared-pointer crate rather than new unsafe code.
The implementation must release its snapshot guard before it reads a segment.
Measure metadata copying and process memory rather than assuming that they
fit the acceptance bound.

Replaced ways:

- Exclusive `try_lock` for ordinary index reads becomes an immutable published
  snapshot. Consumers: ordinary reads, startup, writer publication, replacement
  adoption, and source-adjacent tests that inspect the index. Move all consumers
  in Milestone 2. Remove the old read acquisition in the same milestone.
- The held-index-lock miss sentence becomes a no-maintenance-miss requirement.
  The common disk-lock, fault, preparation, and eviction rules remain in force.

## Milestone 1: Documentation and protocol

Depends on: none

- [x] Complete the fresh Opus options check and record its result here.
- [x] Send the concrete protocol amendment to the performance orchestrator.
- [x] Update the Reads requirement: index maintenance never causes an ordinary
      indexed read to miss. Preserve no wait for a store write or segment IO.
- [x] Clarify that normal held-lock events still cover disk locks and optional
      maintenance. Keep all other store contracts.
- [x] Check the compare README for useful changed entry points.

Evidence: `.context/render-store-read-lock/docs-milestone-1-report.md`.

## Milestone 2: Regression and index publication

Depends on: 1

- [x] Add a deterministic regression with concurrent ordinary reads while
      another thread holds the maintenance mutex. Observe assertion failure
      against the old implementation before any production change.
- [x] Implement immutable index publication with mutually exclusive startup,
      writes, and replacement adoption. Move every index consumer.
- [x] Preserve complete-document, replacement, damage, index-cap, and startup
      behavior. Add a focused case only where existing tests leave a gap.
- [x] Run the targeted compare tests and Clippy. Run each new concurrent test
      ten times. Record assertion-red output and the test cost under `.context/`.

Evidence: `.context/render-store-read-lock/implementation-report.md`.

## Milestone 3: Local proofs and measurement handoff

Depends on: 2

- [ ] Save the main binary and generate full HTML and React large fixtures.
- [ ] Measure warm unchanged store hits and misses on examples/basic and the
      5,850-document React fixture before and after. Use separate stable caches
      outside `/tmp`, identical source trees, and a completed writer drain.
- [ ] Report the large React index size, snapshot copies per update, and the
      memory cost of those copies. Distinguish measured allocations from
      estimates and from the parent's complete-process memory measurement.
- [ ] Verify one snapshot per completed writer batch or flush, never per key.
      Compare the large React cold seed on main and the candidate: writer CPU,
      session CPU, peak RSS, writes, and drops. Report populated-block misses
      against newly durable keys in both arms. The performance orchestrator
      requested these checks on 2026-11-21.
- [ ] Prove strict byte equality on examples/basic, large HTML, large React,
      and mokly-cloud. Compare every relative file and raw byte without
      normalization. Save manifests, document keys, and a summary.
- [ ] Send the measurement SHA and local evidence to the performance
      orchestrator. Record its cloud hit counters, first Changes, edit, and
      memory acceptance when supplied.

## Milestone 4: Verification, review, and pull request

Depends on: 1, 2, 3

- [ ] Run the repository suite and complete gate from `AGENTS.md`. Check disk
      and memory before each large Cargo build. Run one heavy job at a time.
- [ ] Commit with Conventional Commits and push the workspace branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Check each finding, apply
      its fix rule, and re-review the fixes. Save reports under `.context/`.
- [ ] Wait for CI with the shared `scripts/ci-wait.sh`. Fix branch-caused
      failures. Rerun unrelated Site Lighthouse at most once and record it.
- [ ] Delete this plan when the `plans` skill permits. Keep its dated record
      and a permalink in the pull request description.
- [ ] Open the pull request into `main`. Send its link and final SHA to the
      performance orchestrator. Leave it open and do not merge it.
