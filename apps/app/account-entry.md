# Account Entry

This is the account entry guide for the [App package](./README.md).

Sign-in is one magic-link process for new and returning readers; GitHub
sign-in, connection and App installation each land on their own route. A
credential leaves the address before the router records it, and an accepted
`returnTo` destination survives email, GitHub and desktop grant sign-in byte
for byte or becomes `/dashboard`. Inside the desktop shell, sign in and sign
up open the browser instead: the entry keeps a verifier in its tab and opens
`/connect/desktop` for the verifier's challenge, that page names the
browser's account and after **Open Mokly** hands the app a one-use grant
through `mokly://auth/desktop/callback`, and `/auth/desktop/callback` in the
window exchanges the grant with the verifier. In the shell the GitHub actions
open their own routes on the web, and the window reads the session and the
open screen's GitHub accounts again when it gets focus back. The rules are
[Desktop sign-in](../../docs/protocol/cloud/desktop-sign-in.md) and
[web setup](../../docs/protocol/cloud/desktop-app.md#web-setup). An invitation link carries its route through sign-in,
accepts with the invited account's session, and distinguishes an acceptance
that succeeded from a workspace read that failed afterwards. After
acceptance succeeds, the invitation screen keeps that success while it opens
the workspace. A failed workspace read retries that read alone, with the
pending label naming the operation. An acceptance failure keeps one visible
outcome and retry action, with a screen reader announcement. The landing
rules are [Authentication callbacks](../../docs/protocol/cloud/auth-callbacks.md).

Onboarding is three steps, Workspace, Install and Repository, and the install
step draws for the reader's role: an owner or admin installs the App, a member
is told who can, and a reviewer is told the workspace has no projects yet.
Every role that can create a project also gets **Publish with the CLI
instead**, which opens the CLI form at `/:workspace/-/new/cli`: a project from
a repository the Mokly CLI names on any Git host, with no repository link. An
installation GitHub returns with no flow behind it, from Configure on GitHub or
an install started there, leaves its landing for the connect situation at
`/install?installationId=`, which starts the candidate flow for the workspace
the reader chooses. The repository step groups its select by GitHub account
when the workspace connects several, and the `github` settings pane lists,
removes and adds the workspace's accounts. The step rules are
[Product accounts and roles](../../docs/protocol/cloud/product-accounts-and-roles.md)
and the pane's are [GitHub accounts](../../docs/protocol/cloud/settings-dialog-github.md).
