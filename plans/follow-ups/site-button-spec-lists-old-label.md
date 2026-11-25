# Button spec lists Get started in both home pairs

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-24, from `calummoore/cloud-sign-up-uadj`, review finding 12.
- **Location:** `docs/protocol/cloud/site-design-components.md:53-55`,
  `docs/protocol/cloud/site-copy.md:23`, `:71`.
- **Reason:** Both fix rounds of the branch that found it were used.

- **Source:** Review.
- **Category:** Docs or spec.
- **Background:**
  - The button spec in `site-design-components.md` says that the filled kind
    marks a page's primary actions: Get started, in the header and in the
    home's action pairs, and the trial action on pricing.
  - On 2026-11-24 Cal chose **Docs** to `/docs/` for the action beside the
    open-source CLI. The home's open foundation pair is now **Docs** and
    **View on GitHub**. **Docs** is still a filled button there, and a
    secondary button on the pricing page.
  - Site chrome, Site home copy and Site pricing already name the primary
    action of the header, the hero and the trial (`site-chrome.md:19`,
    `site-copy.md:23`, `site-pricing.md:40`).
- **Problem:** The button spec still says Get started in both home action
  pairs.
- **Impact if no action:** A developer who follows the button spec can bring
  back Get started beside the CLI.
- **Root question:** Which actions take the filled kind, and which one spec
  states it?
- **Options:**
  - **A.** Name Get started for the hero and **Docs** for the open
    foundation in the button spec. Effort: Small.
  - **B.** Describe the filled buttons by placement and link the home copy
    and pricing specs for the labels. Effort: Small.
  - **C.** State the rule once in the button spec: the filled kind marks the
    primary action that each page's spec names. Link Site chrome, Site home
    copy and Site pricing. In `site-copy.md:71`, name the open foundation's
    primary and secondary actions, as line 23 does for the hero. Effort:
    Small.
  - **D.** Make `docs/protocol/cloud/site.md#get-started` the one owner of
    the placement, the kind and the destination of each site action. Five
    specs link it and drop their copies. `site.md` has 226 of its 250
    lines, so D can force a split. Effort: Medium.
  - **E.** Make the open foundation's **Docs** a secondary button, as on
    pricing. Every filled button then opens `/sign-up`. It changes the
    approved look of the home, which needs Cal. Effort: Small.
- **Left out:** A different label, because it reverses Cal's choice of
  2026-11-24. A test of the spec text, because protocol docs get no test.
- **Wider fix:** D. Specs that copy action facts went stale twice on the
  branch that found this.
- **Previous examples:** On the same branch, the Site Mockups contract still
  sent Get started to the Install guide after the target changed.
- **Related:** `plans/follow-ups/site-spec-overstates-link-name-rule.md`
  edits the same section of `site.md` under D.
- **Recommendation:** C. Each page spec then owns its primary action, so the
  button spec cannot go stale on a label change. D best protects the
  codebase.
- **Action:** fix after merge, apply C, because both fix rounds of the
  branch that found it were used.
