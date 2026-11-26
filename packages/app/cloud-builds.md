# Cloud Builds

This is the cloud builds guide for the [App package](./README.md).

`/:workspace/:project/builds/:buildId` shows one build's card in the viewer
stage, as [Viewer builds](../../docs/protocol/cloud/viewer-builds.md) defines.
`src/data/builds.ts` holds the five build operations. `useBuildWatch` follows
the build through `build-follow.ts`: the first read, then the build and its log
every three seconds while the build works or its log is incomplete and the tab
is visible; a failed poll changes nothing on screen. A build read applies only
if it started after the last write answer the card applied, such as Cancel's,
and neither a read nor a write answer moves a finished build back to queued or
running. `build-log.ts` keeps the windows it has read, replaces an older
attempt's output, keeps no more output after the head than Mokly keeps, and
turns chunks into output lines.

A reference with no ready publication chooses its stage in the order
`reference-stage.ts` gives: a queued or running build for every plan, then a
closed pull request's card and a fork's card for every project and plan, then
the plan's Team card, a failed build newer than the newest publication, a
failed newest publication and the publishing card. While the plan refuses
publishing, `stage-view-decision.ts` gives an open pull request of the
project's repository the Team card a branch gets, under the workspace-role
rule; the pull request waiting card shows only while the plan allows
publishing. `entry.ts` reads an alias's reference row once. It redirects to the
row's `latestPublicationId` when it has one. Otherwise it gives the same row, or
none, to the stage order above. A pull request alias takes its row from the list
the route already read for the chrome, waiting for that read through
`data/use-settled.ts`, also when that list holds no row for it. A branch alias
reads its row through `readReferenceRow` in `data/publications.ts`, which stops
at the page that holds the row. A pull request alias reads its row the same way
only when the route read no list or that read failed. An alias whose build
publishes resolves again. `closedState` and `fromFork` in `resolution.ts`
read a pull request row's state and its fork fact, and the fork card is
`fork-card.tsx`. Switcher rows take their state from the newer of their newest
publication and newest build, and history reads `listHistory`.
`switcher-row.ts` chooses where a row leads: Details on a row with nothing
ready whose newest build failed opens that build's address, Details on a
failed publication opens its own details, and every other row opens the
reference. The project
pane's Automatic builds switch writes on its own through `settings/write.ts`,
and the finished project reads the default branch's row to say whether Mokly
is publishing it.

A failed build announces only its title and line. After Cancel, focus moves to
the card's title and a polite status reads the title the card shows. A
refused or failed Cancel keeps the label Cancel, because Try again on a build
card requests a new build: `request-controls.ts` lists every control that
sends a build request with what it reads after a refusal, and the publishing
card and the build card read their labels through it. While its request
runs, each of these controls is busy with its working word, and
`build-copy.ts` names the operation a screen reader hears. Keyboard
focus draws the token focus outline round the title and the output box, which
follows its newest line until the reader scrolls back. `build-ineligible`
refusals choose their sentence by the typed `cause` in `api/form-error.ts`,
keyed by the generated `IneligibleCause`, so a cause that the Rust contract
adds fails to compile until it has a sentence, and no refusal adds a guide.
The publishing card and the build card draw their control through
`control-guide.tsx`, so a refused publish request keeps Publish from CI beside
the control, inside the write-failure fragment and above Details.

`src/_tests_/viewer/stage-drawings.test.ts` maps every card the empty stage
chooses, for a branch and for a pull request, every build-card body — its
one action, the owner's action as a placeholder or none, and the kind of its
line — and every way each request control of `request-controls.ts` reads
after a refusal or a failure to its drawing. It checks each
drawing against the authored product inventory in
`docs/mockups/src/_tests_/product-inventory.ts`, so it reads no generated
output and runs before the mockups build; the mockups stage proves that the
built catalogue holds the inventory. Its cases live in
`src/_tests_/viewer/stage-cases.ts`, which enumerates the builds the lifecycle
allows, and its checks in `stage-problems.ts`. The closed pull request card
maps a closed and a merged pull request to their own drawings, and the fork
card has its own, and a plan-refused pull request's Team card maps to
`product/viewer/pull-request/plan` and its `reader` variant. Its maps are typed
by `UnpublishedStage`, `BuildAction`, `BuildLine` and `RequestControl`, so a
new card, action or request control fails to compile until it names a
drawing. Every reachable body has a drawing, with no exception list. A
reviewer's queued and running builds, which offer no Cancel, map to the
`queued` and `running` variants of `product/viewer/standalone/build/reader`,
and the plan refusal's wait for the workspace read maps to its `plan-loading`
variant. The inventory's modules type their
definitions with `@mokly/mokly`, so `tsconfig.json` maps that package's type
declarations; the test imports no Mokly code at run time.

The ordinary API, which the routed build specs reach, has the recorded GitHub
but no build configuration, so it reports builds unavailable and never creates
one. A double answers the build
operations, the project's build fields and the reference rows' newest builds
for one project, with bodies typed by the generated client:
`src/_tests_/build-double.ts` holds what it answers and the helpers that change
it as the worker would, `build-answers.ts` answers each operation from it, and
`build-routes.ts` routes one project's requests to those answers. Every other
read and write reaches the real API, and a project that cannot build is
tested against it unchanged. Tests change the double between polls and the
card follows on its next read, and `holdBuildReads` keeps a build read waiting
so it can answer after a write. `src/_tests_/build-refusals.ts` drives a
refused Try again and measures, in the page, where the refusal, the control,
the guide and Details sit in the build card or the publishing card and what
outline a focused title draws, for the desktop specs and the 390px, 320px and
200%-text phone specs. `src/_tests_/build-output.ts` reads what the output box
shows and the outline it draws. `src/_tests_/build-reader.ts` reads a build as
a reviewer, who may neither request nor cancel one.

`src/_tests_/build-states.ts` is the one table of build states the desktop
browser tests read: every build state, card action and request
control's refusal and wait, the answers that open an active build or a published
publication, the reviewer's publishing card, and builds in History and the
switcher. Its records are keyed by `BuildState`, `BuildAction` and
`RequestControl`, so a new state, action or request control fails to compile
until a row shows it. The rows are in `build-state-cards.ts`,
`build-state-readers.ts`, `build-state-refusals.ts`, `build-state-busy.ts` and
`build-state-lists.ts`, with the two surfaces and the card's parts in
`build-state-parts.ts`.
`build-states.spec.ts` runs every row on the desktop.
`build-states-mobile.spec.ts` runs on a phone at 390px the two rows whose steps
differ there: History opens from More, and Open billing opens Billing as a
route. Its other test walks every state a build card or the publishing card
draws, and the catalogue a published build opens, and names each state that
scrolls sideways at 390px or 320px. `build-card-walk.ts` keys those states by
the same three unions, so a new state, action or request control also fails
to compile until a phone state shows it. The states are in
`build-card-states.ts` and `build-stage-states.ts`.

`build-api.spec.ts` follows a real build instead of the double. It alone swaps
the ordinary API for the test-only `fake-build-api` example of `mkc-api`. The
example listens at the same origin, on the same database schema and blob
store. The recorded GitHub, the Stripe double and the catalogue server keep
running. `replaceApi` in `api-server.ts` makes each swap. The spec restores the
ordinary API in a `finally` block, so a failed assertion also restores it.

The example has builds configured. It composes the real API with the fake
runner of the API's GitHub integration tests in place of the sandbox, as the
[API guide](../../crates/mkc-api/README.md#development) describes. The runner
writes build output, then holds the upload until the spec releases that build.
The runner then uploads its fixture through the API's real upload exchange.

The spec requests a build in the App. While the upload waits, the spec checks
the running build without a sleep. It then releases the upload and follows the
card to published through the real build and log reads. Last, it opens the
published catalogue. The spec routes no build operation.
