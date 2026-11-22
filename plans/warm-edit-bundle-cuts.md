# Shorter warm edit bundle

Status: Active. On branch `calummoore/mokly-edit-bundle-path-kv2o`, no pull
request yet. The pull request that completes the work deletes this plan, as
the `plans` skill says.

A warm one-line edit of mokly-cloud spends about 1 s in the core's
`catalogue.bundle` span before Serve can publish it. The split in
[serve-edit-bundle-split.md](./follow-ups/serve-edit-bundle-split.md) and the
item
[serve-edit-released-recipe-seed.md](./follow-ups/serve-edit-released-recipe-seed.md)
hold the measurements. This change takes five cuts from that path as one
change, with the same bytes, warnings, diagnostics, and errors, and with a
memory peak within 2% of `main`. The goal is a publication at least 100 ms
sooner for each warm edit of mokly-cloud. The projection is about 90 to
125 ms.

- **F:** before a `bundle` request, the pool sends no released recipe that the
  current files already rule out. Today each warm forward edit sends a recipe
  of 5.96 MB that the sidecar's reuse check must reject.
- **H:** the sidecar's reuse check reads the likely changed inputs first. The
  check stops at the first mismatch, so its result does not change.
- **B:** the guarded import proof observes each module path once and makes no
  dependency usage call for a relative name, where the call does nothing.
- **C:** the core checks the plan record on several threads.
- **G:** a compile without a full capture owner leaves the module sources out
  of its identity hash. Its identity already holds the random runtime key, so
  it stays unique.

The change does not cover the encode of each released recipe under the pool
lock, which
[release-recipe-encode-under-pool-lock.md](./follow-ups/release-recipe-encode-under-pool-lock.md)
holds. It does not cover the other cuts of the split record.

User decisions, 2026-11-21, by Cal under his delegation:

- The seed item takes option F, proof of a failed reuse in the pool, plus
  option H. Option C, a rule from the paths of the watch action, was the
  first recommendation. The options check replaced it, because the paths do
  not reach the build and need a mapping to real paths. Options A, B, D, E,
  G, and I were not chosen. Cal approved the protocol text of F as written
  and the new `stamp-mismatch` row of `docs/protocol/mokly-timings.md`, in
  the release rules where PR #465 puts them.
- Conditions of F: a recipe that F rules out changes no result, no event or
  timing field other than durations, no order of the released recipes, and
  no `cache` value. A revert keeps its seed and its reuse. When the released
  recipe and the live compilation record the same digest for the edited path,
  F does not apply, and the protocol text and a test state this limit. F
  reads only the paths whose digests differ between the two recipes, once
  for each request.
- The scope takes option C of the scope item: this workspace implements F and
  H with B, C, and G of the split record, as one change. The code starts
  after PR #465 merges, on `origin/main` merged once. Options A, keep the
  stop, B, the in-scope cuts alone, and D, also the reads during the compile,
  were not chosen.
- Tests: red tests first for F. The differential test of the task brief for
  B, C, and G. Local measurement in ABBA order.

Design calls, mine, 2026-11-21:

- F compares the released recipe with the live compilation of equal settings
  that has the highest epoch, whatever its capture mode. The protocol text
  names the newest live compilation. Reason: the comparison only chooses which
  paths to read. The rule out itself needs a current file that differs from
  the released recipe.
- F, call of 2026-11-22: F rules a recipe out when the current file differs
  from what the recipe records: another digest, or a file where the recipe
  records an absence. A missing or unreadable current file rules nothing out,
  and the scan goes on, so the result does not depend on the order. Reason:
  the release rules as approved, and Cal's condition that a missing or
  unreadable file keeps today's behavior. The call of 2026-11-21 also left a
  recorded absence out, so the pool read such a file and then ignored it.
- F reads outside the pool lock, through a new digest boundary of the pool with
  a mock for tests. `mokly-sidecar` gets the `sha2` dependency for it. The
  digest equals the sidecar's: SHA-256 of all bytes of a regular file.
- H, call of 2026-11-22: the reuse check reads first the input that failed the
  last check of the process, then the inputs whose digests differ between the
  generations of equal settings that the process holds, then the rest. Reason:
  in a run of edits to one file, the input that failed the last check is that
  file, so the first read rules out the old generation. The call of 2026-11-21
  put the differing inputs first.
- C splits the evidence into contiguous chunks on scoped threads, at most four,
  and stops each thread after the first mismatch. Reason: the check waits on
  the file system, not on the CPU, so a few threads overlap most of the waits,
  and an early stop keeps a failed check as short as before.
- G leaves out the module sources only when the compile has no full capture
  owner, which is every `serveEdit` compile. The identities of complete
  compilations keep their bytes, so stored bundles and render store entries
  stay valid.
- Measurements compare arms only in ABBA order on one fixture. The split found
  an order bias of about 200 ms with two fixtures.

Contract owners:

- [Compiled recipes and release](../docs/protocol/mokly-sidecar-recipes.md),
  whose released recipe rules PR #465 moves to
  `docs/protocol/mokly-sidecar-release.md`.
- [Startup diagnostics](../docs/protocol/mokly-timings.md), the `cache` values
  of `catalogue.bundle`.
- The [sidecar crate README](../crates/mokly-sidecar/README.md), the
  [render sidecar README](../packages/mokly/src/sidecar/README.md), and the
  [render crate README](../crates/mokly-render/README.md).

## Milestone 1: Documentation and protocol

Depends on: none. It starts after PR #465 merges, because #465 moves the rules
of released recipes to a new page.

- [x] Add the approved paragraph and decision of F to the rules of released
      recipes, with the limit for equal digests and the rule for a missing or
      unreadable file.
- [x] Change the `stamp-mismatch` row of `docs/protocol/mokly-timings.md` as
      approved.
- [x] Update the three README files of the contract owners where an entry point
      or a described behavior changes.

## Milestone 2: Red tests and measurement harness

Depends on: none.

The tests are written against the tree of PR #465 and land after it merges.

- [x] Pool tests for F: a forward edit sends no seed and gives the same result;
      a revert to the released content still seeds and reuses; equal digests in
      both recipes keep today's seed; a missing or unreadable file keeps
      today's behavior. See the forward edit test fail on today's code.
- [x] The differential test for B and G: one process runs an edit inside a
      module, a new import, a removed import, a renamed file, a failed compile
      and its recovery, and an edit of a configuration file. Each guarded
      compile with a plan gives the result, the evidence, and the diagnostics
      of the same request without a plan. Break B on purpose and see it fail.
- [x] The test for C: verdicts of the threaded plan check for a mismatch in the
      first, a middle, and the last chunk, and for a read error. Break the
      early stop on purpose and see it fail.
- [x] Prepare the harness: ABBA sessions on one fixture, cold sessions for the
      memory peak, and the byte proof with ready Changes on mokly-cloud,
      `examples/basic`, and the large HTML and React fixtures.

Evidence: `.context/edit-bundle-path/ledger.md` lists each red run and each
mutation proof.

## Milestone 3: Released recipes that cannot pass

Depends on: 1, 2.

- [x] Add the digest boundary of the pool and its system implementation.
- [x] Rule out a released recipe in `seed_compilation`, outside the lock, with
      `complete`, the least recently used touch, and the `cache` value kept.
- [x] Pass the F tests and the existing pool tests.

Evidence: `.context/edit-bundle-path/cargo-tests-1.log`.

## Milestone 4: Likely changed inputs first

Depends on: none. It starts after PR #465 merges.

- [x] Order the inputs of the reuse check in `compiled.ts` and
      `file-digests.ts` as the design call says.
- [x] Pass the existing reuse tests.

Evidence: `.context/edit-bundle-path/ts-sidecar-tests-1.log`.

## Milestone 5: Cheaper guarded import proof

Depends on: 2.

- [x] Observe each module path once in `ModulePaths.observe`.
- [x] Drop the dependency usage call for relative names in
      `PlannedRelative.verify`.
- [x] Pass the differential test and the planned tests.

## Milestone 6: Threaded plan check

Depends on: 2.

- [x] Check the plan record on scoped threads in `plan_inputs::current`.
- [x] Pass the C test and the plan tests of `crates/mokly-render`.

## Milestone 7: Edit identity without sources

Depends on: 2.

- [x] Leave the module sources out of the identity hash of a compile without a
      full capture owner.
- [x] Pass the differential test and the identity tests.

## Milestone 8: Measurement and proofs

Depends on: 3, 4, 5, 6, 7.

- [x] Send the SHA of the final source to Cal.
- [x] Measure warm edits of mokly-cloud against `main` in ABBA order, with
      timing output.
- [x] Measure the whole-tree memory peak of cold ten-edit mokly-cloud sessions
      and of cold `examples/basic` sessions against `main`.
- [x] Run the strict byte proof with ready Changes on the four fixtures.

Evidence: `.context/edit-bundle-path/ledger.md` gives the local ABBA runs and
Cal's official gate of `0ddfe044b`, which measured the memory peaks.
`.context/edit-bundle-path/byteproof/` holds the byte proof.

## Milestone 9: Verification, commit, review, and pull request

Depends on: every other milestone.

- [ ] Run the targeted tests, the repository suite, and the complete gate named
      in `AGENTS.md`.
- [x] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record follow-up
      items under `plans/follow-ups/` for the rest, re-review once, and
      report.
- [ ] Delete this plan and the seed item when the `plans` skill says, under
      "Deleting the plan". Update the split record with the outcome, so it
      keeps only the rejected options.
- [ ] Open the pull request. Its description gives the decisions and the
      design calls of this plan with their dates, a permalink to this plan,
      and the follow-up items that the change adds.
