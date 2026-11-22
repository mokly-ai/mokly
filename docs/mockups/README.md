# Mockup Catalogue

This is Mokly Cloud's design specification, authored with the workspace
`@mokly/mokly` package. Review these screens before implementing product UI.

## Responsibilities

- Hold every product, site and email screen as TSX source, with the fixtures,
  styles and registered base components they draw.
- Generate the catalogue through the workspace `@mokly/mokly`, and draw the
  viewer family's ready canvas from the parts of the workspace `@mokly/ui`.
- Verify the catalogue with the policy, determinism and browser tests under
  `src/_tests_/`, which read the protocol docs and the application source.
- Keep the product app, the public site and the emails aligned with these
  drawings: the app copies the stylesheets and components the catalogue owns.

## What This Catalogue Does

The account, recovery and settings screens use Folio, the design system that
[Design tokens](../protocol/cloud/design-tokens.md) defines: self-hosted Geist
and Geist Mono, a 13px application-chrome type ramp, a designed three-level
surface system in both schemes, record rows with status and commit metadata, a
settings dialog, and one restrained accent. The account family is one raised 440px panel on a
dotted canvas with the wordmark inside it and a progress strip on the three
setup steps. The public site and the cloud's own parts of the viewer family
draw in Canvas, the palette that `@mokly/ui/palette` exports: a dot-grid
canvas, floating surfaces, self-hosted Geist and Geist Mono, and one signal
green. The viewer family draws a ready publication as a static depiction of
`@mokly/ui` parts, which keep the package's own look, with the cloud controls
in its two top-bar slots and a sample screen in its phone and browser frames.
Its full bar holds the project switcher, the
publication pill, History, Share and the reader's avatar, which opens the
account menu with Theme, Settings and Sign out. Its compact bar keeps the
pill and groups the rest under More. A pull request's desktop drawing shows
the Mokly check in the side panel. The viewer family opens the registered
`panel` frame as a desktop modal or a mobile bottom sheet, and a reference
with no ready publication shows the card that the
[reference stage order](../protocol/cloud/viewer-builds.md#references-without-a-ready-publication)
chooses, such as an active build's card.
[Folio chrome](../protocol/cloud/folio-chrome.md) specifies the compositions, and no
screen adds a layout rule of its own.

The public site has eight screens and a Design tour: the home, the
documentation, the changelog, pricing and the four approved legal pages.
Their entry paths are `design/site/*`; the home's `design/site/home/menu`
state draws the open mobile menu, and the documentation's `first-screen` and
`layers` states draw the HTML sample fence and the mobile tree sheet. The
home draws a fictional demo app, `acme/storefront`, as static parts. The two
delivered emails are Design screens too, drawn from the source under
`src/emails/` that also generates the templates the API sends. The settings
panes are drawn here over a blank stage, in the desktop dialog and the mobile
layer.

The authoring and generated output paths are:

| Path                                       | Responsibility                                                     |
| ------------------------------------------ | ------------------------------------------------------------------ |
| `mokly.config.json` at the repository root | Data-only package configuration                                    |
| `docs/mockups/src/entries/`                | `*.mockup.tsx` modules, each default-exporting one definition      |
| `docs/mockups/src/components/`             | Typed registration inputs and reusable base-component TSX          |
| `docs/mockups/src/screens/`                | Named product, site and email screen components                    |
| `docs/mockups/src/emails/`                 | Email definitions: typed content, styles, document and bodies      |
| `docs/mockups/src/fixtures/*.ts`           | Explicit mockup data and copy                                      |
| `docs/mockups/src/render.tsx`              | The renderer: one wrapper with the palette, theme and styles       |
| `packages/tokens/src/`                     | Shared token values, palettes, token CSS and the control theme     |
| `docs/mockups/styles/`                     | Public CSS using shared token variables; app/site parity checks    |
| `docs/mockups/src/_tests_/`                | Catalogue policy and browser smoke tests                           |
| `apps/mockups/`                            | Package dependencies, React peers, scripts, and test configuration |
| `mokly-static/` at the repository root     | Ignored build output: documents, catalogue index and entry details |

The root is `{ dir: "docs/mockups/src/entries", files: ["**/*.mockup.{ts,tsx}"] }`.
Directory and file names derive paths such as `product/settings/tokens`.
A directory owner uses `tokens/index.mockup.tsx`, not `tokens/tokens.mockup.tsx`,
and has a direct sibling entry module. Canonical entries never author `path`;
the directory and filename define identity. Source policy tests reject
repeated owner names and lone index files. Other screens keep ordinary file
slugs. No `_folder.json` record is needed; slug-derived titles and default
order suffice. An index screen or component supplies its folder title.
Variants use required slugs such as `empty` and `primary`.
See [hierarchy and folder choices](../protocol/cloud/mockups.md#catalogue-hierarchy).

`npm run mockups:build` writes the static catalogue to `mokly-static/`, and
no output lives under `docs/mockups`. Rendered documents mirror entry paths
below `mokly-static/static/mokly-generated/`, such as
`product/settings/tokens/index.desktop.html` and
`product/settings/tokens/empty/index.desktop.dark.html`. The catalogue index is
`mokly-static/mokly-viewer/index.json`, version 9, and each entry's detail is
`mokly-static/mokly-viewer/entries/<path>.json`, version 4. Git ignores the
output and the `.mokly-export-reservations/` directory beside it; the
configuration names no output directory.
[Repository generated files](../protocol/cloud/repository-generated-files.md)
owns the ignore rules.

## Quick Start

Run from the repository root. Build before the other commands.

```sh
npm ci
npm exec --workspace @mokly-cloud/mockups -- playwright install chromium
npm run mockups:build
npm run mockups:check
npm run mockups:test
npm run mockups:typecheck
npm run lint
npm run mockups:serve
```

`mockups:serve` prints the Browse URL and keeps its documents in memory. A
built screen document opens directly from disk, for example
`mokly-static/static/mokly-generated/product/settings/tokens/index.desktop.html`.
From disk, its request for Mokly's frame probe script fails, because Mokly links
that script from the site root.

## Development

Author against the workspace `@mokly/mokly` README and its public
declarations; the catalogue uses only the package's exports and its
documented output artifacts. Mokly changes follow the
[artifact compatibility procedure](../protocol/cloud/mokly-artifact-compatibility.md#mokly-changes).

Stylesheet rules in `mokly.config.json` match entry routes `<path>/index.html`
and name repository-relative paths: the site rule links Geist, Instrument
Serif and the site stylesheets in order, Account, Recovery, Settings and
Viewer take the Folio stylesheets, the email rule links only the base
stylesheet and the inbox frame, and everything else takes the Design
stylesheets. Add a new product family's directory to the Folio pattern,
because an unmatched path silently receives Design styles; scheme-only CSS
uses `lightStylesheets` or `darkStylesheets`. No rule links the viewer's
Canvas sheets: the drawing module that needs one imports it, so Mokly bundles
it into that entry's own stylesheet after the Folio sheets, and the
application never loads it.
[Mockup tooling](../protocol/cloud/mockup-tooling.md) defines the rules.

### Add Or Change A Screen

See [Add or change a screen](./add-or-change-a-screen.md) for the authoring
steps, the entry shape and how a variant inherits from its screen.

### Add Or Change A Registered Component

1. Keep the typed input in `src/components/<name>.tsx`, built with
   `componentInput` and `componentMetadata`. Register it in
   `src/entries/design/<name>.mockup.tsx`: the default export is
   `defineComponent(<name>Input)`, and a named export is its `Component`
   wrapper, which screens render.
2. Declare a closed JSON Schema `propSchema`: `additionalProperties: false`
   on every object and no `default`. Props are plain JSON data. React content
   is a declared slot, and a saved variant supplies it in its `slots` map.
3. Give the component its own `props`, which its page renders first and
   without slot content. Keep only the keys that every saved variant sets,
   because a variant replaces top-level keys and cannot remove one.
4. Keep at most five saved variants, each with a required `slug`. Read the
   viewport from the render's `context`. A component inside a screen takes
   that screen's palette and control theme from the renderer.
5. Omit an optional prop that has no value when you render a wrapper. Mokly
   refuses an `undefined` prop value.

### Commands

| Command                     | Outcome                                                                     |
| --------------------------- | --------------------------------------------------------------------------- |
| `npm ci`                    | Install the single npm workspace lockfile                                   |
| `npm run mockups:build`     | Build the catalogue into `mokly-static/` with `build --strict --no-changes` |
| `npm run mockups:check`     | Validate with the same strict build into `.context/mockups-check`           |
| `npm run mockups:test`      | Check build determinism, policy and all Chromium smoke tests                |
| `npm run mockups:typecheck` | Typecheck the renderer, components, entries, scripts and tests              |
| `npm run mockups:serve`     | Run the workspace package's `mokly serve` and open its printed URL          |

The root forwards each command into the `@mokly-cloud/mockups` npm workspace,
whose [README](../../apps/mockups/README.md) explains the test harness. Build
and check pass `--strict`. Tests require the build output and fail with the
root Build command when it is absent; they first compare every path and byte
with an independent strict build, and a mismatch lists the sorted missing,
extra and changed paths.

The browser suites write every full-page capture under `.context/mockups-smoke`,
mirroring the output path, with the served journeys under `served/`. Mobile
journey captures come from the served fragment at 390px in both themes, so
they include content below Browse's iframe viewport; compose journey sheets
from those ordered captures. Stop an interactive Serve session before the
browser suites, and run the disk and served suites one after the other. The
served suite starts Serve over a base ref that does not exist, so Changes stay
unavailable and no base is prepared;
[Mockup baselines](../protocol/cloud/mockup-baselines.md) explains why. Mokly keeps
base sources and installs in its cache under the operating system's cache
directory, never in the repository, and deleting that cache is safe.

### Review Policy

- Screens show product copy and decisions, with notes in entry descriptions,
  rationale, related docs, or catalogue-only sections outside the artboard.
- Every screen has mobile and desktop views in light and dark. A screen draws
  its canonical representation and carries at most four variants, so five
  semantic states at most; viewport/theme combinations do not count as
  additional states. Flows reuse existing screens and are exempt from that
  limit.
- Folders group screens; they are not screens. A screen with sibling screens
  takes a folder named after it, and the entry tree mirrors the folders.
- Fixture data is allowed here. Keep it in mockup fixtures or explicit component
  variants; never carry fictional counts, customers, testimonials, or activity
  into the product app. Avoid invented claims about Mokly anywhere in the
  catalogue. The site screens' demo app is fictional, and they may depict a
  feature that ships before go-live, as
  [Public site](../protocol/cloud/site.md) allows.
- A fresh screen needs meaningful empty, loading, or error variants when its
  owning spec calls for them. Add new owning screen entries before adding them
  to a flow.
- Inspect copy at both widths, keyboard focus, contrast, overflow, all links,
  and light/dark output. Check the onboarding journey end to end and every
  settings pane from the viewer slots.

### Key Code

- `src/screens/design/site/` — the eight site screens: `home_screen.tsx`, `docs_screen.tsx`, `changelog_screen.tsx`, `pricing_screen.tsx` and `policy_screens.tsx` (the four legal documents), each drawn as a part of a design file on the dot-grid canvas.
- [src/screens/design/site/parts/](./src/screens/design/site/parts/) — the shared site mockup parts: `links.ts` (catalogue paths, application links and current-page marking), `metadata.ts` (the related documents that every site entry records), `brand.tsx` (mark and wordmark), `chrome.tsx` (`SiteLayout`: the skip link, the tool bar with the file title and the people in the file, the open menu and the footer), `menu.tsx` (the mobile menu control and the open menu), `footer.tsx` (the footer frame with the scheme control of `scheme-control.tsx` and the status bar), `actions.tsx` (the action pair), `icons.tsx` (`SiteIcon`, the Canvas icon set, drawn from `icon-drawings.tsx` and `icon-drawings-pages.tsx`), `labels.tsx` (kickers, chips and section boxes), `frame-label.tsx` (a frame's label and size), `selection.tsx` (the selection box, the size tag and the spacing redline), `panel.tsx` (the floating panel), `page-frame.tsx` (a document page as a selected frame), `people.tsx` (the depicted people, their presence and their cursors), `trail.tsx` (the location trail), `legal-documents.tsx` (the approved legal text) and `version.ts` (the depicted package version).
- The documentation parts in the same folder: `docs_data.ts` (the documentation architecture), `docs-pages.ts` (the model of a drawn guide), `docs-install.tsx` and `docs-first-screen.tsx` with `docs-first-screen-code.ts` (the two guides drawn word for word), `docs_navigation.tsx` (the Layers panel with search and the version), `docs-inspect.tsx` (the Inspect panel), `docs-page.tsx` (the guide as a page frame), `docs-sheet.tsx` (the mobile sub-bar and the tree sheet), `docs-sample.tsx` (the HTML sample fence) with `docs-sample-frames.tsx` (its Mobile and Desktop frames) and `code_panel.tsx` (the code panel, dark in both schemes).
- The changelog and pricing parts in the same folder: `releases.ts` with `release.ts`, `native-releases.ts`, `catalogue-releases.ts` and `early-releases.ts` (the depicted releases), `changelog-facts.ts` (the anchors, dates and counts derived from them), the `changelog-*.tsx` parts (Version history, the timeline, the filter, the release frames with their notes and upgrade notes, and Earlier releases), `pricing-data.ts` and `pricing-questions-data.ts` (the plan facts and the resolved questions), and the `pricing-*.tsx` parts (the plan frames, the comparison and the questions).
- `src/screens/design/site/home/` — the home's parts: the hero, the spread of the fictional `acme/storefront` app with the artboards and components of `home/acme/`, the workspace with the Specs panel, the Browse, Review and Edit frames with their depicted viewer, comment thread and agent, and the open foundation with its steps.
- `src/render.tsx` — the Mokly renderer. Mokly calls it around each screen render and each component page render, never around a registered component inside a screen, and it returns one `MockupDocument` wrapper.
- `src/document.tsx` — `MockupDocument`, the one wrapper node of every document: `lang`, `data-color-scheme`, `data-viewport` and the palette scope class, whose scheme and palette the styles read instead of `html`; Firna's `domBackendCss` and the token custom properties, with the Canvas scope's roles and fonts in a Canvas document, as `style` elements, which Mokly moves into the head before the configured stylesheets; the static control theme; and on a component page the paper preview host, a `main` with the entry's own title as its heading.
- `src/document-palette.ts` — `documentPalette`, the palette from the entry's kind and path, because Mokly passes the renderer no tags: paper on a component page, Canvas under `product/viewer/` and `design/site/`, Folio elsewhere under `product/` and under `design/email/`, and the base palette elsewhere.
- `src/render-context.tsx` — `useMockupRenderContext`, the document that a render draws: its scheme, its viewport and the entry's effective path, which the renderer's wrapper provides.
- `src/resource-root.tsx` — `useRepositoryFile`, which addresses a repository file, delivered at `static/{repository path}`, from the current document, by the depth of its entry path.
- `src/entries/design/*.mockup.tsx` and `src/components/` — the registered components: each entry's default export is the `defineComponent` definition of the typed input in `src/components/<name>.tsx`, which `componentInput` and `componentMetadata` in `src/components/metadata.ts` build, and each entry exports the wrapper that screens render. The generated catalogue's Components view lists each component's props, slots and saved variants.
- `src/components/panel.tsx`, `src/components/settings-dialog.tsx`, `src/components/settings-layer.tsx` and `src/components/write-failure.tsx` — the registered frames `design/panel`, `design/settings-dialog` and `design/settings-layer`, the static overlay exception, and the `design/write-failure` fragment, the one drawing of a refused write.
- `src/components/selector.tsx` — `design/selector`, the closed `DropdownSelector` the account steps draw at the input's viewport density, its choices flat or in titled sections, and its waiting form while its choices load; `src/components/options-list.tsx` is `design/options-list`, the surface it opens, which the repository step's open drawing anchors beneath the field in the package's surface chrome.
- `src/components/skeleton.tsx` — `design/skeleton`, whose saved variants draw the placeholder forms inside their waiting region: a project's heading and facts, the fields, the controls, the list and table rows, and the state card.
- `src/components/responsive-menu.tsx` — `design/responsive-menu`, a row's three-dot menu: the package's `PopoverSurface`, `DropdownList` and `useDropdownSurfaceStyles` on a pointer viewport and the registered panel sheet, `MenuSheet`, on a touch one, because the live `ResponsiveMenu` portals from an effect and renders nothing in static markup, with `RowMenuContent` as the menu data that the trigger and the sheet share.
- `src/components/error-details.tsx` — `ErrorDetails`, one closed disclosure for a state's optional diagnostics and request reference; the application carries the same component.
- `src/components/catalogue-links.tsx` — `CatalogueLinks`, the navigation of catalogue-only links below an artboard, styled by `.catalogue-links` in `styles/base.css`.
- `src/components/layer-beneath.tsx` — `LayerBeneath`, the one drawing of a layer beneath an open layer: the desktop settings page backdrop, the settings frame beneath a confirmation modal or a mobile row menu's sheet, and the viewer beneath an open panel. It always sets `inert` and `aria-hidden` together. With a class name it is the drawn backdrop, and without one it draws no box, so a registered frame keeps its place in the parent's layout.
- `src/components/review-illustration.tsx` — `design/review-illustration`, whose `detail` prop selects the scene or an inline motif; its helpers live under `src/components/illustrations/`.
- `src/components/window-controls.tsx` and `src/screens/product/mac-window.tsx` — `design/window-controls`, the native macOS window buttons as illustration material, and the parts a Mac app drawing composes: `macWindowClass` on its screen root, `MacWindowControls` over the start of the window and `MacWindowLinks` below the screen. `styles/illustrations/window-controls.css`, which only the illustration's module imports, draws the buttons and the drawn window's inset.
- `src/screens/product/shell.tsx` — `ViewerStage`, the cloud stage with its fallback cards and the blank stage behind the settings dialog.
- `src/screens/product/viewer/stage.tsx`, `stage-card.tsx` and `stage-access.tsx` — the stage's cards: `stageBody` and the cards for failures; `StageCard`, the one card the cloud fallback owns; `StageWait`, the stage's waiting card, which every stage read draws with the read named in its title; and the three answers of a publication's own host for private access. `bar.tsx` is the fallback top bar, in the Canvas composition of the ready bar around the cloud's own mark, which draws its controls' waiting forms while the route reads the project, and `wait-screens.tsx` holds the viewer's waits that are screens of their own: the project read, the read of a publication's address, whose reference trigger waits as a placeholder, the workspace read that decides the Team card and a publication that CI still uploads. While the route reads the project, `chrome.tsx` draws the whole frame as one waiting region: its heading holds the read's name for screen readers, so the stage's waiting card draws its title as a bar. Every viewer drawing renders that chrome, so its module imports the Canvas sheets of the bar and of the dot-grid stage.
- `src/screens/product/page-parts.tsx` — `Section`, `StateMessage`, `Pending`, `Facts`, `Action`, `BackLink` and the link parts every product screen composes; the application carries the same parts. `Pending` is the waiting region of a read: it draws the layout that the read waits for, sets `aria-busy` and names the operation once, in a text place its layout gives it or for screen readers only. `Action` takes `busy`, the operation its running write names: the registered button's busy spinner and working word, with a screen-reader status and nothing inserted. `AddressPreview`, the address under a slug field, holds a bar or a read's name in place of the address while that read runs.
- `src/screens/product/placeholders.tsx` and `placeholder-rows.tsx` — the placeholder forms of the [Wait](../protocol/cloud/folio-chrome.md#compositions) composition, each in its part's own frame: `TextBar` for a text the answer supplies, `ControlPlaceholder`, `StatePlaceholder`, `factPlaceholder`, and the member, note and content-list rows; `WaitRegion` is the region that `Pending` draws. The registered input, selector and switch draw their own waiting forms, and a waiting input's label can keep its known words beside a bar for a name the answer supplies (`labelWaits`); the content list and table draw a row's waiting form from its `waiting` flag; a waiting list row keeps a title or detail its caller already knows as text and draws an empty one as a bar. `StatePlaceholder` takes the size its surface gives a State card's action, and `WaitingDot` is a status dot whose tone the answer supplies. No drawing and no application screen draws a generic block of bars, and the stylesheets hold none. A wait's name keeps the `fo-pending-label` class, which the parity checks and the document policies read.
- `src/screens/product/navigation.tsx` — `Brand`, `SiteBrand`, `Account` and `SectionHeading`, the wordmark and identity controls of the product chrome, and `AccountPlaceholder`, the identity's placeholder while the session read runs. A section heading that only a non-empty list shows takes `{ bar }` while that list is read, and `Section` passes it through.
- `src/screens/product/settings/surface.tsx` — `SettingsSurface`, which renders a pane in the registered dialog on desktop and the registered layer on mobile. Its rail draws each pane whose address the surface does not know yet disabled, with no link.
- `src/screens/product/host.ts` — whether a screen is drawn in the browser or in the desktop app's window, and the glyph each GitHub action carries there; `account/desktop-entry.tsx` and `account/connect-desktop-screen.tsx` draw the window's entry screen and the browser page that gives the app its grant.
- `src/screens/product/account/account-shell.tsx` — `AccountShell`, the one account panel with its header identity and legal footer. Its `wait` makes the heading, the body and the line below one waiting region, which names the read in the line under the title, in the body or for screen readers only; a heading the answer decides draws a bar and holds the read's name for screen readers, so it stays the screen's one heading. `setup-progress.tsx` holds its progress strip, which claims only the steps a reader has done, and `entry-layout.tsx` the shared sign-in and sign-up field stack.
- `src/screens/product/account/repository-field.tsx` — `RepositoryField`, the repository step's select, flat for one GitHub account and grouped by account for several, with its manage line, its open list and its waiting form; `choose-repository-form.tsx` is the step's form, which its loaded drawings, its wait and its write all draw, and `cli-link.tsx` is the line to the CLI form that the install and repository steps draw, as text with no link while the workspace is read.
- `src/screens/product/setup-destinations.ts` — where each setup control leads: the setup step, the CLI form and the finished project, each chosen from the workspace's installation or the new project's builds, which every caller names.
- `src/screens/product/settings/github-pane.tsx`, `github-accounts.tsx` and `github-remove.tsx` — the GitHub accounts pane: its account rows with their row menu and the section's Add GitHub account, which the pane, its wait and that control's write all draw, the reader's role and the remove modal.
- `src/screens/product/settings/members-sections.tsx` — the members pane's parts: the people, the invitations, the invite form and the person the reader manages, each with its waiting form; `members-pane.tsx` also draws the pane asked for by its address while the settings scope loads, its headings keeping their known words beside a bar for the workspace's name. The Account, Workspace, Project and Delete project panes read nothing of their own, so each draws that scope wait from its own layout: `account-pane.tsx`, `workspace-form.tsx` with `workspace-pane.tsx` and `workspace-projects.tsx`, `project-form.tsx` with `project-pane.tsx`, and `danger-pane.tsx`, with each text the scope supplies as a bar and each control in its waiting form. `account-pane.tsx`, with its GitHub section in `account-github.tsx`, also draws the Account pane while the session loads, with the session's texts in their placeholder forms, and `billing-waits.tsx` the Billing pane asked for by its address while the session and the scope load, and its durable route on a wide surface until it hands over to the dialog, with the Project panes disabled in the rail. `row-placeholders.tsx` holds a settings row's three-dot trigger and status badge in placeholder form. Each pane draws its read's wait from its own layout, inside `Pending`, and each write holds its control busy through `Action`; `billing-writes.tsx` draws the Billing pane's three writes.
- `src/screens/product/viewer/published-viewer.tsx` — `PublishedViewer`, a ready publication as a static depiction of `@mokly/ui` parts: the embedded layout with the cloud controls of `published-slots.tsx` in its top-bar slots, the `⌘K` hint of `search-hint.tsx` at the end of the package's search field, the catalogue navigation of `published-navigation.ts`, and the workspace of `published-workspace.tsx`. A pull request's desktop drawing fills the `sidePanel` slot with `ChangesCheck` of `check-panel.tsx`, the cloud's Mokly check as a floating panel. `published-bar.ts` serves the published and the fallback drawings: it says which compositions a slot draws and gives the compact name of a reference, and it gives each published slot its classes. A phone draws the compact bar, and a desktop drawing draws both bars for the switch in `viewer.css` to show one. `published-view.ts` finds the view of the current screen that each viewport shows from its view records, as the viewer does: under Dark, the dark view, or the light view that the package labels Light only. It also gives the workspace that view's status, its comparison band and the change marks of the view controls, under the screen controls rule of `@mokly/mokly`. `published-frame.tsx` draws the phone and browser frames in the shown views, and each frame holds the sample screen of `sample-screen.tsx`, which paints the Canvas palette of that view's scheme from the shared tokens. A private comparison's message fills the `stageOverlay` slot, as in the app, and the workspace draws the same message over the preview pane, because the package reveals that slot only by a browser measurement.
- `src/screens/product/viewer/standalone-page.tsx`, `pull-request-page.tsx` and `slots.tsx` — `StandalonePage` and `PullRequestPage`, the two viewer entries whose chrome names the branch or pull request and whose stage holds its publication or one card, and the trigger slots both fill. `BranchSlot` and `PullRequestSlot` draw the publication pill of `pill.tsx`: a reference trigger for each composition of the drawing's bar, then the publication's state once. The version screen draws `BranchSlot` too. While nothing names the reference, `BranchSlot` draws one placeholder in the reference's own frame, which both compositions share, and `StandalonePage` names the project alone in its heading. The project read's `SlotPlaceholder` draws the same placeholder beside its state's dot and bar.
- `src/screens/product/viewer/reference-trigger.tsx` — `ReferenceTrigger`, the branch or pull request trigger of one bar composition, which the fallback slots and the published slots share. It draws the quiet registered Button through `Action` inside the publication pill, in the cloud-owned `fo-top-reference` wrapper: the whole reference in the full bar and its compact name in the compact bar, each on one line that truncates. The whole reference stays its accessible name and tooltip, and each composition keeps its own instance key.
- `src/screens/product/viewer/account-trigger.tsx`, `account-menu.tsx` and `account-menu-screen.tsx` — `AccountTrigger`, the full bar's avatar that opens the account menu, with `AccountLabel`, what the bar calls the reader; `AccountMenu` and `MorePopover`, the open menus, whose account rows hold who is signed in, Theme, Settings and Sign out, as popovers on a pointer viewport and in the registered panel's bottom sheet on a phone; and the screen that opens them over the ready viewer. `settings-screen.tsx` draws the settings dialog that the menu's Settings opens over the viewer, in Canvas.
- `src/screens/product/viewer/pill.tsx`, `panel-rows.tsx`, `share-link.tsx` and `glyphs.tsx` — `Pill`, the publication pill with its glyph, dot, state and chevron; `PanelList`, the Canvas list of the switcher, History, Share and the projects panel, where the row the reader is on takes the signal-soft fill; `ShareLink`, Share's link with Copy link; and the glyphs that the product icon set has no name for.
- `src/screens/product/viewer/unpublished-stage.tsx` — the Set up publishing and Team cards of a branch with nothing published, and their reader forms.
- `src/screens/product/viewer/build-screen.tsx` and `build-card.tsx` — `BuildPage`, one build's details in the viewer, and the build card it holds: the reference, the three steps and the output, with the `BuildReader` whose role decides the card's action.
- `src/screens/product/viewer/build-stage.tsx` and `build-controls.tsx` — the build card's one action, and its request controls Cancel and Try again: at rest, busy while their request runs, and refused through the write-failure fragment, where Cancel keeps its label.
- `src/screens/product/viewer/publish-stage.tsx` — `StagePublish`, the publishing card of a reference with nothing published, with the CI setup guide beside its control at rest, while its request runs and after a refusal.
- `src/screens/product/viewer/control-guide.tsx` — `ControlWithGuide`, the Control with guide fragment: a write control and its optional guide in one wrapping row.
- `src/screens/product/viewer/pull-request-stage.tsx` — the cards a pull request with nothing published shows: not yet published, closed or merged, and from a fork.
- `src/screens/product/settings/project-builds.tsx` — `AutomaticBuilds`, the project pane's Automatic builds switch, or the sentence that stands in its place when the project cannot build. While the switch's own write runs, the registered switch's `working` word stands beside its label and the switch is disabled; while the settings scope loads, the switch waits as a placeholder of its track beside its label.
- `src/screens/product/icons.tsx` — the product chrome's icon vocabulary and its `Icon` component; the application carries the same map.
- `src/fixtures/site.ts` — `siteOrigin`, the one site origin from which every external `href` in the account, viewer and site fixtures derives.
- `src/fixtures/publications.ts` — the viewer family's refs, publications, history and share link, one SHA per publication.
- `src/fixtures/viewer-catalogue.ts` — the catalogue that the ready drawing browses: the publication's screens that Share also offers, which of them changed, the views that each one was drawn in and whether each view changed, the screen the reader is on and the sample screen it draws.
- `src/fixtures/builds.ts` — the build fixtures, one build per card state and drawn cause, with `build-copy.ts` (each cause's sentence), `build-history.ts` (a branch history with its builds) and `build-output.ts` (the build logs).
- `src/_tests_/catalogue-paths.ts` and `src/_tests_/catalogue-index.ts` — the one place that names the paths of the build output under `mokly-static/`, and the reader of the catalogue index and the entry details through the viewer's own readers; `load-catalogue.ts` gives each entry module's default definition and its saved variants to the source policies.
- `src/_tests_/definition-policy.ts` — the authoring rules that the loaded definitions show: one default definition per entry module, no dependency lists, one render per screen that draws one named screen component and that its variants share, and registered components with closed prop schemas, their own props and declared slots. `catalogue-reads.ts` gives the selection policies the module that owns each index record and the palette of each rendered document, and `wrapper-markup.ts` draws a node inside the renderer's wrapper for the control tests.
- `src/_tests_/deterministic-source-policy.ts` — the [source policy](../protocol/cloud/mockup-source-policy.md) over every drawing, with its rules in the other `deterministic-*.ts` modules; `deterministic-source-parser.ts` builds the drawings' TypeScript program from the workspace's `tsconfig.json` with React's types only, and `drawings-typecheck.test.ts` type-checks every drawing in that program.
- `src/_tests_/product-situations.ts` — the product inventory declarations: `productSituations` and `repeatedStates` with the reason each spare state repeats its canonical drawing. `product-families.ts` holds `productFamilies`, and `callback-landings.ts` holds `callbackLandingPages` with every callback state.
- `src/_tests_/drawn-page.ts` — one generated page read back as markup for the policy tests of the workspace and account drawings: `workspaces-account.test.ts`, `workspaces-settings.test.ts`, `workspaces-viewer.test.ts`, `workspaces-reads.test.ts`, `cli-form.test.ts`, `setup-destinations.test.ts`, `account-writes.test.ts`, `onboarding-waits.test.ts`, `settings-waits.test.ts`, `settings-scope-waits.test.ts` with its cases in `settings-scope-wait-cases.ts`, `settings-session-waits.test.ts`, `settings-writes.test.ts` with its cases in `settings-write-cases.ts`, `viewer-writes.test.ts`, `viewer-waits.test.ts`, `viewer-panel-waits.test.ts`, `viewer-reference-wait.test.ts`, `callback.test.ts` and `product-pages.test.ts`, with the readers of a drawn wait: its region, its section headings, its buttons and whether each is disabled or busy, its links, its placeholder rows and the settings rail's current pane; `workspace-overlays.ts` measures the open select and the GitHub row menu in Chromium.
- `src/_tests_/product-inventory.ts` — derives from those declarations which situations are variants, which are sibling screens, and the folder of each; `product.test.ts` asserts the inventory's size.
- `src/_tests_/app-owners.ts` — names the application file that answers for each drawn screen region in the app-parity check.
- `src/_tests_/app-parity.ts` — holds the two-direction label comparison and the pending-label visibility check.
- `src/_tests_/app-parity-reads.ts` — reads each drawn region and each application source, and matches a label to the source that writes it.
- `src/_tests_/app-pending-labels.ts` — reads each `Pending` an application file renders, with its name and whether it shows; `app-state-titles.ts` reads the titles its states announce.
- `src/_tests_/app-parity-owners.ts` — checks that the owner table and the announcer map of `app-state-titles.ts` still describe the application.
- `src/_tests_/app-parity-sentences.ts` — checks the declared and dropped sentences in the drawings and the owning source.
- `src/_tests_/app-parity-allowances.ts` — holds the allowlists of the app-parity check.
- `src/_tests_/build-drawings.ts`, `stage-drawings.ts` and `stage-card-pages.ts` — what each build drawing, each publishing card and each unresolved build address must draw, read from the viewer builds contract, and the drawn pages the stage card policy tests read.
- `src/_tests_/focus-policy.ts` and `src/_tests_/focus.spec.ts` — the catalogue focus policy: every element that takes focus through `tabindex` draws the token focus outline from the shared rule in `styles/base.css`.
- `src/_tests_/disk-overlay-policy.ts` — `checkDiskOverlay`, the Tab guard that the disk test runs before its capture on each page with an open viewer panel: it requires the `inert` viewer backdrop, then presses Tab once for each panel control from the top of the page and requires each stop inside the panel.
- `src/_tests_/overlay.spec.ts` — the overlay focus checks in Chromium: the regressions that a built settings confirmation page and an open mobile row menu keep focus out of the frame beneath them, and the rejection and acceptance fixtures of the hidden-subtree focus rule in `document-policy.ts`, the inert viewer backdrop and `checkDiskOverlay`.
- `src/_tests_/viewer-builds.spec.ts`, `viewer-panels.spec.ts`, `viewer-ready-stage.spec.ts` and `viewer-recovery.spec.ts` — the Chromium checks of the build and publishing pages, the four slot panels, the ready stage with the marks of its view controls, and the stage's recovery cards, with the in-page measures in `viewer-measures.ts`.
- `src/emails/content.ts` — the typed content of each email, the placeholder names and the formatted lifetime.
- `src/emails/styles.ts` — the literal style table per scheme and viewport and the dark and mobile override groups derived from it.
- `src/emails/document.tsx` — `EmailBody`, the table subtree both compositions render, and `EmailDocument`, the delivered shell around it; each takes `brandRoot` beside the content.
- `src/emails/sign-in.tsx` and `src/emails/invitation.tsx` — one definition per kind: the subject, preheader, text body and `Body`.
- `src/fixtures/emails.ts` — the fixture content the catalogue screens draw.
- `src/screens/design/email/` — the two email screens; `parts/metadata.ts` holds `EMAIL_STYLE_FILES`, the stylesheet list that the root `mokly.config.json` repeats for `design/email/**/index.html`, and `EMAIL_BRAND_ROOT`, the logo folder that `parts/frame.tsx` addresses with `useRepositoryFile`.
- `styles/email/` — the inbox frame stylesheet and the catalogue's byte-identical copies of the published logos.
- `src/_tests_/emails.test.ts`, `emails-policy.test.ts` and `email-styles.test.ts`, with their shared message fixtures in `email-messages.ts`, `src/_tests_/emails-policy.ts` and `src/_tests_/emails.spec.ts` — the email policy checks and the Chromium checks of the generated templates.
- `../../apps/mockups/scripts/emails.ts` — the generator behind `npm run emails:build` and `npm run emails:check`.
- `styles/fonts/` — the self-hosted Geist and Geist Mono faces with their SIL Open Font License, whose one declaration `geist.css` holds. `styles/base.css` imports `geist.css`, and the site rule, whose documents do not link the base stylesheet, links it directly. The drawn `@mokly/ui` parts name the same faces. Each document declares each face once.
- `styles/site/` — the site's Canvas stylesheets, which the site rule links in order: the shared sheets first, then one group for each of the home, the documentation, the changelog and pricing. Every colour comes from the `--mk-*` roles. `styles/site/fonts/` holds Instrument Serif 400, the face of the drawn demo app, with its license.
- `styles/product/viewer-canvas.css` and the other `viewer-canvas-*.css` sheets — the Canvas look of the viewer drawings: `viewer-canvas.css` the bar, the publication pill, the avatar and the search hint, `viewer-canvas-stage.css` the dot-grid stage and its floating cards, `viewer-canvas-depth.css` the shade, the radius and the shadows of a floating surface, `viewer-canvas-panels.css` the panels that the slots open, `viewer-canvas-menu.css` the open account and More menus, `viewer-canvas-check.css` the Mokly check and `viewer-canvas-settings.css` the settings dialog over the viewer. Every rule is scoped to the renderer's wrapper, which carries `data-color-scheme`, and leaves each `@mokly/ui` part in the package's own look, and the application never loads these sheets.
- `styles/base.css` — the import of the self-hosted Geist faces of `styles/fonts/geist.css`, the document defaults, the local link rules and the shared focus rule for every element that takes focus through `tabindex`.
- `styles/components.css` — the registered settings dialog and layer frames, the write-failure fragment, the Control with guide row and the error-details disclosure, plus the import of `styles/overlays.css` (the panel frame and the row menu); the application copies these stylesheets, so each composition is declared once.
- `styles/product/` — the Folio product stylesheets, one per family: `shared.css` the document defaults, the Mac window's insets, the parts of each top bar that move its window and the rule that keeps them at the top of the Mac window while the page scrolls, `folio.css` the stage, `account.css` the account entry, `viewer.css` the top bar, its one switch width between the full and the compact composition, and the stage cards, `viewer-bar.css`, which `viewer.css` imports, the viewer root as the bar's container, the compact composition and the application's probe of the switch, `viewer-depiction.css` the drawing's sample screen and its comparison message over the preview pane, which only the drawing's module imports, so the application never loads it, `inventory.css` the sections, forms, states and the `.fo-notice` line beside a control, `builds.css` the build card with its steps and output; the [composition guide](./composition.md) lists which file draws which composition.

### Related Docs

- [Mockup catalogue contract](../protocol/cloud/mockups.md), with
  [tooling](../protocol/cloud/mockup-tooling.md),
  [verification](../protocol/cloud/mockup-verification.md) and
  [baselines](../protocol/cloud/mockup-baselines.md).
- [Product mockups](../protocol/cloud/product-mockups.md) and its
  [account](../protocol/cloud/product-mockups-account.md),
  [desktop app](../protocol/cloud/product-mockups-account-desktop.md),
  [settings](../protocol/cloud/product-mockups-settings.md) and
  [viewer](../protocol/cloud/product-mockups-viewer.md) inventories.
- [Design tokens](../protocol/cloud/design-tokens.md) with its
  [color tables](../protocol/cloud/design-tokens-color.md), the
  [viewer palette](../protocol/mokly-viewer-palette.md) for the Canvas palette,
  [Folio chrome](../protocol/cloud/folio-chrome.md) with its
  [viewer compositions](../protocol/cloud/folio-viewer.md) and
  [account entry](../protocol/cloud/folio-chrome-account.md) pages, and
  [Shared controls](../protocol/cloud/shared-controls.md) with the
  [static overlay exception](../protocol/cloud/shared-control-overlays.md#static-product-overlays).
- [Settings dialog](../protocol/cloud/settings-dialog.md),
  [Viewer host](../protocol/cloud/viewer-host.md) for the hosted package the viewer
  family draws, [Viewer chrome](../protocol/cloud/viewer-chrome.md) and its
  [account menu](../protocol/cloud/viewer-chrome-account.md) for its bar and
  account menu, [Viewer builds](../protocol/cloud/viewer-builds.md) and
  [Viewer build navigation](../protocol/cloud/viewer-build-navigation.md) for the
  build and publishing cards it draws, and
  [Product copy](../protocol/cloud/product-copy.md) for the text inside screens.
- [Site design](../protocol/cloud/site-design.md) with its
  [components](../protocol/cloud/site-design-components.md) and
  [pages](../protocol/cloud/site-design-pages.md),
  [Site mockups](../protocol/cloud/site-mockups.md) for the site screens,
  [Marketing site](../protocol/cloud/marketing-site.md) for the links between the
  site and the app, [Email](../protocol/cloud/email.md) and the
  [architecture doc](../architecture/cloud.md).
