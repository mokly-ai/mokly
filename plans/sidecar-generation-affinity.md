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

## Implementation shape

The existing generation accessor identifies calls that name generations.
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

The options check confirmed all supplied design calls against PR #313. Its
five clarifications are incorporated above and in the documentation and
measurement TODOs. No new user decision is required.

## Milestone 1: Documentation and protocol

Depends on: none

- [ ] Delegate the source root scheduling B rule to the docs implementor.
      Use a linked status line until implementation is complete.
- [ ] Record the performance orchestrator's B call in the loaded-state
      follow-up. Keep C and D open with their evidence and related items.
- [ ] Check related startup and reap items for conflicts. Update the crate
      README's changed same-root scheduling rule. Check the general transport
      statement about spreading independent calls against sequential reuse.

## Milestone 2: Generation ranking and regression coverage

Depends on: 1

- [ ] Delegate the call-aware same-root ranking to the non-ui implementor.
      Use only existing state and preserve FIFO ties and pass preference.
- [ ] Prove red first: an available holder beats an earlier FIFO non-holder,
      and a fully prepared holder beats another holder.
- [ ] Cover fallback when holders are busy or unavailable. Cover FIFO calls
      without a generation. Cover current binding identity and required maps.
- [ ] Prove renders can lease every available slot and never create more slots
      than the configured pool size. Keep existing pool tests unchanged.
- [ ] Run targeted pool and sidecar tests. Run each new asynchronous test ten
      times. Save red proof, pass counts, and added test cost under `.context/`.
- [ ] Remove the protocol status line when the implementation meets it.

## Milestone 3: Performance evidence

Depends on: 2

- [ ] Delegate release-build measurements to the non-ui implementor. Use
      separate checkouts and target directories for last merged main and branch.
- [ ] Check disk and memory before each large Cargo build. Set
      `CARGO_INCREMENTAL=0`. Run Cargo builds one at a time.
- [ ] Measure Serve startup Changes and two edits on `examples/basic` and
      large HTML and React fixtures from `scripts/large/`. Use four sidecars.
- [ ] Record validation-to-input gap, render inputs, edit-to-Changes-ready,
      first Changes, sidecar count, and peak aggregate Serve RSS. Record root
      switches during each edit to check PR #313 preservation. Retain raw logs.
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

Depends on: 1, 2, 3

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
