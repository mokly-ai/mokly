# Some Linux readers cannot receive the grant

- **Severity:** Medium. **Effort:** Medium. **Confidence:** High. **Harder later:** No.
- **Kind:** Needs decision.
- **Added:** 2026-11-06, from the options check of decision 2 of the desktop browser sign-in plan on the branch `calummoore/desktop-browser-authentication`. The user chose the `mokly` scheme (option A) before the check added option D, and has not answered D.
- **Location:** `docs/protocol/cloud/desktop-app.md` "Sign-In Handoff", `packages/desktop/src/handoff.ts:4` and `docs/protocol/cloud/desktop-sign-in.md` "Connect Page".
- **Reason:** The fix adds a fallback at the sign-in boundary that no requirement covers.

- **Terms:**
  - **Desktop grant:** a one-use sign-in code that the browser page issues to the desktop app. It is useless without a secret verifier that only the app holds.
  - **`mokly` scheme:** `mokly://` addresses that the operating system passes to the desktop app. The macOS app and the `.deb` package register it. An AppImage registers it only when the reader integrates it into the desktop.
- **Background:**
  - The browser page hands the grant to the app with `mokly://auth/desktop/callback#grant=<grant>` after **Open Mokly**.
  - Before this change, a reader with a non-integrated AppImage could still sign in with GitHub inside the window. GitHub no longer loads in the window.
  - Another program can claim the scheme, and the grant it receives is useless without the verifier.
- **Problem:** When nothing answers the scheme, the reader cannot sign in to the desktop app at all.
- **Impact if no action:** Readers with a non-integrated AppImage, or whose scheme another program claimed, cannot use the desktop app. Their recovery is to integrate the AppImage or install the `.deb`.
- **Root question:** How does a reader sign in when the scheme does not reach the app?
- **Options:**
  - **A.** Change nothing. Effort: Small.
  - **B.** A loopback listener on `127.0.0.1` during one sign-in, to which the page redirects. It needs a local listener and a return page. Effort: Medium.
  - **C.** The app polls the API with a short code until the browser approves. A phishing link can make a signed-in reader approve an attacker's app. Effort: Large.
  - **D.** Keep the scheme, and add a pasted grant as the fallback. The page's opened state offers a copy action, and the app's waiting state accepts a paste. A copied or captured grant gives nothing without the verifier. It needs states on both sides, mockups and copy. Effort: Medium.
  - **E.** The AppImage registers the scheme itself at each launch. It writes a desktop entry without asking, and it fixes only the AppImage case. Effort: Medium.
- **Left out:** Claimed HTTPS links do not exist on Linux.
- **Wider fix:** D. It recovers from every delivery failure, whatever the cause.
- **Previous examples:** PR #42 chose a scheme link, not a device-code flow, for email sign-in.
- **Recommendation:** D. Every reader can then sign in, and the reader pastes only when the scheme fails. If a pasted code counts as typing a credential, keep A.
- **Action:** Ask the user, because D adds a fallback at the sign-in boundary that no requirement covers.
