# A magic link can switch the signed-in account

- **Severity:** High. **Effort:** Medium. **Confidence:** Medium. **Harder later:** No.
- **Kind:** Outside the scope.
- **Added:** 2026-11-06, from the desktop browser sign-in brainstorm on the branch `calummoore/desktop-browser-authentication`.
- **Location:** `packages/app/src/screens/account/callback-screen.tsx:128-150`, `docs/protocol/cloud/auth-sessions.md` "Magic Links" and "Sessions", and `docs/protocol/cloud/auth-callbacks.md` "Email Callback".
- **Reason:** The fix changes sign-in requirements for the web app, which the desktop browser sign-in change does not touch.

- **Terms:**
  - **Magic link:** the one-use email sign-in link `<app-origin>/auth/email/callback#token=<64 hex>`, valid for fifteen minutes.
  - **Login CSRF:** an attack that signs a victim in to the attacker's account, so the victim's later actions land in that account.
- **Background:**
  - The email landing exchanges the token from its fragment as soon as the page loads.
  - A successful exchange revokes the session that the request carries and issues a session for the link's account.
  - Any address can request a link for itself, so an attacker can hold a valid token for their own account.
  - The desktop browser sign-in change stops the desktop app from accepting magic-link tokens. The web landing keeps this behaviour.
- **Problem:** A page or message from someone else can link to their own magic link. A reader who opens it within fifteen minutes is signed out of their account and into the other account without a prompt.
- **Impact if no action:** A reader can connect their GitHub identity or install the GitHub App on their repositories inside an attacker's workspace. The attacker then reads that repository data through their own account.
- **Root question:** How does a reader avoid a silent switch to an account that they did not ask to sign in to?
- **Options:**
  - **A.** Accept the risk and state it in `auth-sessions.md`. Many magic-link products do. Effort: Small.
  - **B.** When the browser already has a session for another account, the landing asks before it exchanges, and names both accounts. Effort: Medium.
  - **C.** Bind each link to the browser that requested it with a cookie set at issue. A link opened elsewhere asks before it exchanges. It also breaks the flow for readers who open mail on another device. Effort: Large.
- **Left out:** Asking on every exchange adds a step to every sign-in, and B gives the same protection to readers with a session.
- **Wider fix:** C. It ties every link to the browser that asked for it.
- **Previous examples:** None found.
- **Recommendation:** B. It stops a silent switch where harm is possible and keeps one-press sign-in for a signed-out reader.
- **Action:** Ask the user, because B and C change the email callback requirements in `auth-callbacks.md`, and nobody has examined the attack in depth.
