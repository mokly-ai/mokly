# Overlay Tab guard keeps two known gaps

- **Severity:** Low (estimate). **Effort:** Medium (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-03, from branch `conductor/follow-ups-mockup-overlay-focus`. It keeps option C of `viewer-overlay-backdrop-takes-focus.md`, which that branch fixed with option D and deleted.
- **Location:** `docs/mockups/src/_tests_/disk-overlay-policy.ts`, `docs/mockups/src/_tests_/disk.spec.ts`, `docs/mockups/src/_tests_/overlay.spec.ts` and `docs/protocol/cloud/mockup-verification.md:197-200`. At commit `6be0d89d`, the source of the port: `disk-overlay-policy.ts:12-40`, `disk.spec.ts:162`, `disk.spec.ts:248-259` and `overlay.spec.ts:112-130`.
- **Reason:** The option makes a check stricter, which the user reserves, and the approved overlay fix does not depend on it.
- **Checked:** 2026-11-03, against the source port at `6be0d89d` and the completed port on this branch. The guard still uses counted presses before the capture. All 20 new browser tests passed 10 of 10 runs. No stricter option was applied. On 2026-11-04 a one-off browser check measured the scroll that the guard leaves on `product/viewer/switcher`.
- **Category:** Test.

- **Terms:**
  - **Overlay screen:** A viewer mockup page that draws an open panel, such as history, share, the branch switcher or projects, over the viewer.
  - **Overlay guard:** `checkDiskOverlay` in `docs/mockups/src/_tests_/disk-overlay-policy.ts`, which the disk test runs on each overlay screen.
  - **Disk test:** The Playwright test in `docs/mockups/src/_tests_/disk.spec.ts` that opens each built page from disk and runs every page policy on it.
  - **Smoke capture:** The full-page PNG that each disk test writes for the visual smoke review of changed pages.
  - **Focus-outline policy:** `focusPolicyViolations` in `docs/mockups/src/_tests_/focus-policy.ts`, which walks the Tab order and checks each focus outline.
- **Background:**
  - `docs/protocol/cloud/mockup-verification.md:197-200` says: "An overlay screen's viewer backdrop is `inert`, and Tab from its panel never reaches a control outside the panel." The user approved that rule on 2026-10-12.
  - On 2026-10-12 the user also kept the overlay inertness and Tab checks in the disk test. The protocol states the rule, not the method of the check.
  - On 2026-11-03 the user chose to make the backdrop `inert` through a shared helper and to port the overlay guard of commit `6be0d89d` with its two known gaps.
  - 18 viewer overlay entries, in 72 documents, render through `ViewerPanelScreen` in `docs/mockups/src/screens/product/viewer/screen.tsx`.
  - `docs/protocol/cloud/mockups.md:147-150` keeps notes outside the product screen root and puts catalogue-only links below an artboard. No rule says whether such a link may follow an overlay panel.
- **Problem:** The overlay guard never presses Tab from the last panel control, so it passes a page with a control after the panel. It also runs before the smoke capture, so its walk can leave a panel body scrolled in the capture. "Gap facts" below gives the evidence.
- **Impact if no action:** The guard can pass a page that breaks the protocol rule. A capture of a clipped panel can show a scrolled body that the page does not draw on open. On 2026-11-04 the guard left the switcher panel body scrolled by 95px on desktop and 239px on mobile.
- **Root question:** How does the disk test prove the overlay Tab rule for every control, while each capture shows the page as it opens?
- **Options:**
  - **C.** Walk the whole Tab cycle with a press limit, and run the guard after the smoke capture. Add a fixture with a control after the panel. It makes a check stricter. Effort: Medium.
  - **E.** Do C, but close the trailing-control gap with one more Tab press after the counted presses, not with the whole cycle. Accept only the document body or a panel control at that stop. It makes a check stricter. Effort: Medium.
  - **G.** Replace the Tab walk of the guard with a DOM rule. On an overlay screen, no element outside the open panel takes focus unless an `inert` ancestor holds it. Keep the check of the `inert` backdrop. The guard then moves no focus, so the capture gap closes with no move, and the same rule closes the trailing-control gap. Risk: it drops the keyboard proof that the user chose to port. It uses the same static test of focus as the hidden-subtree rule, so a tab stop that only the browser adds, such as a scroll container that Chromium makes focusable, can pass. It makes a check stricter. Effort: Small.
- **Left out:**
  - Change nothing. The guard keeps both gaps, and it can pass a page that breaks its rule.
  - Remove the backdrop's controls from the drawing. The protocol doc requires the viewer beneath the panel.
  - Narrow the Tab rule to the controls that the guard counts. It weakens the rule to fit a gap in its check.
  - Reset the scroll of each panel body after a walk, before the capture. A move after the capture is simpler, and it leaves no state for a later check to undo.
  - Run the guard on a second load of each overlay page. A move after the capture isolates the capture as well, with no second load.
- **Wider fix:** None among these options. Option K of `plans/follow-ups/disk-focus-checks-lack-one-post-capture-step.md` is the structural fix for the capture order, because it takes the capture before every check. Option F of that item only gives each keyboard check one home after the capture. No structural fix exists for trailing controls, because a static page has no focus trap and an entry can render content after its screen. C and G each detect every case.
- **Previous examples:** Commit `26c3e7d0`, from PR #45, added the focus-outline walk with a press limit of 200, now at `docs/mockups/src/_tests_/focus-policy.ts:18-19`. It put that walk after the capture for the same reason, and that walk does not depend on a count.
- **Related:**
  - `plans/follow-ups/overlay-guard-never-tabs-past-last-control.md`: the trailing-control gap alone, with options C, E, H and I. H adds the DOM rule of G beside the counted walk. I applies the Tab rule only inside the product screen root, the element with `data-mkc-screen`, and needs a change of the approved rule.
  - `plans/follow-ups/disk-focus-checks-lack-one-post-capture-step.md`: the capture order alone, with options C, F, J, K and L. K takes the capture before every check, so the guard need not move.
  - Answers to those two items together also answer this item.
- **Recommendation:** C. It keeps the browser's own Tab order as the proof, as the user chose, and it needs no count. Two earlier records, merged on 2026-10-31, recommended the whole-cycle walk and the move after the capture, and C holds both. G is cheaper when the user accepts a DOM proof. When the capture-order item takes K, C needs no move, and C is then the whole-cycle walk and its fixture.
- **Action:** ask the user, because C makes a check stricter, as E and G do. The always-on rules reserve each stricter check for the user.

Gap facts. The lines are at commit `6be0d89d` of the closed branch `calummoore/reland-mockup-overlay-focus`, unless they name `main`.

- Trailing controls:
  - The guard counts the N focusable controls of the open panel at `disk-overlay-policy.ts:12-24`. It then presses Tab N times from the top of the page, and each stop must be inside the panel.
  - The guard never presses Tab from the last panel control. A control after the panel is reached only by that press, so the guard passes a page that breaks the rule. The file comment at line 1 promised "the complete Tab order".
  - The fixtures at `overlay.spec.ts:112-130` put the outside control before the panel, or between two panel controls through `tabindex`. No fixture puts a control after the panel.
  - `docs/mockups/src/screens/product/viewer/standalone-screen.tsx:50` renders the catalogue-only links of `docs/mockups/src/components/catalogue-links.tsx` after a viewer screen, also on `main`. No built overlay page has a trailing control.
  - At the stop after the last panel control, Chromium can move focus to the document body or wrap to the first control. Both must pass.
  - The whole-cycle walk stops when focus leaves the document or returns to the first stop. It needs a press limit. It does not need the count to match the browser's tab stops.
- Capture order:
  - The closed branch calls the guard at `disk.spec.ts:162`, before the smoke capture at line 248. Its focus-outline policy runs after the capture, at lines 254-259.
  - The comment at line 253 says: "Focus moves only after the capture, so no capture shows a focus ring." On `main` at commit `164d73db`, the same comment is at `disk.spec.ts:265`, and the focus-outline policy runs at line 266.
  - The guard presses Tab through every panel control at `disk-overlay-policy.ts:28-36`, then blurs the last one at lines 37-40.
  - Keyboard focus scrolls each control into view, and blur does not scroll back. A panel is at most 76vh tall on desktop and 84vh on mobile, in `docs/mockups/styles/overlays.css:13-22`.
  - Captures built from `main` before 2026-10-31 showed both switcher panels clipped, with the last pull request row below the fold. So the walk can leave the panel body scrolled, and the capture then shows that state. The comment is then no longer true.
  - History: the review on 2026-10-26 ran no browser on the closed branch, so it could only estimate the impact on the four `product/viewer/switcher` captures.
  - On 2026-11-04 a browser check measured `product/viewer/switcher` with the ported guard. The guard pressed Tab 10 times. The `scrollTop` of `.fo-viewer-panel-body` went from 0 to 95 on desktop, with `clientHeight` 623 and `scrollHeight` 718. On mobile it went from 0 to 239, with `clientHeight` 635 and `scrollHeight` 874. Blur left that scroll in place.
  - C moves `checkDiskOverlay(page)` after `page.screenshot` and before `focusPolicyViolations`. The capture moves no focus, and the guard still starts from the top of the page.

History: On 2026-10-31 the viewer overlay focus item took in two records, `overlay-tab-guard-misses-trailing-controls.md` and `overlay-tab-walk-runs-before-capture.md`. Both graded their direct fix Low severity and Small effort, a test-only change. Their confidence was High for the trailing-control gap and Medium for the unmeasured capture impact. Option C holds option B of the trailing record and option A of the capture record. Option E was option A of the trailing record. Option F was option B of the capture record.
