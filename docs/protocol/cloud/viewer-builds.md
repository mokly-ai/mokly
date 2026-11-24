# Viewer Builds

How the viewer shows [cloud builds](./cloud-builds.md): the build route, the
build card in the stage, references that have a build but no ready
publication, builds in history and the switcher, and the Automatic builds
setting. The chrome, slots and overlays are the [Viewer](./viewer.md)'s; the
reads are the [build API](./cloud-build-api.md)'s. Builds are shown only to
readers with member access.
The archived
[cloud builds plan](https://github.com/mokly-ai/mokly-cloud/blob/06320e4f484905567fa9e06bea1a87350b59abb3/plans/cloud-builds.md)
records the implementation.
The [navigation contract](./viewer-build-navigation.md) owns the build route,
requests, history, switcher, setting and mockup verification.

The project read does not name the reader's role, so the application treats a
reader as having member access when the project reports `canRequestBuilds` or
`canAdmin`, or when the session's `workspaceIds` names the project's
workspace. A reviewer with only a direct project grant is the one member
this cannot see; that reader gets the cards of a reader without member access.

## Build Card

The card titles the build's state, names its reference with the branch or pull
request glyph and the short head SHA, and shows the three steps — Check out,
Install, Publish — and the output. It offers at most one action. A pull
request's build reads _this pull request_ wherever the table reads _this
branch_.

| Build state             | Title                            | Line beneath the title | Action                                |
| ----------------------- | -------------------------------- | ---------------------- | ------------------------------------- |
| `queued`                | Publishing this branch           | Waiting to start.      | Cancel                                |
| `running`               | Publishing this branch           | None                   | Cancel                                |
| `published`             | Published this branch            | None                   | Open catalogue                        |
| `failed` or `timed-out` | Unable to publish this branch    | The cause's sentence   | Try again                             |
| `superseded`            | A newer push replaced this build | None                   | Open the newer build (`supersededBy`) |
| `cancelled`             | Publishing was cancelled         | None                   | Try again                             |

Cancel is a secondary action, because a running build moves forward on its
own; every other action is the card's one primary. A failed or timed-out card
announces only its title and line as an alert. The reference, action and any
request refusal stay outside that alert.

Each step reads its state beside a status dot. The steps before the build's
`step` are Done. That step is Running while the build runs, Failed for a
failed or timed-out build and Stopped for a superseded or cancelled one, and
it is the current step. Later steps are Waiting while the build is running
and Not run once it ends. A queued build's steps all wait, because no step
runs until a worker claims it, a published build's are all Done, and when no
step ran (`step` is null) a finished build's steps are all Not run.

Each failure cause chooses one sentence, in the reader's terms; step names,
commands and exit codes stay in the output and the check:

| Cause                       | Sentence                                                              |
| --------------------------- | --------------------------------------------------------------------- |
| `exit` at install           | Installing dependencies failed.                                       |
| `exit` at publish           | The catalogue couldn’t be built.                                      |
| `upload-rejected`           | Mokly couldn’t accept this catalogue.                                 |
| `unsupported-lockfile`      | Mokly installs with npm, pnpm or Yarn.                                |
| `unsupported-mokly-version` | Update `@mokly/mokly` to 0.18.0 or later to publish.                  |
| `uncommitted-changes`       | The build left files that Git doesn’t ignore; add them to .gitignore. |
| `output-limit`              | The build printed too much output; print less to publish.             |
| `deadline`                  | The build stopped at its 15-minute limit.                             |
| `idle`                      | The build stopped after going quiet.                                  |
| `infrastructure`            | Mokly couldn’t run this build.                                        |
| `repository-unavailable`    | Mokly can’t reach this repository; check the GitHub installation.     |

The application's copy test reads this table. The check summary and the
catalogue's build fixtures use the same `output-limit` sentence, which names
the [stream failure limit](./cloud-build-runner.md#budgets), not the retained
output shown below. The `unsupported-mokly-version` sentence names the
runner's minimum CLI version. No cause reports stale generated files, because
Mokly writes no generated output into the repository.

`plan-required` titles the card with the Team card's copy of
[Billing](./billing.md), **Publishing to private projects is on Team**. An
owner's action is Open billing in place of Try again; everyone else reads
“Ask an owner to upgrade to Team.” as the line, with no action.
`product/viewer/standalone/build/failed/plan` draws the owner's card, and the
`plan` and `plan-loading` variants of `product/viewer/standalone/build/reader`
draw the card for everyone else and the card while the workspace read runs.
Both this card and the empty stage use the
[workspace-role rule](./viewer-chrome.md#workspace-role) before choosing
owner or non-owner copy: while the workspace read runs the card offers no
action and no line, and draws the owner's action as a placeholder, as the
[Wait](./folio-chrome.md#compositions) composition defines. A read that
failed for another reason than `not-found`
replaces the card with that read's **This workspace couldn’t load** and its
Try again, which `product/viewer/standalone/workspace-unreadable` draws.
`unsupported-lockfile` offers Publish from CI as a link to the CI setup guide
in place of Try again.
`uncommitted-changes` offers Try again.

Cancel shows while `canCancel` is true; the build it answers with replaces
the card at once. A queued or running build read by someone who may not cancel
it, such as a reviewer, offers no action, and a queued one still reads
“Waiting to start.”, as `product/viewer/standalone/build/reader/queued` draws;
a running one has no line, as `product/viewer/standalone/build/reader/running`
draws.
After Cancel succeeds, focus moves to the card title and a polite status
announces the new title, because the control the reader pressed is gone.
The title uses the [focus contract](./design-tokens.md#radius-elevation-and-focus):
it is a focus target out of the tab order, and the shared rule draws its
keyboard outline. After Cancel from a pointer the title has focus without an
outline. The polite status reads the title the card shows, so the two never
disagree.
Try again shows while the project's `canRequestBuilds` is
true and requests a build for the same reference (its branch, or its pull
request); the card then follows the new build's route. A finished build read by
someone the project does not let request builds offers no action, as
`product/viewer/standalone/build/reader` draws.
`build-already-active` opens that build, `build-already-published` opens
that publication, and any other refusal is reported beside the control through
the write-failure fragment of [Folio chrome](./folio-chrome.md#compositions).
`builds-unavailable` reads “This project publishes from CI.”
`build-ineligible` chooses its sentence by the typed `cause`:
`fork-pull-request` reads the [fork card](#reference-cards)'s
title as a sentence, “This pull request is from a fork.”; `closed-pull-request`
reads “This pull request is closed.” A cause the application does not know
reads the API's own message. Refusals add no CI guide.
`product/viewer/standalone/build/refused` draws the closed pull request's
refusal; a fork's refusal has the same body with its own sentence, so it has no
drawing of its own.
Each of these refusals keeps the control's own label, because the same request
would be refused again. A refusal the same request could get past, such as
Mokly being busy, follows the write-failure fragment's label rule, subject to
the Cancel exception below.
While a build request runs, Try again and Publish this branch read Publishing….

A refused or failed Cancel shows its cause above the control through the
write-failure fragment. The control keeps Cancel, with Cancelling… while it
runs, because Try again on a build card requests a new build. This is the
fragment's [named Cancel exception](./folio-chrome.md#compositions).
`product/viewer/standalone/build/refused/cancel` draws a Cancel refused while
Mokly is busy.

Open catalogue opens the publication
route, with `view=changes` when the build had a comparison base. A terminal
transition never navigates on its own at the build address; a reference alias
still resolves to the new publication as
[Viewer address state](./viewer-address-state.md#entry-and-resolution) defines.

## Output And Read Ordering

The output, under its Output label, renders the log window's text in order:
`system` lines as quiet command and result lines, each starting a line of its
own; `stdout` and `stderr` alike, in ink; and an elision line,
`<size> of output not kept`, where retained output was dropped, the size in KB
or MB to one decimal place at 1,000 bytes to the KB. Long lines wrap. A build
with no output yet draws no output. The output holds about twenty lines and
opens on its newest line; it follows the newest line while the reader is at
the end and stops following when they scroll up. The output box is a labelled
region a keyboard reader can focus and scroll. Its keyboard outline follows
the [shared focus rule](./design-tokens.md#radius-elevation-and-focus). While
the build is `queued` or
`running`, or the log is not yet `complete`, and the tab is visible, the card
reads the build and the log after its last sequence on each
[build notice](./cloud-build-api.md#live-notices) and by its poll: every three
seconds while it has no open live socket, and every 30 seconds while it has one,
reading further windows at once, up to eight, while a window comes back full;
a hidden tab pauses, and a tab that becomes visible reads at once. A window is
full when it holds 100 chunks or more than 192 KiB of text, the most a window
holds before its next chunk might not fit. A poll of the build or the log that
fails keeps the card and the output as they are and tries again at the next
interval; the card changes only when a read succeeds. A first read that failed
is not polled; only its Try again reads again. A chunk from a newer attempt
replaces the output shown for the older one, and a late chunk of an older
attempt is not shown. The reader keeps what Mokly keeps: once `elision` reports
dropped output, it holds the head and at most 768 KiB of the newest output
after it, dropping its own oldest output after the head first.

The card applies a build read only if it started after the last write response
the card applied: Cancel's answer or the build returned by a build request.
Drop an older read even if it arrives later. Once a build is `published`,
`failed`, `timed-out`, `superseded` or `cancelled`, drop any read of that same
build, and any write response for it, that returns `queued` or `running`.
`running` to `queued` remains allowed for an infrastructure retry. These rules
are per build; an accepted request follows its new build at that build's
address, where its card starts with a first read of its own.

## References Without A Ready Publication

When the standalone entry, a branch alias or a pull request alias has no ready
publication, the stage chooses from the reference's own `listBranches` or
`listPullRequests` row. The standalone reference is the default branch, the
first branch row; no branch row means no reference and the Set up publishing
cards remain. The entry uses the row from the lists the route already read,
even when that completed list has no matching row. It lists again only when
the route has not read that list. The route reads the pull request list for a
pull request alias: the entry waits for that read while it runs and lists
pull requests itself only when it failed. The route reads no branch list, so
a branch alias lists its branches once.

Apply this order:

1. The reference's `newestBuild` is `queued` or `running`: its build card, at
   the alias address, for every plan, with the slot reading Publishing now.
   Once it publishes, the alias resolves to the new publication, like any
   alias that gains a ready target.
2. A closed or merged pull request: its closed card, for every project and
   plan.
3. An open pull request whose row has `fork: true`: its fork card, for every
   project and plan.
4. `publishingAllowed` is false: the Team card for every reference left by
   rules 1 to 3, including an open pull request from the project's repository.
   Use the [workspace-role rule](./viewer-chrome.md#workspace-role): an
   owner gets Open billing; anyone else reads “Ask an owner to upgrade to
   Team.” While the role read runs, show no owner-specific copy or action.
   A read failure other than `not-found` shows the workspace's Try again.
   `product/viewer/pull-request/plan` and its `reader` variant draw the card
   for a pull request.
5. Its `newestBuild` is `failed` or `timed-out` and newer than its
   `newestPublication`: that build's card.
6. Its `newestPublication` failed: that failed publication's details, read
   with `getPublication`, at the alias address.
7. Otherwise the publishing card. For readers whose project reports
   `canRequestBuilds` it is **No publications yet** with Publish this branch
   (**No publication yet** with Publish this pull request for a pull request),
   and Publish from CI, the CI setup guide, as the secondary link. For a
   reviewer of a project that can build it is **No publications yet** with
   “Ask a member or administrator to publish this branch.” and Choose another
   branch (**No publication yet** with “Ask a member or administrator to
   publish this pull request.” for a pull request). A project that cannot
   build keeps the existing Set up publishing and reader cards. An open pull
   request alias in it shows the [waiting card](./viewer.md#address-and-history)
   only while the plan allows publishing.

The [closed and fork cards](#reference-cards) have the copy that rules 2 and 3
use. The [request controls](./viewer-build-navigation.md#request-a-build)
follow this order's publishing card.

## Reference Cards

The closed card names the row's state, **This pull request is closed** or
**This pull request was merged**, with no line and Choose another branch to
open the switcher. `product/viewer/pull-request/closed` and its `merged`
variant draw it. [Closing a pull request](./cloud-builds.md#availability-and-eligibility)
blocks new builds; a queued or running build can still publish.

The fork card is **This pull request is from a fork**, with one line,
“Review this pull request’s screens locally.”, and Choose another branch.
It offers no publish action, request to ask a member or CI guide.
`product/viewer/pull-request/fork` draws it.
The fact comes from the
[read-model fork rule](./viewer-read-model.md#pull-requests--listpullrequests).
The published Mokly CI guide's **Forks** section requires local review and
gives these pull requests no upload credentials.
