# Product Mockups: Desktop App

This inventory is part of [Product mockups: account](./product-mockups-account.md).
It lists the drawings of desktop sign-in and of the desktop app's web setup.
Its paths match the current source and generated catalogue.

## Desktop App

These drawings carry [Desktop sign-in](./desktop-sign-in.md) and the
[web setup](./desktop-app.md#web-setup) of the desktop app. The window's entry
and landing are signed out, so their header names nobody. The connect page is
in the browser, so its header names the reader.

| Path                                              | What it draws                                                                                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `product/account/sign-in/desktop`                 | The window's entry: **Sign in to Mokly** and **Continue in browser**; its `waiting` variant draws **Check your browser** and **Open browser again**           |
| `product/account/sign-up/desktop`                 | The same entry titled **Create your account**, with the same `waiting` variant                                                                                |
| `product/account/connect-desktop`                 | The browser page's confirmation: **Sign in to the Mokly app**, "Signed in as" with the reader's email, **Open Mokly** and **Use another account**             |
| `product/account/connect-desktop/session-loading` | The browser page while the session read runs: **Loading your account…** under the title, both controls disabled, and the identity's placeholder in the header |
| `product/account/callback/desktop-expired`        | The window's landing: **This sign-in has expired** and **Back to sign in**; its `failure` variant draws **We couldn’t sign you in** with the reference        |
| `product/settings/account/desktop`                | A variant of the account pane: **Connect GitHub** in the window, for a reader without GitHub                                                                  |
| `product/settings/github/desktop`                 | A variant of the GitHub accounts pane: **Add GitHub account** in the window                                                                                   |
| `product/account/install-app/desktop`             | A variant of the install step: **Install on GitHub** in the window                                                                                            |

The two entry screens stand beside sign in and sign up, in their folders. The
connect page is a standard screen. Its Empty variant draws the invalid link:
**This link isn’t valid**, "Sign in again from the Mokly app." and no action.
Its Loading variant draws **Open Mokly** reading `Opening…` while the grant
request runs. Its Error variant draws the refused request beside that control,
which reads **Try again**, with the reference beneath. Its fourth variant,
`opened`, draws **Continue in the Mokly app** with **Open Mokly** alone. The
redirect of a signed-out browser to sign in has no drawing.

Every action that leaves its surface carries the external glyph:
**Continue in browser**, **Open browser again**, **Open Mokly** and the three
GitHub actions of the window variants. The connect situation of the install
screen has no window drawing, because only a GitHub return reaches it, and
that return lands in the browser.
