# Packaged desktop browser sign-in is not proven

- **Severity:** Medium (estimate). **Effort:** Small (estimate). **Confidence:** High. **Harder later:** No.
- **Kind:** Post-merge task.
- **Added:** 2026-11-06, from the post-merge tasks of the desktop browser sign-in plan on the branch `calummoore/desktop-browser-authentication`.
- **Location:** `packages/desktop`, `docs/protocol/cloud/desktop-distribution.md` (the manual check), and the main-preview environment.
- **Reason:** The check needs the merged change deployed to main-preview and signed packaged builds.

- **Terms:**
  - **Desktop grant:** a one-use sign-in code that the browser page `/connect/desktop` issues to the desktop app through the `mokly` scheme.
- **Background:**
  - The desktop app now signs in through the browser: **Continue in browser** opens `/connect/desktop`, **Open Mokly** hands a grant to the app, and the app exchanges it with a verifier that only it holds.
  - GitHub connection and App installation open on the web, and the app re-reads its account data when its window gets focus.
  - The Electron smoke test proves the flow against a local API with a launch argument. No test opens a real browser or uses the operating system's scheme registration.
- **Task:** With a packaged macOS build and a `.deb` build against main-preview, sign in through the browser with **Open Mokly**, then connect GitHub on the web, return to the app and check that the account pane shows the connection.
- **Impact if no action:** A packaging or scheme-registration fault in the real handoff stays unnoticed until a reader meets it.
- **Needs:** The merged change deployed to main-preview, with `MKC_DESKTOP_CLIENT` set to `true`, and signed packaged builds.
- **Done when:** Both packages sign in through the browser and show a GitHub connection finished on the web, or the failure has its own follow-up item.
