# Pool fixtures steer requests through idle queue order

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** Yes.
- **Kind:** Fix after merge.
- **Added:** 2026-11-18, from the wider fix of decision 3 in the generation
  affinity plan, branch `calummoore/mokly-sidecar-generation-affinity-jmbb`.
- **Location:** `crates/mokly-sidecar/src/_tests_/recipe_support.rs:156-160`
  and line 181, `crates/mokly-sidecar/src/_tests_/pool_recipe_tests.rs:13`
  and line 15, and the test
  `equal_bindings_keep_the_shared_revision_on_both_workers` in
  `crates/mokly-sidecar/src/_tests_/pool_reload_tests.rs`.
- **Reason:** The generation affinity change corrected only the two failing
  reload fixtures, and its task kept every passing pool test unchanged.

- **Source:** Implementation.
- **Category:** Test.
- **Terms:**
  - **Slot:** one place for one sidecar process in the pool of
    `crates/mokly-sidecar`.
  - **Idle queue:** the `available` field of `State`, at
    `crates/mokly-sidecar/src/pool_state.rs:50`. It lists the idle slots, the
    longest idle first.
  - **Lease:** the exclusive use of one slot. `Pool::acquire`, in
    `crates/mokly-sidecar/src/pool_leases.rs`, takes it. `Pool::release`, in
    `crates/mokly-sidecar/src/pool.rs`, returns it.
  - **Queue steering:** a test puts the slot that it names at the front of the
    idle queue while other slots are also idle. Queue order then sends the
    next request to that slot.
- **Background:**
  - `Pool::request`, at `crates/mokly-sidecar/src/pool_exchange.rs:35`, takes
    a lease, runs the call with its replay, and releases the slot. A release
    runs cleanup on the slot and puts the slot at the back of the idle queue.
  - On 2026-11-18 the generation affinity change, on the branch above, added a
    rank of idle slots. For a call that names a generation, a slot of the same
    root that holds the generation and every input that the call needs comes
    first. Another slot that holds the generation comes next. Queue order
    breaks ties. Calls without a generation, such as `bundle` and `dispose`,
    keep queue order. The section Generation Affinity of
    `docs/protocol/mokly-sidecar-root-scheduling.md` holds this rule.
  - The rank broke two steering fixtures in `pool_reload_tests.rs`:
    `a_busy_second_process_reloads_maps_after_release_and_rebundle` and
    `an_updated_binding_table_is_replayed_on_the_second_process`. Each pushed
    slot 1 to the front of the idle queue while slot 0 stayed idle and fully
    prepared. The rank correctly chose slot 0. That render used up the
    expected calls of the slot 0 mock. The test failed with
    `called Option::unwrap() on a None value` at line 45 of that file.
  - On 2026-11-18 the performance orchestrator approved a setup-only
    correction of those two fixtures, under the user's delegation of
    2026-11-16. Each fixture now takes each lease while that slot is the only
    idle slot. It keeps every assertion, payload, mock count, and deadline.
    The same call kept a shared helper out of that branch, because the other
    steering tests still pass.
  - `equal_bindings_keep_the_shared_revision_on_both_workers`, in the same
    file, still calls `pool.lock().available.push_front(1)` before its render.
    Both slots then hold the generation, its maps, its description, and the
    same bindings table. The test passes only because the two slots tie, so
    queue order picks slot 1.
  - `Fixture::select`, at `recipe_support.rs:156-160`, moves a slot to the
    front of the idle queue. `Fixture::probe`, at line 181, calls it before
    its `bundle` call. Five tests in `pool_recipe_tests.rs` use these helpers:
    - `seed_restores_the_highest_live_epoch_on_each_fresh_worker`, which also
      calls `select` at line 13 and line 15.
    - `a_live_seed_stays_usable_when_its_final_lease_ends_during_restore`.
    - `the_bound_evicts_the_least_recently_seeded_recipe`.
    - `the_last_release_replaces_equal_settings_and_reuse_makes_the_recipe_live`.
    - `the_serialized_envelope_fits_exactly_and_an_oversized_recipe_is_not_retained`.
  - These five tests pass because `bundle` calls keep queue order. The four
    slots of the recipe fixture share one mock worker. So a probe that
    reaches another fresh slot can pass without the slot that it names.
  - `a_render_uses_an_idle_slot_while_an_earlier_affine_call_waits`, in
    `crates/mokly-sidecar/src/_tests_/pool_scheduling_tests.rs`, holds a slot
    busy with a real lease from `Pool::acquire`, at line 48. It returns the
    lease with `Pool::release`, at line 77.
  - These lines are not queue steering, because they direct no later request:
    the idle setup in the `pair` fixture of `pool_reload_tests.rs`,
    `crates/mokly-sidecar/src/_tests_/pool_context_tests.rs:52`, and
    `recipe_support.rs:141`. The generation affinity tests set the queue order
    at `crates/mokly-sidecar/src/_tests_/generation_affinity/selection_tests.rs:17`,
    because that order is their subject.
  - Every option keeps each assertion, payload, mock count, and deadline of
    these tests, as the correction of 2026-11-18 did. Every replay still runs
    through `Pool::request`, as the existing replay tests require. The product
    selection rule stays as the protocol states.
- **Problem:** Six passing tests choose the slot of a request by its place in
  the idle queue. So the selection rule, not the test setup, decides where the
  request runs.
- **Impact if no action:** A later rank change can move these requests to
  another slot. A test then fails for a reason outside its subject, as the two
  reload fixtures did on 2026-11-18. Or it passes without the slot that it
  names.
- **Root question:** How does a pool test run each request on the slot that it
  names, whatever the selection rule?
- **Options:**
  - **A.** Change nothing. Each test keeps queue steering, and a later rank
    change repairs each test that fails. Effort: Small.
  - **B.** Correct each fixture in place. Before each request, make the named
    slot the only idle slot, as the two corrected reload fixtures do. Each
    fixture keeps its own copy of this code, so the copies can drift. Effort:
    Small.
  - **C.** Add one shared explicit-lease helper for pool test fixtures under
    `crates/mokly-sidecar/src/_tests_/`. The helper takes each lease while
    that slot is the only idle candidate. It returns each lease through
    `Pool::release`. Every replay still runs through `Pool::request`. Move the
    six passing tests and the two corrected reload fixtures to it. A release
    runs cleanup, so a mock must expect each disposal that a release sends.
    Effort: Small.
- **Left out:**
  - A test-only override in the selector that names the next slot. The tests
    would then run a selection that production never runs. The correction of
    2026-11-18 left out test detection in the selector for this reason.
  - Slot records that make the rank choose the named slot. The test still
    depends on the rank, so the next rank change breaks it again.
  - Queue steering with an assertion of the slot that ran. It finds a move but
    does not prevent it.
  - Queue order for these calls in the product. It breaks the Generation
    Affinity requirement.
- **Wider fix:** C. One helper removes queue steering from pool fixtures, so
  no rank change can move their requests. A new fixture gets it by reuse.
- **Previous examples:** The two reload fixtures that failed on 2026-11-18 are
  earlier cases of this class. The lease in
  `a_render_uses_an_idle_slot_while_an_earlier_affine_call_waits`, at
  `pool_scheduling_tests.rs:48` and line 77, already uses the pattern of C.
- **Related:**
  [sidecar-loaded-state-selection.md](./sidecar-loaded-state-selection.md)
  ranks more requests under its options C and D. D also ranks `bundle` calls,
  so it would move the steered `bundle` calls of the recipe fixture. A branch
  that applies C or D there should apply this item first, or with it.
- **Recommendation:** C. One helper keeps every replay on the real request
  path, and it frees every pool fixture from queue order, also future ones.
- **Action:** fix after merge, apply C, because the generation affinity change
  corrected only the two failing fixtures and kept every passing test
  unchanged.
