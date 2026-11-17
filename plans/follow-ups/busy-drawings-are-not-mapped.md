# No check maps a request control to its busy drawing

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-06, from the fix of review findings 41 and 81 on `calummoore/skeleton-sizing-mismatch` (`plans/loading-states-match-content.md`).
- **Location:** `apps/app/src/_tests_/viewer/stage-drawings.test.ts` and the parity rule in `docs/protocol/cloud/mockup-verification.md`.
- **Reason:** The fix adds a check and changes the parity rule, which the user decides.
- **Category:** Test.

- **Terms:**
  - **Request control:** A stage card control that sends a build request: Publish, Try again or Cancel. The app types the set as `RequestControl`.
  - **Busy drawing:** A catalogue drawing of a control while its write runs, such as `product/viewer/standalone/publish-busy`.
- **Background:** The app's stage drawing test maps each request control's refusal to its drawing through a map keyed by `RequestControl`, so a new control fails to compile until it names its refusal drawings. On 2026-11-06 the catalogue gained busy drawings of the three request controls, and `docs/mockups/src/_tests_/viewer-writes.test.ts` checks them.
- **Problem:** Nothing maps a request control to its busy drawing, so a new request control can ship with no busy drawing and no check reports it.
- **Impact if no action:** A future request control's busy state can go undrawn and unreviewed.
- **Root question:** How does each request control keep a drawing of its busy state?
- **Options:**
  - **A.** Change nothing; review catches a new control. Effort: Small.
  - **B.** Add a `busyDrawings` map keyed by `RequestControl`, as `refusalDrawings` is, and name busy drawings in the parity rule. Effort: Small.
- **Left out:** A lint. Option B gives the same result as a compile error.
- **Wider fix:** B.
- **Related:** `plans/follow-ups/write-binding-is-opt-in.md` makes the binding itself impossible to skip.
- **Previous examples:** `refusalDrawings` in the same test.
- **Recommendation:** B. It reuses the existing map shape.
- **Action:** ask the user, because B adds a check and changes the parity rule.
