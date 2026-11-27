# Mockup Verification

This is the policy and smoke-test sub-contract of [Mockups](./mockups.md).
Build precedes check, test and typecheck. Run build and check with `--strict`.
Fix errors and warnings before committing authored source.
Git ignores the build output. The tests read the output of
`npm run mockups:build` in `mokly-static/`: the rendered documents, the
catalogue index and the entry details.

## Required Checks

Keep rejection fixtures under `docs/mockups/src/_tests_/` for every policy:

1. Every product screen and component variant has both viewports and themes.
   Paths are unique without case sensitivity, and each variant names a parent
   of its own kind at the parent path plus one slug.
2. A screen has at most four variants and a component one to five. The parent
   is its canonical drawing. Source checks enforce the
   [hierarchy rules](./mockups.md#catalogue-hierarchy). Situation paths match
   their family, screen and logical parent; breadcrumb titles match the public
   hierarchy. Each rule has a rejection fixture.
3. Each screen uses one named screen component; flows reuse owning screens,
   never inline JSX. Their references use screen paths.
4. Artboards contain no policy-note markers, engineering annotations or
   environment badges. Rejection fixtures supplement manual copy review;
   a blacklist alone cannot judge context.
5. Registered base components have saved variants, closed prop schemas, their
   own props, declared slots and real screen uses where required.
   Token CSS contains no independent duplicate values; color
   pairs meet the contrast contract.
6. Internal links, flow back-links and referenced resources resolve in the
   build. Build fresh output before tests inspect it.

Email policy checks also require the five named roles, three accent roles
and transparency, and the two published logo images. The message table keeps
separate borders with zero spacing. Only the action cell carries an accent
fill. Each view equals the shared delivered body for its content, scheme and
viewport. Fixtures use canonical app paths and preserve the email import
boundary, per [Email authoring](./email-authoring.md#catalogue-and-checks).

## Build Determinism

The `cloud-mockups` suite proves that two independent builds of the dogfood catalogue have
identical paths and bytes. Output that changes between two builds of the same
sources would publish those sources as a new deployment and would show as
false Changes.

The test command checks determinism before any policy or browser module
loads. Its preflight requires the catalogue index and the rendered documents
in `mokly-static/`. Absent output fails with
`Mockup output is missing. Run npm run mockups:build from the repository root.`
It does not build missing output automatically.
The check compares every regular file of the two builds, including the
catalogue index, the entry details, the compiled CSS and the binary assets, by
complete path and exact bytes.
Only filesystem timestamps are excluded; it must not normalize HTML, CSS,
JSON, hashes or asset bytes.
A mismatch fails with sorted missing, extra and changed paths.
The message tells the author to rebuild after source changes and rerun tests.
A failed second build also fails the test command.
The command removes only its owned snapshot after success or failure.
The first build in the `cloud-mockups` suite is `mockups:build`; standalone
`mockups:test` also requires a preceding build.

Every Node and browser test process removes each inherited `GIT_*`
variable, matched without case, before a test runs. A Git hook
that runs the tests therefore cannot point their Git at the hook's repository
or index. Each process that a test runs in a fixture checkout also runs
without `GIT_*` variables and ignores the global and system Git
configuration, so a developer's Git settings cannot change a fixture.

## Derived-Output Regressions

The policy and CLI tests under `docs/mockups/src/_tests_/` assert the following
contract.

1. A policy guard fails on any indexed path below `mokly-static/`, below a
   `.mokly-export-reservations/` directory or below a directory named
   `mokly-generated`, at any depth. It checks the whole
   repository, including the smoke fixture. It also requires Git and Prettier
   to ignore those directories, whether present or absent, and the removal of
   one of their ignore rules fails the guard.
2. Strict Publish succeeds from a clean committed source checkout and writes
   nothing into the repository. Dirty source fails with
   `git-uncommitted` before any receiver request.
3. Publish carries the bundled CSS and assets of its own build from sources,
   so absent or corrupt local output does not change the published bytes.
4. A base whose sources fail current validation leaves Changes unavailable,
   and the build still succeeds.

## Application Parity

Every empty-stage card kind has a drawing for branches and for pull requests.
Every build-card body also has a drawing, under the
[viewer inventory](./product-mockups-viewer.md#builds).

An application test, `packages/app/src/_tests_/viewer/stage-drawings.test.ts`,
enumerates each reachable card kind for both reference kinds and every
build-card body, and maps each to a drawing path. A drawing is a screen or a
variant that the authored product inventory declares:
`expectedProductScreens()` in `docs/mockups/src/_tests_/product-inventory.ts`.
The test imports only that pure inventory and reads no generated output, so
the `cloud-app` suite runs it with the app logic tests, before any mockup
build, including on the fresh runner of app shard 1. The `cloud-mockups` suite
ties the inventory to the built catalogue: the product policy
requires the authored product screens to equal the inventory, the responsive
sweep opens every inventory page from disk, and the disk smoke requires all
four views of every built entry.

The test fails when a case has no drawing, so a new card or body cannot
silently escape the mapping. It also fails when a mapped path is not in the
inventory. Its mapping is typed by the application's own card and action
unions, so a new kind fails to compile until it names a drawing, and a mapped
drawing no case reaches fails the test too. Rejection cases remove one mapped
drawing from the inventory and map a case that nothing reaches. A card whose
body depends on the reader, such as the plan card for an owner and for anyone
else, maps each body to its own drawing. So does a card whose title depends on
the pull request's state: the closed pull request card maps a closed and a
merged pull request to their own drawings. A card that waits on the entry's
read maps to the stage's loading drawing: `product/viewer/standalone/loading`
for a branch and `product/viewer/pull-request/loading` for a pull request. A
card that waits on the workspace read maps to
`product/viewer/standalone/plan-loading` for both. A plan-refused
pull request's Team card maps to `product/viewer/pull-request/plan` for an
owner and to its `reader` variant for anyone else. The workspace's own card
names no reference, so a pull request's maps to the one drawing of that card,
`product/viewer/standalone/workspace-unreadable`.

The build-card mapping covers every reachable body, keyed by its action kind,
the placeholder of an action that a read decides, or `none`, and its line
kind: waiting, cause sentence, the plan line for a
non-owner, or `none`. The application's `BuildLine` union types the line
kind. Distinct state and role bodies stay distinct; no action is a case to
map, not a case to skip. The cases are the builds the lifecycle allows: a
failure cause only on a failed or timed-out build, and Cancel only while a
build is queued or running. A plan refusal whose workspace read failed is
not a body, because the workspace's own card replaces it. In particular,
the plan refusal for a non-owner, the plan refusal while its role read runs, a
finished build for a reader who cannot request builds and a queued build for a
reader who cannot cancel it each have their own drawing: the `plan`,
`plan-loading` and `queued` variants of
`product/viewer/standalone/build/reader` and its canonical drawing. The test
maps each of them. The test fails on an unmapped body, a missing drawing or an
unreachable mapped body; rejection cases remove each of those reader-dependent
mappings, and each of their drawings from the inventory.

The test also maps each way a refused build request reads beside the control
that sent it. Over every catalogued reason except the two that open what
already answers for the head, the publishing card's control reads the way
back where the same request could succeed, which
`product/viewer/standalone/publish-refused` draws, and keeps its own label
where it would be refused again, which its `pull-request` variant draws. A
build card's Try again reads Try again either way, which
`product/viewer/standalone/build/refused` draws.

The refusing controls come from each card's own request controls: the
`RequestControl` union and `requestControls` record of
`packages/app/src/viewer/request-controls.ts`, through which the publishing card's
Publish and the build card's Try again and Cancel read their labels. A build
card action joins the union when `buildActionControls`, keyed by every action,
says its control sends a request. The drawing test enumerates them, including
Cancel, and its mapping is keyed by the union, so a new request control fails
to compile until it names its drawings; there is no separate list for one to
escape. It applies the [Cancel label rule](./viewer-builds.md#build-card) to
every catalogued refusal and to a failure raised in the browser.
`product/viewer/standalone/build/refused/cancel` draws Cancel keeping its
label after a refusal.

## Disk And HTTP Smoke

The disk smoke opens every light view at 390px or 1440px. A Node check compares
each dark view with its light view at the same width. It accounts for color
values, theme markers and verified links to the same entry and viewport.
Chromium opens the dark view when the markup differs or an HTML attribute
contains `prefers-color-scheme`. It also opens the dark view when the
stylesheets can change layout with the theme or the check cannot verify them.
Chromium uses the document's theme for media queries.
The smoke waits for documents, fonts and images. It rejects browser errors,
missing resources, blank content and horizontal overflow, including frames.
HTTP checks open the settings panes through the dialog rail, account entry and
every flow through Browse, and check keyboard focus in account entry. They read
the canvas frames by their labels, check a settings pane in its Light and Dark
frames, and choose Light and Dark for each flow with the flow's Frames filter.
Control checks verify that each registered wrapper renders the real Firna
component with the mapped theme, atomic styles, accessible fields, focus
fallback, disabled states and the control-style policy.

A catalogue policy test uses the keyboard to focus each element with
`tabindex` outside registered controls in each document in the disk sweep.
It checks the computed
[token outline](./design-tokens.md#radius-elevation-and-focus): a solid 2px
`focus` outline at a 3px offset, on `:focus-visible`. The disk smoke runs it
on each page after its capture, so no capture shows a focus ring;
`src/_tests_/focus-policy.ts` holds the check and `focus.spec.ts` its
fixtures. A target is an element that takes focus only through its `tabindex`.
These are not targets: an element the browser focuses without one, such as a
link, a button, a form field, a frame or a `summary`; an element Firna renders;
and the `@mokly/ui` parts of a viewer drawing outside its host slots.
An inert or unrendered element takes no focus. Tab reaches each
target in the tab order from the top of the page. For negative `tabindex`,
transfer focus after keyboard input, as a keyboard action's focus handoff
does. The build card's title and output region are included. Rejection fixtures fail a page without
the shared rule and list only the targets above, and a fixture with the real
`base.css` passes. The focus and shared button
tests check their scheme-specific token values in both themes.
Application browser tests also focus the output and prove that new output
follows the newest line at the end, stops following after the reader scrolls
up, and resumes when the reader returns to the end.

No element inside an `aria-hidden` subtree takes focus unless an `inert`
ancestor holds it, in any document in the disk sweep. An
overlay screen's viewer backdrop is `inert`, and Tab from its panel never
reaches a control outside the panel.

Browse requires HTTP. [Mockup baselines](./mockup-baselines.md) defines how
the comparison base renders and when Changes are unavailable.

Selection policies read the catalogue index and the rendered documents. They
verify screen coverage, ownership and the palette that the
[renderer boundary](./mockups.md#screen-and-renderer-boundary) chooses. Review screens remain deferred. Site policies require all eight
site screens, their reciprocal tour, four viewport/scheme documents, semantic
tokens and parity with `apps/site`. The entry identities and directory checks
use `design/site/*`. Settings policies verify the rules of
[Settings mockups](./settings-mockups.md#mockup-representation). Wrapper
tests cover every registered wrapper, including wrappers with no owning
screen, and the account-entry brand, action and destination rules.

The served suite starts Serve with the canonical configuration and a `--base`
that names a ref that does not exist. Changes therefore stay
unavailable and no base is extracted or installed, and the suite proves that
Browse and current content keep working. Decision: a missing
base ref, not the real `origin/main` base, because Serve has no
`--no-changes` option. A real base would extract the base
sources and could install its dependencies during the suite.

The paths, bytes and times of the build output are the same before startup,
after the suite and after shutdown. Serve, including
`serve --no-watch`, writes nothing into the repository. Serve shows each
journey under the package's
[use-case rule](../mokly-shell-canvas-stage.md#use-case). Mobile journeys also
open the same owning mobile screens in Browse.
Test account-entry layouts at 320px and 200% text too. Keep wrapping and grid
minimums readable without clipping or hidden overflow.
