# Mac buttons follow a fixed bar height

- **Severity:** Low. **Effort:** Large. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-18, from branch `calummoore/mac-title-bar-integration`, review round 3, finding 3, as its blocked wider fix.
- **Location:** `packages/desktop/src/window.ts` and the shell module that sets the Mac button position from the page zoom.
- **Reason:** The wider fix adds a preload bridge, and the renderer settings in `docs/protocol/cloud/desktop-bundle.md` allow none before local mode.

- **Terms:**
  - **Window buttons:** the native macOS close, minimize and zoom buttons, which the desktop app keeps at the start of its own 48px top bar, because its window has no title bar.
  - **Preload bridge:** a script that Electron runs before the page and that lets the page send values to the shell.
- **Background:** On 2026-11-18 review finding 3 found that page zoom moved the app's top bar but not the window buttons. The direct fix makes the shell set the button position from the zoom factor and the 48px bar height: after each of its own zoom menu items, each `zoom-changed` event and each navigation, outside full screen.
- **Problem:** The direct fix must know every zoom source and the 48px bar height. A new zoom source, such as pinch zoom, or a top bar of another height leaves the buttons off centre again.
- **Impact if no action:** A later zoom source or bar shape can misalign the buttons in the Mac app, and only a check on a Mac shows it.
- **Root question:** How do the window buttons stay centred on the bar that the page actually draws, whatever changes its size?
- **Options:**
  - **A.** Keep the direct fix, and add each new zoom source or bar height to it when it appears. Effort: Small.
  - **B.** Add one preload bridge method. The app measures the first row of its top drag area after each resize, overlay change and route change, and sends its height in CSS pixels. The shell checks the value, multiplies it by the zoom factor and sets the button position. This changes the renderer settings requirement. Effort: Large.
- **Left out:** Disabling page zoom. The 200% text zoom rule of `docs/protocol/cloud/design-tokens.md` needs it.
- **Wider fix:** B. The shell then follows the measured bar, so no zoom source or bar shape can drift.
- **Previous examples:** None found.
- **Related:** None.
- **Recommendation:** A, until local mode adds its bridge. Then B can use that bridge.
- **Action:** ask the user, because B changes the renderer settings requirement, which allows no preload script before local mode.
