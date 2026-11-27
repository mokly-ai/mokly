# Link an installed GitHub account from Mokly

Status: Active. On branch `calummoore/link-installed-github-account-lm99`, no
pull request yet. The pull request that completes the work deletes this plan,
as the `plans` skill says. Decisions 1 to 6 wait for Cal's answers. No
milestone starts before he answers them.

## Problem

The GitHub accounts pane of the settings dialog has **Add GitHub account**.
It sends the reader to the GitHub App install page. For an account that
already has the app, GitHub opens the Configure page of that installation.
GitHub returns to Mokly only when the reader clicks **Save**, and only when
the App registration has **Redirect on update** turned on. So an account can
show "Installed" on GitHub and be missing in Mokly. Production showed this on
2026-11-27 with the `mokly-ai` account.

## Chosen direction

Cal chose the direction on 2026-11-27, in the parent workspace "missing
setting": after a GitHub sign-in, Mokly lists the reader's installations of
the app that are not linked yet. The reader then links one to the current
workspace in Mokly. No return from a GitHub settings page is needed.

The parent branch `calummoore/missing-setting-1c66` fixes the setup return
for an installation that arrives without a flow. This plan does not depend
on it and does not merge it.

Requirements that stay, from the task message and
[GitHub App](../docs/protocol/cloud/github-app.md#installation-and-authorization):

- No installation is linked without the administration proof at link time:
  the installation is in the user's `/user/installations` for this App, it
  is not suspended, a personal account is the user, and the user is an
  active admin of an organization.
- A list read shows no private installation details to a person who cannot
  administer them.
- Provider tokens are discarded after use, unless Cal approves a change.
- Callback query values grant no authority.
- An installation belongs to at most one workspace.

Out of scope: the setup install step at `/install`, the connect screen on
`main`, and the setup-return code of the parent branch. The GitHub App registration and
production data do not change.

## Decisions

Decisions 1 to 6 are open. Each gives its options, and the recommended
option is the design below. When Cal chooses another option, the design and
the milestones change before work starts. A fresh options check ran on
2026-11-27. It added options and design calls, and kept each
recommendation.

### 1. How a link proves administration

- **Severity:** High. **Effort:** Medium.
- **Source:** Design.
- **Category:** Security.
- **Location:** `crates/mkc-api/src/github/installation.rs`,
  `installation_proof`.
- **Background:** Mokly proves administration with the GitHub user token
  from one OAuth sign-in. Then it discards the token. The list needs a
  token to read `/user/installations`. The link needs the proof again at
  link time.
- **Problem:** After the list trip, Mokly holds no token. The link cannot
  prove administration again without a token.
- **Impact if no action:** The feature cannot link an account and keep the
  proof at link time.
- **Root question:** How does Mokly prove, at the moment of the link, that
  the reader administers the account that they chose from the list?
- **Options:**
  - **A.** Each **Link** starts the existing candidate flow: one more GitHub
    authorization trip, then the current proof and binding. No token is
    stored. GitHub probably skips its consent page for an app that the
    user already authorized. This is not verified. A reader with several
    GitHub accounts signed in sees the GitHub account picker on each trip.
    Effort: Medium.
  - **C.** Store the user token and its refresh token for a long time. The
    pane lists the accounts at any time without a trip. Needs an
    encryption key secret, token refresh, revocation on sign-out, and a
    retention rule. Effort: Large.
  - **D.** List with no trip, then link with one trip. The list comes from
    the installation records that webhooks already store. It keeps a
    personal account whose ID is the reader's stored GitHub identity. It
    keeps an organization where the App's installation token reads an
    active admin role for that identity. **Link** runs the candidate flow
    once, with the full proof. An installation whose webhook never arrived
    does not show. A reader with no connected GitHub identity connects it
    first. Effort: Large.
  - **E.** Keep the user token of the list trip on the server for at most
    ten minutes, encrypted with a key that comes from the reader's session
    credential. The server never stores that key. **Link** proves again
    with the token and discards it. No second trip and no new secret. A
    database leak alone exposes no token. Needs an encryption dependency
    and a column. Effort: Large.
  - **F.** As A, but the **Link** trip runs in a popup window, and the pane
    stays open. It changes the same-window rule of `auth-callbacks.md`.
    Popup blockers and mobile tabs need browser specs. Effort: Large.
- **Left out:**
  - B, a kept token encrypted with a new secret key. E is better on every
    point.
  - Link with the proof from the list trip. It breaks the requirement that
    the proof runs at link time.
  - Prove at link time with the App's installation token and no user
    token. It breaks the requirement of the same proof at link time.
  - Ask the reader to type the account name, then link it in one trip. It
    drops the list that Cal chose.
  - Change nothing and rely on **Redirect on update**. It fails the goal,
    because the reader must still click **Save** on GitHub.
- **Shared assumptions:**
  - The link proof uses the reader's GitHub user token. Source: the task
    message. It is a requirement. Kept.
  - The binding and its conflict rule stay as they are. Source:
    `github-app.md`. Kept. Decision 4 E drops it.
  - The list needs a GitHub sign-in in the same tab. Source: Cal's
    direction. D drops it.
- **Wider fix:** None. The proof is already one function that every link
  uses.
- **Previous examples:** The candidate flow of the connect screen uses
  option A today.
- **Recommendation:** A. It keeps the proof and the token rule as they are
  and reuses the tested candidate flow. When "no GitHub return" excludes
  any trip at link time, E is the best option.
- **Action:** ask the user, because options C and E store GitHub user
  tokens, which needs his approval, and A adds a short GitHub redirect
  that his words "no GitHub return" may exclude.

### 2. What Add GitHub account does

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Product bug.
- **Location:** `packages/app/src/settings/panes/github-pane.tsx`.
- **Background:** **Add GitHub account** is the one action of the pane. It
  opens the GitHub install page. The reader often does not know whether
  an account already has the app.
- **Problem:** A reader who clicks **Add GitHub account** for an installed
  account ends on the GitHub Configure page, with no way back to Mokly.
- **Impact if no action:** The dead end stays for each reader who picks
  the old action.
- **Root question:** How does a reader who wants another account in the
  workspace get to the link path or the install path, when they do not
  know whether the account already has the app?
- **Options:**
  - **A.** Keep **Add GitHub account** as it is. Add a second section
    action, **Link installed account**, that runs the list trip. Effort:
    Medium.
  - **B.** **Add GitHub account** runs the list trip first. The list ends
    with **Install on another account**, which opens the GitHub install
    page. A new account then takes one more trip. Effort: Medium.
  - **C.** **Add GitHub account** opens a menu with **Link installed
    account** and **Install on another account**. Effort: Medium.
  - **D.** Keep **Add GitHub account** as it is. When the reader comes back
    in the same tab without a finished install, the pane offers **Find
    installed accounts**, which runs the list trip. It helps only a reader
    who comes back in the same tab. It changes `github-flow.ts`, which
    the parent branch also changes. Effort: Medium.
- **Left out:** Change nothing. It fails the goal, because the pane gets
  no way to the list.
- **Shared assumptions:** The change covers the pane only, not the setup
  install step. Source: the task scope. Kept, with a follow-up item.
- **Wider fix:** B. It makes the dead end rare, because each add starts
  from the installed accounts. It does not remove it: **Install on
  another account** still opens the GitHub install page.
- **Previous examples:** None found.
- **Recommendation:** B. The reader does not have to know where the app
  is installed.
- **Action:** ask the user, because he asked to settle whether the list
  replaces or sits beside **Add GitHub account**.

### 3. Where the found accounts appear

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Product bug.
- **Location:** `packages/app/src/settings/panes/github-pane.tsx`.
- **Background:** The list trip returns the reader to the pane address.
  The pane shows **Connected accounts**, or **No GitHub accounts yet**
  when the workspace has none.
- **Problem:** The found accounts need a place, and the reader must see
  them at once after the return.
- **Impact if no action:** The reader returns to an unchanged pane.
- **Root question:** Where does the reader see and choose the found
  accounts?
- **Options:**
  - **A.** A second section in the pane, above **Connected accounts**. It
    stays while the list is fresh, ten minutes, also after a reload and
    after a **Link** trip. Effort: Medium.
  - **B.** A modal over the pane that opens on the return. Closing it
    ends the list. Effort: Medium.
  - **C.** A new account-shell screen with its own route, like the connect
    screen. Needs a route, navigation docs that the parent branch edits,
    and desktop handling. Effort: Large.
- **Left out:** A list on the callback landing. A reload loses it, because
  a landing takes its input only once.
- **Wider fix:** None. The question is about placement only.
- **Previous examples:** The connect screen uses a screen of its own.
- **Recommendation:** A. It keeps the settings dialog the one place for
  accounts and needs no new route.
- **Action:** ask the user, because he asked to settle where the list
  appears.

### 4. What a found account that cannot be linked shows

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** Security.
- **Location:** None.
- **Background:** The list shows only accounts that the reader
  administers. One of those can already belong to another workspace, or
  GitHub can have suspended it. The link refuses both.
- **Problem:** The reader may look for an account that the list does not
  show, or see an account and fail to link it.
- **Impact if no action:** The design has a gap for these rows.
- **Root question:** What can the reader learn and do about an account
  that they administer but cannot link here?
- **Options:**
  - **A.** Hide it. Effort: Small.
  - **B.** Show it with a state and no **Link**: "In another workspace" or
    **Suspended** with **Resume on GitHub**. The row never names the other
    workspace. Effort: Small.
  - **C.** As B, and when the reader administers the other workspace,
    offer **Move here**, which removes it there and links it here. Effort:
    Medium.
  - **D.** As B, with **Ask to move**. Mokly sends the owners of the other
    workspace a request, and they release the account in their pane.
    Needs a request record, an email, and mockups. Effort: Large.
  - **E.** As B, with **Move here** for each reader who passes the proof,
    also outside the other workspace. Mokly sends an email to the owners
    of the other workspace. It changes the conflict rule of
    `github-app.md`. Effort: Large.
- **Left out:** A row that names the other workspace. It shows a
  workspace to a person who may not be its member.
- **Shared assumptions:** The list shows only accounts that the reader
  administers. Source: the task message. It is a requirement. Kept.
- **Wider fix:** None.
- **Previous examples:** The `github-installation-conflict` refusal says
  "This GitHub account is connected to another workspace" today.
- **Recommendation:** B. The reader learns why the account cannot be
  linked, and the row discloses nothing that the conflict refusal does
  not.
- **Action:** ask the user, because he asked to settle this row, and it
  sets what the list discloses.

### 5. Where a failed GitHub trip from the pane returns

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Product bug.
- **Location:** `packages/app/src/screens/account/github-callback-screen.tsx:37`.
- **Background:** When a GitHub trip fails, the callback landing shows a
  refusal with one action. For an installation trip the action is **Back
  to install** at `/install`. A workspace that already has an account
  goes from `/install` on to the new-project step. The current **Add
  GitHub account** has this problem already. The new design adds a trip
  for each **Link**.
- **Problem:** A failed list or **Link** trip sends the reader away from
  the pane, to a step that does not apply.
- **Impact if no action:** After a refusal, the reader must find the pane
  again by hand.
- **Root question:** Where does a reader go after a GitHub trip from the
  pane fails?
- **Options:**
  - **A.** Keep **Back to install** at `/install`, as today. Record a
    follow-up item. Effort: Small.
  - **B.** Store pane trips under a new tab purpose that also holds the
    workspace address. Its refusal offers **Back to GitHub accounts** at
    the pane. It changes `github-flow.ts`, the callback landing, and the
    recovery table of `auth-callbacks.md`, which the parent branch also
    changes. Effort: Medium.
  - **C.** Send every installation refusal to the account settings, which
    names no workspace. Effort: Small.
- **Left out:** Use the `returnTo` that the API stored. A provider refusal
  never reaches the API, so the landing does not have it.
- **Shared assumptions:** Browser storage never holds `returnTo`. Source:
  `auth-callbacks.md`. Kept. B stores the workspace address of the pane,
  not the flow's `returnTo`.
- **Wider fix:** B. Each pane trip then returns to the pane on failure.
- **Previous examples:** The connection purpose returns to
  `/settings/account` on failure.
- **Recommendation:** B. The reader stays in the pane that started the
  trip, and the merge conflict with the parent branch is small.
- **Action:** ask the user, because B edits files that the parent branch
  changes, and he asked to approve each such edit.

### 6. What the list shows when nothing can be linked

- **Severity:** Low. **Effort:** Small.
- **Source:** Design.
- **Category:** UX wording.
- **Location:** None.
- **Background:** The list trip can find no account that the reader can
  link. An organization member who is not an admin also finds nothing,
  because the list must not show that organization.
- **Problem:** The pane needs an empty state for the found accounts.
- **Impact if no action:** The design has a gap.
- **Root question:** What does the reader do next when no installed
  account can be linked?
- **Options:**
  - **A.** A note, "No other account that you administer has Mokly
    installed", with **Install on another account**, the same label as
    the end of the list. Effort: Small.
  - **B.** Go straight on to the GitHub install page with no note. Effort:
    Small.
  - **C.** A note with no action. The section action stays. Effort: Small.
- **Left out:** None.
- **Wider fix:** None.
- **Previous examples:** **No GitHub accounts yet** is the empty state of
  the pane.
- **Recommendation:** A. The reader learns the result and gets the next
  step in the same place.
- **Action:** ask the user, because he asked to settle the empty state.

## Design

This design uses the recommended option of each decision. Each line marked
"my call" is a design call of 2026-11-27.

- The list trip. **Add GitHub account** sends `POST
/v1/github/installations/lookup` with `workspaceId` and `returnTo`. It
  has the admission, owner or admin, session binding, and expiry of the
  install flow. It stores a ten-minute, one-use flow with the new purpose
  `install-list`. It returns the OAuth authorization URL, state, and
  verifier. My call: a new endpoint and purpose, so that the install flow
  keeps its guard against an OAuth return without a candidate.
- The tab record. The pane stores its trips under the new tab purpose of
  decision 5 B. The landing posts it to the callback with the session
  CSRF, as for an installation trip.
- The callback. `POST /v1/auth/github/callback` runs as today. For an
  `install-list` flow, it reads `/user/installations` for this App. It
  keeps an installation only when the account rule of the link proof
  passes: a personal account whose ID is the user, or an organization
  where the user is an active admin. Enterprise and Bot owners are
  dropped. It writes the kept rows and discards the token. My call: the
  list filter and `installation_proof` call one shared function for the
  account rule, so that the list never offers a **Link** that the proof
  refuses.
- A refused membership read drops that one organization. Any other
  provider failure fails the trip with the installation recovery. My
  call: one organization must not hide the others.
- The found rows. A new table holds the GitHub installation ID, the
  account name, the account kind, the manage URL, and the suspension of
  each kept row. A row is bound to the user and the workspace, not to the
  session. Each GitHub callback replaces the session, so a session
  binding would lose the rows after the first **Link**. A row expires ten
  minutes after its callback. A new list trip replaces the rows of that
  user and workspace. The flow retention job also deletes expired rows.
  My call: the rows grant no authority, and only the user who passed the
  list filter reads them.
- My call: the server keeps the rows, not the tab. A tab-only list is lost
  on each **Link** trip, and browser storage must not hold installation
  IDs.
- The read. `GET /v1/github/installations/found?workspaceId=` returns the
  caller's rows for that workspace. It requires owner or admin. It drops a
  row that the workspace now holds. It marks a row that another workspace
  holds. It takes the suspension from Mokly's own installation record when
  one exists, because webhooks keep that record current. It returns an
  empty list when no fresh row exists. My call: the read decides each
  state at read time, so a link, a removal, or a resume shows at once.
- The link. **Link** sends `POST /v1/github/installations` with the row's
  `installationId` and the pane address as `returnTo`. The existing
  candidate flow, proof, and binding run. The reader returns to the pane
  with the account under **Connected accounts**. The found section keeps
  its other rows.
- The pane without connected accounts. The found section replaces **No
  GitHub accounts yet** while it has rows. My call: one state per pane.
- An organization member who is not an admin gets no row for that
  organization. The empty note of decision 6 names only accounts that the
  reader administers. My call: the requirement forbids the row.
- The desktop shell opens the pane on the web for each GitHub trip, as
  today.
- The setup install step at `/install` keeps its current flow. My call:
  the task scope is the pane. A follow-up item records the same list for
  that step.

## Files that the parent branch also changes

- `docs/protocol/cloud/github-app.md`: one link line to the new protocol
  page, outside the parent's lines. Expect a small conflict at most.
- `docs/protocol/cloud/auth-callbacks.md`: the tab-scoped purpose table
  and, with decision 5 B, the recovery table of the GitHub callback. The
  parent changes other lines of this file.
- With decision 5 B only: `packages/app/src/navigation/github-flow.ts`
  gets the new tab purpose. The parent changes the same file. Expect a
  conflict in the purpose list.

The connect screen, `connect-destination.ts`, `workspace-choice.tsx`,
`callback-input.ts`, and the connect mockup do not change.

Contract owners:

- [GitHub App](../docs/protocol/cloud/github-app.md).
- A new protocol page, `docs/protocol/cloud/github-installation-list.md`.
- [GitHub accounts settings pane](../docs/protocol/cloud/settings-dialog-github.md).
- [Settings mockups](../docs/protocol/cloud/product-mockups-settings.md).
- The [API README](../crates/mkc-api/README.md) and the
  [app README](../packages/app/README.md).

Replaced ways:

- **Add GitHub account** opens the GitHub install page → it runs the list
  trip, and **Install on another account** opens the install page.
  Consumers: the pane, its mockups, and the pane browser specs. Moved and
  deleted in Milestones 1 and 4.

## Milestone 1: Mockups

Tags: mockup

Depends on: decisions 1 to 6

The GitHub accounts pane mockups under
`docs/mockups/src/entries/product/settings/github/`.

- [ ] Draw the pane after the list trip: the found section above
      **Connected accounts**, with a linkable row and its **Link** action.
- [ ] Draw a row in another workspace and a suspended row.
- [ ] Draw **Link** busy, and **Add GitHub account** busy until the page
      leaves for GitHub.
- [ ] Draw the empty result.
- [ ] Draw the found section in a pane with no connected account.
- [ ] Draw the refusal of a failed pane trip with **Back to GitHub
      accounts**.
- [ ] Draw the compact layout of the found section.
- [ ] Update the entry table of `product-mockups-settings.md`.
- [ ] Check every new text against `docs/protocol/cloud/product-copy.md`.
- [ ] Run `npm run mockups:typecheck`, `npm run mockups:check`,
      `npm run mockups:build`, and `npm run test:policy` in
      `apps/mockups`. Smoke-test the changed pages.
- [ ] Update the design and the TODOs of this plan for each problem that
      the mockups show.

## Milestone 2: Documentation and protocol

Depends on: 1

- [ ] Write `docs/protocol/cloud/github-installation-list.md`: the list
      trip, what the list keeps, the found rows, their expiry, the read,
      and the link.
- [ ] Link it from `github-app.md` and the cloud protocol `README.md`.
- [ ] Update `settings-dialog-github.md` with the new action behaviour,
      the found section, its rows, and its states.
- [ ] Update the tab-scoped table and the GitHub callback recovery table
      of `auth-callbacks.md`.
- [ ] Add the new endpoints and their error reasons where the REST docs
      list the GitHub endpoints.

## Milestone 3: API

Depends on: 2

- [ ] Add a migration: the `install-list` purpose in the flow checks, and
      the found-rows table, with a `down.sql` that reverses it.
- [ ] Add the store queries in `mkc-store-interface` and `mkc-store-pg`.
- [ ] Move the account rule of `installation_proof` into one function
      that the proof and the list filter share.
- [ ] Add the lookup start, the callback branch, and the found read in
      `crates/mkc-api/src/github/`. Keep each file under 300 lines.
- [ ] Add the OpenAPI contracts and regenerate the app schema.
- [ ] Add the GitHub double routes that the tests need.
- [ ] Test: a personal account and an admin organization are kept, a
      member organization and another App's installation are dropped, a
      suspended account is marked, a row in another workspace is marked, a
      row in this workspace is dropped, another user reads nothing, a
      member gets `permission-denied`, expired rows read empty, a refused
      membership read drops only its organization, the rows survive the
      session change of a **Link** trip, and the token is not stored.
- [ ] Run `cargo nextest run -p mkc-api` and the store tests.

## Milestone 4: App pane

Tags: ui

Depends on: 3

- [ ] Add the data calls for the lookup and the found read.
- [ ] Add the pane tab purpose to `github-flow.ts` and its refusal to the
      callback landing.
- [ ] Build the found section, its rows, and its states in the pane, from
      the mockups. Keep each file under 300 lines.
- [ ] Move **Add GitHub account** to the list trip. Add **Install on
      another account**.
- [ ] Update the pane browser specs and add specs for the list, the link,
      the rows that cannot be linked, the empty result, and a refused
      trip that returns to the pane.
- [ ] Update `packages/app/README.md`.
- [ ] Run `npm run test:logic` and `npm run test:browser` in
      `packages/app`.

## Milestone 5: Verification, commit, review, and pull request

Depends on: every other milestone

- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record
      follow-up items under `plans/follow-ups/` for the rest, re-review
      once, and report.
- [ ] Add the follow-up item for the list on the setup install step.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request. Its description gives the decisions and the
      design calls of this plan with their dates, a permalink to this plan,
      and the follow-up items that the change adds.

## Post-merge follow-up (non-blocking)

- [ ] On staging, link an account that already has the app, from the
      pane, with **Redirect on update** turned off.
