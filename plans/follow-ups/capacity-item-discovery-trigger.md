# Capacity item omits the prepared-child discovery trigger

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-22, from round 3 of the review of the branch
  `calummoore/mokly-earlier-postcss-start-bdhv`, which listed it outside
  its scope.
- **Location:** `plans/follow-ups/capacity-reading-sampling-cost.md:56` and
  line 64.
- **Reason:** The problem is in another follow-up item, outside the diff of
  that branch, so a separate change corrects it.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Discovery:** a full scan for the descendant processes of one sidecar,
    which memory sampling runs only at some samples.
  - **Prepared child:** the PostCSS child that a sidecar starts for a
    prepared context before the first stylesheet needs it.
- **Background:**
  - "Sampling And Recycling" in `docs/protocol/mokly-sidecar-memory.md` says
    that a sample discovers new descendants at spawn, at the first sample
    after `processCss`, at the first sample after the start of a prepared
    PostCSS child, and every 64 samples.
  - #459 added the trigger after the start of a prepared child.
  - `plans/follow-ups/capacity-reading-sampling-cost.md` restates the rule
    twice without that trigger: in its list of rules that stay, at line 56,
    and in the proof obligation of its discovery-flag candidate, at line 64.
- **Problem:** The capacity item lists an older discovery rule as a rule that
  must stay. A change that follows it can drop the discovery after a
  prepared-child start and still meet every proof that the item asks for.
- **Impact if no action:** A later change to the sampler can stop counting a
  prepared child until the next full scan, so recycling and default
  admission undercount memory for up to 64 samples.
- **Root question:** How does the capacity item state the discovery rule that
  is in force, so that its proofs keep every trigger?
- **Options:**
  - **A.** Add the prepared-child trigger to line 56, and name it beside
    "the first sample after `processCss`" in the proof obligation at line 64.
    Effort: Small.
  - **B.** Replace both restatements with a link to "Sampling And Recycling"
    in the memory page, so that the item never copies the rule. Effort:
    Small.
- **Left out:** Change nothing: it fails the goal, because the item keeps a
  rule that is no longer complete.
- **Wider fix:** B. A link instead of a copy prevents the same drift when the
  rule changes again.
- **Previous examples:** None found.
- **Recommendation:** B. The item then follows the memory page by
  construction.
- **Action:** fix after merge, apply B, because the text is in another
  follow-up item, outside the diff that found it.
