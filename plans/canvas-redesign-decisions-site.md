# Canvas redesign: decisions 27 to 29

These decisions came from Milestones 6 and 9, the site docs and the pricing
page, of the [Canvas redesign plan](./canvas-redesign.md). This file is a part
of the plan, and the pull request that deletes the plan deletes it too.

## 27. How a reader leaves the docs search

- **Severity:** Medium. **Effort:** Small.
- **Source:** Implementation.
- **Category:** Docs or spec.
- **Location:** `apps/site/src/components/docs/Search.tsx`, the "Search"
  section of `docs/protocol/cloud/site-docs-layout.md`
- **Background:** Docs search opens a modal dialog over a scrim. The menu and
  the docs tree sheet close on a scrim press, because their requirements say
  so. The search requirement names only the controls and keys that open it.
  Escape and Close close it.
- **Problem:** A press on the search scrim does nothing, and no requirement
  says what it must do.
- **Impact if no action:** A reader who presses the dimmed page stays in
  search, while the other two dialogs close on the same press.
- **Root question:** How does a reader leave the docs search dialog?
- **Options:**
  - **A.** Change nothing. Escape and Close close search. Effort: Small.
  - **B.** A scrim press also closes search. Add one sentence to the
    "Search" section. Effort: Small.
- **Left out:** A non-modal search panel, because the requirement fixes a
  modal dialog.
- **Wider fix:** None, because each dialog's requirement says how it closes.
- **Previous examples:** `apps/site/src/components/menu-dialog.ts` and
  `apps/site/src/components/docs/tree-sheet.ts`.
- **Recommendation:** B. All three docs dialogs then close in the same way.
- **Action:** ask the user, because B adds behaviour that no requirement
  covers.

## 28. The unused 1100px media query width

- **Severity:** Low. **Effort:** Small.
- **Source:** Implementation.
- **Category:** Test.
- **Location:** `apps/site/tests/styles.test.ts:49-55`,
  `docs/mockups/src/_tests_/design-site-parity.test.ts:144-146`
- **Background:** The style test lists the widths that a site media query may
  start with: 768px and 1100px. The old docs rail used 1100px. Milestone 6
  removed that rail. The pricing sheets use 1100px only as a `max-width`
  step inside 768px queries, which the list already allows.
- **Problem:** No sheet starts a query at 1100px now, but the allowance
  stays. The parity test also keeps two branches for 1100px queries.
- **Impact if no action:** A sheet can add an unplanned 1100px step, and the
  test does not stop it.
- **Root question:** Which widths may a site media query start with?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** Remove 1100px from the list and the two parity branches. The
    check becomes stricter. Effort: Small.
- **Left out:** Allowing each docs step width, because the steps are ranges
  of the 768px composition.
- **Wider fix:** B.
- **Previous examples:** None found.
- **Recommendation:** B. It removes a rule that nothing uses.
- **Action:** ask the user, because B makes a check stricter.

## 29. Two pricing mockup rules that draw nothing

- **Severity:** Low. **Effort:** Small.
- **Source:** Implementation.
- **Category:** Mockup.
- **Location:** `docs/mockups/styles/site/pricing-responsive.css`,
  `apps/site/src/styles/pricing-compare-cells.css:112`,
  `docs/mockups/src/_tests_/design-site-parity-pricing.ts`
- **Background:** On phones, the mockup declares 24px bottom padding for the
  Mokly CLI box, but a stronger rule draws 52px. It declares 11px for the
  compare table's group heads, but the mobile cell rule draws 14px. The site
  draws what the mockup draws today.
- **Problem:** The declared values look like the intent. `site-design.md`
  sets mono labels at 11px to 12.5px, and the drawn 14px heads break that
  rule on phones.
- **Impact if no action:** On phones, the group heads look larger than every
  other mono label, and the mockup keeps two dead rules.
- **Root question:** On phones, does the pricing page draw the declared
  values or the values that the mockup draws today?
- **Options:**
  - **A.** Keep the drawn values. A later mockup change deletes the dead
    rules and the parity entry. Effort: Small.
  - **B.** Draw the declared values: fix the two mockup selectors first, then
    change the site to match. Effort: Small.
  - **C.** Apply the answer of decision 25 to this class too. Effort: Small.
- **Left out:** A change on the site only, because the mockup is the visual
  source of truth.
- **Wider fix:** A parity check of drawn values, which decision 12 holds.
- **Previous examples:** Decision 25, the footer heading margin.
- **Recommendation:** B. The declared values follow the type rule of
  `site-design.md` and the mockup's intent.
- **Action:** ask the user, because B moves the site away from the merged
  mockup's drawing.
