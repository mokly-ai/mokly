# Check the Mac window by hand on a Mac

- **Severity:** Medium. **Effort:** Small. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-11-20, from the open Milestone 5 TODOs of the plan that branch `calummoore/pr-completion-from-branch-8cbc` deleted.
- **Location:** `apps/desktop/src/window.ts`, `apps/desktop/src/window-buttons.ts`, `apps/app/src/layout/covered-drag-areas.ts`, `apps/app/src/layout/drag-covers.ts` and `apps/app/src/components/window-band.tsx`.
- **Reason:** The user merged the change before these checks, and only a person on a Mac can run them.

- **Terms:**
  - **Window buttons:** the native macOS close, minimize and zoom buttons. On macOS the desktop app's window has no native title bar, so the buttons sit at the start of the app's own 48px top bar, centred in its height.
  - **Drag region:** a part of a top bar that moves the window when the reader drags it. Only the cloud-owned parts of each top bar are drag regions. A screen without a top bar has a 48px band at the top instead.
  - **Cover:** a surface over part of a drag region: a surface that the viewer package draws, such as its open compact search or an expanded preview frame, or a focused skip link. While a cover is there, the part under it stops moving the window, so the cover takes presses.
- **Background:** The Mac Window section of `docs/protocol/cloud/desktop-bundle.md` gives the requirements. The tests cannot prove them on a real window. The browser tests under `apps/app/src/_tests_/mac-window/` emulate the drag regions in Chromium, and browser clicks do not pass through the macOS window layer. The packaged smoke in `apps/desktop/scripts/packaged-smoke.mjs` runs on a macOS runner in CI. It checks that the window controls overlay is on, reads the start inset, checks the button position at 120% page zoom, and captures the native window. On 2026-11-20 on macOS 26 it reported a 92px start inset (86px on macOS 15 on 2026-11-06), and buttons at x 16, y 22 at 120% zoom. Its capture showed no title bar and the buttons centred in the bar. No person has used the window on a Mac yet.
- **Task:** Build or install the packaged app from the Desktop release workflow, and check each of these on a Mac:
  1. The buttons are centred in the top bar. The cloud parts of each bar move the window. A double click on a drag region zooms the window. Full screen closes the space of the buttons. A dialog and a narrow window keep the buttons clear.
  2. In a right-to-left locale the buttons sit at the end of the bar, and each bar ends its content before them. At a high page zoom, with the viewer's compact search open in the narrowest window, the bar still clears the buttons.
  3. The window still moves from a bar while a dialog or a menu is open. Tooltips show inside a drag region. A press on the focused skip link works. The Linux window ignores the drag regions.
  4. A double click on a drag region follows the macOS title bar setting, "Double-click a window's title bar to", in Desktop & Dock.
  5. An expanded preview frame, the open compact search and the focused skip link take presses where they cover a top bar. The bar moves the window again when each one closes.
- **Impact if no action:** A fault that only the real macOS window layer shows, such as a drag region that eats a click or buttons off centre, reaches users of the Mac app.
- **Needs:** A Mac and the packaged app of a commit that holds this change.
- **Done when:** Each check passes, or each failure has its own follow-up item. When check 4 does not follow the macOS setting, raise a decision, because the requirement in `docs/protocol/cloud/desktop-bundle.md` does not cover it.
