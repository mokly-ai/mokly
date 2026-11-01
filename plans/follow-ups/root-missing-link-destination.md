# The two roots treat a link to an absent entry differently

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-01, from the branch `calummoore/mokly-viewer-responsibilities`: Milestone 5 of the plan for the viewer's leftover layers kept this difference under its design call 1.
- **Location:** `packages/viewer/src/shell/selection.ts:62`, `packages/viewer/src/shell/store_host.ts:258`, and `packages/viewer/src/shell/store_routes.ts`.
- **Reason:** No protocol doc states what a shell link to an absent entry does, so the merged code kept each root's behaviour.

- **Source:** Implementation.
- **Category:** Product bug.
- **Terms:**
  - **Standalone root:** the Browse shell that Serve and the static build deliver as their whole page.
  - **Embedded root:** the Browse shell that a React host renders with the `MoklyViewer` component.
  - **Controlled host:** a React host that passes the selection as a prop and commits each change itself.
- **Background:** `docs/protocol/mokly-navigation.md:205-209` gives the rule for a link inside a preview frame whose destination is missing: the standalone and uncontrolled roots show the missing view, and a controlled root reports an error and keeps its display.
- **Problem:** For a link in the shell's own markup to an absent entry, the standalone root shows the missing view and announces "Loaded Not found · Mokly". The embedded root, also when it is not controlled, reports "The requested catalogue selection is unavailable." and keeps its display.
- **Impact if no action:** An uncontrolled embedded viewer treats the same missing destination in two ways, by where the link sits.
- **Root question:** What does a root show when a shell link names an entry that the catalogue does not hold?
- **Options:**
  - **A.** Use the frame-link rule for shell links too: the standalone and uncontrolled roots show the missing view, and a controlled root reports the error. Effort: Small.
  - **B.** Every root reports the error and keeps its display. Effort: Small.
  - **C.** Keep both behaviours, and state the difference in the protocol. Effort: Small.
- **Left out:** None.
- **Wider fix:** A, because one miss rule then serves every link.
- **Previous examples:** None found.
- **Related:** `plans/follow-ups/root-route-announcements.md` and `plans/follow-ups/root-hash-links.md`: other differences between the two roots that the same change kept.
- **Recommendation:** A. It reuses the rule that the protocol already gives for frame links.
- **Action:** ask the user, because the fix adds a rule that no protocol doc states.
