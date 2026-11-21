# Home demo drawings replay after a resize

- **Severity:** Low. **Likelihood:** Rare. **Effort:** Small. **Confidence:** High. **Harder later:** No.
- **Kind:** Fix after merge.
- **Added:** 2026-11-21, from `calummoore/canvas-redesign-m5-site-home-hb2n` (the site home).
- **Location:** `apps/site/src/components/home/demos.ts`, `apps/site/src/styles/home-browse-connector.css`, `apps/site/src/styles/home-browse-demo.css`, `apps/site/src/styles/home-foundation.css`
- **Reason:** A rare product bug of low severity gets its fix after the merge, and the fix stays as small later.

- **Terms:**
  - **Home demos island:** the script `apps/site/src/components/home/demos.ts`, which `home-island.ts` starts on the home.
  - **Demo state:** the attribute `data-home-demo-state` on a demo's root, `armed` before the demo comes into view and `play` once it does.
- **Background:** Each frame of the site home (Browse, Review, Edit and the open foundation) draws a demo in CSS. The island sets `play` once, and the frame's sheet runs keyframe animations under `[data-home-demo-state="play"]`. The Browse frame draws its prototype connector in up to four drawings, one for each layout step (1440px, the wide and the stacked fitted drawings, and the phone), and its sheets hide the drawings of the other steps with `display: none`. The open foundation draws its code-to-screen wire the same way at 1440px, 1280px and below.
- **Problem:** The state stays `play` after the demo ends. When a reader resizes or rotates across 768px, 1100px, 1280px or 1440px after the demo, a drawing that was hidden now shows, and its animation starts from the beginning, because a browser restarts a CSS animation when its element leaves `display: none`. The connector or the wire then draws itself in a second time. The Swipe divider and every other part stay at rest, and nothing loops.
- **Impact if no action:** A reader who resizes the window after a demo sees one connector or wire draw itself again. The page stays correct.
- **Root question:** How does a home demo stay at rest after it has played, whatever the window does?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** The island clears a demo's state when its animations end, for example when the last `animationend` of the demo's root arrives or after the demo's longest animation, so the base rules, which draw the finished state, apply alone. Effort: Small.
  - **C.** Hide the drawings of the other layout steps by a means that keeps their animation's progress, such as `visibility: hidden`. Every frame then keeps hidden drawings in the layout, and each new drawing needs the same care. Effort: Medium.
- **Left out:** Transitions in place of keyframe animations, because the island contract of the site home runs each demo as keyframes from a start state to the built finished state.
- **Wider fix:** B, because it ends every demo in one place, for every frame and every later drawing.
- **Previous examples:** None found.
- **Recommendation:** B. It fixes every frame in the island, and the built finished state then needs no animation at all.
- **Action:** fix after merge, apply B, because a rare low-severity bug waits for the merge and the fix stays small.
