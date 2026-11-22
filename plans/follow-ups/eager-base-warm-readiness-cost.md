# Warm Serve readiness is slower with eager preparation

- **Severity:** Low. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Category:** Performance.
- **Owner:** Cal (@calummoore).
- **Added:** 2026-11-21, from the branch
  `calummoore/mokly-eager-base-preparation-5dkn` at `237c1785b`, after the
  owner accepted its remaining warm readiness cost.
- **Location:** `crates/mokly-cli/src/serve_services.rs:73` to line 76 and
  line 206 to line 245, `crates/mokly-cli/src/serve_preparation.rs:24` to
  line 81, `crates/mokly-cli/src/entry_serve.rs:191` to line 237,
  `crates/mokly-cli/src/serve_eager.rs:79` to line 118,
  `crates/mokly-cli/src/serve_eager_task.rs:108` to line 140,
  `crates/mokly-cli/src/serve_eager_sources.rs:28` to line 151,
  `crates/mokly-cli/src/changes_base_sources.rs:56` to line 159,
  `crates/mokly-cli/src/serve_eager_source_gate.rs:91` to line 108,
  `crates/mokly-cli/src/changes_base.rs:101` to line 236,
  `crates/mokly-cli/src/serve_gate.rs:134` to line 140,
  `crates/mokly-git/src/source_key.rs:25` to line 80,
  `crates/mokly-compare/src/extraction.rs:99` to line 113, and the Start
  section of `docs/protocol/mokly-eager-base-preparation.md`.
- **Reason:** On 2026-11-21 the owner accepted the remaining warm readiness
  cost and gave this work to the time after the merge.

- **Terms:**
  - **Readiness:** The `serve.ready` timing span of
    `crates/mokly-cli/src/serve_timing.rs`. It opens when the Serve command
    starts. It closes after Serve writes its readiness layout and its
    catalogue summary.
  - **Eager base preparation:** The base catalogue work that Serve starts
    before the head usage pass ends. Its contract is
    `docs/protocol/mokly-eager-base-preparation.md`.
  - **Source phase:** The first part of eager preparation. It needs no head
    dependency evidence. `NativePreparation::source_phase` in
    `crates/mokly-cli/src/serve_eager_sources.rs` runs it.
  - **Readiness latch:** The sticky flag that the first successful readiness
    sets. `StartupSources` in `crates/mokly-cli/src/serve_eager_source_gate.rs`
    holds it. A wait at the latch ends at once on cancellation.
  - **Complete lease:** A lease on a complete extraction of the pinned base
    sources that an earlier run left in the source cache. Its presence lets
    source reads pass the readiness latch.
- **Background:**
  - At startup, Serve prepares the working catalogue, which is the head. Then
    it writes its readiness layout. Then the head usage pass renders or
    restores every head view. Then the Changes classification compares the
    head with the catalogue at the merge-base commit, the base.
  - On 2026-11-21 the owner measured `237c1785b` against main `36cfd7cf7` on
    the `mokly-cloud` catalogue. Both arms used the same dist and the
    quiet-snapshot gate. Each set had four interleaved warm rounds.

    | Measure                       | Main `36cfd7cf7`                             | `237c1785b`                                          |
    | ----------------------------- | -------------------------------------------- | ---------------------------------------------------- |
    | First Changes, warm one-line  | 5.1, 5.1, 3.8, 4.0 s, mean 4.50 s            | 4.2, 4.1, 3.6, 3.4 s, mean 3.83 s, -0.67 s           |
    | First Changes, warm unchanged | 4.1, 3.8, 3.9, 3.7 s, mean 3.88 s            | 3.4, 3.5, 3.6, 3.7 s, mean 3.55 s, -0.33 s           |
    | Readiness, warm one-line      | 1,262, 1,281, 1,231, 1,195 ms, mean 1,242 ms | 1,394, 1,365, 1,254, 1,214 ms, mean 1,307 ms, +65 ms |
    | Readiness, warm unchanged     | 1,182, 1,164, 1,133, 1,123 ms, mean 1,151 ms | 1,266, 1,221, 1,227, 1,207 ms, mean 1,230 ms, +79 ms |
    | Mean edit, one-line           | 2.00 s                                       | 2.00 s                                               |
    | Mean edit, unchanged          | 1.98 s                                       | 1.98 s                                               |

  - All eight candidate readiness rounds were slower than their main rounds.
    The cost is repeatable. It is not measurement noise. The owner accepted it
    on 2026-11-21 for the first Changes gains.
  - The earlier accepted candidate `2b7b1b9b5` measured +16 ms to +25 ms of
    warm readiness. Its cold readiness was 3,472 ms against 3,482 ms.
  - The runtime diff from `2b7b1b9b5` to `237c1785b` only removes the unused
    bundle-end policy, with its per-call check in
    `crates/mokly-cli/src/serve_pool.rs`. Source reads cannot tell whether
    the larger cost comes from that diff or from the different sessions.
  - Startup order on `237c1785b`, from the code:
    - `AttemptPreparation::prepare` validates the working configuration. Then
      it calls `EagerStarts::start` at
      `crates/mokly-cli/src/serve_services.rs:221` to line 223, before the
      head catalogue work at line 240.
    - `NativeEagerFactory::start` spawns one `mokly-base-prepare` thread, at
      `crates/mokly-cli/src/serve_eager_task.rs:108` to line 140. The thread
      can run the source phase at once. Every later eager step runs on it.
    - On the head preparation thread, `EagerAttempts::start` cancels and joins
      an earlier attempt, at `crates/mokly-cli/src/serve_eager.rs:79` to line 94. At startup, an earlier attempt exists only after a watch recheck,
      at `crates/mokly-cli/src/serve_preparation.rs:52` to line 68.
    - `serve_preparation::initial` gives the adopted head to the pending task
      at `crates/mokly-cli/src/serve_preparation.rs:71`. This happens before
      the snapshot, the bind, and the readiness layout.
    - `timing.ready()` closes the readiness span at
      `crates/mokly-cli/src/entry_serve.rs:236`. Then `head_published` at line
      237 sets the readiness latch. The usage pass starts at line 266.
  - Three groups of eager work can run before readiness:
    - **Startup source work** runs at every Serve start, cold and warm. The
      pin runs `git rev-parse --show-toplevel`, a promisor read with
      `git config`, `git rev-parse --verify`, and `git merge-base`. The code
      is `crates/mokly-git/src/repository.rs:123` to line 148 and
      `crates/mokly-git/src/history.rs:17` to line 38.
    - The first start has no kept base, because the base slot starts empty at
      `crates/mokly-cli/src/serve_delivery.rs:63`. So the phase continues past
      the kept-base check.
    - The checkout sample of startup source work runs `git config --list`, a
      full recursive `git ls-tree -r -t -l` of the base commit, and
      `git check-attr --all` over every regular path. The code is
      `crates/mokly-git/src/source_key.rs:25` to line 68.
    - When the working configuration names a renderer or PostCSS, the lease
      probe of `crates/mokly-compare/src/extraction.rs:99` to line 113
      follows. Its source key runs the same three Git commands again, at
      `crates/mokly-git/src/source_key.rs:70` to line 80.
    - Then the base configuration loads through the historical source tree,
      at `crates/mokly-cli/src/changes_base_sources.rs:88` to line 103.
    - **Warm source reads** can run before readiness only with a complete lease.
      `SourceWait::enter` waits for the latch only for an unleased start.
      With a complete lease, discovery, the extraction, and the clean
      dependency identity reads run at once. The code is
      `crates/mokly-cli/src/changes_base_sources.rs:104` to line 125.
    - A pure HTML configuration has no lease probe. So its discovery always
      waits for the first readiness.
    - **Adopted-head validation** starts when the source phase has ended and
      the adopted head exists. `NativeBase::prepare_generation`, in
      `crates/mokly-cli/src/changes_base.rs:101` to line 236, selects and
      prepares the base dependencies. Then it validates the base catalogue,
      with the base bundle, and prepares the base graph.
    - Base catalogue validation waits for the classification unless the
      working installation is provable. `ProvenValidation::enter` in
      `crates/mokly-cli/src/serve_eager_validation.rs:84` to line 103 decides.
    - The eager rule of `Gate::acquire_call`, in
      `crates/mokly-cli/src/serve_gate.rs:134` to line 140, has no readiness
      check. At a capacity of four or more, an eager sidecar call needs no
      last view start, at `crates/mokly-cli/src/serve_eager_admission.rs:43`.
    - So on a warm start at a capacity of four or more, the base bundle is
      eligible before readiness. At two or three it waits for the last view
      start, after readiness. The code does not show whether a call starts
      before readiness.
  - Output safety of a later start, from the code and the protocol:
    - Eager work reports nothing before adoption. The Reporting section of
      `docs/protocol/mokly-eager-base-preparation.md` requires one ordered
      record, which adoption replays.
    - `NativePending::adopt`, at
      `crates/mokly-cli/src/serve_eager_native.rs:218` to line 240, waits for
      the source phase. It rechecks the pinned key, the head evidence, and the
      working inputs. A mismatch discards the work.
    - So a later start changes only when the work runs. The protocol requires
      the same Changes states, details, warnings, and bytes with and without
      eager preparation.
    - A wait before the pin opens no repository. It holds no Git process, no
      lease, and no sidecar claim, because none exists yet.
    - The Start section of the protocol requires the early start of startup
      source work, and of warm source reads with a complete lease. Each option
      that moves work changes that section in the same change.
  - Predictions, not measured:
    - Less eager work in the startup window can lower warm readiness. Source
      reads cannot show how much, or which group holds the cost.
    - The accepted cold rounds could run only startup source work before
      readiness, and their readiness was equal. This fits a small cost of
      that group. It does not prove it. Cold startup does more other work,
      and those rounds measured `2b7b1b9b5`.
    - On the candidate means, first Changes came about 2.3 s to 2.5 s after
      readiness. A start at readiness gives the base work less than that time
      to finish beside the usage pass.
    - Work after readiness competes with the head usage pass. Eager sidecar
      calls also wait while head calls queue. So a later start can lose part
      of the warm gain, or slow head usage.
- **Task:**
  1. Build option A as a candidate on the current `main`, with its tests.
  2. On a calm host, measure option A against its `main` control in
     interleaved rounds. Use the same dist and the quiet-snapshot gate. Run
     at least four warm one-line, four warm unchanged, and four cold rounds on
     `mokly-cloud`. The cold rounds use fresh caches.
  3. Record readiness, first Changes, head usage, the first edit, and the cold
     ten-edit peak memory of the whole process tree.
  4. Option A succeeds only when the measurement shows all of these:
     - Warm readiness equals the control within measurement noise, in both
       warm sets.
     - Warm first Changes keeps a gain against the control. Report the gain
       and its spread. The accepted gains are 0.67 s and 0.33 s.
     - Cold readiness equals the control. Cold first Changes keeps a gain.
       The accepted cold gain is 0.72 s.
     - Head usage and edits are not slower beyond measurement noise.
     - The cold ten-edit peak memory stays within 2% of the control.
     - Every published byte stays equal on the basic, large HTML, large React,
       and `mokly-cloud` fixtures.
  5. When option A loses the warm gain, measure option B, then option C, in
     the same way. A, B, and C move nested groups of work, so their results
     can help identify which group holds the cost.
  6. Give the owner every sample and its spread. The owner chooses. No fix is
     chosen now.
- **Options:** Attempts after the first readiness keep their current start in
  every option.
  - **A.** An attempt that starts before the first readiness waits at the
    readiness latch before the pin. After readiness, its source phase runs
    beside the usage pass. Validation follows the source phase and the adopted
    head.
    - Keep the owned thread, its cancellation, and its join. A startup recheck
      then cancels an attempt that runs no Git command.
    - The lease split of `SourceWait::enter` then makes no start wait. Remove
      it as dead code in the same change.
    - Tests: an attempt before readiness runs no Git command and no lease
      probe until the latch opens. Cancellation ends the wait. An attempt
      after readiness starts at once. Adoption, replay, and kept-base reuse
      stay unchanged.
    - Use controlled channels, with no sleep and no elapsed-time assertion.
      Update `eager_leased_sources_bypass_the_cold_start_boundary` in
      `crates/mokly-cli/src/_tests_/eager_cold_gate_tests.rs` with the
      requirement.
    - Effort: Medium.
  - **B.** Hold only the warm source reads and the validation after them.
    Remove the lease bypass of the source gate before the first readiness.
    Startup source work keeps its early start. Effort: Small.
  - **C.** Hold only adopted-head validation. The task waits at the latch
    after it gets the adopted head, before its `validate` call at
    `crates/mokly-cli/src/serve_eager_task.rs:134` to line 138. Both source
    groups keep their early start. Effort: Small.
  - **D.** Lower startup source work instead of moving it. Take one checkout
    settings sample for each pin, and derive the source key from it.
    - Both samples hash the same settings. The source key adds a salt only for
      a filtered checkout, at `crates/mokly-git/src/source_key.rs:62` to line 80.
    - A filtered checkout already ends the eager source phase before the
      probe, at `crates/mokly-cli/src/serve_eager_sources.rs:65` to line 67.
    - The Serve classification without eager work also samples twice. Its
      provider sets freshness at
      `crates/mokly-cli/src/serve_changes_classification.rs:74` to line 79.
      So this lowers the Git work of every Serve base preparation.
    - Nobody measured the cost of the second sample. This option keeps the
      schedule, and it can combine with A, B, or C. Effort: Medium.
  - **E.** Keep the accepted cost. Change nothing. Effort: Small.
  - Left out: a lower OS priority for eager work. It adds an OS policy that
    needs the approval of the owner, as the related item says.
- **Impact if no action:** Warm Serve readiness stays about 65 ms to 79 ms
  slower than `main` on `mokly-cloud`. No measurement attributes that cost to
  one group of work, so later startup changes cannot account for it.
- **Needs:** Release builds of the control and of each candidate with the
  same dist, Node, npm, and esbuild. A calm host with at least 4 vCPU and no
  other heavy process. The `mokly-cloud` catalogue, warm caches outside the
  repository and `/tmp`, and the four byte-proof fixtures. The approval of the
  owner for the protocol change of the chosen option.
- **Done when:** A calm interleaved measurement compares option A with the
  control, warm and cold, with every sample kept. It also compares option B or
  C when option A loses the warm gain. The owner ships one option, or records
  that the accepted cost stays. A shipped option updates the Start section of
  `docs/protocol/mokly-eager-base-preparation.md` in the same change, and that
  change deletes this item.
- **Related:**
  - [eager-base-competes-with-head-usage.md](./eager-base-competes-with-head-usage.md):
    the CPU contention of eager work with the head usage pass after
    readiness. This item covers the readiness cost before that pass. Options
    A, B, and C move work into the pass, so both measurements watch head
    usage. They can share rounds. Neither result answers the other.
