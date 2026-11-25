# Pricing tests do not check the card of each action

- **Severity:** Medium. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-24, from `calummoore/cloud-sign-up-uadj`, review finding 11.
- **Location:** `apps/site/tests/browser/pricing.spec.ts:19-52`, `:96-111`,
  `apps/site/src/components/pricing/Plans.astro:48`, `:70`, `:88`.
- **Reason:** Both fix rounds of the branch that found it were used.

- **Source:** Review.
- **Category:** Test.
- **Terms:**
  - **Plan card:** the named `article` of one pricing plan, with its price,
    its features and its one action.
- **Background:**
  - `docs/protocol/cloud/site-pricing.md` gives each plan its one action.
    The Open source card has **Docs** to `/docs/`. The Free card has
    **Create an account** to `/sign-up`. The Team card has **Start a 7-day
    trial** to `/sign-up`.
  - The test "the plan actions and the docs link open their targets" finds
    each action anywhere in the page's `main` and checks its `href`. Two
    tests press **Create an account** and **Start a 7-day trial** and check
    the `/sign-up` address, as Cal chose on 2026-11-24.
  - The frame snapshot test at `pricing.spec.ts:96-111` pins the Team card
    only.
  - The mockup test `docs/mockups/src/_tests_/design-site-pricing.test.ts:61-84`
    checks the action of each mockup card, not the site.
- **Problem:** No test checks that each site action sits in its own card. A
  swap of the Open source and Free actions passes every test.
- **Impact if no action:** A reader could see account creation under the
  local CLI plan and **Docs** under the Free cloud plan while CI passes.
- **Root question:** How should the pricing tests verify that each plan
  offers its own action?
- **Options:**
  - **A.** Add named-card checks for **Docs** and **Create an account** to
    the existing test. Keep the page-wide checks and both presses. Effort:
    Small.
  - **B.** Give each case a plan name, an action name and a destination.
    Check the link inside its named card, and press the sign-up links inside
    the same card. Keep the page-wide checks. Effort: Small.
  - **C.** Add an accessibility snapshot of the plan grid with each action
    under its card. Each copy change then edits the snapshot. Effort:
    Medium.
  - **D.** Do B, and check that each named card holds exactly one link,
    which also tests "its one action". Effort: Small.
  - **E.** Check the placement in a Node test over the built pricing page:
    each plan `article` holds one link with its name and `href`. Keep the
    browser presses. Effort: Small.
  - **F.** Extend the frame snapshot test to the Open source and Free cards
    with `/children: equal`, as for Team. Effort: Small.
  - **G.** Compare the actions of each drawn site section with the built
    mockups, beside `docs/mockups/src/_tests_/design-site-parity.test.ts`.
    It is a new gate, which needs Cal's approval. Effort: Large.
- **Left out:** Expected cards from production data, because a wrong
  placement then changes the expectation too. A screenshot baseline, because
  the layout is not the behaviour. Plan names in the action labels, because
  they break the approved labels.
- **Wider fix:** G. It covers every site section that a mockup draws, also
  the home sections.
- **Previous examples:** `91615bae2` scoped the home action tests to the
  sections that own them.
- **Recommendation:** D. It checks the card and the one action of each plan
  through the same named controls. G best protects the codebase.
- **Action:** fix after merge, apply D, because both fix rounds of the
  branch that found it were used.
