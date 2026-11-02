# Viewer docs and requests disagree on credentials

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-01, from the branch `calummoore/mokly-viewer-responsibilities`: outside the scope of the options check of the plan for the viewer's leftover layers.
- **Location:** `packages/viewer/README.md:185-186`, `docs/protocol/mokly-shell-fences.md:49`, `docs/protocol/mokly-comparison-panes.md:27-29`, `packages/viewer/src/shell/comparison_request.ts:51-55`, `packages/viewer/src/shell/comparison_request.ts:96-100`, `packages/viewer/src/previews/presentation.ts:120-124`, and `packages/viewer/src/standalone/live_source.ts:67-70`.
- **Reason:** One answer changes a protocol requirement, and no recorded decision says which side is right.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Live delivery:** a comparison that Serve prepares on request, as
    opposed to the pinned comparison of a static build.
- **Background:**
  - `packages/viewer/README.md:185-186` says that the viewer "reads no
    cookie, and uses no ambient credential".
  - `docs/protocol/mokly-shell-fences.md:49` makes every read-model fetch use
    `credentials: "omit"`.
  - `docs/protocol/mokly-comparison-panes.md:27-29` makes pane documents use
    `credentials: "same-origin"` in live delivery.
  - These viewer requests send `same-origin`: the Serve selection and its
    renewal, live pane documents, the live render, and the live render
    expiry check.
  - Serve reads no cookie. It checks only the origin and a token header, in
    `crates/mokly-server/src/security.rs:23-34`.
- **Problem:** The README promises no ambient credentials, but live requests
  send them. The pane contract gives no reason for `same-origin`.
- **Impact if no action:** A reader of the README trusts a promise that live
  requests break.
- **Root question:** Which credentials does each viewer request send?
- **Options:**
  - **A.** Change the README to say that live Serve requests send
    same-origin credentials. Effort: Small.
  - **B.** Make every viewer request omit credentials, and edit
    `mokly-comparison-panes.md:27-29`. Effort: Medium.
- **Left out:** Changing nothing fails the goal, because the README and the
  requests disagree.
- **Wider fix:** B, because one rule then serves every request.
- **Previous examples:** None found.
- **Recommendation:** B. Serve reads no cookie, so one rule costs nothing in
  behaviour and keeps the README true.
- **Action:** ask the user, because B changes a protocol requirement.
