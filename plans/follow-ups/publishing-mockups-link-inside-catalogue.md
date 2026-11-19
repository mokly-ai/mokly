# Publishing mockups link inside the catalogue

- **Severity:** Low. **Effort:** Medium (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-10-30, from Milestone 6D finding 3 and final review finding 2 of the Milestone 7 review TODO in the deleted `plans/desktop-app-shell.md`, on the branch `calummoore/plans-skill-update`.
- **Location:** `docs/mockups/src/screens/product/viewer/unpublished-stage.tsx:18-33`, `docs/mockups/src/screens/product/viewer/switcher-screen.tsx:20-33`, `docs/mockups/src/screens/product/viewer/share-screen.tsx:152-164`, `docs/mockups/src/screens/product/page-parts.tsx:15-78` and `docs/protocol/cloud/product-mockups-viewer.md:61-62`.
- **Reason:** The fix removes link targets that exist on `origin/main`, and that removal needs the user's approval.
- **Checked:** 2026-10-31, at commit `f568853e`. The choice is still open. The three actions still draw the external glyph and still link inside the catalogue.
- **Category:** Mockup.

- **Terms:**
  - **Set up publishing:** The viewer action that sends an administrator to the site's publishing guide when a project has nothing published.
  - **External glyph:** The icon that marks an action that leaves the app.
- **Background:** Each of the three mockups links **Set up publishing** inside the catalogue. The stage and the switcher link it to `product/account/project-created/empty`. The Share panel links it to `product/account/project-created`. The mockup `Action` turns its `to` value into catalogue navigation. The action draws the external glyph. `docs/protocol/cloud/product-mockups-viewer.md:61-62` says that the action leaves the app for the site's CI setup guide.
- **Problem:** The drawings say that the action leaves the app, but their links stay inside the catalogue.
- **Impact if no action:** A reviewer who follows the mockup link reaches a screen that the product never opens from this action.
- **Root question:** How does a mockup draw an action that leaves the app?
- **Options:**
  - **B.** Keep the links. Effort: Small.
  - **A.** Remove the catalogue link from the three actions, and keep the glyph. Effort: Medium.
  - **D.** Do A, and add a policy check that rejects a catalogue link on an action with the external glyph. It is a new check. Effort: Medium.
  - **E.** Link the three actions to the site's CI setup guide with a real external `href` to the site origin fixture. Keep the glyph. `docs/protocol/cloud/mockup-links-and-flows.md:25` gives that form for public-site links. The source did not record this option. Effort: Medium (estimate).
- **Left out:** Option C was not recorded in the source.
- **Wider fix:** D. The check stops the class in every mockup.
- **Previous examples:** None found.
- **Recommendation:** A, with D. The review recommended both. D adds a new check, so it waits for the user too.
- **Action:** ask the user, because condition 3 holds: A removes link targets that exist on `origin/main`, and D adds a new check.

Source: [the Milestone 7 review TODO](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/desktop-app-shell.md?plain=1#L734-L795) of the deleted plan.
