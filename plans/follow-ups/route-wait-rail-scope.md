# Which scope the wide settings route's wait draws

- **Severity:** Low. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-06, from the check of finding 83 of the round 2 review of `calummoore/skeleton-sizing-mismatch` (`plans/loading-states-match-content.md`).
- **Location:** `packages/app/src/settings/route-wait.tsx` (the rail of the wide durable route's wait) and `docs/protocol/cloud/settings-dialog-states.md:12`.
- **Reason:** The protocol is silent on which address the wide route's wait reads, so the user decides which side is right.
- **Category:** Docs or spec.

- **Terms:**
  - **Wide durable route:** A settings address such as `/{workspace}/-/settings/billing` opened on a wide surface; it reads where to hand over, then replaces itself with the dialog over that page.
  - **Rail:** The list of settings sections and panes beside the open pane.
- **Background:** While the settings scope loads, the rail draws the sections that the address's scope gives an owner (`settings-dialog-states.md`). The wide durable route's wait draws the dialog until it hands over to the page beneath, which may be a project. To keep the rail from growing at the hand-over, the wait draws the Project section on every route, also on workspace and account routes whose address names no project.
- **Problem:** On a workspace or account route, the wait draws Project entries that the route's own address does not give, while `settings-dialog-states.md` and `settings-dialog.md` give the rail only the sections of the address's scope.
- **Impact if no action:** The wait's rail shows sections that the requirement does not list for that address; with the fix of finding 83 they are disabled until the hand-over.
- **Root question:** Which address does the wide route's wait read for its rail: the route's own address, or the destination that it hands over to?
- **Options:**
  - **A.** Keep the Project section, disabled until the hand-over, and say in `settings-dialog-states.md` that the wide route's wait reads the destination's sections. Effort: Small.
  - **B.** Draw the rail from the route's own address; the Project section appears at the hand-over as the last group and moves nothing above it. Effort: Small.
- **Left out:** Guess the project. It can name the wrong project.
- **Wider fix:** None.
- **Previous examples:** None found.
- **Recommendation:** B. It follows the requirement as written, and the new group appears below everything else.
- **Action:** ask the user, because the protocol is silent and each option decides which side is right.
