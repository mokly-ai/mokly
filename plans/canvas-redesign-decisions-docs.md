# Canvas redesign: decisions 20 to 22

These decisions came from Milestone 2, the protocol docs, of the
[Canvas redesign plan](./canvas-redesign.md). They keep the item numbers of
that milestone's report. Its other items, 13 to 19 and 23 to 28, are design
calls in the [design record](./canvas-redesign-design.md). This file is a part
of the plan, and the pull request that deletes the plan deletes it too.

## 20. Does the demo app stay after go-live

- **Severity:** Low. **Effort:** Small.
- **Source:** Implementation.
- **Category:** Docs or spec.
- **Location:** `docs/protocol/cloud/site.md` (Boundary)
- **Background:** Decision 2, option A, draws a fictional demo app and keeps
  every claim about Mokly real. Cal relaxed the source rule "until go-live",
  because comments and agents ship before then. `site.md` now says that the
  site may draw a fictional demo app and features that ship before go-live.
- **Problem:** The reason names only the features. It does not say whether
  the demo app itself ends at go-live.
- **Impact if no action:** At go-live the check removes the home spread, which
  is built around the demo app.
- **Root question:** After go-live, may the home page still draw the
  fictional demo app?
- **Options:**
  - **A.** Yes. At go-live only the depicted Mokly features are checked, and
    features that did not ship are removed. Effort: Small.
  - **B.** No. The demo app and the unshipped features both end at go-live.
    Effort: Small now, Medium at go-live for a new home page.
- **Left out:** None. The decision text allows only these two readings.
- **Wider fix:** None, because this is a reading of a decision.
- **Previous examples:** None found.
- **Recommendation:** A. It matches the text of decision 2, option A, and the
  reason Cal gave.
- **Action:** ask the user, because the answer reads Cal's own decision.

## 21. Privacy Policy does not name site storage

- **Severity:** Low. **Effort:** Small.
- **Source:** Implementation.
- **Category:** Docs or spec.
- **Location:** `apps/site/src/content/legal/privacy.md` (section 9), `docs/protocol/cloud/site-legal.md`
- **Background:** The footer scheme control keeps the reader's choice in
  `localStorage`. The docs tree already keeps its scroll position in session
  storage. Section 9, "Cookies and browser storage", lists only the app's
  storage.
- **Problem:** The section that names browser storage leaves out the site's
  storage. No sentence is false.
- **Impact if no action:** The policy stays incomplete when Milestone 4 ships
  the scheme control.
- **Root question:** Does the Privacy Policy name the site's browser storage?
- **Options:**
  - **A.** Add one requirement to `site-legal.md` and one sentence to the
    policy in Milestone 4, with a new effective date. Effort: Small.
  - **B.** Change nothing, because the storage keeps only the reader's own
    choices and holds no personal data. Effort: Small.
- **Left out:** A consent banner, because the site sets no cookie.
- **Wider fix:** None, because `site-legal.md` already owns the policy claims.
- **Previous examples:** None found.
- **Recommendation:** A. The section claims to cover browser storage, and the
  fix is one sentence.
- **Action:** ask the user, because legal text needs Cal's approval and a new
  effective date.

## 22. Account menu has no site links

- **Severity:** Low. **Effort:** Small.
- **Source:** Implementation.
- **Category:** Docs or spec.
- **Location:** `docs/protocol/cloud/marketing-site.md` lines 66–69
- **Background:** `marketing-site.md` says that the signed-in account menu
  links Home, Docs and Changelog. The merged account menu mockup has four
  rows: the reader, Theme, Settings and Sign out. No app code makes these
  links today.
- **Problem:** The requirement and the merged mockup disagree.
- **Impact if no action:** Milestone 13 builds a menu that breaks one of them.
- **Root question:** How does a signed-in reader reach the site's Docs and
  Changelog from the app?
- **Options:**
  - **A.** Follow the mockup and remove the sentence. The mark still links
    Home, and contextual help links docs pages. Effort: Small.
  - **B.** Add Docs and Changelog rows to the account menu, with a mockup
    change in Milestone 15. Effort: Small.
- **Left out:** A separate help menu, because no design draws one.
- **Wider fix:** None, because this is a choice of behaviour.
- **Previous examples:** None found.
- **Recommendation:** A. The reviewed mockup has four rows, and nothing ships
  these links today.
- **Action:** ask the user, because a requirement and a merged mockup
  disagree.
