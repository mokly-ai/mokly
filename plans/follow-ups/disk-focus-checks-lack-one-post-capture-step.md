# Disk focus checks lack one post-capture step

- **Severity:** Low (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-03, from branch `conductor/follow-ups-mockup-overlay-focus`. It keeps option F of `viewer-overlay-backdrop-takes-focus.md`, which that branch fixed with option D and deleted.
- **Location:** `docs/mockups/src/_tests_/disk.spec.ts`, `docs/mockups/src/_tests_/disk-overlay-policy.ts` and `docs/mockups/src/_tests_/focus-policy.ts:18-19`. At commit `6be0d89d`, the source of the port: `disk.spec.ts:162` and `disk.spec.ts:248-259`. On `main` at commit `164d73db`: `disk.spec.ts:258-266`.
- **Reason:** The recommended option changes the capture order, which the user reserved, and the approved overlay fix does not depend on it.
- **Checked:** 2026-11-03, against the source port at `6be0d89d` and the completed port on this branch. The guard still uses counted presses before the capture. All 20 new browser tests passed 10 of 10 runs. No stricter option was applied. On 2026-11-04 a one-off browser check measured the scroll that the guard leaves on `product/viewer/switcher`.
- **Category:** Code structure.

- **Terms:**
  - **Overlay guard:** `checkDiskOverlay` in `docs/mockups/src/_tests_/disk-overlay-policy.ts`. It presses Tab through the open panel of each viewer overlay page, then blurs the last control.
  - **Disk test:** The Playwright test in `docs/mockups/src/_tests_/disk.spec.ts` that opens each built page from disk and runs every page policy on it.
  - **Smoke capture:** The full-page PNG that each disk test writes for the visual smoke review of changed pages.
  - **Focus-outline policy:** `focusPolicyViolations` in `docs/mockups/src/_tests_/focus-policy.ts`. It blurs first, then presses Tab, with a limit of 200 presses, until it reaches each target. So its start does not matter.
- **Background:**
  - Each disk test waits for fonts and images, runs its static checks, waits for the landmark and the frames, writes a smoke capture, then runs the focus-outline policy. That order keeps focus rings out of the captures.
  - On 2026-11-03 the user chose to port the overlay guard of commit `6be0d89d` with its call before the capture. The capture order stayed a choice for the user.
  - Option C of `plans/follow-ups/overlay-tab-guard-keeps-two-gaps.md` moves the guard after the capture. Option E of `plans/follow-ups/overlay-guard-never-tabs-past-last-control.md` keeps that move.
- **Problem:** Each disk test takes its capture late, after most checks. The ported guard presses Tab before the capture. So a check that moves focus or scroll before the capture changes what the capture shows, and nothing keeps a later check after it.
- **Impact if no action:** A capture can show a scrolled panel body, or focus that the page does not draw on open. On 2026-11-04 the guard left the switcher panel body scrolled by 95px on desktop and 239px on mobile.
- **Root question:** How does each smoke capture show the page as it opens, whatever checks the disk test runs?
- **Options:**
  - **C.** Walk the whole Tab cycle with a press limit, and run the guard after the smoke capture, as its own call before the focus-outline policy. Each later check that moves focus needs the same care. It makes a check stricter. Effort: Medium.
  - **F.** Do C, and put the overlay guard and the focus-outline policy in one post-capture step that the disk test calls once. Later keyboard checks then have one home after the capture. It makes a check stricter. Effort: Medium.
  - **J.** Move the guard call after the capture, and keep the counted walk of the port. It closes the capture gap only, and it makes no check stricter. Risk: each later check that moves focus needs the same care. It still needs the user, because the user has not approved a move after the capture. Effort: Small.
  - **K.** Take the capture as soon as the page settles: after the font, image, landmark and frame waits, and before every check. Static checks and keyboard checks then run after it. The guard call of the port stays in its place, so it now runs after the capture. Risk: a page that fails a check still writes its capture. The landmark and frame expectations must stay before the capture, because they wait for the drawings. The user has not approved the guard after the capture. Effort: Small.
  - **L.** Before the capture, require that focus and each scroll offset are as they were when the page settled. Fail the test otherwise. Risk: it adds a check, and it only detects a move. It needs a fixture that moves focus before the capture. Effort: Medium.
- **Left out:**
  - Change nothing. The guard keeps moving focus before the capture.
  - Reset the scroll of each panel body after a walk, before the capture. A move after the capture is simpler, and it leaves no state for a later check to undo.
  - A capture on its own page load. K gives the same order with no second load of each document.
- **Wider fix:** K. A capture before every check is a right default, so a new check lands after the capture. F only groups the two keyboard checks, so a new check can still land before the capture. L is the detection fix.
- **Previous examples:** Commit `26c3e7d0`, from PR #45, put the focus-outline walk after the capture for the same reason. On the closed branch, the guard ran at `disk.spec.ts:162`, before the capture, while the comment at line 253 still said that focus moves only after the capture.
- **Related:**
  - `plans/follow-ups/overlay-tab-guard-keeps-two-gaps.md`: options that conflict. Its options C, E and G each also settle the capture order. With K, its option C needs no move.
  - `plans/follow-ups/overlay-guard-never-tabs-past-last-control.md`: its options C and E also move the guard after the capture. No letter offers E with the shared step of F.
- **Recommendation:** K. It makes the right order the default for every check. It needs no step to remember and no new check, and it does not depend on the stricter walk. The earlier recommendation was C, which holds the move after the capture that the capture record of 2026-10-31 recommended over F. K also gives C of the other two guard items its move.
- **Action:** ask the user, because K changes the capture order, and the user reserved that choice when the approved port kept the guard before the capture.

Capture facts. The lines are at commit `6be0d89d` of the closed branch `calummoore/reland-mockup-overlay-focus`, unless they name `main`.

- The closed branch calls the guard at `disk.spec.ts:162`, before the smoke capture at line 248. Its focus-outline policy runs after the capture, at lines 254-259.
- The comment at line 253 says: "Focus moves only after the capture, so no capture shows a focus ring." On `main` at commit `164d73db`, the capture is at `disk.spec.ts:260-264`, the same comment at line 265, and the focus-outline policy at line 266.
- The guard presses Tab through every panel control at `disk-overlay-policy.ts:28-36`, then blurs the last one at lines 37-40.
- Keyboard focus scrolls each control into view, and blur does not scroll back. A panel is at most 76vh tall on desktop and 84vh on mobile, in `docs/mockups/styles/overlays.css:13-22`.
- Captures built from `main` before 2026-10-31 showed both switcher panels clipped, with the last pull request row below the fold. So the walk can leave the panel body scrolled, and the capture then shows that state. Each later panel that clips does the same.
- History: the review on 2026-10-26 ran no browser on the closed branch, so it could only estimate the impact on the four `product/viewer/switcher` captures.
- On 2026-11-04 a browser check measured `product/viewer/switcher` with the ported guard. The guard pressed Tab 10 times. The `scrollTop` of `.fo-viewer-panel-body` went from 0 to 95 on desktop, with `clientHeight` 623 and `scrollHeight` 718. On mobile it went from 0 to 239, with `clientHeight` 635 and `scrollHeight` 874. Blur left that scroll in place.
- C moves `checkDiskOverlay(page)` after `page.screenshot` and before `focusPolicyViolations`. The capture moves no focus, and the guard still starts from the top of the page.

History: On 2026-10-31 the viewer overlay focus item took in `overlay-tab-walk-runs-before-capture.md`. That record graded its direct fix Low severity, Small effort and Medium confidence, a test-only change, because nobody had measured the capture impact. Option F was its option B. Option C holds its option A, the move after the capture, which it recommended.
