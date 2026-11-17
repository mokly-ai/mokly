# Reuse recent Serve detail publications

Status: Active. On branch `calummoore/mokly-detail-publication-reuse-7lec`, no pull request yet. The completing pull request deletes this plan.

Serve rebuilds, completes usage, and projects Changes after an edit. These
phases repeatedly hash and encode equal details from the same phase of an
earlier edit. Reuse must preserve every published byte, id, and revision.

The user approved planning, delegated implementation, review, and an open
pull request on 2026-11-17. Do not merge the pull request. The performance
orchestrator owns the merge and the final Mokly Cloud measurement.

Contract owners:

- [Canonical publication](../docs/protocol/mokly-catalogue-serialization.md).
- [Serve publication revisions](../docs/protocol/mokly-shell-delivery.md).
- [Background publication](../docs/protocol/mokly-on-demand.md).
- [Server boundary](../crates/mokly-server/README.md).
- [Canonical encoding](../crates/mokly-model/README.md).

## Design and decisions

The performance orchestrator made these calls on 2026-11-17. The user gave
it design authority on 2026-11-16 to improve Changes speed and reliability
without exhausting machine memory.

- Exactness first. Equality proves reuse. Every id, revision, detail file,
  and index byte must equal the existing implementation in every phase.
- Bound memory. Keep shared detail references or a fixed small number of
  versions per path. Never retain an unbounded edit history.

Inspection at `794b30a91` confirms both calls fit. One premise needs a
small correction. `RevisionFile` already separates the top-level revision
from its stored bytes. Delivery inserts the publication's current revision.
Thus equal encoded payloads can safely cross revisions through this type.
Typed details must still receive exactly the existing revision stamps.

### 1. Avoid repeated publication work

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `crates/mokly-server/src/replacement.rs`, `evidence.rs`, `changes.rs`, and `crates/mokly-model/src/canonical.rs`.
- **Terms:** A phase is rebuild, usage completion, or Changes projection. A detail is one published entry record.
- **Background:** Rebuild and usage compare their immediately preceding detail. Changes currently compares nothing, including on status-only publications. Equal records usually exist in that phase of the preceding edit.
- **Problem:** Rebuild and usage cannot find earlier equal phases. Changes hashes and encodes all details, including status-only projections.
- **Impact if no action:** Changes waits for serial work on hundreds of unchanged details.
- **Root question:** How can Serve publish each phase with less work and identical bytes?
- **Options:**
  - **A.** Reuse ids and encoded payloads from a bounded set of equal recent details. Effort: Medium.
  - **B.** Remove the second JSON value conversion in canonical hashing. This alone cannot meet the hash-count goal. Effort: Small.
  - **C.** Build a streaming canonical writer. This alone cannot meet the hash-count goal and adds serializer complexity. Effort: Large.
  - **D.** Combine A and B. Reuse handles unchanged details. Single conversion reduces work on actual misses. Effort: Medium.
  - **E.** Combine A and C. This removes more allocations but expands the canonical writer substantially. Effort: Large.
  - **F.** Retain separate immutable phase projections and compare each new phase with its previous counterpart. This adds phase ownership and invalidation. Effort: Large.
  - **G.** D, and derive each missed file from its canonical hash preimage. Replace the fixed-width top-level zero id after hashing. Reuse revision segmentation. Effort: Medium.
  - **H.** D, and compute remaining misses in parallel, collected in path order. This competes with rendering for cores. Effort: Medium.
- **Left out:** Path-only or phase-only reuse violates exactness. Change nothing misses the goal. Lazy encoding adds GET latency and duplicates serialization for fetched details.
- **Wider fix:** A central recent-detail publication helper used by all three phases prevents inconsistent reuse rules.
- **Previous examples:** The existing previous-snapshot reuse in `replacement.rs` covers adjacent equal publications only.
- **Recommendation:** G, changed from D after the options check. Reuse removes repeated work. One serialization supplies the id and payload for each miss.
- **Action:** fix now, apply G.

Shared assumptions come from the task: all output bytes remain equal, memory
stays bounded, and all three phases participate. No phase label proves equality.
No serializer dependency or public format changes. The explicit task request authorizes committed byte-oracle tests despite the shared testing default for one-time equivalence proofs.

Our call, 2026-11-17: choose G after the options check. It also removes
one serialization on actual misses without introducing a new serializer.
Use a structural top-level slot reader. Never replace a nested id or text.
Keep the public canonical hashing API byte-identical.

### 2. Bound recent versions

- **Severity:** High. **Effort:** Small.
- **Source:** Design.
- **Category:** Performance.
- **Location:** The shared recent-detail state carried by `Snapshot`.
- **Background:** Snapshots hold detail records through shared references. A cache can keep older records alive after their snapshots expire.
- **Problem:** Unbounded retention would accumulate detail payloads during long Serve sessions.
- **Impact if no action:** Repeated edits could exhaust machine memory.
- **Root question:** How can equal phase records remain available with a fixed retention bound?
- **Options:**
  - **A.** Keep at most three distinct recent records per current path, with shared details and encoded byte slices. Prune absent paths. Effort: Small.
  - **B.** Keep only weak references to recent records. This saves retention but cannot guarantee reuse after snapshots expire. Effort: Small.
  - **C.** Add a byte-budgeted eviction cache. This adds accounting and can evict a required phase on a large catalogue. Effort: Medium.
  - **D.** A with least-recently-used eviction. Each hit refreshes recency. Four recurring records can still miss continuously. Effort: Small.
  - **E.** Keep four fixed slots per path: rebuild, usage completion, Changes status, and Changes evidence. Compare all slots by full equality. Replace only the producing kind on a miss. Effort: Small.
  - **F.** Move the bounded store into the publication owner under its build lock. This avoids candidate-history loss but adds shared mutation and pruning. Effort: Medium.
- **Left out:** Keeping all revisions violates the memory constraint. Whole phase projections in decision 1 option F differ from fixed per-kind detail slots.
- **Wider fix:** E. The fixed publication-kind type bounds retention and prevents one kind from evicting another.
- **Previous examples:** Existing immutable snapshot detail references.
- **Recommendation:** E, changed from A after the options check. Extra foreground batches and status updates cannot evict another publication kind.
- **Action:** fix now, apply E.

Shared assumptions: bounded retention is required by the task. The four slots
follow the current publication kinds, including status-only Changes updates. Correctness must hold
with misses, partial completions, more phases, removals, and eviction.

Our call, 2026-11-17: bound each current path to four fixed kind slots after
the options check. Each record
holds shared detail and encoded bytes. The cache must not own old snapshots,
generations, render backends, or history chains. Clone bounded state when
constructing a candidate. A rejected candidate must not change live state.

### 3. Reuse encoded payloads across revisions

- **Severity:** High. **Effort:** Small.
- **Source:** Design.
- **Category:** Product bug.
- **Likelihood:** Common.
- **Location:** `crates/mokly-server/src/revision_file.rs` and publication encoding.
- **Background:** `RevisionFile` stores byte slices around the top-level revision. The response inserts the current publication's revision.
- **Problem:** Reusing a raw file from another revision would publish the wrong revision. Reusing the existing segmented representation avoids that problem.
- **Impact if no action:** Restricting reuse to exact revisions would keep encoding unchanged payloads in each edit.
- **Root question:** How can equal details share bytes while preserving each publication's revision?
- **Options:**
  - **A.** Reuse `RevisionFile` after full equality with id and revision normalized. Preserve revision presence. Take only cached id and bytes. Keep phase-specific typed stamps and retain the live record. Effort: Small.
  - **B.** Reuse a file only when its stored typed revision also matches. This preserves extra encoding work. Effort: Small.
  - **C.** Cache ids only and encode every changed-phase record. This misses the encoding goal. Effort: Small.
- **Left out:** Raw revision-bearing byte reuse violates exactness. Adding another revision template duplicates `RevisionFile`.
- **Wider fix:** A. Existing segmented delivery is the shared structural rule.
- **Previous examples:** `RevisionFile::response` already supplies the current revision to every detail response.
- **Recommendation:** A. Existing delivery supports exact reuse without a new format or representation.
- **Action:** fix now, apply A.

Shared assumptions: preserve today's delivered revision and typed stamp rules,
as the task requires. Compare all semantic fields. Normalize only the fields
that canonical hashing already normalizes. Preserve whether revision is present. Do not trust a supplied id alone.

Our call, 2026-11-17: expose an opaque public `RecentDetails` value because
external fixtures already construct public `Snapshot` literals. Keep mutation
private. Propagate private encoder errors through existing result boundaries
to avoid adding panic paths. These implementation details preserve the
chosen behavior and add no protocol requirement.

Our call, 2026-11-17: allow equal `RevisionFile` reuse across revisions
because delivery already replaces that number. This corrects the task's
raw-file premise without changing output or the performance orchestrator's calls.

Options-check report: `.context/detail-publication-reuse/plan-options-report.md`.
The check confirmed current typed equality gives exact bytes. The detail
shapes contain no floating point or dynamic JSON value fields. A supplied
id alone never proves equality. Candidate replacement may lose newer cache
records, which only causes misses. Changing index lookup complexity and
adding future-field lints are outside this change.

## Milestone 1: Documentation alignment

Depends on: none

Delegate to the docs implementor. Existing protocol requirements stay in force.
No mockups are needed because no screen or user flow changes.

- [x] Check the contract owners and retain their current requirements.
- [x] Update the server README with the bounded equality reuse boundary and relevant code entry points.
- [x] Confirm no model README or protocol change is needed for single-conversion canonical output.

Milestone 1 complete. Evidence: `.context/detail-publication-reuse/milestone-1-docs-report.md`.

## Milestone 2: Recent publication reuse and canonical encoding

Depends on: 1

Delegate to the non-ui implementor. Centralize equality reuse across rebuild,
usage completion, and Changes without changing their revision rules.

- [x] Add the publication-sequence byte oracle over several edits and all three phases. Compare every index and detail response, id, and typed revision.
- [x] Add a red-first count regression proving a repeated phase does not hash or encode an equal detail again.
- [x] Add canonical byte equality coverage for nested maps, arrays, escapes, non-ASCII text, and number forms. Prove the tests detect a defect.
- [x] Implement the four-kind-slot bound, equality lookup, absent-path pruning, and shared encoded payloads in all three phases.
- [x] Remove the redundant canonical value conversion without changing sorting, formatting, errors, ids, or output.
- [x] Build each cache miss from one canonical preimage serialization. Fill only the top-level id slot and keep revision-spliced delivery.
- [x] Cover eviction, changed content with an old supplied id, revision changes, and candidate isolation at the lowest useful level.
- [x] Save red/green evidence and the added tests' run times under `.context/detail-publication-reuse/`.

Milestone 2 complete. Evidence: `.context/detail-publication-reuse/milestone-2-report.md`.

## Milestone 3: Before and after evidence

Depends on: 2

Use separate checkouts and target directories for the last merged `main`
and the branch. Cargo builds run one at a time with `CARGO_INCREMENTAL=0`.
Check disk and available memory before every large Cargo build.

- [x] Build release binaries for `main` and the branch with the same settings.
- [x] Measure repeated Serve edits on `examples/basic` and generated fixtures from `scripts/large/`. Record fixture sizes, phase `detail.build` counts, edit-to-Changes-ready times, and memory observations.
- [x] Compare delivered publications against the pre-change oracle and explain any measurement limits.
- [x] Push the implementation and immediately send its SHA to the performance orchestrator for the Mokly Cloud acceptance measurement.

The performance orchestrator added two verification calls on 2026-11-17.
Confirm that every miss still emits `detail.build`. Locate the React timing
gap before changing the miss path. Both checks are complete. Raw traces
show zero misses in repeated edits. Publication windows shrink. The small
React gap occurs in rendering and base capture. The runtime cause remains
unproven. Evidence: `.context/detail-publication-reuse/react-publication-analysis.md`.

## Milestone 4: Verification, review, and pull request

Depends on: 1, 2, 3

- [x] Run targeted tests, `cargo xtask check --suite repository`, and `cargo xtask check`. Use Git 2.45 or later first on PATH and install git-lfs. Report any blocked suite.
- [x] Commit with Conventional Commits and push. Run the shared finish-work `scripts/ci-wait.sh` after each CI-triggering change.
- [x] Review the full diff against `origin/main` with the implementation-review skill. Check each new finding, apply up to two fix rounds, re-review fixes, and record remaining items.
- [x] Refresh `origin/main`, preserve merged nearby work, and finish CI on the last commit. Report fixed, deferred, and open findings and the repository follow-up count.
- [ ] Delete this plan under the plans skill after all preceding TODOs are complete.
- [ ] Open the pull request into `main`. Preserve dated calls and the plan permalink in its description. Wait for final CI and send the complete report to the performance orchestrator. Do not merge.

Verification evidence: `.context/detail-publication-reuse/complete-gate.log`.
The complete local gate passed on the implementation before the clean merge
of `origin/main` at `49f28d837`. The merge preserves the base-usage optimization
and browser test fix. Integration checks follow the merge. Final pull request
CI will verify the combined tree. Release comparisons remain the controlled
before/after measurements against `794b30a91`.

Milestone 3 complete. The implementation is pushed at
`5238d4e7d71441a1de2e9e57be6d3cdaf57dc044`. The performance orchestrator
received the SHA immediately after the push.

The fresh implementation review found no in-scope or outside-scope finding.
No finding check or fix round is required. Review records live under
`.context/reviews/calummoore/mokly-detail-publication-reuse-7lec/`.
The implementation push starts no CI before a pull request exists.
The shared waiter returned the expected no-run result.
Only plan deletion and pull request opening with final CI remain.
