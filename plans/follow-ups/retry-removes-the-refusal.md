# A retry removes the refusal and moves the control

- **Severity:** Low. **Likelihood:** Common. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-06, from the check of finding 41 of the round 1 review of `calummoore/skeleton-sizing-mismatch` (`plans/loading-states-match-content.md`).
- **Location:** `ts/app/src/settings/write.ts:181` (`run` clears the error when the retry starts) and `ts/app/src/components/write-failure.tsx`.
- **Reason:** Keeping the refusal on screen during a retry changes visible behaviour that no requirement states, so the user decides.
- **Category:** Product bug.

- **Terms:**
  - **Refusal:** The write-failure fragment: the cause line above the control and the request reference in a collapsed Details below it.
  - **Write in progress:** The composition in `docs/protocol/folio-chrome.md` that says the form keeps its layout and the pressed control keeps its place while its write runs.
- **Background:** When a write fails, its form draws the refusal around the control, and the control becomes the way to try again. When the reader presses it, the write clears the refusal at once and then runs.
- **Problem:** Clearing the refusal when the retry starts removes the cause line above the busy control and the Details below it, so the control and the content below it move while the retry runs. Write in progress says that the form keeps its layout and the pressed control keeps its place.
- **Impact if no action:** A retry still moves the form by the height of the refusal, the kind of move that the change of 2026-11-04 removed elsewhere.
- **Root question:** What does a form show above and below its control while a retry runs?
- **Options:**
  - **A.** Change nothing: the refusal clears when the retry starts. Effort: Small.
  - **B.** Keep the refusal on screen until the retry answers, then replace it with the new answer; announce a second identical refusal again. Effort: Medium.
- **Left out:** Reserve the refusal's height at rest. Every form would carry empty space.
- **Wider fix:** None.
- **Previous examples:** None found.
- **Recommendation:** B. It keeps the control in place, as Write in progress asks, and the old cause stays until the new answer replaces it.
- **Action:** ask the user, because B changes visible behaviour that no requirement states.
