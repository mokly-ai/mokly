# Two validators check the shape of a probe ready reply

- **Severity:** Low. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-27, from the review of branch `calummoore/preview-loading-issue-lcbo` (finding 12, wider fix).
- **Location:** `packages/frame/src/adapters/earlier_probe.ts`, `packages/frame/src/probe/schema.ts`.
- **Category:** Code structure.

- **Background:** `postMessageAdapter` accepts a version 4 `ready` through the wire schema, and a version 3 `ready` through its own check in `earlier_probe.ts`. Both checks test the channel, the nonce, and the exact fields.
- **Problem:** The two checks can drift apart. A test now covers the version 3 check, but nothing keeps the two in step.
- **Impact if no action:** A later change to one check can accept a reply that the other rejects.
- **Root question:** How can every wire version share one rule for the envelope of a reply?
- **Options:**
  - **A.** Make the envelope check take the version as a parameter, and use it for both versions. Effort: Medium.
- **Left out:** A test for the class of drift. It needs the user's approval and a shared check removes the drift itself.
- **Wider fix:** A.
- **Previous examples:** None found.
- **Recommendation:** A.
- **Action:** fix after merge, apply A, because it touches the current wire schema.
