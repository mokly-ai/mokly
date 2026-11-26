# Create project in a modal over the viewer

Status: Active. On branch `calummoore/exit-issue-after-project-creation-3xcn`,
no pull request yet. The pull request that completes the work deletes this
plan, as the `plans` skill says. The plan waits for the answers to decisions 1
to 4.

The viewer's Projects panel has a **Create project** button. Today it leaves
the viewer for the onboarding repository step, `/:workspace/-/new`. That page
draws the account frame and the Workspace, Install, Repository strip. It has
no Close and no Back, so a reader who already has a project cannot return to
the viewer, except with the browser's Back. Cal reported this on 2026-11-26
with two screenshots of the step.

Cal chose the approach in the same message: a reader who opens Create project
from the viewer sees a modal over the viewer, without the onboarding steps.
This plan builds that modal as one more viewer panel. The onboarding routes
stay for a reader with no project. This change adds no API change, no Rust
change and no migration.

The options check of the decisions ran on 2026-11-26. Its report is in
`.context/create-project-modal/options-check-report.md`. It added options to
decisions 1 and 2, changed both recommendations, and raised decisions 3 and 4.

Contract owners:

- [Product accounts and roles](../docs/protocol/cloud/product-accounts-and-roles.md).
- [Product navigation](../docs/protocol/cloud/product-navigation.md).
- [Viewer chrome](../docs/protocol/cloud/viewer-chrome.md).
- [Viewer address state](../docs/protocol/cloud/viewer-address-state.md).
- [Product mockups: viewer](../docs/protocol/cloud/product-mockups-viewer.md).
- [Product mockups: settings](../docs/protocol/cloud/product-mockups-settings.md).
- The [app README](../packages/app/README.md).

## Decisions

1. **Where the reader lands after a create from the viewer.**
   - **Background:** Today both create forms open the full-page "Project
     created" screen, `/:workspace/:project/setup`. It shows the address,
     the repository, the config path, the visibility and the publishing
     setup, with **Open project**. The new project's stage already shows the
     first build, or Set up publishing with the CI guide when nothing
     publishes.
   - **Root question:** Where does a reader land after a create that started
     in the viewer?
   - **Options:**
     - **A.** Keep the full-page created screen. The reader leaves the
       viewer once more. Effort: Small.
     - **B.** Close the modal and open the new project's viewer at once. The
       reader does not see the facts that they typed seconds before. Effort:
       Small.
     - **C.** Show the created content in the same modal over the old
       project. It has no address, so a reload shows the empty form, and
       Close leaves the reader on the old project. Effort: Medium.
     - **D.** Open the new project's viewer with a created panel over it.
       Close shows the new stage, and reload keeps the panel. While the first
       build runs, the panel repeats the build card beneath it. Effort:
       Medium.
     - **E.** B, and one success toast on the new viewer. The bar and the
       stage already name the new project, so the toast can be narration
       that the product copy rules reject. Effort: Small.
     - **F.** Open the new viewer with the Project settings pane, which shows
       the facts. The reader lands in an editing dialog without the CI
       guide. Effort: Small.
     - **G.** Give the onboarding create the same end as the viewer create.
       It removes the full-page created screen from `origin/main` and changes
       an end that Cal did not report. Effort: Large.
   - **Left out:** Stay on the old project and list the new one in Projects.
     It fails the goal, because the reader does not reach the new project.
   - **Recommendation:** B. The new stage already gives the next publishing
     step, and the dropped facts repeat the form. The options check changed
     this from C. D best keeps the facts if Cal wants them.
   - **Action:** ask the user, because the options trade the setup facts
     against the work, and no option is clearly best.

2. **Create project in the settings dialog.**
   - **Background:** The settings dialog opens over the viewer on desktop. On
     a phone, settings is a full-screen route without a viewer. The Workspace
     pane has its own **Create project**. It leaves for the onboarding step
     that the workspace is at.
   - **Problem:** From settings, a reader with a project reaches the same
     page with the strip and no way back.
   - **Root question:** Where does Create project in settings take a reader
     who already has a project, on the desktop dialog and on the phone?
   - **Options:**
     - **A.** Change nothing. Effort: Small.
     - **B.** Over a viewer, close the dialog and open the create panel.
       Without a viewer, keep the onboarding step. The phone keeps the
       reported page. Effort: Small.
     - **C.** Draw the create form as a settings pane, a second host with its
       own address and Back rules. Effort: Medium.
     - **D.** Remove Create project from the pane's projects section, and
       keep the next-step action of an empty workspace. It removes an action
       from `origin/main`. Effort: Small.
     - **E.** Always open the create panel over a viewer of that workspace.
       Over a viewer, close the dialog first. Without one, as on the phone,
       open the workspace's last opened project with the panel. Only a
       workspace with no project keeps the onboarding step. Effort: Medium.
     - **F.** Draw the form as a modal over the pane, with no address. After
       a GitHub install, the reader returns to the pane without the modal.
       Effort: Large.
   - **Left out:** The create panel over the open dialog. It breaks the rule
     of one cloud overlay at a time in
     [Viewer chrome](../docs/protocol/cloud/viewer-chrome.md).
   - **Recommendation:** E. It puts both surfaces on the same panel, and B
     keeps the reported page on the phone. The options check changed this
     from B.
   - **Action:** ask the user, because the recommended option changes a
     requirement of the settings mockup doc, and no user decision covers it.

3. **The workspace that a new project goes into.**
   - **Background:** The Projects panel lists every workspace that the
     reader can open. Its one Create project creates in the workspace of the
     project on the stage. A workspace with no project has no viewer, so
     Workspace settings and the first project there use the onboarding
     pages.
   - **Problem:** A reader with projects who starts the first project of a
     second workspace still gets the strip and no way back.
   - **Root question:** How does a reader with a project choose the workspace
     of the next one?
   - **Options:**
     - **A.** Keep the workspace of the stage. A second empty workspace keeps
       the onboarding pages. Effort: Small.
     - **B.** Add a Workspace select at the top of the create panel. The body
       changes with the chosen workspace's role, plan and GitHub accounts.
       Effort: Medium.
     - **C.** Put the workspace in the panel's address, and give each
       workspace group of the Projects panel its own Create project. It adds
       one viewer address key and one action for each group. Effort: Medium.
   - **Left out:** None.
   - **Recommendation:** A. It keeps this fix on the reported path. C best
     protects the codebase, because every create then has one home.
   - **Action:** ask the user, because the options trade scope against a
     second path that Cal's words may cover, and no option is clearly best.

4. **Who sees Create project in the Projects panel.**
   - **Background:** The panel shows Create project to every reader. A
     reviewer cannot create a project. A project-only guest cannot read the
     workspace.
   - **Root question:** Which readers does the Projects panel offer Create
     project?
   - **Options:**
     - **A.** Every reader, as today. The panel tells a reviewer to ask an
       owner or admin, and a guest gets the same line. Effort: Small.
     - **B.** Only owners, admins and members of the stage's workspace. It
       changes the panel that viewer chrome describes. Effort: Small.
   - **Left out:** A disabled button with a hint. A control that cannot act
     is worse than B on every point.
   - **Recommendation:** B. A button that only says to ask someone else is
     a dead end.
   - **Action:** ask the user, because the recommended option changes the
     panel's contract in viewer chrome, and no user decision covers it.

## Design

Each item below is my call, made on 2026-11-26.

- The modal is a viewer panel with the address value `panel=new-project`. It
  uses the frame of the other viewer panels: a centered modal on a pointer
  surface and a bottom sheet on a compact one, with Close, Escape and the
  inert viewer beneath. Alias resolution carries it as it carries every
  `panel`. Reason: the viewer already owns one overlay mechanism, and the
  install return below needs an address.
- The Projects panel's **Create project** replaces the open Projects panel
  with the new panel, as one overlay entry. Close and the browser's Back
  both return to the viewer, with the same publication on the stage.
- The panel's title is **Create project**. It draws no brand mark, no account
  header and no step strip.
- The panel draws the state that the workspace is at, with the copy of the
  onboarding steps:
  - With a connected GitHub account, it draws the repository form.
  - Without one, an owner or admin sees the install content with **Install
    on GitHub**. That content keeps the suspension fact, the busy and
    refused install write, and the desktop window's install on the web. It
    drops the step's Back link to `/new`. A member sees "Ask an owner or
    admin to install it."
  - When decision 4 keeps the button for a reviewer, the reviewer sees one
    line, "Ask an owner or admin to create a project.", and no action.
  - Owners, admins and members get **Publish with the CLI instead**. It shows
    the CLI form in the same panel, at `panel=new-project-cli`. The form's
    **Back** returns to the panel's first body.
- **Install on GitHub** sends the current address as `returnTo`, as the
  install step already does. The reader returns to the same viewer address,
  and the panel opens with the repository form.
- With several accounts, "Manage repository access" opens the GitHub accounts
  pane, which displaces the panel. The address keeps `panel`, so closing the
  pane shows the panel again. The form's answers are not kept.
- The onboarding routes `/:workspace/-/new` and `/:workspace/-/new/cli` keep
  their pages for a reader with no project.
- The repository step, the CLI form and the install step split into
  frame-free bodies and the pages that wrap them in `AccountShell`. The pages
  and the panel render the same bodies and the same waits, so they cannot
  drift.
- `packages/app/src/screens/viewer/viewer-screen.tsx` has 296 lines. The new
  wiring goes into `panel-host.tsx` or a new file, not into that screen.

## Milestone 1: Mockups

Tags: mockup

Depends on: none

Draw the new panel over the viewer in the cloud mockup catalogue under
`docs/mockups`, with the shared panel and form components.

- [ ] Add `product/viewer/new-project` over the standalone viewer. Its
      canonical page is the repository form. Its empty page is "No
      repositories yet". Its error page is "Repositories couldn’t load" with
      **Try again**. Its loading page is the form's wait.
- [ ] Add the screens beside it: `install` for an owner without a connected
      account, `suspended`, `installing`, `member`, `cli` with Back, and
      `creating`. Add `reviewer` only when decision 4 chooses A.
- [ ] Draw the outcome of decisions 1, 2 and 3: the created panel for D, the
      settings entry for E, and the per-workspace action for decision 3 C.
- [ ] Run the cloud mockup check that `docs/mockups/README.md` gives.
      Smoke-test the changed pages.
- [ ] Update the design and the TODOs of this plan for each problem that the
      mockups show.

## Milestone 2: Documentation and protocol

Depends on: 1

- [ ] `product-accounts-and-roles.md`: add how a reader with a project creates
      the next one in the panel, with its role states. Apply decision 1 to
      the project-created rules.
- [ ] `product-navigation.md` and `viewer-address-state.md`: add the two
      panel values. Apply decision 1 to the route table and the navigation
      shell.
- [ ] `viewer-chrome.md`: say that Create project opens the create panel.
      Apply decision 4.
- [ ] `product-mockups-viewer.md`: add the new screens.
- [ ] `product-mockups-settings.md`: apply decision 2.
- [ ] Update the app README where it names the panels.

## Milestone 3: The panel in the app

Tags: ui

Depends on: 2

- [ ] Split the repository step, the CLI form and the install step into
      frame-free bodies and their pages.
- [ ] Add `new-project` and `new-project-cli` to the viewer panels and to
      their address parser.
- [ ] Render the panel bodies in `panel-host.tsx` from the workspace read.
- [ ] Point the Projects panel's Create project at the new panel. Apply
      decisions 3 and 4.
- [ ] Apply decision 1 to the create's destination from the panel.
- [ ] Apply decision 2 to the settings pane.
- [ ] Logic tests for the two panel values. A browser spec: open Projects,
      press Create project, close the panel and keep the publication, then
      create a project from the panel.

## Milestone 4: Verification, commit, review, and pull request

Depends on: every other milestone

- [ ] Run the targeted tests and `cargo xtask check --suite cloud-app`, then
      the complete gate named in `AGENTS.md`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the
      `implementation-review` skill after the push. Report the findings,
      then apply the fix rule: fix the `fix now` findings, record
      follow-up items under `plans/follow-ups/` for the rest, re-review
      once, and report.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the
      plan".
- [ ] Open the pull request. Its description gives the decisions and the
      design calls of this plan with their dates, a permalink to this plan,
      and the follow-up items that the change adds.
