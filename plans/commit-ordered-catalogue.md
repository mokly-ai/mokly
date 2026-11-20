# Commit-Ordered Branch Catalogue

Status: Active. [PR #375](https://github.com/mokly-ai/mokly/pull/375) is open. Every design decision of this plan waits for the user, and no implementation is approved. The plan-only pull request keeps this plan. The implementation pull request deletes it, as the `plans` skill says.

A reference is a branch or a pull request of a project. Its target is the ready publication that its addresses open. The API calls it `latestPublicationId`. These addresses are the app branch and pull request routes, the project entry, View latest and the catalogue branch host. Today the target is the ready publication that the server admitted last, not the newest commit. So a late upload of an older commit can move the target back to older content.

This plan replaces `plans/follow-ups/branch-catalogue-follows-upload-order.md`. Its task is a target that follows commit order rather than upload order.

On 2026-10-20 the user approved writing this plan. The replaced follow-up item recorded that this approval covers the plan only. It chooses no design and authorizes no implementation. Items 1 to 8 hold the design choices. Each recommendation is a proposal of 2026-11-20, not a choice. This plan makes no design call of its own.

This plan keeps three contracts in force: History in admission order, the immutable identity and pull request context of each publication, and exact publication addresses. The History screen and the build policy stay outside its implementation scope. It does not change build triggers or build supersession, and it does not enable builds of every commit.

Contract owners:

- [Viewer read model](../docs/protocol/cloud/viewer-read-model.md), [catalogue hosting](../docs/protocol/cloud/catalogue-hosting.md), [viewer address state](../docs/protocol/cloud/viewer-address-state.md) and [product navigation](../docs/protocol/cloud/product-navigation.md).
- [GitHub App](../docs/protocol/cloud/github-app.md), [publication upload](../docs/protocol/cloud/publication-upload.md), [publication storage](../docs/protocol/cloud/persistence-publication-storage.md), [retention](../docs/protocol/cloud/retention.md) and [viewer builds](../docs/protocol/cloud/viewer-builds.md), when an answer changes them.
- The [store README](../crates/mkc-store-pg/README.md), the [publications README](../crates/mkc-publications/README.md), the [catalogue server README](../crates/mkc-catalogue-server/README.md) and the [app README](../apps/app/README.md).

## Earlier Work

The old `mokly-cloud` repository has two unmerged branches for this change. `calummoore/commit-ordered-catalogue`, at [`12ca2509`](https://github.com/mokly-ai/mokly-cloud/blob/12ca250973fdafb0fede280ddd4a7cf409ec704c/plans/commit-ordered-catalogue.md), holds an earlier plan, contracts, mockups and code from 2026-10-20 and 2026-10-21. `conductor/follow-ups-commit-ordered-catalogue-plan`, at [`3e942033`](https://github.com/mokly-ai/mokly-cloud/blob/3e9420331d033049711aa4e03f26d00557d046e5/plans/commit-ordered-catalogue.md), ports that plan. This plan calls them the earlier proposal.

The earlier proposal is historical only. This plan cites its decisions as previous examples, not as choices. Several facts changed since then. The repositories merged in #350, and ready publications stopped expiring. The View latest poll now reads the reference row, and the cloud uses the workspace viewer.

Risks of the earlier proposal:

- Its code had no pull request and no review, and it uses the paths of the old `mokly-cloud` tree.
- Its port recorded on 2026-11-04 that its diff changed 280 files and failed to apply in 74 files.
- A merge or a copy of its code can drop behaviour that this repository added later. Its tests and drawings target older contracts.

## Terms

- **Admission order:** The order of `publications.created_at`. The server sets it when it admits an upload plan, before it reads the envelope.
- **Stored tip:** The branch tip or pull request head that the GitHub worker reads from GitHub and saves with an observation time.
- **Live App access:** A project has it while its stored repository link names an active repository in an active, connected installation of its workspace.
- **Evidence:** Stored data that places a commit in the order of one reference.
- **Empty target:** The state of a reference whose History lists ready catalogues but whose target is absent.

## Plan-Wide Assumptions

Every item shares these assumptions. Each one is a contract in force.

1. An exact publication address never changes its target. Source: `docs/protocol/cloud/product-navigation.md:180-184`.
2. Each project, head and config path has one ready publication, and the first ready upload wins. Source: `docs/protocol/cloud/publication-upload.md:106-110`. This rule is a contract in force, not a user decision. Option F of item 2 proposes to replace it.
3. A publication keeps the branch and the pull request context of its own upload. Source: `docs/protocol/cloud/viewer-read-model.md:129-134` and the immutability trigger in `crates/mkc-db/migrations/202609162000_publications/up.sql`.
4. History lists publications in admission order. Source: `docs/protocol/cloud/viewer-read-model.md:36-39` and `:107-119`.
5. Failed, unfinished and expired attempts never become a target. Source: `docs/protocol/cloud/catalogue-hosting.md:55-60`.
6. Viewer reads never call GitHub. Source: `docs/protocol/cloud/viewer-read-model.md:3-6`.
7. The viewer never moves a reader to a new target. View latest only offers it. Source: `docs/protocol/cloud/viewer-address-state.md:157-161`.
8. A project without a repository link publishes through the CLI and has no builds. Source: `docs/protocol/cloud/platform-model.md:169-172` and `docs/protocol/cloud/cloud-builds.md:28-30`.
9. Build triggers and build supersession keep their current rules. Source: `docs/protocol/cloud/cloud-builds.md`, sections "Triggers" and "Supersession And Cancellation".
10. A deleted branch keeps its row and its target while publication history names it. Source: `docs/protocol/cloud/viewer-read-model.md:52-53` and `:61-62`.

## Cases The Decisions Settle

| Case                                                                                                                | Items         |
| ------------------------------------------------------------------------------------------------------------------- | ------------- |
| A late upload of an older commit, from overlapping CI runs or a new plan after an attempt expired                   | 1 and 6       |
| An older cloud build publishes after CI published the newer head, because the scheduler returns before supersession | 1             |
| An upload becomes ready before the server records its push                                                          | 1, 6 and 7    |
| A commit was the tip only between two observations, so the worker never stored it                                   | 1 and 6       |
| A catalogue never gets evidence, so upload order stays in force for its reference                                   | 1 and 6       |
| A ready completion and a tip observation commit at the same time                                                    | 7             |
| The newest commit has no ready catalogue yet, or its build or upload failed                                         | 4             |
| A reference has a stored tip while another of its catalogues has no evidence                                        | 4 and 6       |
| A rule leaves an empty target                                                                                       | 4, 5, 6 and 8 |
| A force push, a rebase or a reset to an older commit                                                                | 4 and 5       |
| A forced push drops commits, and its payload does not list them                                                     | 1 and 5       |
| A branch is deleted, then created again at another commit                                                           | 5             |
| A lost webhook delivery leaves the stored tip stale                                                                 | 1, 6 and 8    |
| No repository link, lost App access, a GitHub outage or a rate limit                                                | 2 and 6       |
| A project loses App access, keeps publishing through the CLI, then gets access back                                 | 6             |
| An installation stays active but is not connected to its workspace, so its stored tips stay current                 | 6             |
| One head on two references: a fast-forward, a new branch at a published commit, or push and pull request uploads    | 2 and 3       |
| A replay links a published head to another reference, and upload order must rank that link                          | 2 and 6       |
| A replay row passes its cleanup window, so its link facts are gone                                                  | 2 and 8       |
| A reference needs its own comparison for a head that another reference published first                              | 2             |
| A pull request shows a push catalogue that has no comparison or another base                                        | 2             |
| A pull request address resolves, and View latest then polls the head branch                                         | 3             |
| A merge-commit upload from the default pull request checkout, which is never a tip                                  | 1 and 6       |
| Existing publications with no evidence at deploy                                                                    | 1, 4, 6 and 8 |
| A rollback to the earlier application                                                                               | 8             |

Replaced ways:

- Admission-order target selection → the selection that the answers to items 1, 2 and 4 to 7 define. When item 6 keeps upload order for some references, that mode becomes part of the new rule. Consumers:
  - `latest_publication` at `crates/mkc-store-pg/src/publication.rs:139-156`, with its trait method at `crates/mkc-store-interface/src/publication.rs:178`, its mocks, and its tests at `crates/mkc-publications/tests/maintenance/lifecycle_tests.rs:44-58`, `worker_tests.rs:131` and `complete_runner_tests.rs:157`. Its admission-order rule is replaced in Milestone 5. The method goes only when the chosen design leaves it unused.
  - `branch_alias` at `crates/mkc-store-pg/src/publication.rs:237-251`, which the catalogue branch host reads through `crates/mkc-publications/src/access.rs:221-230`. Moved in Milestone 5.
  - `latest_publication_id` at `crates/mkc-store-pg/src/viewer/branches.sql:33-35` and `crates/mkc-store-pg/src/viewer/pull_requests.sql:8-10`, with their tests in `crates/mkc-store-pg/tests/viewer/`. Moved in Milestone 5.
  - The default-branch choice at `crates/mkc-store-pg/src/viewer/branches.sql:5-11`, for projects with no known default branch. Moved in Milestone 5 when item 6 orders such projects.
  - The catalogue branch host registration at `crates/mkc-publications/src/reservation/finish.rs:148-154`. Moved in Milestone 5 when item 2 lets a branch show a catalogue that another upload made.
  - The index `publications_project_branch` at `crates/mkc-db/migrations/202609162000_publications/up.sql:35`. A forward migration in Milestone 5 drops it only when the chosen design leaves it unused. Each index that the admission-order reads of History need stays.
  - The rule text at `docs/protocol/cloud/viewer-read-model.md:56-75`, `catalogue-hosting.md:55-60`, `viewer-address-state.md:13-18`, `product-navigation.md:39-41` and `docs/architecture/cloud-data-flows.md:20`. Moved in Milestone 2.
  - The README text at `crates/mkc-store-pg/README.md:72` and `:196-197`, `crates/mkc-catalogue-server/README.md:14-15` and `crates/mkc-publications/README.md:258`. Moved in Milestone 5.
  - The app readers at `apps/app/src/viewer/entry.ts:193-194`, `resolution.ts:100-113`, `latest.ts:21-29` and `panels/switcher.tsx:44` and `:52`. They follow `latestPublicationId`. Milestone 5 confirms that they need no change. Milestone 6 moves them only when an answer changes the viewer.
- Admission-order newest attempt in reference rows → the order of item 1, only under option D of item 4. Consumers: the queries at `crates/mkc-store-pg/src/viewer/branches.sql:37-43` and `crates/mkc-store-pg/src/viewer/pull_requests.sql:14-20`, and the rule text at `docs/protocol/cloud/viewer-read-model.md:67-75`. Moved in Milestones 2 and 5.
- One ready publication for each project, head and config path → a ready identity that also holds the reference, only under option F of item 2. The reference is the branch and the pull request number. Each publication row stays immutable. Consumers:
  - The store identity query `publication_by_identity` at `crates/mkc-store-pg/src/publication.rs:109-127`, and the unique index `publications_ready_identity` at `crates/mkc-db/migrations/202609162000_publications/up.sql:34`. Moved in Milestones 3 and 5.
  - The reservation replay at `crates/mkc-publications/src/reservation/reserve.rs:68-85`, and the completion replay at `crates/mkc-publications/src/completion_outcome.rs:56-104`. Moved in Milestone 5.
  - The build duplicate checks at `crates/mkc-publications/src/build_scheduler.rs:84-93`. They keep today's rule unless the user answers the build question of F. Moved in Milestone 5 only after that answer.
  - The receipt `replay` flag at `crates/mkc-publications/src/completion_outcome.rs:106-119`, and the CLI message for a published commit. Moved in Milestone 5.
  - The check of a head, whose runs `github_check_runs` keys by head at `crates/mkc-db/migrations/202609161530_github_app/up.sql:96-105`. Moved in Milestone 5 under the check rule that the user settles.
  - The rule text at `docs/protocol/cloud/publication-upload.md:106-110` and `docs/protocol/cloud/publication-ingest.md:150-156`. Moved in Milestone 2.

## Decisions

Every item is open. The items are in severity order. Each recommendation is a proposal of 2026-11-20.

The options check of 2026-11-20 is merged. Its report is `.context/commit-ordered-catalogue/options-check.md`. It added option F of item 1, D of item 2, D and E of item 3, and D of item 4. It also added D and E of item 5, and D to G of item 6. Last, it added D of item 7 and D to F of item 8. It withdrew option B of item 6.

A plan review of 2026-11-20 added option E of item 2, and it corrected the text of items 2, 4, 5, 6 and 8. Its findings are in `.context/reviews/calummoore/fu-branch-catalogue-upload-order-plan-csn3/findings.md`.

A final options check of 2026-11-20 added option F of item 2 and option H of item 6. It raised the effort of E of item 2, and of D and G of item 6, to Large. Its report is `.context/commit-ordered-catalogue/options-check-after-review.md`.

| No. | Title                                        | Source | Severity | Effort | Proposed   |
| --- | -------------------------------------------- | ------ | -------- | ------ | ---------- |
| 1   | Uploads, not commits, set the target         | Design | High     | Large  | B          |
| 2   | A reference cannot show its tip's catalogue  | Design | High     | Medium | C          |
| 3   | A shared catalogue names the upload's branch | Design | Medium   | Large  | C, first A |
| 4   | No rule before the newest commit publishes   | Design | Medium   | Small  | A          |
| 5   | No rule for resets and recreated branches    | Design | Medium   | Small  | A          |
| 6   | No rule when commit order is unknown         | Design | Medium   | Large  | G, first B |
| 7   | No home for the target under concurrency     | Design | Medium   | Small  | A          |
| 8   | Existing catalogues have no order evidence   | Design | Low      | Small  | A          |

### 1. Uploads, not commits, set the target

- **Severity:** High. **Likelihood:** Common. **Effort:** Large.
- **Source:** Design.
- **Category:** Product bug.
- **Location:** `crates/mkc-store-pg/src/publication.rs:139-156`, `crates/mkc-store-pg/src/viewer/branches.sql:33-35` and `crates/mkc-store-pg/src/viewer/pull_requests.sql:8-10`.
- **Background:** `crates/mkc-publications/src/preflight.rs:69-78` sets the admission time before it reads the envelope. The envelope at `crates/mkc-mokly-contract/src/manifest.rs:28-53` holds no data about commit order. The GitHub worker already stores the tips of each project with a repository link, at `crates/mkc-api/src/github_worker/prepare.rs:127-205`. Selection never reads those tips.
- **Problem:** Admission order is not commit order. When the CI of an older commit admits its plan last, its catalogue becomes the target.
- **Impact if no action:** Every address of a reference can open older content after newer content. Builds of every commit stay unsafe.
- **Root question:** How does the cloud place each ready catalogue in the history of a reference, so that the arrival order of uploads never decides the target? The options check replaced the first question, because "newest commit" has no meaning after a reset.
- **Shared assumptions:** The plan-wide assumptions, and three more. Only a project with a repository link has stored tips. They stay current while its installation and repository are active, also without a workspace connection. Source: `crates/mkc-api/src/github_worker/prepare.rs:87-205`. The upload envelope stays at version 3. Source: `docs/protocol/cloud/publication-upload.md:53`.

  Option E drops these two. A catalogue's commit is the commit that its upload checked out. Source: `docs/protocol/mokly-upload.md:132-138`. So a merge-commit upload never matches a tip under A to D.

- **Options:**
  - **A.** Exact tip. The target is the ready catalogue of the stored tip. Item 4 decides what shows when the tip has none. It adds no GitHub read, and it covers only projects whose stored tips stay current. Effort: Medium.
  - **B.** Tip history. Keep each stored tip with its observation time. Rank each ready catalogue by the last time its commit was the tip. The worker stores the tip that it reads, not the head of the webhook payload. So a commit that was the tip only between two observations gets no rank, and it stays hidden behind an older catalogue. It adds no GitHub read, and it covers only projects whose stored tips stay current.

    Effort: Large.

  - **C.** Ancestry. Compare each catalogue's commit with the tip through the GitHub compare API, which returns `status`, `ahead_by`, `behind_by` and `merge_base_commit`. Select the nearest ancestor. It orders every commit, also one that was the tip only between two observations. It needs stored answers, a refresh worker and outage rules. Effort: Large.
  - **D.** Transition ledger. Record the heads, forced markers and commit lists that each event supplies, and give each commit a position. Event payloads differ, so missing history needs a provider read. GitHub does not redeliver a failed delivery by itself, so gaps need a repair read. A push payload does not list the commits that a forced push dropped, so dropping them needs a compare read. Effort: Large.
  - **E.** Producer facts. `mokly publish` sends a commit generation number in envelope 4. It needs a Mokly release and consumer upgrades, and it covers only uploads from that release with full history. A shallow checkout or an older CLI sends no correct number. A merge-commit upload outranks the later heads of its pull request. The server cannot check the fact, and the fact cannot follow a reset.

    Whether envelope 4 replaces envelope 3, or both stay accepted and for how long, is a separate question. The user settles it before the milestone of E can be planned. Effort: Large.

  - **F.** Cloud commit history. A worker fetches only the commit objects of the repository through the App, and it computes ancestry locally. It orders every commit that GitHub still holds, with no compare request for each catalogue. It adds storage, a fetch worker and a Git dependency. It keeps commit messages and author names of private repositories, so the retention contract changes. Effort: Large.
- **Left out:**
  - Change nothing. It fails the goal.
  - Order by `exportedAt` or by Git dates. Clocks and rebases break the order, and `docs/protocol/cloud/viewer-read-model.md:119` keeps producer times out of ordering.
  - Tell CI to cancel older runs. It cannot stop an upload that already started, so it fails the goal.
  - Reject uploads of a commit that is not the tip, or select only when a catalogue becomes ready. A fast-forward or a reset to a published commit adds no upload, so both fail the goal. The rejection is also new, and only the user can approve a new rejection.
  - Read GitHub each time a target is read. It breaks assumption 6.
  - Take a server order key when a CI run starts. A re-run of an old job starts late and wins, so it fails the goal.
  - Let only cloud builds publish for projects with live App access. It changes the build policy that assumption 9 keeps, and it adds a rejection.
  - Send a list of ancestors from the producer. It is a detail of E, and heads on diverged histories still need an arrival rule.
- **Wider fix:** C. It also orders a commit that was the tip only between two observations. The first wider fix was E. E fails when the case changes shape. A merge-commit upload outranks later heads, a shallow checkout has no correct number, and E never follows a reset. No option prevents the problem for projects without a repository link.
- **Previous examples:** Decision 1 of the earlier proposal, option A, used ancestry through the App installation. Its Decision 4, option A, ranked ancestors by distance, then by full SHA. Its code at `b40c9863` ranked in SQL triggers. Upload replay already decides by identity, not arrival, at `crates/mkc-publications/src/reservation/reserve.rs:68-85`.
- **Related:**
  - Item 4, work that waits for the answer. Under option A here, item 4 decides what shows when the stored tip has no catalogue. So it decides how stale the target gets.
  - Item 5, work that waits for the answer. Options A and B here cannot drop discarded commits. D here needs a compare read for that.
  - Item 6, work that waits for the answer. Every option needs the rule for unknown order. Under E, a catalogue from an older CLI or from before the release has no generation number.
  - Item 7, work that waits for the answer. Options C, D and F here read the network, so their evidence needs a worker.
  - Item 8, work that waits for the answer. Under option A here, the stored tips already exist at deploy, so every rollout can move targets.
- **Recommendation:** B, proposed on 2026-11-20. It covers the common cases with data that the worker already reads, and it adds no GitHub read. Under B, a commit that was the tip only between two observations stays hidden behind an older catalogue. C shows that commit, and C protects the codebase best.
- **Action:** ask the user, because the options trade the projects and commits that they cover against cost, and no option is clearly best.

### 2. A reference cannot show its tip's catalogue

- **Severity:** High. **Likelihood:** Common. **Effort:** Medium.
- **Source:** Design.
- **Category:** Product bug.
- **Location:** `crates/mkc-store-pg/src/publication.rs:144-149`, `crates/mkc-store-pg/src/viewer/pull_requests.sql:8-10`, `crates/mkc-publications/src/reservation/finish.rs:148-154`, `crates/mkc-publications/src/build_scheduler.rs:84-93` and `crates/mkc-publications/src/build_head.rs`.
- **Terms:**
  - **Replay:** An upload of a head that already has a ready publication in the project. The server closes the new attempt and answers with the existing publication.
- **Background:** A replay keeps the first row, with that row's branch and pull request number, at `crates/mkc-publications/src/reservation/reserve.rs:68-85`. The first ready upload wins also when another upload has another comparison base, at `docs/protocol/cloud/publication-ingest.md:150-156`. A branch target matches the stored branch name. The pull request target rule matches "the stored upload PR number, not merely the branch or SHA". No build runs for a head that is already published.
- **Problem:** Some commits have a catalogue only under another branch, or with no pull request number. Examples are a fast-forward of `main`, a new branch at a published commit, and push CI that publishes a pull request head first. Such a reference cannot open the catalogue of its own tip.
- **Impact if no action:** With commit order, such a reference still opens older content. The catalogue branch host of a branch with no upload of its own returns not found.
- **Root question:** How does a reference show a suitable catalogue of each commit that it holds, whoever published that commit first, with evidence and without it? The final options check replaced the question, because the first one assumed a pick among existing catalogues and hid F. "Suitable" covers the comparison base of D.
- **Shared assumptions:** The plan-wide assumptions, with assumption 2 open, and four more.
  - Assumption 2, the ready identity rule, is a contract in force, not a user decision. Its reason is safe retries and re-runs, and a key that also holds the reference keeps that reason. F proposes to replace it.
  - A pull request upload counts for its head branch. Source: `crates/mkc-store-pg/src/publication.rs:144-149` and `docs/protocol/cloud/viewer-read-model.md:61-62`. Kept.
  - One catalogue's comparison serves every reference that shows it. Source: `docs/protocol/cloud/publication-ingest.md:150-156`. D keeps it and hides a catalogue whose base does not suit the reference. F drops it.
  - Membership comes only from the reference's own upload, a replay or the order source of item 1. Source: the text of the options. Under option E of item 1, C and D then give only what A gives, and E gives only what B gives. Kept.
  - Pull request rows follow the repository binding, so a project without a repository link has none. Source: `docs/protocol/cloud/viewer-read-model.md:79-80`. Kept, because only GitHub supplies pull request data, so the facts below concern the branches of such a project.
- **Options:**
  - **A.** Only catalogues whose own upload named the reference, as today. A catalogue with evidence counts on that condition. A catalogue without evidence counts on the same condition, under the rule of item 6. Effort: Small.
  - **B.** Link the first catalogue to each reference whose upload or build replays it. The validated envelope of the replay gives the branch, the pull request number and the head, so the link needs no provider read. A linked catalogue with evidence counts like an own upload. A linked catalogue without evidence counts under the rule of item 6. Push CI replays the new tip, so B misses a fast-forward only when no CI upload runs. Today a replay keeps its branch, pull request number, head and admission time only on its own failed row, at `crates/mkc-publications/src/reservation/reserve.rs:59-85` and `crates/mkc-publications/src/reservation/finish.rs:86-88`.

    Cleanup deletes that row 30 days after admission, and build retention can delete it sooner, at `docs/protocol/cloud/retention.md:21-29`. So B needs a link store of its own. A link where the build scheduler skips a published head would come from the stored tip, not from a replay. Outside option E of item 1, C has evidence in the same cases, so such a link does not widen B. It changes the pull request target rule. Effort: Medium.

  - **C.** Any ready catalogue of a commit that the order source of item 1 places on the reference. A catalogue with that evidence counts, whoever uploaded it. A catalogue without evidence counts only when its own upload named the reference, as under A. A generation number of option E of item 1 orders a reference's own uploads, but it places no other upload's commit on the reference. Register a catalogue branch host for each such branch. The tip writer `DatabaseBuildHeadRecorder` in `crates/mkc-publications/src/build_head.rs` serves webhooks, member build requests and project setup.

    So the host writer can sit beside it, with no new crate boundary. Under option C of item 1, the merge base on `main` becomes a candidate of a new branch. It changes the pull request target rule. Effort: Medium.

  - **D.** Do C, but show another upload's catalogue only when its comparison base suits the reference. A catalogue with evidence counts as under C, after the base rule. A catalogue without evidence counts only when its own upload named the reference, as under A. A pull request then never shows a current-only push catalogue in place of its own comparison. It also never gets its own comparison for that head, because its own upload replays the first row and builds skip a published head. So it keeps an older catalogue or an empty target until its head moves.

    Branches need a base rule, which the user settles before implementation. Effort: Medium.

  - **E.** Do C, and link replays as B does. A catalogue with evidence counts as under C. Without evidence, a reference can still show the catalogue that its own replay names, under the rule of item 6. Under option C of item 6, that catalogue never becomes a target, so the link adds nothing there. Under option E of item 6, the link also adds nothing in a project with live App access. So E differs from C only under options A, D, F, G and H of item 6.

    Under option E of item 1, E gives only what B gives. E holds the whole job of C and of B, with the link store of B. Effort: Large.

  - **F.** Do C, and let a reference publish its own row for a head that another reference published first. The identity key adds the branch and the pull request number, so F replaces plan-wide assumption 2. Each row keeps its own context and comparison, and the rows share the stored files. Each row stays immutable, and each exact address keeps its target. A re-run on the same reference still replays. A reference without its own upload still shows the first row through C.

    F changes the identity rule, the replay rule and the CLI receipt. The check of a head with two rows needs a rule. History lists one row for each reference, and each extra row repeats its file references. F fits every option of item 6, because its rows count as the reference's own uploads. Effort: Large.
- **Left out:**
  - Build an already published head again, to give the reference its own row. Under the current identity rule, C is better on every point. Under F, it is a conditional question, because it changes the build triggers that assumption 9 keeps.
  - Offer another reference's catalogue in the chrome, and keep A as the target rule. The address and the catalogue branch host still open older content, so this fails the goal.
  - List in the envelope the other branches that point at the head during the upload. This misses each reference that moves to the commit later, so it fails the goal.
- **Wider fix:** F. The first wider fix was C, which stops the first upload from deciding only where evidence exists. If the current identity rule of plan-wide assumption 2 stays, E is the wider fix, because it adds replays as a second source.
- **Previous examples:** The selection contract of the earlier proposal used replay associations, the method of B. Its port at `3e942033` gave projects without a repository link no replay association. Its Decision 10 covers pull request addresses of such projects.
- **Related:**
  - Item 1, work that waits for the answer. Its order source places a commit on a reference, which C to F need.
  - Item 3, work that waits for the answer. It applies under B to F, because then a branch can open a catalogue of another upload.
  - Item 6, work that waits for the answer. Under its option C, no option here gives a reference without evidence a target. Under its other options, B and E can give such a reference the catalogue that its own replay names. Option E of item 6 is an exception in a project with live App access.
  - Item 6, work that waits for the answer. While its upload order applies, and under its option H, B and E need a rank time for each replay link. "Implementation Order" holds that question.
  - Item 8, work that waits for the answer. Under B or E, a seed of replay links at deploy reaches back only to the replay rows that cleanup kept.
- **Recommendation:** C, proposed on 2026-11-20. C covers all three examples of the problem for a reference with evidence. It needs no new store and no change to the identity rule. C, D, E and F are the options for a branch whose new tip gets no upload and no build. They need an order source that places the commit on the reference. Option E of item 1 supplies none.

  E adds only replays of references without evidence, and only where item 6 lets such a catalogue become a target. F best protects the codebase, because the first upload then no longer decides the comparison or the context of another reference.

- **Action:** ask the user, because B to F change the pull request target rule at `docs/protocol/cloud/viewer-read-model.md:84-85`, F replaces plan-wide assumption 2, and no decision covers this.

### 3. A shared catalogue names the upload's branch

- **Severity:** Medium. **Effort:** Large.
- **Source:** Design.
- **Category:** Docs or spec.
- **Location:** `docs/protocol/cloud/viewer-address-state.md:22-26` and `:158-161`, `apps/app/src/screens/app/viewer-route.tsx:28-35`, `apps/app/src/screens/viewer/subject.tsx:93-98` and `apps/app/src/screens/viewer/viewer-screen.tsx:106-115`.
- **Background:** Alias resolution replaces the alias with the publication address and drops the `branch` key. The resolved address names no reference, at `apps/app/src/screens/app/viewer-route.tsx:28-35`. The chrome then names the publication's own branch, and View latest polls that branch. So after a pull request address resolves, View latest polls the head branch, not the pull request.
- **Problem:** The viewer loses the reference that the reader opened. Under options B to F of item 2, a branch can also open a catalogue that another branch uploaded. The viewer then names that other branch.
- **Impact if no action:** A reader who opens `main` gets no offer when `main` moves. The same reader gets offers for feature commits that `main` does not hold. A deleted feature branch keeps its target, so its poll offers nothing.
- **Root question:** When an address of a reference resolves to a catalogue, which reference does the viewer stay inside, for its name and for View latest? The options check widened the first question, which asked only about the name. This question also covers the pull request poll that the check found.
- **Shared assumptions:** The plan-wide assumptions, and two more. View latest polls the reference that the chrome names. Source: `apps/app/src/screens/viewer/viewer-screen.tsx:106-115`. That is not a requirement, because `docs/protocol/cloud/viewer-address-state.md:158-161` says only "its current reference", so D drops it. The opened reference can survive resolution only in the URL. Source: `docs/protocol/cloud/viewer-address-state.md:22-26`.

  That is not a requirement either, so E drops it.

- **Options:**
  - **A.** Keep the publication's own context, as today. The viewer names the upload's branch, and View latest polls that branch. Effort: Small.
  - **B.** Keep the alias address in the browser when the opened reference differs from the publication's own branch. It changes the rule that resolution replaces an alias with the publication address. It leaves an alias in the URL whose target can change. Effort: Medium.
  - **C.** Carry the opened reference on the publication address as one optional key. The chrome and View latest then follow that reference. It needs address rules and mockups. Effort: Large.
  - **D.** Name the uploading branch in the chrome, as in A. Carry the opened reference in the optional key of C, and use it for View latest only. The chrome and the offer then name different references, so D needs mockups and copy. Effort: Large.
  - **E.** Keep the opened reference in the browser history entry after resolution. The chrome and View latest follow it in that tab. A reload, a copy or a share falls back to the uploading branch. Effort: Medium.
- **Left out:**
  - Rewrite the stored branch of the shared publication. It breaks assumption 3.
  - Add a server field that lists every reference that targets the publication. The viewer still needs the opened reference to pick one, so this fails the goal alone.
- **Wider fix:** C. It stops View latest from following the upload's own branch after every resolution. The first wider fix was None, which does not hold under options B to F of item 2.
- **Previous examples:** The selection contract of the earlier proposal carried one optional `branch` or `pullRequest` key on the publication address, the method of C.
- **Related:**
  - Item 2, work that waits for the answer. Under its options B to F, a branch can also open a catalogue of another upload.
  - The UI rule under "Implementation Order" keeps Milestones 1 and 6 for every option here except A.
- **Recommendation:** C, proposed on 2026-11-20. The first recommendation was A, which leaves the View latest problem of this item in place. C keeps an exact publication address, and it keeps the chrome and View latest inside the opened reference. B is cheaper, but it leaves an alias in the URL whose target can change.
- **Action:** ask the user, because C changes the address rule at `docs/protocol/cloud/viewer-address-state.md:22-26`, and no recorded decision covers that change.

### 4. No rule before the newest commit publishes

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** Docs or spec.
- **Location:** `apps/app/src/viewer/entry.ts:193-194`, `crates/mkc-store-pg/src/viewer/branches.sql:37-43` and `docs/protocol/cloud/viewer-builds.md`, section "References Without A Ready Publication".
- **Background:** After each push, the tip has no ready catalogue for a while, and its build or upload can fail. The stage order of `viewer-builds.md` applies only when a reference has no ready catalogue at all. Its last rule says "No publications yet", at `docs/protocol/cloud/viewer-builds.md:214-219`. The switcher row already shows the newest attempt and build.
- **Problem:** Commit order needs a rule for this period.
- **Impact if no action:** The plan cannot define the target for much of the time after each push.
- **Root question:** What does a reference show while its newest commit has no ready catalogue?
- **Shared assumptions:** The plan-wide assumptions, and one more. `newestPublication` and `newestBuild` keep admission order. Source: `docs/protocol/cloud/viewer-read-model.md:67-75`. The reason holds for `newestBuild`, because builds start from stored tips. It is weaker for `newestPublication`. A late upload of an older commit becomes the newest attempt.

  The switcher row then reports a catalogue that is neither the target nor the tip. D drops this assumption.

- **Options:**
  - **A.** The newest older ready commit in the order of item 1, with the chrome as it is today. Effort: Small.
  - **B.** The exact tip only. Show the reference stage until the tip is ready, also when an older catalogue exists. B covers each reference with a stored tip that the answer to item 6 accepts. Item 6 decides each other reference. Until the tip is ready, B leaves an empty target. It needs a new stage card, because "No publications yet" is wrong while History lists ready catalogues.

    While `newestPublication` keeps admission order, the stage can also show the old failure of a late upload. Effort: Medium.

  - **C.** Do A, and add a "newer commit pending" state with the tip's short SHA and its build or failure. It needs mockups, copy and a new row field. Effort: Large.
  - **D.** Do A, and order `newestPublication` in reference rows by the order of item 1. History keeps admission order. It changes a read-model requirement and both list queries. The same row order can also extend B or C, and each such pair needs its own answer. Effort: Medium.
- **Left out:** Admission order during this period. A late older upload can still take the target, so it fails the goal.
- **Wider fix:** None. This is a product choice, not a class of defect.
- **Previous examples:** Decision 3 of the earlier proposal preferred option A, the nearest ancestor with a pending state, over the exact head only. Its reason was "A keeps useful content visible".
- **Related:**
  - Item 1, work that waits for the answer. Under its option A, options A, C and D here need a stored last target.
  - Item 6, work that waits for the answer. Item 6 decides each reference that has no stored tip, or whose stored tip it does not accept. Examples are a project without a repository link and a deleted branch. Under D, E and G of item 6, a stored tip counts only with the App access that item 6 settles. Under A, C, F and H, every stored tip counts. B with C of item 6 takes no target from upload order.
  - Item 6, options that conflict. Take a reference that has a stored tip while another of its catalogues has no evidence. B shows the stage, but option A of item 6 uses upload order. If B wins, an upload that arrives during a gap stays hidden until the stored tip names its commit. If A wins, B has almost no effect under option A, B or E of item 1. The fallback of A can then stay in force permanently.

    Option H of item 6 joins the same pair. "Implementation Order" holds both pairs as open questions.

  - Item 5, options that conflict. Option A of item 5 keeps the last target until the new tip publishes, but B shows the stage in that period. Item 5 applies this rule after a reset.
  - Item 8, work that waits for the answer. B reads the stored tip, which exists at deploy without a seed. So under B, a reference whose stored tip has no ready catalogue can show its stage at deploy, under every rollout.
  - The UI rule under "Implementation Order" keeps the stage card of B in Milestones 1 and 6.
- **Recommendation:** A, proposed on 2026-11-20. It keeps the reading experience of today and needs no mockup. Under option A of item 1, it needs a stored last target. C is the option that tells the reader that newer work exists.
- **Action:** ask the user, because the options trade an honest state against interface cost, and no option is clearly best.

### 5. No rule for resets and recreated branches

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** Docs or spec.
- **Location:** `crates/mkc-store-pg/src/github_refs.rs:45-56` and `apps/app/src/viewer/latest.ts:21-29`.
- **Background:** A force push, a rebase or a reset moves a reference to a commit that does not descend from its target. The stored tip follows such moves both ways, because its guard compares observation times, not ancestry. A deleted branch keeps a row with no tip, and a recreated branch reuses the name. View latest already offers any changed target, also an older one.
- **Problem:** The order must say what happens to catalogues of commits that the reference no longer holds.
- **Impact if no action:** A rebased pull request, a reset branch or a recreated branch can keep opening content that its history no longer holds.
- **Root question:** When a reference rewrites its history or comes back under the same name, which catalogue does it show?
- **Shared assumptions:** The plan-wide assumptions, and two more. The stored tip is the only record of what a reference holds now. Source: `crates/mkc-store-pg/src/github_refs.rs:45-56`. A deletion does not end a branch's order. Source: the text of option A. Assumption 10 covers a branch only while it stays deleted, so D drops this assumption.

  Assumption 1 keeps every catalogue reachable by its exact address.

- **Options:**
  - **A.** Follow moves to published commits. Until the new tip publishes, keep the last target, also when the reference no longer holds that commit. It needs no ancestry. Under option C of item 1, it conflicts with the rule that selects the nearest ancestor. Effort: Small.
  - **B.** Follow every move, and drop the commits that the reference no longer holds. It needs option C of item 1, or option D of item 1 with a compare read. A push payload does not list the commits that a forced push dropped. After a rebase, B can leave an empty target until the new tip publishes. So B needs the stage card for an empty target, with its mockup. Effort: Medium.
  - **C.** Forward only. A member resets the target by hand. It needs ancestry, a new action and mockups. Effort: Large.
  - **D.** Do A, and end the order at a deletion. A recreated branch ranks only commits observed after it was created again. It shows its stage until one of them publishes. Item 1 must keep the deletion time. Effort: Medium.
  - **E.** Do A, and end the order at a forced push. Store the `forced` flag of each push event, and drop the ranks of the commits before it. It covers branches only, and a lost delivery loses the flag. The options check found no `forced` flag on pull request events, but it did not confirm that with GitHub. After an amended commit, the branch shows no target until its new tip publishes. Effort: Medium.
- **Left out:** Ignore moves and keep admission order. It fails the goal.
- **Wider fix:** None. This is a product choice.
- **Previous examples:** Decision 5 of the earlier proposal preferred option A, which follows both directions and excludes removed commits, over descendants only with a reset action.
- **Related:**
  - Item 1, work that waits for the answer. It sets which options here are possible. B needs its option C, or its option D with a compare read.
  - Item 4, options that conflict. Option A here keeps the last target until the new tip publishes, but option B of item 4 shows the stage in that period. "Implementation Order" holds this pair as an open question.
  - Item 4, the same code. Its stage card for an empty target also serves B, D and E here. Each of them needs that card and its mockup.
- **Recommendation:** A, proposed on 2026-11-20. With option B of item 1, it follows the common reset to a published commit. D is a cheap addition if a recreated branch must not show the old branch's content. B is the complete rule, and it needs option C of item 1.
- **Action:** ask the user, because the best option depends on the open answer to item 1.

### 6. No rule when commit order is unknown

- **Severity:** Medium. **Effort:** Large.
- **Source:** Design.
- **Category:** Docs or spec.
- **Location:** `crates/mkc-store-pg/src/viewer/branches.sql:5-11`, `crates/mkc-store-pg/src/viewer/pull_requests.sql:11-13`, `crates/mkc-api/src/github_worker/prepare.rs:87-125` and `crates/mkc-db/migrations/202609161530_github_app/up.sql:1-25`.
- **Background:** A project without a repository link has no stored tips. A repository link stays stored after the installation disconnects, so a project can have a link without live App access. The worker records tips while the installation and the repository are active, also without a workspace connection. GitHub can fail or limit requests, a delivery can be lost, and an upload can arrive before its push is recorded. The build access rule in `crates/mkc-publications/src/build_eligibility.rs:27-60` also needs the build configuration, so no option here reuses it whole.
- **Problem:** Every order source has gaps. When a gap ends, a target can move back to older content.
- **Impact if no action:** The targets of projects without live App access, and the targets during and after outages, stay undefined.
- **Root question:** What does a reference show while the cloud cannot place a catalogue in commit order, and after it can again? The options check widened the first question, because no option covered the end of a gap.
- **Shared assumptions:** The plan-wide assumptions, and three more.
  - A gap stays open until the next webhook, member build request or project setup. Source: `crates/mkc-api/src/github_worker/prepare.rs:172-205` and `crates/mkc-api/src/builds/scheduling.rs`. It is not a requirement, so D drops it.
  - A catalogue without evidence is one class for the whole reference or project. Source: the text of option A. Its reason is simplicity, so H drops it.
  - Evidence from before lost access counts again when access returns. Source: the stored tips that stay after a disconnect, as `docs/protocol/cloud/viewer-read-model.md:50-51` requires. A, C, E and F accept it. G and D need new state to drop it. H keeps it, but ranks the uploads of the gap above old evidence.
  - Assumption 8 keeps projects without a repository link on the CLI.
- **Options:**
  - **A.** Upload order for the reference while any catalogue has no evidence. The defect comes back during gaps. Ready catalogues do not expire. So a catalogue that never gets evidence can keep upload order in force for its reference permanently. These catalogues never get evidence:
    - Under option A of item 1, each older catalogue, because the order holds only the current tip.
    - Under option B of item 1, each catalogue of a commit that the worker never stored as the tip. Also each existing catalogue that the seed of item 8 does not cover.
    - Under option E of item 1, each catalogue from an older CLI, which sends no generation number. Also each catalogue from before the release.

    Under option C, D or F of item 1, a later read can place many such catalogues, and the target then follows commit order again. A later read cannot place a merge-commit upload, because its commit is never on the reference. It also cannot place a commit that GitHub no longer holds. So A can keep upload order permanently under every order source. The options check did not confirm these GitHub answers. Effort: Small.

  - **B.** Withdrawn on 2026-11-20 by the options check. B put evidence first, and it also sent projects that lost App access to upload order. Those rules conflict, because such a project keeps its stored tips as evidence. When access returns, old evidence counts again, and a target can move back. F and G replace B, and its letter stays as history.
  - **C.** Evidence only. A catalogue without evidence never becomes a target. Projects without a repository link lose their targets, so each of their references with ready catalogues has an empty target. A project that loses App access keeps the targets that its old evidence gives. Its new uploads never become targets until access returns. When evidence returns, each catalogue becomes a candidate once it has evidence.

    Effort: Small.

  - **D.** Do G, and add a repair read. When a catalogue becomes ready without evidence in a project with live App access, a worker reads the tip through the App. It records the tip as evidence. The read needs App access, so D extends G. Under option B of item 1, the read gives evidence only when the catalogue's commit is still the tip. A merge-commit upload, or a commit that was the tip only between two observations, stays without evidence.

    The same read also fits A, E, F and H, and each such pair needs its own answer. It adds one GitHub read for each such catalogue, and it holds the whole job of G. Effort: Large.

  - **E.** Evidence only with live App access. In a project with live App access, a catalogue without evidence never becomes a target. In such a project, a reference whose catalogues all lack evidence has an empty target. Every other project uses upload order, also a project whose stored tips stay current without a workspace connection. A pull request whose CI publishes only merge commits never gets a target. When access returns, the target moves to the newest catalogue with evidence, which can be older than the uploads of the gap.

    Effort: Small.

  - **F.** Evidence first, also after lost access. A catalogue without evidence never replaces a target with evidence, also after the project loses App access. References with no evidence at all use upload order. A project that removes the App and keeps publishing through the CLI never moves those targets. When access returns, new observations move them again. Effort: Small.
  - **G.** Evidence first with live App access only. In a project with live App access, a catalogue without evidence never replaces a target with evidence. Every other project uses upload order, as today. When access returns, each reference keeps upload order until it gets a new observation. The selection rule must read the access state. The installation and repository rows keep only flags and an installation update time, at `crates/mkc-db/migrations/202609161530_github_app/up.sql:1-25`.

    So G cannot tell old evidence from new evidence when access returns. Without new state, old evidence counts again, and a target moves back, as under the withdrawn B. The new state needs a migration and a writer wherever access changes. G also sends a project whose tips stay current without a workspace connection to upload order. Effort: Large.

  - **H.** Admission time ranks a catalogue without evidence. Under option B of item 1, such a catalogue takes its admission time as its rank, on the time line of the observations. No reference switches to upload order as a whole, and the rule reads no access state. A project that loses access keeps fresh targets, because its new uploads rank above its old evidence. When access returns, new observations rank above the uploads of the gap, so no target moves back. A late upload of a commit that was never observed ranks above each catalogue observed before it, also the current tip's catalogue.

    It keeps that place until a commit observed after it has a catalogue. Under option A of item 8, an older catalogue admitted after the seeded tip's observation outranks the tip at deploy. H fits only option B of item 1, because the other order sources give no time line. Effort: Small.
- **Left out:**
  - Reject uploads without evidence. Projects without a repository link could not publish, which breaks assumption 8.
  - Use upload order for a catalogue without evidence only for a fixed period. When the period ends, a target can move back with no new event, so this fails the goal.
- **Wider fix:** None. Option E of item 1 gives evidence only to uploads from a new Mokly release with full history.
- **Previous examples:** Decision 2 of the earlier proposal preferred option B, admission order until GitHub answers, over holding the last verified target or rejecting uploads without proof. Its Decision 7, option B, used commit order only with App access.
- **Related:**
  - Item 1, work that waits for the answer. Option A here can keep upload order permanently under every order source. Under options A, B and E of item 1, more catalogues stay without evidence. H here fits only option B of item 1.
  - Item 2, work that waits for the answer. Under option C here, no option of item 2 gives a reference without evidence a target. Under the other options here, B and E of item 2 can give such a reference the catalogue that its own replay names. Option E here is an exception in a project with live App access. Under H, their replay links need a place on its time line.
  - Item 4, options that conflict. Option B of item 4 shows the stage while a stored tip has no catalogue. Options A and H here can rank another catalogue first. "Implementation Order" holds both pairs as open questions.
  - Item 8, work that waits for the answer. Options C and E here remove at deploy the target of each reference that has no ready catalogue with evidence. Option A here can keep upload order after every rollout. H here with option E of item 8 keeps today's targets at deploy, but with option A it can move a target back.
- **Recommendation:** G, proposed on 2026-11-20. The first recommendation was B, which the options check withdrew. G keeps evidence first in each project with live App access, under every order source, and it keeps the rule of today everywhere else. With the access-return state that it needs, its effort is Large. Under option B of item 1, H is cheaper if the user accepts its risk for commits that were never observed. D adds the repair read to G.
- **Action:** ask the user, because the options trade fresh targets against safe targets, and no option is clearly best.

### 7. No home for the target under concurrency

- **Severity:** Medium. **Effort:** Small.
- **Source:** Design.
- **Category:** Code structure.
- **Location:** `crates/mkc-store-pg/src/viewer/branches.sql:28-48` and `docs/protocol/cloud/persistence-publication-storage.md:32-44`.
- **Background:** Today three places compute the target, and nothing stores it: `crates/mkc-store-pg/src/publication.rs:139-156`, `crates/mkc-store-pg/src/viewer/branches.sql:33-35` and `crates/mkc-store-pg/src/viewer/pull_requests.sql:8-10`. Ready completion, tip observation and project deletion change its inputs in separate transactions. No production code calls `expire_publication`, so expiry is not a live writer. The lock order covers workspaces, projects, builds, publications and blobs.
- **Problem:** A stored target must stay right when writers run at the same time. A computed target must stay cheap in paged lists.
- **Impact if no action:** The plan cannot define the lock order, the race tests or the cost of a read.
- **Root question:** How does every consumer read one current target that concurrent writes cannot make wrong, with one statement for each list page? The options check replaced the first question, because option A keeps no stored target.
- **Shared assumptions:** The plan-wide assumptions, and one more. Each list page stays one statement with no query for each row. Source: the code, at `crates/mkc-store-pg/src/viewer/newest_publication.rs:1-5`.
- **Options:**
  - **A.** Compute the target at read time from stored evidence. It adds no state with option B of item 1. Option A of item 1, with option A, C or D of item 4, still needs a stored last target. It works only when the evidence of item 1 is already in the database. Effort: Small.
  - **B.** Store one target row for each reference, and update it in every writer under a longer lock order. Effort: Large.
  - **C.** Store the target, and refresh it from a worker that fences each result with a generation. Effort: Large.
  - **D.** Triggers on the publication and evidence tables keep a stored target. Each writer updates it in its own transaction. The triggers must follow the lock order, and the service code does not show the rule. Effort: Large.
- **Left out:**
  - Compute the target in the app. The catalogue branch host would need a second rule, so A is better on every point.
  - Read the target of each row with its own query. A is better on every point.
  - Keep a materialized view. Postgres refreshes the whole view, so it is a slower form of C, and C is better on every point.
- **Wider fix:** A, but only when one shared SQL definition replaces the three copies. One rule then serves every consumer and cannot go stale.
- **Previous examples:** The earlier proposal stored one projection for each reference, with generations and a refresh worker.
- **Related:**
  - Item 1, work that waits for the answer. Its options C, D and F need a worker for their evidence. A here can still compute the target from that evidence.
  - Item 4, work that waits for the answer. Under option A of item 1, options A, C and D of item 4 need a stored last target. That is state that A here does not have.
- **Recommendation:** A, proposed on 2026-11-20. With option B of item 1, it adds no lock and no state that can go stale. Option A of item 1 with option A, C or D of item 4 still needs a stored last target.
- **Action:** ask the user, because the user asked that every design choice of this plan stays open.

### 8. Existing catalogues have no order evidence

- **Severity:** Low. **Effort:** Small.
- **Source:** Design.
- **Category:** Process.
- **Location:** `crates/mkc-db/migrations/202609161530_github_app/up.sql:74-94` and `docs/protocol/cloud/persistence-transactions.md:81-82`.
- **Background:** At deploy, existing catalogues have no evidence. The database holds only the newest stored tip of each reference, and a lost delivery or a disconnection can leave it stale. A rollback to the earlier application restores upload order and its ordering defect. It keeps the new data only while the migrations only add schema and keep `publications_project_branch`. A seed of replay links can read only the replay rows that cleanup kept, which are at most 30 days old.
- **Problem:** The plan needs a rule for the switch at deploy.
- **Impact if no action:** Targets can change at deploy in ways that nobody checked.
- **Root question:** How do existing references move to commit order?
- **Shared assumptions:** The plan-wide assumptions, and two more. A rollback restores upload order. Source: the code of the earlier release. It holds only while the migrations only add schema and keep `publications_project_branch`. Stored tips are current at deploy. Source: the text of option A.

  A lost delivery or a disconnection can leave a tip stale, so E drops this assumption.

- **Options:**
  - **A.** Switch at deploy. Seed the evidence from the stored tips, and apply item 6 to the rest. A stale stored tip can move a target back to older content at deploy. It seeds only options A and B of item 1. Effort: Small.
  - **B.** Add a one-time job that reads each reference with live App access from GitHub before the switch. Option C of item 1 needs this option. Effort: Medium.
  - **C.** Seed as A, compute the new target beside the old one, compare them for a period, and switch later. Effort: Medium.
  - **D.** Seed from the kept webhook bodies. The cloud keeps terminal deliveries for 30 days, at `docs/protocol/cloud/persistence-transactions.md:81-82`. Each push gives its `after` commit and its receipt time. D trusts payload heads, which the build path does not trust today. Effort: Medium.
  - **E.** Switch with no seed. Item 6 applies to every existing catalogue. The Related line gives its effects at deploy. Effort: Small.
  - **F.** Do A behind a runtime switch for each project or deployment. The team can switch back without a deploy. Every consumer must honour the switch. Effort: Medium.
- **Left out:** None.
- **Wider fix:** None. This is a one-time rollout.
- **Previous examples:** Commit `d09ab4b3` of the earlier proposal removed a shadow selector, a feature flag and a bulk backfill.
- **Related:**
  - Item 6, work that waits for the answer. Some answers never let a catalogue without evidence become a target. At deploy, such an answer removes the target of each reference that has no ready catalogue with evidence. Today these answers are C, for every project, and E, for projects with live App access.
  - Item 6, work that waits for the answer. One answer keeps upload order while any catalogue has no evidence. Today this is A. Under option A, B or E of item 1, it keeps upload order after every rollout. This holds for each reference that keeps an existing catalogue without evidence.
  - Item 1, work that waits for the answer. An answer that selects by the stored tip, today A, can move targets at deploy under every rollout. A stale stored tip can move a target back to older content.
  - Item 4, work that waits for the answer. An answer that shows only the exact tip, today B, reads the stored tip. So under every rollout, a reference whose stored tip has no ready catalogue can show its stage at deploy.
  - Item 6, work that waits for the answer. Under option H of item 6, E here keeps today's targets at deploy. A here can then move a target back at deploy.
  - Item 2, work that waits for the answer. Under option B or E of item 2, a seed links only the replays whose rows cleanup kept. No rollout restores older replay history.
- **Recommendation:** A, proposed on 2026-11-20. It needs no new GitHub read, and it seeds options A and B of item 1. A stale stored tip can still move a target back at deploy, and a rollback restores the ordering defect. Option C of item 1 needs option B here.
- **Action:** ask the user, because the user asked that every design choice of this plan stays open.

## Implementation Order

Implementation starts only after the user answers items 1 to 8 and approves this plan. No implementation begins until the user also answers each conditional question and each conflicting combination below.

Conditional questions, each for a chosen option:

- Under option E of item 1, how envelope 4 relates to envelope 3, and for how long.
- Under option F of item 1, the retention rule for the commit data of private repositories.
- Under option B or E of item 2, which time ranks a replay link while upload order or option H of item 6 applies. Each answer has a cost:
  - The time of the latest replay lets a re-run of an old job move a target back. Today a replay never moves a target.
  - The time of the first upload can rank a fast-forward below the reference's own newer upload.
  - The time of the reference's first replay of that head, kept on later replays, ranks the link as if the reference had uploaded first.
- Under option B or E of item 2, the retain-or-delete rule of the replay link. `docs/protocol/cloud/retention.md:54-56` requires one for each new relationship to a publication.
- Under option D of item 2, the base rule for branches.
- Under option F of item 2, whether a build may publish a head that another reference published. Also under F, which row the check of a head with two rows names. The build question changes the build triggers that assumption 9 keeps.
- Under option A of item 6, whether an answer that puts a commit off the reference counts as evidence. If it counts, the permanent fallback ends for merge-commit uploads under option C, D or F of item 1.
- Under option G or D of item 6, which state stops old evidence from counting when access returns. It can be a stored time when access began, or a mark on the evidence when access ends.
- Under option D, E or G of item 6, whether access means "Live App access", or only an active installation and repository. Either answer leaves out the build configuration of the build access rule.
- Under option F of item 8, whether the switch covers each project or the whole deployment.

Conflicting combinations, each for a chosen pair:

- Under option B of item 4 and option A of item 6, which rule wins while a reference has a stored tip.
- Under option B of item 4 and option H of item 6, which rule wins while a reference has a stored tip.
- Under option B of item 4 and option A of item 5, which rule wins until the new tip publishes after a reset.
- Each other pair that a Related line names as options that conflict.

UI rule: keep Milestones 1 and 6 when the answers change a reader state, navigation, the chrome or the reference context. Otherwise delete both. The agent that updates this plan judges each answer against this rule. These known examples are not a complete list:

- Any option of item 3 except A changes the chrome or the reference context.
- Option B or C of item 4 changes the stage or the chrome.
- Option C of item 5 adds an action.
- An answer that can leave an empty target needs a stage card. "No publications yet" is wrong while History lists ready catalogues. Its known causes are option B of item 4 and options B, D and E of item 5. Options C and E of item 6 are causes too, also at deploy.

Then update each milestone to the answers, and delete each conditional milestone that the answers make empty. Renumber the remaining milestones and their Depends on lines. No check of the milestones below runs in the plan-only change.

## Milestone 1: Mockups

Tags: mockup

Depends on: none

Keep this milestone under the UI rule of "Implementation Order". Otherwise delete it, and Milestone 2 runs first.

- [ ] Read the `mockups` and `product-ui` skills.
- [ ] Draw each state that the answers add, for members and public readers, on desktop and mobile, in both schemes.
- [ ] Draw the stage card for each empty target that the answers can leave.
- [ ] Run the mockup check that `docs/mockups/README.md` gives, and smoke-test the changed pages.
- [ ] Update the design and the TODOs of this plan for each problem that the mockups show.

## Milestone 2: Documentation And Protocol

Depends on: 1, or none when Milestone 1 is deleted

Write the chosen requirements before any code changes.

- [ ] Replace the admission-order rule with the answers to items 1, 2, 4, 5, 6 and 8. The rule is at `docs/protocol/cloud/viewer-read-model.md:56-75`, `catalogue-hosting.md:55-60`, `viewer-address-state.md:13-18`, and `product-navigation.md:39-41` and `:180-184`.
- [ ] Change the pull request target rule at `viewer-read-model.md:84-85` only under options B to F of item 2. Under option D, also state the base rule.
- [ ] Under options B to F of item 2, name the writer of the new branch hosts. It can sit beside `DatabaseBuildHeadRecorder` in `mkc-publications`.
- [ ] Under option B or E of item 2, state the replay link, its rank time and its retention rule. The retention rule goes in `retention.md`.
- [ ] Under option F of item 2, change the identity and replay rules of `publication-upload.md` and `publication-ingest.md`. Also state the receipt and the check rule for a head with two rows.
- [ ] Under option D, E or G of item 6, state the access rule that the user settles. Under G or D, also state the access-return state.
- [ ] Under any option of item 3 except A, change the address rule at `viewer-address-state.md:22-26` and the poll rule at `:158-161`.
- [ ] Under option D of item 4, change the newest-attempt rule at `viewer-read-model.md:67-75`.
- [ ] Change the stage order of `viewer-builds.md` for each empty target that the answers can leave.
- [ ] Update `github-app.md` when an answer adds a GitHub read or a stored event field. Update `publication-upload.md` and the Mokly publish contract under option E of item 1.
- [ ] Under option F of item 1, update `retention.md` with the retention rule that the user settles.
- [ ] Update `persistence-publication-storage.md` when item 7 changes the lock order. Update `docs/architecture/cloud-data-flows.md:20`, and `docs/architecture/cloud.md` when an answer adds a component or a worker.
- [ ] Under option F of item 8, state the switch and its scope.
- [ ] Keep History order, each row's immutable context, and exact addresses under their current requirements.
- [ ] Keep each touched protocol doc within its line cap, and split a doc that passes it.
- [ ] Run `npm run format:check` and `npm test -- tests/markdown_links.test.ts`.

## Milestone 3: Order Evidence

Depends on: 2

Store the evidence that the answers need, and seed it as item 8 says. Nothing reads it yet. Delete this milestone when the answers need no new stored data.

- [ ] Read the `rust`, `databases`, `shared-types` and `testing` skills.
- [ ] Add the evidence of the chosen option of item 1, with reversible migrations and lock entries:
  - [ ] Option A: the stored last target that item 4 needs.
  - [ ] Option B: each stored tip with its observation time, written in the transaction that saves the tip.
  - [ ] Option C: the compare operation in `mkc-github-interface` and `mkc-github`, the stored answers and the refresh path.
  - [ ] Option D: the stored event fields, the repair read and the compare read for dropped commits.
  - [ ] Option E: plan this TODO only after the user settles how envelope 4 relates to envelope 3.
  - [ ] Option F: the commit fetch worker, its storage and its Git dependency, under the settled retention rule.
- [ ] Under option B or E of item 2, store each replay link from validated upload metadata, with no provider read. The link store must outlive the replay row.
- [ ] Under option F of item 2, migrate the ready identity index and key to add the reference. The reference is the branch and the pull request number.
- [ ] Under option G or D of item 6, add the access-return state with a migration. Add a writer wherever access changes.
- [ ] Under option D of item 5, keep the deletion time of each branch.
- [ ] Under option E of item 5, store the `forced` flag of each push event.
- [ ] Under option D of item 6, add the repair read for catalogues that become ready without evidence.
- [ ] Prepare the cutover evidence of item 8. Under its option B, add the one-time job. Under its option D, read the kept webhook bodies. Keep the old selection until Milestone 5 moves its consumers.
- [ ] Under option B or E of item 2, seed links only from the replay rows that cleanup kept.
- [ ] Test each evidence write once, at the lowest level that fails without it.
- [ ] Prove each migration up, down and up once. Save the output under `.context/commit-ordered-catalogue/`.
- [ ] Update the README of each changed crate.

## Milestone 4: Selection Rule

Depends on: 3, or 2 when Milestone 3 is deleted

Add the one selection rule that the answers define, in the home that item 7 gives. The consumers still use the old selection.

- [ ] Write the failing tests first for each case under "Cases The Decisions Settle". Put each test at the lowest level that fails without the rule.
- [ ] Implement the rule with the answers to items 2, 4, 5 and 6, and the winner of each conflicting combination.
- [ ] Under option A of item 7, define the rule once in SQL for all three current copies.
- [ ] Under option D of item 2, apply the base rule. Under option B or E of item 2, rank replay links by the settled time.
- [ ] Under option D, E or G of item 6, read the settled access state. Under G or D, also read the access-return state.
- [ ] Under option H of item 6, rank each catalogue without evidence by its admission time.
- [ ] Keep failed, unfinished and expired attempts out of every target.
- [ ] Run `cargo test -p mkc-store-pg` and `cargo test -p mkc-publications`.

## Milestone 5: Consumers Of The Target

Depends on: 4

Move each consumer under "Replaced ways" to the rule. No consumer keeps the admission-order target rule.

- [ ] Write the failing test first. A late upload of an older commit must not replace a newer target in the rows or at the catalogue branch host.
- [ ] Move `latestPublicationId` at `branches.sql:33-35` and `pull_requests.sql:8-10`, and move their tests with every assertion.
- [ ] Under option D of item 4, move the newest-attempt order at `branches.sql:37-43` and `pull_requests.sql:14-20`.
- [ ] Move `branch_alias` and the catalogue branch host to the rule.
- [ ] Under options B to F of item 2, register hosts for branches that show another upload's catalogue. Use the writer that Milestone 2 names.
- [ ] Under option F of item 2, move its consumers under "Replaced ways" to the new key. They are the identity query, both replays, the receipt and the head check.
- [ ] Under option F of item 2, keep today's build duplicate check unless the user answers its build question.
- [ ] Move the default-branch choice at `branches.sql:5-11` when item 6 orders projects with no known default branch.
- [ ] Replace the admission-order rule of `latest_publication`. Remove the method, its trait method and its mocks only when the chosen design leaves them unused.
- [ ] Move each test of the old rule to the new rule with every assertion. Remove a test instead only under the removal rule of the `testing` skill.
- [ ] Drop `publications_project_branch` in a forward migration only when the chosen design leaves it unused. Keep each index that History needs.
- [ ] Under option F of item 8, make every consumer honour the switch.
- [ ] Run `cargo xtask openapi` and its check when a row field changes.
- [ ] Make sure that the app readers under "Replaced ways" follow the new target with no change.
- [ ] Update the README text under "Replaced ways", and `docs/api/README.md` when a field changes.

## Milestone 6: Viewer

Tags: ui

Depends on: 1 and 5, or 5 when Milestone 1 is deleted

Keep this milestone under the UI rule of "Implementation Order". Build the states that Milestone 1 draws.

- [ ] Read the `product-ui` and `typescript` skills.
- [ ] Build the changed states under the UI rules of `AGENTS.md` and `apps/app/README.md`.
- [ ] Build the stage card for each empty target that the answers can leave.
- [ ] Under any option of item 3 except A, keep View latest inside the opened reference. This also holds after a pull request address resolves.
- [ ] Keep exact addresses, and keep View latest as an offer only.
- [ ] Check parity with the drawings, keyboard focus and mobile widths.
- [ ] Update `apps/app/README.md`.

## Milestone 7: Verification, Commit, Review, And Pull Request

Depends on: every other milestone

- [ ] Run the early check, `cargo xtask check --suite repository`.
- [ ] Run the targeted tests. Run each new asynchronous or browser test 10 times, and record the pass count under `.context/commit-ordered-catalogue/`.
- [ ] Run a local smoke check with the interactive local procedure of `docs/ops/publish-smoke.md`. Publish two catalogues of one branch in reverse commit order. Then check that the rows, the catalogue branch host and View latest show one target.
- [ ] Run the complete gate, `cargo xtask check`.
- [ ] Commit with Conventional Commits and push the branch.
- [ ] Review the complete local diff against `origin/main` with the `implementation-review` skill after the push. Report the findings. Then fix the `fix now` findings, and record follow-up items under `plans/follow-ups/` for the rest. Re-review once, and report.
- [ ] Delete this plan when the `plans` skill says, under "Deleting the plan". The implementation pull request is the last pull request of this work.
- [ ] Open the implementation pull request. Its description gives the decisions with their dates, a permalink to this plan, and the follow-up items that the change adds.

## Post-merge follow-up (non-blocking)

- [ ] After deployment, use a test repository with the live App installed. Reverse the completion order of two CI uploads. Then force-push and reset a branch. Make sure that the rows, the catalogue branch host and View latest show one target.
- [ ] After deployment, make sure that a project without a repository link follows the answer to item 6.
