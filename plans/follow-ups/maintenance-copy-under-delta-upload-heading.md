# Maintenance text sits under delta upload settings

- **Severity:** Low (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-10-31, from the retention review's independent check.
- **Location:** `docs/ops/environment.md:380-422`.
- **Reason:** The section structure already exists on main and is unrelated to the implemented retention behavior.

**Background:** The environment guide has a `Delta Upload Settings` heading.
Maintenance, GitHub, billing, outbound-link and proxy paragraphs follow under
that heading even though they describe other areas.

**Problem:** Readers scanning headings can miss configuration guidance that
does not belong to delta uploads.

**Impact if no action:** The information remains available through search but
is harder to find by the section outline.

**Root question:** Where should the existing configuration paragraphs live so
operators can find them by topic?

**Options:**

- **A — Add matching subsection headings.** Keep the text and setting
  inventory in the same guide and separate the topics. Effort: Small.
- **B — Split the guide into linked topic pages.** Keep one setting inventory
  and move the long topic guidance to its own pages. Effort: Medium. This
  requires more link and navigation changes.

**Recommendation:** A for the heading mismatch. Consider B only as a separate
documentation organization change.

**Wider fix:** The existing documentation skill requires each fact to have
one home and short, focused pages. It already covers the broader concern.

**Left out:** Duplicating the setting inventory under each heading would add
drift risk.

**Action:** Leave the existing structure unchanged until the user selects
this documentation work.
