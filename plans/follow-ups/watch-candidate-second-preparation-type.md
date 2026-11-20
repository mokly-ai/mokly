# Give a rechecked watch candidate its own type

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-19, from branch `calummoore/mokly-publish-path`, review
  finding 6 of round 2: the wider fix that the agent split off.
- **Location:** `crates/mokly-cli/src/serve_watch.rs` (`WatchInputs::recheck`,
  `WatchedInputs::recheck`, `WatchedInputs::adopt`, `CandidateWatch`),
  `crates/mokly-cli/src/serve_watch_plan.rs` (`PlanRecord::candidate`),
  `crates/mokly-cli/src/serve_preparation.rs:51` and `:61`, and
  `crates/mokly-cli/src/serve_rebuild_action.rs:86` and `:101`.
- **Reason:** The fix changes the `WatchInputs` trait and two callers outside
  the diff of that branch, which the branch did not need.

- **Source:** Review.
- **Category:** Code structure.
- **Terms:**
  - **Watch candidate:** `CandidateWatch`, the watch state that one Serve
    rebuild prepares and adopts after the publication. It holds an observer,
    a `recheck` flag, and a plan record (`PlanRecord`: the plan, its inputs,
    and its targets).
  - **Second preparation:** a second catalogue preparation under the
    candidate's new observer. Serve runs it when a new watch root reaches a
    directory that the old observer did not watch, under the readiness rule
    of `docs/protocol/mokly-watch.md`.
- **Background:**
  - `WatchedInputs::candidate` returns a candidate with `recheck` set when a
    second preparation is needed. Each caller tests the flag, prepares
    again, and calls `recheck` with the candidate.
  - `recheck` builds a plan record from the second preparation, attaches its
    plan, runs the replay check, and then stores the record in the
    candidate with `candidate.record = record;`.
  - `adopt` installs the plan of the candidate's record as the live plan, and
    the next candidate compares its plan inputs with that record.
  - The test `the_adoption_after_a_second_preparation_installs_its_plan` in
    `crates/mokly-cli/src/_tests_/serve_watch_coverage_tests.rs` fails when
    `recheck` skips the store step.
- **Problem:** A candidate that needs a second preparation still holds the
  plan record of the first preparation until `recheck` replaces it, and
  `adopt` accepts it either way. So a change of `recheck` that returns before
  the store step compiles, and only that test catches it.
- **Impact if no action:** A later change can adopt the plan of the first
  preparation after a second preparation. An edit to a file that only the
  second preparation reads then starts no rebuild.
- **Root question:** How does the type of a watch candidate make sure that an
  adoption after a second preparation can only install the plan of the
  second preparation?
- **Options:**
  - **A.** Change nothing. The test above guards the store step. Effort:
    Small.
  - **B.** `recheck` takes the candidate by value and returns the candidate
    that `PlanRecord::candidate` builds from the second record. The return
    type can still carry the first record. Effort: Medium.
  - **C.** Split the candidate into two types. `candidate` returns a ready
    candidate, with its observer and plan record, or a candidate that needs a
    second preparation, with only its new observer. `recheck` takes the
    second kind and the second preparation and returns a ready candidate.
    `adopt` accepts only a ready candidate. The `recheck` flag and the first
    record leave that path. Change the two callers, the `WatchInputsMock`
    clauses, and the tests that build `CandidateWatch` or read `recheck`.
    Put the new type in `serve_watch_plan.rs`, because `serve_watch.rs` is
    near the 300-line cap. Effort: Medium.
- **Left out:** A check in `adopt` that compares the record with the inputs of
  the preparation: as a debug assertion it adds no detection beyond the test,
  as a rebuild of the record it hides the defect, and as a rejection it is a
  new rejection that needs the user.
- **Wider fix:** C. It removes the wrong state from the type.
- **Previous examples:** On `origin/main` before the branch, `recheck` also
  replaced the candidate's plan one field at a time, and no test read the
  adopted plan.
- **Recommendation:** C. The first record then cannot reach `adopt` after a
  second preparation.
- **Action:** fix after merge, apply C, because it changes the `WatchInputs`
  trait and two callers outside the branch that found it.
