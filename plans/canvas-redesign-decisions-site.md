# Canvas redesign: decisions 27 to 32

These decisions came from Milestones 6, 8 and 9, the site docs, the docs
sample with the changelog, and the pricing page, of the [Canvas redesign plan](./canvas-redesign.md). This file is a part
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

## 30. The sample tab text overlaps below 348px

- **Severity:** Medium. **Effort:** Small.
- **Source:** Implementation.
- **Category:** Mockup.
- **Location:** `.site-code-tab` in `docs/mockups/styles/site/code.css` and
  `apps/site/src/styles/code.css`; the tab markup in
  `docs/mockups/src/screens/design/site/parts/code_panel.tsx` and
  `apps/site/src/docs/sample-band.ts`
- **Background:** The HTML sample's code panel has a tab bar. The open tab
  names the file, `welcome.screen.html`, and the `html` label and Copy follow
  it. The tab does not shrink.
- **Problem:** Below about 348px, the file name runs over the `html` label,
  so the bar reads "welcome.screen.htmlml". The mockup draws the same
  overlap, and the site copies it.
- **Impact if no action:** From 320px to 347px, the tab bar is hard to read.
  The page does not scroll sideways.
- **Root question:** How does the sample's tab bar stay readable at 320px?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** Let the file name shrink and end in an ellipsis. Change the mockup
    first, then the site. Effort: Small.
  - **C.** Hide the `html` label on mobile, as the folder name already hides.
    Change the mockup first, then the site. Effort: Small.
- **Left out:** A site-only fix, because the mockup is the visual source of
  truth.
- **Wider fix:** B, because every long tab name then shortens.
- **Previous examples:** None found.
- **Recommendation:** B. The file name stays readable, and the language label
  stays.
- **Action:** ask the user, because the fix changes a merged mockup.

## 31. Pages scroll sideways at 200% text

- **Severity:** Medium. **Likelihood:** Rare. **Effort:** Large.
- **Source:** Implementation.
- **Category:** Product bug.
- **Location:** `apps/site/src/styles/changelog-release.css`,
  `changelog-filter.css`, `changelog-earlier.css` and `footer.css`, and the
  home and pricing sheets
- **Background:** `site-design.md` says pages stay usable at 320px and 200%
  text, with no sideways scroll. A one-time check with 200% text in a 320px
  window found sideways scroll on every page: the footer links reach 326px,
  the home 335px, pricing 596px, and the changelog 363px. At normal text
  size, no page scrolls sideways.
- **Problem:** The pages keep the mockups' one-line parts, and they do not
  wrap at 200% text.
- **Impact if no action:** A reader with large text on a small phone scrolls
  sideways to reach some buttons and counts.
- **Root question:** How do the site's pages keep 200% text inside a 320px
  window?
- **Options:**
  - **A.** Change nothing now. Effort: Small.
  - **B.** Let only the changelog's parts wrap. Change the mockup first.
    Effort: Medium.
  - **C.** One 200% text pass over every page and the chrome, together with
    decision 24. Change the mockups first, then the site. Effort: Large.
- **Left out:** A site-only fix, because site changes start in the mockups.
- **Wider fix:** C, with a 200% text walk as decision 12 proposes.
- **Previous examples:** Decision 24, the mobile chrome at 200% text.
- **Recommendation:** C. One pass keeps every page the same.
- **Action:** ask the user, because C is large and joins decision 24.

## 32. The focus ring offset of the sample options

- **Severity:** Low. **Effort:** Small.
- **Source:** Implementation.
- **Category:** Docs or spec.
- **Location:** `outline-offset: 2px` in
  `docs/mockups/styles/site/docs-sample.css` and
  `apps/site/src/styles/docs-sample.css`; the focus rule in
  `docs/protocol/cloud/site-design.md`
- **Background:** `site-design.md` sets focus as a 2px outline with a 3px
  offset. The merged mockup draws the sample options' focus ring with a 2px
  offset, and the site follows the mockup.
- **Problem:** The sample options do not meet the 3px offset.
- **Impact if no action:** Focus stays visible, 1px closer than the rule says.
- **Root question:** Which offset does a sample option's focus ring use?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** Keep 2px, and name the exception in `site-design.md`. Effort:
    Small.
  - **C.** Use 3px in the mockup, then on the site. Effort: Small.
- **Left out:** A site-only change, because the site and the mockup would
  then disagree.
- **Wider fix:** None, because the rule already sets one offset.
- **Previous examples:** Decisions 25 and 29.
- **Recommendation:** C. Every control then has the same focus offset.
- **Action:** ask the user, because C changes a merged mockup.
