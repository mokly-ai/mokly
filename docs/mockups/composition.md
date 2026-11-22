# Mockup Composition

This is the detailed composition guide for the [Mockup catalogue](./README.md).

## Selected Folio And Canvas Styles

Product components live under `src/screens/product/`; shared fixtures remain
mockup-only. The account, recovery and settings families draw in Folio. The
viewer family draws its cloud parts in Canvas, around the `@mokly/ui` parts,
which keep the package's own look.
[`src/screens/product/viewer/published-viewer.tsx`](./src/screens/product/viewer/published-viewer.tsx)
and its `published-*` modules own the published package stage with cloud slots
filled. Their doc comments describe how the stage is drawn. Its rows and sample
screen come from `src/fixtures/viewer-catalogue.ts`.
`src/screens/product/shell.tsx` owns the cloud fallback and the blank stage
behind settings. The rest of `src/screens/product/viewer/` owns the chrome,
panel host, stage cards and six viewer screens,
`src/screens/product/page-parts.tsx` the section, state, pending, facts and
action parts, `placeholders.tsx` and `placeholder-rows.tsx` the placeholder
forms a wait draws, `src/screens/product/icons.tsx` the whole icon vocabulary,
`src/screens/product/account/account-shell.tsx` the one account panel,
`account/setup-progress.tsx` its progress strip, `account/entry-layout.tsx` the
logged-out account boundary, `src/screens/product/host.ts` where a screen runs,
a browser tab or the desktop app's window, and the glyph a GitHub action carries
there, and `src/screens/product/settings/surface.tsx` the settings dialog and
layer. Stylesheets follow the same split: `styles/product/folio.css` is the
settings rail and the stage, `viewer.css` the stage cards and what a panel
holds, `viewer-bar.css`, which `viewer.css` imports, the viewer root as the
bar's container with the window insets that it gives the package bar, both
compositions of the top bar with the centre's caps and the pill's label widths,
its one switch width and the application's probe of the switch,
`viewer-controls.css`, which `viewer.css` imports too, the bar's publication
pill, the reader's avatar and the account control, `viewer-depiction.css`, which
only the drawing's module imports, its sample screen and its comparison message,
`overlays.css` the registered panel frame and a row's three-dot menu,
`records.css` the panels, rows, facts and people, `inventory.css` the sections,
forms, notes and states, `builds.css` the build card a cloud build draws in the
stage, `settings.css` the overlay, `account.css` the account panel with its
canvas, progress strip and mobile edge-to-edge rules, `entry.css` the shared
sign-in/sign-up field stack, `recovery.css` the app-owned unmatched-path state,
and `chrome.css` the wordmark, identity and heading primitives. The viewer
drawings add the Canvas sheets, which their own modules import and the
application never loads: `viewer-canvas.css` the inline end of the bar's two
compositions and the search hint, `viewer-canvas-stage.css` the dot-grid stage
and its floating cards, `viewer-canvas-depth.css` the shade, the radius and the
shadows of a floating surface, `viewer-canvas-panels.css` the panels that the
slots open, `viewer-canvas-menu.css` the open account and More menus,
`viewer-canvas-check.css` the Mokly check beside the stage, and
`viewer-canvas-settings.css` the settings dialog over the viewer.
`styles/fonts/` holds the self-hosted Geist and Geist Mono variable faces of the
Canvas palette, copied from the `geist` npm package, with their SIL Open Font
License. `styles/site/fonts/` holds the Instrument Serif face of the site's
drawn demo app with its license. `styles/email/` holds the inbox frame and
byte-identical copies of the published logo lockups in
`apps/site/public/brand/`. The message table uses separate borders with zero
spacing so the card border follows its corners. Its fixtures use the app
callback, sign-in and member settings routes.

Every standard owning screen in the account, recovery, settings and viewer
families draws its canonical state, with Empty, Loading and Error as its
variants. A situation none of those four describes is a further variant while
the screen stays within four, and otherwise a screen beside it in its folder:
the entry screens' `github-refused`, `github-opens-soon` and
`address-refused`, and the desktop app's window entry, `desktop`, with its
`waiting` variant, each drawn on both sign in and sign up, the populated
workspace and repository forms while their address suggestions load,
Create workspace's write, the workspace and project address editors,
`product/settings/project/visibility`, `product/settings/members/identity`,
the install step's member, reviewer and connect drawings, its write and its
suspension while its link is read or after that read failed, in the
`product/account/install-app` folder, the repository step's open select, its
one-account select, its write and its CLI form with its wait for the
workspace, the project pane's Automatic builds switch while it saves, the
Account, Workspace, Members, Project, Delete project and Billing panes asked
for by their address while the settings scope loads, the Account pane while
the session loads, the Billing pane's durable route on a wide surface until it
hands over to the dialog, each pane write that no state
of its pane draws, such as Connect GitHub, Add GitHub account, Upgrade to
Team, Manage billing, Check again, Send invitation, Revoke invitation, Save
role, the Workspace pane's Save and Make private, the
GitHub accounts pane's suspended, member and row menu drawings,
and the viewer's own, `product/viewer/standalone/reader` among them, with the
route's project read, the read of a publication's address, the workspace read
that decides the Team card and a publication that CI still uploads, each over
the stage's waiting card, and the build details one folder deeper:
`product/viewer/standalone/build` owns that
folder, and the failed, superseded, unreadable, lockfile, refused and reader
builds are screens beside it because each is declared a sibling of its parent.
The install step's and the GitHub accounts pane's single drawings are declared
siblings the same way, so that the desktop app's window drawing of each, like
the account pane's, is that screen's fourth variant, `desktop`: its GitHub
action keeps its label, carries the external glyph and opens the same page on
the web. The connect page, `product/account/connect-desktop`, is a standard
screen whose fourth variant, `opened`, draws the page once **Open Mokly** has
handed the grant to the app.
`product/viewer/pull-request` owns its folder the same way, with the closed,
fork and Team pull request cards beside it. The refused publishing card is a screen
beside `product/viewer/standalone/publish`, which already holds four variants;
it and the build card compose one control-with-guide fragment,
`src/screens/product/viewer/control-guide.tsx`. A confirmation or
reveal a settings pane opens over itself is drawn the same way:
`product/settings/project/visibility` carries both role-specific free-plan refusals as
variants, `product/settings/tokens/create` carries naming a token through to
`product/settings/tokens/create/copy`, `product/settings/tokens/revoke` carries the row menu, and
`product/settings/members/remove` and `product/settings/github/remove` carry
losing access. Recovery repeats its canonical
drawing for Empty, Loading and Error because an unmatched route reads no
product data. `src/_tests_/product-situations.ts` declares every one of them,
`product-inventory.ts` derives which are variants and which are screens, and
`src/_tests_/product.test.ts` asserts the inventory's size, so both the set and
the count live there and in no prose. Each source module default-exports one
screen, whose one render draws a named screen component. A screen with
variants selects each state's component from the `state` prop that the
variant sets. The three product flows
reuse these owning screens. Onboarding includes the sign-in email and ends on
the new project's viewer while its default branch's first build runs. The
invitation flow starts at the members pane and includes the invitation email,
sign-in and acceptance handoff. Fixture lifecycle snapshots and the
nonfunctional token example are documented in
[Fixtures](./src/fixtures/README.md).

The shared sign-in callback is the deliberate exception to the four-state
shape. Its callback directory holds the pending sign-in screen, then an
Email and a Preview screen whose variants are the exact invalid, expired, used
and generic failures in
[Authentication callbacks](../protocol/cloud/auth-callbacks.md), so no screen carries
more than four variants and no protocol outcome is relabelled as an empty or
loading state. The directory owner keeps `Sign-in link · Pending` as its title;
its index replaces the old `Sign-in link landing` folder label.
Its wait is one state card in placeholder form, and its name is for screen
readers only because the account heading already names the operation. Preview failures use
the shared error state with hidden announced copy, so their problem glyph and
alert semantics do not add a second visible title. Rendered policy checks reject
either an error state with no announced copy or a visible pending label that
repeats its screen heading.

The callback directory's fourth screen,
`product/account/callback/desktop-expired`, draws the desktop landing in the
app's window, as
[Authentication callbacks](../protocol/cloud/auth-callbacks.md#desktop-callback)
defines: its expired sign-in, with its generic failure as its variant. Both
use the preview landing's shared error state and offer only **Back to sign
in**, which leads to the window's entry screen, and neither draws any part of
the grant or the verifier. Its pending state is the directory's pending
screen. The GitHub installation landings follow as five screens without
variants: the request a GitHub organization owner approves,
the authorization callback's conflict and not-an-administrator refusals, and
the setup landing and the authorization callback while they complete the
installation, each its title over one state card in placeholder form whose
title names the operation. Their reader started the flow signed in, so their
header names the reader.
`src/_tests_/callback.test.ts` holds the landings' checks, and
`src/_tests_/desktop-sign-in.test.ts` those of the desktop app's sign-in: the
window's entry, the connect page and where the window's landing leads.

`design/settings-dialog`, `design/settings-layer` and `design/panel` are the
registered overlay frames: the desktop rail-and-pane settings dialog, the mobile
full-screen settings layer, and the viewer's panel, which is a centered modal on
desktop and a bottom sheet on mobile. A settings pane's own confirmation and
reveal modals take that same panel, and so does the mobile sheet of
`design/responsive-menu`, a row's three-dot menu, which opens as an anchored
popover on desktop. The panel frame and the menu live in `styles/overlays.css`,
which `components.css` imports, so component previews and product pages draw
them alike. Each takes its content as a slot and owns
no `main` landmark or `h1`. The dialog is bounded between `min(700px, 90dvh)`
and 90dvh, in the catalogue exactly as in the running app, so switching panes
cannot resize it.
`design/write-failure` is the one drawing of a refused write: the cause above
the control, the control as the way back in its `control` slot, and the
reference Mokly answered with in a collapsed disclosure. Every control that
writes in the settings and account families references it, so no surface words
a failure of its own; a failure raised in the browser passes no reference,
draws no disclosure and keeps its own control's label, and a refusal the
reader's own text produced is said on the field instead, so the fragment passes
no cause and keeps the control's label with the reference still beneath it.
`ErrorDetails` in `src/components/error-details.tsx` draws one closed disclosure
for a state’s optional diagnostics and reference. `ErrorReference` uses that
same component. Supplying both values never creates a second disclosure.
Catalogue-only links below an artboard use `CatalogueLinks` and the shared
`.catalogue-links` style in `base.css`.
`components.css` is the
disclosure's only style owner, and the application uses it from there:
`packages/app/scripts/sync-styles.mjs` serves these stylesheets to the application
too, so a second declaration there would draw the same composition twice.
`packages/app/public/app.css` contains no second disclosure style.

`src/_tests_/app-owners.ts` declares who answers for each drawn screen and
`src/_tests_/app-parity.ts` compares them, tying the drawings to the running
product. `app-parity-reads.ts` reads both sides, `app-parity-owners.ts` checks
that the owner table stays true, and `app-parity-sentences.ts` checks the
sentences that `app-sentences.ts` names. Every
action label, segmented option and state title a screen draws must be a string
literal in the application source declared for that screen — checked against
that source with its comments stripped, and only while that file still writes
something _this_ screen draws, so a file a screen stopped drawing from names
its own repair instead of keeping its place on every other screen's credit. A
screen the application has not drawn yet names the
path that will draw it, asserted absent, so the milestone landing forces the
declaration. The comparison also runs the other way: a state the product
announces that no screen drawing from that file shows is a divergence too, so a
product that grows a state cannot stay invisible. `app-state-titles.ts` reads
those titles from `StateMessage`, `PaneError`, `PaneResource` and `StageError`,
so a section heading or a dialog's own name never enters the comparison.
`app-sentences.ts` names exact sentences no label carries, such as a Billing
page with no control or a GitHub installation landing's heading, which the
drawing and the owning source must both say, and sentences a redraw removed,
which both must leave out. The
fixtures' reason sentences and placeholders
are read from `packages/app/src` on disk. Each direction has its own allowlist in
`app-parity-allowances.ts`, declared sentences have a third, and every line in
any of them names the follow-up item in `plans/follow-ups/` that removes it.
`design/review-illustration` registers the fictional product scene, browser/phone,
review panel, art tiles, and SVG motifs through the `detail` prop. Its five saved
variants are Fieldnotes, Screen review, Screen art, Journey art, and Change art.
It remains Design-only historical material, with every saved variant retained
and no required screen consumer. Use stable instance keys; keep helpers under
`src/components/illustrations/` and owned CSS under `styles/illustrations/`.
The illustration declares no `dependencies`, because Mokly derives the inputs
of each render from its imports. The fallback Design rule loads
its illustration styles; the preserved Folio screens use their own layout rules.

## Shared Control Adoption

The catalogue uses `@firna/ui` 4.0.0 and the verified peers, with
`@mokly-cloud/tokens/shared-ui-theme` as the sole control theme mapping, shared
with the application. Button, input, and badge retain their saved variants.
Button adds a danger tone and the optional `block`, `size`, `icon` and
`accessibilityLabel` props; Badge adds an optional dot; the content list adds
optional row `status`, `meta`, `mono` and `choose`; the settings frames add a
`header` slot. Input adds an identifier type that disables automatic
capitalization, correction and spellcheck for address fields. Field and list
wrappers select the package density from the viewport — compact for pointer,
roomy for touch — and only mobile floors a control at 44px, while desktop keeps
the size scale and extends the target with hit slop. The thread composes Avatar
and a single dotted Badge, filling its container; StatusDot remains a separate
registered control. Component previews adopt the paper palette. The static
renderer supplies a no-op press/change handler, and Mokly collects the RNW
styles of each render. The full resolution and focus contract is
in Shared controls. The accepted `selected-fieldnotes` evidence is preserved.
The design captures and before/after sheets live in
`.context/mockups-smoke/contact-sheets/firna-adoption/`.

`textarea`, `segmented`, `switch`, `options-list`, `selector`,
`responsive-menu`, `content-list`, `skeleton` and `table` wrap public Firna
exports. `selector` is the closed `DropdownSelector` a reader opens, with
chosen, placeholder, disabled and waiting variants at the input's viewport
density, and it takes its choices flat or in titled sections; `options-list`
is the surface it opens. `skeleton` draws the placeholder forms of a wait as
its variants, and `controls.css` holds the waiting region's and the forms'
rules, which the Design pages load too. The repository step's open drawing places that list beneath the
closed field in the package's own surface chrome, with the search field and
one titled section for each GitHub account, because the live surface portals
from an effect and draws nothing in static markup. Table's optional large
density uses Firna Body for ordinary cells; its earlier saved variants keep
their density.
Canvas binds the shared semantic roles on every screen document's root, with
its Firna theme, whose solid fill is the signal green. Component previews
retain paper through `.paper-scope`.
`textarea` stays registered with its variants while the screen that consumed
it waits for the review phase; `switch` draws the project pane's Automatic
builds setting, with its `working` word beside the label while that setting
saves and its `waiting` form while the settings scope loads.
Header, PageFrame and Card remain registered Design material without forcing
unused layout patterns into Folio screens. Candidate-specific palettes and styles are retired.
