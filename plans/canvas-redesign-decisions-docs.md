# Canvas redesign: decisions 20 to 23

These decisions came from Milestone 2, the protocol docs, of the
[Canvas redesign plan](./canvas-redesign.md). They keep the item numbers of
that milestone's report. Its other items, 13 to 19 and 23 to 28, are design
calls in the [design record](./canvas-redesign-design.md). This file is a part
of the plan, and the pull request that deletes the plan deletes it too.

## 20. What the site may draw after go-live

- **Severity:** Low. **Effort:** Small.
- **Source:** Implementation.
- **Category:** Docs or spec.
- **Location:** `docs/protocol/cloud/site.md:39-47`, `docs/protocol/cloud/marketing-site.md:101-104`, `apps/site/README.md:219-223`
- **Background:** Decision 2, option A, draws a fictional demo app and keeps
  every claim about Mokly real. Cal relaxed the source rule until go-live,
  because comments and agents ship before then. Every site page also draws
  people and agents (Maya, Sam, Claude, Codex) as part of the design file.
- **Problem:** The docs disagree. `site.md` and `marketing-site.md` end the
  demo app at go-live. The site README and the plan end only the unshipped
  features. Named agents can read as a claim that Mokly works with them.
- **Impact if no action:** At go-live the check removes the home spread and
  the people on every page header.
- **Root question:** After go-live, what may the site still draw that is not
  real: the demo app, the people and agents, or neither?
- **Options:**
  - **A.** Keep the demo app and the people as fiction. At go-live, only the
    depicted Mokly features are checked. Presence inside a drawn Mokly screen
    and each named agent are checked like features. Effort: Small.
  - **B.** The demo app, the people and the unshipped features all end at
    go-live. Effort: Small now, Large at go-live.
  - **C.** Keep the demo app, but count the people and agents as the presence
    and agent features, removed at go-live unless those features ship.
    Effort: Small now, Medium at go-live.
  - **D.** Mark each drawing of an unshipped feature in the site source, as
    docs pages carry `status: ahead`, and add it to the go-live pass. It works
    with A, B or C. Effort: Small.
- **Left out:** Deciding at go-live, because today's text then applies B by
  default.
- **Wider fix:** D, because a marked drawing cannot be missed.
- **Previous examples:** The go-live pass for `status: ahead` docs pages in
  `site.md` and `plans/follow-ups/site-pages-still-marked-ahead.md`.
- **Recommendation:** A with D. Cal approved the named people and counts in
  decision 2, and D makes the go-live check reliable.
- **Action:** ask the user, because the answer reads Cal's own decision.

## 21. What the Privacy Policy says about browser storage

- **Severity:** Low. **Effort:** Small.
- **Source:** Implementation.
- **Category:** Docs or spec.
- **Location:** `apps/site/src/content/legal/privacy.md:227-236`, `docs/protocol/cloud/site-legal.md:43-47`, `apps/site/tests/legal.test.ts:68-73`
- **Background:** The site footer keeps the scheme choice in `localStorage`.
  The docs tree already keeps its scroll position in session storage.
  Milestone 13 keeps the app's Theme on the device. Section 9 lists only the
  app's storage, and says the app uses only storage needed to operate the
  service. UK rules cover any data stored on the device, not only cookies.
- **Problem:** Section 9 leaves out the site's storage, and the app's Theme
  makes its app sentence false.
- **Impact if no action:** The policy is incomplete, and partly wrong after
  Milestone 13.
- **Root question:** What does the Privacy Policy tell a reader about what
  the site and the app keep in the browser?
- **Options:**
  - **A.** Add one sentence about the site's storage in Milestone 4, with a
    new effective date. Effort: Small.
  - **B.** Change nothing. Effort: Small.
  - **C.** One edit for both: name the site's scheme choice and tree position
    and the app's Theme, with their purpose, that they stay in the browser,
    and how to remove them. Reword the app sentence, add browser storage to
    the triggers in `site-legal.md`, and move all four legal dates together,
    as the legal test requires. Effort: Small.
  - **D.** A test that fails when a source file uses browser storage that
    section 9 does not list. It is a new check. Effort: Medium.
- **Left out:** A consent banner, because preference storage needs no
  consent.
- **Wider fix:** D.
- **Previous examples:** The docs tree key in
  `apps/site/src/components/docs/tree-scroll.ts:1` and the desktop sign-in
  verifier in `apps/app/src/navigation/desktop-sign-in.ts:16`.
- **Recommendation:** C, changed from A by the options check. It costs the
  same as A and also keeps the app sentence true.
- **Action:** ask the user, because legal text needs Cal's approval and a new
  effective date.

## 22. How a signed-in reader reaches the site

- **Severity:** Low. **Effort:** Small.
- **Source:** Implementation.
- **Category:** Docs or spec.
- **Location:** `docs/protocol/cloud/marketing-site.md:68-73`
- **Background:** `marketing-site.md` says the signed-in account menu links
  Home, Docs and Changelog. The merged account menu mockup has four rows: the
  reader, Theme, Settings and Sign out. Inside the product the Mokly mark is
  not a link, and the desktop app has no address bar.
- **Problem:** The requirement and the merged mockup disagree.
- **Impact if no action:** Milestone 13 builds a menu that breaks one of them.
- **Root question:** How does a signed-in reader, in a browser or the desktop
  app, reach the site's Docs, Changelog and Home?
- **Options:**
  - **A.** Follow the mockup and remove the sentence. A signed-in reader then
    has no fixed path to the site. Effort: Small.
  - **B.** Add Docs and Changelog rows to the account menu, and to More on
    phones. Change the mockup in Milestone 15 and five docs. Effort: Medium.
  - **C.** Add Docs and Changelog to the desktop app's Help menu, and keep
    four rows. A browser reader still has no link. Effort: Small.
  - **D.** Make the in-product mark link the site's Home. A stray click leaves
    the viewer. Effort: Small.
- **Left out:** A separate help control in the bar, because the full bar
  fits five cloud controls.
- **Wider fix:** None, because this is a choice of behaviour.
- **Previous examples:** None found.
- **Recommendation:** B, changed from A by the options check. A leaves no
  path to the site, also in the desktop app.
- **Action:** ask the user, because a requirement and a merged mockup
  disagree.

## 23. Component frame size while it compares

- **Severity:** Low. **Effort:** Small.
- **Source:** Implementation.
- **Category:** Docs or spec.
- **Location:** `docs/protocol/mokly-shell-device-chrome.md:17-18`, `docs/protocol/mokly-comparison-panes.md:85`, `docs/protocol/mokly-comparison-scrolling.md:29`
- **Background:** On the canvas, a component frame takes the size of its
  document. The comparison rules say that no frame size depends on a
  measurement, so that a measurement cannot feed back into a document.
- **Problem:** The Before and Current documents of a component can differ in
  size, and the two rules conflict.
- **Impact if no action:** Milestone 12 chooses alone.
- **Root question:** How large is a component's frame while it compares two
  versions?
- **Options:**
  - **A.** The larger width and height of the two versions, measured once when
    both load. It relaxes the measurement rule for component frames only.
    Effort: Small.
  - **B.** The desktop width and the larger measured height. A narrow
    component gets a wide frame. Effort: Small.
  - **C.** Each version keeps its own size. The Swipe divider then crosses a
    size edge. Effort: Medium.
- **Left out:** None.
- **Wider fix:** None, because one rule settles it.
- **Previous examples:** None found.
- **Recommendation:** A. It fits both versions and limits the measurement to
  one pass.
- **Action:** ask the user, because A changes the rule that no comparison
  frame size depends on a measurement.
