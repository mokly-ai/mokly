# Agents panel

Status: Active. On branch `calummoore/adding-agents-panel-plan-brrd`, no pull
request yet. The pull request that completes the work deletes this plan, as
the `plans` skill says. Decisions 2, 4 and 5 are open.

Mokly Cloud has no way to change a screen from the viewer. This change adds
phase 3, "Edit", of the [product direction](../docs/product-direction.md): an
agents panel beside the cloud viewer. A member opens a session on a branch,
clicks an element on the screen, and asks an agent for a change. The agent
edits the mockup source in a session sandbox, the member sees the screens of
the session, and Publish sends the change to the branch.

One runner runs the agent in every place: a Mokly sandbox, a team's own
server, and the member's computer through desktop local mode. It lives in a
new public repository, so that Conductive can move to it later. This plan
builds the runner and the cloud sessions in Mokly sandboxes. Desktop agent
sessions and own servers are later plans, listed under "Later work". The
runner keeps both in its design from the start.

This change does not cover comments, approvals, presence, or desktop local
mode itself. The brainstorm notes are in `.context/agents-panel/`.

Contract owners:

- New: `docs/protocol/cloud/agent-sessions.md`,
  `docs/protocol/cloud/agent-logins.md` and
  `docs/protocol/cloud/model-gateway.md`.
- [GitHub App](../docs/protocol/cloud/github-app.md) for the new Contents
  write permission.
- [Viewer chrome](../docs/protocol/cloud/viewer-chrome.md) for the
  `sidePanel` slot, and [Settings dialog](../docs/protocol/cloud/settings-dialog.md)
  for the login panes.
- [Catalogue hosting](../docs/protocol/cloud/catalogue-hosting.md) for the
  session host, when decision 2 chooses live serve.
- [Billing plan gates](../docs/protocol/cloud/billing-plan-gates.md) and
  [Site pricing](../docs/protocol/cloud/site-pricing.md) for decision 4.
- [REST API](../docs/protocol/cloud/rest-api.md), the
  [architecture doc](../docs/architecture/cloud.md), and the READMEs of
  `crates/mkc-api`, `crates/mkc-db` and `packages/app`.

## Decisions

Cal answered decisions 1, 3, 4 in part, 6, 7 and 8 on 2026-11-26. The numbers
are those of the brainstorm, so a gap in the numbers is not a missing item.

### 1. How the agent runs in every place: G

Decided 2026-11-26, Cal: **G**. One runner in a new public repository. Mokly
builds it first, from copies of the generic parts of Conductive's runner:
the agent start and the SDK helper, the event model, the saved outbox with
numbered events and resend, the output filter, and the turn credential. In a
sandbox and on an own server, the runner dials out to `mkc-api`. On the
desktop, the shell runs it as a child process. Conductive moves to it later,
as a Conductive follow-up item, so its production code takes no risk now.

Alternatives:

- **A.** Mokly's own agent loop in `mkc-api`. Not chosen: it rebuilds what
  the vendor agents do, and a desktop session would need the cloud.
- **B.** A worker in `mkc-api` drives the agent in the sandbox. Not chosen:
  cloud only, and it must add its own way to survive a deploy.
- **C.** Rivet actors. Left out: Cal chose Rust, Postgres and Kubernetes on
  2026-11-24.
- **D.** Anthropic Managed Agents. Not chosen: Claude only, beta, and the
  chat records stay at Anthropic.
- **E.** B, plus the member's own agent tool on the desktop. Not chosen: the
  desktop panel would not be the same.
- **F.** One session interface in the app, with a different host in each
  place. Not chosen: the turn rules would exist twice.
- **H.** Extract Conductive's runner first. Not chosen: Conductive pays
  first and takes the risk, and each later change needs two pull requests.

### 2. How the member first sees the change as screens

- **Severity:** Medium. **Effort:** Large.
- **Source:** Design.
- **Category:** Code structure.
- **Location:** Milestones 3 to 5 of `plans/desktop-local-mode.md` on branch
  `calummoore/local-mode-desktop-support-3cij`.
- **Terms:**
  - **Turn publication:** a draft catalogue that the session uploads after a
    turn. It moves no branch and posts no check.
  - **Session host:** a Mokly origin that forwards a member's reads to the
    `mokly serve` of a session sandbox, after an access check.
- **Background:**
  - The cloud viewer shows only publications today.
  - Desktop local mode adds `mokly serve --host-origin`, the frame probe in
    served pages, and a `live` prop for the embeddable viewer.
  - The viewer's live reads and comparison reads send no cookie to another
    origin (`packages/viewer/src/standalone/live_source.ts:56`,
    `packages/viewer/src/shell/comparison_request.ts:58`). The cloud must
    not patch the package or replace `fetch` (`docs/protocol/cloud/viewer.md`).
    So a session host behind the private-catalogue cookie cannot serve them.
  - `mokly publish` refuses uncommitted changes (`git-uncommitted`). So a
    turn publication needs a commit and a full build after each turn.
- **Problem:** The member must see the change as screens before Publish, and
  only the members who may read the session may see them.
- **Impact if no action:** Milestone 12 has no design.
- **Root question:** How does the cloud viewer show a session's unpublished
  screens to the members who may read the session? The options check of
  2026-11-26 rewrote this question.
- **Options:**
  - **A.** A turn publication after each turn, member-only also for a public
    project. It works with older CLI versions. It is slow, works in the
    cloud only, and is thrown away later. Effort: Large.
  - **B.** Live serve through a session host with the private-catalogue
    cookie. Every place then shows screens in the same way. As written, it
    fails: the viewer's own live reads send no cookie. Effort: Large.
  - **C.** A static session catalogue. After each turn, the runner runs
    `mokly build`, and the session host serves the output. The app reads it
    like a publication. No upload and no local mode release. Each turn waits
    for a full build, and the viewer remounts on each new index. Added by
    the options check. Effort: Large.
  - **D.** A session branch. Each turn commits to a `mokly/session-…` branch,
    and the normal cloud build publishes it. No session host. Each turn
    waits minutes for a build, and each session adds a branch. Added by the
    options check. Effort: Large.
  - **E.** B, with a secret host name of 256 random bits for each reader in
    place of a cookie. `serveLiveSource` then works unchanged in every
    browser. The name is a bearer address that DNS resolvers see, and it
    changes the private access rule of `catalogue-hosting.md`. Added by the
    options check. Effort: Large.
  - **F.** B, with a credentialed transport. `@mokly/viewer` gets a
    documented credential option for its live, comparison and preview
    reads. The session host sets a partitioned cookie and answers
    credentialed CORS. The same transport also unblocks private Changes for
    publications. It needs a browser proof, and Safari before 26.2 stays
    blocked. Added by the options check. Effort: Large.
  - **G.** Serve behind the session host, read by the app at each turn end,
    which then replaces `index`. No viewer transport. The viewer remounts at
    each turn end, and props editing and Changes are unavailable. Added by
    the options check. Effort: Large.
- **Left out:**
  - Showing the result only after the commit, because it fails the goal.
  - Screens as images in the panel, because the member picks elements on the
    stage.
  - Framing the E2B port address with no Mokly hop, because a removed member
    keeps access while the sandbox lives.
- **Wider fix:** E. No read needs a credential, so every later viewer read
  works in every browser. F must route each package read through its
  transport.
- **Previous examples:** Local mode decision 1 C, which makes cloud and local
  work in the same way. `plans/follow-ups/private-catalogues-lose-changes-and-blocked-cookie-access.md`
  has the same cookie problem for private publications.
- **Related:** Decision 1 G gives one runner in every place, and B, E and F
  give one way to show screens in every place.
- **Recommendation:** F. It keeps live serve, which phase 3 and Cal's
  same-way rule ask for, and it adds the read path that B lacks. The plan
  first recommended B. The options check changed it to F, because B cannot
  serve the viewer's own reads behind a cookie.
- **Action:** ask the user, because A ships sooner for teams on an older CLI.

### 3. How the change reaches the branch: A

Decided 2026-11-26, Cal: **A**. The GitHub App gets Contents write.
`mkc-api` commits through the GitHub API and never forces. No write token
enters a sandbox. Not chosen: **B**, a pull request from the App for every
change. **C**, a patch download. **D**, a desktop commit by the runner,
because desktop sessions are a later plan.

### 4. On which plans a member can start a cloud session

Cal answered the login part on 2026-11-26: every login kind of Conductive is
allowed. A member can use a personal login, and a workspace can have a
workspace login. On a machine that the user controls, the desktop or an own
server, the runner uses the credentials configured on that machine. Mokly
never pays for model use. Cal's answer named both A, every plan, and B, Team
only, so the plan gate is still open.

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** Docs or spec.
- **Location:** `docs/protocol/cloud/billing-plan-gates.md`
- **Background:** The plans are Free and Team. Cloud builds run on every
  plan. Mokly pays for the sandbox time of each session, as for builds.
- **Problem:** No rule says whether Free workspaces can start sessions.
  Builds and uploads also check the project capability `publishingAllowed`,
  which is false for a private project on Free.
- **Impact if no action:** Milestone 4 cannot write the session create check.
- **Root question:** Which workspaces and projects can run a session in a
  sandbox that Mokly pays for? The options check of 2026-11-26 rewrote this
  question.
- **Options:**
  - **A.** Every plan. Mokly pays the sandbox time of Free workspaces too. A
    downgraded workspace can still run sessions on private projects that
    cannot publish. Effort: Small.
  - **B.** Team only. It adds a new plan gate, a new project capability, and
    a new `plan-required` feature value. Free workspaces can still use the
    desktop or an own server in the later plans. Effort: Small.
  - **C.** Every plan, gated by `publishingAllowed`, as builds are. Public
    projects get sessions on every plan, private projects only on Team. A
    refused start uses the existing `plan-required` answer. Added by the
    options check. Effort: Small.
  - **D.** Every plan, with a monthly sandbox-time allowance for each
    workspace, larger on Team. It adds the first usage limit to billing,
    with metering, a reset rule and an exhausted state. Added by the options
    check. Effort: Large.
- **Left out:** Mokly pays for model use, because Cal ruled it out on
  2026-11-26. A metered price for sandbox time, because billing keeps one
  licensed usage type (`docs/protocol/cloud/billing.md`).
- **Wider fix:** None.
- **Previous examples:** Cloud builds run on every plan while
  `publishingAllowed` holds (`docs/protocol/cloud/cloud-builds.md:31`).
- **Recommendation:** C. It is the builds precedent: no workspace runs
  sessions where it cannot publish. The plan first recommended A. The
  options check changed it to C.
- **Action:** ask the user, because Cal's answer named both options.

### 5. Where a default-branch change goes

- **Severity:** Medium. **Effort:** Medium.
- **Source:** Design.
- **Category:** Docs or spec.
- **Location:** `docs/protocol/cloud/site.md:126`
- **Background:** A direct commit to the default branch skips review. Many
  teams protect that branch, and GitHub then refuses the commit. The site
  says "every change is a pull request".
- **Problem:** No rule says what Publish does on the default branch.
- **Impact if no action:** Publish fails on protected branches, or unreviewed
  changes land on the default branch.
- **Root question:** Where does Publish send a change when the session's
  branch must not take a direct commit, such as the default branch or a
  protected branch? The options check of 2026-11-26 rewrote this question.
- **Options:**
  - **A.** On the default branch, Publish opens a pull request from a new
    branch. On other branches, it commits. A protected feature branch shows
    a refusal. Effort: Medium.
  - **B.** Commit on every branch, and show the refusal of branch protection.
    Effort: Small.
  - **C.** No sessions on the default branch. Effort: Small.
  - **D.** Open a pull request on the default branch and on each branch that
    GitHub reports as protected. Commit on the other branches. Publish reads
    the branch rules first. Added by the options check. Effort: Medium.
  - **E.** On every branch, the member chooses a commit or a pull request.
    The default branch preselects the pull request. Added by the options
    check. Effort: Medium.
- **Left out:** A pull request for every change, because it is decision 3 B,
  which Cal did not choose.
- **Wider fix:** D. It still works when the protected branch has another
  name or another rule.
- **Previous examples:** None found.
- **Related:** Decision 3 A gives the App the write access for each option.
- **Recommendation:** D. It keeps the pull request on the default branch
  that the site promises, and it also handles protected feature branches.
  The plan first recommended A. The options check changed it to D.
- **Action:** ask the user, because it adds GitHub behaviour that no
  requirement covers.

### 6. Model credentials in the cloud sandbox: A

Decided 2026-11-26: **A**, as Conductive does it. Cal asked to follow
Conductive. Conductive keeps every login out of its sandboxes (its decision
120). A gateway adds the login to each model request. The sandbox holds only
a turn token, which works only on the gateway routes and only while its
turn runs. Conductive rejected a token for each session, because it also
works in later turns, and Boat's credentials proxy, because its key belongs
to a sandbox start. Not chosen: **B**, the key in the sandbox for the whole
session.

### 7. Records of desktop sessions: A

Decided 2026-11-26, Cal: **A**. The desktop shell runs the runner as a child
process. The record stays on the computer, and no sign-in is needed. Not
chosen: **B**, a copy to Postgres after sign-in. **C**, a local runner that
dials `mkc-api`. This decision governs the later desktop plan. Here it sets
the runner's two links.

### 8. License of the shared runner repository: A

Decided 2026-11-26, Cal: **A**, MIT, like `futex-ai/sandbox`. Not chosen:
**B**, Apache-2.0. **C**, AGPL-3.0-only, because Conductive could use it only
with a separate grant.

## Design

Each item is my call of 2026-11-26 unless it names a decision.

**The shared runner**

- The repository has the working name `futex-ai/agent-runner`. It follows
  `futex-ai/sandbox`.
- The interface is the runner wire protocol. It starts at its own version 1,
  with no fields that only Conductive uses.
- The runner has two links with the same messages: an outbound WebSocket to a
  control plane, and stdio to a parent process (decision 7).
- The runner has two credential modes: a turn token for a gateway
  (decision 6), and the credentials of the machine (decision 4).
- The runner saves each event before it sends it, and sends it again until
  the control plane confirms it. So a deploy of `mkc-api` loses no event.
- The wire keeps room for a permission request. Only a computer needs one.
- The runner exports TypeScript types for its wire messages.

**Cloud sessions**

- A session belongs to one project, one branch, and the member who starts
  it. It starts at the commit of the publication on screen, so that picked
  source lines match the code.
- Only the starter sends messages and publishes. Other members with access
  can read the session.
- Owners, admins and members start sessions. Reviewers cannot, because they
  are read-only.
- A session runs one turn at a time. A workspace runs at most two active
  sessions, so sandbox cost stays bounded.
- Each session has one E2B sandbox with an interactive lifetime, because E2B
  caps a running sandbox at 3,600 seconds. It stays running while a turn
  runs or a member has the session open, because the session screens need
  it. It pauses after 10 minutes with neither, and resumes on the next open
  or message.
- A deployment setting caps the running session sandboxes of each `mkc-api`
  process, as `MKC_BUILDS_PER_PROCESS` does for builds.
- A session cannot start on the branch of a fork pull request, because the
  App cannot write there. The panel says why.
- The runner holds a session runner token for its link, which is not a model
  credential. Each turn brings its own turn token (decision 6).
- `mkc-api` stores sessions, messages, commands and events in Postgres. A
  trigger sends `agent-session` and `agent-event` notices through
  `mkc_live_notice`, and the panel reads the rows through REST. This follows
  Cal's decision of 2026-11-24.
- The runner owns the running turn. Any `mkc-api` replica can take its link,
  so no replica holds a lease on a turn.
- The runner route lives under `/v1/live/`, because that path has the long
  socket timeout.
- A reconciler in `mkc-api` destroys each session sandbox that has no live
  session, like the build sandbox reconciliation.
- Claude comes first. Codex follows on the same gateway in this plan.
- The agent's web tools stay off, because the task is a source edit.

**Logins (decision 4)**

- A personal login is a Claude subscription token, a ChatGPT sign-in through
  device code, an API key, or an own endpoint. It lives in the You section of
  settings.
- A workspace login is an API key or an own endpoint. An admin sets it in the
  Workspace section. A subscription cannot be a workspace login, because the
  vendors' consumer terms forbid sharing an account. Conductive has the same
  rule.
- A session uses its starter's default login, as Conductive's default login
  rule says.
- Logins are stored encrypted and never reach a sandbox.

**Panel and publish**

- The panel fills the viewer's `sidePanel` slot on desktop and opens as a
  sheet on compact widths. An agent control in the bar opens it. Its parts
  live in `@mokly/ui` and take props and callbacks.
- Click-to-reference uses the viewer's `startPick` and `onPickEnd`, and the
  instance record's source location.
- Publish commits as the App's bot and names the member in the commit. When
  the branch moved, Publish refuses, and the panel offers to update the
  session to the new head first.
- When Publish opens a pull request, the session moves to the pull request's
  branch. A later Publish then commits there, and opens no second pull
  request.
- The copy keeps "Publish to {branch}", as the product direction and the
  site use it.

## Milestone 1: Mockups

Tags: mockup

Depends on: none

Draw the agents panel and the login panes in the cloud mockups under
`docs/mockups/src/screens/product/`, with the shared design components of
`examples/basic/specs/design` where the viewer draws something new.

- [ ] Draw the agent control in the viewer bar, and the panel in `sidePanel`
      on desktop and as a sheet on mobile.
- [ ] Draw each panel state: no session, starting, installing, ready,
      working with a streamed reply and tool steps, a picked element chip, a
      diff for each file, turn failed, sandbox lost, no login, and stopped.
- [ ] Draw the session screens on the stage while a session is open.
- [ ] Draw Publish and its results: published, pull request opened, branch
      moved, refused by branch protection, and the App permission missing.
- [ ] Draw the refused start: a private project on Free, if decision 4
      chooses a gate, and a fork pull request.
- [ ] Draw the recommended option of each open decision. Redraw each state
      that the answer to decisions 2, 4 and 5 changes.
- [ ] Draw the personal logins in the You section and the workspace login
      in the Workspace section of settings.
- [ ] Run the mockup checks named in `AGENTS.md` and
      `docs/mockups/README.md`. Smoke-test the changed pages.
- [ ] Update the design and the TODOs of this plan for each problem that the
      mockups show.

## Milestone 2: Documentation and protocol

Depends on: 1

- [ ] Write `docs/protocol/cloud/agent-sessions.md` with a status line:
      sessions, turns, roles, limits, the runner link, the notices, and
      Publish.
- [ ] Write `docs/protocol/cloud/agent-logins.md` and
      `docs/protocol/cloud/model-gateway.md` with status lines.
- [ ] Add Contents write and the commit rules to `github-app.md`.
- [ ] Add the agent control and the `sidePanel` use to `viewer-chrome.md`,
      and the login panes to `settings-dialog.md`.
- [ ] Add the session routes to `rest-api.md`, and the sessions to
      `docs/architecture/cloud.md`.
- [ ] Add the rule of decision 4 to `billing-plan-gates.md`, the copy table
      of `billing.md`, and `site-pricing.md`.
- [ ] Update `docs/product-direction.md` phase 3 to name the shared runner.

## Milestone 3: Shared runner repository

Depends on: 2

A delegated workspace builds the runner in the new repository, with its own
plan there. This plan tracks its releases.

- [ ] Create `futex-ai/agent-runner` with an MIT license (decision 8).
- [ ] The wire types, version 1, with exported TypeScript types.
- [ ] The SDK helper and the Claude adapter, from copies of Conductive's
      generic parts.
- [ ] The turn engine, the output filter, the saved outbox, and both links.
- [ ] A test kit with a fake control plane.
- [ ] A Linux x64 release that a sandbox template can install.
- [ ] The Codex adapter.
- [ ] Record the Conductive move as a follow-up item in the Conductive
      repository.

## Milestone 4: Session records and REST API

Depends on: 2, decision 4

- [ ] Add the session, message, command and event tables in `mkc-db`, with
      their store in `mkc-store-pg`.
- [ ] Add the REST routes to start, list and read a session, read its events
      by sequence, send a message, and stop a turn.
- [ ] Check the roles, the limits, and the plan rule of decision 4 on start.

## Milestone 5: Session live notices

Depends on: 4, and the merge of the live-channel foundation

- [ ] Add the triggers that call `mkc_live_notice` for sessions and events.
- [ ] Test the notices against Postgres, a rolled-back write included.

## Milestone 6: Agent logins

Depends on: 2

- [ ] Store personal and workspace logins encrypted, with their REST routes.
- [ ] Add the ChatGPT device code sign-in and the default login rule.

## Milestone 7: Login panes

Tags: ui

Depends on: 1, 6

- [ ] Add the personal login pane and the workspace login pane in
      `packages/app`, from `@mokly/ui` parts.

## Milestone 8: Model gateway for Claude

Depends on: 4, 6

- [ ] Mint one turn token for each turn, and end it with the turn.
- [ ] Forward Claude requests with the session's login, streaming included,
      with the header allow list and the turn checks of Conductive's gateway.

## Milestone 9: Session sandbox

Depends on: 2, 3

- [ ] Add a session template with the runner release and the sandbox's
      interactive lifetime, pause and resume.
- [ ] Prove on E2B that the runner dials `mkc-api` and survives a pause.
- [ ] Add the reconciler that destroys orphaned session sandboxes.

## Milestone 10: Runner link

Depends on: 4, 9

- [ ] Add the runner route under `/v1/live/` with the session runner token.
- [ ] Store commands in Postgres, store events with confirm and resend, and
      test a replica restart during a turn.

## Milestone 11: Turns

Depends on: 8, 10

- [ ] Send a message with its picked element, run the turn, and stop it.
- [ ] Store the diff of each turn.

## Milestone 12: Session screens

Depends on: 9, decision 2, and for options B, E and F the release of local
mode milestones 3 to 5

The TODOs below follow the recommended option F. The answer to decision 2
replaces them when it differs.

- [ ] Prove on E2B that the session host reaches serve. Serve refuses a
      `Host` that is not loopback (`crates/mokly-server/src/security.rs:6`),
      so a hop in the sandbox must keep a loopback `Host`, as Conductive's
      preview relay does.
- [ ] Run a supervised `mokly serve` in the session sandbox.
- [ ] Add the credentialed transport for the viewer's live, comparison and
      preview reads to `@mokly/viewer`, with its protocol doc.
- [ ] Add the session host with a partitioned cookie from a grant exchange
      and credentialed CORS, and pass the live source to the viewer.

## Milestone 13: Agents panel

Tags: ui

Depends on: 1, 11, 12

- [ ] Add the panel parts to `@mokly/ui`.
- [ ] Add the app container that reads the session, the notices and the
      picked element, and fills `sidePanel`. It polls every 3 seconds until
      Milestone 5 lands.

## Milestone 14: Publish to the branch

Depends on: 11, decision 5

- [ ] Request Contents write, and commit through the GitHub API without
      force, as decision 3 says.
- [ ] Refuse when the branch moved, and update the session to the new head.
- [ ] Add the default-branch path of decision 5.

## Milestone 15: Publish in the panel

Tags: ui

Depends on: 13, 14

- [ ] Add Publish and its results to the panel.

## Milestone 16: Codex

Depends on: 3, 8, 11

- [ ] Add the OpenAI routes to the gateway and the Codex choice to sessions.

## Milestone 17: Live proof

Depends on: 13, 15, 16

The live proof also needs the first live cloud build of
`plans/follow-ups/cloud-builds-never-ran-live.md`.

- [ ] Run a session on a preview with E2B: pick, ask, see the screens, and
      publish to a test branch, with Claude and with Codex.

## Milestone 18: Verification, commit, review, and pull request

Depends on: every other milestone

- [ ] Run the targeted tests and the complete gate named in `AGENTS.md`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record
      follow-up items under `plans/follow-ups/` for the rest, re-review
      once, and report.
- [ ] Delete `plans/follow-ups/agent-session-runtime.md` if it is on
      `main`, because decision 1 answers it.
- [ ] Record each item of "Later work" as a follow-up item.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request. Its description gives the decisions and the
      design calls of this plan with their dates, a permalink to this plan,
      and the follow-up items that the change adds.

## Later work

- **Desktop agent sessions.** The desktop shell runs the runner over stdio
  (decision 7) with the computer's credentials (decision 4). It reuses the
  panel and waits for desktop local mode.
- **Own servers.** The runner on a team's server dials `mkc-api` and uses
  that server's credentials (decision 4).
- **Presence.** A running agent joins presence with the `agent` participant
  kind of `plans/live-presence-cursors.md`.

## Post-merge follow-up (non-blocking)

- [ ] Run a session in production with Claude and with Codex.
