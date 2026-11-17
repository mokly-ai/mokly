# Overlay guard never tabs past the last control

- **Severity:** Low (estimate). **Effort:** Medium (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-03, from branch `conductor/follow-ups-mockup-overlay-focus`. It keeps option E of `viewer-overlay-backdrop-takes-focus.md`, which that branch fixed with option D and deleted.
- **Location:** `docs/mockups/src/_tests_/disk-overlay-policy.ts`, `docs/mockups/src/_tests_/disk.spec.ts`, `docs/mockups/src/_tests_/overlay.spec.ts` and `docs/protocol/mockup-verification.md:197-200`. At commit `6be0d89d`, the source of the port: `disk-overlay-policy.ts:12-40`, `disk.spec.ts:162` and `overlay.spec.ts:112-130`.
- **Reason:** The option makes a check stricter, which the user reserves, and the approved overlay fix does not depend on it.
- **Checked:** 2026-11-03, against the source port at `6be0d89d` and the completed port on this branch. The guard still uses counted presses before the capture. All 20 new browser tests passed 10 of 10 runs. No stricter option was applied. On 2026-11-04 a one-off browser check measured the scroll that the guard leaves on `product/viewer/switcher`.
- **Category:** Test.

- **Terms:**
  - **Overlay screen:** A viewer mockup page that draws an open panel, such as history, share, the branch switcher or projects, over the viewer.
  - **Overlay guard:** `checkDiskOverlay` in `docs/mockups/src/_tests_/disk-overlay-policy.ts`, which the disk test in `docs/mockups/src/_tests_/disk.spec.ts` runs on each overlay screen.
  - **Trailing control:** A control outside the open panel that comes after the last panel control in the Tab order.
  - **Smoke capture:** The full-page PNG that each disk test writes for the visual smoke review of changed pages.
  - **Product screen root:** The element with `data-mkc-screen` that holds the drawing of one screen.
- **Background:**
  - `docs/protocol/mockup-verification.md:197-200` says that Tab from an overlay panel never reaches a control outside the panel. The user approved that rule on 2026-10-12.
  - On 2026-10-12 the user also kept the overlay Tab checks in the disk test. The protocol states the rule, not the method of the check.
  - On 2026-11-03 the user chose to port the overlay guard of commit `6be0d89d` with its known gaps. The guard counts the N focusable controls of the open panel. It presses Tab N times from the top of the page, and each stop must be inside the panel.
  - `docs/protocol/mockups.md:147-150` keeps notes outside the product screen root and puts catalogue-only links below an artboard. No rule says whether such a link may follow an overlay panel.
  - C and E also move the guard after the smoke capture. `plans/follow-ups/disk-focus-checks-lack-one-post-capture-step.md` holds that capture-order choice, and either walk can run without the move.
- **Problem:** The guard never presses Tab from the last panel control. A trailing control is reached only by that press, so the guard passes a page that breaks the rule. No fixture puts a control after the panel.
- **Impact if no action:** A page with a trailing control passes the disk test, although Tab from its panel reaches a control outside the panel.
- **Root question:** How does the disk test catch a control outside the open panel that comes after the last panel control?
- **Options:**
  - **C.** Walk the whole Tab cycle with a press limit, and run the guard after the smoke capture. The walk stops when focus leaves the document or returns to the first stop. It makes a check stricter. Effort: Medium.
  - **E.** Do C, but close the trailing-control gap with one more Tab press after the counted presses, not with the whole cycle. Accept only the document body or a panel control at that stop. It makes a check stricter. Effort: Medium.
  - **H.** Keep the counted walk and its call. Add a DOM rule to the guard: on an overlay screen, no element outside the open panel takes focus unless an `inert` ancestor holds it. It catches a trailing control with no press past the panel, and it leaves the call order to the capture-order item. Risk: it uses the same static test of focus as the hidden-subtree rule, so a tab stop that only the browser adds can pass. It makes a check stricter. Effort: Small.
  - **I.** Apply the overlay Tab rule only inside the product screen root. Inside that root, `ViewerPanelScreen` draws only the inert backdrop and the panel, so no control can come after the panel. Notes and catalogue-only links stay outside the root and stay reachable. Change `docs/protocol/mockup-verification.md:199-200`, and make the guard ignore controls outside the root. Risk: it changes a rule that the user approved on 2026-10-12, and a keyboard reader can then Tab from a panel to a catalogue link. Effort: Small.
- **Left out:**
  - Change nothing. The guard keeps the gap, and it passes a page with a trailing control.
  - Narrow the Tab rule to the controls that the guard counts. It weakens the rule to fit a gap in its check.
- **Wider fix:** None. A static page has no focus trap, and an entry can render content after its screen, so no structural fix exists. The whole-cycle walk of C and the DOM rule of H each detect every trailing control with no count. I removes the case inside the product screen root, but only through a change of the approved rule.
- **Previous examples:** Commit `26c3e7d0`, from PR #45, added the focus-outline walk with a press limit of 200, now at `docs/mockups/src/_tests_/focus-policy.ts:18-19`. That walk does not depend on a count.
- **Related:**
  - `plans/follow-ups/overlay-tab-guard-keeps-two-gaps.md`: options that conflict. It bundles this gap with the capture order through C, E and G. G replaces the walk with the DOM rule of H.
  - `plans/follow-ups/disk-focus-checks-lack-one-post-capture-step.md`: it owns the capture order, which C and E also change.
- **Recommendation:** C. The whole-cycle walk does not need the count to match the browser's tab stops, and the earlier trailing-control record, merged on 2026-10-31, recommended it. H is the smallest option that leaves the call order to the capture-order item.
- **Action:** ask the user, because the recommended C makes a check stricter, as E and H do, and I changes a rule that the user approved. The always-on rules reserve these choices for the user.

Trailing-control facts. The lines are at commit `6be0d89d` of the closed branch `calummoore/reland-mockup-overlay-focus`, unless they name `main`.

- The guard counts the panel controls at `disk-overlay-policy.ts:12-24` and presses Tab once for each at lines 28-36. The file comment at line 1 promised "the complete Tab order".
- The fixtures at `overlay.spec.ts:112-130` put the outside control before the panel, or between two panel controls through `tabindex`. No fixture puts a control after the panel.
- `docs/mockups/src/screens/product/viewer/standalone-screen.tsx:50` renders the catalogue-only links of `docs/mockups/src/components/catalogue-links.tsx` after a viewer screen, also on `main`. No built overlay page has a trailing control.
- At the stop after the last panel control, Chromium can move focus to the document body or wrap to the first control. Both must pass.
- The one extra press of E relies on the count. If the count misses a tab stop of the panel, that press can stop inside the panel while a trailing control comes later.
- The whole-cycle walk stops when focus leaves the document or returns to the first stop. It needs a press limit. It does not need the count to match the browser's tab stops.

Capture facts. C and E move the guard after the capture.

- The closed branch calls the guard at `disk.spec.ts:162`, before the smoke capture. The guard presses Tab through every panel control, then blurs the last one at `disk-overlay-policy.ts:37-40`.
- Keyboard focus scrolls each control into view, and blur does not scroll back. A panel is at most 76vh tall on desktop and 84vh on mobile, in `docs/mockups/styles/overlays.css:13-22`. So a clipped panel can stay scrolled in the capture.
- On 2026-11-04 a browser check measured `product/viewer/switcher` with the ported guard. The guard pressed Tab 10 times. The `scrollTop` of `.fo-viewer-panel-body` went from 0 to 95 on desktop, with `clientHeight` 623 and `scrollHeight` 718. On mobile it went from 0 to 239, with `clientHeight` 635 and `scrollHeight` 874. Blur left that scroll in place.
- C and E move `checkDiskOverlay(page)` after `page.screenshot` and before `focusPolicyViolations`. The guard still starts from the top of the page.

History: On 2026-10-31 the viewer overlay focus item took in `overlay-tab-guard-misses-trailing-controls.md`. That record graded its direct fix Low severity, Small effort and High confidence, a test-only change. Option E was its option A. Option C holds its option B, the whole-cycle walk, which it recommended.
