# Warm head pause item overstates the return pass

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-19, from the round-1 review of the branch
  `calummoore/mokly-return-warmup`, list of problems outside the scope.
- **Location:** `plans/follow-ups/serve-pause-warm-head.md:172`, the
  **Previous examples** field.
- **Reason:** The sentence is older than the return warm-up branch, and a
  problem outside the review scope gets its fix in a separate branch.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Return pass:** Serve background work after each Changes publication.
    It replaces idle base sidecar processes with new head processes, one at a
    time.
  - **Hello:** the version handshake that a new sidecar process completes
    before it serves a request.
- **Background:** `plans/follow-ups/serve-pause-warm-head.md` cites the return
  pass as a previous example and says that it "never delays foreground work".
  The rules in `docs/protocol/mokly-sidecar-root-scheduling.md`, section
  Handover And Stop, say that a head request that waits during the hello of a
  returned process takes that process after the hello. Since the return
  warm-up, a request that waits for a warm-up process also waits for the call
  in flight, under `docs/protocol/mokly-sidecar-return-warmup.md`.
- **Problem:** The example claims more than the rules give. A foreground
  request can wait for a hello or for one warm-up call.
- **Impact if no action:** A reader of that item can take the return pass as
  proof that background pool work never delays a request, and design on that
  basis.
- **Root question:** How does the item describe the return pass as the rules
  define it?
- **Options:**
  - **A.** Change the sentence to say that the return pass delays a waiting
    request by at most one hello or one warm-up call. Effort: Small.
  - **B.** Apply A, and replace the description with a link to the Handover
    And Stop section, so the item does not restate the rule. Effort: Small.
- **Left out:** No change, because the sentence stays wrong. Fewer than three
  approaches are real, because the item either restates the rule correctly or
  points to it.
- **Wider fix:** B. A link cannot drift from the rule.
- **Previous examples:** `plans/follow-ups/follow-up-line-pointer-drift.md`
  records drift of other follow-up text after code moved.
- **Recommendation:** B.
- **Action:** fix after merge, apply B, because the text is older than the
  branch that found it.
