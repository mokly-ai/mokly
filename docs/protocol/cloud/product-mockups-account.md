# Product Mockups: Account

This inventory is part of [Product mockups](./product-mockups.md).
Its paths match the current source and generated catalogue.

## Account And Onboarding

| Path                                | Canonical content and action                                                          | Empty / missing data                                               | Error recovery                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `product/account/sign-in`           | GitHub/email sign-in                                                                  | Untouched account form                                             | Send refused beside its control; address on its field; GitHub refused or opening soon beside it |
| `product/account/sign-up`           | GitHub/email account entry                                                            | Untouched account form                                             | Send refused beside its control; address on its field; GitHub refused or opening soon beside it |
| `product/account/magic-link`        | Check your email; resend/change email                                                 | No pending link; enter email                                       | Link couldn't be sent; request another                                                          |
| `product/account/callback`          | Signing in from an email or preview link or a desktop grant                           | Missing or invalid link                                            | Email expiry/use/failure; preview failure with retry; desktop expiry/failure                    |
| `product/account/connect-desktop`   | The browser's account; Open Mokly and Use another account                             | Link without a valid challenge                                     | Open Mokly refused beside it; try again                                                         |
| `product/account/create-workspace`  | Name, slug, address preview and Create                                                | Empty name, disabled submit                                        | Invalid, reserved or taken slug beside its field                                                |
| `product/account/install-app`       | Install on GitHub, the one action; the CLI form beneath                               | Nothing bound (repeats the canonical drawing)                      | Suspended on GitHub; resume there, then install                                                 |
| `product/account/choose-repository` | Repository select grouped by account, config path, slug/address; the CLI form beneath | No repositories yet; manage repository access                      | Load failure, retry; taken slug with a suggested recovery                                       |
| `product/account/project-created`   | Address, repository/config, publishing; Open                                          | Nothing publishing; the CI setup guide leads                       | This project couldn't load; retry                                                               |
| `product/account/invitation-accept` | Accepting a pending invitation                                                        | Link unavailable to this account; sign in with the invited address | Temporary failure; retry                                                                        |

Every workspace or project slug control uses the registered input's
identifier type. It renders without automatic capitalization, correction or
spellcheck, while names, repository paths and other prose fields keep their
normal text-input behavior.

Sign in and sign up send a magic link, which is a write, so a refusal is
reported beside the control that made it, through the registered
`write-failure` fragment, with the address the reader typed retained. The Email
field is marked only when the address itself is what was refused: the
`validation-failed` reason, carrying "Enter a complete email address." — the
sentence the registered input's invalid variant draws. Every other refusal is
reported beside the control with the field left unmarked, `rate-limited`
included, which carries its own retry-after sentence; marking the field for a
refusal the reader's own text did not cause tells them their text is wrong when
it is not. Connecting GitHub is the screen's other write, so a refusal of it is
reported beside Continue with GitHub through the same fragment and never
through the email control, which keeps its resting label, its field unmarked
and no disclosure beneath it. The running screen answers a GitHub action that
is not yet open with a notice of its own, which is not a refused write: it is
one flush notice line, announced politely, and it sits beside Continue
with GitHub where that control's causes sit, because everything said about a
control is said beside it. It offers no way back and discloses no reference,
because the same request cannot be made to succeed. Each situation beyond the
four states is its own screen beside sign in and sign up, in their folders:
`github-connecting`, `github-refused`, `github-opens-soon`, `address-refused`
and the [desktop app's](./product-mockups-account-desktop.md) `desktop`. `github-connecting` draws the
GitHub write while it runs: the form with **Continue with GitHub** busy with
"Connecting…" until the page leaves for GitHub, as
[Write in progress](./folio-chrome.md#compositions) defines.

The callback screens reproduce [Authentication callbacks](./auth-callbacks.md)
without naming an environment. The callback folder's own structure is in
[Callback landings](#callback-landings). Pending says **Signing you in**. Email recovery
uses the invalid, expired, used and generic titles, says **Request another
sign-in link**, and offers only **Back to sign in**. Preview invalid offers only
**Back to sign in**; its generic failure offers primary **Try again** and
secondary **Back to sign in**. The desktop landing's expired and generic
failures offer only **Back to sign in**. API-backed examples include the closed
**Details** disclosure; local missing-input and transport failures use the same
screen without an invented reference.

See [Install and repository steps](#install-and-repository-steps) for the
two steps that read GitHub and the CLI form beside them.

The ten primary account/onboarding screens in the table share one composition, specified under Account entry
in [Folio chrome: account entry](./folio-chrome-account.md): one 440px panel
on a dotted canvas with
the wordmark inside it, a 48px header carrying the identity or nothing, and a
Terms/Privacy footer. The three steps from creating a workspace to
choosing a repository carry the progress strip attached to the panel; sign in, sign up,
the magic link, the callback, the desktop connect page and the finished project
have no step to report. Sign in and sign up add the GitHub action, the `or`
rule and the email field, except in the desktop app's window.
The email-sent screen does not claim an authenticated identity. The finished
project carries the family's one outbound documentation link. Account headers
wrap when needed, keeping both gutters and readable type at 320px with 200%
text and system-font fallbacks.

The finished project reads its default branch. While that branch's first build
runs, the panel says “Mokly is publishing main.” beneath its title, Open project
leads into the viewer where the build runs, and Publish from CI — the CI setup
guide — sits beneath the body as the family's one outbound documentation link.
With nothing publishing, Publish from CI leads and Open project follows into
the project's viewer, so its empty state is a situation of its own rather than
a repeat of the canonical drawing.

Every data-backed screen's loading variant keeps the shell and draws the wait
that its screen reaches. A form whose write runs — sending the link,
connecting or creating — keeps the form with its pressed control busy, as
[Write in progress](./folio-chrome.md#compositions) defines. A screen whose
read runs — loading the installation, the repositories or the setup — draws
its own layout, as the [Wait](./folio-chrome.md#compositions) composition
defines. A pending address suggestion is a populated form situation, not that
owning screen's loading variant. No loading page presents fixture rows as
completed data.

## Install And Repository Steps

The install step draws for the reader's role. An owner or admin gets one
control, **Install on GitHub**, and no fact rows. A row that reads "Not
connected" would name the absence that the control removes. The default page
is the absent state: the title, the line "Choose the repositories Mokly can
read." and the action. The empty page repeats it, because a step with nothing
bound has no emptier drawing. The error page is the suspension: a fact that
reads "Suspended" with **Resume on GitHub** beside it, above the same action.
A connected workspace has no drawing here, because the route never shows the
step. While its reads run, the step draws the owner's and the admin's form,
because the person who creates a workspace owns it, and names the read in the
line under the title. While its write runs, the step keeps **Install on
GitHub**, busy with "Installing…", with Back and the CLI line.

`product/account/install-app` is a folder. Its canonical screen draws the four
pages above, and six screens stand beside it:

| Path                                               | What it draws                                                                                                                                                                    |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `product/account/install-app/member`               | The step for a member: the title, "Ask an owner or admin to install it." and no action                                                                                           |
| `product/account/install-app/reviewer`             | The step for a reviewer: **No projects yet**, "Ask an owner or admin to create the first project." and no action                                                                 |
| `product/account/install-app/connect`              | The connect situation, `/install?installationId=N`, with its states, its fact-row variant and the `connecting` screen in its folder                                              |
| `product/account/install-app/suspended-unreadable` | The suspension when the installation list could not be read: **Suspended**, "Couldn’t load" and a quiet **Try again** where **Resume on GitHub** would be, above the same action |
| `product/account/install-app/suspended-loading`    | The suspension while the installation list is read: **Suspended** and a placeholder where **Resume on GitHub** would be, above the same action                                   |
| `product/account/install-app/installing`           | The step while its write runs: **Install on GitHub**, busy with "Installing…", with Back and the CLI line                                                                        |

The member and reviewer drawings keep the step's strip and its way back.

Every drawing of the install step for a reader who can create a project, and
every drawing of the repository step, ends with the line **Publish with the CLI
instead** under the panel. The line opens the CLI form. A wait draws the line
as text with no link, because its target needs the workspace's slug. The
reviewer's drawing does not draw it, because a reviewer creates no project.
The connect situation does not draw it.

The connect situation is step 2 of the strip, with the title **Connect a
GitHub account**. Its canonical page draws a **Workspace** select over the
workspaces that the reader administers, then **Continue on GitHub** with the
GitHub glyph. The `one-workspace` variant draws the workspace as a fact row.
The empty variant draws the line "Create a workspace to connect this
account." and **Create a workspace**. The loading variant says "Loading your
workspaces". The error variant says "Workspaces couldn’t load" and offers
**Try again**. The strip claims the workspace step only when the reader has a
workspace. The connect situation already draws five pages, so its write is the
screen `product/account/install-app/connect/connecting` in its folder: the
canonical form with **Continue on GitHub** busy with "Connecting…" until the
page leaves for GitHub.

The repository step draws one field for the repository: the registered
`design/selector` labelled Repository, closed on the chosen repository. The
canonical page draws a workspace with two connected GitHub accounts, so the
select takes one section for each account, titled with the account name.
Under the field one sentence says "Don’t see it? Manage repository access".
With several accounts, its link opens the GitHub accounts pane. Config path,
the project slug with its address preview and **Create project** follow. The
empty page draws the select disabled over "No repositories yet", with the same
sentence. A list that fails says "Repositories couldn’t load" and offers **Try
again**. Screens beside the step draw its other situations:

| Path                                            | What it draws                                                                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `product/account/choose-repository/open`        | The select open: the registered `design/options-list` under the field, with the search field and one titled section for each account |
| `product/account/choose-repository/one-account` | A workspace with one account: a flat select, and a sentence whose link opens that installation's page on GitHub in a new tab         |
| `product/account/choose-repository/slug-taken`  | The taken-address refusal, and as its Empty variant an address suggestion that could not load                                        |
| `product/account/choose-repository/creating`    | The step while its write runs: the form, with **Create project** busy with "Creating…"                                               |
| `product/account/choose-repository/cli`         | The CLI form with its empty, loading and error states, and its wait for the workspace as the `workspace-loading` variant             |

The CLI form, `/:workspace/-/new/cli`, is step 3 of the strip, with the title
**Publish with the CLI**. It asks for **Repository**, Config path and the
project slug with its address preview, then **Create project**. The repository
is the Mokly CLI's repository identity, `<host>/<owner>/<name>`, and the
drawings name a repository on a host other than github.com. **Back** returns to
the repository step when the workspace has a connected account, and to the
install step otherwise. The canonical page draws a workspace with connected
accounts. The empty page draws the untouched form for a workspace with nothing
installed: the placeholder shows the identity's shape, the strip does not claim
the install step, and **Back** returns to the install step. The loading page
draws the project in creation. The error page draws the `duplicate-project`
refusal. The sentence beside **Create project** links to the project that
exists, the control keeps its label, and the reference stays under it.

## Invitation Acceptance

`product/account/invitation-accept` shows the signed-in invitation handoff.
Canonical shows the acceptance request in progress. Empty asks
the reader to use the invited address. Error offers a retry after a temporary
acceptance failure. The sibling `expired` screen asks for a new invitation.
The sibling `open-error` screen shows a successful acceptance when the
workspace read fails. Its retry opens the workspace without sending
another acceptance request. The Loading variant keeps the "Invitation accepted"
heading and shows "Opening your workspace" while that read is pending.
The acceptance error uses the outcome heading, one retry button, and an error
announcement without another visible title. Success opens the workspace's
current slug route immediately.

## Callback Landings

`product/account/callback` is the bespoke state family. Its canonical page is
the pending sign-in. `product/account/callback/email-invalid` has the email
link's expired, used and generic-failure outcomes as its variants.
`product/account/callback/preview-invalid` has the preview link's generic
failure as its variant. `product/account/callback/desktop-expired` draws the
[desktop landing](./auth-callbacks.md#desktop-callback) in the window: its
expired sign-in, with its generic failure as its variant. Its pending state is
the folder's canonical page. No screen carries more than four variants, and no
empty, loading or error name is invented where the callback contract has none.

The GitHub installation landings are five more screens in the folder, each
without variants. A reader starts that flow signed in, so the header names the
reader and the wordmark stays inert:

| Path                                         | Landing and outcome                      | What it draws                                                                                                                            |
| -------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `product/account/callback/install-requested` | Setup landing, `setup_action=request`    | **Installation requested**, "An owner of the GitHub organization approves it on GitHub." and **Back to install**, with no reference      |
| `product/account/callback/install-conflict`  | Callback, `github-installation-conflict` | **This GitHub account is connected to another workspace**, "Remove it from that workspace first.", the reference and **Back to install** |
| `product/account/callback/install-denied`    | Callback, `permission-denied`            | **You don’t administer this GitHub account**, announced without a second title, the reference and **Back to install**                    |
| `product/account/callback/install-setup`     | Setup landing, completing                | **Install the Mokly app** over one state card placeholder whose title says "Completing installation…"                                    |
| `product/account/callback/install-authorize` | Callback, completing                     | **GitHub installation** over one state card placeholder whose title says "Completing installation…"                                      |

The situations declaration lists all fourteen callback states at these paths.

## Desktop App

The drawings of desktop sign-in and of the desktop app's web setup are in
[Product mockups: desktop app](./product-mockups-account-desktop.md).

## Recovery

The Recovery folder sits at Product's top level. Its screen modules live under
`src/screens/product/recovery/`, and its entry is
`src/entries/product/recovery/not-found.mockup.tsx`.
`product/recovery/not-found` is the app-owned screen for an unmatched product path. Its
mobile and desktop views say the page could not be found and offer exactly
one action, **Open dashboard**, to `/dashboard`. They show no raw URL, framework
copy, sitemap link, viewer chrome, product data or invented fixture value. The
route performs no data read, so its Empty, Loading and Error variants repeat the
canonical screen with that reason recorded in the situations declaration.
