# Product Mockups: Viewer Builds

This inventory is part of [Product mockups: viewer](./product-mockups-viewer.md).
It lists the drawings of cloud builds and of the stage cards around them. Its
paths match the current source and generated catalogue.

## Builds

A cloud build is drawn as the build card [Viewer builds](./viewer-builds.md)
specifies, following its failure copy rules, inside the stage of the address
the reader is on; its composition is in
[Viewer compositions](./folio-viewer.md#compositions). Standalone's `build/` folder
holds nine screens, whose modules sit in
`src/entries/product/viewer/standalone/build/`; its `index.mockup.tsx` owns the
folder. `product/viewer/standalone/build` is a running build's card on a newer
push of the branch Cal reads, with its steps, live output and Cancel. Its
variants are `product/viewer/standalone/build/empty` (queued, with every step
waiting and no output yet), `product/viewer/standalone/build/loading`,
`product/viewer/standalone/build/error` (an unknown build, recovered through
the switcher) and `product/viewer/standalone/build/published` (the output with
the line where the log dropped bytes, and Open catalogue).

`product/viewer/standalone/build/failed` is an install that failed, with the
cause's sentence, the output's tail and Try again. Its variants are
`product/viewer/standalone/build/failed/timed-out` (a pull request's publish
stopped at the deadline), `product/viewer/standalone/build/failed/infrastructure`,
`product/viewer/standalone/build/failed/plan` (the Team card's copy with the
owner's Open billing) and `product/viewer/standalone/build/failed/version`.
`product/viewer/standalone/build/superseded` names the newer push with Open the
newer build; its variant is `product/viewer/standalone/build/superseded/cancelled`.
`product/viewer/standalone/build/unreadable` is a first build read that failed
for another reason than `not-found`: This build couldn’t load with Try again,
as `product/viewer/standalone/unreadable` is for a publication, with the slot
still naming This build. `product/viewer/standalone/build/lockfile` is a branch
whose only tracked lockfile is Bun's: its output stops after the lockfile search
prints `bun.lock`, its line is the `unsupported-lockfile` sentence of
[Viewer builds](./viewer-builds.md#build-card), and its one action is Publish
from CI, a link to the CI setup guide like every other Publish from CI.
`product/viewer/standalone/build/refused` is Alex's pull request, closed after
its install failed: Try again was pressed and refused, so the write-failure
fragment sets “This pull request is closed.” above the control and Details
beneath it, with no guide. A pull request from a fork is refused with the same
body and its own sentence, so it has no drawing of its own; its alias shows the
fork card below.
`product/viewer/standalone/build/reader` is the failed install on the branch
Cal reads, read by Sam, a reviewer, who cannot request builds: the cause's
sentence and no action. Its `plan` variant is the plan refusal read by Alex, an
administrator who is not an owner, with “Ask an owner to upgrade to Team.” and
no action; `plan-loading` is the same refusal while the workspace read runs,
with no line and the owner's action as a placeholder. Its `queued` variant is the queued build that
`product/viewer/standalone/build/empty` draws for Cal, read by Sam, who cannot
cancel builds either: “Waiting to start.” and no action. Its `running` variant
is the running build that `product/viewer/standalone/build` draws for Cal, read
by Sam: its steps and live output, with no line and no action. These bodies
follow [Viewer builds](./viewer-builds.md#build-card). These six screens are declared
siblings of the running build in `src/_tests_/product-situations.ts`, so none of them
becomes one of its variants.

`product/viewer/standalone/publish`, a screen beside
`product/viewer/standalone`, is a branch with nothing published in a project
that can build: Publish this branch, with Publish from CI — the CI setup guide
— as the secondary link. Its variants are
`product/viewer/standalone/publish/pull-request` (Publish this pull request),
`product/viewer/standalone/publish/reader` (a reviewer, who is told who can
publish and offered the switcher),
`product/viewer/standalone/publish/publishing` (a new project's default branch,
whose first build runs in the stage) and
`product/viewer/standalone/publish/reader-pull-request` (the reviewer's waiting
card for a pull request). The Set up publishing and reader drawings
stay for projects that cannot build. `product/viewer/pull-request/publishing`,
the fourth variant of `product/viewer/pull-request`, is a pull request whose
first build runs. `product/viewer/pull-request/closed`, a screen beside
`product/viewer/pull-request` in its `pull-request/` folder, is the closed pull
request card at the alias of Alex's closed pull request, titled This pull
request is closed, with Choose another branch and no line. Its variant
`product/viewer/pull-request/closed/merged` is Sam's pull request from a fork,
merged with nothing published, titled This pull request was merged.

`product/viewer/pull-request/fork`, a screen beside `product/viewer/pull-request`
in the same folder, is the fork card at the alias of Sam's pull request from a
fork, open with nothing published: This pull request is from a fork, with
“Review this pull request’s screens locally.” and Choose another branch, which
opens the switcher drawing. Its copy and action are owned by
[Viewer builds](./viewer-builds.md#reference-cards).

`product/viewer/standalone/publish-refused` is a screen beside
`product/viewer/standalone/publish`, which already holds four variants: the
branch's Publish this branch refused while Mokly was busy. The write-failure
fragment sets “Mokly is busy. Try again in a moment.” above the shared
[control-with-guide fragment](./folio-chrome.md#compositions) — Try again with
Publish from CI beside it — and Details beneath. Its `pull-request` variant is
Publish this pull request refused because the project no longer builds: “This
project publishes from CI.” above the control, which keeps its label. At 320px
with enlarged text the guide wraps beneath the control and stays above Details.

Every build drawing's output box is the labelled, focusable Output region of
[Viewer compositions](./folio-viewer.md#compositions), and its title is the focus
target Cancel hands focus to. The build fixtures take each cause's sentence
from the cause table of [Viewer builds](./viewer-builds.md#build-card).

`product/viewer/history` lists a publishing build and a
failed build among the branch's publications, each opening its own details.
`product/viewer/switcher` rows read Publishing now from an active build: the
branch Cal reads still opens its ready publication, the pull request with
nothing ready opens its running build, and the branch with nothing published
opens `product/viewer/standalone/publish`.

Under the [parity rule](./mockup-verification.md#application-parity), every
build-card action and every empty-stage card, for branches and for pull
requests, has a drawing in this inventory. `src/_tests_/app-owners.ts` names
the application owners of both the reviewer's pull request card and the
lockfile card, and the lockfile card's line is a declared sentence its owner
writes. The refused Try again's owners are the build card's, and its refusal
sentence is a fixture cause that `app-parity-copy.test.ts` reads from
`api/form-error.ts`. The refused publishing card's owner is
`viewer/build-copy.ts`, with `settings/write.ts` for the way back, and its
two refusal sentences are fixture causes read from `api/form-error.ts` and
`api/labels.ts`. The reader bodies' owner is `viewer/build-copy.ts`. The plan
line for everyone but an owner is a declared sentence it writes through
`askAnOwnerToUpgrade`, and the queued line, “Waiting to start.”, is a declared
sentence it writes itself. The closed pull request card's owner is
`viewer/stage.tsx`, which writes both of its titles. The fork card's owners are
`viewer/fork-card.tsx`, which writes its title and its line, a declared
sentence, and `viewer/stage.tsx`, which writes Choose another branch.
The [body parity rule](./mockup-verification.md#application-parity) extends
this mapping to reader-dependent build bodies, including bodies with no action.

### Third Review-Fix Drawings

`product/viewer/pull-request/plan` is the
[plan-refused pull request card](./viewer-builds.md#references-without-a-ready-publication),
a screen beside `product/viewer/pull-request`, whose `index` screen already has
four variants. It draws Alex's open pull request in a private project on the
free plan, with nothing published, read by Cal, an owner: the Team card of
`product/viewer/standalone/plan`, with Open billing and Choose another branch.
Its `reader` variant is the same pull request read by Sam, who is not an
owner: the card of `product/viewer/standalone/plan-reader`, with “Ask an owner
to upgrade to Team.” and Choose another branch. A policy test holds each stage
to the branch drawing of the same card.

The `cancel` variant of `product/viewer/standalone/build/refused` draws the
[Cancel failure rule](./viewer-builds.md#build-card): the build running on a
newer push of the branch Cal reads, whose Cancel was refused while Mokly was
busy. The write-failure fragment sets “Mokly is busy. Try again in a moment.”
above the control and Details beneath it. The same request can succeed, so the
control still leads to the cancelled build, and it still reads Cancel.

The switcher draws both kinds of failed row under the
[Details rule](./viewer-build-navigation.md#history-and-switcher):
`calummoore/protocol-docs`, whose newest attempt is a failed publication,
opens `product/viewer/standalone/failed`, and Alex's `alex/bun-migration`,
whose newest build failed, opens that build's drawing,
`product/viewer/standalone/build/lockfile`, with the build's short SHA.
`product/viewer/switcher` also draws a branch whose newest attempt failed over
an earlier ready publication. Its row shows the failed state and opens that
ready publication, `product/viewer/standalone`, not the failure's details.

The new drawings have the owners of the cards they repeat:
`viewer/stage.tsx` with `components/plan-consequence.tsx` for the owner's Team
card, `viewer/stage.tsx` for everyone else's, and `viewer/build-copy.ts` for
the refused Cancel. Those sources already write
every label and sentence the drawings show, so the parity suite needs no
allowance and no pending owner. `build-plan-cards.test.ts`,
`build-refusals.test.ts` and `viewer-panels.spec.ts` hold the three drawings
to this contract. The application's drawing test maps the new drawings. The
application's build double is split by subject into `src/_tests_/build-double.ts`,
`build-answers.ts` and `build-routes.ts`, which keep its checks.

### Requests In Progress

Each control that sends a request draws its
[Write in progress](./folio-chrome.md#compositions) as a screen of its own,
because each drawing it is pressed on already has four variants.
`product/viewer/standalone/publish-busy`, a screen beside
`product/viewer/standalone/publish`, is the branch's Publish this branch while
its build request runs: the control reads Publishing… with the busy spinner,
screen readers hear Publishing this branch, and Publish from CI stays beside
it. In the `build/` folder, `product/viewer/standalone/build/cancel-busy` is the
running build's Cancel while its request runs. It reads Cancelling…, and
screen readers hear Cancelling this build.
`product/viewer/standalone/build/try-again-busy` is the failed install's Try
again while its build request runs. It reads Publishing…, and screen readers
hear Publishing this branch. Each card keeps its title, line, steps and
output. The pressed control stays focusable and leads nowhere until its
request answers. Both build screens are declared siblings of the running
build, as the six screens above are.

The owner of the three drawings is `viewer/build-copy.ts`, which writes each
card's title, each working word and each operation that a screen reader
hears. `viewer-writes.test.ts` holds each drawing to the card at rest.
