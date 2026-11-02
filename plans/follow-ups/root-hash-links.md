# The two roots handle hash links differently

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-01, from the branch `calummoore/mokly-viewer-responsibilities`: Milestone 5 of the plan for the viewer's leftover layers kept this difference under its design call 1.
- **Location:** `packages/viewer/src/shell/store_browser_routes.ts:29` (`eligibleShellAnchor`) and `packages/viewer/src/shell/store_host_routes.ts:143` (`ownedCatalogueUrl`).
- **Reason:** No protocol doc states what a shell link with a hash to another catalogue destination does, so the merged code kept each root's behaviour.

- **Source:** Implementation.
- **Category:** Product bug.
- **Terms:**
  - **Standalone root:** the Browse shell that Serve and the static build deliver as their whole page.
  - **Embedded root:** the Browse shell that a React host renders with the `MoklyViewer` component.
  - **Shell link:** a link in the shell's own markup to a catalogue destination under `/view/`.
- **Background:** Both roots route a shell link inside the shell, without a page load. Both leave a link to the same document with only a hash to the browser, as the navigation rules say.
- **Problem:** For a shell link with a hash to another catalogue destination, the standalone root routes it inside the shell, and the embedded root leaves it to the browser. An embedded host then gets a page navigation that the viewer does not handle.
- **Impact if no action:** The same link behaves differently in Serve and in a React host.
- **Root question:** Who handles a shell link with a hash to another catalogue destination?
- **Options:**
  - **A.** Both roots route it inside the shell, as the standalone root does, and keep the hash as the route's fragment. Add the rule to the protocol. Effort: Small.
  - **B.** Both roots leave it to the browser. Effort: Small.
  - **C.** Keep both behaviours, and state the difference in the protocol. Effort: Small.
- **Left out:** None.
- **Wider fix:** A, because one eligibility rule then serves both roots.
- **Previous examples:** None found.
- **Related:** `plans/follow-ups/root-route-announcements.md` and `plans/follow-ups/root-missing-link-destination.md`: other differences between the two roots that the same change kept.
- **Recommendation:** A. A shell link then never reloads an embedded host's page.
- **Action:** ask the user, because the fix adds a navigation rule that no protocol doc states.
