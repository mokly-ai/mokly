# Desktop Sign-In

This is the screen sub-contract of
[Desktop application](./desktop-app.md#sign-in): the window's entry screen and
the browser page that issues a desktop grant.
[Desktop grants](./auth-sessions.md#desktop-grants) define the API, the
[desktop landing](./auth-callbacks.md#desktop-callback) the exchange in the
window, and [Product mockups: desktop app](./product-mockups-account-desktop.md)
the drawings. Copy follows [Product copy](./product-copy.md).

## Flow

1. In the window, the entry screen's action creates a verifier of 32
   cryptographically random bytes as 64 lowercase hex digits. It keeps the
   verifier in browser storage scoped to the window's tab, as GitHub flow
   records are kept, and replaces any earlier verifier.
2. The action opens
   `<public app origin>/connect/desktop?challenge=<S256>&returnTo=<path>` as a
   popup, which the shell opens in the system browser. `<S256>` is the
   verifier's challenge, as [Desktop grants](./auth-sessions.md#desktop-grants)
   define it. `returnTo` is the entry screen's own, and the address omits it
   when the entry screen has none.
3. When the browser has no session, the page sends the reader to sign in
   first, with any method. It then names the browser's account and waits for
   **Open Mokly**.
4. **Open Mokly** requests a grant for the page's challenge and `returnTo`,
   then opens `mokly://auth/desktop/callback#grant=<grant>` in the same tab.
   The browser hands the address to the operating system, and the page stays.
5. The shell loads the landing through the
   [sign-in handoff](./desktop-app.md#sign-in-handoff), and the landing
   exchanges the grant with the verifier for the window's session.

## Entry Screen

Inside the shell, `/sign-in` and `/sign-up` render the entry screen in the
account-entry panel, in place of the email form and the GitHub action. The
screen keeps `returnTo`. It draws no switch to the other entry screen, because
the browser page offers every way in.

| State   | Title                                                                 | Line | Action                  |
| ------- | --------------------------------------------------------------------- | ---- | ----------------------- |
| Default | `Sign in to Mokly` on `/sign-in`; `Create your account` on `/sign-up` | None | **Continue in browser** |
| Waiting | `Check your browser`                                                  | None | **Open browser again**  |

Each action is primary and carries the external glyph, because it leaves the
app. **Continue in browser** starts the flow above and shows the waiting
state. **Open browser again** opens the page again with the same challenge, so
a grant from either browser tab signs the window in.

## Connect Page

`/connect/desktop` is an account-shell page on the public app origin. It
requires exactly one `challenge` query value of 43 base64url characters, and it
checks that value before anything else. Any other address shows the invalid
state and sends no request. A browser with no session replaces the page with
`/sign-in`, with the page's complete address as `returnTo`, so the reader signs
in with any method and comes back. The header names the reader, as on every
signed-in account screen.

| State        | Title                       | Line                                | Actions                                      |
| ------------ | --------------------------- | ----------------------------------- | -------------------------------------------- |
| Confirmation | `Sign in to the Mokly app`  | `Signed in as <email>`              | **Open Mokly**, then **Use another account** |
| Opened       | `Continue in the Mokly app` | None                                | **Open Mokly**                               |
| Invalid link | `This link isn’t valid`     | `Sign in again from the Mokly app.` | None                                         |

The confirmation line names the account where the reader decides between
**Open Mokly** and **Use another account**, so it stays even when the header
shows the same address.

**Open Mokly** is primary and carries the external glyph, because it leaves
the browser. The page requests a grant only after that press, never on load,
so the reader sees which account the app receives before it receives it.
While the request runs, the control reads `Opening…` and refuses a second
press. On success the page opens the grant's scheme address in the same tab
and shows the opened state.

Later presses reuse the held grant until it expires, so the shell ignores them
as duplicates. A press after the grant expires requests a new grant. A new
grant for every press was rejected, because the second grant would reach a
landing whose verifier the first exchange already used. The control is the
package Button, which renders no anchor, so the grant lives only in memory: no
`href` shows it on hover or offers to copy it. The page renders no part of the
grant as text. When nothing answers the scheme, the page stays in the opened
state; the [sign-in handoff](./desktop-app.md#sign-in-handoff) names the
packages that register it.

**Use another account** is secondary. It signs the browser out and replaces
the page with `/sign-in`, with the page's complete address as `returnTo`.

A refused or failed request is reported beside the control that sent it,
through the [write failure](./folio-chrome.md#compositions) fragment with its
reference. The control becomes the way to try again, as
[Web API client](./web-api-client.md#api-client) defines for every form. A
`desktop-grant-invalid` refusal shows the invalid state instead.
