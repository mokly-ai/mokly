# Reuse sidecars that hold the requested generation

Status: Active. On branch
`calummoore/mokly-sidecar-generation-affinity-jmbb`, no pull request yet.
The pull request that completes the work deletes this plan.

Mokly uses a bounded pool of Node processes to evaluate catalogue generations.
After an edit, FIFO idle order can send the next call to a process that lacks
the generation. The process then restores and describes code that another idle
process already holds. This change ranks idle processes within one source root
by the state that the call needs.

The performance orchestrator supplied the approach on 2026-11-18. The user's
2026-11-16 delegation authorises that orchestrator to decide Changes speed and
reliability work. The user also requires bounded memory. This branch starts
from `24b238ca4`, the merge of PR #313. It keeps that change's warm head rule,
return pass, and pass preference.

Contract owners:

- [Source root scheduling](../docs/protocol/mokly-sidecar-root-scheduling.md).
- [Source root workers](../docs/protocol/mokly-sidecar-modules.md#source-root-workers).
- [Sidecar memory](../docs/protocol/mokly-sidecar-memory.md).
- [Sidecar crate](../crates/mokly-sidecar/README.md).

## Design and decisions

### 1. Avoid redundant generation preparation

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `crates/mokly-sidecar/src/pool_affinity.rs`,
  `crates/mokly-sidecar/src/pool_preparation.rs`, and
  `plans/follow-ups/sidecar-loaded-state-selection.md`.
- **Terms:**
  - **Generation:** one bundled version of the catalogue's JavaScript.
  - **Slot:** one place for a sidecar process in the bounded pool.
  - **Source root:** the directory that one process serves throughout its life.
- **Background:** Serve validates edited catalogue code before it prepares
  render inputs. Each slot records its generations, descriptions, CSS maps,
  and bindings. The process that just bundled a generation returns to the
  back of the idle queue.
- **Problem:** FIFO order can choose idle processes that lack the generation
  before the process that bundled it.
- **Impact if no action:** Redundant restores and descriptions delay Changes.
  The supplied second-edit trace contains a 254 ms gap before render inputs.
- **Root question:** How should a generation call avoid work that an available
  process already completed?
- **Options:**
  - **A.** Keep the current order. It needs no implementation but retains the
    measured delay. Effort: Small.
  - **B.** Rank idle processes of the same root by the loaded state the call
    needs. Keep queue order for ties. Effort: Medium.
  - **C.** Rank replacements across roots by retained loaded state. This
    addresses eviction rather than the immediate restore. Effort: Medium.
  - **D.** Use one loaded-state ranking for all roots and requests. Combine B
    and C after measurements establish the replacement policy. Effort: Large.
  - **E.** Move describe into the bundle call. This saves round trips, but
    evaluation needs maps that the core derives from the bundle result. It
    changes the wire method, Node handler, and unevaluated lifetime. Effort: Large.
  - **F.** Record bindings in the pool without a process call. Each render
    installs them later. This removes one preparation step, but changes the
    tested replay and moves failures to the first render. Effort: Medium.
  - **G.** Apply B and also rank bundle calls by the live generation that
    seeding restores. This repeats the seed choice without measured evidence
    of that cost. Effort: Medium.
- **Left out:** More processes break the configured bound. Sharing one process
  between roots breaks process isolation. Waiting for a busy holder leaves
  available capacity unused. Eager replay into every idle process does not
  avoid duplicate preparation. Recency is only a proxy for loaded state and
  changes oldest-idle replacement. A lease across bundle, maps, and describe
  holds capacity during core work and can deadlock a one-slot PostCSS call.
- **Wider fix:** D covers both reuse and replacement. B provides a ranking
  function that C and D can extend later.
- **Previous examples:** PR #313 protects one warm head process. PostCSS
  context affinity already selects a process that holds required state.
- **Recommendation:** B. It directly removes the measured redundant work
  without changing replacement or startup.
- **Action:** fix now, apply B. The performance orchestrator selected B on
  2026-11-18 under the user's delegation of 2026-11-16.

The fresh second-pass options check retained B on 2026-11-18. It added F
and G and corrected E. Its full report is under
`.context/sidecar-generation-affinity/reports/options-check.md`.

Shared assumptions and their sources:

- The source root remains the first eligibility boundary. The task and the
  source root workers contract require it.
- Existing slot records are sufficient. The task forbids new state that grows
  with time and forbids extra processes.
- The call can take an available non-holder. The task requires parallel
  renders to use every available slot.
- The retained binding identity matters. Preparation compares `Arc` identity
  to detect a newer binding payload for the same generation.
- Bindings currently run on a process. This comes from code, not a required
  boundary. F drops that assumption and would need a separate decision.

Performance orchestrator's calls, 2026-11-18:

- Prefer a same-root idle holder with the description and any maps or bindings
  the call needs. Next prefer another holder. Then use the existing order.
- Read only existing slot records. Keep the configured process bound.
- Keep the warm head rule, return pass, pass preference, and root isolation.
- Never wait for a busy holder when another slot can run the call.
- Apply B now. Keep C and D open, with evidence, in the existing follow-up.

### 2. Preserve the return pass selection boundary

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** Performance.
- **Location:** `crates/mokly-sidecar/src/pool_affinity.rs`.
- **Terms:**
  - **Return pass:** background work that returns idle base processes to the
    head root after Serve publishes Changes.
- **Background:** A later base call currently prefers a same-root process
  outside the return pass. This keeps sequential base calls from consuming
  every return candidate.
- **Problem:** An unrestricted same-root ranking could reverse that preference
  when a return candidate holds more loaded state.
- **Impact if no action:** Fewer processes return to the head root before the
  next edit.
- **Root question:** How should loaded-state reuse preserve the head capacity
  that the return pass provides?
- **Options:**
  - **A.** Rank loaded state before pass membership. This can consume more
    return candidates. Effort: Small.
  - **B.** Keep the existing pass preference first. Rank loaded state within
    each eligible same-root group, then use FIFO ties. Effort: Small.
  - **C.** Reserve return candidates from base requests entirely. This can
    leave idle capacity unused. Effort: Medium.
- **Left out:** Ending the return pass changes an explicit task requirement.
  Ranking only head requests gives up base preparation reuse without improving
  return-pass preservation.
- **Wider fix:** B gives the ranking a policy boundary that later replacement
  work can extend without overriding the pass preference.
- **Previous examples:** The Later Base Work rule in the source root
  scheduling contract requires outside-pass preference.
- **Related:** Decision 1 shares the selection function and depends on this
  ordering to preserve PR #313.
- **Recommendation:** B. It meets both generation affinity and the explicit
  requirement to preserve pass preference.
- **Action:** fix now, apply B. This is this workspace orchestrator's call of
  2026-11-18. The task requires both rules, so pass preference stays first.

Shared assumptions: pass preference remains mandatory, from the task and the
source root scheduling contract. Context affinity remains stronger than all
other selection rules, from the PostCSS contract. Both remain valid.

### 3. Preserve replay tests under affinity

- **Severity:** Medium. **Effort:** Small.
- **Source:** Implementation.
- **Category:** Test.
- **Location:** `crates/mokly-sidecar/src/_tests_/pool_reload_tests.rs`.
- **Terms:**
  - **Lease:** a request's exclusive use of a pool slot until release.
- **Background:** Two existing tests prove map and binding replay on a second
  process. Their fixtures put that process first in the idle queue while a
  fully prepared process remains idle.
- **Problem:** Correct generation affinity selects the prepared process.
  The fixtures then exhaust that process's expected mock calls. The task
  separately requires every existing pool test to remain unchanged.
- **Impact if no action:** The sidecar crate run fails, and the complete gate
  cannot pass with both constraints intact.
- **Root question:** Which should give way to preserve second-process replay:
  the unchanged text of two tests, or generation ranking for render calls?
- **Options:**
  - **A.** Keep the prepared process leased while the second process replays.
    Adjust only the two fixtures. Keep every assertion, payload, event count,
    and timeout. Take each lease while its slot is the only idle slot.
    Lease the second worker before the first returns. Effort: Small.
  - **B.** Rebuild the two fixtures around concurrent public requests and
    explicit worker barriers. This proves busy state with more harness code.
    Keep the same replay assertions. The binding fixture needs a barrier in
    the first worker's memory probe after the new payload is recorded.
    Effort: Medium.
  - **C.** Rank only calls that do not render. Keep FIFO order for renders.
    Both fixtures then stay unchanged, but renders can restore a generation
    that an idle process holds. Change decision 1, its docs, and new render
    selection tests. Repeat branch measurements. Effort: Medium.
- **Left out:** Leaving the fixtures unchanged keeps the gate red. Reverting
  generation affinity fails the approved goal. Special test detection in the
  selector hides the conflict. Moving assertions to a private helper loses
  the real request path. Changing worker expectations to follow affinity
  removes the second-process replay that these tests prove. Disabling rank
  only for tests covers a policy that production never runs. Preferencing
  non-holders adds replay that C avoids. A shared helper for passing fixtures
  changes tests outside this correction.
- **Wider fix:** A makes each target the only eligible slot, so later ranking
  changes cannot reroute the call. A shared lease helper for queue-steering
  fixtures belongs in a follow-up because those other tests still pass.
- **Previous examples:** `pool_scheduling_tests.rs` already uses explicit
  leases. `equal_bindings_keep_the_shared_revision_on_both_workers` also
  steers through the idle queue and currently passes because both slots tie.
- **Related:** Decision 1 changes the selection that these fixtures assumed.
- **Recommendation:** A. An explicit lease changes only the fixture's busy
  state and preserves the replay coverage and operation counts.
- **Action:** fix now, apply A. The performance orchestrator approved this
  setup-only correction on 2026-11-18 under the user's delegation of
  2026-11-16. The unchanged-tests rule prevents weaker coverage. Explicit
  leases retain second-process replay through the real request path and
  replace obsolete idle-queue steering. C loses useful render ranking.
  B adds harness code without extra coverage.

Shared assumptions: replay must reach the real pool request path, from the
existing tests and the testing skill. All assertions, payloads, counts, and
deadlines stay, from the task's prohibition on weakened tests. A and B keep
the render ranking from decision 1. C drops that assumption to preserve the
literal unchanged-tests requirement.

The fresh second-pass options check retained A on 2026-11-18. It added C,
corrected the root question, and confirmed the lease ordering. Its report is
`.context/sidecar-generation-affinity/reports/decision-3-options.md`.

### 4. Obtain a safe matched local measurement

- **Severity:** Medium. **Effort:** Small.
- **Source:** Implementation.
- **Category:** Performance.
- **Location:** `scripts/large/memory.ts` and the ignored measurement harness.
- **Terms:**
  - **Memory stop:** the aggregate harness RSS ceiling that ends a benchmark
    before it can exhaust the host.
- **Background:** This host has 7,941 MiB RAM. Preflight checks show more than
  6,000 MiB available while other heavy work is idle. The existing benchmark
  default stops the complete harness above 1,750,000 KiB.
- **Problem:** That stop censored the basic and React baseline before Changes
  became ready. A minimal React diagnostic instead failed base validation.
  The branch completed the smaller React fixture, but no matched JavaScript
  edit pair exists under the default ceiling.
- **Impact if no action:** The local report has stopped baseline attempts
  rather than the requested JavaScript before/after times. Cloud acceptance
  remains with the performance orchestrator.
- **Root question:** How can the local evidence obtain matched JavaScript
  edits without risking exhaustion of the shared host's memory?
- **Options:**
  - **A.** Keep the default ceiling. Report the censored local measurements
    and rely on the separate cloud acceptance run. Effort: Small.
  - **B.** Apply the same smaller Node heap limit to both versions. It can
    change garbage collection and the measured workload. Effort: Small.
  - **C.** Run a separately labelled matched profile with a 3 GiB aggregate
    harness ceiling. Require at least 5 GiB available before each run. Keep
    four sidecars and unchanged runtime flags, time limits, and fixtures.
    Retain every default-profile failure. Observed sampling overshoot leaves
    about 1.8 GiB of the required preflight headroom. Effort: Small.
  - **D.** Diagnose and correct the minimal fixture's dependency-root failure
    before another diagnostic. Its cause is not yet established, and that
    workload still differs from the requested defaults. Effort: Medium.
  - **E.** Run a labelled two-sidecar profile under the default ceiling.
    This uses the benchmark default, but differs from the cloud pool and
    changes the head and return behaviour being measured. Effort: Small.
  - **F.** Add a transient systemd scope outside the runner control group,
    with a hard memory cap and no swap. It needs root on the shared host
    and can affect I/O near its cap. Effort: Medium.
  - **G.** Apply C and read host `MemAvailable` at every sample. Stop the
    complete owned process tree when it falls below 1.5 GiB. Record that
    failure separately. Keep this addition in the ignored scratch harness.
    Do not route the stop through the sampling-error path. Effort: Small.
  - **H.** Run the same four-sidecar fixtures on a larger host. It needs
    the performance orchestrator's infrastructure and new builds there.
    Effort: Medium.
  - **I.** Make the tracked harness derive its default from available memory,
    retain a reserve, and check a live floor. This changes a documented
    default and adds a stop, so it requires a separate decision. Effort: Medium.
- **Left out:** No memory ceiling risks exhaustion. Repeating the stopped
  profile can select a chance result near the ceiling. Reducing only the
  harness overhead leaves the process tree near the default stop. Excluding
  the harness from the sum loses protection that G retains.
- **Wider fix:** I removes repeated manual choices for later hosts. It stays
  in a follow-up because it changes tracked tooling outside this pool change.
- **Previous examples:** `scripts/large/memory.ts` already accepts a stop
  value separately from its default. The existing large benchmark liveness
  follow-up records a 6 GiB stop on a 16 GiB host.
- **Recommendation:** G, replacing the first recommendation C. It preserves
  the workload and also detects memory used by other sessions during a run.
- **Action:** fix now, apply G. This is this workspace orchestrator's call
  of 2026-11-18. The existing README permits a larger configured stop on a
  host with enough memory. The stop is no acceptance budget or test assertion.
  The preflight, ceiling, and live floor meet the user's memory requirement.

Shared assumptions: the task requires no memory exhaustion and unchanged time
allowances. Four local sidecars are this workspace orchestrator's measurement
choice to match the cloud pool, not a separate user requirement. E drops it.
The code and fixture README provide a configurable safety ceiling, not a Serve
RSS acceptance budget. Available memory comes from retained preflight records.
B drops unchanged runtime flags. F changes the enforcement boundary, G drops
reliance on preflight alone, and H changes the measuring host.

The fresh second-pass options check retained A to D and added E to I. It
confirmed G as a design call rather than a user decision. Its report is
`.context/sidecar-generation-affinity/reports/decision-4-options.md`.

The complete gate is independent of this measurement decision. It can run
while the additional profile waits. No benchmark runs beside the gate.

## Implementation shape

The existing generation accessor identifies calls that name generations.
The implementation shares call prerequisites with replay and reuses cleanup's
staleness predicate. This workspace orchestrator records that call on
2026-11-18, because both paths must agree on loaded state.
A small pure ranking function reads the slot's existing records. A slot
holds a generation only when its bundle exists and its recorded epoch matches
the current epoch. Scheduling uses the same staleness rule as cleanup, because
selection runs before cleanup. Every lookup tolerates a missing record and
counts it as not loaded. These are this workspace orchestrator's calls of
2026-11-18, confirmed by the options check. They preserve the existing cleanup
contract and acquisition of unknown generations.

The function ranks
fully prepared holders before other holders and non-holders. Binding calls
need the description and maps but do not need the old bindings. Render calls
need the current shared binding payload, the description, and maps. A CSS maps
call does not need the old maps. No call mutates pool state during ranking.

Calls without a generation keep today's ordering. PostCSS context affinity
keeps its existing path. A busy holder is not an idle candidate. The fallback
still leases a non-holder or empty slot immediately. Source root replacement,
process lifetime, generation release, and retained recipe bounds do not change.

The related `serve-sidecar-prestart.md` item changes startup handover.
`root-switch-reap-wait.md` changes process replacement and reap confirmation.
This ranking changes neither path. Both items stay open. Existing replacement
behaviour can briefly exceed the live process bound, as that item records.
This branch must add no replacement and no process beyond today's behaviour.

The first options check confirmed all supplied design calls against PR #313.
Its five clarifications are incorporated above and in the documentation and
measurement TODOs. The later fixture scope decision is recorded separately.

## Milestone 1: Documentation and protocol — completed

Depends on: none

- [x] Delegate the source root scheduling B rule to the docs implementor.
      Use a linked status line until implementation is complete.
- [x] Record the performance orchestrator's B call in the loaded-state
      follow-up. Keep C and D open with their evidence and related items.
- [x] Check related startup and reap items for conflicts. Update the crate
      README's changed same-root scheduling rule. Check the general transport
      statement about spreading independent calls against sequential reuse.

## Milestone 2: Generation ranking and regression coverage — completed

Depends on: 1

- [x] Delegate the call-aware same-root ranking to the non-ui implementor.
      Use only existing state and preserve FIFO ties and pass preference.
- [x] Prove red first: an available holder beats an earlier FIFO non-holder,
      and a fully prepared holder beats another holder.
- [x] Cover fallback when holders are busy or unavailable. Cover FIFO calls
      without a generation. Cover current binding identity and required maps.
- [x] Prove renders can lease every available slot and never create more slots
      than the configured pool size. Keep existing pool tests unchanged.
- [x] Resolve decision 3 through the performance orchestrator, and apply the
      selected fixture correction without weakening any assertion.
- [x] Record the shared lease helper for other queue-steering fixtures as a
      follow-up. Name both corrected fixtures and their reason in the PR body.
- [x] Run the new pool tests, each new asynchronous test ten times, and the
      real-process sidecar tests. Save red proof, pass counts, and added test
      cost under `.context/`.
- [x] Pass the complete sidecar crate tests after decision 3 is resolved.
- [x] Remove the protocol and README status lines when implementation meets
      them. Refresh changed selection pointers in the loaded-state follow-up.
      Update the README test summary and Key Code entry for the actual result.

## Milestone 3: Performance evidence

Depends on: 2

Baseline preparation and measurements do not depend on decision 3. They can
run while that fixture-only decision waits, under the task's instruction to
continue independent work. Branch verification still waits for that answer.

- [x] Delegate release-build measurements to the non-ui implementor. Use
      separate checkouts and target directories for last merged main and branch.
- [ ] Check disk and memory before each large Cargo build. Set
      `CARGO_INCREMENTAL=0`. Run Cargo builds one at a time.
- [ ] Measure Serve startup Changes and two edits on `examples/basic` and
      large HTML and React fixtures from `scripts/large/`. Use four sidecars.
- [ ] Record validation-to-input gap, render inputs, edit-to-Changes-ready,
      first Changes, sidecar count, and peak aggregate Serve RSS. Record root
      switches during each edit to check PR #313 preservation. Retain raw logs.
- [ ] Resolve decision 4 after its fresh options check. Keep every default
      profile failure and clearly label any additional bounded profile.
- [ ] Commit and push the implementation. Send its SHA to the performance
      orchestrator immediately for the `mokly-cloud` measurement.

Targets on `mokly-cloud`: reduce the gap from about 250 ms below 60 ms and
edit-to-Changes-ready by at least 0.15 s. First Changes must not rise beyond
5%. Process count must not exceed the pool size. Peak RSS must stay within
noise. Local fixtures provide before/after evidence rather than a substitute
for that catalogue. Record limitations and await the orchestrator's result.

Evidence files: `.context/sidecar-generation-affinity/` holds the options
check, delegation reports, measurements, and verification logs.

## Milestone 4: Verification, review, and pull request

Depends on: 1, 2

The gate can run while the additional measurement profile waits. Review and
the pull request still require Milestone 3's evidence and decision outcome.

- [ ] Run targeted tests, the early repository suite, and the complete gate.
      Put Git 2.45 or later in its own first PATH directory. Install git-lfs
      and the pinned Bun. Name every failure, skip, or blocked suite.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` after the push,
      with the implementation-review skill. Run fresh finding checks, apply
      the fix rule, allow two fix rounds, and re-review once. Record remaining
      work in follow-up items and report it to the performance orchestrator.
- [ ] Delete this plan under the plans skill. Preserve its dated calls and a
      permalink in the pull request description.
- [ ] Open the pull request into `main`. Run `scripts/ci-wait.sh` after each
      CI trigger. Fix branch failures. Report each unrelated failure and rerun
      it once. Send the final report to the performance orchestrator. Do not merge.
