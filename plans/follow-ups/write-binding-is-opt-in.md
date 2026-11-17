# A write control can skip its busy binding

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-06, the wider fix split off finding 81 of the round 1 review of `calummoore/skeleton-sizing-mismatch` (`plans/loading-states-match-content.md`).
- **Location:** `apps/app/src/components/action.tsx` (`ActionWrite`), `apps/app/src/settings/write.ts` (`Write.disabled`), `rules/typescript/derive-disabled-from-write.yml`, and the 32 call sites that pass `write` to `Action`.
- **Reason:** It touches every write control and a lint rule, while the review fixed the three controls that skipped the binding.
- **Category:** Code structure.

- **Terms:**
  - **Binding:** Passing a control's write and operation to `Action`, which then draws the busy state, the working word and the screen-reader status.
- **Background:** `docs/protocol/cloud/folio-chrome.md` (Write in progress) says that the pressed control shows its wait. `Action` draws it only when the call site passes `write` and `operation`. A call site can still read `write.disabled` and pass only a label, and three viewer controls did that until the review fix.
- **Problem:** The binding is opt-in, so a new write control can again send a write with no busy state.
- **Impact if no action:** The next write control that copies the old pattern shows no wait, and no check reports it.
- **Root question:** How does every control that sends a write show its busy state, with no way to skip it?
- **Options:**
  - **A.** Make the bound write the only way that a control refuses a press for its write: `Action` takes the refusal from the bound write, and `Write` stops exposing `disabled`. Update the 32 call sites and the message of `derive-disabled-from-write.yml`. Effort: Medium.
  - **B.** Send the viewer's build-request controls through one component keyed by `RequestControl` in `apps/app/src/viewer/request-controls.ts`. It covers the viewer only. Effort: Medium.
  - **C.** Add an ast-grep rule that flags an `Action` that reads a write's `.disabled` without passing `write`. Effort: Small.
- **Left out:** Manual spinners at each call site. `Action` already draws the busy state.
- **Wider fix:** A. It removes the path that the three controls took.
- **Previous examples:** Finding 81: Publish, Try again and Cancel read `write.disabled` and passed no `write`.
- **Recommendation:** A. It is structural and covers every write control.
- **Action:** fix after merge, apply A, because it changes every write control and a rule outside the change that found it. Option C would be a new lint, which needs the user.
