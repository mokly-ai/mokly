# Failed details keep a waiting highlight reason

- **Severity:** Low. **Likelihood:** Common. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-30, from the branch `calummoore/mokly-ui-controls`, during the control mockup work of the shell views plan.
- **Location:** `packages/viewer/src/shell/workspace_inspection_runtime.ts`, `inspectionAvailability`, which picks the reason that the Highlight components toggle shows while the inspection is unavailable.
- **Reason:** The behaviour is older than the shell views plan, which keeps the shell's output unchanged.

- **Source:** Implementation.
- **Category:** Product bug.
- **Terms:**
  - **Highlight components toggle:** the header control that turns the
    component mask over a preview on and off. When highlighting is
    unavailable, the toggle is disabled and shows a reason as its tooltip and
    as its screen reader description.
  - **Entry details:** the per-entry JSON that the shell loads before it can
    list a preview's component instances.
- **Background:**
  - While the entry details of a screen or component load, the toggle is
    disabled with the reason "Waiting for the component preview."
  - When the details request fails, the shell shows the failed state with
    Try again in its panels.
  - The milestone 7 work of the shell views plan checked this in the live
    shell on 2026-10-30 by blocking the details request.
- **Problem:** After the details request fails, the toggle still says
  "Waiting for the component preview.", although nothing is waiting any
  more.
- **Impact if no action:** A reader is told to wait for a preview that will
  not arrive until they press Try again.
- **Root question:** What does the toggle say when the preview's evidence
  failed to load?
- **Options:**
  - **A.** Keep the waiting sentence. Effort: Small.
  - **B.** Show "This preview could not be loaded." after a failed details
    request, as the stage does, and the waiting sentence only while a
    request runs. Effort: Small.
  - **C.** B, and derive every disabled reason from the route's delivery
    state in one function, so a new delivery state cannot leave a stale
    reason. Effort: Medium.
- **Left out:** Hiding the toggle after a failure, because the header keeps
  its controls in every state.
- **Wider fix:** C.
- **Previous examples:** None found.
- **Recommendation:** C. One delivery-state owner gives every disabled reason
  the actual request state. The record first recommended B.
- **Action:** fix after merge, apply C, because the shell views change preserved
  the existing behaviour and left its state correction for a separate branch.
