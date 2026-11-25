# Site spec states a site-wide link name rule

- **Severity:** Low. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-24, from `calummoore/cloud-sign-up-uadj`, review finding 13.
- **Location:** `docs/protocol/cloud/site.md:90-91`.
- **Reason:** Both fix rounds of the branch that found it were used.

- **Source:** Review.
- **Category:** Docs or spec.
- **Terms:**
  - **Accessible name:** the label that assistive technology reads for a
    link.
- **Background:**
  - On 2026-11-24 Cal chose **Docs** to `/docs/` for the action beside the
    open-source CLI, so that the home and pricing pages no longer hold two
    **Get started** links with different targets.
  - The Get Started section of `site.md` records the reason: "Naming it
    **Get started** was rejected, because each link name opens one
    destination."
  - The changelog gives each release a **Read release details** link with
    its own target (`docs/protocol/cloud/site-changelog.md:48-49`), and
    six docs pages also hold one name with several targets.
    `plans/follow-ups/changelog-links-share-names.md` records them.
- **Problem:** The reason reads as a site-wide rule that the site does not
  meet.
- **Impact if no action:** A reader can take site-wide link name rules as a
  requirement in force.
- **Root question:** How should the site spec explain why the cloud and CLI
  actions use different names?
- **Options:**
  - **A.** Limit the reason to the decision: "because the home and pricing
    pages would then hold two Get started links with different targets".
    Effort: Small.
  - **B.** Make "on the home and pricing pages, links that share a name open
    one target" a requirement. It needs Cal. Effort: Medium.
  - **C.** Make the same rule a site-wide requirement and change the
    existing names. It needs Cal, and it changes guides that ship in the npm
    package. Effort: Large.
  - **D.** Make a rule for the two labels on every page: Get started opens
    only `/sign-up`, and **Docs** opens only `/docs/`. It needs Cal. Effort:
    Small.
  - **E.** Do B, and add the rule to the shared accessibility walk in
    `apps/site/tests/browser/accessibility.ts` for `/` and `/pricing`. It is
    a new gate, which needs Cal. Effort: Medium.
- **Left out:** Drop the reason, because a decision in force keeps its
  rejected alternative and the reason. Change nothing, because the sentence
  then conflicts with `site-changelog.md`.
- **Wider fix:** None. The `documentation` skill already says that docs stay
  consistent, and protocol prose gets no test.
- **Previous examples:** `plans/follow-ups/site-docs-name-sign-in-link.md`
  records another broad sentence about the site's links that the site does
  not meet.
- **Related:** `plans/follow-ups/site-button-spec-lists-old-label.md` has the
  same cause. `plans/follow-ups/changelog-links-share-names.md` holds the
  page-wide rule as its wider fix.
- **Recommendation:** A. It gives the reason at the scope of Cal's choice and
  needs no new decision.
- **Action:** fix after merge, apply A, because both fix rounds of the
  branch that found it were used.
