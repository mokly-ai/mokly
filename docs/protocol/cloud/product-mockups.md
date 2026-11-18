# Product Mockup Inventory

This inventory owns state coverage and flow membership for the product
screens, which are authored in Folio per [Design tokens](./design-tokens.md).
The viewer is the application: the product has no project or workspace
page, the Workspace settings are panes of the
[settings dialog](./settings-dialog.md), and the Viewer family draws its ready
canvas from workspace `@mokly/ui` parts as static depictions while
keeping cloud-owned non-ready states and overlays. The public
site sits under Design rather than Product. Read [Navigation](./product-navigation.md),
[Viewer](./viewer.md) and [Catalogue rules](./mockups.md). The inventory
adopts screen path identities. It is not a second runtime router.

## Hierarchy And Composition

File-derived paths below match the current mockup source. Screen coverage
and flow intent stay aligned with the owning specs.

Product sits beside Design and Flows as a top-level folder. It holds the
Account, Recovery, Settings and Viewer screens. Design holds tokens, controls
and Site and Email screens. Flows holds the product journeys. Each standard owning screen is a parent entry drawing its
canonical state, with Empty, Loading and Error as its variants in that order.
The callback landings instead use the protocol-named states that
[Callback landings](./product-mockups-account.md#callback-landings) lists, the
desktop handoff and the GitHub installation landings among them; calling an
expired or used link "empty" or "loading" would hide the situation the route
actually reached. Every entry
renders one semantic screen, in mobile/desktop and light/dark. A screen carries
at most four variants, so it never renders more than five screens. User-flow
pages reuse the owning screens and link back to each.

Screen modules live under `src/screens/product/<family>/`. Each state draws a
named screen component for both viewports, which the screen's one render
selects from the props that the state sets. Screen components
compose shared layout and controls; do not duplicate default markup in flows
or generate static HTML trees. Every screen composes the shared arrangements
in [Folio chrome](./folio-chrome.md) —
stage, section, record row, form, dialog, layer, state and account entry —
through the shared screen helpers that the
[authoring guide](../../mockups/README.md#key-code) names. A screen never
introduces its own layout rule. One
entry module, `src/entries/product/<family>/<screen>.mockup.tsx` or a directory-owning
`<screen>/index.mockup.tsx`, defines a screen and its variants.
A screen with sibling screens takes a folder named
after it, and its module and theirs move into the matching directory, such as
`src/entries/product/settings/tokens/index.mockup.tsx`. State variants use
slugs `empty`, `loading`, `error`, giving `<parent-path>/<slug>`.

A state variant draws a situation the running route can reach. A situation the
product lacks is either an application TODO or a drawing to remove, never a
state: every standard screen gets its three state variants whether or not the
product has four situations, so a state with nowhere to stand is redrawn to one
the route reaches, and never allowlisted as a divergence.

Where a screen genuinely has fewer than four situations, the spare state
variant repeats the canonical content and the situations declaration in the
tests records why. Repeating a drawing is the honest answer; inventing a
fourth situation is not, and a reader who finds two entries drawing the same
screen should find the reason declared rather than guess at a rendering fault.

A situation the running product has that none of the four states describes is
never a fifth meaning for a state: it has its own component and its own entry.
A single drawing is a variant after the screen's states while the screen stays
within four variants; otherwise, and whenever the situation has states of its
own, it is a screen beside its owner, in the owner's folder, with those states
as its variants. A situation declared a `sibling` of its parent situation is
always a screen in that parent's folder, as the build details beside the
running build are. The situations declaration lists every one of them and the
inventory tests derive where each belongs, so the inventory stays exact and no
entry appears without saying what it draws.

Every situation path starts with `product/<family>/<screen>/`. Its final
segment matches its `name`, beneath its screen or declared logical parent.
A parent must exist under the same family and screen. The address recovery
situation is the explicit sibling exception: `workspace/slug-recovery`
keeps logical parent `workspace/slug` and name `recovery`. It is a sibling
screen because recovery has its own default and error states, as the
situations declaration records.

The callback directory's own screen keeps the title `Sign-in link · Pending`.
Its index supplies the directory's title and entry row. Its screens and states
are listed in [Callback landings](./product-mockups-account.md#callback-landings).

Every action label, segmented option and state title a screen draws must be a
string literal in the application source that renders that screen. The check
covers controls, the titles a state announces itself with and the sentences a
screen declares, not every line of copy, and it reads the application's reason
copy and placeholders from disk, so a fixture sentence cannot drift from the
sentence the product shows. A declared dropped sentence must stay out of both
the mockup and the application. The comparison runs in both directions: a
state title the catalogue draws and the product does not write, and a state
title the product announces that no declared screen draws. A screen the
application has not drawn yet names the path that will draw it, asserted
absent. A page whose essential prose the label check cannot read declares
those sentences, and its owner must write each one. Divergences waiting on a
change, including a declared sentence its owner does not write yet, live in an
allowlist that names the item closing each one, and a line that stops
diverging fails the suite until it is removed.

Sign-in and sign-up are product screens under `product/account/`, paths
`product/account/sign-in` and `product/account/sign-up`, each with the three state children.
They keep the Folio treatment, and the wordmark, Terms and Privacy are external
`href`s derived from the one site-origin fixture (see
[Marketing site](./marketing-site.md)), not `MockLink` catalogue destinations.
That fixture also places the site mockups' sign-in and sign-up destinations at
`/sign-in` and `/sign-up` beneath the same origin.

## Account And Onboarding

See [Account inventory](./product-mockups-account.md) for paths, states,
composition and recovery.

## Recovery

See [Recovery](./product-mockups-account.md#recovery) for the unmatched-route
screen and its repeated state drawings.

## Workspace And Project

The viewer is the application, so there is no project page and no workspace
page: switching, branch and pull request state, publication history and share
are slots the cloud fills in the hosted package, and the Viewer family below
draws those surfaces. See [Viewer](./viewer.md) and the navigation shell in
[Navigation](./product-navigation.md#navigation-shell).

## Settings

See [Settings inventory](./product-mockups-settings.md) for paths, states,
composition and recovery.

## Viewer

See [Viewer inventory](./product-mockups-viewer.md) for paths, states,
composition and recovery.

## Comments And Approvals

Deferred to the review phase with [Comments](./screen-comments.md) and
[Approvals](./approvals.md). The registered `comment-thread` and
`review-illustration` Design components stay registered, along with the
registered `textarea` wrapper whose owning screen arrives with that phase. The
registered `switch` draws the project pane's Automatic builds setting.

## Flows

Product owns three journeys; the site's separate tour belongs to Design at
`design/site/tour`.

- `flows/product-onboarding`: product/account/sign-up → product/account/magic-link →
  design/email/sign-in → product/account/create-workspace → product/account/install-app →
  product/account/choose-repository → product/account/project-created →
  product/viewer/standalone/publish/publishing.
- `flows/product-browse`: product/viewer/standalone → product/viewer/switcher →
  product/viewer/pull-request → product/viewer/history → product/viewer/share.

- `flows/product-invitation`: product/settings/members → design/email/invitation →
  product/account/sign-in → product/account/invitation-accept.

The two email steps use the Design screens in [Email](./email.md). A journey
may include a Design screen when that document is what the reader sees next.

Onboarding ends inside the new project's viewer, where its Open project action
reaches the default branch's first build running in the stage; a journey may
land on a named state entry when that state is where the scenario ends, and the
entry is still the owning screen for it. Browse follows Cal from the branch he is reading, through the switcher
into a pull request, then its history and its link.

UseCaseStep has no viewport selector. Serve frames each journey step's desktop
view, or its mobile view while the shell is at most 760px wide, and the
package's flow behavior is kept. Browser tests walk the
same owning mobile screens through Browse.

Every flow step reuses an existing owning screen and reciprocally lists the
flow path through `useCasePaths`; steps use `screenPath`.
The onboarding flow follows Cal. Canonical artboards keep their own
account identities; flows never silently substitute a different actor.
Entry metadata describes state transitions; it does not insert annotations into
the artboard. State examples are reachable as their owning screen's variants
and through contextual recovery links; mockups do not simulate real authentication or
write operations.

## Variant Slugs

[Variant slugs](./mockup-tooling.md#variant-slugs) defines authored
slugs and parent paths. Each variant uses its declared slug without a title
or filename guess.

## Fixture Scenarios

The test inventory declares the expected screens and asserts their count; no
prose repeats the number. The [fixture guide](../../mockups/src/fixtures/README.md)
owns scenario transitions, invitation acceptance and the nonfunctional
one-time token. The publications fixture owns the viewer's refs, publication
and history: one SHA per publication used consistently wherever that
publication appears, the default branch first, every publication state among
the branches, and a pull request authored by an active member rather than the
pending invitee. Its Share and whole-catalogue links resolve beneath
`/mokly-team/mokly-cloud` on the shared site origin. `builds.ts` owns the
build fixtures, one build per card state and per drawn cause, on the members'
branches and those same pull requests, with one head SHA each: a row, a
history entry or a publication that shows a build's SHA shows that same build.
Workspace and project fixtures carry `slug: "mokly-team"` and
`slug: "mokly-cloud"`; publications keep UUIDs.

Workspace creation and repository selection each draw a pending and a failed
address suggestion. The pending drawings are the
`product/account/create-workspace/suggestion-loading` and
`product/account/choose-repository/suggestion-loading` variants of their form screens; each keeps the populated owning
form and shows “Finding an available address” in the address preview under the
slug field, in place of the address, rather than replacing the form with the
screen's wait or inserting a line. The supplied name or repository remains
visible, and the pending state neither clears nor replaces an existing editable
slug.

On each suggestion-failure screen, the supplied name or repository remains
visible, the address field can be edited, and “Address couldn’t load” offers one
Try again. An existing nonempty suggestion stays submittable; an initially
empty field requires a value. All four drawings use the same owning form
component in both viewports. App parity requires both pending labels and has no
allowance for an implemented loading or recovery state. This is a catalogue
test that reads the application source.

## Reusable Controls

Registered wrappers keep their registrations, schemas and saved variants as
[Shared control registrations](./shared-control-registrations.md) defines,
and a screen uses a registered wrapper before adding any control. Use
semantic shared typography directly within registered layouts/screens; no
replacement primitive CSS. Static overlays use a registered local frame
composed of Firna controls because its `WebModalFrame` returns null in server
rendering; the live app must use the package modal. This explicit exception
and the layouts registered under it are documented in
[Shared controls](./shared-controls.md).
[Mockup verification](./mockup-verification.md) defines the policy tests that
enforce this inventory, and [Mockup tooling](./mockup-tooling.md) defines
output ownership: commit authored source, styles and assets, and let Git
ignore the build output.
