# Pass priority forgets an unchanged open view

- **Severity:** Low. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-22, from the branch `calummoore/mokly-viewer-live-update-lpaj`, which added the request order of the background pass.
- **Location:** `crates/mokly-server/src/requested_routes.rs` (`RequestedRoutes::rebuild`), `docs/protocol/mokly-on-demand-background.md` (Window And Lookup).
- **Reason:** The fix changes the approved start-order rule of the background pass, so the user decides it.

- **Source:** Design.
- **Category:** Performance.
- **Terms:**
  - **Background pass:** the Serve work after each rebuild that renders every view whose `documentKey` changed, on the sidecar workers.
  - **Requested routes:** the document routes that the browser asked Serve for; Serve records them, most recent first, bounded by the catalogue.
  - **Generation:** the published state between two rebuilds.
- **Background:**
  - The user decided on 2026-11-22 that the pass starts first the views whose documents a request asked for since the previous rebuild, the most recently requested first, and then the other views in catalogue order. The rule is in `docs/protocol/mokly-on-demand-background.md`, Window And Lookup.
  - The viewer requests a frame document again only when its `documentKey` changed. So during a generation in which the open view did not change, the viewer requests nothing.
  - On mokly-cloud, a frame document that waits for the pass waits 72 to 131 ms. Before the rule, this happened in 8 of 24 warm edits of the open view.
- **Problem:** When an edit does not change the open view, the next generation has no request for it. The edit after that, which does change the open view, then gets no priority, and its frames can wait behind other views again.
- **Impact if no action:** After an edit that changes only other views, the next edit of the open view can show its second frame up to about 130 ms late, as before the rule.
- **Root question:** How does the pass know which documents an open viewer waits for, when the viewer asked for none in the last generation?
- **Options:**
  - **A.** Keep the rule. Effort: Small.
  - **B.** Keep the requested routes across a rebuild in which no request arrived, still bounded by the catalogue and most recent first. Change the rule to "since the last request". Effort: Small.
  - **C.** The viewer tells Serve its mounted routes with a request after each refresh. It adds a request and a route. Effort: Medium.
- **Left out:** A fixed time window of recent requests: the constraints of the change forbid timers in product code.
- **Wider fix:** None. The rule has one owner.
- **Previous examples:** None found.
- **Recommendation:** B. It keeps the open viewer's priority through unrelated edits, with the same bound and no new boundary.
- **Action:** ask the user, because B changes the approved start-order rule of the background pass.
