# Confined-inputs item cites moved PostCSS lines

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-22, from round 4 of the review of the branch
  `calummoore/mokly-earlier-postcss-start-bdhv`, which listed it outside
  its scope.
- **Location:** `plans/follow-ups/confined-postcss-inputs.md:7` and line 30.
- **Reason:** The stale references are in another follow-up item, outside the
  diff that found them, so a separate change corrects them.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Read evidence:** the files and byte ranges that PostCSS code read
    through observed Node APIs. Its coverage is always `incomplete`.
- **Background:**
  - `plans/follow-ups/confined-postcss-inputs.md` cites
    `docs/protocol/mokly-sidecar-postcss.md:75-98` twice: in its **Location**
    and in its **Background**, where it says that those lines state the
    result on read evidence.
  - Later changes to the PostCSS page moved its sections. Lines 75 to 98 now
    hold the "Prepared Contexts" rules, also on `main`.
  - The read evidence rules now sit under "Read Evidence" and "Incomplete
    Coverage" of the same page.
- **Problem:** The item points a reader to the wrong rules.
- **Impact if no action:** A reader who opens the cited lines finds rules
  about prepared contexts, not the coverage rule that the item depends on.
- **Root question:** How does the item point to the read evidence rules in a
  way that survives later edits of the page?
- **Options:**
  - **A.** Update the two line ranges to the current lines of "Read Evidence"
    and "Incomplete Coverage". Effort: Small.
  - **B.** Replace the line ranges with links to the two section anchors,
    `#read-evidence` and `#incomplete-coverage`. Effort: Small.
- **Left out:** Change nothing: it fails the goal, because the references stay
  wrong.
- **Wider fix:** B. A section link survives edits that move lines.
- **Previous examples:** `plans/follow-ups/capacity-item-discovery-trigger.md`
  records a copied rule that drifted in another item.
- **Recommendation:** B. The item then follows the page by construction.
- **Action:** fix after merge, apply B, because the text is in another
  follow-up item, outside the diff that found it.
