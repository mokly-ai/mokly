# Product Mockups: Settings

This inventory is part of [Product mockups](./product-mockups.md).
Its paths match the current source and generated catalogue.

## Settings

Panes of the [settings dialog](./settings-dialog.md). Each pane is one screen
component rendered inside the registered dialog frame on desktop, over the same
viewer stage placeholder the Viewer family uses, and inside the registered
full-screen settings layer on mobile. The stage keeps its slots blank under the
dialog: it names nothing, draws no control and carries no landmark, because the
dialog is the subject of those entries. Screen modules live under
`src/screens/product/settings/`; a pane's entry is
`src/entries/product/settings/<pane>.mockup.tsx`, or sits in a `<pane>/`
directory beside the screens of its folder. The
screen root owns the document's single `main` landmark and `h1`; the page
beneath is rendered inert with `aria-hidden` and keeps no landmark of its own.

| Path                         | Canonical content and action                                                    | Empty / missing data                             | Error recovery                       |
| ---------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------ |
| `product/settings/sections`  | Section list, linking every pane                                                | No workspace; create one                         | Settings couldn't load; retry        |
| `product/settings/account`   | Name, email, GitHub connection, sign out                                        | No name set; GitHub not connected                | Save refused beside its control      |
| `product/settings/workspace` | Name, plan, slug/address, GitHub accounts fact and projects overview            | No projects; the next setup step                 | Projects couldn't load; retry        |
| `product/settings/github`    | Connected GitHub accounts, each row's three-dot menu, Add GitHub account        | No GitHub accounts yet; add one                  | GitHub accounts couldn't load; retry |
| `product/settings/members`   | Members/roles, pending invitations, invite form, selected member                | No pending invitations; invite                   | Members couldn't load; retry         |
| `product/settings/billing`   | Plan, Editors and Collaborators in use, monthly total, Manage billing           | Free plan; Upgrade to Team with prices and trial | Billing couldn't load; retry         |
| `product/settings/project`   | Name, slug/address, repository/config, visibility, Automatic builds switch      | No editable changes                              | Save failed; retain values           |
| `product/settings/tokens`    | Token metadata, modal create/reveal, three-dot actions menu and revoke question | No tokens; create one                            | Tokens couldn't load; retry          |
| `product/settings/access`    | Inherited workspace access and project grants                                   | No additional project grants                     | Access couldn't load; retry          |
| `product/settings/danger`    | Consequences, name confirmation and Delete project                              | Empty confirmation; disabled delete              | Deletion failed; retain name         |

`product/settings/sections` is the settings index. Mobile presents it at the
`/settings` route, and the desktop dialog shows it when no pane is named.
Its leaf remains `sections`, yielding `product/settings/sections` and shell
URL `/view/product/settings/sections/`. Its generated views are
`product/settings/sections/index.<viewport>[.dark].html`.

The invite form and member details with their role are inline states of their
pane, not separate screens; the members pane renders its inline sub-state in
the canonical entry with fixture selection. Every row in the members list opens
that person for management, because the pane selects nobody until the reader
asks. A confirmation that interrupts a row or a field, and the reveal of a
secret a write returns once, are modals the pane opens, each with its own
screen. A row's three-dot menu, open, is its own screen too: a popover anchored
to the trigger on desktop and a bottom sheet on mobile. The token list contains
no secret; the revealed example is explicitly
nonfunctional fixture data documented outside the screen. Pending/destructive
forms show their operation while loading and prevent duplicate writes.
Confirming a name alone does not submit a deletion. Mockup buttons perform no
real mutation. A pane opens one overlay at a time — its row menu or one modal —
and no overlay opens a layer of its own.

Panes own situations beyond their four states. Each is drawn either as a
variant of the screen it belongs to or as a screen beside it in that pane's
folder, as the [hierarchy rule](./product-mockups.md#hierarchy-and-composition) decides, so no screen renders more than
five drawings:

| Path                                             | Belongs to                            | Drawn as | What it draws                                                                                     |
| ------------------------------------------------ | ------------------------------------- | -------- | ------------------------------------------------------------------------------------------------- |
| `product/settings/account/scope-loading`         | `product/settings/account`            | Screen   | The pane asked for by address while the scope loads: the session's text, controls disabled        |
| `product/settings/account/session-loading`       | `product/settings/account`            | Screen   | The pane asked for by address while the session loads: a bar for the email, GitHub waiting        |
| `product/settings/account/github-connecting`     | `product/settings/account`            | Screen   | Connect GitHub busy with Connecting… until the page leaves for GitHub                             |
| `product/settings/project/visibility`            | `product/settings/project`            | Screen   | The visibility modal in flight over the pane, independent of the name draft                       |
| `product/settings/project/visibility/plan`       | `product/settings/project/visibility` | Variant  | The modal after a free-plan refusal, with the owner's way to Billing                              |
| `product/settings/project/visibility/plan-admin` | `product/settings/project/visibility` | Variant  | The same modal refusal for an admin, whose way on is asking an owner                              |
| `product/settings/project/visibility/private`    | `product/settings/project/visibility` | Variant  | The modal in flight for a public project: Making private…, with Keep public disabled              |
| `product/settings/project/slug`                  | `product/settings/project`            | Screen   | Project slug edit with address preview, validation and suggested recovery                         |
| `product/settings/project/no-builds`             | `product/settings/project`            | Variant  | A project that cannot build, with one sentence where the Automatic builds switch would be         |
| `product/settings/project/builds-saving`         | `product/settings/project`            | Screen   | The Automatic builds switch saving: "Saving…" beside its label, the switch disabled               |
| `product/settings/project/scope-loading`         | `product/settings/project`            | Screen   | The pane asked for by address while the scope loads: bars for its facts, controls waiting         |
| `product/settings/tokens/create`                 | `product/settings/tokens`             | Screen   | Naming a token in the create modal, with its working and name-refused states                      |
| `product/settings/tokens/create/reveal`          | `product/settings/tokens/create`      | Variant  | The one render of the new secret, in the modal that made it                                       |
| `product/settings/tokens/create/copy`            | `product/settings/tokens/create`      | Variant  | The reveal in a browser that would not take the secret, with no reference                         |
| `product/settings/tokens/revoke`                 | `product/settings/tokens`             | Screen   | The revoke confirmation over the row it belongs to, with its working state                        |
| `product/settings/tokens/revoke/menu`            | `product/settings/tokens/revoke`      | Variant  | The row's three-dot menu open: an anchored popover on desktop, a bottom sheet on mobile           |
| `product/settings/members/identity`              | `product/settings/members`            | Variant  | Managing someone whose only name is their email address, longer than the column                   |
| `product/settings/members/scope-loading`         | `product/settings/members`            | Screen   | The pane asked for by address while the scope loads: its wait, a bar for the workspace's name     |
| `product/settings/members/remove`                | `product/settings/members`            | Screen   | The removal confirmation over the person it concerns, with its working state                      |
| `product/settings/members/invitation-sending`    | `product/settings/members`            | Screen   | Send invitation busy with Sending…, with the address and the role it sends disabled               |
| `product/settings/members/invitation-revoking`   | `product/settings/members`            | Screen   | Revoke invitation busy with Revoking… on the invitation's own row                                 |
| `product/settings/members/role-saving`           | `product/settings/members`            | Screen   | Save role busy with Saving…, with the chosen role and the removal disabled                        |
| `product/settings/workspace/suspended`           | `product/settings/workspace`          | Screen   | The GitHub accounts fact naming its one account as suspended                                      |
| `product/settings/workspace/absent`              | `product/settings/workspace`          | Screen   | The GitHub accounts fact reading None, before the first account and after the last is removed     |
| `product/settings/workspace/accounts-loading`    | `product/settings/workspace`          | Screen   | The GitHub accounts fact while its installation list loads: a placeholder where the names go      |
| `product/settings/workspace/accounts-unreadable` | `product/settings/workspace`          | Screen   | The GitHub accounts fact when that read failed: "Couldn’t load" and a quiet Try again             |
| `product/settings/github/suspended`              | `product/settings/github`             | Screen   | The organization's installation suspended on GitHub, with Resume on GitHub on its row             |
| `product/settings/github/member`                 | `product/settings/github`             | Screen   | The accounts read by a member, with no row menu and no Add GitHub account                         |
| `product/settings/github/menu`                   | `product/settings/github`             | Screen   | A row's three-dot menu open: an anchored popover on desktop, a bottom sheet on mobile             |
| `product/settings/github/remove`                 | `product/settings/github`             | Screen   | The remove confirmation over the row it belongs to, with its working state                        |
| `product/settings/github/adding`                 | `product/settings/github`             | Screen   | Add GitHub account busy with Adding… until the page leaves for GitHub                             |
| `product/settings/workspace/slug`                | `product/settings/workspace`          | Screen   | Workspace slug edit with address preview, validation and suggested recovery                       |
| `product/settings/workspace/slug-recovery`       | `product/settings/workspace/slug`     | Screen   | Address conflict recovery, with its own default and error states                                  |
| `product/settings/workspace/plan`                | `product/settings/workspace`          | Screen   | A downgraded workspace whose private project takes no new publication, with Billing for its owner |
| `product/settings/workspace/plan-member`         | `product/settings/workspace`          | Screen   | The same consequence read by a member, with the sentence to ask an owner                          |
| `product/settings/workspace/scope-loading`       | `product/settings/workspace`          | Screen   | The pane asked for by address while the scope loads: bars for its facts, one waiting row          |
| `product/settings/workspace/saving`              | `product/settings/workspace`          | Screen   | Save changes busy with Saving…, with the name it sends kept in its field                          |
| `product/settings/billing/scope-loading`         | `product/settings/billing`            | Screen   | The pane asked for by address while settings loads, as Stripe returns: every fact a bar           |
| `product/settings/billing/route-loading`         | `product/settings/billing`            | Screen   | The same wait on its route on a wide surface until it hands over: the Project panes disabled      |
| `product/settings/billing/confirming`            | `product/settings/billing`            | Screen   | Returned from Checkout, re-reading billing until the subscription is confirmed                    |
| `product/settings/billing/delayed`               | `product/settings/billing`            | Screen   | The bounded confirmation ended before Team appeared, with one Check again action                  |
| `product/settings/billing/delayed/checking`      | `product/settings/billing/delayed`    | Variant  | Check again busy with Checking… while its one fresh read runs                                     |
| `product/settings/billing/trial`                 | `product/settings/billing`            | Screen   | Team until the trial ends, with the date                                                          |
| `product/settings/billing/past-due`              | `product/settings/billing`            | Screen   | Payment failed, with the one action that opens the Customer Portal                                |
| `product/settings/billing/ending`                | `product/settings/billing`            | Screen   | Team until the period end, after cancellation                                                     |
| `product/settings/billing/admin`                 | `product/settings/billing`            | Screen   | The Team pane read by an admin, with no actions                                                   |
| `product/settings/billing/admin-free`            | `product/settings/billing`            | Screen   | The Free pane read by an admin, with Team prices and trial copy but no Upgrade action             |
| `product/settings/billing/unavailable`           | `product/settings/billing`            | Screen   | Billing opens soon, where a deployment has none configured                                        |
| `product/settings/billing/unpriced`              | `product/settings/billing`            | Screen   | Team without amounts when a configured price is unverified, with the Pricing link                 |
| `product/settings/billing/checkout-opening`      | `product/settings/billing`            | Screen   | Upgrade to Team busy with Opening… until the page leaves for Checkout                             |
| `product/settings/billing/portal-opening`        | `product/settings/billing`            | Screen   | Manage billing busy with Opening… until the page leaves for the Customer Portal                   |
| `product/settings/danger/scope-loading`          | `product/settings/danger`             | Variant  | The pane asked for by address while the scope loads: bars for the project's name                  |

The Project folder holds the pane with its three states and
`product/settings/project/no-builds`, `product/settings/project/builds-saving`
for the Automatic builds switch while it saves,
`product/settings/project/visibility` with both free-plan refusals and the
Make private write as its variants, `product/settings/project/scope-loading`
for the pane asked for by address while the settings scope loads, and
`product/settings/project/slug` with its states and the conflict. The pane draws the administrator's Automatic builds switch beneath
the project's facts, in a section of its own because it writes without Save. The Workspace pane carries the plan as a fact in
every drawing; its empty state is still the workspace with no project, which
starts on Free. Its downgraded owner drawing opens Billing; its member drawing
asks an owner. The Billing pane gives owners its billing action and tells admins
that an owner manages billing. After a returned Checkout still reads Free for
the bounded confirmation period, `product/settings/billing/delayed` offers one Check
again action. On Team, `product/settings/members` names beside Invite the seat kind the
chosen role adds and its monthly price. The read-only Access pane lists existing
grants without pricing a write it cannot make.

`product/account/choose-repository` requires a project slug suggested from the
repository and config path and previews the resulting address. It says that a
free workspace's project is public and a Team workspace's project is
private; the Workspace pane's own empty state carries the
free-plan consequence too. The created-project screen carries the project's
resulting visibility fact once.

`product/viewer/standalone/plan` draws, as a screen beside `product/viewer/standalone`, the
private project on the free plan whose stage card offers an owner Open billing
beside the switcher; `product/viewer/standalone/plan-reader` is the same card read by
everyone else, with one sentence to ask an owner in place of the action, as
`product/viewer/standalone/reader` is for the unpublished branch. Values and copy come
from [Billing](./billing.md).

The Workspace pane draws one fact for GitHub, **GitHub accounts**. Its value
names the connected accounts, joined by ", ". A suspended account reads
"mokly-ai · Suspended", and a workspace with no account reads "None". Owners
and admins get a quiet **Manage** beside the fact, which opens the GitHub
accounts pane. The member drawing has none. The pane's Create project and its
no-project state offer the step the workspace is at: the repository step once
an account is `connected`, and Install the Mokly app until then. The names
come from a read of their own: while it runs the fact holds its place, and a
failed read says "Couldn’t load" with a quiet **Try again**. The fact's four
situations are states of the fact, not errors of the pane. Nothing was pressed
and nothing was refused, so none draws the `write-failure` fragment or a state
body.

The GitHub accounts pane lists every account that the workspace connects,
under the section **Connected accounts**. Each row shows the account name over
Personal or Organization. A connected row has no state word. A suspended row
adds a **Suspended** badge and **Resume on GitHub**, which opens a new tab for
every reader, because only GitHub clears a suspension. For owners and admins,
each row has a three-dot menu named for the account, with **Manage on GitHub**
and **Remove**, and the section has **Add GitHub account**. A member reads the
rows with no menu and no section action. **Remove** opens a modal titled with
the account name. It says "Mokly stops reading its repositories. Its projects
and publications stay." and offers **Remove** and **Cancel**. In its working
state the control reads **Removing…**. Only assistive technology hears
"Removing GitHub account", so the screen says the operation once. The empty
page says **No GitHub accounts yet**, with **Add
GitHub account** for owners and admins. The pane's three state variants and its
four single situations do not fit four variants, so the suspended, member,
menu and adding drawings are screens beside the pane.

A refused write draws the registered `write-failure` fragment described in
[Folio chrome](./folio-chrome.md#compositions), and a failure Mokly answered
closes with its reference in a collapsed `Details` disclosure. The Project and
Delete project panes draw it in their error entries; every other control that
writes references the same fragment.
