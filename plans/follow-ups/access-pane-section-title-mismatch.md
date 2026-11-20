# Access pane section titles differ

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-29, from [PR #77](https://github.com/mokly-ai/mokly-cloud/pull/77).
- **Location:** `docs/mockups/src/screens/product/settings/access-pane.tsx:68` and `packages/app/src/settings/panes/access-pane.tsx:29`.
- **Reason:** No requirement chooses between the app title and the mockup title, so the user must choose.
- **Checked:** 2026-10-31, at commit `f568853e`. The titles still differ, and neither owning protocol chooses one. The wording choice remains pending.
- **Category:** UX wording (estimate).

- **Background:** The Access pane of the project settings dialog lists the inherited workspace access and the project's own grants. The mockup `docs/mockups/src/screens/product/settings/access-pane.tsx` draws the pane. The app pane `packages/app/src/settings/panes/access-pane.tsx` implements it. Both give the inherited section the description "Everyone in the workspace already has this access."
- **Problem:** The title of the inherited section differs. The mockup says "From Mokly". The app says "From the workspace", and `packages/app/src/_tests_/settings/panes.spec.ts:96` expects that text. The same difference was on `origin/main` before the rename of PR #77.
- **Impact if no action:** The design specification shows a title that the product does not show. A reviewer who compares the two finds a difference that nobody chose.
- **Root question:** Which title names the inherited workspace access in both the mockup and the app?
- **Options:**
  - **A.** Change the mockup title to "From the workspace". The app and its test stay. Effort: Small (estimate).
  - **B.** Change the app title to "From Mokly", and change the app test. Effort: Small (estimate).
  - **C.** Do A, and widen the parity suite to compare section titles. This adds stricter validation, so it needs the user's approval. Effort: Medium (estimate).
- **Left out:** Keep both titles. It leaves the mockup and the product out of step.
- **Wider fix:** C. The parity suite in `docs/mockups/src/_tests_/app-parity.ts` compares control labels, pending labels and state titles only. It does not read section titles.
- **Previous examples:** `plans/follow-ups/workspace-pane-mockup-lacks-role.md` records another pane difference that the parity suite does not see.
- **Related:** `plans/follow-ups/parity-skips-pane-facts-and-links.md`, same class. It holds the open choice to widen the parity suite to fact values and external-link labels.
- **Recommendation:** A (estimate). The inherited grants come from the workspace, and the section description already says so.
- **Action:** ask the user, because condition 3 holds. A and B choose between the mockup and the product. C adds stricter validation. No user choice is recorded.
