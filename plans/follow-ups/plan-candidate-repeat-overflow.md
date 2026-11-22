# A repeat collector call can drop candidate names

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-22, from review finding 1 of branch `calummoore/mokly-plan-candidates-cpu-khht`: the blocked wider fix of its finding check.
- **Location:** `packages/mokly/src/sidecar/plan-candidates.ts`, the methods `path`, `file`, and `add` of `PlanCandidates`; `packages/mokly/src/sidecar/plan-candidate-names.ts`, `nameChargeBound`; `tests/helpers/reference_plan_candidates.ts`; `tests/sidecar_plan_candidates_reference.test.ts`.
- **Reason:** The change would alter overflow decisions that the collector makes on `main`, and only the user can change that behaviour.

- **Terms:**
  - **Collector:** `PlanCandidates`, which collects the plan-only candidate names of a captured compile under a charge budget of 8,388,608 bytes. When a charge does not fit, it sets `overflow`, and the plan keeps no candidate names.
  - **Repeat:** a collector call that adds no name and no byte, because every name that it would add is already stored. Examples: a duplicate `add`, the rest of a `path` walk above a stored pair, and a repeated `file(base)` call.
  - **Room bound:** `nameChargeBound(length)`, `3 + 6 × length`. A shortcut skips a repeat only when the free room is at least this bound for the strings that the repeat would test.
- **Background:**
  - Since 2026-11-22, the collector skips repeats to save CPU: about 200 ms per fresh mokly-cloud bundle. It keeps every overflow decision of the earlier collector exactly.
  - The earlier `add` tests the JSON bytes of a name before its duplicate test. So a duplicate name sets `overflow` when the free room is smaller than its bytes, although the call adds nothing.
  - To keep that decision, each shortcut checks a room bound first: the walk stop checks the bound of the current path, the duplicate test of `add` checks the bound of the name, and a repeated `file(base)` checks the bound of the base plus the longest extension plus 5.
  - The differential test compares the collector with a frozen copy of the earlier collector. It must reach the rooms where each bound decides, so that a weakened bound fails.
- **Problem:** The overflow of a repeat protects no bound, because the repeat adds no byte. It comes only from the order of two tests in the earlier code. The three room bounds and their test cases exist only to keep that order.
- **Impact if no action:** The collector keeps the three room bounds and their test cases. A catalogue near the budget can lose its candidate names because of a call that adds nothing. Editor files then defeat plan reuse in that catalogue.
- **Root question:** Should a collector call that adds no name and no byte be able to end candidate collection?
- **Options:**
  - **A.** Change nothing. A repeat near the limit can still set `overflow`, as the earlier collector did. Effort: Small.
  - **B.** A repeat never sets `overflow`. A walk stops at the first stored pair, a completed base and a stored duplicate return at once, and the three room bounds and `nameChargeBound` go. `overflow` then follows only from a charge that does not fit. The frozen reference and the differential test change to the new rule, and the change records the new behaviour. Near the limit, plans keep their names more often. Effort: Medium.
- **Left out:** A duplicate test before the byte test in `add` alone. It changes the same kind of decision as B with less gain, because the walk stop and the repeated `file` call keep their bounds.
- **Wider fix:** None. B is the whole change.
- **Previous examples:** None found.
- **Recommendation:** A, until a catalogue near the budget shows the cost. On 2026-11-21 the mokly-cloud collectors peaked at 67.4% (head) and 73.9% (base) of the budget, so B changes no record there, and the bounds cost almost no CPU.
- **Action:** ask the user, because B changes overflow decisions of the collector on `main`.
