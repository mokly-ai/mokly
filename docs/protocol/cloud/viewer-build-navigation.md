# Viewer Build Navigation

This is the navigation sub-contract of [Viewer builds](./viewer-builds.md).
Viewer builds owns build cards, output, closed and fork card copy, and the
reference stage order when no ready publication exists; this document owns
the build route, requests, history, the switcher, the project setting and
onboarding, and mockup verification.

## Build Route

`/:workspace/:project/builds/:buildId` resolves the project by its slugs like the
publication route, then reads the build. The viewer mounts no catalogue: its
status is `unpublished` and the build card is the `stageMessage`. The
publication slot names the build's reference — its branch, or its pull
request with number, title and author — without a publication SHA, beside the
state the build's switcher row would read: Publishing now while it is queued
or running, Published and its day once it is published, Unable to publish once
it failed or timed out, and Not published once it was superseded or
cancelled. The published day is the day the build finished. History and the
switcher open on that reference. Share offers the build's publication once it
is published; before that the Share trigger is disabled and `panel=share` is
corrected away, as for any address with nothing published. `panel` and
`settings` behave as on every viewer route; viewer selection keys do not
apply, and the route corrects away any it carries. While the first build read
runs, the slot names
This build and the stage says Loading build. A `not-found` answer — an unknown
build, one on another project or one the reader may not see — shows **This
build is unavailable** with Choose another branch, which opens the switcher,
and the slot names This build with Build unavailable. Any other failure of the
first build read shows **This build couldn’t load** with Try again, which
repeats the read, and the slot names This build with Build couldn’t load.
UUID permalinks keep the tail, so `/projects/:uuid/builds/:buildId` resolves
too.

## Request A Build

Publish this branch requests a build for that reference and follows the new
build's route, where the stage shows its card. The refusals use the [Build
Card rule](./viewer-builds.md#build-card). The publishing card keeps its
secondary guide beside the
control inside the write-failure fragment and above Details through the shared
[control-with-guide composition](./folio-chrome.md#compositions).
`product/viewer/standalone/publish-refused`
draws a branch's request refused while Mokly is busy, and its `pull-request`
variant a pull request's request refused with `builds-unavailable`. The CI setup
guide is `<site origin>/docs/ci/publish-from-ci/`; every control that offers
it beside a build reads Publish from CI, and the Set up publishing control a
project that cannot build keeps opens the same guide.

## History And Switcher

The history panel reads `listHistory` for its reference, one page as before.
Publication entries are unchanged. A build entry reads Publishing now while
`queued` or `running` and Unable to publish once `failed` or `timed-out` — the
words a publication entry uses — with its creation time and short SHA, and
opens the build route through Details. The build the stage shows is where the
reader already is, so its entry carries no Details.

A switcher row takes its state from the newer of `newestPublication` and
`newestBuild`: an active build reads Publishing now; a failed or timed-out
build newer than the newest publication reads Unable to publish; otherwise the
row keeps its publication state. The row's short SHA is the head of whichever
it took its state from. Opening a row resolves the reference as before, so a
ready publication still wins over a newer build, and a reference with none
opens the stage the
[reference order](./viewer-builds.md#references-without-a-ready-publication)
chooses. A row with no ready publication whose
state is Unable to publish offers Details: a failed publication opens its own
details, as before. A row whose newest build failed opens that build's address
through Details, including on a closed pull request, a fork pull request or a
plan-refused project, where the reference's own stage shows another card. In
the switcher drawing, Alex's `alex/bun-migration` row opens its failed build's
drawing, `product/viewer/standalone/build/lockfile`.

## Project Setting And Onboarding

The project pane's Automatic builds switch, beneath the project's facts with
the line “Publish each push to the default branch and to pull requests.”, is
an administrator control that writes `automaticBuilds` through the full
project update on its own, sending the project's current name, slug,
visibility, approval policy and version beside it. While it saves, the switch
holds the requested value, is disabled and shows “Saving…” in its own row
beside its label, and a screen reader hears Saving automatic builds, as
[write in progress](./folio-chrome.md#compositions) defines; a refusal is
reported beside the switch through the write-failure fragment, and the switch
returns to the stored value. Other readers see its state on a disabled switch.
A project that cannot build shows “This project publishes from CI.” in its
place, which `product/settings/project/no-builds` draws.

The project-created screen reads the default branch row, the first row of
`listBranches`, and keeps its loading state while it does. When the row's
`newestBuild` is active, the screen says “Mokly is publishing main.”, with the
default branch's name, beneath its title and leads with Open project, keeping
Publish from CI, the CI setup guide, as the secondary link. Otherwise,
including when that read fails, Publish from CI leads and Open project
follows: the project is created either way, so a failed read never stops the
reader.

## Mockups

The [viewer inventory](./product-mockups-viewer.md#builds) owns the build,
publishing, closed and fork drawings. The settings and account inventories
cover Automatic builds and project-created. `docs/mockups/src/fixtures/builds.ts` holds the drawn states,
causes and refusals. The
[application parity rule](./mockup-verification.md#application-parity) extends
the card mapping to every reachable build-card body.
Application regressions cover active, closed and fork stage order on both
plans, reuse of route lists, a delayed read after Cancel, final-state fencing,
`running` to `queued` retries and a reviewer's queued build with no Cancel.

A logic matrix, `packages/app/src/_tests_/viewer/stage-plan.test.ts`, covers every
reference kind, both values of `publishingAllowed`, and both values of
`buildsAvailable`. It proves that the waiting card appears only when the plan
allows publishing, and that a plan-refused open pull request shows the card a
branch shows. Switcher logic tests, `switcher-row.test.ts`, cover Details on
closed, fork and plan-refused rows and on an ordinary row under the
[Details rule](#history-and-switcher).
