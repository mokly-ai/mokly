# Mockup Fixtures

These files contain explicit design scenarios for this repository. They are
never imported by `packages/app` or another product runtime.

`product.ts` retains the Folio product data: Mokly Team and `mokly-team`, Mokly Cloud
and `mokly-cloud`, its repository and config path, Cal owner / Alex admin / Sam
reviewer, and the workspace's two projects. `githubAccounts` holds the GitHub
accounts the workspace connects, in order: the GitHub organization `mokly-ai`,
whose repositories `mokly-ai/mokly-cloud` and `mokly-ai/mokly` hold both
projects, and the personal account `cal` with `cal/release-notes`. Each carries
the manage page GitHub gives its installation, in GitHub's form for its kind.
The workspace's `manageUrl` is the organization's.

`publications.ts` supplies the viewer family:

- One SHA per publication, used wherever that publication appears, so the
  chrome, the switcher, history and a share link never disagree.
- Seven branches with the default first and every publication state — ready,
  publishing, failed, none — among them, and two pull requests. Two more pull
  requests stay out of the drawn switcher, because only the stage draws them:
  Alex's, closed after its build failed, and Sam's from a fork, which never
  builds: open, it draws the fork card, and merged with nothing published,
  the closed card. A row reads
  the newer of its newest publication and its newest build, and `ready` says
  whether opening it reaches a ready publication: the branch Cal reads says
  Publishing now while a build publishes a newer push, and Cal's own pull
  request is publishing for the first time. A row that takes its state from a
  build names it in `build`. Two branches with nothing ready read Unable to
  publish: one whose newest attempt is a failed publication, which opens that
  publication's details, and Alex's `alex/bun-migration`, whose newest build
  failed, which opens that build. Alex's `alex/onboarding-copy` reads Unable
  to publish too, because its newest publication failed, but it is `ready`, so
  it opens its earlier ready publication.
- The pull request is Alex's, because Cal is the reader and Sam is the pending
  invitee; a fixture never makes one person both the actor and the subject.
  Sam contributes from a fork.
- History is newest first with the head marked current, and one failed
  publication, so the panel shows both Ready and Failed.
- Two workspaces Cal can open, the first holding the project he is in.
  `accounts` names the GitHub accounts each one connects, which the
  projects panel lists beside its name: both of the team's, and none for
  Cal's own workspace, which publishes with the CLI.
- `publicationScreens` are the publication's current screens, in the order of
  its own catalogue, which `viewer-catalogue.ts` keeps for the catalogue
  drawings. Each one declares its schemes, and its views derive from them at
  both viewports, as Mokly 0.18.0 draws every screen: Home and Account are
  light and dark, and Pricing and Checkout are light only. `listedScreens`
  holds the same screens in the order of
  [`listScreens`](../../../protocol/cloud/viewer-read-model.md#screens--listscreens),
  bytewise by path, and Share offers that list.
- `listedBranches` holds `branches` in the order of
  [`listBranches`](../../../protocol/cloud/viewer-read-model.md#branches--listbranches):
  the default branch first, then the other names bytewise. The switcher draws
  that list. `compareBytewise` in `api-order.ts` is the one bytewise comparison
  that `listedBranches` and `listedScreens` share.
- `publicationLink` builds the canonical link Share copies beneath
  `/mokly-team/mokly-cloud` on the shared site origin, with an opaque
  publication ID and only the screen, viewport and scheme that a selection
  carries. Each Share document passes its own view, so the link leaves out the
  desktop viewport and the reader's own scheme, and names `scheme=light` only
  for a screen that the light fallback shows. It is a mockup value, not a live
  destination.

`builds.ts` supplies the cloud builds the viewer draws:

- One build per card state — queued, running, published, failed, timed out,
  superseded and cancelled — plus a failure for each drawn cause, on the
  members' own branches and the fixture's pull requests. Alex's
  `alex/bun-migration` tracks only `bun.lock`, so its build stops at the
  lockfile search. Alex's closed pull request's failed build carries the
  refused Try again, and the build running on the branch Cal reads draws a
  refused Cancel. A pull request from a fork never builds, so no build
  names one.
- One 40-character head per build. The published build's head is the branch's
  current publication, and the heads of the builds that switcher rows name are
  the SHAs those rows show, so a SHA never names two different builds.
- `referenceHistory` merges the branch's publications with the build
  publishing a newer push and the earlier build that failed, newest first;
  the superseded build is not history.
- `causeSentences` holds each cause's sentence from the
  [Viewer builds cause table](../../../protocol/cloud/viewer-builds.md#build-card),
  including its `output-limit` row. A policy test compares them word for word.

`build-output.ts` writes each build's output window: the runner's own command
and result lines around every process, with the runner contract's exact argv,
and what git, npm and `mokly publish` print in CI mode. A build whose only
lockfile is Bun's ends after `git ls-files` prints it, with no install command.
No line holds a token, the credential file's contents or a redaction marker.

`site.ts` holds the shared site origin, the site and app routes derived from it
— among them `publishFromCi`, the CI setup guide every Publish from CI link
opens. The site implementation emits relative
`/sign-in` and `/sign-up` paths. The mockup fixture depicts them as
absolute URLs beneath `siteOrigin` because a generated static page opened from
disk cannot resolve a root-relative app path. Account entry, onboarding and the
registered Design header link to the public routes with real `href`s. See
[Marketing site](../../../protocol/cloud/marketing-site.md).

`emails.ts` supplies the two email screens under Design: Sam as the
recipient of both messages, Alex as the inviter, Mokly Team as the
workspace, the formatted lifetimes the contract fixes (15 minutes, 7 days)
and links on the application origin whose token is visibly not a credential.
The sign-in link lands at `/auth/email/callback`; the invitation opens the
acceptance route for its example workspace and pending member IDs. Route parity is checked
against the app and domain paths. The screens draw the same `Body` the
generator emits; only the content differs.

`product-states.ts` supplies the inventory's scenario snapshots:

- Account setup follows Cal. The canonical entry forms carry Cal's address and
  the empty state is the untouched form, so the two states stay distinct.
  Email-sent pages carry only the submitted address, without claiming an
  authenticated identity or an existing workspace.
- In the members pane, Cal and Alex have accepted membership and Sam has a
  pending invitation. The no-pending-invitations state shows the pane without
  one. Never show the same address as both active and pending. The invite form
  and the selected member's role are inline parts of the same pane; the removal
  confirmation is a modal screen of its own beside the pane. Pending role updates keep that
  member's name visible. While Send invitation runs, the form holds
  `membership.inviting`, an address neither active nor pending; while Save
  role runs, Sam's role reads `membership.askedRole`, Member, the role the
  reader chose.
- `unnamedMember` has set no name, so they are listed and managed by their
  address. It is deliberately longer than the panel's column, because short
  names hide what a real identity costs the layout; the members pane's
  identity variant manages them.
- `placeholders` are what an untouched field shows: the account's own name,
  copied from the running product, and the shape of the repository the CLI form
  asks for, which the product writes when it draws that form. A field the
  product gives a default value, such as the config path, has none, and the
  repository step is a select whose own placeholder belongs to the drawing that
  shows it with nothing to choose.
- `onboarding.cliRepository` is the repository the CLI form names, as the Mokly
  CLI identifies it: `gitlab.com/mokly-ai/web/site`, on a host other than
  github.com and with a group beneath its owner, so the form never reads as
  GitHub-only. `cliProjectSlug` is the slug suggested for it.
- `failureReference` is the identifier Mokly answers a failed request with,
  quoted by the `Details` disclosure an error draws. `causes` holds the
  sentence each refused write says beside its control, taken from the
  application's own catalogue of reasons. Neither is a credential, and a
  failure raised in the browser carries no reference at all.
- The access pane shows inherited workspace rights and an explicit project
  grant. A grant cannot reduce inherited rights.
- `mkc_example_not_a_credential` is a deliberately nonfunctional example,
  revealed only by the tokens pane's reveal: the reveal variant and the
  copy-refused variant, where the secret has to stay on screen because the
  browser would not take it. Lists contain `mkc_2600…`
  metadata. No empty, loading or error state reproduces the revealed value.
- `profile` is Cal's own account, read by the account pane.
- `billing` is what the Billing pane reads: the catalogue's seat prices, the
  seats this workspace uses and the dates a subscription reports. The
  prices are written once, in cents, and every sentence and total is derived
  from them, because the running pane reads counts and unit amounts from one
  billing response and computes the total itself. Editors are everyone in the
  workspace who is not a reviewer and the one Collaborator is Sam's
  reviewer grant, so the Billing, Members and Access panes count the same
  people. `planRequired` is the sentence the refused private-visibility write
  says above its confirmation inside the visibility modal; it joins `causes`
  when the application first writes it, because every sentence there is one
  the product already says. `askOwner` is what everyone who cannot start
  Checkout is told in place of that way on, in the modal and on the stage.
- The account steps draw the workspace at the beginning, on the free plan,
  where the project it creates is public and the steps say so. The settings
  and viewer families draw the same workspace once it is on Team, with that
  project private: one lifecycle, in the order a reader walks it.

The default drawing and its empty, loading and error variants are independent
static snapshots.
Named components compose the same layout; pending reads replace only the
region being fetched, while pending writes retain their draft and disable
submission. Buttons and links inside these mockups perform no live writes.
The onboarding flow composes canonical owners and ends where the new project
is set up.
Live controls consume API permissions and counts; these fixtures stay here.

The comment and approval fixtures were removed in Milestone 11C with their
screens and return with the deferred review phase; their sources remain at
commit `4948fe2`.
